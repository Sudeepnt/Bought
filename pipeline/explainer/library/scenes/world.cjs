// org_tree, handover, map_route, network_spread, document_annotate, phone_callouts, orbit
'use strict';
const { esc, sv, str, strs, num, oneOf, sized, delay } = require('./_kit.cjs');
const { f, initials } = require('../objects/_draw.cjs');

const person = { type: 'object', properties: { name: str('full name as in the sources'), role: str('their role, from the sources') }, required: ['name'], additionalProperties: false };

/** An HTML avatar: the person's portrait when the library has one, initials otherwise. */
function av(ctx, p, size, hot) {
  const pic = p && p.name ? ctx.portraits.find(p.name) : null;
  if (pic) { ctx.used(pic); return `<div class="av ${size}${hot ? ' hot' : ''}"><svg viewBox="${pic.viewBox}" class="portrait">${pic.body}</svg></div>`; }
  if (p && p.name) ctx.missing(p.name);
  return `<div class="av ${size}${hot ? ' hot' : ''}">${esc(initials(p && p.name))}</div>`;
}

const org_tree = {
  id: 'org_tree', summary: 'Who reports to whom: a top box, an optional middle box, and up to 4 teams; one highlighted.',
  fields: () => ({ top: str('top box, e.g. "Board"'), middle: str('optional middle box, e.g. "New CEO"'), teams: strs('up to 4 boxes on the bottom row'), highlight: oneOf(['top', 'middle', 'teams'], 'which level to highlight') }),
  required: ['top'],
  render(d) {
    const box = (t, k) => `<span class="box${d.highlight === k ? ' hot' : ''}">${esc(t)}</span>`;
    const teams = (d.teams || []).slice(0, 4);
    return {
      stage: `<div class="tree stag"><div class="row">${box(d.top, 'top')}</div>` + (d.middle ? `<div class="ln2"></div><div class="row">${box(d.middle, 'middle')}</div>` : '')
        + (teams.length ? `<div class="ln2"></div><div class="row">${teams.map((t) => box(t, 'teams')).join('')}</div>` : '') + '</div>',
    };
  },
};

const handover = {
  id: 'handover', summary: 'A hands over to B (a new CEO, a sale, a transfer): two people or organisations and an arrow.',
  fields: () => ({ from: person, to: person, note: str('a few words under them, e.g. "from inside the company"') }),
  required: ['from', 'to'],
  render(d, theme, ratio, ctx) {
    const who = (p, hot) => `<div class="who">${av(ctx, p, 'm', hot)}<b>${esc(p && p.name)}</b>${p && p.role ? `<small>${esc(p.role)}</small>` : ''}</div>`;
    return { stage: `<div class="ppl"><div class="hand">${who(d.from, false)}<span class="ar">→</span>${who(d.to, true)}</div>${d.note ? `<small>${esc(d.note)}</small>` : ''}</div>` };
  },
};

const map_route = {
  id: 'map_route', summary: 'Two coasts and what links them: an undersea cable (optionally cut), a shipping route or a flight path.',
  fields: () => ({ from: str('left place'), to: str('right place'), kind: oneOf(['cable', 'ship', 'flight'], 'what links them'), cut: { type: 'boolean', description: 'the link is broken' }, note: str('a few words in the middle, e.g. "repair ship: 6 days"') }),
  required: ['from', 'to', 'kind'],
  render(d) {
    let s = '<path class="land" d="M0 10 C40 40 28 90 55 120 S40 200 70 260 L0 260 Z"/><path class="land" d="M300 0 C262 40 276 100 246 140 S266 220 236 260 L300 260 Z"/>';
    for (let i = 0; i < 6; i++) { const y = 40 + i * 30, x = 95 + (i % 2) * 20; s += `<path class="wv" d="M${x} ${y} q8 -5 16 0 t16 0 t16 0 t16 0"/>`; }
    if (d.kind === 'cable') s += '<path class="cable" d="M55 150 C110 232 190 232 245 160"/>';
    else s += `<path class="route" d="${d.kind === 'flight' ? 'M55 120 C110 30 190 30 245 110' : 'M55 150 C110 120 190 120 245 160'}"/>`;
    if (d.kind === 'ship') s += '<g class="sail"><path class="ln" d="M100 120 L134 120 L129 129 L105 129 Z"/><line class="ln" x1="117" y1="120" x2="117" y2="104"/></g>';
    if (d.kind === 'flight') s += '<g class="sail"><path class="lf" d="M132 52 L160 46 L170 40 L174 44 L168 52 L176 64 L170 64 L160 56 L140 62 Z"/></g>';
    if (d.cut) { const [x, y] = d.kind === 'cable' ? [150, 211] : d.kind === 'flight' ? [150, 55] : [150, 128]; s += `<circle class="ring" cx="${x}" cy="${y}" r="4"/><text x="${x}" y="${y + 5}" text-anchor="middle" style="font:700 16px var(--ui);fill:var(--acc)">×</text>`; }
    s += `<text x="10" y="248">${sv(d.from, 20)}</text><text x="292" y="248" text-anchor="end">${sv(d.to, 20)}</text>`;
    if (d.note) s += `<text x="150" y="${d.kind === 'flight' ? 104 : 96}" text-anchor="middle" class="lab">${sv(d.note, 30)}</text>`;
    return { stage: `<svg class="dg" viewBox="0 0 300 260" aria-hidden="true">${s}</svg>` };
  },
};

const network_spread = {
  id: 'network_spread', summary: 'A web of connections around one node: at start, the problem spreading to all, or made safe (a shield).',
  fields: () => ({ state: oneOf(['start', 'spread', 'safe'], 'start = one node hit; spread = all turn; safe = fixed'), label: str('optional big line under it, e.g. "40 companies"') }),
  required: ['state'],
  render(d) {
    const N = 12, pts = [];
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 112 : 86; pts.push([150 + Math.cos(a) * r, 150 + Math.sin(a) * r]); }
    const spread = d.state === 'spread';
    let lines = '', nodes = '';
    pts.forEach((p, i) => {
      const st = spread ? ` style="animation-delay:${(0.3 + i * 0.12).toFixed(2)}s"` : '';
      const q = pts[(i + 1) % N];
      lines += `<line x1="150" y1="150" x2="${f(p[0])}" y2="${f(p[1])}"${st}/><line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}"${st}/>`;
      nodes += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="7"${spread ? ` style="animation-delay:${(0.45 + i * 0.12).toFixed(2)}s"` : ''}/>`;
    });
    const c = d.state === 'safe' ? '<circle cx="150" cy="150" r="16" class="pg" style="stroke:var(--acc)"/><path class="safe" d="M142 150 l6 6 l11 -13"/>' : '<circle class="c" cx="150" cy="150" r="13"/>';
    return { stage: `<svg class="dg net${spread ? ' spread' : ''}" viewBox="0 0 300 300" aria-hidden="true">${lines}${nodes}${c}${d.label ? `<text x="150" y="292" text-anchor="middle" class="big" style="fill:var(--acc);font-size:26px">${sv(d.label, 18)}</text>` : ''}</svg>` };
  },
};

const document_annotate = {
  id: 'document_annotate', summary: 'A page on the desk: a red-pen underline, a margin note and an optional stamp (e.g. IN FORCE, BLOCKED).',
  fields: () => ({ title: str('optional title line of the document, from the sources'), note: str('the margin note, a few words'), stamp: str('optional stamp, 1-2 words'), stamp_sub: str('optional small line under the stamp') }),
  required: ['note'],
  render(d) {
    return {
      stage: `<div class="page">${d.title ? `<div class="ttx">${esc(d.title)}</div>` : '<div class="tt"></div>'}<div class="ls" style="height:18cqw"></div><div class="hl"></div><div class="ls" style="height:22cqw"></div>`
        + `<div class="note">${esc(d.note)}</div>` + (d.stamp ? `<div class="stamp${sized(d.stamp, [[9, ' l']])}">${esc(d.stamp)}${d.stamp_sub ? `<small>${esc(d.stamp_sub)}</small>` : ''}</div>` : '') + '</div>',
    };
  },
};

const phone_callouts = {
  id: 'phone_callouts', summary: 'A phone with an optional notification and up to 3 labelled callouts for what changed.',
  fields: () => ({ notification: str('optional pop-up text, 2-3 words'), callouts: strs('up to 3 short features') }),
  required: [],
  render(d, theme, ratio, ctx) {
    const callouts = (d.callouts || []).slice(0, 3);
    let s = '<rect class="pg" x="95" y="18" width="110" height="228" rx="16"/><rect class="ln" x="95" y="18" width="110" height="228" rx="16"/>'
      + '<rect class="lf" x="107" y="44" width="86" height="14" rx="3"/><rect class="lf" x="107" y="66" width="86" height="46" rx="5"/><rect class="lf" x="107" y="120" width="86" height="46" rx="5"/><rect class="lf" x="107" y="174" width="86" height="46" rx="5"/><rect x="135" y="26" width="30" height="6" rx="3" class="ink"/>';
    if (d.notification) s += `<g class="note"><rect x="101" y="38" width="98" height="26" rx="7" class="af"/><text x="150" y="55" text-anchor="middle" class="notetx">${sv(d.notification, 16)}</text></g>`;
    callouts.forEach((c, i) => { const y = [89, 143, 197][i]; s += `<g style="animation:up .5s ${(0.4 + i * 0.35).toFixed(2)}s both"><circle cx="193" cy="${y}" r="4" class="af"/><line x1="193" y1="${y}" x2="236" y2="${y}" stroke="var(--acc)" stroke-width="1.4"/><text x="240" y="${y + 4}" style="fill:var(--ink);font-weight:600">${sv(c, 16)}</text></g>`; });
    return { stage: `<svg class="dg phone" viewBox="${callouts.length ? '40 0 330 260' : '0 0 300 260'}" aria-hidden="true">${s}</svg>` };
  },
};

const orbit = {
  id: 'orbit', summary: 'Space: a launch path from the pad, a satellite circling the earth, or a coverage cone over a region.',
  fields: () => ({ mode: oneOf(['launch', 'orbit', 'coverage'], 'which picture'), label: str('one line, e.g. "550 km up"') }),
  required: ['mode'],
  render(d) {
    const L = d.label ? sv(d.label, 22) : '';
    if (d.mode === 'launch') return { stage: `<svg class="dg orb" viewBox="0 0 300 300" aria-hidden="true"><circle class="lt" cx="150" cy="430" r="220"/><path class="route" d="M150 212 Q170 120 260 60"/><circle r="5" class="af"><animateMotion dur="3s" repeatCount="indefinite" path="M150 212 Q170 120 260 60"/></circle><text x="150" y="250" text-anchor="middle">${L || 'launch site'}</text></svg>` };
    if (d.mode === 'coverage') return { stage: `<svg class="dg orb" viewBox="0 0 300 300" aria-hidden="true"><circle class="lt" cx="150" cy="330" r="170"/><path d="M150 50 L80 178 Q150 160 220 178 Z" style="fill:var(--atint);stroke:var(--acc);stroke-width:1"/><circle cx="150" cy="50" r="7" class="af"/><path d="M80 178 Q150 160 220 178" fill="none" stroke="var(--acc)" stroke-width="3"/><text x="150" y="215" text-anchor="middle">${L}</text></svg>` };
    return { stage: `<svg class="dg orb" viewBox="0 0 300 300" aria-hidden="true"><circle class="lf" cx="150" cy="150" r="58"/><ellipse class="lt" cx="150" cy="150" rx="124" ry="46" transform="rotate(-18 150 150)" style="stroke-dasharray:3 4"/><g transform="rotate(-18 150 150)"><circle r="6" class="af"><animateMotion dur="5s" repeatCount="indefinite" path="M26 150 a124 46 0 1 0 248 0 a124 46 0 1 0 -248 0"/></circle></g>${L ? `<text x="150" y="262" text-anchor="middle" class="big" style="fill:var(--acc);font-size:24px">${L}</text>` : ''}</svg>` };
  },
};

module.exports = [org_tree, handover, map_route, network_spread, document_annotate, phone_callouts, orbit];
