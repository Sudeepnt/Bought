// What scene templates share. A template is { id, summary, fields, required, render(data, theme, ratio, ctx) }:
//   fields    the JSON Schema of its own data (the plan's scene object adds template, narration and card);
//   render    returns { stage, card?, cls? }: the HTML for the stage, an optional source card, extra frame classes.
// ratio is "9x16" or "16x9"; every template has a proper layout for both.
'use strict';
const { esc, cut } = require('../objects/_draw.cjs');
const sv = (s, max = 30) => esc(cut(s, max));      // text inside an SVG: cut, escaped

const str = (description) => ({ type: 'string', description });
const strs = (description) => ({ type: 'array', items: { type: 'string' }, description });
const num = (description) => ({ type: 'number', description });
const oneOf = (values, description) => ({ type: 'string', enum: values, description });

/** Wrap the first occurrence of `hl` in `text` with <mark> (the marker sweep). Everything is escaped. */
function marked(text, hl) {
  text = String(text || '');
  const at = hl ? text.indexOf(hl) : -1;
  if (at < 0) return esc(text);
  return esc(text.slice(0, at)) + '<mark>' + esc(hl) + '</mark>' + esc(text.slice(at + hl.length));
}
/** A size class for big text by its length, so long values never overflow the frame. */
function sized(text, steps) {
  const n = String(text || '').length;
  let cls = '';
  for (const [limit, name] of steps) if (n > limit) cls = name;
  return cls;
}
const delay = (i, step = 0.4, start = 0.4) => `animation-delay:${(start + i * step).toFixed(2)}s`;

module.exports = { esc, sv, cut, str, strs, num, oneOf, marked, sized, delay };
