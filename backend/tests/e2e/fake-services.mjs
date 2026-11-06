// Test rig only, never imported by the app. Loaded with `node --import` in front of the real backend:
// answers Supabase (backed by PGlite running the REAL migration), Mux and Upstash at their real URLs,
// so everything in lib/server runs unchanged. Also serves control endpoints the browser test drives.
import { readFile } from 'node:fs/promises';
import { randomUUID, createHmac } from 'node:crypto';
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
const state = { sessions: new Map(), oauth: new Map(), objects: new Map(), uploads: new Map(), assets: new Map(), muxBodies: [], sentCodes: [] };
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
  if (path === 'user') {
    const token = (headers.get('authorization') || '').split('.').pop();
    const user = state.sessions.get(token);
    return user ? json(user, 200, cors) : json({ msg: 'bad jwt' }, 401, cors);
  }
  return json({}, 200, cors);
}

function storage(url, init) {
  const path = url.pathname.replace('/storage/v1/', '');
  const method = (init.method || 'GET').toUpperCase();
  let m;
  if ((m = path.match(/^object\/upload\/sign\/([^/]+)\/(.+)$/)) && method === 'POST') {
    const object = decodeURIComponent(m[2]);
    return json({ url: `/object/upload/sign/${m[1]}/${object}?token=up-${encodeURIComponent(object)}` });
  }
  if ((m = path.match(/^object\/upload\/sign\/([^/]+)\/(.+)$/)) && method === 'PUT') {
    return (async () => { const bytes = await bytesOf(init.body, new Headers(init.headers).get('content-type')); state.objects.set(`${m[1]}/${decodeURIComponent(m[2])}`, bytes); return json({ Key: path }); })();
  }
  if ((m = path.match(/^object\/sign\/([^/]+)\/(.+)$/)) && method === 'POST') {
    return json({ signedURL: `/object/sign/${m[1]}/${m[2]}?token=view` });
  }
  if ((m = path.match(/^object\/sign\/([^/]+)\/(.+)$/)) && method === 'GET') {
    const b = state.objects.get(`${m[1]}/${decodeURIComponent(m[2])}`);
    return b ? new Response(b, { headers: { 'content-type': 'image/jpeg' } }) : json({ message: 'not found' }, 404);
  }
  if ((m = path.match(/^object\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${decodeURIComponent(m[2])}`;
    if (method === 'GET') { const b = state.objects.get(key); return b ? new Response(b) : json({ message: 'not found' }, 404); }
    if (method === 'POST' || method === 'PUT') return (async () => { state.objects.set(key, await bytesOf(init.body)); return json({ Key: key, Id: key }); })();
  }
  if (path.startsWith('object/') && method === 'DELETE') return json([]);
  return json({ message: 'unsupported ' + method + ' ' + path }, 500);
}
async function bytesOf(body, type) {
  if (type?.startsWith('multipart/')) {
    const form = await new Response(body, { headers: { 'content-type': type } }).formData();
    for (const [, v] of form.entries()) if (typeof v !== 'string') return Buffer.from(await v.arrayBuffer());
  }
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body?.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer());
  if (typeof body?.get === 'function') { for (const [, v] of body.entries()) if (typeof v !== 'string') return Buffer.from(await v.arrayBuffer()); }
  return Buffer.from(String(body ?? ''));
}

function muxApi(url, init) {
  const path = url.pathname.replace('/video/v1/', '');
  const method = (init.method || 'GET').toUpperCase();
  if (path === 'uploads' && method === 'POST') {
    const id = 'up' + randomUUID().replaceAll('-', '');
    const settings = JSON.parse(init.body);
    state.muxBodies.push(settings);
    state.uploads.set(id, settings);
    return json({ data: { id, url: `https://storage.googleapis.com/fake-mux/${id}` } }, 201);
  }
  if (path.startsWith('assets/') && method === 'GET') {
    const a = state.assets.get(decodeURIComponent(path.split('/')[1]));
    return a ? json({ data: a }) : json({}, 404);
  }
  if (path.startsWith('assets/') && method === 'DELETE') return new Response(null, { status: 204 });
  return json({ data: {} });
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
    if (url.pathname.startsWith('/storage/v1/')) return storage(url, merged);
  }
  if (url.host === 'fake.upstash.test') return json({ result: 1 });
  if (url.host === 'api.mux.com') return muxApi(url, merged);
  if (url.host === 'stream.mux.com' && /\/text\//.test(url.pathname)) {
    return new Response(url.pathname.endsWith('.vtt') ? 'WEBVTT\n\n00:00.000 --> 00:02.000\nWe help clinics book patients in one tap.\n' : 'We help clinics book patients in one tap.');
  }
  if (url.host === 'api.razorpay.com' && url.pathname === '/v1/orders') {
    if ((merged.method || 'GET') === 'GET') return json({ items: [] });
    const b = JSON.parse(merged.body);
    return json({ id: 'order_' + randomUUID().replaceAll('-', ''), amount: b.amount, currency: b.currency, receipt: b.receipt, status: 'created' });
  }
  if (url.host === 'api.stripe.com') {
    const b = new URLSearchParams(merged.body);
    return json({ id: 'cs_' + randomUUID().replaceAll('-', ''), url: 'https://checkout.stripe.com/fake', client_reference_id: b.get('client_reference_id'), amount_total: Number(b.get('line_items[0][price_data][unit_amount]')), currency: 'usd' });
  }
  return real(input, init);
};

// ---------- what the real Mux and clock would do, on command from the browser test ----------
const secret = process.env.MUX_WEBHOOK_SECRET;
async function deliver(event) {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const port = process.env.BOUGHT_BACKEND_PORT;
  return real(`http://127.0.0.1:${port}/api/bought/webhooks/mux`, { method: 'POST', headers: { 'mux-signature': `t=${t},v1=${sig}`, 'content-type': 'application/json' }, body: raw });
}
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
    if (url.pathname === '/mux-ready') {
      // Everything real Mux would do after the browser's upload finishes.
      const { rows } = await db.query("select id,mux_upload_id from public.bought_ads where mux_upload_id is not null and media_state in ('waiting','processing')");
      for (const ad of rows) {
        const assetId = 'asset' + randomUUID().replaceAll('-', '');
        const playback = 'play' + randomUUID().replaceAll('-', '');
        const seconds = Number(url.searchParams.get('duration') || 8);
        const asset = { id: assetId, upload_id: ad.mux_upload_id, passthrough: ad.id, status: 'ready', duration: seconds, playback_ids: [{ id: playback, policy: 'signed' }],
          tracks: [{ id: 'v1', type: 'video', max_width: 1280, max_height: 720 }, { id: 'a1', type: 'audio' }, { id: 'tx1', type: 'text', status: 'ready', language_code: 'en', text_source: 'generated_vod' }] };
        state.assets.set(assetId, asset);
        const a = await deliver({ id: randomUUID(), type: 'video.asset.ready', data: { id: assetId } });
        const b = await deliver({ id: randomUUID(), type: 'video.asset.track.ready', data: { id: 'tx1', type: 'text', asset_id: assetId } });
        out[ad.id] = [a.status, b.status];
      }
    } else if (url.pathname === '/query') {
      const q = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });
      out = (await db.query(q)).rows;
    } else if (url.pathname === '/shift') {
      await db.exec(`set test.shift='${Number(url.searchParams.get('seconds'))} seconds'`);
    } else if (url.pathname === '/state') {
      out = { codes: state.sentCodes, mux: state.muxBodies, objects: [...state.objects.keys()] };
    }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
}).listen(Number(process.env.FAKE_CONTROL_PORT || 8788), '127.0.0.1');
console.log('fake services ready');
