// The full run's last step: open the paper as a reader would and check that its video spot plays the explainer.
//   node paper_plays.cjs http://127.0.0.1:PORT/ STORY_ID     prints {"src", "played", "duration", "clips"}
'use strict';
const path = require('path');
const { chromium } = require(require.resolve('playwright-core', { paths: [path.resolve(__dirname, '../../../..')] }));

(async () => {
  const [url, story] = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: 'load' });
    const sel = `video[src*="explainers/${story}/16x9.mp4"]`;
    await page.waitForSelector(sel, { timeout: 20000, state: 'attached' });
    const out = await page.evaluate(async (s) => {
      const v = document.querySelector(s);
      v.muted = true;
      v.preload = 'auto';
      await v.play().catch(() => {});
      const t0 = performance.now();
      while (v.currentTime < 0.5 && performance.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 100));
      return { src: v.getAttribute('src'), played: v.currentTime, duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    }, sel);
    out.clips = await page.evaluate((id) => document.querySelectorAll('.clip').length, story);
    out.errors = errors;
    process.stdout.write(JSON.stringify(out));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
