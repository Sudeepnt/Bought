-- Bought. Daily: advertiser accounts, ads, the per-spot auction and prepaid credits.
-- The media pipeline (upload claim, thumbnail claim, media event, transcription lease) is Bought's,
-- moved from one broadcast per drop to one ad per spot. The rules are the ones the Advertise page
-- prints: 6 display spots + 8 classified lines per issue, open D-7 07:00 IST, close D-1 22:00 IST,
-- a 5-minute soft close up to 22:30, auto-raise, credits set aside at bid time.
-- The service role owns every mutation. Browsers go through the API and read nothing directly.
-- Money is integer minor units (cents). Bids are whole dollars.

create table public.bought_accounts (
 user_id uuid primary key references auth.users(id),
 name text not null check (char_length(name) between 1 and 120),
 email text not null check (char_length(email) between 3 and 254),
 country text not null default 'India' check (char_length(country) between 2 and 60),
 gstin text check (gstin is null or gstin ~ '^[0-9A-Z]{15}$'),
 method text not null default 'upi' check (method in ('upi','card')),
 balance_minor bigint not null default 0,
 created_at timestamptz not null default now()
);

create table public.bought_ad_spots (
 spot text primary key,
 fmt text not null check (fmt in ('video','classified')),
 reserve_usd integer not null check (reserve_usd > 0),
 inc_usd integer not null check (inc_usd > 0),
 seats integer not null default 1 check (seats > 0)
);
insert into public.bought_ad_spots(spot,fmt,reserve_usd,inc_usd,seats) values
 ('top','video',600,10,1),('front','video',450,10,1),('feed-a','video',220,10,1),
 ('half','video',700,10,1),('feed-e','video',180,10,1),('clip','video',200,10,1),
 ('cls','classified',5,1,8);

create table public.bought_ads (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 spot text not null references public.bought_ad_spots(spot),
 kind text not null check (kind in ('video','image','classified')),
 title text not null check (char_length(title) between 1 and 160),
 fields jsonb not null default '{}'::jsonb,
 state text not null default 'draft' check (state in ('draft','processing','review','approved','rejected')),
 mux_upload_id text unique,
 mux_upload_url text,
 mux_upload_expires_at timestamptz,
 upload_claimed_at timestamptz,
 upload_attempts smallint not null default 0 check (upload_attempts between 0 and 20),
 upload_quota_date date,
 mux_asset_id text unique,
 mux_playback_id text,
 media_state text not null default 'none' check (media_state in ('none','waiting','processing','ready','errored')),
 thumbnail_path text unique,
 thumbnail_verified boolean not null default false,
 thumbnail_attempts smallint not null default 0 check (thumbnail_attempts between 0 and 30),
 submitted_at timestamptz,
 review_reason text,
 reviewed_at timestamptz,
 transcription_status text not null default 'pending' check (transcription_status in ('pending','processing','ready','errored')),
 transcription_asset_id text,
 transcript_english text check (transcript_english is null or char_length(transcript_english) <= 100000),
 captions_vtt text check (captions_vtt is null or char_length(captions_vtt) <= 200000),
 transcription_claimed_at timestamptz,
 transcribed_at timestamptz,
 transcription_error text,
 transcription_attempts integer not null default 0 check (transcription_attempts between 0 and 10),
 created_at timestamptz not null default now(),
 check (state <> 'approved' or reviewed_at is not null)
);
create index bought_ads_owner on public.bought_ads(user_id, created_at desc);
create index bought_ads_review_queue on public.bought_ads(submitted_at) where state = 'review';

create table public.bought_ad_upload_usage (
 user_id uuid primary key references auth.users(id),
 upload_date date not null,
 upload_count smallint not null check (upload_count between 0 and 10)
);

create table public.bought_issue_spots (
 issue date not null,
 spot text not null references public.bought_ad_spots(spot),
 closes_at timestamptz not null,
 ext integer not null default 0,
 high_minor bigint not null default 0,
 bid_count integer not null default 0,
 leader_bid uuid,
 settled_at timestamptz,
 finalized_at timestamptz,
 primary key (issue, spot)
);

create table public.bought_ad_bids (
 id uuid primary key default gen_random_uuid(),
 issue date not null,
 spot text not null references public.bought_ad_spots(spot),
 user_id uuid not null references auth.users(id),
 ad_id uuid not null references public.bought_ads(id),
 mode text not null check (mode in ('auto','exact')),
 amount_minor bigint not null check (amount_minor > 0 and amount_minor % 100 = 0),
 max_minor bigint not null check (max_minor >= amount_minor and max_minor % 100 = 0),
 status text not null check (status in ('leading','outbid','in','out','won','lost')),
 placed_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique (issue, spot, user_id),
 foreign key (issue, spot) references public.bought_issue_spots(issue, spot)
);
create index bought_ad_bids_user on public.bought_ad_bids(user_id, status);
create index bought_ad_bids_spot on public.bought_ad_bids(issue, spot, amount_minor desc);

-- Public history. Bidders are shown as a stable per-issue handle, never an identity.
create table public.bought_ad_log (
 id bigint generated always as identity primary key,
 issue date not null,
 spot text not null,
 kind text not null check (kind in ('bid','auto','ext')),
 user_id uuid,
 amount_minor bigint,
 until_at timestamptz,
 at timestamptz not null default clock_timestamp()
);
create index bought_ad_log_spot on public.bought_ad_log(issue, spot, id desc);
create index bought_ad_log_recent on public.bought_ad_log(id desc);

create table public.bought_wallet_tx (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 kind text not null check (kind in ('topup','withdraw','win','refund','reversal')),
 amount_minor bigint not null,
 label text not null,
 balance_after bigint not null,
 at timestamptz not null default clock_timestamp()
);
create index bought_wallet_tx_user on public.bought_wallet_tx(user_id, id desc);

create table public.bought_topups (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 credit_minor bigint not null check (credit_minor >= 5000 and credit_minor % 100 = 0),
 charge_minor bigint not null check (charge_minor > 0),
 charge_currency text not null check (charge_currency in ('USD','INR')),
 provider text not null check (provider in ('stripe','razorpay')),
 method text not null check (method in ('upi','card')),
 checkout_state text not null default 'new' check (checkout_state in ('new','creating','ready')),
 checkout_claimed_at timestamptz,
 payment_reference text,
 payment_id text,
 checkout_url text,
 state text not null default 'created' check (state in ('created','paid','refunded','disputed')),
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 unique (provider, payment_reference),
 unique (provider, payment_id)
);

create table public.bought_withdrawals (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 amount_minor bigint not null check (amount_minor > 0),
 state text not null default 'requested' check (state in ('requested','paid')),
 requested_at timestamptz not null default clock_timestamp(),
 paid_at timestamptz
);

create table public.bought_ad_webhook_events (
 provider text not null,
 event_id text not null,
 received_at timestamptz not null default now(),
 primary key (provider, event_id)
);

create table public.bought_ad_results (
 id bigint generated always as identity primary key,
 issue date not null,
 spot text not null,
 rank integer not null default 1,
 user_id uuid not null references auth.users(id),
 bid_id uuid not null references public.bought_ad_bids(id),
 ad_id uuid not null references public.bought_ads(id),
 final_minor bigint not null,
 price_minor bigint not null,
 tax_minor bigint not null,
 total_minor bigint not null,
 invoice text not null unique,
 status text not null check (status in ('won','forfeited','live')),
 views bigint not null default 0,
 plays bigint not null default 0,
 clicks bigint not null default 0,
 settled_at timestamptz not null default clock_timestamp()
);
create index bought_ad_results_issue on public.bought_ad_results(issue, status);
create index bought_ad_results_user on public.bought_ad_results(user_id, issue desc);

create table public.bought_ad_notices (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 kind text not null,
 msg text not null,
 issue date,
 spot text,
 at timestamptz not null default clock_timestamp()
);
create index bought_ad_notices_user on public.bought_ad_notices(user_id, id desc);

alter table public.bought_accounts enable row level security;
alter table public.bought_ad_spots enable row level security;
alter table public.bought_ads enable row level security;
alter table public.bought_ad_upload_usage enable row level security;
alter table public.bought_issue_spots enable row level security;
alter table public.bought_ad_bids enable row level security;
alter table public.bought_ad_log enable row level security;
alter table public.bought_wallet_tx enable row level security;
alter table public.bought_topups enable row level security;
alter table public.bought_withdrawals enable row level security;
alter table public.bought_ad_webhook_events enable row level security;
alter table public.bought_ad_results enable row level security;
alter table public.bought_ad_notices enable row level security;
revoke all on public.bought_accounts, public.bought_ad_spots, public.bought_ads, public.bought_ad_upload_usage,
 public.bought_issue_spots, public.bought_ad_bids, public.bought_ad_log, public.bought_wallet_tx, public.bought_topups,
 public.bought_withdrawals, public.bought_ad_webhook_events, public.bought_ad_results, public.bought_ad_notices
 from public, anon, authenticated;
grant all on public.bought_accounts, public.bought_ad_spots, public.bought_ads, public.bought_ad_upload_usage,
 public.bought_issue_spots, public.bought_ad_bids, public.bought_ad_log, public.bought_wallet_tx, public.bought_topups,
 public.bought_withdrawals, public.bought_ad_webhook_events, public.bought_ad_results, public.bought_ad_notices
 to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ad-images','ad-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ---------- times and prices ----------
create function public.bought_ad_times(p_issue date, out opens_at timestamptz, out closes_at timestamptz, out hard_stop timestamptz, out final_check timestamptz)
language sql immutable set search_path = '' as $$
 select
  (((p_issue - 7)::timestamp + interval '7 hours' - interval '5 hours 30 minutes') at time zone 'UTC'),
  (((p_issue - 1)::timestamp + interval '22 hours' - interval '5 hours 30 minutes') at time zone 'UTC'),
  (((p_issue - 1)::timestamp + interval '22 hours 30 minutes' - interval '5 hours 30 minutes') at time zone 'UTC'),
  ((p_issue::timestamp + interval '5 hours' - interval '5 hours 30 minutes') at time zone 'UTC')
$$;

-- reserve = base x weekday multiplier, classifieds at least $5, display rounded to $10
create function public.bought_ad_reserve(p_spot text, p_issue date) returns bigint
language sql stable set search_path = '' as $$
 select (case when s.fmt = 'classified'
    then greatest(5, round(s.reserve_usd * m.mult))
    else round(s.reserve_usd * m.mult / 10) * 10 end)::bigint * 100
 from public.bought_ad_spots s,
  (select (array[0.9,1,1,1.1,1.1,1.25,0.8]::numeric[])[extract(dow from p_issue)::int + 1] as mult) m
 where s.spot = p_spot
$$;

create function public.bought_ad_rate(p_country text) returns numeric
language sql immutable set search_path = '' as $$ select case when coalesce(p_country,'India') = 'India' then 0.18 else 0 end::numeric $$;

create function public.bought_ad_handle(p_user uuid, p_issue date) returns text
language sql immutable set search_path = '' as $$ select 'Bidder ' || (10 + abs(hashtext(p_user::text || p_issue::text)) % 80)::text $$;

create function public.bought_ad_money(p_minor bigint) returns text
language sql immutable set search_path = '' as $$ select '$' || trim(to_char(p_minor / 100, 'FM999,999,999')) $$;

create function public.bought_ad_day(p_issue date) returns text
language sql immutable set search_path = '' as $$ select trim(to_char(p_issue, 'Dy')) || ' ' || extract(day from p_issue)::int || ' ' || trim(to_char(p_issue, 'Mon')) $$;

create function public.bought_ad_time(p_at timestamptz) returns text
language sql immutable set search_path = '' as $$ select to_char(((p_at at time zone 'UTC') + interval '5 hours 30 minutes'), 'HH24:MI') $$;

-- what a user's live bids set aside: maximum plus tax on every bid still in the running
create function public.bought_ad_held(p_user uuid, p_rate numeric) returns bigint
language sql stable set search_path = '' as $$
 select coalesce(sum(round(b.max_minor * (1 + p_rate))), 0)::bigint
 from public.bought_ad_bids b where b.user_id = p_user and b.status in ('leading','in')
$$;

create function public.bought_ad_ensure(p_issue date) returns void
language plpgsql set search_path = '' as $$
begin
 if (select count(*) from public.bought_issue_spots where issue = p_issue) < 7 then
  insert into public.bought_issue_spots(issue, spot, closes_at)
  select p_issue, s.spot, (select t.closes_at from public.bought_ad_times(p_issue) t) from public.bought_ad_spots s
  on conflict do nothing;
 end if;
end $$;

create function public.bought_ad_notify(p_user uuid, p_kind text, p_msg text, p_issue date, p_spot text) returns void
language sql set search_path = '' as $$
 insert into public.bought_ad_notices(user_id, kind, msg, issue, spot) values (p_user, p_kind, p_msg, p_issue, p_spot)
$$;

create function public.bought_ad_spot_name(p_spot text) returns text
language sql immutable set search_path = '' as $$
 select case p_spot when 'top' then 'Top banner' when 'front' then 'Front-page native' when 'feed-a' then 'In-feed, AI'
  when 'half' then 'Half page' when 'feed-e' then 'In-feed, Launches' when 'clip' then 'Clip break' else 'Classifieds' end
$$;

-- a bid in a spot's last 5 minutes pushes that spot's close out 5 minutes, up to 22:30 IST
create function public.bought_ad_extend(p_issue date, p_spot text, p_by uuid) returns void
language plpgsql set search_path = '' as $$
declare
 t timestamptz := clock_timestamp();
 s public.bought_issue_spots;
 hard timestamptz;
 nc timestamptz;
 u uuid;
begin
 select * into s from public.bought_issue_spots where issue = p_issue and spot = p_spot;
 select hard_stop into hard from public.bought_ad_times(p_issue);
 if t < s.closes_at and s.closes_at - t < interval '5 minutes' then
  nc := least(t + interval '5 minutes', hard);
  if nc > s.closes_at then
   update public.bought_issue_spots set closes_at = nc, ext = ext + 1 where issue = p_issue and spot = p_spot;
   insert into public.bought_ad_log(issue, spot, kind, until_at) values (p_issue, p_spot, 'ext', nc);
   for u in select user_id from public.bought_ad_bids where issue = p_issue and spot = p_spot and user_id <> p_by loop
    perform public.bought_ad_notify(u, 'ext', format('A late bid extended %s for %s to %s IST.',
     public.bought_ad_spot_name(p_spot), public.bought_ad_day(p_issue), public.bought_ad_time(nc)), p_issue, p_spot);
   end loop;
  end if;
 end if;
end $$;

-- ---------- place a bid: every rule on the Advertise page is enforced here ----------
create function public.bought_ad_bid(p_user uuid, p_issue date, p_spot text, p_mode text, p_max_minor bigint, p_ad_id uuid default null)
returns jsonb language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare
 t timestamptz := clock_timestamp();
 tt record;
 sp public.bought_ad_spots;
 s public.bought_issue_spots;
 acct public.bought_accounts;
 prev public.bought_ad_bids;
 leader public.bought_ad_bids;
 ad public.bought_ads;
 rate numeric;
 inc bigint;
 reserve bigint;
 min_bid bigint;
 cut bigint;
 new_max bigint;
 need bigint;
 avail bigint;
 price bigint;
 new_high bigint;
 bid_id uuid;
 in_top boolean;
 rec record;
 pos int;
begin
 select * into sp from public.bought_ad_spots where spot = p_spot;
 if not found then return jsonb_build_object('ok',false,'err','That spot does not exist.'); end if;
 if p_mode not in ('auto','exact') or p_max_minor is null or p_max_minor <= 0 or p_max_minor % 100 <> 0 or p_max_minor > 100000000 then
  return jsonb_build_object('ok',false,'err','Bids are whole dollars.');
 end if;
 select * into tt from public.bought_ad_times(p_issue);
 if t < tt.opens_at then return jsonb_build_object('ok',false,'err','Bidding for this issue has not opened yet.'); end if;
 if t >= tt.hard_stop then return jsonb_build_object('ok',false,'err','Bidding for this issue has closed.'); end if;

 -- One auction at a time per spot. Unrelated spots never wait on each other.
 perform public.bought_ad_ensure(p_issue);
 perform pg_advisory_xact_lock(hashtext('bought-spot:' || p_issue::text || ':' || p_spot));
 select * into s from public.bought_issue_spots where issue = p_issue and spot = p_spot for update;
 if t >= s.closes_at or s.settled_at is not null then return jsonb_build_object('ok',false,'err','Bidding for this issue has closed.'); end if;

 select * into acct from public.bought_accounts where user_id = p_user for update;
 if not found then return jsonb_build_object('ok',false,'err','Add your business details first.'); end if;
 select * into prev from public.bought_ad_bids where issue = p_issue and spot = p_spot and user_id = p_user for update;

 if p_ad_id is not null then
  select * into ad from public.bought_ads where id = p_ad_id and user_id = p_user and spot = p_spot;
  if not found then return jsonb_build_object('ok',false,'err','Add your ad first.'); end if;
 elsif prev.id is null then
  return jsonb_build_object('ok',false,'err','Add your ad first.');
 end if;

 rate := public.bought_ad_rate(acct.country);
 inc := sp.inc_usd * 100;
 reserve := public.bought_ad_reserve(p_spot, p_issue);
 p_mode := case when sp.fmt = 'classified' then 'exact' else p_mode end;

 -- credits first: the new maximum plus tax must fit in what's free (this bid's own set-aside counts)
 new_max := case when sp.fmt <> 'classified' and prev.status = 'leading' and p_mode = 'exact' then greatest(prev.max_minor, p_max_minor) else p_max_minor end;
 need := round(new_max * (1 + rate))::bigint - case when prev.status in ('leading','in') then round(prev.max_minor * (1 + rate))::bigint else 0 end;
 avail := acct.balance_minor - public.bought_ad_held(p_user, rate);
 if need > avail then
  return jsonb_build_object('ok',false,'credits',true,'short',need - avail,
   'err',format('You need $%s more credits for %s. Add credits and try again.', to_char((need - avail) / 100.0, 'FM999,999,990.00'), public.bought_ad_day(p_issue)));
 end if;

 if sp.fmt = 'classified' then
  select amount_minor into cut from public.bought_ad_bids
   where issue = p_issue and spot = p_spot order by amount_minor desc, placed_at asc offset sp.seats - 1 limit 1;
  min_bid := greatest(reserve, coalesce(cut + 100, 0));
  in_top := prev.status = 'in';
  if prev.id is not null and p_max_minor <= prev.amount_minor then
   return jsonb_build_object('ok',false,'err',format('Your new bid must be above your current %s.', public.bought_ad_money(prev.amount_minor)));
  end if;
  if not coalesce(in_top,false) and p_max_minor < min_bid then
   return jsonb_build_object('ok',false,'err',format('The minimum to get into the top %s is %s.', sp.seats, public.bought_ad_money(min_bid)));
  end if;
  insert into public.bought_ad_bids as b (issue, spot, user_id, ad_id, mode, amount_minor, max_minor, status)
  values (p_issue, p_spot, p_user, coalesce(p_ad_id, prev.ad_id), 'exact', p_max_minor, p_max_minor, 'in')
  on conflict (issue, spot, user_id) do update set amount_minor = excluded.amount_minor, max_minor = excluded.max_minor,
   ad_id = excluded.ad_id, placed_at = clock_timestamp(), updated_at = clock_timestamp();
  update public.bought_issue_spots set bid_count = bid_count + 1 where issue = p_issue and spot = p_spot;
  insert into public.bought_ad_log(issue, spot, kind, user_id, amount_minor) values (p_issue, p_spot, 'bid', p_user, p_max_minor);
  pos := 0;
  for rec in select id, user_id, status from public.bought_ad_bids where issue = p_issue and spot = p_spot
   order by amount_minor desc, placed_at asc loop
   pos := pos + 1;
   if pos <= sp.seats then
    update public.bought_ad_bids set status = 'in', updated_at = clock_timestamp() where id = rec.id and status <> 'in';
   else
    update public.bought_ad_bids set status = 'out', updated_at = clock_timestamp() where id = rec.id and status <> 'out';
    if rec.status = 'in' and rec.user_id <> p_user then
     perform public.bought_ad_notify(rec.user_id, 'outbid', format('Your classified for %s dropped below line %s. Raise it to get back in.',
      public.bought_ad_day(p_issue), sp.seats), p_issue, p_spot);
    end if;
   end if;
  end loop;
  update public.bought_issue_spots set high_minor = coalesce((select amount_minor from public.bought_ad_bids
   where issue = p_issue and spot = p_spot order by amount_minor desc, placed_at asc offset sp.seats - 1 limit 1), 0)
   where issue = p_issue and spot = p_spot;
  perform public.bought_ad_extend(p_issue, p_spot, p_user);
  return jsonb_build_object('ok',true);
 end if;

 -- display: already leading, so this only raises your maximum or your own bid
 if prev.status = 'leading' then
  if p_mode = 'auto' then
   if p_max_minor < prev.max_minor + inc then
    return jsonb_build_object('ok',false,'err',format('A new maximum must be at least %s.', public.bought_ad_money(prev.max_minor + inc)));
   end if;
   update public.bought_ad_bids set max_minor = p_max_minor, mode = 'auto', ad_id = coalesce(p_ad_id, ad_id), updated_at = clock_timestamp() where id = prev.id;
  else
   if p_max_minor < s.high_minor + inc then
    return jsonb_build_object('ok',false,'err',format('An exact bid must be at least %s.', public.bought_ad_money(s.high_minor + inc)));
   end if;
   update public.bought_ad_bids set amount_minor = p_max_minor, max_minor = greatest(max_minor, p_max_minor), mode = 'exact',
    ad_id = coalesce(p_ad_id, ad_id), updated_at = clock_timestamp() where id = prev.id;
   update public.bought_issue_spots set high_minor = p_max_minor, bid_count = bid_count + 1 where issue = p_issue and spot = p_spot;
   insert into public.bought_ad_log(issue, spot, kind, user_id, amount_minor) values (p_issue, p_spot, 'bid', p_user, p_max_minor);
  end if;
  perform public.bought_ad_extend(p_issue, p_spot, p_user);
  return jsonb_build_object('ok',true);
 end if;

 min_bid := case when s.bid_count > 0 and s.high_minor > 0 then s.high_minor + inc else reserve end;
 if p_max_minor < min_bid then
  return jsonb_build_object('ok',false,'err',format('The minimum bid is %s.', public.bought_ad_money(min_bid)));
 end if;

 select * into leader from public.bought_ad_bids where id = s.leader_bid for update;

 -- the leader's hidden maximum answers first. Equal maximums go to the earlier bid.
 if leader.id is not null and leader.max_minor >= p_max_minor then
  new_high := least(p_max_minor + inc, leader.max_minor);
  insert into public.bought_ad_bids as b (issue, spot, user_id, ad_id, mode, amount_minor, max_minor, status)
  values (p_issue, p_spot, p_user, coalesce(p_ad_id, prev.ad_id), p_mode, p_max_minor, p_max_minor, 'outbid')
  on conflict (issue, spot, user_id) do update set amount_minor = excluded.amount_minor, max_minor = excluded.max_minor, mode = excluded.mode,
   ad_id = excluded.ad_id, status = 'outbid', updated_at = clock_timestamp();
  update public.bought_ad_bids set amount_minor = new_high, updated_at = clock_timestamp() where id = leader.id;
  update public.bought_issue_spots set high_minor = new_high, bid_count = bid_count + 2 where issue = p_issue and spot = p_spot;
  insert into public.bought_ad_log(issue, spot, kind, user_id, amount_minor) values
   (p_issue, p_spot, 'bid', p_user, p_max_minor), (p_issue, p_spot, 'auto', leader.user_id, new_high);
  perform public.bought_ad_notify(leader.user_id, 'auto', format('Someone bid %s on %s for %s. Auto-raise kept you in the lead at %s.',
   public.bought_ad_money(p_max_minor), public.bought_ad_spot_name(p_spot), public.bought_ad_day(p_issue), public.bought_ad_money(new_high)), p_issue, p_spot);
  perform public.bought_ad_notify(p_user, 'outbid', format('You were outbid on %s for %s. The minimum is now %s.',
   public.bought_ad_spot_name(p_spot), public.bought_ad_day(p_issue), public.bought_ad_money(new_high + inc)), p_issue, p_spot);
  perform public.bought_ad_extend(p_issue, p_spot, p_user);
  return jsonb_build_object('ok',true,'outbid',true);
 end if;

 price := case when p_mode = 'auto' then least(greatest(min_bid, coalesce(leader.max_minor + inc, min_bid)), p_max_minor) else p_max_minor end;
 insert into public.bought_ad_bids as b (issue, spot, user_id, ad_id, mode, amount_minor, max_minor, status)
 values (p_issue, p_spot, p_user, coalesce(p_ad_id, prev.ad_id), p_mode, price, p_max_minor, 'leading')
 on conflict (issue, spot, user_id) do update set amount_minor = excluded.amount_minor, max_minor = excluded.max_minor, mode = excluded.mode,
  ad_id = excluded.ad_id, status = 'leading', updated_at = clock_timestamp()
 returning b.id into bid_id;
 update public.bought_issue_spots set high_minor = price, bid_count = bid_count + 1, leader_bid = bid_id where issue = p_issue and spot = p_spot;
 insert into public.bought_ad_log(issue, spot, kind, user_id, amount_minor) values (p_issue, p_spot, 'bid', p_user, price);
 if leader.id is not null then
  update public.bought_ad_bids set status = 'outbid', updated_at = clock_timestamp() where id = leader.id;
  perform public.bought_ad_notify(leader.user_id, 'outbid', format('You were outbid on %s for %s. The minimum is now %s.',
   public.bought_ad_spot_name(p_spot), public.bought_ad_day(p_issue), public.bought_ad_money(price + inc)), p_issue, p_spot);
 end if;
 perform public.bought_ad_extend(p_issue, p_spot, p_user);
 return jsonb_build_object('ok',true);
end $$;

-- ---------- close and settle: winners' credits are deducted, every other bid is released ----------
create function public.bought_ad_charge(p_issue date, p_spot text, p_bid public.bought_ad_bids, p_final bigint, p_rank int) returns boolean
language plpgsql set search_path = '' as $$
declare
 acct public.bought_accounts;
 rate numeric;
 tax bigint;
 total bigint;
 seq int;
 inv text;
begin
 select * into acct from public.bought_accounts where user_id = p_bid.user_id for update;
 rate := public.bought_ad_rate(acct.country);
 tax := round(p_bid.amount_minor * rate)::bigint;
 total := p_bid.amount_minor + tax;
 if acct.balance_minor < total then return false; end if;
 select count(*) + 1 into seq from public.bought_ad_results where issue = p_issue;
 inv := format('BGT-%s-%s', 287 + (p_issue - date '2026-10-25'), lpad(seq::text, 4, '0'));
 update public.bought_accounts set balance_minor = balance_minor - total where user_id = p_bid.user_id;
 insert into public.bought_wallet_tx(user_id, kind, amount_minor, label, balance_after)
 values (p_bid.user_id, 'win', -total, format('Won %s · %s · %s', public.bought_ad_spot_name(p_spot), public.bought_ad_day(p_issue), inv), acct.balance_minor - total);
 insert into public.bought_ad_results(issue, spot, rank, user_id, bid_id, ad_id, final_minor, price_minor, tax_minor, total_minor, invoice, status)
 values (p_issue, p_spot, p_rank, p_bid.user_id, p_bid.id, p_bid.ad_id, p_final, p_bid.amount_minor, tax, total, inv, 'won');
 update public.bought_ad_bids set status = 'won', updated_at = clock_timestamp() where id = p_bid.id;
 return true;
end $$;

create function public.bought_ad_settle(p_issue date) returns integer
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare
 t timestamptz := clock_timestamp();
 sp record;
 b public.bought_ad_bids;
 seat int;
 won int := 0;
 final bigint;
 ok boolean;
 summary record;
begin
 perform pg_advisory_xact_lock(hashtext('bought-issue:' || p_issue::text));
 if not exists (select 1 from public.bought_issue_spots where issue = p_issue) then return 0; end if;
 if exists (select 1 from public.bought_issue_spots where issue = p_issue and closes_at > t) then return 0; end if;
 if not exists (select 1 from public.bought_issue_spots where issue = p_issue and settled_at is null) then return 0; end if;
 for sp in select i.spot, i.high_minor, s.seats from public.bought_issue_spots i join public.bought_ad_spots s on s.spot = i.spot
   where i.issue = p_issue and i.settled_at is null order by i.spot for update of i loop
  seat := 0;
  for b in select * from public.bought_ad_bids where issue = p_issue and spot = sp.spot and status in ('leading','in')
    order by amount_minor desc, placed_at asc loop
   seat := seat + 1;
   final := case when sp.seats > 1 then sp.high_minor else b.amount_minor end;
   ok := public.bought_ad_charge(p_issue, sp.spot, b, final, seat);
   if ok then won := won + 1; else
    update public.bought_ad_bids set status = 'lost', updated_at = clock_timestamp() where id = b.id;
    perform public.bought_ad_notify(b.user_id, 'close', format('Your credits could not cover %s for %s, so the spot was released.',
     public.bought_ad_spot_name(sp.spot), public.bought_ad_day(p_issue)), p_issue, sp.spot);
   end if;
  end loop;
  update public.bought_ad_bids set status = 'lost', updated_at = clock_timestamp() where issue = p_issue and spot = sp.spot and status in ('outbid','out');
  update public.bought_issue_spots set settled_at = t where issue = p_issue and spot = sp.spot;
 end loop;
 for summary in select b2.user_id, count(*) filter (where b2.status = 'won') as w, count(*) as n,
   coalesce((select sum(r.total_minor) from public.bought_ad_results r where r.issue = p_issue and r.user_id = b2.user_id), 0) as charged
   from public.bought_ad_bids b2 where b2.issue = p_issue group by b2.user_id loop
  perform public.bought_ad_notify(summary.user_id, 'close', case when summary.w > 0
   then format('Bidding closed for %s. You won %s of %s. $%s deducted from your credits; everything else set aside is free again.',
     public.bought_ad_day(p_issue), summary.w, summary.n, to_char(summary.charged / 100.0, 'FM999,999,990.00'))
   else format('Bidding closed for %s. You didn''t win this time, so no credits were used. They''re free to bid again.', public.bought_ad_day(p_issue)) end,
   p_issue, null);
 end loop;
 return won;
end $$;

-- ---------- 05:00 IST on issue day: an ad that still isn't approved gives its spot to the next bidder ----------
create function public.bought_ad_finalize(p_issue date) returns integer
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare
 t timestamptz := clock_timestamp();
 r public.bought_ad_results;
 acct public.bought_accounts;
 next_bid public.bought_ad_bids;
 swapped int := 0;
begin
 perform pg_advisory_xact_lock(hashtext('bought-issue:' || p_issue::text));
 if t < (select final_check from public.bought_ad_times(p_issue)) then return 0; end if;
 if exists (select 1 from public.bought_issue_spots where issue = p_issue and settled_at is null) then return 0; end if;
 if not exists (select 1 from public.bought_issue_spots where issue = p_issue and finalized_at is null) then return 0; end if;
 for r in select res.* from public.bought_ad_results res join public.bought_ads a on a.id = res.ad_id
   where res.issue = p_issue and res.status = 'won' and a.state <> 'approved' order by res.spot, res.rank for update of res loop
  update public.bought_ad_results set status = 'forfeited' where id = r.id;
  update public.bought_ad_bids set status = 'lost', updated_at = clock_timestamp() where id = r.bid_id;
  update public.bought_accounts set balance_minor = balance_minor + r.total_minor where user_id = r.user_id returning * into acct;
  insert into public.bought_wallet_tx(user_id, kind, amount_minor, label, balance_after)
  values (r.user_id, 'refund', r.total_minor, format('Ad not approved in time · %s · %s', public.bought_ad_spot_name(r.spot), public.bought_ad_day(p_issue)), acct.balance_minor);
  perform public.bought_ad_notify(r.user_id, 'close', format('Your ad for %s, %s wasn''t approved by 05:00 IST. The next bidder''s ad runs and your credits are free again.',
   public.bought_ad_spot_name(r.spot), public.bought_ad_day(p_issue)), p_issue, r.spot);
  for next_bid in select b.* from public.bought_ad_bids b join public.bought_ads a on a.id = b.ad_id
    where b.issue = p_issue and b.spot = r.spot and b.status = 'lost' and a.state = 'approved'
     and not exists (select 1 from public.bought_ad_results x where x.bid_id = b.id)
    order by b.amount_minor desc, b.placed_at asc loop
   if public.bought_ad_charge(p_issue, r.spot, next_bid, next_bid.amount_minor, r.rank) then
    swapped := swapped + 1;
    perform public.bought_ad_notify(next_bid.user_id, 'close', format('A spot opened up: your ad runs in %s for %s at %s.',
     public.bought_ad_spot_name(r.spot), public.bought_ad_day(p_issue), public.bought_ad_money(next_bid.amount_minor)), p_issue, r.spot);
    exit;
   end if;
  end loop;
 end loop;
 update public.bought_issue_spots set finalized_at = t where issue = p_issue;
 return swapped;
end $$;

-- runs from the server's clock and from any market read; a late run cannot change a result
create function public.bought_ad_tick() returns jsonb
language plpgsql set search_path = '' as $$
declare
 d date;
 settled int := 0;
 swapped int := 0;
begin
 for d in select distinct issue from public.bought_issue_spots where settled_at is null and closes_at <= clock_timestamp() order by issue loop
  settled := settled + public.bought_ad_settle(d);
 end loop;
 for d in select distinct issue from public.bought_issue_spots where settled_at is not null and finalized_at is null order by issue loop
  swapped := swapped + public.bought_ad_finalize(d);
 end loop;
 return jsonb_build_object('settled',settled,'swapped',swapped);
end $$;

-- the publish clock calls this when the issue actually goes live
create function public.bought_ad_mark_live(p_issue date) returns integer
language plpgsql set search_path = '' as $$
declare n integer; r record;
begin
 perform public.bought_ad_finalize(p_issue);
 update public.bought_ad_results res set status = 'live' from public.bought_ads a
  where a.id = res.ad_id and res.issue = p_issue and res.status = 'won' and a.state = 'approved';
 get diagnostics n = row_count;
 for r in select user_id from public.bought_ad_results where issue = p_issue and status = 'live' loop
  perform public.bought_ad_notify(r.user_id, 'live', format('The %s issue is live. Your delivery report is building.', public.bought_ad_day(p_issue)), p_issue, null);
 end loop;
 return n;
end $$;

-- ---------- media: Bought's claim and event functions, now on ads ----------
create function public.bought_ad_claim_upload(p_ad_id uuid, p_replace boolean default false)
returns boolean language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare
 d public.bought_ads;
 upload_day date;
 daily_count smallint;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found then raise exception 'BOUGHT: Ad not found.'; end if;
 if d.state not in ('draft','rejected','processing') then raise exception 'BOUGHT: This ad has already been submitted.'; end if;
 if not p_replace and d.mux_upload_url is not null and d.mux_upload_expires_at > clock_timestamp() + interval '5 minutes' and d.media_state = 'waiting' then
  return false;
 end if;
 if d.upload_claimed_at > clock_timestamp() - interval '2 minutes' then raise exception 'BOUGHT: An upload is being prepared. Try again shortly.'; end if;
 if d.upload_attempts >= 20 then raise exception 'BOUGHT: This ad has used its upload retry limit. Contact support with its ID.'; end if;
 upload_day := (clock_timestamp() at time zone 'UTC')::date;
 insert into public.bought_ad_upload_usage(user_id, upload_date, upload_count) values (d.user_id, upload_day, 1)
 on conflict (user_id) do update set upload_date = excluded.upload_date,
  upload_count = case when public.bought_ad_upload_usage.upload_date = excluded.upload_date then public.bought_ad_upload_usage.upload_count + 1 else 1 end
  where public.bought_ad_upload_usage.upload_date <> excluded.upload_date or public.bought_ad_upload_usage.upload_count < 10
 returning upload_count into daily_count;
 if not found then raise exception 'BOUGHT: You have used your 10 video uploads for today. Try again after 00:00 UTC.'; end if;
 update public.bought_ads set upload_attempts = upload_attempts + 1, upload_claimed_at = clock_timestamp(), upload_quota_date = upload_day,
  mux_upload_id = null, mux_upload_url = null, mux_asset_id = null, mux_playback_id = null, media_state = 'none', state = 'draft',
  submitted_at = null, review_reason = null, reviewed_at = null where id = d.id;
 return true;
end $$;

create function public.bought_ad_release_upload_quota(p_ad_id uuid) returns void
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_ads;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found or d.upload_quota_date is null or d.mux_upload_id is not null then return; end if;
 update public.bought_ad_upload_usage set upload_count = greatest(upload_count - 1, 0) where user_id = d.user_id and upload_date = d.upload_quota_date;
 update public.bought_ads set upload_claimed_at = null, upload_quota_date = null where id = d.id;
end $$;

create function public.bought_ad_claim_thumbnail(p_ad_id uuid, p_path text) returns text
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_ads;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found then raise exception 'BOUGHT: Ad not found.'; end if;
 if d.state not in ('draft','rejected','processing') then raise exception 'BOUGHT: This ad has already been submitted.'; end if;
 if d.thumbnail_attempts >= 30 then raise exception 'BOUGHT: This ad has used its image retry limit. Contact support with its ID.'; end if;
 if p_path is distinct from d.user_id::text || '/' || d.id::text || '/image-staging' then raise exception 'BOUGHT: Invalid image path.'; end if;
 update public.bought_ads set thumbnail_attempts = thumbnail_attempts + 1, thumbnail_path = p_path, thumbnail_verified = false where id = d.id;
 return d.thumbnail_path;
end $$;

create function public.bought_ad_media_event(p_event_id text, p_upload_id text, p_asset_id text, p_playback_id text, p_ready boolean, p_valid boolean, p_reason text)
returns void language plpgsql set search_path = '' as $$
declare d public.bought_ads;
begin
 if exists (select 1 from public.bought_ad_webhook_events where provider = 'mux' and event_id = p_event_id) then return; end if;
 select * into d from public.bought_ads where mux_upload_id = p_upload_id for update;
 -- Old attempts are deliberately ignored; they cannot overwrite a retake.
 if not found then return; end if;
 insert into public.bought_ad_webhook_events(provider, event_id) values ('mux', p_event_id) on conflict do nothing;
 if not found then return; end if;
 if d.state in ('approved','review','rejected') or d.media_state in ('ready','errored') then return; end if;
 update public.bought_ads set mux_asset_id = p_asset_id, mux_playback_id = p_playback_id,
  media_state = case when p_ready and p_valid then 'ready' when p_ready then 'errored' else 'processing' end,
  state = case when p_ready and not p_valid then 'rejected' when p_ready and submitted_at is not null then 'review' else state end,
  review_reason = p_reason where id = d.id;
 if p_ready and not p_valid then
  perform public.bought_ad_notify(d.user_id, 'review', coalesce(p_reason, 'Your video could not be processed. Upload a new one.'), null, d.spot);
 end if;
end $$;

create function public.bought_ad_submit(p_ad_id uuid) returns void
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_ads;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found then raise exception 'BOUGHT: Ad not found.'; end if;
 if d.state in ('processing','review','approved') then return; end if;
 if d.kind = 'video' and d.media_state not in ('waiting','processing','ready') then raise exception 'BOUGHT: Finish uploading your video before submitting.'; end if;
 if d.kind = 'image' and not d.thumbnail_verified then raise exception 'BOUGHT: Finish uploading your image before submitting.'; end if;
 update public.bought_ads set submitted_at = clock_timestamp(), review_reason = null,
  state = case when d.kind = 'video' and d.media_state <> 'ready' then 'processing' else 'review' end where id = d.id;
end $$;

-- A person decides. Video needs a finished transcript, the same gate Bought's moderator queue has.
create function public.bought_ad_review(p_ad_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_ads;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found then raise exception 'BOUGHT: Ad not found.'; end if;
 if d.state <> 'review' then raise exception 'BOUGHT: This ad is not waiting for review.'; end if;
 if p_approve and d.kind = 'video' and (d.media_state <> 'ready' or d.transcription_status <> 'ready' or d.transcription_asset_id is distinct from d.mux_asset_id) then
  raise exception 'BOUGHT: Wait for the transcript and read it before approving.';
 end if;
 update public.bought_ads set state = case when p_approve then 'approved' else 'rejected' end, reviewed_at = clock_timestamp(),
  review_reason = case when p_approve then null else coalesce(nullif(trim(p_reason),''),'This ad needs changes.') end where id = d.id;
 perform public.bought_ad_notify(d.user_id, 'review', case when p_approve then format('Your ad for %s passed review.', public.bought_ad_spot_name(d.spot))
  else format('Your ad for %s needs changes: %s', public.bought_ad_spot_name(d.spot), coalesce(nullif(trim(p_reason),''),'see the review note.')) end, null, d.spot);
end $$;

create function public.bought_ad_claim_transcription(p_ad_id uuid, p_asset_id text) returns boolean
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_ads; new_asset boolean;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found then raise exception 'BOUGHT: Ad not found.'; end if;
 if d.mux_asset_id is distinct from p_asset_id or d.media_state <> 'ready' then raise exception 'BOUGHT: This media version is not ready for transcription.'; end if;
 if d.transcription_status = 'ready' and d.transcription_asset_id = p_asset_id then return false; end if;
 if d.transcription_status = 'processing' and d.transcription_asset_id = p_asset_id and d.transcription_claimed_at > clock_timestamp() - interval '5 minutes' then return false; end if;
 new_asset := d.transcription_asset_id is distinct from p_asset_id;
 if not new_asset and d.transcription_attempts >= 10 then raise exception 'BOUGHT: English transcription has reached its retry limit.'; end if;
 update public.bought_ads set transcription_status = 'processing', transcription_asset_id = p_asset_id,
  transcript_english = case when new_asset then null else transcript_english end,
  captions_vtt = case when new_asset then null else captions_vtt end,
  transcription_error = null, transcription_claimed_at = clock_timestamp(),
  transcribed_at = case when new_asset then null else transcribed_at end,
  transcription_attempts = case when new_asset then 1 else transcription_attempts + 1 end
 where id = p_ad_id;
 return true;
end $$;

create function public.bought_ad_finish_transcription(p_ad_id uuid, p_asset_id text, p_transcript text, p_captions text) returns void
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_ads;
begin
 select * into d from public.bought_ads where id = p_ad_id for update;
 if not found then raise exception 'BOUGHT: Ad not found.'; end if;
 if d.mux_asset_id is distinct from p_asset_id or d.transcription_asset_id is distinct from p_asset_id then raise exception 'BOUGHT: The transcription belongs to an older recording.'; end if;
 if length(trim(coalesce(p_transcript,''))) = 0 or left(coalesce(p_captions,''),6) <> 'WEBVTT' then raise exception 'BOUGHT: The transcription response is incomplete.'; end if;
 update public.bought_ads set transcription_status = 'ready', transcript_english = p_transcript, captions_vtt = p_captions,
  transcription_error = null, transcription_claimed_at = null, transcribed_at = clock_timestamp() where id = p_ad_id;
end $$;

create function public.bought_ad_fail_transcription(p_ad_id uuid, p_asset_id text, p_error text) returns void
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
begin
 update public.bought_ads set transcription_status = 'errored',
  transcription_error = left(coalesce(nullif(trim(p_error),''),'English transcription failed.'),500), transcription_claimed_at = null
 where id = p_ad_id and mux_asset_id = p_asset_id and transcription_asset_id = p_asset_id;
end $$;

-- ---------- credits ----------
create function public.bought_ad_claim_checkout(p_topup_id uuid) returns boolean
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_topups;
begin
 select * into d from public.bought_topups where id = p_topup_id for update;
 if not found then raise exception 'BOUGHT: Top-up not found.'; end if;
 if d.state <> 'created' then raise exception 'BOUGHT: This top-up has already been paid.'; end if;
 if d.checkout_state = 'ready' then return false; end if;
 if d.checkout_state = 'creating' and d.checkout_claimed_at > clock_timestamp() - interval '2 minutes' then return false; end if;
 update public.bought_topups set checkout_state = 'creating', checkout_claimed_at = clock_timestamp() where id = d.id;
 return true;
end $$;

-- Only a signed provider event moves credits. Amount, currency and reference must match the saved top-up.
create function public.bought_ad_payment_event(p_provider text, p_event_id text, p_reference text, p_payment_id text, p_amount bigint, p_currency text, p_state text)
returns void language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare d public.bought_topups; acct public.bought_accounts;
begin
 if exists (select 1 from public.bought_ad_webhook_events where provider = p_provider and event_id = p_event_id) then return; end if;
 select * into d from public.bought_topups where provider = p_provider
  and ((p_reference is not null and payment_reference = p_reference) or (p_payment_id is not null and payment_id = p_payment_id)) for update;
 if not found then raise exception 'BOUGHT: Payment does not match a top-up.'; end if;
 if d.charge_minor <> p_amount or upper(p_currency) <> d.charge_currency then raise exception 'BOUGHT: Payment amount does not match the top-up.'; end if;
 insert into public.bought_ad_webhook_events(provider, event_id) values (p_provider, p_event_id) on conflict do nothing;
 if not found then return; end if;
 select * into acct from public.bought_accounts where user_id = d.user_id for update;
 if p_state = 'paid' then
  if d.state <> 'created' then return; end if; -- a late capture cannot revive a reversed payment
  update public.bought_topups set state = 'paid', paid_at = clock_timestamp(), payment_id = p_payment_id where id = d.id;
  update public.bought_accounts set balance_minor = balance_minor + d.credit_minor where user_id = d.user_id;
  insert into public.bought_wallet_tx(user_id, kind, amount_minor, label, balance_after)
  values (d.user_id, 'topup', d.credit_minor, format('Credits added · %s', case d.method when 'card' then 'Card' else 'UPI' end), acct.balance_minor + d.credit_minor);
  perform public.bought_ad_notify(d.user_id, 'wallet', format('%s in credits added to your wallet.', public.bought_ad_money(d.credit_minor)), null, null);
 elsif p_state in ('refunded','disputed') then
  if d.state = 'paid' then
   update public.bought_accounts set balance_minor = balance_minor - d.credit_minor where user_id = d.user_id;
   insert into public.bought_wallet_tx(user_id, kind, amount_minor, label, balance_after)
   values (d.user_id, 'reversal', -d.credit_minor, case p_state when 'refunded' then 'Top-up refunded' else 'Top-up disputed' end, acct.balance_minor - d.credit_minor);
  end if;
  update public.bought_topups set state = p_state where id = d.id;
 end if;
end $$;

create function public.bought_ad_withdraw(p_user uuid, p_amount bigint) returns bigint
language plpgsql set search_path = '' set lock_timeout = '5s' as $$
declare acct public.bought_accounts; avail bigint; amt bigint;
begin
 select * into acct from public.bought_accounts where user_id = p_user for update;
 if not found then raise exception 'BOUGHT: No wallet yet.'; end if;
 avail := acct.balance_minor - public.bought_ad_held(p_user, public.bought_ad_rate(acct.country));
 amt := least(p_amount, avail);
 if amt <= 0 then return 0; end if;
 update public.bought_accounts set balance_minor = balance_minor - amt where user_id = p_user;
 insert into public.bought_withdrawals(user_id, amount_minor) values (p_user, amt);
 insert into public.bought_wallet_tx(user_id, kind, amount_minor, label, balance_after)
 values (p_user, 'withdraw', -amt, 'Withdrawn to your bank · 3–5 working days', acct.balance_minor - amt);
 return amt;
end $$;

-- ---------- what the Advertise page reads ----------
create function public.bought_ad_ad_json(a public.bought_ads) returns jsonb
language sql stable set search_path = '' as $$
 select a.fields || jsonb_build_object('id',a.id,'kind',a.kind,'state',a.state,'reason',a.review_reason,'mux',case when a.mux_playback_id is not null then a.id end,'image',a.thumbnail_path)
$$;

create function public.bought_ad_market(p_user uuid default null) returns jsonb
language plpgsql set search_path = '' as $$
declare
 t timestamptz := clock_timestamp();
 today_ist date := ((t at time zone 'UTC') + interval '5 hours 30 minutes')::date;
 issues date[];
 d date;
 spots jsonb := '{}'::jsonb;
 cls jsonb := '{}'::jsonb;
 mine jsonb := null;
 feed jsonb;
 acct public.bought_accounts;
begin
 perform public.bought_ad_tick();
 select coalesce(array_agg(x order by x), '{}') into issues from generate_series(today_ist, today_ist + 8, interval '1 day') g(x0), lateral (select x0::date as x) y
  where (select opens_at from public.bought_ad_times(x)) <= t
   and coalesce((select max(closes_at) from public.bought_issue_spots i where i.issue = x), (select closes_at from public.bought_ad_times(x))) > t;
 foreach d in array issues loop perform public.bought_ad_ensure(d); end loop;

 select coalesce(jsonb_object_agg(i.issue::text || '|' || i.spot, jsonb_build_object(
   'high', i.high_minor, 'n', i.bid_count, 'close', i.closes_at, 'ext', i.ext,
   'leader', case when i.leader_bid is null then null when l.user_id = p_user then 'me' else 'rival' end,
   'hist', (select coalesce(jsonb_agg(jsonb_build_object('h', case when g.user_id = p_user then case g.kind when 'auto' then 'You · auto-raise' else 'You' end else public.bought_ad_handle(g.user_id, g.issue) end,
       'amt', g.amount_minor, 't', g.at, 'me', g.user_id = p_user) order by g.id desc), '[]'::jsonb)
     from (select * from public.bought_ad_log lg where lg.issue = i.issue and lg.spot = i.spot and lg.kind <> 'ext' order by lg.id desc limit 12) g)
  )), '{}'::jsonb) into spots
 from public.bought_issue_spots i left join public.bought_ad_bids l on l.id = i.leader_bid
 where i.issue = any(issues) and i.spot <> 'cls';

 select coalesce(jsonb_object_agg(i.issue::text, jsonb_build_object('close', i.closes_at, 'ext', i.ext,
   'list', (select coalesce(jsonb_agg(jsonb_build_object('h', case when b.user_id = p_user then 'You' else public.bought_ad_handle(b.user_id, b.issue) end,
      'amt', b.amount_minor, 't', b.placed_at, 'me', b.user_id = p_user) order by b.amount_minor desc, b.placed_at), '[]'::jsonb)
     from public.bought_ad_bids b where b.issue = i.issue and b.spot = 'cls'))), '{}'::jsonb) into cls
 from public.bought_issue_spots i where i.issue = any(issues) and i.spot = 'cls';

 select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'd', f.issue, 'k', f.spot, 'amt', f.amount_minor, 't', f.at, 'until', f.until_at,
   'me', f.user_id = p_user, 'h', case when f.user_id is not null then public.bought_ad_handle(f.user_id, f.issue) end) order by f.id desc), '[]'::jsonb) into feed
 from (select * from public.bought_ad_log where issue = any(issues) order by id desc limit 40) f;

 if p_user is not null then
  select * into acct from public.bought_accounts where user_id = p_user;
  mine := jsonb_build_object(
   'acct', case when acct.user_id is null then null else jsonb_build_object('name',acct.name,'email',acct.email,'country',acct.country,'gstin',acct.gstin,'method',acct.method) end,
   'balance', coalesce(acct.balance_minor,0),
   'tx', (select coalesce(jsonb_agg(jsonb_build_object('t',x.at,'kind',x.kind,'amt',x.amount_minor,'label',x.label,'bal',x.balance_after) order by x.id desc),'[]'::jsonb)
     from (select * from public.bought_wallet_tx where user_id = p_user order by id desc limit 50) x),
   'my', (select coalesce(jsonb_agg(jsonb_build_object('d',b.issue,'k',b.spot,'amt',b.amount_minor,'max',b.max_minor,'mode',b.mode,'status',b.status,'placed',b.placed_at,
      'review', case a.state when 'approved' then 'approved' else 'pending' end,'adState',a.state,'adReason',a.review_reason,'cre',public.bought_ad_ad_json(a))),'[]'::jsonb)
     from public.bought_ad_bids b join public.bought_ads a on a.id = b.ad_id
     where b.user_id = p_user and b.status in ('leading','outbid','in','out') and b.issue = any(issues)),
   'past', (select coalesce(jsonb_agg(z.j order by z.at desc),'[]'::jsonb) from (
      select r.settled_at as at, jsonb_build_object('d',r.issue,'k',r.spot,'rank',r.rank,'final',r.final_minor,'price',r.price_minor,'amt',r.price_minor,'gst',r.tax_minor,'total',r.total_minor,'inv',r.invoice,
       'status', case r.status when 'forfeited' then 'lost' else r.status end,'settledAt',r.settled_at,'cre',public.bought_ad_ad_json(a),'review', case a.state when 'approved' then 'approved' else 'pending' end,
       'report', case when r.status = 'live' then jsonb_build_object('views',r.views,'plays',r.plays,'clicks',r.clicks,'watch',0) end) as j
      from public.bought_ad_results r join public.bought_ads a on a.id = r.ad_id where r.user_id = p_user
      union all
      select b.updated_at, jsonb_build_object('d',b.issue,'k',b.spot,'amt',b.amount_minor,'price',b.amount_minor,'final',b.amount_minor,'gst',0,'total',0,'inv',null,'status','lost','settledAt',b.updated_at,'cre',public.bought_ad_ad_json(a),'review','approved')
      from public.bought_ad_bids b join public.bought_ads a on a.id = b.ad_id
      where b.user_id = p_user and b.status = 'lost' and not exists (select 1 from public.bought_ad_results r2 where r2.bid_id = b.id)
      order by 1 desc limit 60) z),
   'notices', (select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'msg',n.msg,'d',n.issue,'k',n.spot,'t',n.at) order by n.id desc),'[]'::jsonb)
     from (select * from public.bought_ad_notices where user_id = p_user order by id desc limit 30) n));
 end if;

 return jsonb_build_object('serverNow', t, 'dates', to_jsonb(issues), 'spots', spots, 'cls', cls, 'feed', feed, 'me', mine);
end $$;

-- Winners are public once the issue is live. No user IDs, no maximums.
create function public.bought_ad_winners(p_issue date) returns jsonb
language sql stable set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('spot',r.spot,'rank',r.rank,'amt',r.price_minor,'adv',c.name,'ad',a.id,'kind',a.kind,'fields',a.fields,
   'mux',a.mux_playback_id is not null,'image',a.thumbnail_path,'script',a.transcript_english) order by r.spot, r.rank), '[]'::jsonb)
 from public.bought_ad_results r join public.bought_ads a on a.id = r.ad_id join public.bought_accounts c on c.user_id = r.user_id
 where r.issue = p_issue and r.status = 'live'
$$;

create function public.bought_ad_count(p_issue date, p_spot text, p_kind text) returns void
language plpgsql set search_path = '' as $$
begin
 update public.bought_ad_results set
  views = views + case when p_kind = 'view' then 1 else 0 end,
  plays = plays + case when p_kind = 'play' then 1 else 0 end,
  clicks = clicks + case when p_kind = 'click' then 1 else 0 end
 where issue = p_issue and spot = p_spot and status = 'live';
end $$;

create function public.bought_ad_public_media(p_ad_id uuid) returns boolean
language sql stable set search_path = '' as $$
 select exists (select 1 from public.bought_ad_results where ad_id = p_ad_id and status = 'live')
$$;

do $$
declare f record;
begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'bought\_ad\_%' loop
  execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  execute format('grant execute on function %s to service_role', f.sig);
 end loop;
end $$;
