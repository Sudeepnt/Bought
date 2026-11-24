// Deterministic renderer: headless Chromium plays nothing on its own. Every CSS/Web animation and every SVG (SMIL) animation is
// paused, and for frame n the page is set to exactly n x 1000/fps ms, then captured. The same plan always gives the same frames.
// The frames go straight into ffmpeg (H.264, -preset veryfast) with the mixed voice and music track.
//
//   node render.cjs JOB.json          JOB: { page, out, poster, poster_at, audio, duration, fps, ratio, frames_dir? , only_frames? }
'use strict';
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const SIZE = { '9x16': { width: 1080, height: 1920 }, '16x9': { width: 1920, height: 1080 } };

/** Installed in the page: show the scene at time t (seconds) with every animation set to the right moment. */
function install() {
  const FADE = 0.35;
  const scenes = [...document.querySelectorAll('.scene')].map((el) => ({ el, start: +el.dataset.start, end: +el.dataset.end, cues: [...el.querySelectorAll('.cue')].map((c) => ({ el: c, start: +c.dataset.start, end: +c.dataset.end })) }));
  document.getAnimations().forEach((a) => a.pause());
  document.querySelectorAll('svg').forEach((s) => s.pauseAnimations && s.pauseAnimations());
  window.__setFrame = (t) => {
    scenes.forEach((s, i) => {
      const next = scenes[i + 1];
      const on = (t >= s.start && t < s.end) || (i === scenes.length - 1 && t >= s.start);
      const fading = next && t >= next.start && t < next.start + FADE;      // the outgoing scene stays under the incoming one
      s.el.classList.toggle('on', on || !!fading);
      if (!(on || fading)) return;
      const local = Math.max(0, t - s.start);
      s.el.style.zIndex = on ? 2 : 1;
      s.el.style.opacity = on && i > 0 ? Math.min(1, local / FADE).toFixed(3) : '1';
      s.el.getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = local * 1000; });
      s.el.querySelectorAll('svg').forEach((svg) => { if (svg.setCurrentTime && !svg.ownerSVGElement) { svg.pauseAnimations(); svg.setCurrentTime(local); } });
      s.cues.forEach((c) => {
        const live = local >= c.start && local < c.end;
        const p = live ? Math.min(1, (local - c.start) / 0.3) : 0, e = 1 - Math.pow(1 - p, 3);
        c.el.classList.toggle('on', live);
        c.el.style.opacity = e.toFixed(3);
        c.el.style.transform = `translateY(${((1 - e) * 1.4).toFixed(3)}cqw)`;
      });
    });
  };
}

async function main() {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const fps = job.fps || 30, size = SIZE[job.ratio];
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars', '--run-all-compositor-stages-before-draw'] });
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await page.goto('file://' + job.page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(install);
    const cdp = await page.context().newCDPSession(page);
    const shot = async (t) => {
      await page.evaluate((x) => window.__setFrame(x), t);
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, captureBeyondViewport: false });
      return Buffer.from(r.data, 'base64');
    };
    if (job.poster) fs.writeFileSync(job.poster, await shot(job.poster_at || 2.5));
    const n = Math.ceil(job.duration * fps);
    if (job.frames_dir || job.only_frames) {                 // tests: the chosen frames as files, no video
      for (const i of job.only_frames || [...Array(n).keys()]) fs.writeFileSync(`${job.frames_dir}/${String(i).padStart(5, '0')}.jpg`, await shot(i / fps));
      return;
    }
    const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
    if (job.audio) args.push('-i', job.audio);
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(fps));
    if (job.audio) args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
    args.push('-movflags', '+faststart', job.out);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg exited ' + c)) : res())));
    for (let i = 0; i < n; i++) {
      const buf = await shot(i / fps);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
