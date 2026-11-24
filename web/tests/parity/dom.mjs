// Structural parity: the Next.js page and public/index.html must be the same document, node for node.
// Usage: node dom.mjs <legacyUrl> <nextUrl>
// Compares, with a frozen clock and seeded Math.random: (1) the markup as served (scripts blocked), (2) the DOM after
// boot, in every view. Ignored only: comments, the #__next wrapper, #boot-data, and Next's data-next-head markers and
// React's image preload hint. Whitespace-only text is compared where it can render (inline formatting contexts).
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const [legacy, next] = process.argv.slice(2);
if (!legacy || !next) { console.error('usage: node dom.mjs <legacyUrl> <nextUrl>'); process.exit(2); }
const FROZEN = new Date('2026-11-05T07:00:00Z');

function executable() {
  const root = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const d of (fs.existsSync(root) ? fs.readdirSync(root) : []).filter(d => d.startsWith('chromium-')).sort())
    for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
      const p = path.join(root, d, rel); if (fs.existsSync(p)) return p;
    }
}

/* the document as a list of lines, one per node, in order */
function snapshot() {
  const out = [];
  const skipAttr = n => n === 'data-next-head' || n === 'data-n-css';
  /* a whitespace-only text node counts only if the browser lays it out as a visible space */
  const rendersSpace = ws => { const r = document.createRange(); r.selectNodeContents(ws); return [...r.getClientRects()].some(q => q.width > 0); };
  function walk(node, depth, parentEl) {
    if (node.nodeType === 8) return;
    if (node.nodeType === 3) {
      const t = node.data;
      if (!t.trim()) { if (rendersSpace(node)) out.push(`${' '.repeat(depth)}#ws`); return; }
      out.push(`${' '.repeat(depth)}#text ${JSON.stringify(t.replace(/\s+/g, ' '))}`); return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    if (el.id === '__next') { for (const c of el.childNodes) walk(c, depth, parentEl); return; }
    if (el.id === 'boot-data' || el.hasAttribute('data-n-css')) return;
    if (el.tagName === 'LINK' && el.rel === 'preload' && el.getAttribute('as') === 'image') return;
    const attrs = [...el.attributes].filter(a => !skipAttr(a.name)).map(a => `${a.name}=${JSON.stringify(a.value)}`).sort();
    out.push(`${' '.repeat(depth)}<${el.tagName.toLowerCase()} ${attrs.join(' ')}>`);
    for (const c of (el.tagName === 'TEMPLATE' ? el.content : el).childNodes) walk(c, depth + 1, el);
  }
  walk(document.documentElement, 0, null);
  return out;
}

/* <head> as a set (Next.js puts charset, viewport and title first). public/index.html writes its preloads, stylesheets,
   theme-color and <noscript> after </head>, so the parser leaves them at the top of <body>; the Next.js page puts them in
   <head> where they belong. Both count as the head here, everything else in <body> must match in order. */
const headSet = lines => {
  const chunks = [];
  for (const l of lines) /^ {0,2}\S/.test(l) || !chunks.length ? chunks.push([l]) : chunks.at(-1).push(l);
  const head = [], body = [];
  let inBody = false;
  for (const c of chunks) {
    if (c[0].startsWith(' <body')) { inBody = true; body.push(c[0]); continue; }
    if (c[0].startsWith(' <head')) continue;
    if (!inBody || /^  <(meta|link|noscript|title) /.test(c[0])) head.push(c.join('\n')); else body.push(...c);
  }
  return { head: head.filter(c => c.startsWith('  <')).sort().join('\n').split('\n'), body };
};

function diff(a, b, label) {
  let bad = 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n && bad < 15; i++) if (a[i] !== b[i]) { bad++; console.log(`  ${label} line ${i}:\n    legacy: ${a[i]}\n    next:   ${b[i]}`); }
  return bad;
}

const browser = await chromium.launch({ executablePath: executable() });
let failures = 0;
for (const scripts of [false, true]) {
  for (const view of scripts ? ['paper', 'radio', 'advertise', 'spec'] : ['paper']) {
    const snaps = [];
    for (const base of [legacy, next]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await ctx.addInitScript(() => { let a = 123456789; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(FROZEN);
      await page.route('**/api/hit', r => r.fulfill({ status: 204, body: '' }));
      if (!scripts) await page.route('**/*.js*', r => r.abort());
      await page.goto(base.replace(/\/$/, '') + '/#' + view, { waitUntil: 'load' });
      if (scripts) await page.waitForFunction(() => !document.body.classList.contains('booting'));
      await page.waitForTimeout(scripts ? 1500 : 300);
      snaps.push(headSet(await page.evaluate(snapshot)));
      await ctx.close();
    }
    const label = `${scripts ? 'booted' : 'served'} #${view}`;
    if (process.env.SHOW) for (const s of snaps) console.log(s.body.slice(0, +process.env.SHOW).join('\n'), '\n---');
    const bad = diff(snaps[0].head, snaps[1].head, label + ' <head>') + diff(snaps[0].body, snaps[1].body, label + ' <body>');
    console.log(`${bad ? 'DIFF' : 'same'}  ${label}  (${snaps[1].body.length} nodes)`);
    failures += bad;
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
