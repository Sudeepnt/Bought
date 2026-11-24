// Bought. Daily, the newspaper page served by Next.js (Pages Router, server-rendered, no framework JavaScript in the browser).
// The Python server (pipeline/server.py) stays the front door: it proxies "/" here, adds the site's security headers and
// cache rules, and serves public/index.html itself whenever this server is not running.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,          // no software names for anyone to look up, like the Python server
  compress: false,                 // the Python server compresses (and Caddy in production)
  generateEtags: true,             // a revisit with nothing new is a cheap 304
  turbopack: { root: here },
};
