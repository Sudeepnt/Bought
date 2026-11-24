// bar_chart, line_chart, gauge, versus, checklist
'use strict';
const { esc, sv, str, strs, num, oneOf, sized, delay } = require('./_kit.cjs');
const { f } = require('../objects/_draw.cjs');

const bar_chart = {
  id: 'bar_chart', summary: 'Horizontal bars comparing 2-5 values, one highlighted.',
  fields: () => ({
    title: str('what is compared, a few words'),
    bars: { type: 'array', items: { type: 'object', properties: { label: str('name of the bar'), value: num('the number, for the bar length'), display: str('the number as shown, e.g. "62%" or "$3.4B"') }, required: ['label', 'value', 'display'], additionalProperties: false }, description: '2-5 bars' },
    highlight: str('label of the bar to highlight'),
  }),
  required: ['bars'],
  render(d) {
    const bars = (d.bars || []).slice(0, 5);
    const max = Math.max(...bars.map((b) => Math.abs(+b.value || 0)), 1e-9);
    return {
      stage: `<div class="bars stag${bars.some((b) => String(b.display).length > 7 || String(b.label).length > 12) ? ' long' : ''}">` + (d.title ? `<div class="ttl">${esc(d.title)}</div>` : '') + bars.map((b) => `<div class="r${b.label === d.highlight ? ' hot' : ''}"><span>${esc(b.label)}</span><div class="t"><i style="width:${Math.max(2, Math.abs(+b.value || 0) / max * 100).toFixed(1)}%"></i></div><b>${esc(b.display)}</b></div>`).join('') + '</div>',
    };
  },
};

const line_chart = {
  id: 'line_chart', summary: 'A line over time with an event marker; after the event the line turns to the highlight colour.',
  fields: () => ({
    series: { type: 'array', items: { type: 'number' }, description: '3-12 values in time order' },
    event_index: { type: 'integer', description: 'index in series where the event happened' },
    event_label: str('what happened, one or two words'),
    start_label: str('label under the first point, e.g. a date'),
    end_label: str('label under the last point'),
  }),
  required: ['series', 'event_index', 'event_label'],
  render(d) {
    const s = (d.series || []).map(Number).filter((x) => Number.isFinite(x)).slice(0, 12);
    if (s.length < 2) s.push(...[0, 0].slice(s.length));
    const lo = Math.min(...s), hi = Math.max(...s), span = hi - lo || 1;
    const X = (i) => 24 + i / (s.length - 1) * 256, Y = (v) => 150 - (v - lo) / span * 120;
    const ev = Math.max(0, Math.min(s.length - 1, d.event_index | 0));
    const pts = s.map((v, i) => `${f(X(i))} ${f(Y(v))}`);
    const before = 'M' + pts.slice(0, ev + 1).join(' L'), after = 'M' + pts.slice(ev).join(' L');
    const ex = X(ev), right = ex > 190;
    return {
      stage: `<svg class="dg chart" viewBox="0 0 300 200" aria-hidden="true"><line class="ax" x1="20" y1="170" x2="290" y2="170"/><line class="ax" x1="20" y1="20" x2="20" y2="170"/>`
        + `<path class="pl drawin" d="${before}"/><path class="dr drawin" style="animation-delay:2.3s;animation-duration:.8s" d="${after}"/>`
        + `<line x1="${f(ex)}" y1="24" x2="${f(ex)}" y2="170" stroke="var(--acc)" stroke-dasharray="3 3"/><text x="${f(right ? ex - 4 : ex + 4)}" y="34" text-anchor="${right ? 'end' : 'start'}" style="fill:var(--acc)">${sv(d.event_label, 22)}</text>`
        + `<circle cx="${f(X(s.length - 1))}" cy="${f(Y(s[s.length - 1]))}" r="4" class="af"/>`
        + (d.start_label ? `<text x="24" y="186">${sv(d.start_label, 18)}</text>` : '') + (d.end_label ? `<text x="280" y="186" text-anchor="end">${sv(d.end_label, 18)}</text>` : '') + '</svg>',
    };
  },
};

const gauge = {
  id: 'gauge', summary: 'A dial from low to high with a needle, and the reading as text.',
  fields: () => ({ value: num('0-100, where the needle points'), low_label: str('left end, e.g. "normal"'), high_label: str('right end, e.g. "slow"'), display: str('the reading as shown, e.g. "+140 ms"') }),
  required: ['value', 'display'],
  render(d) {
    const v = Math.max(0, Math.min(100, +d.value || 0));
    return {
      stage: `<svg class="dg gauge" viewBox="0 0 300 210" aria-hidden="true"><path d="M50 160 A100 100 0 0 1 250 160" fill="none" stroke="var(--line)" stroke-opacity=".2" stroke-width="12"/>`
        + `<path d="M50 160 A100 100 0 0 1 250 160" fill="none" stroke="var(--acc)" stroke-width="12" stroke-dasharray="314" class="drawin" style="stroke-dashoffset:${f(314 * (1 - v / 100))}"/>`
        + `<line class="needle" x1="150" y1="160" x2="150" y2="78" style="transform:rotate(${f(-90 + v * 1.8)}deg)"/><circle cx="150" cy="160" r="6" class="af"/>`
        + `<text x="50" y="182" text-anchor="middle">${sv(d.low_label || '', 16)}</text><text x="250" y="182" text-anchor="middle">${sv(d.high_label || '', 16)}</text>`
        + `<text x="150" y="204" text-anchor="middle" class="big" style="font-size:24px;fill:var(--acc)">${sv(d.display, 20)}</text></svg>`,
    };
  },
};

const side = { type: 'object', properties: { name: str('name'), note: str('a few words about it') }, required: ['name'], additionalProperties: false };
const versus = {
  id: 'versus', summary: 'Two sides compared: names with a VS badge (top/bottom in 9:16, left/right in 16:9), optional comparison bars, an optional winner.',
  fields: () => ({
    a: side, b: side,
    rows: { type: 'array', items: { type: 'object', properties: { label: str('what is compared'), a: num('value for a'), b: num('value for b') }, required: ['label', 'a', 'b'], additionalProperties: false }, description: 'optional 1-4 rows of bars' },
    winner: oneOf(['a', 'b', 'none'], 'who leads, if the sources say'),
  }),
  required: ['a', 'b'],
  render(d) {
    const a = d.a || {}, b = d.b || {};
    if (d.rows && d.rows.length) {
      const rows = d.rows.slice(0, 4);
      return {
        stage: `<div class="vbars"><div class="lg"><span><i class="a"></i>${esc(a.name)}</span><span><i class="b"></i>${esc(b.name)}</span></div>`
          + rows.map((r) => { const m = Math.max(Math.abs(+r.a || 0), Math.abs(+r.b || 0), 1e-9); return `<div class="r">${esc(r.label)}<i class="a" style="width:${f(Math.abs(+r.a || 0) / m * 100)}%"></i><i class="b" style="width:${f(Math.abs(+r.b || 0) / m * 100)}%"></i></div>`; }).join('') + '</div>',
      };
    }
    const win = d.winner === 'a' || d.winner === 'b' ? d.winner : '';
    const half = (x, k) => `<div class="${win && win !== k ? 'dim' : ''}"><b class="${sized(x.name, [[9, 'l']])}">${esc(x.name)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</div>`;
    return { stage: `<div class="vs">${half(a, 'a')}${half(b, 'b')}<span class="badge">${win ? '★' : 'VS'}</span></div>`, nocard: true, wide: true };
  },
};

const checklist = {
  id: 'checklist', summary: '2-5 items ticked off one by one: what is required, what changes, what to do.',
  fields: () => ({ items: strs('2-5 short items') }),
  required: ['items'],
  render(d) {
    const items = (d.items || []).slice(0, 5);
    return { stage: `<div class="chk${items.length > 3 || items.some((t) => String(t).length > 40) ? ' many' : ''}">` + items.map((t, i) => `<div><svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4"/><path d="M6 12 l4 4 l8 -9" style="${delay(i, 0.5, 0.5)}"/></svg><span>${esc(t)}</span></div>`).join('') + '</div>' };
  },
};

module.exports = [bar_chart, line_chart, gauge, versus, checklist];
