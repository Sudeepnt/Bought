-- Web Push subscriptions are private and can only be managed by the server.
create table public.bought_push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 16 and 2048),
  user_id uuid not null references auth.users(id) on delete cascade,
  expiration_time timestamptz,
  p256dh text not null check (char_length(p256dh) between 80 and 128),
  auth text not null check (char_length(auth) between 16 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bought_push_subscriptions_owner
on public.bought_push_subscriptions(user_id);

create table public.bought_push_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('outbid', 'leader')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 500),
  href text not null check (
    char_length(href) between 1 and 256
    and left(href, 1) = '/'
    and left(href, 2) <> '//'
  ),
  created_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 10),
  claimed_until timestamptz,
  delivered_at timestamptz
);
create index bought_push_events_pending
on public.bought_push_events(id)
where delivered_at is null and attempts < 10;

alter table public.bought_push_subscriptions enable row level security;
alter table public.bought_push_events enable row level security;
revoke all on public.bought_push_subscriptions, public.bought_push_events from public, anon, authenticated;
grant select, insert, update, delete on public.bought_push_subscriptions, public.bought_push_events to service_role;
grant usage, select on sequence public.bought_push_events_id_seq to service_role;

-- A row is a real bidder only after the first completed ladder recalculation.
-- bought_review inserts each new row temporarily at #1 before ranking it.
alter table public.bought_ladder
add column push_initial_ranked boolean not null default false;
update public.bought_ladder set push_initial_ranked = true;

create function public.bought_mark_ranked_for_push()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.push_initial_ranked := true;
  return new;
end
$$;

create trigger bought_ladder_mark_ranked_for_push
before update of position on public.bought_ladder
for each row
execute function public.bought_mark_ranked_for_push();

-- A new top entry alerts its owner. Rank changes notify the displaced owner;
-- SQL records those alerts in the same transaction as the leaderboard update.
create function public.bought_queue_rank_push()
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
  select d.user_id
  into recipient
  from public.bought_drops d
  where d.id = new.drop_id;

  if recipient is null then
    return new;
  end if;

  if new.position < old.position and new.position = 1 then
    alert_kind := 'leader';
    alert_title := 'You took #1';
    alert_body := pg_catalog.format('Your %s bid just moved into the top spot.', new.category);
    next_href := '/categories';
  elsif new.position > old.position and old.position = 1 then
    alert_kind := 'leader';
    alert_title := 'A new bidder took #1';
    alert_body := pg_catalog.format('Your %s bid moved from #1 to #%s.', new.category, new.position);
    next_href := '/categories';
  elsif new.position > old.position then
    alert_kind := 'outbid';
    alert_title := 'You were outbid';
    alert_body := pg_catalog.format('Your %s bid moved from #%s to #%s.', new.category, old.position, new.position);
    next_href := '/broadcast';
  else
    return new;
  end if;

  insert into public.bought_push_events(user_id, kind, title, body, href)
  values (recipient, alert_kind, alert_title, alert_body, next_href);
  return new;
end
$$;

create trigger bought_ladder_push_new_leader
after insert on public.bought_ladder
for each row
when (new.position = 1)
execute function public.bought_queue_rank_push();

create trigger bought_ladder_push_rank_change
after update of position on public.bought_ladder
for each row
when (old.push_initial_ranked and new.position is distinct from old.position)
execute function public.bought_queue_rank_push();

-- bought_review performs several temporary rank changes in one transaction.
-- A deferred check sees the final rank and only tells a genuinely new #1.
create function public.bought_queue_new_leader_push()
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
    pg_catalog.format('Your %s bid just moved into the top spot.', final_category),
    '/categories'
  );
  return new;
end
$$;

create constraint trigger bought_drop_push_new_leader
after update of state on public.bought_drops
deferrable initially deferred
for each row
when (old.state is distinct from new.state and new.state = 'published')
execute function public.bought_queue_new_leader_push();

create function public.bought_claim_push_events(p_limit integer default 25)
returns table (
  id bigint,
  user_id uuid,
  kind text,
  title text,
  body text,
  href text
)
language sql
security definer
set search_path = ''
as $$
  with ready as (
    select e.id
    from public.bought_push_events e
    where e.delivered_at is null
      and e.attempts < 10
      and (e.claimed_until is null or e.claimed_until <= now())
    order by e.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 25))
  )
  update public.bought_push_events as e
  set claimed_until = now() + interval '2 minutes',
      attempts = e.attempts + 1
  from ready
  where e.id = ready.id
  returning e.id, e.user_id, e.kind, e.title, e.body, e.href
$$;

revoke all on function public.bought_claim_push_events(integer) from public, anon, authenticated;
grant execute on function public.bought_claim_push_events(integer) to service_role;
