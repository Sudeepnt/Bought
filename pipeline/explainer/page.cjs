// HTML pages built from the library: the video page the renderer drives, and the desk's gallery.
'use strict';
const lib = require('./library/index.cjs');
const samples = require('./library/samples.cjs');
const { esc } = require('./library/objects/_draw.cjs');

const VIDEO_CSS = 'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}.scene{position:absolute;inset:0;visibility:hidden}.scene.on{visibility:visible}';

/**
 * The page for one video. job: { plan, theme, ratio, story: {section, n, total, next}, timing: [{start, end, cues: [{text, start, end}]}] }
 * timing is in seconds from the start of the video; cue times are from the start of their scene.
 */
function videoPage(job) {
  const theme = lib.theme(job.theme);
  const used = [], missing = [];
  const scenes = job.plan.scenes.map((sc, i) => {
    const tm = job.timing[i];
    const fr = lib.frame(sc, theme, job.ratio, { story: job.story, cues: tm.cues, video: true });
    fr.portraits.forEach((p) => used.includes(p.slug) || used.push(p.slug));
    fr.missing.forEach((n) => missing.includes(n) || missing.push(n));
    return `<div class="scene" data-start="${tm.start}" data-end="${tm.end}">${fr.html}</div>`;
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${lib.css([theme], 'file')}\n${VIDEO_CSS}</style></head><body>${scenes.join('')}</body></html>`;
  return { html, portraits: used, missing };
}

/** The desk's gallery: every template in one theme and ratio, every object, every theme, and the portraits. Plain HTML and CSS, no script. */
function gallery({ theme: themeId, ratio = '9x16', story } = {}) {
  const theme = lib.theme(themeId);
  const st = story || { section: 'Technology', n: 9, total: 50, next: ['Chipmakers race to build new plants', 'A new law on AI starts today'] };
  const tile = (title, sub, html) => `<figure class="xg"><div class="xv">${html}</div><figcaption><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</figcaption></figure>`;
  const missing = new Set();
  const frame = (sc, t, r) => { const fr = lib.frame(sc, t, r, { story: st }); fr.missing.forEach((m) => missing.add(m)); return fr.html; };
  const templates = [...lib.SCENES.values()].map((t) => tile(t.id, t.summary, frame(samples[t.id][0], theme, ratio))).join('');
  const long = [...lib.SCENES.values()].map((t) => tile(t.id + ' · long text', 'clamped, never overflowing', frame(samples[t.id][1], theme, ratio))).join('');
  const themes = lib.THEMES.map((t) => tile(`${String(t.n).padStart(2, '0')} ${t.name}`, t.description, frame(samples.object[0], t, ratio))).join('');
  const objects = [...lib.OBJECTS.values()].map((o) => {
    const hot = Object.keys(o.parts).slice(0, 1);
    const sc = { template: 'object', object: o.id, highlight: hot, narration: `${o.id}: ${Object.keys(o.parts).join(', ')}` };
    return tile(o.id, `${o.family} · parts: ${Object.keys(o.parts).join(', ')}`, frame(sc, theme, ratio));
  }).join('');
  const portraits = lib.portraits.all.map((p) => tile(p.name, p.attribution, frame({ template: 'object', object: 'avatar', person: { name: p.name }, highlight: ['ring'], narration: p.name }, theme, ratio))).join('');
  const css = lib.css(lib.THEMES, 'site') + `\n.xgrid{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(${ratio === '16x9' ? 420 : 220}px,1fr));margin:12px 0 30px}.xg{margin:0;min-width:0}.xg figcaption{margin-top:8px;font-size:13px;line-height:1.35}.xg figcaption b{display:block;font-size:14px}.xg figcaption span{color:#6f6a61}`;
  const html = `<h2>Templates · ${esc(theme.name)} · ${esc(ratio)}</h2><div class="xgrid">${templates}</div>`
    + `<h2>The same templates with long text</h2><div class="xgrid">${long}</div>`
    + `<h2>All ${lib.THEMES.length} themes</h2><div class="xgrid">${themes}</div>`
    + `<h2>All ${lib.OBJECTS.size} drawings · ${esc(theme.name)}</h2><div class="xgrid">${objects}</div>`
    + `<h2>Portraits (${lib.portraits.all.length})</h2>${portraits ? `<div class="xgrid">${portraits}</div>` : '<p class="sub">None yet. Add one with <code>python -m pipeline explainer portrait add</code>.</p>'}`;
  return { css, html, counts: { objects: lib.OBJECTS.size, templates: lib.SCENES.size, themes: lib.THEMES.length, portraits: lib.portraits.all.length } };
}

/** Every template in every theme and ratio, short and long text: one page per theme and ratio, for the overflow test. */
function matrixPage(themeId, ratio, size) {
  const theme = lib.theme(themeId);
  const story = { section: 'Founders & startups', n: 49, total: 50, next: ['A long upcoming headline that would scroll in the ticker', 'Another'] };
  const frames = [...lib.SCENES.values()].flatMap((t) => samples[t.id].map((sc, k) => `<div class="cell" data-t="${t.id}" data-k="${k}">${lib.frame(sc, theme, ratio, { story }).html}</div>`));
  const w = ratio === '16x9' ? size * 16 / 9 : size * 9 / 16;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${lib.css([theme], 'file')}\nbody{margin:0;display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#888}.cell{width:${w}px}.v *{animation-play-state:paused!important}</style></head><body>${frames.join('')}</body></html>`;
}

/** The desk's preview of one story's plan: every scene in both ratios, live CSS animation, no script. */
function preview({ plan, theme: themeId, story }) {
  const theme = lib.theme(themeId);
  const missing = new Set();
  const row = (ratio) => plan.scenes.map((sc, i) => {
    try { const fr = lib.frame(sc, theme, ratio, { story }); fr.missing.forEach((m) => missing.add(m)); return `<figure class="xg"><div class="xv">${fr.html}</div><figcaption><b>${i + 1} · ${esc(sc.template)}</b></figcaption></figure>`; }
    catch (e) { return `<figure class="xg"><figcaption><b>${i + 1} · ${esc(sc.template)}</b><span>cannot be drawn: ${esc(e.message)}</span></figcaption></figure>`; }
  }).join('');
  const css = lib.css([theme], 'site') + `\n.xgrid{display:grid;gap:18px;margin:10px 0 24px}.xgrid.t{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}.xgrid.w{grid-template-columns:repeat(auto-fill,minmax(380px,1fr))}.xg{margin:0;min-width:0}.xg figcaption{margin-top:6px;font-size:13px}.xg figcaption span{display:block;color:#7c2b1b}`;
  return { css, html: `<h2>9:16</h2><div class="xgrid t">${row('9x16')}</div><h2>16:9</h2><div class="xgrid w">${row('16x9')}</div>`, missing: [...missing] };
}

module.exports = { videoPage, gallery, matrixPage, preview };
