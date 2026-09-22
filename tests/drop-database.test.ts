import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

void test('Postgres enforces the paid-drop lifecycle, RLS, replay handling, and UTC boundaries', async (t) => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    grant usage on schema auth,public,storage to anon,authenticated,service_role;
    grant select on auth.users to service_role;
    create function public.test_now() returns timestamptz language sql as $$ select current_setting('test.now')::timestamptz $$;
    set test.now='2026-09-08T05:00:00Z';
  `);
  const sql = await readFile(
    new URL(
      '../supabase/migrations/20260908024518_paid_drop_pipeline.sql',
      import.meta.url,
    ),
    'utf8',
  );
  // Only the database clock is replaced in the test runtime. Production exposes no clock override.
  await db.exec(
    sql
      .replaceAll('clock_timestamp()', 'public.test_now()')
      .replace(/\bnow\(\)/g, 'public.test_now()'),
  );
  const captureSql = await readFile(
    new URL(
      '../supabase/migrations/20260909043754_add_capture_mode.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(captureSql);
  const snapshotSql = await readFile(
    new URL(
      '../supabase/migrations/20260913165454_optimize_public_snapshot.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(
    snapshotSql
      .replaceAll('clock_timestamp()', 'public.test_now()')
      .replace(/\bnow\(\)/g, 'public.test_now()'),
  );
  const transcriptionSql = await readFile(
    new URL(
      '../supabase/migrations/20260920102000_add_english_transcription.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(
    transcriptionSql
      .replaceAll('clock_timestamp()', 'public.test_now()')
      .replace(/\bnow\(\)/g, 'public.test_now()'),
  );
  const owner = '10000000-0000-4000-8000-000000000001';
  const stranger = '10000000-0000-4000-8000-000000000002';
  const moderator = '10000000-0000-4000-8000-000000000003';
  const one = '20000000-0000-4000-8000-000000000001';
  const two = '20000000-0000-4000-8000-000000000002';
  const late = '20000000-0000-4000-8000-000000000003';
  await db.query('insert into auth.users values($1),($2),($3)', [
    owner,
    stranger,
    moderator,
  ]);
  const row = async (id = one) =>
    (
      await db.query<Record<string, unknown>>(
        'select * from public.bought_drops where id=$1',
        [id],
      )
    ).rows[0];
  const pay = (id: string, event: string, amount = 50000, state = 'paid') =>
    db.query('select public.bought_payment_event($1,$2,$3,$4,$5,$6,$7)', [
      'stripe',
      event,
      `cs_${id}`,
      `pi_${id}`,
      amount,
      'usd',
      state,
    ]);
  const ready = (id: string, event: string, good = true) =>
    db.query('select public.bought_media_event($1,$2,$3,$4,true,$5,$6)', [
      event,
      `upload_${id}`,
      `asset_${id}`,
      `playback_${id}`,
      good,
      good ? null : 'Retake required',
    ]);
  const submit = (id: string) =>
    db.query('select public.bought_submit($1)', [id]);
  const publish = (id: string) =>
    db.query('select public.bought_review($1,$2,$3,true,null)', [
      id,
      `asset_${id}`,
      moderator,
    ]);
  const create = async (id: string, amount = 50000) => {
    await db.query(
      `insert into public.bought_drops(id,user_id,category,title,amount_minor,provider,payment_reference) values($1,$2,'BUILDING','My real drop',$3,'stripe',$4)`,
      [id, owner, amount, `cs_${id}`],
    );
  };
  const prepare = async (id: string) => {
    await db.query('select public.bought_claim_upload($1)', [id]);
    await db.query(
      `update public.bought_drops set mux_upload_id=$2,upload_claimed_at=null,media_state='waiting',thumbnail_path=$3,thumbnail_verified=true where id=$1`,
      [id, `upload_${id}`, `${owner}/${id}/thumb.jpg`],
    );
  };
  try {
    await create(one);
    await t.test(
      'database rejects a recorder mode that does not match the category',
      async () => {
        await assert.rejects(
          db.query(
            `insert into public.bought_drops(id,user_id,category,capture_mode,title,amount_minor,provider) values($1,$2,'BEEF','screen','Wrong recorder',50000,'stripe')`,
            ['20000000-0000-4000-8000-000000000099', owner],
          ),
          /bought_drops_capture_matches_category/,
        );
      },
    );
    await t.test(
      'checkout retries are serialized and an ambiguous attempt can reconcile after its lease',
      async () => {
        const first = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_checkout($1) claimed',
          [one],
        );
        const retry = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_checkout($1) claimed',
          [one],
        );
        assert.equal(first.rows[0].claimed, true);
        assert.equal(retry.rows[0].claimed, false);
        await db.exec("set test.now='2026-09-08T05:00:31Z'");
        const recovery = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_checkout($1) claimed',
          [one],
        );
        assert.equal(recovery.rows[0].claimed, true);
        await db.query(
          "update public.bought_drops set checkout_state='ready',checkout_claimed_at=null where id=$1",
          [one],
        );
        const result = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_checkout($1) claimed',
          [one],
        );
        assert.equal(result.rows[0].claimed, false);
        await db.exec("set test.now='2026-09-08T05:00:00Z'");
      },
    );
    await t.test('unpaid drops cannot record, submit, or publish', async () => {
      await assert.rejects(
        db.query('select public.bought_claim_upload($1)', [one]),
        /payment confirmation/,
      );
      await assert.rejects(submit(one), /Payment must/);
      await assert.rejects(publish(one), /not ready/);
    });
    await t.test(
      'mismatched amount and currency never reserve a position',
      async () => {
        await assert.rejects(pay(one, 'mismatch', 49900), /does not match/);
        await assert.rejects(
          db.query('select public.bought_payment_event($1,$2,$3,$4,$5,$6,$7)', [
            'stripe',
            'currency',
            `cs_${one}`,
            `pi_${one}`,
            50000,
            'eur',
            'paid',
          ]),
          /does not match/,
        );
        assert.equal((await row()).payment_state, 'unpaid');
      },
    );
    await t.test(
      'a verified payment is idempotent across delivery retries',
      async () => {
        await pay(one, 'payment-1');
        const first = (await row()).paid_at;
        await db.exec("set test.now='2026-09-08T05:01:00Z'");
        await pay(one, 'payment-1');
        await pay(one, 'payment-2');
        assert.equal((await row()).payment_state, 'paid');
        assert.deepEqual((await row()).paid_at, first);
      },
    );
    await t.test(
      'RLS blocks strangers and all browser mutations and RPCs',
      async () => {
        await db.exec(`set role authenticated; set test.user_id='${stranger}'`);
        assert.equal(
          (await db.query('select * from public.bought_drops')).rows.length,
          0,
        );
        await db.exec(`set test.user_id='${owner}'`);
        assert.equal(
          (await db.query('select * from public.bought_drops')).rows.length,
          1,
        );
        await assert.rejects(
          db.query("update public.bought_drops set payment_state='paid'"),
          /permission denied/,
        );
        await assert.rejects(
          db.query('select public.bought_submit($1)', [one]),
          /permission denied/,
        );
        await assert.rejects(
          db.query('select public.bought_review($1,$2,$3,true,null)', [
            one,
            'asset',
            owner,
          ]),
          /permission denied/,
        );
        await assert.rejects(
          db.query('select public.bought_claim_transcription($1,$2)', [
            one,
            `asset_${one}`,
          ]),
          /permission denied/,
        );
        await db.exec('reset role');
      },
    );
    await t.test(
      'browser roles hold only the table privileges the public API needs',
      async () => {
        const result = await db.query<{
          anon_drops: boolean;
          anon_ladder: boolean;
          anon_ladder_write: boolean;
          auth_webhooks: boolean;
          auth_drops_write: boolean;
        }>(`
          select
            has_table_privilege('anon', 'public.bought_drops', 'select') anon_drops,
            has_table_privilege('anon', 'public.bought_ladder', 'select') anon_ladder,
            has_table_privilege('anon', 'public.bought_ladder', 'insert,update,delete') anon_ladder_write,
            has_table_privilege('authenticated', 'public.bought_webhook_events', 'select') auth_webhooks,
            has_table_privilege('authenticated', 'public.bought_drops', 'insert,update,delete') auth_drops_write
        `);
        assert.deepEqual(result.rows[0], {
          anon_drops: false,
          anon_ladder: true,
          anon_ladder_write: false,
          auth_webhooks: false,
          auth_drops_write: false,
        });
      },
    );
    await t.test(
      'provider upload resources have per-broadcast retry budgets',
      async () => {
        const path = `${owner}/${one}/thumbnail-staging`;
        const claimed = await db.query<{ previous: string | null }>(
          'select public.bought_claim_thumbnail($1,$2) previous',
          [one, path],
        );
        assert.equal(claimed.rows[0].previous, null);
        assert.equal((await row()).thumbnail_path, path);
        assert.equal((await row()).thumbnail_attempts, 1);
        await assert.rejects(
          db.query('select public.bought_claim_thumbnail($1,$2)', [
            one,
            `${owner}/${one}/attacker-controlled.jpg`,
          ]),
          /Invalid thumbnail path/,
        );

        await db.query(
          'update public.bought_drops set upload_attempts=20,thumbnail_attempts=30 where id=$1',
          [one],
        );
        await assert.rejects(
          db.query('select public.bought_claim_upload($1,true)', [one]),
          /upload retry limit/,
        );
        await assert.rejects(
          db.query('select public.bought_claim_thumbnail($1,$2)', [one, path]),
          /thumbnail retry limit/,
        );
        await db.query(
          'update public.bought_drops set upload_attempts=0,thumbnail_attempts=1 where id=$1',
          [one],
        );
      },
    );
    await t.test(
      'submit waits for media readiness; late stale events cannot regress it',
      async () => {
        await prepare(one);
        await submit(one);
        assert.equal((await row()).state, 'processing');
        await ready(one, 'mux-ready-1');
        assert.equal((await row()).state, 'review');
        await ready(one, 'mux-ready-1');
        await ready(one, 'mux-late-error', false);
        assert.equal((await row()).state, 'review');
        await assert.rejects(
          db.query('select public.bought_review($1,$2,$3,true,null)', [
            one,
            'stale-asset',
            moderator,
          ]),
          /not ready/,
        );
      },
    );
    await t.test(
      'English transcription claims are private, idempotent, and bound to the current recording',
      async () => {
        const first = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_transcription($1,$2) claimed',
          [one, `asset_${one}`],
        );
        const concurrentRetry = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_transcription($1,$2) claimed',
          [one, `asset_${one}`],
        );
        assert.equal(first.rows[0].claimed, true);
        assert.equal(concurrentRetry.rows[0].claimed, false);

        await db.query(
          'select public.bought_finish_transcription($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            one,
            `asset_${one}`,
            'This is the English transcript.',
            'WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nThis is the English transcript.\n',
            'A short editorial summary.',
            'An accurate headline',
            'This is the English transcript.',
            ['launch', 'founder'],
          ],
        );
        const saved = await row();
        assert.equal(saved.transcription_status, 'ready');
        assert.equal(
          saved.transcript_english,
          'This is the English transcript.',
        );
        assert.deepEqual(saved.editorial_keywords, ['launch', 'founder']);

        const finishedRetry = await db.query<{ claimed: boolean }>(
          'select public.bought_claim_transcription($1,$2) claimed',
          [one, `asset_${one}`],
        );
        assert.equal(finishedRetry.rows[0].claimed, false);
        await assert.rejects(
          db.query('select public.bought_claim_transcription($1,$2)', [
            one,
            'stale-asset',
          ]),
          /not ready for transcription/,
        );
      },
    );
    await t.test(
      'only approved, paid, checked media can reach the public ladder',
      async () => {
        assert.equal(
          (await db.query('select * from public.bought_ladder')).rows.length,
          0,
        );
        await publish(one);
        await publish(one);
        assert.equal(
          (await db.query('select * from public.bought_ladder')).rows.length,
          1,
        );
        assert.equal((await row()).state, 'published');
        await assert.rejects(
          db.query('select public.bought_claim_upload($1,true)', [one]),
          /already been submitted/,
        );
      },
    );
    await t.test(
      'ready-before-submit works and higher bids are ranked in the database',
      async () => {
        await create(two, 60000);
        await pay(two, 'pay-two', 60000);
        await prepare(two);
        await ready(two, 'mux-two');
        assert.equal((await row(two)).state, 'draft');
        await submit(two);
        await publish(two);
        const ranks = (
          await db.query<{ drop_id: string; position: number }>(
            'select drop_id,position from public.bought_ladder order by position',
          )
        ).rows;
        assert.deepEqual(
          ranks.map((r) => r.drop_id),
          [two, one],
        );
        assert.deepEqual(
          ranks.map((r) => r.position),
          [1, 2],
        );
      },
    );
    await t.test(
      'replaced upload attempts cannot overwrite the current recording',
      async () => {
        await db.exec('begin');
        try {
          const retake = '20000000-0000-4000-8000-000000000004';
          await create(retake);
          await pay(retake, 'retake-payment');
          await prepare(retake);
          await db.query('select public.bought_claim_upload($1,true)', [
            retake,
          ]);
          await db.query(
            "update public.bought_drops set mux_upload_id='replacement',upload_claimed_at=null,media_state='waiting' where id=$1",
            [retake],
          );
          await ready(retake, 'outdated-ready');
          assert.equal((await row(retake)).media_state, 'waiting');
          assert.equal((await row(retake)).mux_asset_id, null);
        } finally {
          await db.exec('rollback');
        }
      },
    );
    await t.test(
      'equal bids follow payment confirmation time and reversals rerank only an open auction',
      async () => {
        await db.exec('begin');
        try {
          const tied = '20000000-0000-4000-8000-000000000005';
          await db.exec("set test.now='2026-09-08T05:02:00Z'");
          await create(tied);
          await pay(tied, 'tied-payment');
          await prepare(tied);
          await ready(tied, 'tied-ready');
          await submit(tied);
          await publish(tied);
          const result = await db.query<{ drop_id: string }>(
            'select drop_id from public.bought_ladder order by position',
          );
          assert.deepEqual(
            result.rows.map((r) => r.drop_id),
            [two, one, tied],
          );
          await pay(two, 'early-refund', 60000, 'refunded');
          const reranked = await db.query<{
            drop_id: string;
            position: number;
          }>(
            'select drop_id,position from public.bought_ladder order by position',
          );
          assert.deepEqual(
            reranked.rows.map((r) => [r.drop_id, r.position]),
            [
              [one, 1],
              [tied, 2],
            ],
          );
        } finally {
          await db.exec('rollback');
        }
      },
    );
    await t.test(
      'auction IDs stay in UTC even when the database session is in another timezone',
      async () => {
        await db.exec("set time zone 'America/Los_Angeles'");
        const result = await db.query<{ market: { auctionId: string } }>(
          'select public.bought_advance() market',
        );
        assert.equal(result.rows[0].market.auctionId, '2026-09-08');
        await db.exec("set time zone 'UTC'");
      },
    );
    await t.test(
      'cutoff is UTC server time, with exact noon closing bidding',
      async () => {
        await db.exec("set test.now='2026-09-08T11:59:59Z'");
        assert.equal(
          (
            await db.query<{ market: { phase: string } }>(
              'select public.bought_advance() market',
            )
          ).rows[0].market.phase,
          'bidding',
        );
        await db.exec("set test.now='2026-09-08T12:00:00Z'");
        assert.equal(
          (
            await db.query<{ market: { phase: string } }>(
              'select public.bought_advance() market',
            )
          ).rows[0].market.phase,
          'exposure',
        );
        await create(late, 90000);
        await assert.rejects(
          db.query('select public.bought_claim_checkout($1)', [late]),
          /Bidding opens/,
        );
      },
    );
    await t.test(
      'late processing rolls a paid entry to the next auction and preserves frozen ranks',
      async () => {
        await pay(late, 'pay-late', 90000);
        await prepare(late);
        await ready(late, 'mux-late');
        await submit(late);
        await publish(late);
        assert.equal(
          new Date((await row(late)).auction_id as string)
            .toISOString()
            .slice(0, 10),
          '2026-09-09',
        );
        const ranks = (
          await db.query<{ drop_id: string }>(
            "select drop_id from public.bought_ladder where auction_id='2026-09-08' order by position",
          )
        ).rows;
        assert.deepEqual(
          ranks.map((r) => r.drop_id),
          [two, one],
        );
      },
    );
    await t.test(
      'public RLS hides the next auction until its UTC day opens',
      async () => {
        await db.exec('set role anon');
        const result = await db.query<{ drop_id: string }>(
          'select drop_id from public.bought_ladder order by position',
        );
        assert.deepEqual(
          result.rows.map((r) => r.drop_id),
          [two, one],
        );
        await db.exec('reset role');
      },
    );
    await t.test(
      'one server-only snapshot returns the market and ordered public ladder',
      async () => {
        const result = await db.query<{
          snapshot: {
            market: { auctionId: string };
            entries: { drop_id: string; position: number }[];
          };
        }>('select public.bought_snapshot() snapshot');
        assert.equal(result.rows[0].snapshot.market.auctionId, '2026-09-08');
        assert.deepEqual(
          result.rows[0].snapshot.entries.map((entry) => [
            entry.drop_id,
            entry.position,
          ]),
          [
            [two, 1],
            [one, 2],
          ],
        );

        await db.exec('set role anon');
        await assert.rejects(
          db.query('select public.bought_snapshot()'),
          /permission denied/,
        );
        await db.exec('reset role');
      },
    );
    await t.test(
      'payment reversal removes publication and a delayed capture cannot restore it',
      async () => {
        await pay(one, 'refund-one', 50000, 'refunded');
        await pay(one, 'late-capture');
        assert.equal((await row()).payment_state, 'refunded');
        assert.equal(
          (
            await db.query(
              'select * from public.bought_ladder where drop_id=$1',
              [one],
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query('select public.bought_claim_upload($1)', [one]),
          /payment confirmation/,
        );
      },
    );
    await t.test(
      'service role can advance auctions and browser cannot',
      async () => {
        await db.exec(
          "set test.now='2026-09-09T00:00:00Z'; set role service_role",
        );
        const { rows } = await db.query<{
          market: { phase: string; opensAt: string };
        }>('select public.bought_advance() market');
        assert.equal(rows[0].market.phase, 'bidding');
        assert.match(rows[0].market.opensAt, /2026-09-09/);
        await db.exec('reset role; set role anon');
        await assert.rejects(
          db.query('select public.bought_advance()'),
          /permission denied/,
        );
        await db.exec('reset role');
      },
    );
  } finally {
    await db.close();
  }
});
