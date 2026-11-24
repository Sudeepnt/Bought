// The library from Python's side. Each command prints JSON on stdout.
//   node cli.cjs catalogue                       objects, templates, themes, portraits and the plan schema
//   node cli.cjs page JOB.json OUT.html          the video page for one ratio (see page.cjs videoPage)
//   node cli.cjs gallery '{"theme":..,"ratio":..}'  the desk's gallery: {css, html, counts}
//   node cli.cjs matrix THEME RATIO OUT.html     every template, short and long, in one theme (overflow test)
//   node cli.cjs overflow PAGE.html RATIO        render a matrix page and list every text that leaves its frame
'use strict';
const fs = require('fs');
const lib = require('./library/index.cjs');
const pages = require('./page.cjs');

async function overflow(file) {
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto('file://' + file);
    await page.evaluate(() => document.fonts.ready);
    return await page.evaluate(() => {
      document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 60000; });     // the end state of every animation
      document.querySelectorAll('svg').forEach((s) => { if (s.pauseAnimations) { s.pauseAnimations(); s.setCurrentTime(60); } });
      const bad = [];
      for (const cell of document.querySelectorAll('.cell')) {
        const v = cell.querySelector('.v'), fr = v.getBoundingClientRect();
        const tol = 1.5;
        for (const el of v.querySelectorAll('*')) {
          if (el.closest('.tk')) continue;                     // the ticker scrolls by design
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          const st = el.closest('.stage'), sr = st && st.getBoundingClientRect();
          const box = sr || fr;                                // inside the stage: must not be cut off by the stage either
          const out = r.left < box.left - tol || r.right > box.right + tol || r.top < box.top - tol || r.bottom > box.bottom + tol;
          // a clipped box (line clamp, ellipsis) is fine; text spilling out of its own box is not
          const spill = el instanceof HTMLElement && cs.overflow === 'visible' && cs.overflowX === 'visible' && (el.scrollWidth > el.clientWidth + 2) && cs.display !== 'inline';
          if (out || spill) bad.push({ template: cell.dataset.t, sample: +cell.dataset.k, text: el.textContent.trim().slice(0, 60), tag: el.tagName, why: out ? (sr ? 'cut off by the stage' : 'outside the frame') : 'spills its box' });
        }
      }
      return bad;
    });
  } finally { await browser.close(); }
}

(async () => {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'catalogue') return process.stdout.write(JSON.stringify(lib.catalogue()));
  if (cmd === 'page') {
    const r = pages.videoPage(JSON.parse(fs.readFileSync(a, 'utf8')));
    fs.writeFileSync(b, r.html);
    return process.stdout.write(JSON.stringify({ portraits: r.portraits, missing: r.missing }));
  }
  if (cmd === 'preview') return process.stdout.write(JSON.stringify(pages.preview(JSON.parse(fs.readFileSync(a, 'utf8')))));
  if (cmd === 'gallery') return process.stdout.write(JSON.stringify(pages.gallery(JSON.parse(a || '{}'))));
  if (cmd === 'matrix') { fs.writeFileSync(c, pages.matrixPage(a, b, 420)); return process.stdout.write('{}'); }
  if (cmd === 'overflow') return process.stdout.write(JSON.stringify(await overflow(a)));
  throw new Error('unknown command ' + cmd);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
