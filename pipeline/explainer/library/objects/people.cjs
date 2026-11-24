// People. A named person is drawn from their portrait (library/portraits/) when the library has one; otherwise an initials avatar,
// and the name goes on the desk's "Portraits needed" list. Real faces are never drawn or generated: only traced from licensed photos.
'use strict';
const { part, label, text, rect, line, circle, initials, esc } = require('./_draw.cjs');

/** A face in a circle at (cx, cy) radius r: portrait if there is one, initials otherwise. */
function face(o, cx, cy, r, person, cls = 'lf') {
  const p = person && o.portraits ? o.portraits.find(person.name) : null;
  if (p) {
    o.used(p);
    const id = 'pc' + Math.abs(hash(person.name + cx + cy));
    return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>${circle(cx, cy, r, 'pg')}`
      + `<svg x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" viewBox="${p.viewBox}" clip-path="url(#${id})" class="portrait">${p.body}</svg>${circle(cx, cy, r)}`;
  }
  if (person && person.name && o.missing) o.missing(person.name);
  return circle(cx, cy, r, cls) + `<text x="${cx}" y="${cy + r * 0.33}" text-anchor="middle" style="font:600 ${Math.round(r * 0.9)}px var(--disp);fill:var(--ink)">${esc(initials(person && person.name))}</text>`;
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

module.exports = [
  {
    id: 'avatar', tags: ['person', 'ceo', 'founder', 'executive', 'people'], viewBox: '0 0 300 260',
    parts: { face: 'person', ring: 'highlight' },
    anchors: { face: [150, 110], ring: [150, 20] },
    draw(o) {
      const person = o.person || { name: '' };
      return part(o, 'ring', `<circle class="${o.hot.has('ring') ? 'ac' : 'lt'}" cx="150" cy="110" r="96"/>`)
        + part(o, 'face', face(o, 150, 110, 84, person))
        + (person.name ? text(150, 232, person.name, 'middle', 'big', 24).replace('class="big"', 'class="big" style="font-size:22px"') : '')
        + (person.role ? text(150, 252, person.role, 'middle', '', 40) : '');
    },
  },
  {
    id: 'crowd', tags: ['users', 'people', 'workers', 'customers', 'layoffs', 'employees'], viewBox: '0 0 300 240',
    parts: { crowd: 'people', group: 'some of them' },
    anchors: { crowd: [150, 120], group: [230, 80] },
    draw(o) {
      let all = '', hot = '';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        const x = 40 + c * 44 + (r % 2) * 22, y = 40 + r * 50;
        const g = circle(x, y, 10, 'lf') + `<path class="lf" d="M${x - 16} ${y + 32} C${x - 16} ${y + 12} ${x + 16} ${y + 12} ${x + 16} ${y + 32} Z"/>`;
        if (c >= 4 && r < 3) hot += g; else all += g;
      }
      return part(o, 'crowd', all) + part(o, 'group', hot + (o.hot.has('group') ? text(222, 236, label(o, 'group', 'some of them')) : ''));
    },
  },
  {
    id: 'org_tree', tags: ['organisation', 'leadership', 'reorganisation', 'board', 'management'], viewBox: '0 0 300 240',
    parts: { top: 'board', middle: 'CEO', teams: 'teams' },
    anchors: { top: [150, 40], middle: [150, 112], teams: [150, 190] },
    draw(o) {
      const box = (x, y, w, t) => rect(x - w / 2, y - 16, w, 32, 'pg', 6) + rect(x - w / 2, y - 16, w, 32, 'ln', 6) + text(x, y + 4, t);
      return part(o, 'top', box(150, 40, 120, label(o, 'top', 'board'))) + line(150, 56, 150, 96)
        + part(o, 'middle', box(150, 112, 110, label(o, 'middle', 'CEO'))) + line(150, 128, 150, 152) + line(60, 152, 240, 152) + [60, 150, 240].map((x) => line(x, 152, x, 174)).join('')
        + part(o, 'teams', [60, 150, 240].map((x, i) => box(x, 190, 80, ((o.labels && o.labels.teams) || 'product,sales,research').split(',')[i] || '')).join(''));
    },
  },
];
module.exports.face = face;
