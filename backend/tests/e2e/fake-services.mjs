// Test rig only, never imported by the app. Loaded with `node --import` in front of the real backend:
// answers Supabase sign-in and database (PGlite running the REAL migration) and Upstash at their real URLs, so
// everything in lib/server runs unchanged. There is no Supabase Storage here: every file (videos, pictures) goes to the
// REAL Cloudflare R2 bucket, checked there (ffprobe, picture bytes) and shown from signed links.
// Also serves control endpoints the browser test drives.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key, email text);
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create function public.test_now() returns timestamptz language sql as $$ select now() + coalesce(nullif(current_setting('test.shift',true),''),'0 seconds')::interval $$;
`);
const sql = await readFile(new URL('../../supabase/migrations/20261105090000_newspaper_ads.sql', import.meta.url), 'utf8');
await db.exec(sql.replaceAll('clock_timestamp()', 'public.test_now()'));

const CODE = '123456';
const state = { sessions: new Map(), oauth: new Map(), checkouts: new Map(), sentCodes: [] };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

function coerce(v) { return v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v; }
function whereFrom(params, start = 1) {
  const clauses = []; const args = []; let i = start;
  for (const [col, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(col)) continue;
    if (raw.startsWith('eq.')) { clauses.push(`"${col}" = $${i++}`); args.push(coerce(raw.slice(3))); }
    else if (raw.startsWith('in.(')) {
      const vals = raw.slice(4, -1).split(',').filter(Boolean).map((x) => x.replace(/^"|"$/g, ''));
      if (!vals.length) { clauses.push('false'); continue; }
      clauses.push(`"${col}"::text in (${vals.map(() => `$${i++}`).join(',')})`); args.push(...vals);
    } else if (raw === 'not.is.null') clauses.push(`"${col}" is not null`);
    else if (raw === 'is.null') clauses.push(`"${col}" is null`);
    else throw new Error('unsupported filter ' + col + '=' + raw);
  }
  return { where: clauses.length ? ' where ' + clauses.join(' and ') : '', args };
}
const lit = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);

async function rest(url, init) {
  const parts = url.pathname.replace('/rest/v1/', '').split('/');
  const method = (init.method || 'GET').toUpperCase();
  const prefer = new Headers(init.headers).get('prefer') || '';
  const accept = new Headers(init.headers).get('accept') || '';
  const body = init.body ? JSON.parse(init.body) : undefined;
  try {
    if (parts[0] === 'rpc') {
      const keys = Object.keys(body || {});
      const call = `select public.${parts[1]}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) as r`;
      const { rows } = await db.query(call, keys.map((k) => lit(body[k])));
      return json(rows[0].r === undefined ? null : rows[0].r);
    }
    const table = `public.${parts[0]}`;
    const params = [...url.searchParams.entries()];
    const select = url.searchParams.get('select') || '*';
    const cols = select === '*' ? '*' : select.split(',').map((c) => `"${c.trim()}"`).join(',');
    if (method === 'GET') {
      const { where, args } = whereFrom(params);
      const order = url.searchParams.get('order');
      const o = order ? ' order by ' + order.split(',').map((x) => { const [c, d] = x.split('.'); return `"${c}" ${d === 'desc' ? 'desc' : 'asc'}`; }).join(',') : '';
      const lim = url.searchParams.get('limit') ? ` limit ${Number(url.searchParams.get('limit'))}` : '';
      const { rows } = await db.query(`select ${cols} from ${table}${where}${o}${lim}`, args);
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 0 && !accept.includes('nulls=stripped') && url.searchParams.get('limit') !== '1') return json({ code: 'PGRST116', message: 'no rows' }, 406);
        return json(rows[0] ?? null);
      }
      return json(rows);
    }
    if (method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const keys = Object.keys(rows[0]);
      const conflict = url.searchParams.get('on_conflict');
      const ignore = prefer.includes('ignore-duplicates');
      const merge = prefer.includes('merge-duplicates');
      const onc = conflict ? ` on conflict (${conflict}) ` + (ignore ? 'do nothing' : merge ? 'do update set ' + keys.filter((k) => k !== conflict).map((k) => `"${k}"=excluded."${k}"`).join(',') : 'do nothing') : '';
      await db.query(`insert into ${table}(${keys.map((k) => `"${k}"`).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})${onc}`, keys.map((k) => lit(rows[0][k])));
      return json(null, 201);
    }
    if (method === 'PATCH') {
      const keys = Object.keys(body);
      const { where, args } = whereFrom(params, keys.length + 1);
      const ret = prefer.includes('return=representation') ? ` returning ${cols}` : '';
      const { rows } = await db.query(`update ${table} set ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(',')}${where}${ret}`, [...keys.map((k) => lit(body[k])), ...args]);
      return json(ret ? rows : null, ret ? 200 : 204 === 204 ? 200 : 200);
    }
  } catch (error) {
    const code = /duplicate key/.test(error.message) ? '23505' : 'P0001';
    return json({ code, message: error.message, details: null, hint: null }, 400);
  }
  return json({ message: 'unsupported' }, 500);
}

const GOOGLE_EMAIL = 'gita@googlemail.example';
async function sessionFor(email) {
  let row = (await db.query('select id from auth.users where email=$1', [email])).rows[0];
  if (!row) { row = { id: randomUUID() }; await db.query('insert into auth.users(id,email) values ($1,$2)', [row.id, email]); }
  const access = 'tok-' + randomUUID();
  const user = { id: row.id, aud: 'authenticated', email, email_confirmed_at: new Date().toISOString(), is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  state.sessions.set(access, user);
  const payload = Buffer.from(JSON.stringify({ sub: row.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return { access_token: `x.${payload}.${access}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user };
}

async function auth(url, init, headers) {
  const path = url.pathname.replace('/auth/v1/', '');
  const body = init.body ? JSON.parse(init.body) : {};
  const cors = { 'x-supabase-api-version': '2024-01-01' };
  if (path === 'otp') { state.sentCodes.push(body.email); return json({}, 200, cors); }
  if (path === 'verify') {
    if (body.token !== CODE) return json({ error_code: 'otp_expired', msg: 'Token has expired or is invalid', code: 403 }, 403, cors);
    return json(await sessionFor(body.email), 200, cors);
  }
  // Google, as Supabase runs it: /authorize sends the browser to Google and back to redirect_to with a one-time code,
  // which the page trades for a session with its PKCE verifier. "Google" here signs in GOOGLE_EMAIL at once.
  if (path === 'authorize' && url.searchParams.get('provider') === 'google') {
    const code = 'gc-' + randomUUID(), back = url.searchParams.get('redirect_to');
    state.oauth.set(code, { email: GOOGLE_EMAIL, challenge: url.searchParams.get('code_challenge') });
    return new Response(null, { status: 302, headers: { location: back + (back.includes('?') ? '&' : '?') + 'code=' + code } });
  }
  if (path === 'token' && url.searchParams.get('grant_type') === 'pkce') {
    const grant = state.oauth.get(body.auth_code);
    state.oauth.delete(body.auth_code);
    const { createHash } = await import('node:crypto');
    const sent = createHash('sha256').update(body.code_verifier || '').digest('base64url');
    if (!grant || grant.challenge !== sent) return json({ error_code: 'bad_code_verifier', msg: 'invalid flow state', code: 400 }, 400, cors);
    return json(await sessionFor(grant.email), 200, cors);
  }
  if (path === 'logout') {
    // as Supabase does: the access token is revoked, so the old session can't be used again
    state.sessions.delete((headers.get('authorization') || '').split('.').pop());
    return new Response(null, { status: 204, headers: cors });
  }
  if (path === 'user') {
    const token = (headers.get('authorization') || '').split('.').pop();
    const user = state.sessions.get(token);
    return user ? json(user, 200, cors) : json({ msg: 'bad jwt' }, 401, cors);
  }
  return json({}, 200, cors);
}


const real = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  const merged = req ? { method: req.method, headers: req.headers, body: req.body ? await req.text() : undefined, ...init } : init;
  const headers = new Headers(merged.headers);
  if (url.host === 'fake.supabase.test') {
    if (merged.body instanceof Uint8Array && !url.pathname.startsWith('/storage/')) merged.body = Buffer.from(merged.body).toString();
    if (url.pathname.startsWith('/rest/v1/')) return rest(url, merged);
    if (url.pathname.startsWith('/auth/v1/')) return auth(url, merged, headers);
  }
  if (url.host === 'fake.upstash.test') return json({ result: 1 });
  if (url.host === 'api.razorpay.com' && url.pathname === '/v1/orders') {
    if ((merged.method || 'GET') === 'GET') return json({ items: [] });
    const b = JSON.parse(merged.body);
    return json({ id: 'order_' + randomUUID().replaceAll('-', ''), amount: b.amount, currency: b.currency, receipt: b.receipt, status: 'created' });
  }
  if (url.host === 'api.stripe.com') {
    // Checkout Sessions as Stripe keeps them: unpaid until the buyer pays on Stripe's page (/stripe-pay below)
    const read = url.pathname.match(/^\/v1\/checkout\/sessions\/([A-Za-z0-9_]+)$/);
    if (read && (merged.method || 'GET') === 'GET') { const cs = state.checkouts.get(read[1]); return cs ? json(cs) : json({ error: { message: 'No such checkout.session' } }, 404); }
    const b = new URLSearchParams(merged.body);
    const cs = { id: 'cs_test_' + randomUUID().replaceAll('-', ''), url: 'https://checkout.stripe.com/fake', client_reference_id: b.get('client_reference_id'), amount_total: Number(b.get('line_items[0][price_data][unit_amount]')), currency: 'usd', status: 'open', payment_status: 'unpaid', payment_intent: null };
    state.checkouts.set(cs.id, cs);
    return json(cs);
  }
  return real(input, init);
};

// ---------- control endpoints for the browser test ----------
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let out = {};
  try {
    if (url.pathname.startsWith('/sb/')) {
      // The browser's Supabase client, relayed by the test into the same fake.
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
      const r = await globalThis.fetch('https://fake.supabase.test' + req.url.slice(3), { method: req.method, headers, body: chunks.length ? new Uint8Array(Buffer.concat(chunks)) : undefined });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json', ...(r.headers.get('location') ? { location: r.headers.get('location') } : {}) });
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (url.pathname === '/query') {
      const q = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });
      out = (await db.query(q)).rows;
    } else if (url.pathname === '/stripe-pay') {
      // the buyer completes every open checkout on Stripe's page; no webhook is sent
      for (const cs of state.checkouts.values()) if (cs.payment_status === 'unpaid') Object.assign(cs, { status: 'complete', payment_status: 'paid', payment_intent: 'pi_' + randomUUID().replaceAll('-', '').slice(0, 20) });
      out = { paid: [...state.checkouts.values()].filter((c) => c.payment_status === 'paid').length };
    } else if (url.pathname === '/shift') {
      await db.exec(`set test.shift='${Number(url.searchParams.get('seconds'))} seconds'`);
    } else if (url.pathname === '/state') {
      out = { codes: state.sentCodes };
    }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
}).listen(Number(process.env.FAKE_CONTROL_PORT || 8788), '127.0.0.1');
console.log('fake services ready');
