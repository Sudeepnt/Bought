// Visual parity capture. Usage: node capture.mjs <baseUrl> <outDir> [--only=name,name]
// Drives the site with a frozen clock and seeded Math.random, and writes one PNG per scenario.
// Run it against the legacy site (the golden set) and against the Next.js app, then compare.js diffs the two.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [base, out, ...flags] = process.argv.slice(2);
if (!base || !out) { console.error('usage: node capture.mjs <baseUrl> <outDir> [--only=a,b]'); process.exit(2); }
const only = (flags.find(f => f.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });

const VIEWPORTS = { 390: [390, 844], 820: [820, 1180], 1180: [1180, 820], 1440: [1440, 900], 1920: [1920, 1080] };
const THEMES = ['light', 'dark'];
const FROZEN = new Date('2026-11-05T07:00:00Z');   // one hour after the 2026-11-05 issue went live

// Scenarios: [name, hash, async (page) => void  (extra steps before the shot)]
const SCENARIOS = [
  ['paper', '#paper', null],
  ['radio', '#radio', null],
  ['advertise', '#advertise', null],
  ['spec', '#spec', null],
];

function executable() {
  const root = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter(d => d.startsWith('chromium-')).sort() : [];
  for (const d of dirs.reverse()) {
    for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
      const p = path.join(root, d, rel); if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: executable() });
let n = 0;
for (const [vw, [w, h]] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', colorScheme: theme, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      let a = 123456789; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      try { localStorage.setItem('bought-theme', JSON.stringify(window.__theme || 'x')); } catch {}
    });
    await ctx.addInitScript(t => { try { localStorage.setItem('bought-theme', JSON.stringify(t)); } catch {} }, theme);
    for (const [name, hash, steps] of SCENARIOS) {
      const id = `${name}-${vw}-${theme}`;
      if (only.length && !only.includes(name)) continue;
      const page = await ctx.newPage();
      await page.clock.setFixedTime(FROZEN);
      await page.route('**/api/hit', r => r.fulfill({ status: 204, body: '' }));
      await page.goto(base.replace(/\/$/, '') + '/' + hash, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForFunction(() => !document.body.classList.contains('booting'));
      if (steps) await steps(page);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}video{visibility:hidden}' });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, id + '.png'), fullPage: true });
      await page.close(); n++;
      process.stdout.write(`\r${n} shots`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\ndone: ${n} screenshots in ${out}`);
