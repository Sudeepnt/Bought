// Tech drawings. Each: id, tags, viewBox, parts (name -> label), anchors (part -> [x, y] for arrows), draw(o).
'use strict';
const { part, label, text, rect, line, circle, path, poly, f } = require('./_draw.cjs');

/* isometric helper for the data centre (the reference's zones drawing) */
const iso = (x, y, z) => [91 + (x - y) * 0.866, 40 + (x + y) * 0.5 - z];
const ipoly = (pts, cls) => poly(pts.map((p) => iso(...p)), cls);
function hall(o, name, ox, oy, w, d, h, fallback) {
  let g = ipoly([[ox, oy, 0], [ox + w, oy, 0], [ox + w, oy + d, 0], [ox, oy + d, 0]], 'lf fl');
  for (let i = 0; i < 6; i++) { const y = oy + 10 + i * ((d - 20) / 5); g += ipoly([[ox + 8, y - 3, 5], [ox + w - 8, y - 3, 5], [ox + w - 8, y + 3, 5], [ox + 8, y + 3, 5]], 'lf'); }
  g += ipoly([[ox, oy, h], [ox + w, oy, h], [ox + w, oy + d, h], [ox, oy + d, h]], 'ln');
  [[ox, oy], [ox + w, oy], [ox + w, oy + d], [ox, oy + d]].forEach((c) => { const a = iso(c[0], c[1], 0), b = iso(c[0], c[1], h); g += line(a[0], a[1], b[0], b[1]); });
  const L = iso(ox + 4, oy + d + 16, 0);
  return part(o, name, g + text(L[0], L[1], label(o, name, fallback), 'start'));
}

module.exports = [
  {
    id: 'chip', tags: ['chip', 'semiconductor', 'processor', 'gpu', 'ai hardware', 'export controls'], viewBox: '0 0 300 300',
    parts: { package: 'package', die: 'die', core: 'cores', pins: 'pins' },
    anchors: { core: [150, 150], die: [150, 100], pins: [253, 150], package: [150, 240] },
    draw(o) {
      let pins = '';
      for (let i = 0; i < 12; i++) { const p = 72 + i * 14.2; pins += line(p, 60, p, 46) + line(p, 240, p, 254) + line(60, p, 46, p) + line(240, p, 254, p); }
      let cells = '', core = '';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const cell = rect(98 + c * 26.5, 98 + r * 26.5, 23, 23, 'lf');
        if ((r === 1 || r === 2) && (c === 1 || c === 2)) core += cell; else cells += cell;
      }
      return part(o, 'package', rect(60, 60, 180, 180, 'lf', 10)) + part(o, 'pins', pins) + part(o, 'die', rect(95, 95, 110, 110) + cells)
        + part(o, 'core', core + (o.hot.has('core') ? text(150, 276, label(o, 'core', 'cores')) : '')) + '<rect class="scan" x="95" y="95" width="110" height="3"/>';
    },
  },
  {
    id: 'datacenter', tags: ['data centre', 'data center', 'cloud', 'outage', 'region', 'availability zone'], viewBox: '0 0 300 215', float: true,
    parts: { zoneA: 'zone A', zoneB: 'zone B', zoneC: 'zone C' },
    anchors: { zoneA: iso(30, 40, 6), zoneB: iso(108, 40, 24), zoneC: iso(186, 40, 6) },
    draw(o) { return hall(o, 'zoneA', 0, 0, 60, 80, 14, 'zone A') + hall(o, 'zoneB', 78, 0, 60, 80, 14, 'zone B') + hall(o, 'zoneC', 156, 0, 60, 80, 14, 'zone C'); },
  },
  {
    id: 'server_rack', tags: ['server', 'rack', 'hardware', 'compute'], viewBox: '0 0 300 260',
    parts: { top: 'storage', middle: 'compute', bottom: 'network', power: 'power' },
    anchors: { top: [150, 62], middle: [150, 128], bottom: [150, 194], power: [214, 236] },
    draw(o) {
      const units = (y0, n) => Array.from({ length: n }, (_, i) => rect(100, y0 + i * 21, 100, 16, 'lf', 2) + circle(110, y0 + 8 + i * 21, 2.2, 'af') + line(122, y0 + 8 + i * 21, 186, y0 + 8 + i * 21, 'lt')).join('');
      return rect(88, 22, 124, 214, 'ln', 6) + part(o, 'top', units(32, 3)) + part(o, 'middle', units(98, 3)) + part(o, 'bottom', units(164, 3))
        + part(o, 'power', path('M212 220 C240 220 236 246 262 246') + rect(256, 240, 14, 12, 'lf', 2))
        + ['top', 'middle', 'bottom'].map((p, i) => o.hot.has(p) ? text(78, 66 + i * 66, label(o, p, this.parts[p]), 'end') : '').join('');
    },
  },
  {
    id: 'cloud_region', tags: ['cloud', 'region', 'aws', 'azure', 'google cloud', 'outage'], viewBox: '0 0 300 220',
    parts: { cloud: 'region', zoneA: 'zone A', zoneB: 'zone B', zoneC: 'zone C' },
    anchors: { zoneA: [90, 132], zoneB: [150, 132], zoneC: [210, 132], cloud: [150, 40] },
    draw(o) {
      const zone = (n, x) => part(o, n, rect(x - 24, 112, 48, 40, 'lf', 4) + line(x - 14, 124, x + 14, 124, 'lt') + line(x - 14, 132, x + 14, 132, 'lt') + line(x - 14, 140, x + 14, 140, 'lt') + text(x, 172, label(o, n, this.parts[n])));
      return part(o, 'cloud', path('M58 182 C22 182 20 128 58 124 C56 80 108 64 130 92 C146 50 214 50 222 100 C262 96 284 146 248 182 Z') + text(150, 206, label(o, 'cloud', 'cloud region')))
        + zone('zoneA', 90) + zone('zoneB', 150) + zone('zoneC', 210);
    },
  },
  {
    id: 'laptop', tags: ['laptop', 'computer', 'pc', 'software'], viewBox: '0 0 300 220',
    parts: { screen: 'screen', keyboard: 'keyboard', camera: 'camera' },
    anchors: { screen: [150, 90], keyboard: [150, 182], camera: [150, 34] },
    draw(o) {
      let keys = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) keys += rect(84 + c * 13.4 - r * 3, 168 + r * 8, 10, 5, 'lt');
      return part(o, 'screen', rect(70, 28, 160, 120, 'lf', 6) + rect(80, 40, 140, 98, 'pg', 2) + line(92, 60, 170, 60, 'lt') + line(92, 74, 200, 74, 'lt') + line(92, 88, 186, 88, 'lt'))
        + part(o, 'camera', circle(150, 34, 2.2, 'af'))
        + part(o, 'keyboard', path('M70 152 L230 152 L262 200 L38 200 Z', 'lf') + keys);
    },
  },
  {
    id: 'phone', tags: ['phone', 'smartphone', 'app', 'iphone', 'android', 'update'], viewBox: '0 0 300 260',
    parts: { screen: 'screen', notification: 'notification', camera: 'camera', button: 'button' },
    anchors: { screen: [150, 140], notification: [150, 51], camera: [150, 29], button: [207, 90] },
    draw(o) {
      let s = rect(95, 18, 110, 228, 'pg', 16) + rect(95, 18, 110, 228, 'ln', 16);
      s += part(o, 'screen', rect(107, 66, 86, 46, 'lf', 5) + rect(107, 120, 86, 46, 'lf', 5) + rect(107, 174, 86, 46, 'lf', 5));
      s += part(o, 'camera', `<rect x="135" y="26" width="30" height="6" rx="3" class="ink"/>`);
      s += part(o, 'button', rect(205, 76, 4, 28, 'lf', 2));
      s += part(o, 'notification', o.hot.has('notification')
        ? `<g class="note"><rect x="101" y="38" width="98" height="26" rx="7" class="af"/>${text(150, 55, label(o, 'notification', 'Update ready'), 'middle', 'notetx')}</g>`
        : rect(107, 44, 86, 14, 'lf', 3));
      return s;
    },
  },
  {
    id: 'smartwatch', tags: ['watch', 'wearable', 'health', 'fitness'], viewBox: '0 0 300 260',
    parts: { strap: 'strap', face: 'face', sensor: 'sensor' },
    anchors: { face: [150, 130], strap: [150, 30], sensor: [212, 130] },
    draw(o) {
      return part(o, 'strap', path('M118 70 L124 14 L176 14 L182 70', 'lf') + path('M118 190 L124 246 L176 246 L182 190', 'lf'))
        + part(o, 'face', rect(100, 66, 100, 128, 'pg', 26) + rect(100, 66, 100, 128, 'ln', 26) + circle(150, 130, 32, 'lt') + `<path class="ac" d="M150 130 L150 106"/><path class="ln" d="M150 130 L170 140"/>`)
        + part(o, 'sensor', rect(200, 112, 8, 36, 'lf', 3));
    },
  },
  {
    id: 'vr_headset', tags: ['vr', 'ar', 'headset', 'mixed reality', 'vision pro', 'quest'], viewBox: '0 0 300 220',
    parts: { visor: 'visor', lens: 'lenses', strap: 'strap' },
    anchors: { visor: [150, 110], lens: [150, 120], strap: [270, 96] },
    draw(o) {
      return part(o, 'strap', path('M52 96 C20 96 18 150 40 150') + path('M248 96 C280 96 282 150 260 150') + path('M70 72 C110 40 190 40 230 72'))
        + part(o, 'visor', rect(50, 74, 200, 88, 'lf', 30) + path('M150 162 C140 140 160 140 150 162', 'ln'))
        + part(o, 'lens', circle(110, 120, 22, 'pg') + circle(190, 120, 22, 'pg') + circle(110, 120, 22) + circle(190, 120, 22));
    },
  },
  {
    id: 'robot_arm', tags: ['robot', 'robotics', 'automation', 'factory', 'humanoid'], viewBox: '0 0 300 250',
    parts: { base: 'base', arm: 'arm', gripper: 'gripper' },
    anchors: { base: [96, 222], arm: [150, 96], gripper: [226, 150] },
    draw(o) {
      return part(o, 'base', rect(56, 206, 80, 22, 'lf', 4) + rect(78, 184, 36, 22, 'lf', 3))
        + part(o, 'arm', path('M96 184 L120 96 L206 72', 'ln') + circle(96, 184, 9, 'pg') + circle(96, 184, 9) + circle(120, 96, 10, 'pg') + circle(120, 96, 10) + path('M206 72 L224 120'))
        + part(o, 'gripper', circle(206, 72, 8, 'pg') + circle(206, 72, 8) + path('M224 120 L210 150 M224 120 L240 148', 'ln') + rect(214, 112, 20, 12, 'lf', 3));
    },
  },
  {
    id: 'drone', tags: ['drone', 'uav', 'delivery', 'defence'], viewBox: '0 0 300 220', float: true,
    parts: { body: 'body', rotors: 'rotors', camera: 'camera' },
    anchors: { body: [150, 110], rotors: [70, 70], camera: [150, 150] },
    draw(o) {
      const rotor = (x, y) => line(x, y, x, y + 14) + `<g class="spin">${path(`M${x - 30} ${y} L${x + 30} ${y}`, 'ln')}${circle(x, y, 3, 'ink')}</g>`;
      return part(o, 'rotors', rotor(70, 70) + rotor(230, 70)) + path('M70 84 L130 104 M230 84 L170 104', 'ln')
        + part(o, 'body', rect(124, 96, 52, 30, 'lf', 8))
        + part(o, 'camera', circle(150, 140, 10, 'pg') + circle(150, 140, 10) + circle(150, 140, 4, 'af'));
    },
  },
  {
    id: 'battery', tags: ['battery', 'energy', 'storage', 'lithium', 'ev', 'charging'], viewBox: '0 0 300 200',
    parts: { shell: 'battery', cells: 'charge', terminal: 'terminal' },
    anchors: { cells: [140, 100], terminal: [256, 100], shell: [140, 40] },
    draw(o) {
      const n = Math.max(0, Math.min(5, Math.round((o.level == null ? 0.8 : o.level) * 5)));
      let cells = '';
      for (let i = 0; i < 5; i++) cells += rect(56 + i * 34, 66, 26, 68, i < n ? 'lf' : 'lt', 3);
      return part(o, 'shell', rect(44, 54, 196, 92, 'ln', 10)) + part(o, 'terminal', rect(240, 82, 16, 36, 'lf', 3)) + part(o, 'cells', cells);
    },
  },
  {
    id: 'ev_car', tags: ['ev', 'electric car', 'tesla', 'byd', 'car', 'vehicle'], viewBox: '0 0 300 200',
    parts: { body: 'car', wheels: 'wheels', battery: 'battery pack', port: 'charge port' },
    anchors: { body: [150, 80], wheels: [86, 150], battery: [150, 136], port: [250, 104] },
    draw(o) {
      return part(o, 'body', path('M30 136 L36 104 C40 94 60 90 80 88 L104 62 C112 54 126 52 140 52 L196 52 C212 52 222 58 232 70 L250 90 C266 92 272 100 272 112 L272 136 Z', 'lf') + path('M114 66 L104 88 L230 88 L210 64 Z', 'pg'))
        + part(o, 'battery', rect(82, 128, 136, 10, 'lf', 2))
        + part(o, 'wheels', circle(86, 140, 20, 'pg') + circle(86, 140, 20) + circle(86, 140, 7) + circle(220, 140, 20, 'pg') + circle(220, 140, 20) + circle(220, 140, 7))
        + part(o, 'port', rect(244, 96, 12, 10, 'lf', 2));
    },
  },
  {
    id: 'charging_plug', tags: ['charger', 'charging', 'plug', 'ev', 'usb-c', 'power'], viewBox: '0 0 300 220',
    parts: { plug: 'plug', cable: 'cable', socket: 'socket' },
    anchors: { plug: [120, 110], cable: [50, 170], socket: [230, 110] },
    draw(o) {
      return part(o, 'cable', path('M40 200 C40 140 70 110 96 110', 'ln'))
        + part(o, 'plug', rect(96, 86, 56, 48, 'lf', 8) + line(152, 98, 176, 98) + line(152, 122, 176, 122))
        + part(o, 'socket', rect(196, 70, 70, 80, 'pg', 10) + rect(196, 70, 70, 80, 'ln', 10) + circle(218, 98, 4, 'ink') + circle(218, 122, 4, 'ink') + path('M240 96 L232 112 L242 112 L234 128', 'ac'));
    },
  },
  {
    id: 'satellite', tags: ['satellite', 'space', 'starlink', 'broadband', 'orbit'], viewBox: '0 0 300 220', float: true,
    parts: { body: 'satellite', panels: 'solar panels', antenna: 'antenna' },
    anchors: { body: [150, 110], panels: [60, 110], antenna: [150, 54] },
    draw(o) {
      const panel = (x) => { let s = rect(x, 88, 74, 44, 'lf', 2); for (let i = 1; i < 4; i++) s += line(x + i * 18.5, 88, x + i * 18.5, 132, 'lt'); return s + line(x, 110, x + 74, 110, 'lt'); };
      return part(o, 'panels', panel(24) + panel(202) + line(98, 110, 126, 110) + line(174, 110, 202, 110))
        + part(o, 'body', rect(126, 86, 48, 48, 'pg', 4) + rect(126, 86, 48, 48, 'ln', 4))
        + part(o, 'antenna', line(150, 86, 150, 64) + path('M132 58 Q150 40 168 58', 'ln') + circle(150, 58, 3, 'af'));
    },
  },
  {
    id: 'rocket', tags: ['rocket', 'launch', 'spacex', 'space'], viewBox: '0 0 300 260',
    parts: { nose: 'nose', body: 'rocket', engine: 'engine', fins: 'fins' },
    anchors: { nose: [150, 26], body: [150, 110], engine: [150, 214], fins: [110, 190] },
    draw(o) {
      return `<g class="lift">` + part(o, 'body', path('M126 70 L126 190 L174 190 L174 70', 'lf') + circle(150, 104, 10, 'pg') + circle(150, 104, 10))
        + part(o, 'nose', path('M126 70 Q150 4 174 70 Z', 'lf'))
        + part(o, 'fins', path('M126 160 L104 196 L126 190 Z M174 160 L196 196 L174 190 Z', 'lf'))
        + part(o, 'engine', rect(136, 190, 28, 12, 'lf', 2) + path('M140 204 Q150 250 160 204', 'ac') + path('M144 204 Q150 232 156 204', 'af')) + '</g>';
    },
  },
  {
    id: 'launch_site', tags: ['launch', 'launch pad', 'spaceport', 'rocket'], viewBox: '0 0 300 300',
    parts: { pad: 'launch site', tower: 'tower', path: 'trajectory' },
    anchors: { pad: [150, 230], tower: [110, 160], path: [230, 80] },
    draw(o) {
      return `<circle class="lt" cx="150" cy="430" r="220"/>` + part(o, 'tower', rect(102, 130, 14, 90, 'lf') + line(102, 150, 116, 162, 'lt') + line(102, 176, 116, 188, 'lt') + line(116, 150, 140, 150))
        + part(o, 'pad', rect(120, 218, 60, 10, 'lf', 2) + path('M140 218 L150 168 L160 218 Z', 'lf') + text(150, 252, label(o, 'pad', 'launch site')))
        + part(o, 'path', `<path class="route" d="M150 166 Q170 90 260 40"/><circle r="5" class="af"><animateMotion dur="3s" repeatCount="indefinite" path="M150 166 Q170 90 260 40"/></circle>`);
    },
  },
  {
    id: 'globe', tags: ['world', 'global', 'earth', 'countries', 'trade', 'geopolitics'], viewBox: '0 0 300 260',
    parts: { sphere: 'world', grid: 'grid', region: 'region' },
    anchors: { sphere: [150, 130], region: [186, 104], grid: [150, 30] },
    draw(o) {
      return part(o, 'sphere', circle(150, 130, 100, 'lf'))
        + part(o, 'grid', `<ellipse class="lt" cx="150" cy="130" rx="42" ry="100"/><ellipse class="lt" cx="150" cy="130" rx="80" ry="100"/>` + line(50, 130, 250, 130, 'lt') + `<ellipse class="lt" cx="150" cy="80" rx="86" ry="14"/><ellipse class="lt" cx="150" cy="180" rx="86" ry="14"/>`)
        + part(o, 'region', path('M170 86 C186 76 208 84 206 100 C204 116 186 124 174 116 C164 110 160 94 170 86 Z', 'lf') + (o.hot.has('region') ? `<circle class="ring" cx="188" cy="102" r="4"/>` + text(188, 146, label(o, 'region', 'here')) : ''));
    },
  },
  {
    id: 'orbit', tags: ['orbit', 'satellite', 'space', 'low earth orbit'], viewBox: '0 0 300 300',
    parts: { earth: 'earth', path: 'orbit', satellite: 'satellite' },
    anchors: { earth: [150, 150], path: [274, 150], satellite: [40, 150] },
    draw(o) {
      return part(o, 'earth', circle(150, 150, 58, 'lf') + `<path class="lt" d="M110 120 C130 110 140 130 160 122 M100 160 C130 170 150 150 196 168"/>`)
        + part(o, 'path', `<ellipse class="lt" cx="150" cy="150" rx="124" ry="46" transform="rotate(-18 150 150)" style="stroke-dasharray:3 4"/>`)
        + part(o, 'satellite', `<g transform="rotate(-18 150 150)"><circle r="6" class="af"><animateMotion dur="5s" repeatCount="indefinite" path="M26 150 a124 46 0 1 0 248 0 a124 46 0 1 0 -248 0"/></circle></g>`)
        + (o.labels && o.labels.path ? text(150, 262, o.labels.path, 'middle', 'big') : '');
    },
  },
];
