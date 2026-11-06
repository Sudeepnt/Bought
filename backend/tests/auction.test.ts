import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { testDatabase } from './support/database';

type Row = Record<string, unknown>;
// Issue date for every test: Sat 7 Nov 2026 (weekday multiplier 0.8). Closes Fri 6 Nov 22:00 IST = 16:30 UTC.
const ISSUE = '2026-11-07';

async function setClock(db: PGlite, at: string) {
  await db.exec(`set test.now='${at}'`);
}
async function one<T = Row>(db: PGlite, sql: string, args: unknown[] = []) {
  return (await db.query<T>(sql, args)).rows[0];
}
async function user(db: PGlite, balance = 100000, country = 'India') {
  const id = randomUUID();
  await db.query('insert into auth.users(id) values ($1)', [id]);
  await db.query(
    "insert into public.bought_accounts(user_id,name,email,country,balance_minor) values ($1,'Biz','a@b.co',$2,$3)",
    [id, country, balance * 100],
  );
  return id;
}
async function ad(db: PGlite, owner: string, spot = 'feed-e', state = 'approved') {
  const id = randomUUID();
  await db.query(
    "insert into public.bought_ads(id,user_id,spot,kind,title,state,reviewed_at) values ($1,$2,$3,$4,'An ad',$5,public.test_now())",
    [id, owner, spot, spot === 'cls' ? 'classified' : 'image', state],
  );
  return id;
}
async function bid(
  db: PGlite,
  who: string,
  adId: string | null,
  usd: number,
  { spot = 'feed-e', mode = 'exact', issue = ISSUE } = {},
) {
  const row = await one<{ r: { ok: boolean; err?: string; credits?: boolean; short?: number; outbid?: boolean } }>(
    db,
    'select public.bought_ad_bid($1,$2,$3,$4,$5,$6) as r',
    [who, issue, spot, mode, usd * 100, adId],
  );
  return row.r;
}
const status = async (db: PGlite, who: string, spot = 'feed-e') =>
  one<{ status: string; amount_minor: number; max_minor: number }>(
    db,
    'select status,amount_minor::int,max_minor::int from public.bought_ad_bids where user_id=$1 and spot=$2',
    [who, spot],
  );
const spotRow = (db: PGlite, spot = 'feed-e') =>
  one<{ high_minor: number; bid_count: number; closes_at: Date; ext: number }>(
    db,
    'select high_minor::int,bid_count,closes_at,ext from public.bought_issue_spots where issue=$1 and spot=$2',
    [ISSUE, spot],
  );
const balance = async (db: PGlite, who: string) =>
  Number((await one<{ b: number }>(db, 'select balance_minor as b from public.bought_accounts where user_id=$1', [who])).b);

void test('reserves match the prices the Advertise page prints', async () => {
  const db = await testDatabase();
  // data.template.js: DAY_MULT=[0.9,1,1,1.1,1.1,1.25,0.8], display rounded to $10, classifieds at least $5.
  const reserve = async (spot: string, issue: string) =>
    Number((await one<{ r: number }>(db, 'select public.bought_ad_reserve($1,$2) as r', [spot, issue])).r) / 100;
  assert.equal(await reserve('top', '2026-11-08'), 540); // Sunday 0.9
  assert.equal(await reserve('half', '2026-11-13'), 880); // Friday 1.25 → 875 → 880
  assert.equal(await reserve('feed-e', ISSUE), 140); // Saturday 0.8 → 144 → 140
  assert.equal(await reserve('cls', ISSUE), 5);
  await db.close();
});

void test('bidding opens at D-7 07:00 IST and closes at D-1 22:00 IST', async () => {
  const db = await testDatabase('2026-10-31T01:29:00Z'); // 06:59 IST on D-7
  const a = await user(db);
  const adId = await ad(db, a);
  assert.match((await bid(db, a, adId, 200)).err ?? '', /not opened/);
  await setClock(db, '2026-10-31T01:30:00Z');
  assert.equal((await bid(db, a, adId, 200)).ok, true);
  await setClock(db, '2026-11-06T16:30:00Z');
  assert.match((await bid(db, a, adId, 300)).err ?? '', /closed/);
  await db.close();
});

void test('a bid must meet the reserve, then the increment', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db), await user(db)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  assert.match((await bid(db, a, adA, 130)).err ?? '', /minimum bid is \$140/);
  assert.equal((await bid(db, a, adA, 140)).ok, true);
  assert.match((await bid(db, b, adB, 145)).err ?? '', /minimum bid is \$150/);
  assert.equal((await bid(db, b, adB, 150)).ok, true);
  assert.equal((await status(db, a)).status, 'outbid');
  assert.equal((await status(db, b)).status, 'leading');
  await db.close();
});

void test('auto-raise answers one increment above, never past the maximum, hidden from others', async () => {
  const db = await testDatabase();
  const [a, b, c] = [await user(db), await user(db), await user(db)];
  const [adA, adB, adC] = [await ad(db, a), await ad(db, b), await ad(db, c)];
  assert.equal((await bid(db, a, adA, 300, { mode: 'auto' })).ok, true);
  assert.equal((await status(db, a)).amount_minor, 14000); // leads at the reserve, not the maximum
  assert.equal((await spotRow(db)).high_minor, 14000);

  const r = await bid(db, b, adB, 200);
  assert.equal(r.ok, true);
  assert.equal(r.outbid, true);
  assert.equal((await status(db, a)).status, 'leading');
  assert.equal((await status(db, a)).amount_minor, 21000);
  assert.equal((await status(db, b)).status, 'outbid');

  // Equal maximums go to the earlier bid.
  assert.equal((await bid(db, b, adB, 300)).outbid, true);
  assert.equal((await status(db, a)).amount_minor, 30000);

  // Past the maximum, the challenger wins at their exact bid and the old leader's hold is freed.
  assert.equal((await bid(db, c, adC, 400)).ok, true);
  assert.equal((await status(db, c)).status, 'leading');
  assert.equal((await status(db, a)).status, 'outbid');
  const market = await one<{ m: { spots: Record<string, { hist: { h: string }[]; leader: string }> } }>(
    db,
    'select public.bought_ad_market($1) as m',
    [b],
  );
  const raw = JSON.stringify(market.m);
  assert.ok(!raw.includes(a), 'no other bidder identity in the market');
  // c's hidden maximum is never shown to anyone else.
  assert.equal((await bid(db, c, adC, 777, { mode: 'auto' })).ok, true);
  const later = await one<{ m: unknown }>(db, 'select public.bought_ad_market($1) as m', [b]);
  assert.ok(!JSON.stringify(later.m).includes('77700'), 'no hidden maximum in the market');
  await db.close();
});

void test('credits: a bid sets aside maximum plus tax and being outbid frees it', async () => {
  const db = await testDatabase();
  const a = await user(db, 200); // $200, India: 18% GST
  const b = await user(db, 10000);
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  const short = await bid(db, a, adA, 170); // needs 170 x 1.18 = 200.60
  assert.equal(short.ok, false);
  assert.equal(short.credits, true);
  assert.equal(short.short, 60);
  assert.equal((await bid(db, a, adA, 160)).ok, true); // holds 188.80
  const held = await one<{ h: number }>(db, 'select public.bought_ad_held($1,0.18) as h', [a]);
  assert.equal(Number(held.h), 18880);
  assert.equal(await balance(db, a), 20000); // nothing has left the wallet
  assert.equal(Number(await one<{ w: number }>(db, 'select public.bought_ad_withdraw($1,20000) as w', [a]).then((x) => x.w)), 1120);
  assert.equal((await bid(db, b, adB, 170)).ok, true);
  assert.equal(Number((await one<{ h: number }>(db, 'select public.bought_ad_held($1,0.18) as h', [a])).h), 0);
  await db.close();
});

void test('no GST outside India', async () => {
  const db = await testDatabase();
  const a = await user(db, 200, 'United States');
  assert.equal((await bid(db, a, await ad(db, a), 200)).ok, true);
  await db.close();
});

void test('a late bid extends only that spot, up to 22:30 IST', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db), await user(db)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  await bid(db, a, adA, 200);
  await setClock(db, '2026-11-06T16:27:00Z'); // 21:57 IST
  await bid(db, b, adB, 210);
  const s = await spotRow(db);
  assert.equal(s.ext, 1);
  assert.equal(new Date(s.closes_at).toISOString(), '2026-11-06T16:32:00.000Z');
  assert.equal(new Date((await spotRow(db, 'top')).closes_at).toISOString(), '2026-11-06T16:30:00.000Z');
  await setClock(db, '2026-11-06T16:58:00Z'); // bids keep it open: walk the close forward first
  await db.query("update public.bought_issue_spots set closes_at='2026-11-06T16:59:00Z' where issue=$1 and spot='feed-e'", [ISSUE]);
  await bid(db, a, adA, 220);
  assert.equal(new Date((await spotRow(db)).closes_at).toISOString(), '2026-11-06T17:00:00.000Z'); // hard stop
  await db.close();
});

void test('classifieds: top 8 run, pay as bid, falling out frees the hold and notifies', async () => {
  const db = await testDatabase();
  const users = [];
  for (let i = 0; i < 9; i++) users.push(await user(db));
  for (let i = 0; i < 8; i++)
    assert.equal((await bid(db, users[i], await ad(db, users[i], 'cls'), 10 + i, { spot: 'cls' })).ok, true);
  const last = users[8];
  const adL = await ad(db, last, 'cls');
  assert.match((await bid(db, last, adL, 10, { spot: 'cls' })).err ?? '', /minimum to get into the top 8 is \$11/);
  assert.equal((await bid(db, last, adL, 11, { spot: 'cls' })).ok, true);
  assert.equal((await status(db, users[0], 'cls')).status, 'out');
  assert.equal((await status(db, last, 'cls')).status, 'in');
  assert.equal(Number((await one<{ h: number }>(db, 'select public.bought_ad_held($1,0.18) as h', [users[0]])).h), 0);
  const note = await one<{ msg: string }>(db, 'select msg from public.bought_ad_notices where user_id=$1', [users[0]]);
  assert.match(note.msg, /below line 8/);
  await db.close();
});

void test('settling charges winners once, frees everyone else, and a repeat run changes nothing', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db, 1000), await user(db, 1000)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  await bid(db, a, adA, 300, { mode: 'auto' });
  await bid(db, b, adB, 200);
  assert.equal(Number((await one<{ n: number }>(db, 'select public.bought_ad_settle($1) as n', [ISSUE])).n), 0); // still open
  await setClock(db, '2026-11-06T16:31:00Z');
  await one(db, 'select public.bought_ad_tick()');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal((await status(db, a)).status, 'won');
  assert.equal((await status(db, b)).status, 'lost');
  // Wins at $210 (one increment past the next bidder) + 18% GST = $247.80.
  assert.equal(await balance(db, a), 100000 - 24780);
  assert.equal(await balance(db, b), 100000);
  const count = await one<{ c: number }>(db, 'select count(*)::int c from public.bought_ad_results');
  assert.equal(count.c, 1);
  const invoice = await one<{ invoice: string }>(db, 'select invoice from public.bought_ad_results');
  assert.equal(invoice.invoice, 'BGT-300-0001'); // issue 300 = 287 + 13 days after 25 Oct
  await db.close();
});

void test('05:00 IST: an unapproved winner is refunded and the next bidder runs', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db, 1000), await user(db, 1000)];
  const adA = await ad(db, a, 'feed-e', 'review');
  const adB = await ad(db, b);
  await bid(db, b, adB, 200);
  await bid(db, a, adA, 300);
  await setClock(db, '2026-11-06T16:31:00Z');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal(await balance(db, a), 100000 - 35400);
  await setClock(db, '2026-11-06T23:29:00Z'); // 04:59 IST
  await one(db, 'select public.bought_ad_tick()');
  assert.equal(await balance(db, a), 100000 - 35400);
  await setClock(db, '2026-11-06T23:30:00Z'); // 05:00 IST
  await one(db, 'select public.bought_ad_tick()');
  assert.equal(await balance(db, a), 100000);
  assert.equal(await balance(db, b), 100000 - 23600);
  assert.equal((await status(db, b)).status, 'won');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal(await balance(db, b), 100000 - 23600);
  assert.equal(Number((await one<{ n: number }>(db, 'select public.bought_ad_mark_live($1) as n', [ISSUE])).n), 1);
  const winners = await one<{ w: { spot: string; amt: number; adv: string }[] }>(db, 'select public.bought_ad_winners($1) as w', [ISSUE]);
  assert.equal(winners.w.length, 1);
  assert.equal(Number(winners.w[0].amt), 20000);
  assert.ok(!JSON.stringify(winners.w).includes(b), 'winners carry no user ID');
  await db.close();
});

void test('only a matching signed payment adds credits, once, and a reversal removes them', async () => {
  const db = await testDatabase();
  const a = await user(db, 0);
  const id = randomUUID();
  await db.query(
    "insert into public.bought_topups(id,user_id,credit_minor,charge_minor,charge_currency,provider,method,payment_reference) values ($1,$2,10000,8500000,'INR','razorpay','upi','order_1')",
    [id, a],
  );
  const pay = (amount: number, currency: string, event: string, state = 'paid') =>
    db.query('select public.bought_ad_payment_event($1,$2,$3,$4,$5,$6,$7)', ['razorpay', event, 'order_1', 'pay_1', amount, currency, state]);
  await assert.rejects(pay(100, 'INR', 'e0'), /does not match/);
  await assert.rejects(pay(8500000, 'USD', 'e0'), /does not match/);
  assert.equal(await balance(db, a), 0);
  await pay(8500000, 'INR', 'e1');
  await pay(8500000, 'INR', 'e1');
  await pay(8500000, 'INR', 'e2');
  assert.equal(await balance(db, a), 10000);
  await pay(8500000, 'INR', 'e3', 'refunded');
  assert.equal(await balance(db, a), 0);
  await pay(8500000, 'INR', 'e4');
  assert.equal(await balance(db, a), 0, 'a late capture cannot revive a reversed payment');
  await db.close();
});

void test('media: a replaced upload cannot touch the current take, and approval needs a transcript', async () => {
  const db = await testDatabase();
  const a = await user(db);
  const id = randomUUID();
  await db.query("insert into public.bought_ads(id,user_id,spot,kind,title) values ($1,$2,'feed-e','video','An ad')", [id, a]);
  assert.equal((await one<{ c: boolean }>(db, 'select public.bought_ad_claim_upload($1) as c', [id])).c, true);
  await db.query("update public.bought_ads set mux_upload_id='up1',mux_upload_url='https://x',mux_upload_expires_at=public.test_now()+interval '2 hours',media_state='waiting',upload_claimed_at=null where id=$1", [id]);
  await db.query('select public.bought_ad_submit($1)', [id]);
  assert.equal((await one<{ state: string }>(db, 'select state from public.bought_ads where id=$1', [id])).state, 'processing');
  const event = (eventId: string, upload: string, ready = true, valid = true) =>
    db.query('select public.bought_ad_media_event($1,$2,$3,$4,$5,$6,$7)', [eventId, upload, 'asset1', 'play1', ready, valid, null]);
  await event('e0', 'old-upload');
  assert.equal((await one<{ media_state: string }>(db, 'select media_state from public.bought_ads where id=$1', [id])).media_state, 'waiting');
  await event('e1', 'up1');
  assert.equal((await one<{ state: string }>(db, 'select state from public.bought_ads where id=$1', [id])).state, 'review');
  await assert.rejects(db.query('select public.bought_ad_review($1,true)', [id]), /transcript/);
  assert.equal((await one<{ c: boolean }>(db, "select public.bought_ad_claim_transcription($1,'asset1') as c", [id])).c, true);
  await db.query("select public.bought_ad_finish_transcription($1,'asset1','Hello world.','WEBVTT\n\n')", [id]);
  await db.query('select public.bought_ad_review($1,true)', [id]);
  assert.equal((await one<{ state: string }>(db, 'select state from public.bought_ads where id=$1', [id])).state, 'approved');
  await db.close();
});

void test('the market shows a stranger public numbers and a bidder their own bids', async () => {
  const db = await testDatabase();
  const a = await user(db);
  await bid(db, a, await ad(db, a), 200);
  type Market = { dates: string[]; me: null | { my: { d: string; k: string; status: string }[]; balance: number }; spots: Record<string, { high: number; leader: string }> };
  const anon = (await one<{ m: Market }>(db, 'select public.bought_ad_market(null) as m')).m;
  assert.ok(anon.dates.includes(ISSUE));
  assert.equal(anon.me, null);
  assert.equal(Number(anon.spots[`${ISSUE}|feed-e`].high), 20000);
  assert.equal(anon.spots[`${ISSUE}|feed-e`].leader, 'rival');
  const own = (await one<{ m: Market }>(db, 'select public.bought_ad_market($1) as m', [a])).m;
  assert.equal(own.me?.my[0].status, 'leading');
  assert.equal(own.spots[`${ISSUE}|feed-e`].leader, 'me');
  await db.close();
});

void test('browsers cannot read or call anything directly', async () => {
  const db = await testDatabase();
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.bought_accounts'), /permission denied/);
  await assert.rejects(db.query('select public.bought_ad_market(null)'), /permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('select * from public.bought_ad_bids'), /permission denied/);
  await assert.rejects(db.query('select public.bought_ad_withdraw(gen_random_uuid(),1)'), /permission denied/);
  await db.exec('reset role');
  await db.close();
});

// PGlite runs as a superuser unless told otherwise, so permissions need their own check.
void test('the service role the API runs as can do the whole job', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db, 1000), await user(db, 1000)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  await db.exec('set role service_role');
  assert.equal((await bid(db, a, adA, 300, { mode: 'auto' })).ok, true);
  assert.equal((await bid(db, b, adB, 200)).ok, true);
  await one(db, 'select public.bought_ad_market($1)', [a]);
  await db.exec('reset role');
  await setClock(db, '2026-11-06T23:31:00Z');
  await db.exec('set role service_role');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal((await status(db, a)).status, 'won');
  await one(db, 'select public.bought_ad_mark_live($1)', [ISSUE]);
  await one(db, 'select public.bought_ad_winners($1)', [ISSUE]);
  await one(db, "select public.bought_ad_count($1,'feed-e','view')", [ISSUE]);
  await one(db, 'select public.bought_ad_withdraw($1,100)', [b]);
  await db.exec('reset role');
  await db.close();
});
