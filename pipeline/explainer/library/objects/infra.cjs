// Infrastructure drawings.
'use strict';
const { part, label, text, rect, line, circle, path, poly } = require('./_draw.cjs');

module.exports = [
  {
    id: 'undersea_cable', tags: ['undersea cable', 'subsea cable', 'internet', 'outage', 'coastline'], viewBox: '0 0 300 260',
    parts: { coastA: 'Coast A', coastB: 'Coast B', cable: 'cable', cut: 'damage' },
    anchors: { coastA: [55, 150], coastB: [245, 160], cable: [150, 214], cut: [150, 211] },
    draw(o) {
      let waves = '';
      for (let i = 0; i < 6; i++) { const y = 40 + i * 30, x = 95 + (i % 2) * 20; waves += `<path class="wv" d="M${x} ${y} q8 -5 16 0 t16 0 t16 0 t16 0"/>`; }
      return waves + part(o, 'coastA', `<path class="land" d="M0 10 C40 40 28 90 55 120 S40 200 70 260 L0 260 Z"/>` + text(10, 248, label(o, 'coastA', 'Coast A'), 'start'))
        + part(o, 'coastB', `<path class="land" d="M300 0 C262 40 276 100 246 140 S266 220 236 260 L300 260 Z"/>` + text(292, 248, label(o, 'coastB', 'Coast B'), 'end'))
        + part(o, 'cable', `<path class="cable" d="M55 150 C110 232 190 232 245 160"/>`)
        + part(o, 'cut', o.hot.has('cut') ? `<circle class="ring" cx="150" cy="211" r="4"/><text x="150" y="216" text-anchor="middle" class="af" style="font:700 16px var(--ui)">×</text>` : '');
    },
  },
  {
    id: 'cell_tower', tags: ['5g', 'cell tower', 'mobile network', 'telecom', 'signal'], viewBox: '0 0 300 260',
    parts: { mast: 'tower', antennas: 'antennas', signal: 'signal' },
    anchors: { mast: [150, 200], antennas: [150, 60], signal: [230, 60] },
    draw(o) {
      return part(o, 'mast', path('M150 70 L110 240 M150 70 L190 240 M124 180 L176 180 M132 140 L168 140 M138 110 L162 110 M118 214 L182 214', 'ln'))
        + part(o, 'antennas', rect(136, 46, 8, 30, 'lf', 2) + rect(156, 46, 8, 30, 'lf', 2) + line(150, 30, 150, 70))
        + part(o, 'signal', `<g class="pulse">${path('M190 40 Q206 60 190 80', 'ac')}${path('M204 28 Q230 60 204 92', 'ac')}${path('M110 40 Q94 60 110 80', 'ac')}${path('M96 28 Q70 60 96 92', 'ac')}</g>`);
    },
  },
  {
    id: 'power_plant', tags: ['power plant', 'electricity', 'grid', 'energy', 'nuclear', 'gas'], viewBox: '0 0 300 240',
    parts: { building: 'plant', stacks: 'cooling towers', lines: 'power lines' },
    anchors: { building: [96, 190], stacks: [190, 120], lines: [270, 90] },
    draw(o) {
      return part(o, 'stacks', path('M150 210 C160 160 156 120 148 90 L196 90 C188 120 184 160 194 210 Z', 'lf') + path('M200 210 C208 170 206 140 200 116 L236 116 C230 140 228 170 236 210 Z', 'lf') + `<g class="bob">${path('M160 80 C150 64 170 58 168 44 M214 106 C206 92 222 86 220 74', 'lt')}</g>`)
        + part(o, 'building', rect(40, 150, 110, 60, 'lf', 2) + rect(56, 166, 16, 16, 'pg') + rect(84, 166, 16, 16, 'pg') + rect(112, 166, 16, 16, 'pg'))
        + part(o, 'lines', path('M250 210 L262 60 L274 210 M246 90 L278 90 M250 120 L274 120', 'ln') + path('M278 90 C290 96 296 100 300 104', 'lt'))
        + line(20, 210, 290, 210);
    },
  },
  {
    id: 'wind_turbine', tags: ['wind', 'turbine', 'renewable', 'energy', 'offshore wind'], viewBox: '0 0 300 260',
    parts: { tower: 'tower', blades: 'blades', nacelle: 'nacelle' },
    anchors: { tower: [150, 200], blades: [150, 40], nacelle: [150, 80] },
    draw(o) {
      return part(o, 'tower', path('M144 84 L136 246 L164 246 L156 84 Z', 'lf'))
        + part(o, 'blades', `<g class="spin" style="transform-origin:150px 80px;transform-box:view-box">${path('M150 80 L146 10 Q150 4 154 10 Z', 'lf')}${path('M150 80 L210 116 Q212 122 206 122 Z', 'lf')}${path('M150 80 L90 116 Q88 122 94 122 Z', 'lf')}</g>`)
        + part(o, 'nacelle', circle(150, 80, 9, 'pg') + circle(150, 80, 9)) + line(40, 246, 260, 246);
    },
  },
  {
    id: 'solar_panel', tags: ['solar', 'solar panel', 'renewable', 'energy'], viewBox: '0 0 300 240',
    parts: { panel: 'panels', stand: 'stand', sun: 'sun' },
    anchors: { panel: [150, 130], sun: [240, 50], stand: [150, 200] },
    draw(o) {
      let grid = poly([[60, 170], [100, 90], [250, 90], [210, 170]], 'lf');
      for (let i = 1; i < 5; i++) { const t = i / 5; grid += line(60 + 150 * t, 170, 100 + 150 * t, 90, 'lt'); }
      grid += line(80, 130, 230, 130, 'lt');
      return part(o, 'sun', `<g class="pulse">${circle(240, 46, 18, 'af')}</g>` + path('M240 14 L240 6 M272 46 L280 46 M262 24 L268 18 M218 24 L212 18', 'ac'))
        + part(o, 'panel', grid) + part(o, 'stand', path('M150 170 L150 212 M120 212 L180 212', 'ln')) + line(30, 212, 270, 212, 'lt');
    },
  },
  {
    id: 'factory', tags: ['factory', 'manufacturing', 'plant', 'production', 'fab'], viewBox: '0 0 300 240',
    parts: { building: 'factory', chimney: 'chimney', line: 'production line' },
    anchors: { building: [150, 150], chimney: [230, 50], line: [150, 196] },
    draw(o) {
      return part(o, 'chimney', rect(220, 50, 22, 110, 'lf') + `<g class="bob">${path('M231 40 C220 24 242 18 236 4', 'lt')}</g>`)
        + part(o, 'building', path('M40 210 L40 120 L90 150 L90 120 L140 150 L140 120 L190 150 L190 110 L260 110 L260 210 Z', 'lf') + rect(206, 130, 16, 16, 'pg') + rect(232, 130, 16, 16, 'pg'))
        + part(o, 'line', rect(60, 186, 180, 12, 'pg', 3) + rect(60, 186, 180, 12, 'ln', 3) + [80, 120, 160, 200].map((x) => rect(x, 174, 14, 12, 'lf', 2)).join(''))
        + line(20, 210, 280, 210);
    },
  },
  {
    id: 'warehouse', tags: ['warehouse', 'logistics', 'shipping', 'e-commerce', 'supply chain'], viewBox: '0 0 300 240',
    parts: { building: 'warehouse', doors: 'loading doors', boxes: 'stock' },
    anchors: { building: [150, 70], doors: [150, 170], boxes: [250, 196] },
    draw(o) {
      return part(o, 'building', path('M30 210 L30 100 L150 46 L270 100 L270 210 Z', 'lf'))
        + part(o, 'doors', [64, 128, 192].map((x) => rect(x, 140, 44, 70, 'pg') + rect(x, 140, 44, 70) + line(x, 160, x + 44, 160, 'lt') + line(x, 180, x + 44, 180, 'lt')).join(''))
        + part(o, 'boxes', rect(240, 186, 22, 22, 'lf') + rect(262, 186, 22, 22, 'lf') + rect(250, 164, 22, 22, 'lf'))
        + line(10, 210, 290, 210);
    },
  },
  {
    id: 'ship', tags: ['ship', 'container ship', 'shipping', 'trade', 'port', 'repair ship'], viewBox: '0 0 300 220',
    parts: { hull: 'ship', containers: 'cargo', bridge: 'bridge' },
    anchors: { hull: [150, 150], containers: [130, 100], bridge: [226, 84] },
    draw(o) {
      let boxes = '';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) boxes += rect(60 + c * 22, 98 + r * 20, 20, 18, 'lf');
      return `<g class="sail">` + part(o, 'hull', path('M30 138 L270 138 L250 176 L50 176 Z', 'lf'))
        + part(o, 'containers', boxes) + part(o, 'bridge', rect(206, 82, 40, 56, 'pg') + rect(206, 82, 40, 56) + rect(214, 92, 24, 10, 'lf') + line(226, 82, 226, 60)) + '</g>'
        + [0, 1, 2].map((i) => `<path class="wv" d="M${20 + i * 90} ${192 + (i % 2) * 8} q10 -6 20 0 t20 0 t20 0"/>`).join('');
    },
  },
  {
    id: 'plane', tags: ['plane', 'airline', 'aviation', 'flight', 'aircraft'], viewBox: '0 0 300 200', float: true,
    parts: { body: 'plane', wings: 'wings', tail: 'tail' },
    anchors: { body: [150, 100], wings: [150, 50], tail: [46, 84] },
    draw(o) {
      return part(o, 'wings', path('M150 92 L110 30 L132 30 L190 92 Z M150 108 L110 170 L132 170 L190 108 Z', 'lf'))
        + part(o, 'tail', path('M54 92 L36 60 L50 60 L78 92 Z M54 108 L36 140 L50 140 L78 108 Z', 'lf'))
        + part(o, 'body', path('M40 100 C40 90 60 88 80 88 L240 88 C266 88 280 94 280 100 C280 106 266 112 240 112 L80 112 C60 112 40 110 40 100 Z', 'pg') + path('M40 100 C40 90 60 88 80 88 L240 88 C266 88 280 94 280 100 C280 106 266 112 240 112 L80 112 C60 112 40 110 40 100 Z') + path('M256 94 L268 98', 'ln'));
    },
  },
  {
    id: 'truck', tags: ['truck', 'freight', 'logistics', 'delivery', 'autonomous trucking'], viewBox: '0 0 300 200',
    parts: { cab: 'cab', trailer: 'trailer', wheels: 'wheels' },
    anchors: { cab: [236, 110], trailer: [120, 100], wheels: [150, 160] },
    draw(o) {
      return part(o, 'trailer', rect(30, 60, 170, 86, 'lf', 4))
        + part(o, 'cab', path('M204 146 L204 80 L246 80 L270 112 L270 146 Z', 'lf') + path('M214 90 L242 90 L258 112 L214 112 Z', 'pg'))
        + part(o, 'wheels', [66, 110, 232].map((x) => circle(x, 152, 15, 'pg') + circle(x, 152, 15) + circle(x, 152, 5)).join(''))
        + line(10, 168, 290, 168, 'lt');
    },
  },
];
