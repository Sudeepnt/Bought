-- Video uploads are free. A user may create at most three fresh Mux upload
-- targets per UTC day; retries that reuse a live target do not consume quota.
create table public.bought_upload_daily_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  upload_date date not null,
  upload_count smallint not null check (upload_count between 0 and 3)
);

alter table public.bought_upload_daily_usage enable row level security;
revoke all on public.bought_upload_daily_usage from public, anon, authenticated;
grant all on public.bought_upload_daily_usage to service_role;

alter table public.bought_drops add column upload_quota_date date;

create or replace function public.bought_claim_upload(
  p_drop_id uuid,
  p_replace boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
  upload_day date;
  daily_count smallint;
begin
  select * into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.payment_state in ('refunded', 'disputed') then
    raise exception 'BOUGHT: A reversed payment cannot be uploaded.';
  end if;
  if d.state not in ('draft', 'rejected') then
    raise exception 'BOUGHT: This broadcast has already been submitted.';
  end if;
  if not p_replace
    and d.mux_upload_url is not null
    and d.mux_upload_expires_at > clock_timestamp() + interval '5 minutes'
    and d.media_state = 'waiting'
  then
    return false;
  end if;
  if d.upload_claimed_at > clock_timestamp() - interval '2 minutes' then
    raise exception 'BOUGHT: An upload is being prepared. Try again shortly.';
  end if;
  if d.upload_attempts >= 20 then
    raise exception 'BOUGHT: This broadcast has used its upload retry limit. Contact support with its ID.';
  end if;

  upload_day := (clock_timestamp() at time zone 'UTC')::date;
  insert into public.bought_upload_daily_usage(user_id, upload_date, upload_count)
  values (d.user_id, upload_day, 1)
  on conflict (user_id) do update
    set upload_date = excluded.upload_date,
        upload_count = case
          when public.bought_upload_daily_usage.upload_date = excluded.upload_date
            then public.bought_upload_daily_usage.upload_count + 1
          else 1
        end
    where public.bought_upload_daily_usage.upload_date <> excluded.upload_date
       or public.bought_upload_daily_usage.upload_count < 3
  returning upload_count into daily_count;

  if not found then
    raise exception 'BOUGHT: You have used your 3 free video uploads for today. Try again after 00:00 UTC.';
  end if;

  update public.bought_drops
  set upload_attempts = upload_attempts + 1,
      upload_claimed_at = clock_timestamp(),
      upload_quota_date = upload_day,
      mux_upload_id = null,
      mux_upload_url = null,
      mux_asset_id = null,
      mux_playback_id = null,
      media_state = 'none',
      state = 'draft',
      submitted_at = null,
      review_reason = null,
      reviewed_at = null,
      reviewed_by = null
  where id = d.id;
  return true;
end
$$;

create or replace function public.bought_release_upload_quota(p_drop_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
begin
  select * into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    return;
  end if;
  if d.upload_quota_date is null or d.mux_upload_id is not null then
    return;
  end if;

  update public.bought_upload_daily_usage
  set upload_count = greatest(upload_count - 1, 0)
  where user_id = d.user_id
    and upload_date = d.upload_quota_date;

  update public.bought_drops
  set upload_claimed_at = null,
      upload_quota_date = null
  where id = d.id;
end
$$;

create or replace function public.bought_claim_thumbnail(
  p_drop_id uuid,
  p_path text
)
returns text
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
begin
  select * into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.payment_state in ('refunded', 'disputed') then
    raise exception 'BOUGHT: A reversed payment cannot be edited.';
  end if;
  if d.state not in ('draft', 'rejected') then
    raise exception 'BOUGHT: This broadcast has already been submitted.';
  end if;
  if d.thumbnail_attempts >= 30 then
    raise exception 'BOUGHT: This broadcast has used its thumbnail retry limit. Contact support with its ID.';
  end if;
  if p_path is distinct from
    d.user_id::text || '/' || d.id::text || '/thumbnail-staging'
  then
    raise exception 'BOUGHT: Invalid thumbnail path.';
  end if;

  update public.bought_drops
  set thumbnail_attempts = thumbnail_attempts + 1,
      thumbnail_path = p_path,
      thumbnail_verified = false
  where id = d.id;
  return d.thumbnail_path;
end
$$;

revoke all on function public.bought_release_upload_quota(uuid)
from public, anon, authenticated;
grant execute on function public.bought_release_upload_quota(uuid)
to service_role;

-- A successfully reviewed free post is public and occupies the floor at zero.
-- A later verified payment changes its ladder amount and rank.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.bought_drops'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%state <> ''published''%payment_state%paid%';
  if constraint_name is not null then
    execute format('alter table public.bought_drops drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.bought_drops
  add constraint bought_drops_published_media_check
  check (
    state <> 'published'
    or (
      payment_state in ('unpaid', 'paid')
      and media_state = 'ready'
      and thumbnail_verified
      and submitted_at is not null
      and reviewed_at is not null
    )
  );

create or replace function public.bought_submit(p_drop_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
begin
  select * into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.payment_state in ('refunded', 'disputed') then
    raise exception 'BOUGHT: A reversed payment cannot be submitted.';
  end if;
  if d.state in ('processing', 'review', 'published') then
    return;
  end if;
  if d.state = 'rejected'
    or d.media_state not in ('waiting', 'processing', 'ready')
    or not d.thumbnail_verified
  then
    raise exception 'BOUGHT: Finish your video and thumbnail before submitting.';
  end if;

  update public.bought_drops
  set submitted_at = clock_timestamp(),
      state = case when media_state = 'ready' then 'review' else 'processing' end
  where id = d.id;
end
$$;

create or replace function public.bought_payment_event(
  p_provider text,
  p_event_id text,
  p_reference text,
  p_payment_id text,
  p_amount integer,
  p_currency text,
  p_state text
)
returns void
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
  paid_time timestamptz;
begin
  insert into public.bought_webhook_events(provider, event_id)
  values (p_provider, p_event_id)
  on conflict do nothing;
  if not found then
    return;
  end if;

  select * into d
  from public.bought_drops
  where provider = p_provider
    and (
      (p_reference is not null and payment_reference = p_reference)
      or (p_payment_id is not null and payment_id = p_payment_id)
    )
  for update;

  if not found then
    raise exception 'BOUGHT: Payment has not been linked yet.';
  end if;
  if p_state not in ('paid', 'refunded', 'disputed')
    or d.amount_minor <> p_amount
    or d.currency <> upper(p_currency)
  then
    raise exception 'BOUGHT: Payment does not match the reserved broadcast.';
  end if;

  update public.bought_webhook_events
  set drop_id = d.id
  where provider = p_provider and event_id = p_event_id;

  if p_state = 'paid' and d.payment_state in ('refunded', 'disputed') then
    return;
  end if;

  if p_state <> 'paid' then
    if d.auction_id is not null then
      perform pg_advisory_xact_lock(
        73198513,
        (d.auction_id - date '2000-01-01')::integer
      );
    end if;

    delete from public.bought_ladder where drop_id = d.id;
    update public.bought_drops
    set payment_state = p_state,
        state = case when state = 'published' then 'rejected' else state end,
        review_reason = 'Payment was reversed. Contact support.'
    where id = d.id;

    if exists (
      select 1 from public.bought_auctions
      where id = d.auction_id and closes_at > clock_timestamp()
    ) then
      update public.bought_ladder l
      set position = ranked.position
      from (
        select drop_id,
          row_number() over (
            order by amount_minor desc, paid_at asc, drop_id asc
          )::integer position
        from public.bought_ladder
        where auction_id = d.auction_id
      ) ranked
      where l.drop_id = ranked.drop_id;
    end if;
  else
    paid_time := coalesce(d.paid_at, clock_timestamp());
    update public.bought_drops
    set payment_state = 'paid',
        payment_id = p_payment_id,
        paid_at = paid_time
    where id = d.id;

    if d.state = 'published' and d.auction_id is not null then
      perform pg_advisory_xact_lock(
        73198513,
        (d.auction_id - date '2000-01-01')::integer
      );
      update public.bought_ladder
      set amount_minor = d.amount_minor,
          paid_at = paid_time
      where drop_id = d.id;
      if exists (
        select 1 from public.bought_auctions
        where id = d.auction_id and closes_at > clock_timestamp()
      ) then
        update public.bought_ladder l
        set position = ranked.position
        from (
          select drop_id,
            row_number() over (
              order by amount_minor desc, paid_at asc, drop_id asc
            )::integer position
          from public.bought_ladder
          where auction_id = d.auction_id
        ) ranked
        where l.drop_id = ranked.drop_id;
      end if;
    end if;
  end if;
end
$$;

create or replace function public.bought_review(
  p_drop_id uuid,
  p_asset_id text,
  p_reviewer uuid,
  p_approve boolean,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
  a public.bought_auctions;
  t timestamptz;
begin
  perform public.bought_advance();
  select * into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  t := clock_timestamp();
  if d.state = 'published'
    and p_approve
    and d.mux_asset_id = p_asset_id
  then
    return;
  end if;
  if d.state <> 'review'
    or d.mux_asset_id is distinct from p_asset_id
    or d.payment_state in ('refunded', 'disputed')
    or d.media_state <> 'ready'
    or not d.thumbnail_verified
  then
    raise exception 'BOUGHT: This version is not ready for review.';
  end if;

  if not p_approve then
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'BOUGHT: Add a reason for the retake.';
    end if;
    update public.bought_drops
    set state = 'rejected',
        reviewed_at = t,
        reviewed_by = p_reviewer,
        review_reason = left(p_reason, 500)
    where id = d.id;
    return;
  end if;

  loop
    t := clock_timestamp();
    select * into a
    from public.bought_auctions
    where closes_at > t
    order by opens_at
    limit 1;
    if not found then
      raise exception 'BOUGHT: No auction is available for publication.';
    end if;

    perform pg_advisory_xact_lock(
      73198513,
      (a.id - date '2000-01-01')::integer
    );
    exit when a.closes_at > clock_timestamp();
  end loop;

  t := clock_timestamp();
  update public.bought_drops
  set state = 'published',
      reviewed_at = t,
      reviewed_by = p_reviewer,
      review_reason = null,
      auction_id = a.id,
      exposure_starts_at = a.closes_at,
      exposure_ends_at = a.exposure_ends_at
  where id = d.id;

  insert into public.bought_ladder(
    drop_id, auction_id, position, category, title, amount_minor, paid_at,
    exposure_starts_at, exposure_ends_at
  ) values (
    d.id, a.id, 1, d.category, d.title,
    case when d.payment_state = 'paid' then d.amount_minor else 0 end,
    coalesce(d.paid_at, t), a.closes_at, a.exposure_ends_at
  );

  update public.bought_ladder l
  set position = ranked.position
  from (
    select drop_id,
      row_number() over (
        order by amount_minor desc, paid_at asc, drop_id asc
      )::integer position
    from public.bought_ladder
    where auction_id = a.id
  ) ranked
  where l.drop_id = ranked.drop_id;
end
$$;

revoke all on function public.bought_submit(uuid),
  public.bought_payment_event(text,text,text,text,integer,text,text),
  public.bought_review(uuid,text,uuid,boolean,text)
from public, anon, authenticated;
grant execute on function public.bought_submit(uuid),
  public.bought_payment_event(text,text,text,text,integer,text,text),
  public.bought_review(uuid,text,uuid,boolean,text)
to service_role;

create or replace function public.bought_queue_rank_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  alert_kind text;
  alert_title text;
  alert_body text;
  next_href text;
begin
  select d.user_id into recipient
  from public.bought_drops d
  where d.id = new.drop_id;

  if recipient is null then
    return new;
  end if;

  if new.position < old.position and new.position = 1 then
    alert_kind := 'leader';
    alert_title := 'You took #1';
    alert_body := pg_catalog.format('Your %s entry just moved into the top spot.', new.category);
    next_href := '/categories';
  elsif new.position > old.position and old.position = 1 then
    alert_kind := 'leader';
    alert_title := 'A new entry took #1';
    alert_body := pg_catalog.format('Your %s position moved from #1 to #%s.', new.category, new.position);
    next_href := '/categories';
  elsif new.position > old.position then
    alert_kind := 'outbid';
    alert_title := 'Your position changed';
    alert_body := pg_catalog.format('Your %s position moved from #%s to #%s.', new.category, old.position, new.position);
    next_href := '/broadcast';
  else
    return new;
  end if;

  insert into public.bought_push_events(user_id, kind, title, body, href)
  values (recipient, alert_kind, alert_title, alert_body, next_href);
  return new;
end
$$;

create or replace function public.bought_queue_new_leader_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  final_position integer;
  final_category text;
begin
  select l.position, l.category
  into final_position, final_category
  from public.bought_ladder l
  where l.drop_id = new.id;

  if final_position is distinct from 1 then
    return new;
  end if;

  insert into public.bought_push_events(user_id, kind, title, body, href)
  values (
    new.user_id,
    'leader',
    'You took #1',
    pg_catalog.format('Your %s entry just moved into the top spot.', final_category),
    '/categories'
  );
  return new;
end
$$;

create or replace function public.bought_claim_checkout(p_drop_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
  market jsonb;
begin
  market := public.bought_advance();
  if market ->> 'phase' <> 'bidding' then
    raise exception 'BOUGHT: Bidding opens at 00:00 UTC. Your free broadcast stays public.';
  end if;

  select * into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.state <> 'published' then
    raise exception 'BOUGHT: Publish your free broadcast and pass review before placing an optional boost bid.';
  end if;
  if d.payment_state <> 'unpaid' then
    raise exception 'BOUGHT: This broadcast is already paid.';
  end if;
  if d.checkout_state = 'ready' then
    return false;
  end if;
  if d.checkout_state = 'creating'
    and d.checkout_claimed_at > clock_timestamp() - interval '30 seconds'
  then
    return false;
  end if;

  update public.bought_drops
  set checkout_state = 'creating',
      checkout_claimed_at = clock_timestamp()
  where id = p_drop_id;
  return true;
end
$$;
