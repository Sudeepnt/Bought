// object, source_quote, timeline, big_number, kinetic_type, end_card
'use strict';
const { esc, str, strs, num, oneOf, marked, sized, delay } = require('./_kit.cjs');

const object = {
  id: 'object', summary: 'Draw one object from the library, highlight its named parts and draw arrows between parts. Pass person for avatar.',
  fields: (lib) => ({
    object: oneOf(lib.objectIds(), 'which drawing'),
    highlight: { type: 'array', items: { type: 'string', enum: lib.partNames() }, description: 'parts of that object to highlight' },
    arrows: { type: 'array', items: { type: 'array', items: { type: 'string', enum: lib.partNames() } }, description: 'pairs [from, to] of that object\'s parts' },
    labels: { type: 'array', items: { type: 'object', properties: { part: { type: 'string', enum: lib.partNames() }, text: str('the new name, from the sources') }, required: ['part', 'text'], additionalProperties: false }, description: 'optional new names for parts' },
    person: { type: 'object', properties: { name: str('full name as written in the sources'), role: str('their role, from the sources') }, required: ['name'], additionalProperties: false },
  }),
  required: ['object'],
  render(d, theme, ratio, ctx) {
    const labels = Object.fromEntries((d.labels || []).map((l) => [l.part, l.text]));
    return { stage: ctx.lib.drawObject(d.object, { highlight: d.highlight, arrows: d.arrows, labels, person: d.person }, ctx) };
  },
};

const source_quote = {
  id: 'source_quote', summary: 'A big quote, word for word from a source article, with a marker sweep over the key words and the source under it.',
  fields: () => ({ quote: str('exact words from a source article'), highlight: str('a part of the quote to mark'), source: str('where it is from, e.g. "Reuters · Tuesday"'), chips: strs('up to 4 short tags shown under the quote') }),
  required: ['quote', 'source'],
  render(d) {
    const chips = (d.chips || []).slice(0, 4);
    return {
      stage: `<div class="s3wrap"><div class="qbig${String(d.quote).length > 110 ? ' long' : ''}"><p>“${marked(d.quote, d.highlight)}”</p><small>${esc(d.source)}</small></div>`
        + (chips.length ? `<div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : '') + '</div>',
      nocard: true,
    };
  },
};

/** Minutes since midnight for "07:08" / "7:08 a.m." / "15:00", or null. */
function clock(t) {
  const m = String(t).trim().match(/^(\d{1,2})[:.](\d{2})\s*([ap])?\.?m?\.?$/i);
  if (!m) return null;
  let h = +m[1] % 24; const min = +m[2];
  if (m[3]) { if (m[3].toLowerCase() === 'p' && h < 12) h += 12; if (m[3].toLowerCase() === 'a' && h === 12) h = 0; }
  return min < 60 ? h * 60 + min : null;
}
const timeline = {
  id: 'timeline', summary: 'Events in order on a time axis (vertical in 9:16, horizontal in 16:9), with an optional big total.',
  fields: () => ({ events: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '2-6 pairs [time or date, what happened]' }, big: str('optional total, e.g. "7 h 52 min"') }),
  required: ['events'],
  render(d, theme, ratio) {
    const ev = (d.events || []).slice(0, 6).map((e) => [String(e[0] || ''), String(e[1] || '')]);
    const mins = ev.map((e) => clock(e[0]));
    const timed = ev.length > 1 && mins.every((m) => m != null) && mins.every((m, i) => !i || m >= mins[i - 1]);
    let lo = 0, hi = 1, at;
    if (timed) {
      lo = Math.floor(mins[0] / 60) * 60; hi = Math.max(lo + 120, Math.ceil(mins[mins.length - 1] / 60) * 60 + 60);
      at = (i) => (mins[i] - lo) / (hi - lo);
    } else at = (i) => (ev.length === 1 ? 0.5 : 0.06 + i / (ev.length - 1) * 0.82);
    const hours = [];
    if (timed) { const step = (hi - lo) / 60 > 8 ? 120 : 60; for (let m = lo; m <= hi; m += step) hours.push(m); }
    const hh = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':00';
    const last = at(ev.length - 1), first = at(0);
    if (ratio === '16x9') {
      const pos = (p) => (4 + p * 92).toFixed(2) + '%';
      const rows = ['u2', 'd1', 'u1', 'd1', 'u1', 'u2'];
      let s = '<div class="tlw"><div class="ax"></div>' + hours.map((m) => `<span class="hr" style="left:${pos((m - lo) / (hi - lo))}">${hh(m)}</span>`).join('');
      s += `<div class="bar2" style="left:${pos(first)};width:calc(${pos(last)} - ${pos(first)})"></div>`;
      s += ev.map((e, i) => `<div class="ev ${rows[i]}" style="left:${pos(at(i))};${delay(i)}"><em>${esc(e[0])}</em>${esc(e[1])}</div>`).join('');
      return { stage: s + (d.big ? `<div class="big ${sized(d.big, [[10, 'l'], [16, 'xl']])}">${esc(d.big)}</div>` : '') + '</div>' };
    }
    const pos = (p) => (p * 100).toFixed(2) + '%';
    let s = '<div class="tl"><div class="ax"></div>' + hours.map((m) => `<span class="hr" style="top:${pos((m - lo) / (hi - lo))}">${hh(m)}</span>`).join('');
    s += `<div class="bar2" style="top:${pos(first)};height:calc(${pos(last)} - ${pos(first)})"></div>`;
    s += ev.map((e, i) => `<div class="ev" style="top:${pos(at(i))};${delay(i, 0.45)}"><em>${esc(e[0])}</em>${esc(e[1])}</div>`).join('');
    return { stage: s + (d.big ? `<div class="big ${sized(d.big, [[10, 'l'], [16, 'xl']])}" style="top:${pos(Math.min(0.9, last + 0.06))}">${esc(d.big)}</div>` : '') + '</div>' };
  },
};

const big_number = {
  id: 'big_number', summary: 'One number, huge, with a short line saying what it is.',
  fields: () => ({ value: str('the number as written, e.g. "−18%" or "$4.2B"'), label: str('what it means, a few words') }),
  required: ['value', 'label'],
  render(d) {
    return { stage: `<div class="bignum"><b class="${sized(d.value, [[5, 'l'], [8, 'xl'], [11, 'xxl']])}">${esc(d.value)}</b><span>${esc(d.label)}</span></div>` };
  },
};

const kinetic_type = {
  id: 'kinetic_type', summary: 'Big words that build the story line by line, no drawing. One line can be xl (a number or one word).',
  fields: () => ({ lines: { type: 'array', items: { type: 'object', properties: { text: str('a few words'), size: oneOf(['xl', 'md', 'base', 'sm'], 'xl = huge, sm = small grey line') }, required: ['text', 'size'], additionalProperties: false }, description: '2-5 lines' } }),
  required: ['lines'],
  render(d) {
    const lines = (d.lines || []).slice(0, 5);
    return {
      stage: `<div class="kin stag${lines.length > 3 || lines.reduce((n, l) => n + String(l.text || '').length, 0) > 60 ? ' many' : ''}">` + lines.map((l) => {
        const t = String(l.text || '');
        // a line too long for its size steps down, so the words always fit (each line is clamped too)
        let size = l.size;
        if (size === 'xl' && t.length > 12) size = 'md';
        if (size === 'md' && t.length > 22) size = 'base';
        if (size === 'base' && t.length > 34) size = 'sm';
        const cls = size === 'xl' ? 'xl ' + sized(t, [[5, 'l'], [8, 'xxl']]) : size === 'md' ? 'md ' + sized(t, [[10, 'l']]) : size === 'sm' ? 'sm' : sized(t, [[16, 'l']]);
        return `<div class="${cls.trim()}">${esc(t)}</div>`;
      }).join('') + '</div>',
    };
  },
};

const end_card = {
  id: 'end_card', summary: 'The last scene: Bought., read the full story, and the AI note. No fields; always last.',
  fields: () => ({}),
  required: [],
  render(d, theme, ratio, ctx) {
    const s = ctx.story || {};
    return {
      stage: `<div class="end"><div class="bw">Bought<b>.</b></div><p>Read the full story in today’s paper.</p><span class="chip">Story ${esc(s.n || 1)} of ${esc(s.total || 50)} · ${esc(s.section || 'Technology')}</span><small>Script and voice made with AI.<br>Every claim checked against its source.</small></div>`,
      cls: 'end-card', nocard: true, nocap: true,
    };
  },
};

module.exports = [object, source_quote, timeline, big_number, kinetic_type, end_card];
