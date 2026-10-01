-- Free broadcasts become visible as soon as a moderator approves them, even
-- after paid bidding has closed. Paid entries keep the existing next-auction
-- behavior. Public snapshots include only a creator's chosen display name.

alter table public.bought_drops
  add column if not exists creator_name text not null default 'BOUGHT creator'
  check (char_length(creator_name) between 1 and 80);

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
    if d.payment_state = 'unpaid' then
      select * into a
      from public.bought_auctions
      where opens_at <= t and exposure_ends_at > t
      order by opens_at desc
      limit 1;
    else
      select * into a
      from public.bought_auctions
      where closes_at > t
      order by opens_at
      limit 1;
    end if;
    if not found then
      raise exception 'BOUGHT: No auction is available for publication.';
    end if;

    perform pg_advisory_xact_lock(
      73198513,
      (a.id - date '2000-01-01')::integer
    );
    exit when (
      d.payment_state = 'unpaid'
      and a.opens_at <= clock_timestamp()
      and a.exposure_ends_at > clock_timestamp()
    ) or (
      d.payment_state = 'paid'
      and a.closes_at > clock_timestamp()
    );
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

create or replace function public.bought_snapshot()
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
      l.drop_id,
      l.position,
      l.category,
      l.title,
      l.amount_minor,
      l.published_at,
      l.exposure_ends_at,
      d.creator_name
    from public.bought_ladder l
    join public.bought_drops d on d.id = l.drop_id
    where l.auction_id = (market ->> 'auctionId')::date
    order by l.position
    limit 100
  ) entry;

  return jsonb_build_object('market', market, 'entries', entries);
end
$$;
