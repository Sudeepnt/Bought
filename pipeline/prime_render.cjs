// Renders one Prime video: a themed 16:9 news frame (assets/prime_themes.css) driven frame by frame in headless Chromium,
// then muxed with the voice track by ffmpeg. No journalist: the picture is photos in the frame's monitor, headline,
// ticker and boxes. Usage: node prime_render.cjs SPEC.json
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/sudeepnt/Documents/ATit-Quote/node_modules/playwright-core');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const FPS = 25, SHOT = spec.shot || 2.6;
const A = path.join(__dirname, 'assets');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fontsCss = fs.readFileSync(path.join(A, 'fonts/fonts.css'), 'utf8').replace(/url\((f\d+\.woff2)\)/g, `url(file://${A}/fonts/$1)`);
// Section colour: every Prime video keeps its layout, but its coloured parts take the hue of the story's section (the same colours the
// site uses), so a Technology story is teal, an AI story purple, and so on. Neutrals (white, cream, black, greys) stay as they are.
const SECTION = { // hue (deg), and the most saturated a colour may be (0-1); from the site's dark-mode section colours
  'ai': [249, 0.72], 'technology': [190, 0.62], 'tech business': [10, 0.72], 'business': [10, 0.72],
  'founders & startups': [41, 0.68], 'product launches': [146, 0.55], 'tech geopolitics': [322, 0.55] };
function toHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function fromHsl(h, s, l) { const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
function recolor(css, theme, cat) {
  const sec = SECTION[String(cat).toLowerCase()]; if (!sec) return css;
  const tone = ([r, g, b], bg) => {   // bg: a background colour always carries the section colour, even a white or black one
    const [h, s, l] = toHsl(r, g, b);
    if (bg) return fromHsl(sec[0], Math.max(Math.min(s, sec[1]), 0.5), l > 0.5 ? 0.68 : Math.max(l, 0.07));   // never white or grey: a light background becomes a clear tone of the section colour
    if (s < 0.18 || l < 0.04 || l > 0.9) return null;      // neutral: keep
    return fromHsl(sec[0], Math.min(s, sec[1]), l);
  };
  const shift = (text, bg) => text
    .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (m, hex) => { if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
      return tone([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)], bg) || m; })
    .replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)((?:,\s*[\d.]+)?)\)/g, (m, r, g, b, a) => { const c = tone([+r, +g, +b], bg); return c ? `${c}${a ? '' : ''}`.replace(/^(#.*)$/, (x) => a ? `rgba(${parseInt(x.slice(1, 3), 16)},${parseInt(x.slice(3, 5), 16)},${parseInt(x.slice(5, 7), 16)}${a})` : x) : m; });
  const line = new RegExp('^\\.v' + theme + '(?![0-9]).*$', 'gm');   // every rule of this theme, not just its colour variables
  return css.replace(line, (rule) => shift(rule, false).replace(/hue-rotate\(-?\d+deg\)/, `hue-rotate(${Math.round(sec[0] - 40)}deg)`).replace(/--bg:[^;]*;/, (seg) => shift(seg, true)));
}
const themeCss = recolor(fs.readFileSync(path.join(A, 'prime_themes.css'), 'utf8'), spec.theme, spec.cat);
const ticker = spec.next.join('   |   ') + '   |   ';
const html = `<!doctype html><meta charset="utf-8"><style>${fontsCss}\n${themeCss}</style>
<div class="f v${spec.theme}">
  <div class="mon">${spec.images.map((p, k) => { const n = (spec.frames || [])[k] || 0; return `<img class="art" ${n ? `data-dir="file://${p}" data-n="${n}" src="file://${p}/0001.jpg"` : `src="file://${p}"`} style="object-position:${(spec.positions || [])[k] || '50% 50%'}">`; }).join('')}${(spec.credits || []).some(Boolean) ? '<span class="cred" style="position:absolute;right:.5cqw;bottom:.5cqw;z-index:5;padding:.25cqw .6cqw;background:rgba(0,0,0,.6);color:#fff;font:400 max(6px,.95cqw)/1.2 var(--sans);border-radius:2px;white-space:nowrap"></span>' : ''}</div>
  <span class="cnt">${spec.n} / 50</span><span class="live">LIVE</span><span class="logo">BOUGHT.</span><span class="clk">${spec.clock || '06:30 IST'}</span>
  <div class="brk"><b>BREAKING NEWS</b><span>${esc(spec.h)}</span></div>
  <div class="lt"><b class="tag">${esc(spec.cat)}</b><div class="head">${esc(spec.h)}</div><div class="sub">${esc(spec.s)}</div></div>
  <div class="up"><b>UP NEXT</b><div><span>${esc(spec.next[0])}</span><span>${esc(spec.next[1])}</span></div></div>
  <div class="src"><small>SOURCE</small><b>${esc(spec.src)}</b></div>
  <div class="tick"><b>NEWS</b><span><i>${esc(ticker)}${esc(ticker)}${esc(ticker)}</i></span></div>
</div>`;
const SET_FRAME = `(() => {
  const imgs = [...document.querySelectorAll('.mon .art')];
  const parts = ['.mon', '.logo', '.live', '.clk', '.cnt', '.lt', '.brk', '.up', '.src', '.tick'].map((s) => document.querySelector(s));
  const tick = document.querySelector('.tick span i');
  const cred = document.querySelector('.cred'), credits = ${JSON.stringify(spec.credits || [])};
  window.setFrame = async (t) => {
    const shot = Math.floor(t / ${SHOT}), local = (t - shot * ${SHOT}) / ${SHOT}, cur = shot % imgs.length, prev = (shot + imgs.length - 1) % imgs.length;
    const clip = imgs[cur];
    if (clip.dataset.n) {   // a video clip: show the frame for this moment in the shot
      const f = Math.floor((t - shot * ${SHOT}) * 25) % +clip.dataset.n + 1;
      clip.src = clip.dataset.dir + '/' + String(f).padStart(4, '0') + '.jpg';
      await clip.decode().catch(() => {});
    }
    if (cred) { cred.textContent = credits[cur] || ''; cred.style.visibility = credits[cur] ? 'visible' : 'hidden'; }
    const dir = shot % 2 ? -1 : 1, fade = shot === 0 ? 1 : Math.min(1, (t - shot * ${SHOT}) / 0.22);
    imgs.forEach((im, k) => {
      if (k === cur) { im.style.opacity = fade; im.style.zIndex = 2;
        im.style.transform = 'scale(' + (dir > 0 ? 1.06 + 0.2 * local : 1.26 - 0.2 * local) + ') translateX(' + (dir * (local - 0.5) * 3) + '%)'; }
      else if (k === prev && fade < 1) { im.style.opacity = 1; im.style.zIndex = 1; }
      else { im.style.opacity = 0; im.style.zIndex = 0; }
    });
    parts.forEach((el, i) => { const p = Math.min(1, Math.max(0, (t - i * 0.06) / 0.35)), e = 1 - Math.pow(1 - p, 3);
      el.style.opacity = e; el.style.translate = '0 ' + ((1 - e) * 16) + 'px'; });
    tick.style.transform = 'translateX(' + (-((t * 110) % (tick.scrollWidth / 3))) + 'px)';
  };
})()`;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const htmlPath = spec.out + '.page.html';
  fs.writeFileSync(htmlPath, html);
  await page.goto('file://' + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.evaluate(SET_FRAME);
  await page.evaluate((t) => window.setFrame(t), 1.0);
  await page.screenshot({ path: spec.poster, type: 'jpeg', quality: 85 });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', spec.wav,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', spec.out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  const n = Math.ceil(spec.dur * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.setFrame(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; await browser.close(); fs.unlinkSync(htmlPath);
})().catch((e) => { console.error(e); process.exit(1); });
