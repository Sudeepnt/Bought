// Business and policy drawings.
'use strict';
const { part, label, text, rect, line, circle, path, poly } = require('./_draw.cjs');

module.exports = [
  {
    id: 'document', tags: ['document', 'filing', 'report', 'contract', 'law', 'rules'], viewBox: '0 0 300 260',
    parts: { page: 'document', heading: 'title', clause: 'clause', signature: 'signature' },
    anchors: { page: [150, 40], heading: [150, 52], clause: [150, 128], signature: [196, 212] },
    draw(o) {
      let lines = '';
      for (let i = 0; i < 5; i++) lines += line(96, 82 + i * 12, 204 - (i % 2) * 20, 82 + i * 12, 'lt');
      for (let i = 0; i < 3; i++) lines += line(96, 168 + i * 12, 204 - (i % 2) * 30, 168 + i * 12, 'lt');
      return part(o, 'page', path('M80 20 L196 20 L222 46 L222 240 L80 240 Z', 'pg') + path('M80 20 L196 20 L222 46 L222 240 L80 240 Z') + path('M196 20 L196 46 L222 46', 'lt'))
        + part(o, 'heading', rect(96, 44, 90, 10, 'lf', 2)) + lines
        + part(o, 'clause', line(96, 124, 204, 124) + line(96, 136, 190, 136) + line(96, 148, 200, 148) + (o.hot.has('clause') ? path('M92 154 L208 154', 'ac') : ''))
        + part(o, 'signature', path('M160 216 C170 200 176 226 186 210 S200 214 206 206', 'ln'));
    },
  },
  {
    id: 'stamp', tags: ['approved', 'stamp', 'ruling', 'decision', 'official'], viewBox: '0 0 300 260',
    parts: { handle: 'stamp', base: 'base', imprint: 'imprint' },
    anchors: { handle: [150, 50], base: [150, 140], imprint: [150, 214] },
    draw(o) {
      return part(o, 'imprint', `<g transform="rotate(-8 150 214)">${rect(80, 192, 140, 44, 'ac', 6)}${text(150, 220, label(o, 'imprint', 'APPROVED'), 'middle', 'big')}</g>`)
        + part(o, 'handle', circle(150, 44, 22, 'lf') + rect(140, 64, 20, 50, 'lf'))
        + part(o, 'base', rect(96, 114, 108, 24, 'lf', 4) + rect(104, 138, 92, 14, 'pg', 2) + rect(104, 138, 92, 14, 'ln', 2));
    },
  },
  {
    id: 'courthouse', tags: ['court', 'judge', 'lawsuit', 'ruling', 'antitrust', 'legal'], viewBox: '0 0 300 240',
    parts: { roof: 'court', columns: 'columns', steps: 'steps' },
    anchors: { roof: [150, 50], columns: [150, 140], steps: [150, 212] },
    draw(o) {
      return part(o, 'roof', path('M40 90 L150 30 L260 90 Z', 'lf') + rect(40, 90, 220, 14, 'lf'))
        + part(o, 'columns', [64, 104, 144, 184, 224].map((x) => rect(x, 108, 12, 82, 'pg') + rect(x, 108, 12, 82)).join(''))
        + part(o, 'steps', rect(36, 190, 228, 10, 'lf') + rect(26, 200, 248, 10, 'lf') + rect(16, 210, 268, 10, 'lf'));
    },
  },
  {
    id: 'parliament', tags: ['government', 'parliament', 'congress', 'senate', 'law', 'policy', 'regulation'], viewBox: '0 0 300 240',
    parts: { dome: 'dome', wings: 'chambers', flag: 'flag' },
    anchors: { dome: [150, 70], wings: [60, 160], flag: [150, 24] },
    draw(o) {
      return part(o, 'flag', line(150, 20, 150, 60) + path('M150 20 L176 26 L150 34 Z', 'af'))
        + part(o, 'dome', path('M102 112 C102 66 198 66 198 112 Z', 'lf') + rect(112, 112, 76, 20, 'lf'))
        + part(o, 'wings', rect(24, 132, 252, 70, 'lf') + [40, 70, 100, 130, 160, 190, 220, 250].map((x) => rect(x, 146, 10, 40, 'pg')).join(''))
        + rect(14, 202, 272, 12, 'lf');
    },
  },
  {
    id: 'handshake', tags: ['deal', 'merger', 'acquisition', 'partnership', 'agreement'], viewBox: '0 0 300 200',
    parts: { left: 'side A', right: 'side B', grip: 'deal' },
    anchors: { left: [56, 110], right: [244, 110], grip: [150, 104] },
    draw(o) {
      return part(o, 'left', rect(10, 92, 62, 40, 'lf', 4) + path('M72 96 L118 88 L150 104', 'ln') + text(40, 156, label(o, 'left', 'side A')))
        + part(o, 'right', rect(228, 92, 62, 40, 'lf', 4) + path('M228 96 L186 86 L150 104', 'ln') + text(260, 156, label(o, 'right', 'side B')))
        + part(o, 'grip', path('M108 96 C126 84 150 84 170 92 L196 104 C204 108 200 120 190 118 L176 114 L182 124 C186 132 176 136 170 130 L160 122 L162 130 C164 138 152 140 148 132 L140 122 L138 128 C134 134 124 132 124 124 L112 120 L72 130', 'lf'));
    },
  },
  {
    id: 'coin_stack', tags: ['money', 'funding', 'revenue', 'profit', 'valuation', 'investment'], viewBox: '0 0 300 220',
    parts: { stackA: 'A', stackB: 'B', stackC: 'C' },
    anchors: { stackA: [80, 120], stackB: [150, 70], stackC: [220, 150] },
    draw(o) {
      const stack = (x, n) => Array.from({ length: n }, (_, i) => `<ellipse class="lf" cx="${x}" cy="${190 - i * 12}" rx="34" ry="9"/>`).join('');
      const tag = (n, x, y) => (o.labels && o.labels[n]) ? text(x, y, o.labels[n]) : '';
      return part(o, 'stackA', stack(80, 6) + tag('stackA', 80, 108)) + part(o, 'stackB', stack(150, 10) + tag('stackB', 150, 60)) + part(o, 'stackC', stack(220, 3) + tag('stackC', 220, 144))
        + line(30, 200, 270, 200, 'lt');
    },
  },
  {
    id: 'stock_line', tags: ['stock', 'shares', 'market', 'investors', 'ipo', 'earnings'], viewBox: '0 0 300 200',
    parts: { line: 'price', drop: 'move', marker: 'event' },
    anchors: { line: [110, 70], drop: [260, 130], marker: [232, 30] },
    draw(o) {
      const up = o.direction === 'up';
      const end = up ? 'M225 58 L250 30 L280 22' : 'M225 58 L240 130 L280 140';
      return '<g class="chart">' + line(20, 170, 290, 170, 'ax') + line(20, 20, 20, 170, 'ax')
        + part(o, 'line', `<path class="pl drawin" d="M20 90 L50 82 L80 86 L110 70 L140 74 L170 62 L200 66 L225 58"/>`)
        + part(o, 'marker', `<line x1="232" y1="24" x2="232" y2="170" stroke="var(--acc)" stroke-dasharray="3 3"/>` + text(236, 34, label(o, 'marker', 'results'), 'start'))
        + part(o, 'drop', `<path class="dr drawin" style="animation-delay:2.3s;animation-duration:.8s" d="${end}"/>${circle(280, up ? 22 : 140, 4, 'af')}`) + '</g>';
    },
  },
  {
    id: 'shopping_cart', tags: ['shopping', 'retail', 'e-commerce', 'consumers', 'sales'], viewBox: '0 0 300 220',
    parts: { basket: 'cart', items: 'items', wheels: 'wheels' },
    anchors: { basket: [150, 120], items: [150, 66], wheels: [150, 190] },
    draw(o) {
      return part(o, 'items', rect(104, 52, 30, 34, 'lf', 3) + rect(140, 40, 26, 46, 'lf', 3) + rect(172, 58, 34, 28, 'lf', 3))
        + part(o, 'basket', path('M30 40 L64 40 L90 150 L230 150 L252 86 L76 86', 'ln') + line(84, 118, 242, 118, 'lt'))
        + part(o, 'wheels', circle(104, 176, 12, 'pg') + circle(104, 176, 12) + circle(214, 176, 12, 'pg') + circle(214, 176, 12));
    },
  },
  {
    id: 'padlock', tags: ['security', 'privacy', 'encryption', 'lock', 'locked'], viewBox: '0 0 300 240',
    parts: { shackle: 'shackle', body: 'lock', keyhole: 'keyhole' },
    anchors: { shackle: [150, 40], body: [150, 160], keyhole: [150, 156] },
    draw(o) {
      return part(o, 'shackle', path(o.open ? 'M110 110 L110 70 C110 20 190 20 190 60' : 'M110 110 L110 70 C110 20 190 20 190 70 L190 110', 'ln'))
        + part(o, 'body', rect(88, 108, 124, 104, 'lf', 12))
        + part(o, 'keyhole', circle(150, 150, 10, 'ink') + path('M146 156 L142 182 L158 182 L154 156 Z', 'ink'));
    },
  },
  {
    id: 'shield', tags: ['security', 'protection', 'defence', 'fix', 'patch', 'safe'], viewBox: '0 0 300 240',
    parts: { shield: 'shield', check: 'protected' },
    anchors: { shield: [150, 30], check: [150, 120] },
    draw(o) {
      return part(o, 'shield', path('M150 20 L234 52 C234 140 200 196 150 222 C100 196 66 140 66 52 Z', 'lf'))
        + part(o, 'check', `<path class="ac drawin" style="stroke-width:3" d="M112 120 L140 148 L192 92"/>`);
    },
  },
  {
    id: 'bug', tags: ['bug', 'vulnerability', 'malware', 'hack', 'flaw', 'zero-day'], viewBox: '0 0 300 240',
    parts: { body: 'bug', head: 'head', legs: 'legs' },
    anchors: { body: [150, 140], head: [150, 64], legs: [60, 130] },
    draw(o) {
      return part(o, 'legs', path('M110 110 L70 92 M106 140 L62 140 M110 170 L70 190 M190 110 L230 92 M194 140 L238 140 M190 170 L230 190', 'ln'))
        + part(o, 'body', `<ellipse class="lf" cx="150" cy="144" rx="46" ry="62"/>` + line(150, 90, 150, 204, 'lt') + line(112, 130, 188, 130, 'lt'))
        + part(o, 'head', circle(150, 74, 22, 'lf') + path('M138 56 L124 34 M162 56 L176 34', 'ln'));
    },
  },
  {
    id: 'key', tags: ['key', 'access', 'password', 'credentials', 'login'], viewBox: '0 0 300 200',
    parts: { bow: 'key', blade: 'blade', teeth: 'teeth' },
    anchors: { bow: [70, 100], blade: [180, 100], teeth: [240, 120] },
    draw(o) {
      return part(o, 'bow', circle(74, 100, 40, 'lf') + circle(74, 100, 14, 'pg') + circle(74, 100, 14))
        + part(o, 'blade', rect(112, 92, 160, 16, 'lf', 3))
        + part(o, 'teeth', path('M222 108 L222 128 L236 128 L236 108 M248 108 L248 136 L262 136 L262 108', 'lf'));
    },
  },
  {
    id: 'network_graph', tags: ['network', 'supply chain', 'spread', 'connections', 'hack', 'platform'], viewBox: '0 0 300 300',
    parts: { center: 'hub', nodes: 'connections', links: 'links' },
    anchors: { center: [150, 150], nodes: [150, 38], links: [230, 100] },
    draw(o) {
      const N = 12, pts = [];
      for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 112 : 86; pts.push([150 + Math.cos(a) * r, 150 + Math.sin(a) * r]); }
      const links = pts.map((p, i) => line(150, 150, p[0], p[1], 'lt') + line(p[0], p[1], pts[(i + 1) % N][0], pts[(i + 1) % N][1], 'lt')).join('');
      return part(o, 'links', links) + part(o, 'nodes', pts.map((p) => circle(p[0], p[1], 7, 'pg') + circle(p[0], p[1], 7)).join(''))
        + part(o, 'center', `<circle class="af pulse" cx="150" cy="150" r="13"/>`);
    },
  },
];
