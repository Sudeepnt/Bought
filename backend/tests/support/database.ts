// Runs the real migration in PGlite with the clock replaced, the way Bought's database tests do.
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export async function testDatabase(now = '2026-11-05T05:00:00Z') {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    grant usage on schema auth,public,storage to anon,authenticated,service_role;
    create function public.test_now() returns timestamptz language sql as $$ select current_setting('test.now')::timestamptz $$;
    set test.now='${now}';
  `);
  const sql = await readFile(
    new URL(
      '../../supabase/migrations/20261105090000_newspaper_ads.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(
    sql
      .replaceAll('clock_timestamp()', 'public.test_now()')
      .replace(/\bnow\(\)/g, 'public.test_now()'),
  );
  return db;
}
