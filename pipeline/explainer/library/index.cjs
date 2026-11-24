// The explainer library: drawings (objects/), scene templates (scenes/), themes (themes/*.json) and portraits (portraits/).
// Built once, reused by every video. The AI only picks from what is here (the plan schema's enums come from this file)
// and writes the words; it never draws anything.
'use strict';
const fs = require('fs');
const path = require('path');
const { esc, arrow, initials } = require('./objects/_draw.cjs');
const { marked } = require('./scenes/_kit.cjs');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..', '..');
const RATIOS = ['9x16', '16x9'];
const FAMILIES = { tech: 'Tech', infra: 'Infrastructure', business: 'Business and policy', people: 'People' };

/* ---------- objects ---------- */
const OBJECTS = new Map();
for (const fam of Object.keys(FAMILIES)) {
  for (const o of require(`./objects/${fam}.cjs`)) {
    if (OBJECTS.has(o.id)) throw new Error(`object ${o.id} twice`);
    for (const p of Object.keys(o.parts)) if (!o.anchors[p]) throw new Error(`object ${o.id}: part ${p} has no anchor`);
    OBJECTS.set(o.id, { ...o, family: fam });
  }
}

/* ---------- scene templates ---------- */
const SCENES = new Map();
for (const file of ['core', 'charts', 'world']) for (const t of require(`./scenes/${file}.cjs`)) SCENES.set(t.id, t);

/* ---------- themes ---------- */
const THEMES = fs.readdirSync(path.join(DIR, 'themes')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, 'themes', f), 'utf8')));

/* ---------- portraits ---------- */
const slug = (name) => String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function loadPortraits(dir = path.join(DIR, 'portraits')) {
  const all = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const svgPath = path.join(dir, f.replace(/\.json$/, '.svg'));
      if (!fs.existsSync(svgPath)) continue;
      const svg = fs.readFileSync(svgPath, 'utf8');
      const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 100 100';
      const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      all.push({ ...meta, viewBox: vb, body });
    }
  }
  const index = new Map();
  for (const p of all) for (const n of [p.name, ...(p.aliases || [])]) index.set(slug(n), p);
  return { all, find: (name) => index.get(slug(name)) || null };
}
let PORTRAITS = loadPortraits();

/* ---------- the catalogue and the plan schema ---------- */
const lib = {
  RATIOS, ROOT, OBJECTS, SCENES, THEMES, slug,
  get portraits() { return PORTRAITS; },
  reloadPortraits(dir) { PORTRAITS = loadPortraits(dir); return PORTRAITS; },
  objectIds: () => [...OBJECTS.keys()],
  partNames: () => [...new Set([...OBJECTS.values()].flatMap((o) => Object.keys(o.parts)))].sort(),
  templateIds: () => [...SCENES.keys()],
  theme(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; },
};

const CARD = {
  type: 'object', description: 'optional source card: what a source said, shown beside the drawing',
  properties: { title: { type: 'string', description: 'short heading, e.g. "Cloud region · Tuesday"' }, quote: { type: 'string', description: 'exact words from a source article' }, highlight: { type: 'string', description: 'part of the quote to mark' }, source: { type: 'string', description: 'where it is from' } },
  required: ['title', 'quote', 'source'], additionalProperties: false,
};
lib.sceneSchema = (t) => {
  const fields = t.fields(lib);
  const props = { template: { type: 'string', const: t.id } };
  if (t.id !== 'end_card') { props.narration = { type: 'string', description: 'what the voice says in this scene: 1-3 short sentences, every fact from the sources' }; props.card = CARD; }
  Object.assign(props, fields);
  return { type: 'object', properties: props, required: ['template', ...(t.id === 'end_card' ? [] : ['narration']), ...t.required], additionalProperties: false };
};
lib.planSchema = () => ({
  type: 'object', additionalProperties: false,
  properties: {
    story_id: { type: 'string' }, section: { type: 'string' }, duration_target_s: { type: 'integer' },
    scenes: { type: 'array', items: { anyOf: [...SCENES.values()].map(lib.sceneSchema) } },
  },
  required: ['story_id', 'section', 'duration_target_s', 'scenes'],
});
lib.catalogue = () => ({
  objects: [...OBJECTS.values()].map((o) => ({ id: o.id, family: o.family, tags: o.tags, parts: o.parts })),
  templates: [...SCENES.values()].map((t) => ({ id: t.id, summary: t.summary, fields: t.fields(lib), required: t.required })),
  themes: THEMES.map((t) => ({ id: t.id, n: t.n, name: t.name, description: t.description, layout: t.layout })),
  portraits: PORTRAITS.all.map((p) => ({ slug: p.slug, name: p.name, aliases: p.aliases || [], credit: p.attribution })),
  schema: lib.planSchema(),
});

/* ---------- drawing ---------- */
lib.drawObject = (id, opts = {}, ctx = {}) => {
  const def = OBJECTS.get(id);
  if (!def) throw new Error(`no object ${id}`);
  const hot = new Set((opts.highlight || []).filter((p) => def.parts[p]));
  const o = { hot, labels: opts.labels || {}, person: opts.person, portraits: ctx.portraits || PORTRAITS, used: ctx.used || (() => {}), missing: ctx.missing || (() => {}), level: opts.level, direction: opts.direction };
  let svg = def.draw(o);
  for (const [a, b] of opts.arrows || []) if (def.anchors[a] && def.anchors[b] && a !== b) svg += arrow(def.anchors[a], def.anchors[b]);
  return `<svg class="dg obj-${id}${def.float ? ' float' : ''}" viewBox="${def.viewBox}" aria-hidden="true">${svg}</svg>`;
};

/* ---------- themes as CSS ---------- */
// Same specificity and order as the reference page: ".t-x X" for a theme rule (it loses to the general 16:9 rules that
// come after it), ".v.w.t-x X" for a theme's own 16:9 rule.
lib.themeCss = (t) => {
  const sel = `.t-${t.id}`;
  const tokens = Object.entries(t.tokens).map(([k, v]) => `${k}:${v}`).join(';');
  return `${sel}{${tokens}}\n` + t.css.map((r) => (r.startsWith('&.w') ? `.v.w${sel}` + r.slice(3) : sel + r.slice(1))).join('\n');
};
lib.baseCss = () => fs.readFileSync(path.join(DIR, 'base.css'), 'utf8');
/** The site's own font files (public/fonts): as file:// links for the renderer, or site paths for the desk. */
lib.fontsCss = (mode = 'file') => {
  const dir = path.join(ROOT, 'public', 'fonts');
  const css = fs.readFileSync(path.join(dir, 'fonts.css'), 'utf8');
  return css.replace(/url\(([^)]+\.woff2)\)/g, (m, f) => (mode === 'file' ? `url(file://${path.join(dir, f)})` : `url(/fonts/${f})`));
};

/* ---------- one frame ---------- */
const WAVE = Array.from({ length: 22 }, (_, i) => `<i style="height:${30 + Math.round(60 * Math.abs(Math.sin(i * 1.3)))}%;animation-delay:${(i * 0.07).toFixed(2)}s"></i>`).join('');

/**
 * The full frame for one scene of a plan.
 * story: { section, n, total, next: [headlines] }; cues: [{text, start, end}] (seconds from the start of the scene)
 * video: true for the renderer (full screen, captions driven by time), false for the gallery (first caption shown).
 * Returns { html, portraits: [used], missing: [names] }.
 */
lib.frame = (scene, theme, ratio, { story = {}, cues, video = false } = {}) => {
  const t = SCENES.get(scene.template);
  if (!t) throw new Error(`no template ${scene.template}`);
  const used = [], missing = [];
  const ctx = { lib, story, portraits: PORTRAITS, used: (p) => { if (!used.includes(p)) used.push(p); }, missing: (n) => { if (!missing.includes(n)) missing.push(n); } };
  const out = t.render(scene, theme, ratio, ctx);
  const card = !out.nocard && scene.card && scene.card.quote ? scene.card : null;
  const wide = ratio === '16x9';
  const cls = ['v', `t-${theme.id}`, `tpl-${t.id}`, wide ? 'w' : '', card ? '' : 'nc', out.cls || '', video ? 'video' : ''].filter(Boolean).join(' ');
  let h = `<div class="${cls}"><div class="bgl"></div><div class="in"><div class="lc">`;
  h += `<div class="top"><span class="brand">Bought<b>.</b></span><span class="k">Explainer · ${esc(story.section || 'Technology')}</span><span class="no">${esc(story.n || 1)} / ${esc(story.total || 50)}</span></div>`;
  if (story.next && story.next.length) { const tk = 'UP NEXT · ' + story.next.map((x) => esc(x)).join(' · ') + ' · '; h += `<div class="tk"><span>${tk}${tk}</span></div>`; }
  h += card ? `<div class="card"><div class="h">${esc(card.title)}</div><div class="q">${marked(card.quote, card.highlight)}</div><div class="s">${esc(card.source)}</div></div>` : '';
  const lines = cues || (scene.narration ? [{ text: firstSentence(scene.narration), start: 0, end: 1e9 }] : []);
  if (!out.nocap && lines.length) {
    h += `<div class="cap"><div class="cues">${lines.map((c, i) => `<p class="cue${!video && i === 0 ? ' on' : ''}" data-start="${c.start}" data-end="${c.end}"><span>${esc(c.text)}</span></p>`).join('')}</div></div><div class="wave">${WAVE}</div>`;
  } else h += '<div class="cap"></div>';
  h += `</div><div class="stage"><div class="sw">${out.stage}</div></div>`;
  if (used.length) h += `<div class="credit">${used.map((p) => esc(p.attribution)).join(' · ')}</div>`;
  h += '</div></div>';
  return { html: h, portraits: used, missing };
};
function firstSentence(s) { const m = String(s).match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(s)).trim(); }

/** Split narration into the lines the voice reads one by one (one clip each), so each line's length is known exactly. */
lib.lines = (narration) => String(narration || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“"'‘(])/).map((x) => x.trim()).filter(Boolean);

lib.css = (themes = THEMES, fonts = 'file') => { const [a, b] = lib.baseCss().split('/*@themes@*/'); return [lib.fontsCss(fonts), a, ...themes.map(lib.themeCss), b].join('\n'); };
lib.initials = initials;

module.exports = lib;
