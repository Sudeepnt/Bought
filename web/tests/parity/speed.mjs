// Load time: the moment the paper is drawn (body loses .booting), the first visit on a slow phone network and a repeat
// visit with a warm cache. Usage: node speed.mjs <label=url> [<label=url> ...] [--runs=5]
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const runs = +(args.find(a => a.startsWith('--runs=')) || '--runs=5').slice(7);
const sites = args.filter(a => !a.startsWith('--')).map(a => a.split(/=(.+)/));
function executable() {
  const root = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const d of (fs.existsSync(root) ? fs.readdirSync(root) : []).filter(d => d.startsWith('chromium-')).sort())
    for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
      const p = path.join(root, d, rel); if (fs.existsSync(p)) return p;
    }
}
const NETS = {
  'slow 4G': { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 },
  'fast 4G': { latency: 40, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 },
};
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
const browser = await chromium.launch({ executablePath: executable() });
for (const [net, cond] of Object.entries(NETS)) {
  for (const [label, url] of sites) {
    const cold = [], warm = [], bytes = [];
    for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, ...cond });
      let got = 0; cdp.on('Network.loadingFinished', e => { got += e.encodedDataLength; });
      for (const run of [cold, warm]) {
        const t0 = Date.now();
        await page.goto(url, { waitUntil: 'commit' });
        await page.waitForFunction(() => !document.body.classList.contains('booting'), null, { timeout: 60000, polling: 16 });
        run.push(Date.now() - t0);
        if (run === cold) { await page.waitForTimeout(1500); bytes.push(got); }
      }
      await ctx.close();
    }
    console.log(`${net.padEnd(8)} ${label.padEnd(7)} first visit ${String(median(cold)).padStart(5)} ms   repeat ${String(median(warm)).padStart(5)} ms   ${Math.round(median(bytes) / 1024)} KB on first visit`);
  }
}
await browser.close();
