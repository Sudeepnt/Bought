-- Keep ordinary public refreshes read-mostly. The transaction advisory lock is
-- only needed at a UTC boundary, when an auction row is missing, or when a
-- stored phase is stale.
create index bought_drops_category
on public.bought_drops(category);

create index bought_drops_reviewer
on public.bought_drops(reviewed_by)
where reviewed_by is not null;

create index bought_drops_auction
on public.bought_drops(auction_id)
where auction_id is not null;

create index bought_webhook_events_drop
on public.bought_webhook_events(drop_id)
where drop_id is not null;

-- Provider resources are finite even after payment. Keep repeated signed-upload
-- and direct-upload creation bounded per broadcast; support can inspect a drop
-- that legitimately exhausts these generous retry budgets.
alter table public.bought_drops
add column upload_attempts integer not null default 0
check (upload_attempts between 0 and 20);

alter table public.bought_drops
add column thumbnail_attempts integer not null default 0
check (thumbnail_attempts between 0 and 30);

-- Provider checkout calls happen outside the database transaction. A short
-- lease prevents simultaneous retries from both creating a payable order,
-- while still allowing an ambiguous/failed request to reconcile after the
-- provider timeout (20 seconds) has elapsed.
alter table public.bought_drops
add column checkout_claimed_at timestamptz;

create or replace function public.bought_advance()
returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  t timestamptz;
  day date;
  start_at timestamptz;
  desired_state text;
  initialized boolean;
begin
  t := clock_timestamp();
  day := (t at time zone 'UTC')::date;
  start_at := day::timestamp at time zone 'UTC';
  desired_state := case
    when t < start_at + interval '12 hours' then 'bidding'
    else 'exposure'
  end;

  select
    exists (
      select 1
      from public.bought_auctions
      where id = day
        and opens_at = start_at
        and closes_at = start_at + interval '12 hours'
        and exposure_ends_at = start_at + interval '1 day'
        and state = desired_state
    )
    and exists (
      select 1
      from public.bought_auctions
      where id = day + 1
        and opens_at = start_at + interval '1 day'
        and closes_at = start_at + interval '36 hours'
        and exposure_ends_at = start_at + interval '2 days'
        and state = 'bidding'
    )
    and not exists (
      select 1
      from public.bought_auctions
      where id < day and state <> 'closed'
    )
  into initialized;

  if not initialized then
    perform pg_advisory_xact_lock(73198512);

    insert into public.bought_auctions(
      id,
      opens_at,
      closes_at,
      exposure_ends_at
    )
    values
      (
        day,
        start_at,
        start_at + interval '12 hours',
        start_at + interval '1 day'
      ),
      (
        day + 1,
        start_at + interval '1 day',
        start_at + interval '36 hours',
        start_at + interval '2 days'
      )
    on conflict do nothing;

    update public.bought_auctions
    set state = case
      when exposure_ends_at <= t then 'closed'
      when closes_at <= t then 'exposure'
      else 'bidding'
    end
    where state is distinct from case
      when exposure_ends_at <= t then 'closed'
      when closes_at <= t then 'exposure'
      else 'bidding'
    end;
  end if;

  return jsonb_build_object(
    'auctionId', day::text,
    'serverNow', t,
    'opensAt', start_at,
    'closesAt', start_at + interval '12 hours',
    'exposureEndsAt', start_at + interval '1 day',
    'phase', desired_state,
    'configured', true
  );
end
$$;

-- A request that lost the provider response may safely retry reconciliation.
-- Stripe uses a stable idempotency key; Razorpay first queries the unique
-- drop-ID receipt. The checkout remains in creating until an exact provider
-- response is validated and linked by the server.
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
    raise exception 'BOUGHT: Bidding opens at 00:00 UTC. Your draft is saved.';
  end if;

  select *
  into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
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
  set
    checkout_state = 'creating',
    checkout_claimed_at = clock_timestamp()
  where id = p_drop_id;
  return true;
end
$$;

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
begin
  select *
  into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.payment_state <> 'paid' then
    raise exception 'BOUGHT: Wait for payment confirmation before recording.';
  end if;
  if d.state not in ('draft', 'rejected') then
    raise exception 'BOUGHT: This broadcast has already been submitted.';
  end if;
  if d.upload_claimed_at > clock_timestamp() - interval '2 minutes' then
    raise exception 'BOUGHT: An upload is being prepared. Try again shortly.';
  end if;
  if not p_replace
    and d.mux_upload_url is not null
    and d.mux_upload_expires_at > clock_timestamp() + interval '5 minutes'
    and d.media_state = 'waiting'
  then
    return false;
  end if;
  if d.upload_attempts >= 20 then
    raise exception 'BOUGHT: This broadcast has used its upload retry limit. Contact support with its ID.';
  end if;

  update public.bought_drops
  set
    upload_attempts = upload_attempts + 1,
    upload_claimed_at = clock_timestamp(),
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

create function public.bought_claim_thumbnail(
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
  select *
  into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.payment_state <> 'paid' then
    raise exception 'BOUGHT: Wait for payment confirmation before choosing a thumbnail.';
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
  set
    thumbnail_attempts = thumbnail_attempts + 1,
    thumbnail_path = p_path,
    thumbnail_verified = false
  where id = d.id;
  return d.thumbnail_path;
end
$$;

-- Claim the webhook event with its unique key before touching a drop. This
-- makes replay handling atomic without serializing every payment globally.
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
begin
  insert into public.bought_webhook_events(provider, event_id)
  values (p_provider, p_event_id)
  on conflict do nothing;
  if not found then return; end if;

  select *
  into d
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
    set
      payment_state = p_state,
      state = case when state = 'published' then 'rejected' else state end,
      review_reason = 'Payment was reversed. Contact support.'
    where id = d.id;

    if exists (
      select 1
      from public.bought_auctions
      where id = d.auction_id and closes_at > clock_timestamp()
    ) then
      update public.bought_ladder l
      set position = ranked.position
      from (
        select
          drop_id,
          row_number() over (
            order by amount_minor desc, paid_at asc, drop_id asc
          )::integer position
        from public.bought_ladder
        where auction_id = d.auction_id
      ) ranked
      where l.drop_id = ranked.drop_id;
    end if;
  else
    update public.bought_drops
    set
      payment_state = 'paid',
      payment_id = p_payment_id,
      paid_at = coalesce(paid_at, clock_timestamp())
    where id = d.id;
  end if;
end
$$;

-- Ranking mutations use one lock per auction. Different auction days can make
-- progress independently while every rank within a day stays deterministic.
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
    or d.payment_state <> 'paid'
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
    set
      state = 'rejected',
      reviewed_at = t,
      reviewed_by = p_reviewer,
      review_reason = left(p_reason, 500)
    where id = d.id;
    return;
  end if;

  -- If this transaction waits across the cutoff, roll forward and lock the
  -- next day in ascending order rather than publishing into a closed auction.
  loop
    t := clock_timestamp();
    select *
    into a
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
  set
    state = 'published',
    reviewed_at = t,
    reviewed_by = p_reviewer,
    review_reason = null,
    auction_id = a.id,
    exposure_starts_at = a.closes_at,
    exposure_ends_at = a.exposure_ends_at
  where id = d.id;

  insert into public.bought_ladder(
    drop_id,
    auction_id,
    position,
    category,
    title,
    amount_minor,
    paid_at,
    exposure_starts_at,
    exposure_ends_at
  )
  values (
    d.id,
    a.id,
    1,
    d.category,
    d.title,
    d.amount_minor,
    d.paid_at,
    a.closes_at,
    a.exposure_ends_at
  );

  update public.bought_ladder l
  set position = ranked.position
  from (
    select
      drop_id,
      row_number() over (
        order by amount_minor desc, paid_at asc, drop_id asc
      )::integer position
    from public.bought_ladder
    where auction_id = a.id
  ) ranked
  where l.drop_id = ranked.drop_id;
end
$$;

-- Serve the market clock and public ladder in one PostgREST round trip. This
-- function remains invoker-security and is callable only by the server role.
create function public.bought_snapshot()
returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  market jsonb;
  entries jsonb;
begin
  market := public.bought_advance();

  select coalesce(
    jsonb_agg(to_jsonb(entry) order by entry.position),
    '[]'::jsonb
  )
  into entries
  from (
    select
      drop_id,
      position,
      category,
      title,
      amount_minor,
      published_at,
      exposure_ends_at
    from public.bought_ladder
    where auction_id = (market ->> 'auctionId')::date
    order by position
    limit 100
  ) entry;

  return jsonb_build_object('market', market, 'entries', entries);
end
$$;

revoke all on function
  public.bought_advance(),
  public.bought_claim_checkout(uuid),
  public.bought_claim_upload(uuid, boolean),
  public.bought_claim_thumbnail(uuid, text),
  public.bought_payment_event(text, text, text, text, integer, text, text),
  public.bought_review(uuid, text, uuid, boolean, text),
  public.bought_snapshot()
from public, anon, authenticated;
grant execute on function
  public.bought_advance(),
  public.bought_claim_checkout(uuid),
  public.bought_claim_upload(uuid, boolean),
  public.bought_claim_thumbnail(uuid, text),
  public.bought_payment_event(text, text, text, text, integer, text, text),
  public.bought_review(uuid, text, uuid, boolean, text),
  public.bought_snapshot()
to service_role;
