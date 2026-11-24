// Sample data for every template: a short and a long version. The desk's gallery shows them; the tests render every
// template x theme x ratio with both, and fail on any text that leaves the frame. All stories and numbers are placeholders.
'use strict';
const L = 'An unusually long line of text that keeps going well past what fits, to prove the frame clamps it instead of overflowing';
const card = { title: 'Cloud region · Tuesday', quote: 'Zones are designed so one failure doesn’t reach the others.', highlight: 'doesn’t reach the others', source: 'Provider docs · regions and zones' };
const longCard = { title: L, quote: L + ', and then some more words after that, again and again.', highlight: 'clamps it', source: L };

module.exports = {
  object: [
    { template: 'object', object: 'datacenter', highlight: ['zoneB'], arrows: [['zoneB', 'zoneA'], ['zoneB', 'zoneC']], card, narration: 'A power fault hit one zone at 7:08 a.m.' },
    { template: 'object', object: 'avatar', person: { name: 'Alexandria Featherstonehaugh-Montgomery', role: L }, highlight: ['ring'], card: longCard, narration: L + '.' },
  ],
  source_quote: [
    { template: 'source_quote', quote: 'Some services in the region may see elevated errors.', highlight: 'elevated errors', source: 'Provider status page · 09:35', chips: ['zone A', 'zone B', 'zone C'], narration: 'But the fault didn’t stay in one zone.' },
    { template: 'source_quote', quote: L + ' ' + L, highlight: 'clamps', source: L, chips: ['a much longer chip', 'another long one', 'third', 'fourth chip here'], narration: L + '.' },
  ],
  timeline: [
    { template: 'timeline', events: [['07:08', 'Fault begins, zone B'], ['07:35', 'First customer reports'], ['09:35', 'First public update'], ['12:12', 'Cause named: “power”'], ['15:00', 'Fixed']], big: '7 h 52 min', card: { title: 'Tuesday · local time', quote: 'What the status page said, in order', source: 'Provider status page' }, narration: 'It took 7 hours and 52 minutes to fix.' },
    { template: 'timeline', events: [['March 2024', L], ['June 2025', L], ['Last week', L], ['Today', L], ['Next year', L], ['2030', L]], big: 'Six years and counting', narration: L + '.' },
  ],
  big_number: [
    { template: 'big_number', value: '−18%', label: 'in one day', narration: 'Shares dropped 18% in one day.' },
    { template: 'big_number', value: '$1,234,567,890', label: L, card: longCard, narration: L + '.' },
  ],
  kinetic_type: [
    { template: 'kinetic_type', lines: [{ text: 'It cost', size: 'base' }, { text: '$100M', size: 'xl' }, { text: 'to train', size: 'md' }, { text: 'one model.', size: 'md' }], narration: 'Training one AI model now costs this much.' },
    { template: 'kinetic_type', lines: [{ text: L, size: 'base' }, { text: '$123,456,789', size: 'xl' }, { text: 'Extraordinarily', size: 'md' }, { text: L, size: 'sm' }, { text: L, size: 'md' }], narration: L + '.' },
  ],
  bar_chart: [
    { template: 'bar_chart', title: 'Share of advanced chip output', bars: [{ label: 'Maker A', value: 62, display: '62%' }, { label: 'Maker B', value: 21, display: '21%' }, { label: 'Others', value: 17, display: '17%' }], highlight: 'Maker A', narration: 'Most of them come from a handful of makers.' },
    { template: 'bar_chart', title: L, bars: [1, 2, 3, 4, 5].map((i) => ({ label: 'Company with a long name ' + i, value: i * 1e9, display: '$' + i + ',000,000,000' })), highlight: 'Company with a long name 3', card: longCard, narration: L + '.' },
  ],
  line_chart: [
    { template: 'line_chart', series: [90, 82, 86, 70, 74, 62, 66, 58, 130, 140], event_index: 7, event_label: 'results', start_label: 'Monday', end_label: 'Friday', narration: 'The fall came right after the results.' },
    { template: 'line_chart', series: [1, 2], event_index: 99, event_label: 'An event with a long name', start_label: L, end_label: L, card: longCard, narration: L + '.' },
  ],
  gauge: [
    { template: 'gauge', value: 80, low_label: 'normal', high_label: 'slow', display: '+140 ms', narration: 'Pages loaded slower across the region.' },
    { template: 'gauge', value: 140, low_label: 'a long label', high_label: 'another long label', display: '+1,400,000 ms slower', card: longCard, narration: L + '.' },
  ],
  versus: [
    { template: 'versus', a: { name: 'Maker A', note: 'price leader' }, b: { name: 'Maker B', note: 'battery leader' }, winner: 'none', narration: 'Two phone makers, one market.' },
    { template: 'versus', a: { name: 'A company with a very long name', note: L }, b: { name: 'Another very long company name', note: L }, rows: [{ label: 'Price', a: 52, b: 70 }, { label: 'Battery', a: 60, b: 88 }, { label: 'A long row label here', a: 40, b: 82 }], winner: 'b', narration: L + '.' },
  ],
  checklist: [
    { template: 'checklist', items: ['Label AI content', 'Report serious risks', 'Keep records'], narration: 'Companies have to do three things.' },
    { template: 'checklist', items: [L, L, L, L, L], card: longCard, narration: L + '.' },
  ],
  org_tree: [
    { template: 'org_tree', top: 'Board · incl. founder', middle: 'New CEO', teams: ['Product', 'Sales', 'Research'], highlight: 'top', narration: 'The founder stays on the board.' },
    { template: 'org_tree', top: L, middle: L, teams: [L, L, L, L], highlight: 'teams', card: longCard, narration: L + '.' },
  ],
  handover: [
    { template: 'handover', from: { name: 'Ada Founder', role: 'CEO since 2015' }, to: { name: 'Nia Chen', role: 'from inside' }, note: 'A long-time executive takes over', narration: 'A long-time executive takes over.' },
    { template: 'handover', from: { name: 'Bartholomew Featherstonehaugh', role: L }, to: { name: 'Maximiliana Oyelaran-Whitcombe', role: L }, note: L, card: longCard, narration: L + '.' },
  ],
  map_route: [
    { template: 'map_route', from: 'Coast A', to: 'Coast B', kind: 'cable', cut: true, card: { title: 'Monday · seabed', quote: 'A cable between two coasts was damaged', highlight: 'damaged', source: 'Operator notice' }, narration: 'A cable on the seabed was cut on Monday.' },
    { template: 'map_route', from: 'A place with a long name', to: 'Another far away place', kind: 'ship', cut: false, note: 'repair ship → 6 days', narration: L + '.' },
  ],
  network_spread: [
    { template: 'network_spread', state: 'spread', label: '40 companies', narration: 'Its update carried the problem to 40 companies.' },
    { template: 'network_spread', state: 'safe', label: '40,000 companies', card: longCard, narration: L + '.' },
  ],
  document_annotate: [
    { template: 'document_annotate', note: 'this part applies to you', stamp: 'IN FORCE', stamp_sub: 'from today', narration: 'A new law on AI starts today.' },
    { template: 'document_annotate', title: L, note: L, stamp: 'NOT APPROVED YET', stamp_sub: L, card: longCard, narration: L + '.' },
  ],
  phone_callouts: [
    { template: 'phone_callouts', notification: 'Update ready', callouts: ['Offline mode', 'New search', 'Dark theme'], narration: 'Three changes matter most.' },
    { template: 'phone_callouts', notification: 'A notification that is far too long', callouts: ['A feature name', 'Second one', 'Third one'], card: longCard, narration: L + '.' },
  ],
  orbit: [
    { template: 'orbit', mode: 'orbit', label: '550 km up', narration: 'The satellite now circles 550 km up.' },
    { template: 'orbit', mode: 'coverage', label: 'remote regions', card: { title: 'What it’s for', quote: 'Internet for remote areas', highlight: 'remote areas', source: 'Launch notes' }, narration: L + '.' },
  ],
  end_card: [{ template: 'end_card' }, { template: 'end_card' }],
};
