import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { testDatabase } from './support/database';

type Row = Record<string, unknown>;
// Issue date for every test: Sat 7 Nov 2026. It goes live at 06:00 UTC; bidding closes 05:45 UTC, 05:50 at the latest.
const ISSUE = '2026-11-07';

async function setClock(db: PGlite, at: string) {
  await db.exec(`set test.now='${at}'`);
}
async function one<T = Row>(db: PGlite, sql: string, args: unknown[] = []) {
  return (await db.query<T>(sql, args)).rows[0];
}
// an account holding `balance` bought points (no free ones), the way most tests want it
async function user(db: PGlite, balance = 100000, country = 'India') {
  const id = randomUUID();
  await db.query('insert into auth.users(id) values ($1)', [id]);
  await db.query(
    "insert into public.bought_accounts(user_id,name,email,country,balance_minor) values ($1,'Biz','a@b.co',$2,$3)",
    [id, country, balance * 100],
  );
  return id;
}
async function ad(db: PGlite, owner: string, spot = 'feed-e', state = 'ready') {
  const id = randomUUID();
  await db.query(
    "insert into public.bought_ads(id,user_id,spot,kind,title,state) values ($1,$2,$3,$4,'An ad',$5)",
    [id, owner, spot, spot === 'cls' ? 'classified' : 'image', state],
  );
  return id;
}
async function bid(
  db: PGlite,
  who: string,
  adId: string | null,
  points: number,
  { spot = 'feed-e', mode = 'exact', issue = ISSUE } = {},
) {
  const row = await one<{ r: { ok: boolean; err?: string; credits?: boolean; short?: number; outbid?: boolean } }>(
    db,
    'select public.bought_ad_bid($1,$2,$3,$4,$5,$6) as r',
    [who, issue, spot, mode, points * 100, adId],
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
const free = async (db: PGlite, who: string) =>
  Number((await one<{ f: number }>(db, 'select free_minor as f from public.bought_accounts where user_id=$1', [who])).f);
const held = async (db: PGlite, who: string) =>
  Number((await one<{ h: number }>(db, 'select public.bought_ad_held($1) as h', [who])).h);
const withdraw = async (db: PGlite, who: string, minor: number) =>
  Number((await one<{ w: number }>(db, 'select public.bought_ad_withdraw($1,$2) as w', [who, minor])).w);
async function signUp(db: PGlite, email: string) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email) values ($1,$2)', [id, email]);
  const r = await one<{ r: { bonus: boolean } }>(db, "select public.bought_ad_open_account($1,$2,'Biz','India',null,'upi') as r", [id, email]);
  return { id, bonus: r.r.bonus };
}

void test('every spot starts at 1 point', async () => {
  const db = await testDatabase();
  const reserve = async (spot: string, issue: string) =>
    Number((await one<{ r: number }>(db, 'select public.bought_ad_reserve($1,$2) as r', [spot, issue])).r) / 100;
  for (const spot of ['top', 'front', 'feed-a', 'half', 'feed-e', 'clip', 'cls']) {
    assert.equal(await reserve(spot, ISSUE), 1, spot);
    assert.equal(await reserve(spot, '2026-11-13'), 1, spot);
  }
  await db.close();
});

void test('bidding opens at D-7 06:00 UTC and closes at 05:45 UTC on the day, 15 minutes before the issue', async () => {
  const db = await testDatabase('2026-10-31T05:59:00Z');
  const a = await user(db);
  const adId = await ad(db, a);
  assert.match((await bid(db, a, adId, 2)).err ?? '', /not opened/);
  await setClock(db, '2026-10-31T06:00:00Z');
  assert.equal((await bid(db, a, adId, 2)).ok, true);
  await setClock(db, '2026-11-07T05:44:59Z');
  assert.equal((await bid(db, a, adId, 3)).ok, true);
  await setClock(db, '2026-11-07T05:50:00Z');
  assert.match((await bid(db, a, adId, 4)).err ?? '', /closed/);
  await db.close();
});

void test('a bid must meet the 1-point reserve, then go up a point at a time', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db), await user(db)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  assert.match((await bid(db, a, adA, 0)).err ?? '', /whole points/);
  assert.equal((await bid(db, a, adA, 1)).ok, true);
  assert.match((await bid(db, b, adB, 1)).err ?? '', /minimum bid is 2 points/);
  assert.equal((await bid(db, b, adB, 2)).ok, true);
  assert.equal((await status(db, a)).status, 'outbid');
  assert.equal((await status(db, b)).status, 'leading');
  await db.close();
});

void test('auto-raise answers one point above, never past the maximum, hidden from others', async () => {
  const db = await testDatabase();
  const [a, b, c] = [await user(db), await user(db), await user(db)];
  const [adA, adB, adC] = [await ad(db, a), await ad(db, b), await ad(db, c)];
  assert.equal((await bid(db, a, adA, 30, { mode: 'auto' })).ok, true);
  assert.equal((await status(db, a)).amount_minor, 100); // leads at the reserve, not the maximum
  const r = await bid(db, b, adB, 20);
  assert.equal(r.ok, true);
  assert.equal(r.outbid, true);
  assert.equal((await status(db, a)).amount_minor, 2100);
  assert.equal((await status(db, b)).status, 'outbid');
  assert.equal((await bid(db, b, adB, 30)).outbid, true); // equal maximums go to the earlier bid
  assert.equal((await status(db, a)).amount_minor, 3000);
  assert.equal((await bid(db, c, adC, 40)).ok, true);
  assert.equal((await status(db, c)).status, 'leading');
  assert.equal((await status(db, a)).status, 'outbid');
  const market = await one<{ m: unknown }>(db, 'select public.bought_ad_market($1) as m', [b]);
  assert.ok(!JSON.stringify(market.m).includes(a), 'no other bidder identity in the market');
  assert.equal((await bid(db, c, adC, 77, { mode: 'auto' })).ok, true);
  const later = await one<{ m: unknown }>(db, 'select public.bought_ad_market($1) as m', [b]);
  assert.ok(!JSON.stringify(later.m).includes('7700'), 'no hidden maximum in the market');
  await db.close();
});

void test('points: a bid sets aside its maximum, no tax, and being outbid frees it', async () => {
  const db = await testDatabase();
  const a = await user(db, 20); // 20 bought points, India
  const b = await user(db, 1000);
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  const short = await bid(db, a, adA, 21);
  assert.equal(short.ok, false);
  assert.equal(short.credits, true);
  assert.equal(short.short, 100);
  assert.match(short.err ?? '', /1 point more/);
  assert.equal((await bid(db, a, adA, 16)).ok, true);
  assert.equal(await held(db, a), 1600);
  assert.equal(await balance(db, a), 2000); // nothing has left the wallet
  assert.equal(await withdraw(db, a, 2000), 400); // only what isn't set aside
  assert.equal((await bid(db, b, adB, 17)).ok, true);
  assert.equal(await held(db, a), 0);
  await db.close();
});

void test('100 free points once per email; spent first; never withdrawn', async () => {
  const db = await testDatabase();
  const first = await signUp(db, 'Asha@Example.com');
  assert.equal(first.bonus, true);
  assert.equal(await balance(db, first.id), 10000);
  assert.equal(await free(db, first.id), 10000);
  const again = await one<{ r: { bonus: boolean } }>(db, "select public.bought_ad_open_account($1,'asha@example.com','Biz 2','India',null,'card') as r", [first.id]);
  assert.equal(again.r.bonus, false, 'saving the account again gives nothing');
  const remade = await signUp(db, 'asha@example.com'); // the same email on a new sign-in account
  assert.equal(remade.bonus, false);
  assert.equal(await balance(db, remade.id), 0);
  const tx = await one<{ label: string; kind: string }>(db, 'select label,kind from public.bought_wallet_tx where user_id=$1', [first.id]);
  assert.deepEqual(tx, { label: '100 free points to start', kind: 'bonus' });

  assert.equal(await withdraw(db, first.id, 10000), 0, 'free points never go to a bank');
  await db.query("update public.bought_accounts set balance_minor = balance_minor + 5000 where user_id=$1", [first.id]); // 50 bought
  assert.equal(await withdraw(db, first.id, 100000), 5000);
  await db.query("update public.bought_accounts set balance_minor = balance_minor + 5000 where user_id=$1", [first.id]);
  // win 120 points: the 100 free go first, then 20 bought; 30 bought remain and only those can be withdrawn
  const rival = await user(db, 1000);
  await bid(db, first.id, await ad(db, first.id), 120);
  await bid(db, rival, await ad(db, rival), 5, { spot: 'top' });
  await setClock(db, '2026-11-07T05:46:00Z');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal(await balance(db, first.id), 3000);
  assert.equal(await free(db, first.id), 0);
  assert.equal(await withdraw(db, first.id, 100000), 3000);
  await db.close();
});

void test('a late bid extends only that spot, and never past 05:50 UTC', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db), await user(db)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  await bid(db, a, adA, 20);
  await setClock(db, '2026-11-07T05:42:00Z');
  await bid(db, b, adB, 21);
  const s = await spotRow(db);
  assert.equal(s.ext, 1);
  assert.equal(new Date(s.closes_at).toISOString(), '2026-11-07T05:47:00.000Z');
  assert.equal(new Date((await spotRow(db, 'top')).closes_at).toISOString(), '2026-11-07T05:45:00.000Z');
  await setClock(db, '2026-11-07T05:46:30Z');
  await bid(db, a, adA, 22);
  assert.equal(new Date((await spotRow(db)).closes_at).toISOString(), '2026-11-07T05:50:00.000Z'); // the hard stop
  await setClock(db, '2026-11-07T05:49:00Z');
  await bid(db, b, adB, 23);
  assert.equal(new Date((await spotRow(db)).closes_at).toISOString(), '2026-11-07T05:50:00.000Z');
  const note = await one<{ msg: string }>(db, "select msg from public.bought_ad_notices where kind='ext' order by id desc limit 1");
  assert.match(note.msg, /to 11:20 IST/);
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
  assert.match((await bid(db, last, adL, 10, { spot: 'cls' })).err ?? '', /minimum to get into the top 8 is 11 points/);
  assert.equal((await bid(db, last, adL, 11, { spot: 'cls' })).ok, true);
  assert.equal((await status(db, users[0], 'cls')).status, 'out');
  assert.equal((await status(db, last, 'cls')).status, 'in');
  assert.equal(await held(db, users[0]), 0);
  const note = await one<{ msg: string }>(db, 'select msg from public.bought_ad_notices where user_id=$1', [users[0]]);
  assert.match(note.msg, /below line 8/);
  await db.close();
});

void test('settling spends winners\' points once, frees everyone else, and a repeat run changes nothing', async () => {
  const db = await testDatabase();
  const [a, b] = [await user(db, 1000), await user(db, 1000)];
  const [adA, adB] = [await ad(db, a), await ad(db, b)];
  await bid(db, a, adA, 300, { mode: 'auto' });
  await bid(db, b, adB, 200);
  assert.equal(Number((await one<{ n: number }>(db, 'select public.bought_ad_settle($1) as n', [ISSUE])).n), 0); // still open
  await setClock(db, '2026-11-07T05:45:00Z');
  await one(db, 'select public.bought_ad_tick()');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal((await status(db, a)).status, 'won');
  assert.equal((await status(db, b)).status, 'lost');
  assert.equal(await balance(db, a), 100000 - 20100); // 201 points: one past the next bidder, no tax
  assert.equal(await balance(db, b), 100000);
  const count = await one<{ c: number }>(db, 'select count(*)::int c from public.bought_ad_results');
  assert.equal(count.c, 1);
  const invoice = await one<{ invoice: string }>(db, 'select invoice from public.bought_ad_results');
  assert.equal(invoice.invoice, 'BGT-300-0001');
  const note = await one<{ msg: string }>(db, "select msg from public.bought_ad_notices where user_id=$1 and kind='close'", [a]);
  assert.match(note.msg, /spent 201 points/);
  await db.close();
});

void test('going live: ready ads run with no review; a winner whose ad isn\'t ready gets every point back', async () => {
  const db = await testDatabase();
  const late = await signUp(db, 'late@example.com'); // 100 free points
  const [ready, rival] = [await user(db, 1000), await user(db, 1000)];
  const adLate = await ad(db, late.id, 'feed-e', 'processing');
  await bid(db, late.id, adLate, 40);
  await bid(db, ready, await ad(db, ready, 'top'), 30, { spot: 'top' });
  await bid(db, rival, await ad(db, rival, 'top'), 10, { spot: 'top' });
  await setClock(db, '2026-11-07T05:51:00Z');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal(await balance(db, late.id), 6000);
  assert.equal(await free(db, late.id), 6000);
  await setClock(db, '2026-11-07T06:00:00Z');
  assert.equal(Number((await one<{ n: number }>(db, 'select public.bought_ad_mark_live($1) as n', [ISSUE])).n), 1);
  assert.equal(await balance(db, late.id), 10000, 'every point back');
  assert.equal(await free(db, late.id), 10000, 'free points come back as free');
  const note = await one<{ msg: string }>(db, "select msg from public.bought_ad_notices where user_id=$1 order by id desc limit 1", [late.id]);
  assert.match(note.msg, /wasn't ready.*40 points are back/);
  const winners = await one<{ w: { spot: string; amt: number }[] }>(db, 'select public.bought_ad_winners($1) as w', [ISSUE]);
  assert.deepEqual(winners.w.map((w) => [w.spot, Number(w.amt)]), [['top', 3000]]);
  assert.ok(!JSON.stringify(winners.w).includes(ready), 'winners carry no user ID');
  assert.equal(Number((await one<{ n: number }>(db, 'select public.bought_ad_mark_live($1) as n', [ISSUE])).n), 0, 'a second call changes nothing');
  assert.equal(await balance(db, late.id), 10000);
  await db.close();
});

void test('only a matching signed payment adds points, once, and a reversal removes them', async () => {
  const db = await testDatabase();
  const a = await user(db, 0);
  const id = randomUUID();
  await db.query(
    "insert into public.bought_topups(id,user_id,credit_minor,tax_minor,charge_minor,charge_currency,provider,method,payment_reference) values ($1,$2,10000,1800,1003000,'INR','razorpay','upi','order_1')",
    [id, a],
  );
  const pay = (amount: number, currency: string, event: string, state = 'paid') =>
    db.query('select public.bought_ad_payment_event($1,$2,$3,$4,$5,$6,$7)', ['razorpay', event, 'order_1', 'pay_1', amount, currency, state]);
  await assert.rejects(pay(100, 'INR', 'e0'), /does not match/);
  await assert.rejects(pay(1003000, 'USD', 'e0'), /does not match/);
  assert.equal(await balance(db, a), 0);
  await pay(1003000, 'INR', 'e1');
  await pay(1003000, 'INR', 'e1');
  await pay(1003000, 'INR', 'e2');
  assert.equal(await balance(db, a), 10000);
  const tx = await one<{ label: string }>(db, "select label from public.bought_wallet_tx where user_id=$1 and kind='topup'", [a]);
  assert.equal(tx.label, 'Points bought · UPI');
  await pay(1003000, 'INR', 'e3', 'refunded');
  assert.equal(await balance(db, a), 0);
  await pay(1003000, 'INR', 'e4');
  assert.equal(await balance(db, a), 0, 'a late capture cannot revive a reversed payment');
  await db.close();
});

void test('media: a replaced upload cannot touch the current take; a ready video is ready, a broken one is sent back', async () => {
  const db = await testDatabase();
  const a = await user(db);
  const id = randomUUID();
  await db.query("insert into public.bought_ads(id,user_id,spot,kind,title) values ($1,$2,'feed-e','video','An ad')", [id, a]);
  assert.equal((await one<{ c: boolean }>(db, 'select public.bought_ad_claim_upload($1) as c', [id])).c, true);
  await db.query("update public.bought_ads set mux_upload_id='up1',mux_upload_url='https://x',mux_upload_expires_at=public.test_now()+interval '2 hours',media_state='waiting',upload_claimed_at=null where id=$1", [id]);
  await db.query('select public.bought_ad_submit($1)', [id]);
  const state = async () => (await one<{ state: string; media_state: string; problem: string | null }>(db, 'select state,media_state,problem from public.bought_ads where id=$1', [id]));
  assert.equal((await state()).state, 'processing');
  const event = (eventId: string, upload: string, ready = true, valid = true, reason: string | null = null) =>
    db.query('select public.bought_ad_media_event($1,$2,$3,$4,$5,$6,$7)', [eventId, upload, 'asset1', 'play1', ready, valid, reason]);
  await event('e0', 'old-upload');
  assert.equal((await state()).media_state, 'waiting');
  await event('e1', 'up1');
  assert.equal((await state()).state, 'ready');
  // a retake that Mux can't use comes back to the advertiser with the reason
  assert.equal((await one<{ c: boolean }>(db, 'select public.bought_ad_claim_upload($1,true) as c', [id])).c, true);
  await db.query("update public.bought_ads set mux_upload_id='up2',media_state='waiting',upload_claimed_at=null where id=$1", [id]);
  await db.query('select public.bought_ad_submit($1)', [id]);
  await event('e2', 'up2', true, false, 'Your video needs a picture and a sound track.');
  assert.deepEqual(await state(), { state: 'rejected', media_state: 'errored', problem: 'Your video needs a picture and a sound track.' });
  await db.close();
});

void test('the market shows a stranger public numbers and a bidder their own bids and free points', async () => {
  const db = await testDatabase();
  const a = await signUp(db, 'm@example.com');
  await bid(db, a.id, await ad(db, a.id), 20);
  type Market = { dates: string[]; me: null | { my: Record<string, unknown>[]; balance: number; free: number }; spots: Record<string, { high: number; leader: string }> };
  const anon = (await one<{ m: Market }>(db, 'select public.bought_ad_market(null) as m')).m;
  assert.ok(anon.dates.includes(ISSUE));
  assert.equal(anon.me, null);
  assert.equal(Number(anon.spots[`${ISSUE}|feed-e`].high), 2000);
  assert.equal(anon.spots[`${ISSUE}|feed-e`].leader, 'rival');
  const own = (await one<{ m: Market }>(db, 'select public.bought_ad_market($1) as m', [a.id])).m;
  assert.equal(own.me?.my[0].status, 'leading');
  assert.equal(Number(own.me?.free), 10000);
  assert.ok(!('review' in (own.me?.my[0] ?? {})), 'no review state any more');
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
  await setClock(db, '2026-11-07T05:51:00Z');
  await db.exec('set role service_role');
  await one(db, 'select public.bought_ad_tick()');
  assert.equal((await status(db, a)).status, 'won');
  await one(db, 'select public.bought_ad_mark_live($1)', [ISSUE]);
  await one(db, 'select public.bought_ad_winners($1)', [ISSUE]);
  await one(db, "select public.bought_ad_count($1,'feed-e','view')", [ISSUE]);
  await one(db, 'select public.bought_ad_withdraw($1,100)', [b]);
  await db.exec('reset role');
  const c = randomUUID();
  await db.query("insert into auth.users(id,email) values ($1,'svc@example.com')", [c]);
  await db.exec('set role service_role');
  await one(db, "select public.bought_ad_open_account($1,'svc@example.com','Biz','India',null,'upi')", [c]);
  await db.exec('reset role');
  await db.close();
});
