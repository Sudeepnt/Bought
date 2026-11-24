// Shared helpers for the line drawings. A drawing is plain SVG with classes from base.css:
// .ln line, .lt thin line, .lf tinted fill, .pg paper fill, .ac accent line, .af accent fill. No fixed colours anywhere:
// --line draws, --acc highlights, so every theme recolours every drawing.
'use strict';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 10) / 10).toString();

/** A named part: highlighted (class "hot") when the scene asks for it. */
function part(o, name, inner) {
  return `<g class="part p-${name}${o.hot.has(name) ? ' hot' : ''}">${inner}</g>`;
}
/** The label of a part: the scene may rename it, otherwise the drawing's own name for it. */
function label(o, name, fallback) {
  return (o.labels && o.labels[name]) || fallback;
}
/** SVG text cannot wrap or clamp, so long text is cut with an ellipsis instead of leaving the drawing. */
function cut(s, max = 30) {
  s = String(s == null ? '' : s).trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max - 1);
  return (head.lastIndexOf(' ') > max * 0.6 ? head.slice(0, head.lastIndexOf(' ')) : head).replace(/[\s,;:.\-–—]+$/, '') + '…';
}
function text(x, y, s, anchor = 'middle', cls = '', max = 30) {
  return `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}"${cls ? ` class="${cls}"` : ''}>${esc(cut(s, max))}</text>`;
}
const rect = (x, y, w, h, cls = 'ln', rx = 0) => `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ''}/>`;
const line = (x1, y1, x2, y2, cls = 'ln') => `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
const circle = (cx, cy, r, cls = 'ln') => `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
const path = (d, cls = 'ln') => `<path class="${cls}" d="${d}"/>`;
const poly = (pts, cls = 'ln') => `<polygon class="${cls}" points="${pts.map((p) => p.map(f).join(',')).join(' ')}"/>`;

/** An arrow between two anchor points, bowed upwards: a dashed accent line with a dot where it lands. */
function arrow(a, b, bend = 40) {
  const cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - bend;
  return `<path class="arr" d="M${f(a[0])} ${f(a[1])} Q${f(cx)} ${f(cy)} ${f(b[0])} ${f(b[1])}"/><circle class="ah" cx="${f(b[0])}" cy="${f(b[1])}" r="2.6"/>`;
}

/** Initials of a name, for the avatar when there is no portrait. */
function initials(name) {
  const words = String(name || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const pick = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return pick.map((w) => w[0].toUpperCase()).join('');
}

module.exports = { esc, cut, f, part, label, text, rect, line, circle, path, poly, arrow, initials };
