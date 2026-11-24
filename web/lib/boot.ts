/* What the page needs before it can draw, read on the server so the browser doesn't wait on three requests in a row:
   issues/index.json, the newest issues/<date>/issue.json, and the ads backend's public config (api/bought/config).
   Each is handed to the page under the exact URL js/issue.js and js/live.js would fetch, and used once; anything missing
   or unreadable is simply left out and the page fetches it itself, exactly as public/index.html does. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

export const PUBLIC_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.BOUGHT_PUBLIC || path.join(process.cwd(), "..", "public"));
const BACKEND_PORT = Number(process.env.BOUGHT_BACKEND_PORT || 8787);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Cached = { key: string; value: unknown };
const files = new Map<string, Cached>();

/** A JSON file under public/, parsed once per change (size + mtime), or undefined. */
function readJSON(rel: string): unknown {
  const file = path.join(PUBLIC_DIR, rel);
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > 4_000_000) return undefined;
    const key = `${st.size}:${st.mtimeMs}`;
    const hit = files.get(rel);
    if (hit && hit.key === key) return hit.value;
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    files.set(rel, { key, value });
    return value;
  } catch {
    files.delete(rel);
    return undefined;
  }
}

/** The same newest issue js/issue.js picks: idx.latest, else the first date. */
function latestOf(idx: unknown): string | null {
  if (!idx || typeof idx !== "object") return null;
  const o = idx as { latest?: unknown; dates?: unknown };
  const dates = Array.isArray(o.dates) ? o.dates : [];
  const d = o.latest || dates[0] || null;
  return typeof d === "string" && DATE.test(d) ? d : null;
}

let cfgCache: { at: number; value: unknown } | null = null;

/** GET /api/bought/config from the backend (public, the same for every reader), kept 30 s. Undefined if it doesn't answer quickly. */
function backendConfig(): Promise<unknown> {
  if (cfgCache && Date.now() - cfgCache.at < 30_000) return Promise.resolve(cfgCache.value);
  return new Promise(resolve => {
    const req = http.get({ host: "127.0.0.1", port: BACKEND_PORT, path: "/api/bought/config", timeout: 800 }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(undefined); }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => { body += c; if (body.length > 65536) req.destroy(); });
      res.on("end", () => {
        try { const value = JSON.parse(body); cfgCache = { at: Date.now(), value }; resolve(value); } catch { resolve(undefined); }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(undefined));
  });
}

/** The live client's module and its chunks (js/live/), so the browser can fetch them while it reads the page. */
let liveCache: { key: string; urls: string[] } | null = null;
function liveModules(): string[] {
  try {
    const liveJs = path.join(PUBLIC_DIR, "js", "live.js");
    const st = fs.statSync(liveJs);
    const key = `${st.size}:${st.mtimeMs}`;
    if (liveCache && liveCache.key === key) return liveCache.urls;
    const m = /import\("\.\/(live\/client\.js(?:\?v=\w+)?)"\)/.exec(fs.readFileSync(liveJs, "utf8"));
    const urls: string[] = [];
    if (m) {
      urls.push("js/" + m[1]);
      const client = fs.readFileSync(path.join(PUBLIC_DIR, "js", "live", "client.js"), "utf8");
      // its chunks, static or import()ed: connect() imports Supabase's at boot, before the page is drawn
      for (const c of client.matchAll(/(?:from\s*|import\(\s*)["']\.\/(c-[\w-]+\.js)["']/g)) urls.push("js/live/" + c[1]);
    }
    liveCache = { key, urls: [...new Set(urls)] };
    return liveCache.urls;
  } catch {
    return [];
  }
}

export type Boot = {
  data: Record<string, unknown>;     // URL as the page fetches it → its JSON
  modules: string[];                 // module URLs to preload (only when the ads are live)
  preconnect: string | null;         // the sign-in service's origin (only when live)
};

export async function boot(): Promise<Boot> {
  const data: Record<string, unknown> = {};
  const cfgP = backendConfig();
  const idx = readJSON("issues/index.json");
  if (idx !== undefined) {
    data["issues/index.json"] = idx;
    const latest = latestOf(idx);
    const issue = latest ? readJSON(`issues/${latest}/issue.json`) : undefined;
    if (latest && issue !== undefined) data[`issues/${latest}/issue.json`] = issue;
  }
  const cfg = await cfgP;
  let modules: string[] = [], preconnect: string | null = null;
  if (cfg && typeof cfg === "object") {
    data["api/bought/config"] = cfg;
    const c = cfg as { live?: unknown; supabaseUrl?: unknown };
    if (c.live) {
      modules = liveModules();
      if (typeof c.supabaseUrl === "string" && /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/?$/.test(c.supabaseUrl)) preconnect = c.supabaseUrl.replace(/\/$/, "");
    }
  }
  return { data, modules, preconnect };
}

/** public/index.html's own fonts, stylesheets and scripts, in its order, so their ?v= is bumped in one place. */
export type Assets = { fonts: string[]; styles: string[]; scripts: string[] };
let assetsCache: { key: string; value: Assets } | null = null;
export function assets(): Assets {
  const file = path.join(PUBLIC_DIR, "index.html");
  const st = fs.statSync(file);                    // the page cannot be served without it: let it throw
  const key = `${st.size}:${st.mtimeMs}`;
  if (assetsCache && assetsCache.key === key) return assetsCache.value;
  const html = fs.readFileSync(file, "utf8");
  const local = (u: string) => /^(js|fonts|styles)[\w./-]*(\?v=\w+)?$/.test(u);
  const all = (re: RegExp) => [...html.matchAll(re)].map(m => m[1]).filter(local);
  const value = {
    fonts: all(/<link rel="preload" href="([^"]+)" as="font"/g),
    styles: all(/<link rel="stylesheet" href="([^"]+)"/g),
    scripts: all(/<script src="([^"]+)"><\/script>/g),
  };
  if (!value.scripts.length || !value.styles.length) throw new Error("public/index.html: no scripts or stylesheets found");
  assetsCache = { key, value };
  return value;
}

/** JSON that is safe inside <script type="application/json">: no "</script>", no "<!--", no line separators. */
export function scriptJSON(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}
