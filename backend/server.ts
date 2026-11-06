// Runs the backend as a plain Node process on the VPS. `pipeline serve` starts it and forwards
// /api/bought/* here, so the site, /admin and this API all answer on one address.
import { createServer } from 'node:http';
import { handleApi, tick } from './lib/server/api';
import { isLive, setting } from './lib/server/config';

const PORT = Number(process.env.BOUGHT_BACKEND_PORT ?? 8787);
const MAX_BODY = 2 * 1024 * 1024;

const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk as Buffer);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (typeof value === 'string') headers.set(key, value);
    // The address is fixed by configuration. A request's Host header is never trusted.
    const base = setting('APP_ORIGIN') ?? `http://127.0.0.1:${PORT}`;
    const request = new Request(new URL(req.url ?? '/', base), {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handleApi(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"Something went wrong."}');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`bought backend on 127.0.0.1:${PORT}, ${isLive() ? 'live' : 'not connected yet'}`);
});

// Started by `pipeline serve`: stop when it stops, even if it was killed outright.
if (process.env.BOUGHT_BACKEND_PARENT) {
  process.stdin.on('end', () => process.exit(0));
  process.stdin.resume();
}

// Closing, settling and the 05:00 ad swap run on this clock. The database decides what is due,
// so a late or repeated run cannot change a result.
setInterval(() => {
  if (!isLive()) return;
  tick().catch((error: unknown) =>
    console.error('BOUGHT tick is pending:', error instanceof Error ? error.name : 'UnknownError'),
  );
}, 30_000);
