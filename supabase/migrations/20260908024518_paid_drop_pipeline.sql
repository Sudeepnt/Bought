-- The service role owns mutations. Browsers have read-only RLS access.
create table public.bought_categories (name text primary key);
insert into public.bought_categories values
 ('BEEF'),('CHAOS'),('UNPOPULAR OPINION'),('I WAS WRONG'),('THE RANT'),
 ('CONFESSIONS'),('MONEY I SET ON FIRE'),('THE PITCH THAT GOT REJECTED'),
 ('BUILDING'),('THE ASK'),('HIRING'),('AGENCY ROW'),('INDIAN D2C');

create table public.bought_auctions (
 id date primary key,
 opens_at timestamptz not null,
 closes_at timestamptz not null,
 exposure_ends_at timestamptz not null,
 state text not null default 'bidding' check (state in ('bidding','exposure','closed')),
 check (opens_at < closes_at and closes_at < exposure_ends_at)
);

create table public.bought_drops (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 category text not null references public.bought_categories(name),
 title text not null check (char_length(title) between 3 and 120),
 amount_minor integer not null check (amount_minor between 10000 and 100000000 and amount_minor % 100 = 0),
 currency text not null default 'USD' check (currency = 'USD'),
 provider text not null check (provider in ('stripe','razorpay')),
 payment_state text not null default 'unpaid' check (payment_state in ('unpaid','paid','refunded','disputed')),
 checkout_state text not null default 'new' check (checkout_state in ('new','creating','ready')),
 payment_reference text,
 payment_id text,
 checkout_url text,
 paid_at timestamptz,
 state text not null default 'draft' check (state in ('draft','processing','review','rejected','published')),
 mux_upload_id text unique,
 mux_upload_url text,
 mux_upload_expires_at timestamptz,
 upload_claimed_at timestamptz,
 mux_asset_id text unique,
 mux_playback_id text,
 media_state text not null default 'none' check (media_state in ('none','waiting','processing','ready','errored')),
 thumbnail_path text unique,
 thumbnail_verified boolean not null default false,
 submitted_at timestamptz,
 review_reason text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 auction_id date references public.bought_auctions(id),
 exposure_starts_at timestamptz,
 exposure_ends_at timestamptz,
 created_at timestamptz not null default now(),
 unique(provider, payment_reference),
 unique(provider, payment_id),
 check (state <> 'published' or (payment_state = 'paid' and media_state = 'ready' and thumbnail_verified and submitted_at is not null and reviewed_at is not null))
);
create index bought_drops_owner on public.bought_drops(user_id, created_at desc);
create index bought_review_queue on public.bought_drops(submitted_at) where state = 'review';

create table public.bought_webhook_events (
 provider text not null,
 event_id text not null,
 drop_id uuid references public.bought_drops(id),
 received_at timestamptz not null default now(),
 primary key(provider,event_id)
);

-- Contains public information only. Payment references and user IDs stay private.
create table public.bought_ladder (
 drop_id uuid primary key references public.bought_drops(id),
 auction_id date not null references public.bought_auctions(id),
 position integer not null,
 category text not null,
 title text not null,
 amount_minor integer not null,
 paid_at timestamptz not null,
 published_at timestamptz not null default now(),
 exposure_starts_at timestamptz not null,
 exposure_ends_at timestamptz not null
);
create index bought_ladder_auction_rank on public.bought_ladder(auction_id,position);
create index bought_ladder_exposure on public.bought_ladder(exposure_ends_at);

alter table public.bought_categories enable row level security;
alter table public.bought_auctions enable row level security;
alter table public.bought_drops enable row level security;
alter table public.bought_webhook_events enable row level security;
alter table public.bought_ladder enable row level security;
revoke all on public.bought_categories, public.bought_auctions, public.bought_drops, public.bought_webhook_events, public.bought_ladder from anon, authenticated;
grant select on public.bought_categories, public.bought_auctions, public.bought_ladder to anon, authenticated;
grant select on public.bought_drops to authenticated;
grant all on public.bought_categories, public.bought_auctions, public.bought_drops, public.bought_webhook_events, public.bought_ladder to service_role;
create policy categories_read on public.bought_categories for select to anon, authenticated using (true);
create policy auctions_read on public.bought_auctions for select to anon, authenticated using (true);
create policy own_drops on public.bought_drops for select to authenticated using ((select auth.uid()) = user_id);
create policy ladder_read on public.bought_ladder for select to anon, authenticated using (auction_id = (now() at time zone 'UTC')::date and exposure_ends_at > now());

create function public.bought_advance() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 t timestamptz;
 day date;
 start_at timestamptz;
begin
 perform pg_advisory_xact_lock(73198512);
 t := clock_timestamp();
 day := (t at time zone 'UTC')::date;
 start_at := day::timestamp at time zone 'UTC';
 insert into public.bought_auctions(id,opens_at,closes_at,exposure_ends_at)
 values (day,start_at,start_at+interval '12 hours',start_at+interval '1 day'),
        (day+1,start_at+interval '1 day',start_at+interval '36 hours',start_at+interval '2 days')
 on conflict do nothing;
 update public.bought_auctions set state = case when exposure_ends_at <= t then 'closed' when closes_at <= t then 'exposure' else 'bidding' end
 where state <> 'closed';
 return jsonb_build_object('auctionId',day::text,'serverNow',t,'opensAt',start_at,'closesAt',start_at+interval '12 hours',
   'exposureEndsAt',start_at+interval '1 day','phase',case when t < start_at+interval '12 hours' then 'bidding' else 'exposure' end,'configured',true);
end $$;

create function public.bought_claim_checkout(p_drop_id uuid) returns boolean language plpgsql security invoker set search_path = '' as $$
declare d public.bought_drops; market jsonb;
begin
 market := public.bought_advance();
 if market->>'phase' <> 'bidding' then raise exception 'BOUGHT: Bidding opens at 00:00 UTC. Your draft is saved.'; end if;
 select * into d from public.bought_drops where id=p_drop_id for update;
 if d.payment_state <> 'unpaid' then raise exception 'BOUGHT: This broadcast is already paid.'; end if;
 if d.checkout_state = 'ready' then return false; end if;
 if d.checkout_state = 'creating' then raise exception 'BOUGHT: Checkout is being reconciled. Do not pay again; resume this broadcast shortly or contact support with its ID.'; end if;
 update public.bought_drops set checkout_state='creating' where id=p_drop_id;
 return true;
end $$;

create function public.bought_payment_event(p_provider text,p_event_id text,p_reference text,p_payment_id text,p_amount integer,p_currency text,p_state text)
returns void language plpgsql security invoker set search_path = '' as $$
declare d public.bought_drops;
begin
 perform pg_advisory_xact_lock(73198512);
 if exists(select 1 from public.bought_webhook_events where provider=p_provider and event_id=p_event_id) then return; end if;
 select * into d from public.bought_drops where provider=p_provider and
   ((p_reference is not null and payment_reference=p_reference) or (p_payment_id is not null and payment_id=p_payment_id)) for update;
 if not found then raise exception 'BOUGHT: Payment has not been linked yet.'; end if;
 if p_state not in ('paid','refunded','disputed') or d.amount_minor <> p_amount or d.currency <> upper(p_currency) then
   raise exception 'BOUGHT: Payment does not match the reserved broadcast.';
 end if;
 insert into public.bought_webhook_events(provider,event_id,drop_id) values(p_provider,p_event_id,d.id);
 if p_state='paid' and d.payment_state in ('refunded','disputed') then return; end if;
 if p_state <> 'paid' then
   delete from public.bought_ladder where drop_id=d.id;
   update public.bought_drops set payment_state=p_state,state=case when state='published' then 'rejected' else state end,review_reason='Payment was reversed. Contact support.' where id=d.id;
   if exists(select 1 from public.bought_auctions where id=d.auction_id and closes_at > clock_timestamp()) then
     update public.bought_ladder l set position=r.n from (
       select drop_id,row_number() over(order by amount_minor desc,paid_at asc,drop_id asc)::integer n
       from public.bought_ladder where auction_id=d.auction_id
     ) r where l.drop_id=r.drop_id;
   end if;
 else
   update public.bought_drops set payment_state='paid',payment_id=p_payment_id,paid_at=coalesce(paid_at,clock_timestamp()) where id=d.id;
 end if;
end $$;

create function public.bought_claim_upload(p_drop_id uuid,p_replace boolean default false) returns boolean language plpgsql security invoker set search_path = '' as $$
declare d public.bought_drops;
begin
 select * into d from public.bought_drops where id=p_drop_id for update;
 if d.payment_state <> 'paid' then raise exception 'BOUGHT: Wait for payment confirmation before recording.'; end if;
 if d.state not in ('draft','rejected') then raise exception 'BOUGHT: This broadcast has already been submitted.'; end if;
 if d.upload_claimed_at > clock_timestamp()-interval '2 minutes' then raise exception 'BOUGHT: An upload is being prepared. Try again shortly.'; end if;
 if not p_replace and d.mux_upload_url is not null and d.mux_upload_expires_at > clock_timestamp()+interval '5 minutes' and d.media_state='waiting' then return false; end if;
 update public.bought_drops set upload_claimed_at=clock_timestamp(),mux_upload_id=null,mux_upload_url=null,
   mux_asset_id=null,mux_playback_id=null,media_state='none',state='draft',submitted_at=null,review_reason=null,
   reviewed_at=null,reviewed_by=null where id=d.id;
 return true;
end $$;

create function public.bought_media_event(p_event_id text,p_upload_id text,p_asset_id text,p_playback_id text,p_ready boolean,p_valid boolean,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare d public.bought_drops;
begin
 if exists(select 1 from public.bought_webhook_events where provider='mux' and event_id=p_event_id) then return; end if;
 select * into d from public.bought_drops where mux_upload_id=p_upload_id for update;
 -- Old attempts are deliberately ignored; they cannot overwrite a retake.
 if not found then return; end if;
 insert into public.bought_webhook_events(provider,event_id,drop_id) values('mux',p_event_id,d.id) on conflict do nothing;
 if not found then return; end if;
 if d.state in ('published','review','rejected') or d.media_state in ('ready','errored') then return; end if;
 update public.bought_drops set mux_asset_id=p_asset_id,mux_playback_id=p_playback_id,
   media_state=case when p_ready and p_valid then 'ready' when p_ready then 'errored' else 'processing' end,
   state=case when p_ready and not p_valid then 'rejected' when p_ready and submitted_at is not null then 'review' else state end,
   review_reason=p_reason where id=d.id;
end $$;

create function public.bought_submit(p_drop_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare d public.bought_drops;
begin
 select * into d from public.bought_drops where id=p_drop_id for update;
 if d.payment_state <> 'paid' then raise exception 'BOUGHT: Payment must be confirmed first.'; end if;
 if d.state in ('processing','review','published') then return; end if;
 if d.state='rejected' or d.media_state not in ('waiting','processing','ready') or not d.thumbnail_verified then raise exception 'BOUGHT: Finish your video and thumbnail before submitting.'; end if;
 update public.bought_drops set submitted_at=clock_timestamp(),state=case when media_state='ready' then 'review' else 'processing' end where id=d.id;
end $$;

create function public.bought_review(p_drop_id uuid,p_asset_id text,p_reviewer uuid,p_approve boolean,p_reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare d public.bought_drops; a public.bought_auctions; t timestamptz; market jsonb;
begin
 market := public.bought_advance();
 select * into d from public.bought_drops where id=p_drop_id for update;
 t := clock_timestamp();
 if d.state='published' and p_approve and d.mux_asset_id=p_asset_id then return; end if;
 if d.state <> 'review' or d.mux_asset_id is distinct from p_asset_id or d.payment_state <> 'paid' or d.media_state <> 'ready' or not d.thumbnail_verified then
   raise exception 'BOUGHT: This version is not ready for review.';
 end if;
 if not p_approve then
   if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'BOUGHT: Add a reason for the retake.'; end if;
   update public.bought_drops set state='rejected',reviewed_at=t,reviewed_by=p_reviewer,review_reason=left(p_reason,500) where id=d.id;
   return;
 end if;
 -- Late processing/review rolls forward with the original payment. No second charge.
 select * into a from public.bought_auctions where closes_at > t order by opens_at limit 1;
 update public.bought_drops set state='published',reviewed_at=t,reviewed_by=p_reviewer,review_reason=null,
   auction_id=a.id,exposure_starts_at=a.closes_at,exposure_ends_at=a.exposure_ends_at where id=d.id;
 insert into public.bought_ladder(drop_id,auction_id,position,category,title,amount_minor,paid_at,exposure_starts_at,exposure_ends_at)
 values(d.id,a.id,1,d.category,d.title,d.amount_minor,d.paid_at,a.closes_at,a.exposure_ends_at);
 update public.bought_ladder l set position=r.n from (
   select drop_id,row_number() over(order by amount_minor desc,paid_at asc,drop_id asc)::integer n
   from public.bought_ladder where auction_id=a.id
 ) r where l.drop_id=r.drop_id;
end $$;

-- Functions remain invoker-security, restricted to the server service role.
revoke all on function public.bought_advance(),public.bought_claim_checkout(uuid),
 public.bought_payment_event(text,text,text,text,integer,text,text),public.bought_claim_upload(uuid,boolean),
 public.bought_media_event(text,text,text,text,boolean,boolean,text),public.bought_submit(uuid),
 public.bought_review(uuid,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.bought_advance(),public.bought_claim_checkout(uuid),
 public.bought_payment_event(text,text,text,text,integer,text,text),public.bought_claim_upload(uuid,boolean),
 public.bought_media_event(text,text,text,text,boolean,boolean,text),public.bought_submit(uuid),
 public.bought_review(uuid,text,uuid,boolean,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('drop-thumbnails','drop-thumbnails',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- No browser Storage policies: signed, immutable upload paths are issued by the server.

-- Realtime delivers only rows the subscriber can read through RLS.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   alter publication supabase_realtime add table public.bought_drops,public.bought_ladder;
 end if;
end $$;
