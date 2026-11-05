const sampleStories = [
  {
    category: 'AI',
    title: 'AI agents move from prompts to complete tasks',
    deck: 'New assistants are being designed to plan work across apps, then pause for people when a decision needs them.',
    happened: 'AI tools are beginning to connect several steps into one guided workflow.',
    matters: 'The test for agents is shifting from clever answers to dependable work.',
    image: 'assets/swipe-robotics.jpg',
    imageAlt: 'A humanoid robot working beside people on a factory floor',
    imagePosition: 'center 34%',
  },
  {
    category: 'Tech business',
    title: 'The AI race now runs through the data center',
    deck: 'Cloud companies are expanding server capacity as demand for advanced models rises.',
    happened: 'Infrastructure spending is growing alongside investment in new AI models.',
    matters: 'Compute access is becoming a competitive advantage for the whole industry.',
    image: 'assets/swipe-data-center.jpg',
    imageAlt: 'A technician walking through a blue-lit data center',
    imagePosition: 'center 42%',
  },
  {
    category: 'Technology',
    title: 'Robots take on more work beside human teams',
    deck: 'Manufacturers are testing machines on practical jobs that once depended on repetitive manual work.',
    happened: 'More robotics pilots are moving from controlled demos into everyday workplaces.',
    matters: 'Reliable performance on ordinary shifts will decide whether adoption grows.',
    image: 'assets/swipe-robotics.jpg',
    imageAlt: 'A humanoid robot and technicians working together in a factory',
    imagePosition: 'center 72%',
  },
  {
    category: 'Founders & startups',
    title: 'Smaller teams build products at a faster pace',
    deck: 'Lower-cost software and AI tools help founders test an idea before committing to a full launch.',
    happened: 'Startups are using lightweight prototypes to learn from customers earlier.',
    matters: 'Faster feedback can help young companies focus their limited resources.',
    image: 'assets/swipe-founders.jpg',
    imageAlt: 'A small startup team reviewing a product prototype together',
    imagePosition: 'center 35%',
  },
  {
    category: 'Product launches',
    title: 'A new class of devices puts AI within reach',
    deck: 'Companies are exploring products that combine voice, cameras, and on-device assistants.',
    happened: 'Hardware makers are experimenting with more natural ways to access AI features.',
    matters: 'The next useful interface may fit into devices people already carry.',
    image: 'assets/swipe-battery.jpg',
    imageAlt: 'A researcher examining a compact electronic component in a lab',
    imagePosition: 'center 35%',
  },
  {
    category: 'Tech geopolitics',
    title: 'Chip supply chains become a matter of strategy',
    deck: 'Governments are weighing local manufacturing against the cost and complexity of global supply.',
    happened: 'New industrial plans are targeting advanced chip production and key materials.',
    matters: 'Where critical components are made can shape trade and technology policy.',
    image: 'assets/podcast-earth.jpg',
    imageAlt: 'Earth at night with city lights visible across the surface',
    imagePosition: 'center 54%',
  },
  {
    category: 'Tech business',
    title: 'Cooling becomes a key choice for AI infrastructure',
    deck: 'Operators are redesigning server rooms to handle denser computing and rising power needs.',
    happened: 'Data center teams are investing in new cooling systems and layouts.',
    matters: 'Efficient cooling can unlock more computing capacity with less energy.',
    image: 'assets/swipe-data-center.jpg',
    imageAlt: 'Rows of illuminated servers inside a large data center',
    imagePosition: 'center 72%',
  },
  {
    category: 'Technology',
    title: 'Satellite networks reach beyond city coverage',
    deck: 'New launches are adding capacity to services designed for remote areas and moving users.',
    happened: 'Operators continue to build out satellite systems for broader connectivity.',
    matters: 'Reliable links could bring essential services to places traditional networks miss.',
    image: 'assets/swipe-rocket.jpg',
    imageAlt: 'A rocket lifting off above its launch tower at sunset',
    imagePosition: 'center 42%',
  },
  {
    category: 'Product launches',
    title: 'Battery makers target longer days between charges',
    deck: 'Researchers are testing materials and designs that could improve capacity and charging speed.',
    happened: 'Battery labs are working toward cells that store more energy in less space.',
    matters: 'Better batteries can make portable devices and electric transport more practical.',
    image: 'assets/swipe-battery.jpg',
    imageAlt: 'A battery researcher testing an electronic cell in the laboratory',
    imagePosition: 'center 70%',
  },
  {
    category: 'Founders & startups',
    title: 'New tools shorten the path from idea to launch',
    deck: 'Founders can build early versions quickly and see how people respond before scaling up.',
    happened: 'Prototyping tools are making it easier to try product ideas with small teams.',
    matters: 'More experiments help startups learn what customers value sooner.',
    image: 'assets/swipe-founders.jpg',
    imageAlt: 'Founders collaborating around an early product prototype',
    imagePosition: 'center 70%',
  },
];

const imageStories = [
  {
    category: 'Business',
    title: 'Starship takes flight as reusable rocket ambitions grow',
    badges: [{ id: 'most-viewed', label: 'Most viewed' }],
    deck: 'The launch puts attention on rapid turnaround, recovery, and the next phase of space travel.',
    matters: 'Reliable reuse could lower the cost and increase the pace of future launches.',
    image: 'assets/swipe-rocket.jpg',
    alt: 'A tall rocket launching from a coastal pad at sunset',
  },
  {
    category: 'AI',
    title: 'AI’s appetite for compute reshapes the data center',
    deck: 'A new generation of infrastructure is being built to keep up with increasingly powerful models.',
    matters: 'Power and capacity now shape who can build and run advanced AI.',
    image: 'assets/swipe-data-center.jpg',
    alt: 'A technician walking between rows of illuminated computer servers',
  },
  {
    category: 'Technology',
    title: 'Humanoid robots move closer to the factory floor',
    deck: 'Manufacturers are testing how machines can work alongside people on repetitive tasks.',
    matters: 'Real-world trials will show where robots can safely add value.',
    image: 'assets/swipe-robotics.jpg',
    alt: 'A humanoid robot working with people in a manufacturing plant',
  },
  {
    category: 'Founders',
    title: 'Small teams race to build the next big tools',
    deck: 'Founders are finding faster paths from a working prototype to a product people can use.',
    matters: 'Lower building costs let more ideas reach customers quickly.',
    image: 'assets/swipe-founders.jpg',
    alt: 'A small founding team discussing a hardware prototype at night',
  },
  {
    category: 'Innovation',
    title: 'Battery research targets a longer-lasting cell',
    deck: 'New materials could change how everyday devices and vehicles store energy.',
    matters: 'Better storage could extend device life and make electric transport more practical.',
    image: 'assets/swipe-battery.jpg',
    alt: 'A scientist examining a small battery cell in a laboratory',
  },
  {
    category: 'Business',
    title: 'Satellite links bring launch plans closer to daily life',
    deck: 'Rocket launches are helping build networks designed to connect people beyond city infrastructure.',
    matters: 'More reliable coverage could change how remote communities get online.',
    image: 'assets/swipe-rocket.jpg',
    alt: 'A rocket rising above its launch site at dusk',
  },
  {
    category: 'AI',
    title: 'Cooling becomes a key design choice for AI data centers',
    deck: 'Operators are reworking server rooms to manage the heat from denser computing systems.',
    matters: 'Efficient cooling can free up capacity while reducing energy use.',
    image: 'assets/swipe-data-center.jpg',
    alt: 'A technician walking between rows of illuminated computer servers',
  },
  {
    category: 'Technology',
    title: 'Factory robots take on more routine work',
    deck: 'Manufacturers are moving robotics trials from controlled demos into everyday operations.',
    matters: 'Reliable performance on ordinary shifts will determine whether adoption grows.',
    image: 'assets/swipe-robotics.jpg',
    alt: 'A robot working in a modern manufacturing plant',
  },
  {
    category: 'Founders',
    title: 'AI tools help small companies test ideas sooner',
    deck: 'Lean teams are using new software to turn early concepts into working product trials.',
    matters: 'Faster experiments can help founders learn before spending heavily.',
    image: 'assets/swipe-founders.jpg',
    alt: 'A small founding team reviewing an early product prototype',
  },
  {
    category: 'Innovation',
    title: 'Portable power gets a redesign for longer days',
    deck: 'Battery makers are looking for gains in capacity, charging speed, and everyday durability.',
    matters: 'Better portable storage could make new devices more practical to carry.',
    image: 'assets/swipe-battery.jpg',
    alt: 'A researcher examining a battery cell in a laboratory',
  },
];

const glanceStories = [
  {
    category: 'Tech business',
    title: 'The chip race moves beyond the processor',
    badges: [{ id: 'most-glanced', label: 'Most glanced' }],
    deck: 'Memory, power, and cooling are becoming just as important to AI infrastructure.',
    matters: 'The next performance gains may come from the whole system, not one chip.',
  },
  {
    category: 'AI',
    title: 'Agents find a place in everyday work',
    badges: [{ id: 'most-read', label: 'Most read' }],
    deck: 'Teams are testing where software can handle a complete task, not just a prompt.',
    matters: 'Useful automation depends on reliable handoffs and clear human control.',
  },
  {
    category: 'Founders & startups',
    title: 'Smaller teams are shipping faster',
    deck: 'New tools shorten the distance between an idea and a product people can try.',
    matters: 'More founders can test demand before committing large resources.',
  },
  {
    category: 'Product launches',
    title: 'A new wave of devices puts AI on the go',
    deck: 'Companies are exploring interfaces built around voice, cameras, and context.',
    matters: 'Portable AI could change when and where people use assistants.',
  },
  {
    category: 'Tech geopolitics',
    title: 'Countries redraw the map for advanced chips',
    deck: 'Manufacturing capacity and supply chains remain central to technology policy.',
    matters: 'Where chips are made affects access, cost, and national resilience.',
  },
  { category: 'Technology', title: 'The browser becomes a workspace for agents', deck: 'Browsers are adding tools for AI to research, organize and act alongside everyday work.', matters: 'The browser may become the place where an agent completes a task.' },
  { category: 'Technology', title: 'The interface after the chat window', deck: 'Voice, screens and background actions are expanding how people direct software.', matters: 'People may move between speaking, looking, and approving as work unfolds.' },
  { category: 'Technology', title: 'Search starts to answer the next question', deck: 'Answer engines are moving from matching queries to anticipating useful follow-ups.', matters: 'Finding information could take fewer searches and less manual sorting.' },
  { category: 'Technology', title: 'Private data becomes useful context', deck: 'Personal context can make assistants more useful when access stays clear and controlled.', matters: 'Trust will depend on people knowing what data an assistant can use.' },
  { category: 'Technology', title: 'Clear controls make complex tools easier to trust', deck: 'Visible permissions help people understand what an agent can access and do.', matters: 'Clear limits make it easier to hand software a real task.' },
  { category: 'AI', title: 'Smaller models move onto the phone', deck: 'Compact models are running on everyday devices, answering without a round trip to the cloud.', matters: 'Faster, more private answers could change which tasks people hand to an assistant.' },
  { category: 'Tech business', title: 'Data center power becomes the bottleneck', deck: 'Operators are signing long power deals as new capacity is limited by the grid, not by chips.', matters: 'Access to electricity may decide who can train and serve the next generation of models.' },
  { category: 'Founders & startups', title: 'Early customers shape the first product', deck: 'Founders are building alongside a handful of paying users before writing a full roadmap.', matters: 'Paid pilots give small teams real signal long before a public launch.' },
];

const articleDetails = [
  [
    'An agent has to do more than produce a good reply. It must keep track of a goal, move between tools, notice when a step fails, and show the person what it plans to do next. The most promising designs make those actions visible rather than hiding them inside a chat window.',
    'That changes the way software is judged. A useful assistant can save time on routine steps, but it also needs clear limits and a simple way to hand a decision back to its user.',
  ],
  [
    'Advanced models need vast amounts of computing, and that demand reaches far beyond the chips themselves. Power connections, memory, networking, cooling, and the buildings that hold them all have to grow together. A delay in any one part can slow the whole system.',
    'For companies trying to offer AI at scale, the physical footprint of computing is becoming part of the product. Capacity planning now shapes cost, speed, and who can serve customers reliably.',
  ],
  [
    'A factory is a harder environment than a staged demonstration. Tasks change, people move nearby, and a machine has to repeat useful work across an entire shift. That is why trials focus on practical jobs and how safely a robot can recover when something goes wrong.',
    'Human teams remain central to those tests. The question is where robots can take strain out of repetitive work while fitting into the pace and safety rules of a real workplace.',
  ],
  [
    'Small teams can now build a working version of an idea before investing in a large launch. Design tools, shared software services, and AI assistance reduce the time spent on the first draft. Founders can put a product in front of people while the idea is still flexible.',
    'Speed alone is not the goal. The value comes from hearing what customers actually need, changing course early, and spending scarce resources on the part that proves useful.',
  ],
  [
    'The next wave of AI hardware is testing whether an assistant can be useful without asking people to open a familiar app. Voice, cameras, and contextual cues can make help feel immediate, but they also create new questions about battery life, privacy, and control.',
    'A successful device will need a clear reason to exist alongside the phone. Its interface must make the useful action easier while keeping the person aware of what it sees and does.',
  ],
  [
    'The path from a chip design to a finished product crosses many borders. Factories, specialist equipment, materials, packaging, and skilled workers are spread across different regions. Governments are trying to reduce weak points without losing the benefits of that global network.',
    'Building local capacity takes time and money. Decisions made now could influence where future computing systems are produced and how readily companies can obtain their most important parts.',
  ],
  [
    'More powerful servers place more heat into a smaller space. Operators can add machines only if the building can deliver power and remove that heat consistently. Cooling choices therefore affect both the size of an AI cluster and the expense of running it.',
    'The work is less visible than a new model announcement, but it has a direct effect on what services can be offered. Better infrastructure gives software teams room to grow.',
  ],
  [
    'Satellite networks aim to fill gaps left by ground infrastructure. Reaching a remote home, a moving vehicle, or a community far from a city depends on more than a launch: the system needs enough capacity, dependable equipment, and a service people can afford.',
    'Each added spacecraft is one part of a larger network. The promise is broader access to communication where laying cables or building towers is difficult.',
  ],
  [
    'Longer battery life depends on a series of tradeoffs. Researchers are looking at materials that hold more energy, charge efficiently, and remain safe through repeated use. A gain in one measure matters only if a cell can be manufactured and relied on at scale.',
    'For people using portable devices, the benefit is simple: more time between interruptions. For makers of electric transport, better storage can change weight, range, and cost.',
  ],
  [
    'Founders can assemble an early product with a smaller team than before, then put it in front of potential users. That does not remove the hard work of choosing a problem, but it lets teams test an assumption before they build an entire business around it.',
    'The best early launches are conversations with customers. Each trial shows what people use, what they ignore, and which part of an idea deserves more work.',
  ],
  [
    'Reusable launch systems are being judged by what happens after liftoff as much as by the flight itself. Recovery, inspection, and preparation for the next mission determine whether a vehicle can fly often enough to change the economics of access to space.',
    'A successful test is a step, not the finish line. The next measure is whether those milestones can be repeated safely and with less time between launches.',
  ],
  [
    'AI services depend on a chain of physical systems that must work together. Faster processors raise demand for memory, network links, power, and cooling. Building one part without the others can leave expensive capacity underused.',
    'This is why infrastructure has moved into the center of the AI story. The pace of new products increasingly depends on whether operators can make enough reliable computing available.',
  ],
  [
    'A humanoid robot may fit spaces designed for people, but that shape alone does not make it useful. Manufacturers are testing whether such machines can perform repetitive jobs safely, handle variation, and keep working when a task does not go exactly as planned.',
    'Practical trials give a clearer answer than a polished demonstration. Workers and operators need to know where a robot helps and where a person remains the better choice.',
  ],
  [
    'The first version of a product no longer has to be the result of a large team and a long build cycle. Founders can combine ready-made services with a focused prototype, then learn from the people who try it.',
    'That faster path increases the number of ideas that can be tested. It also makes clarity more valuable: a small team still needs to know exactly which problem it is solving.',
  ],
  [
    'A longer-lasting cell needs to balance capacity with safety, charging speed, and the ability to survive many cycles. Laboratory progress can point the way, but scaling a material into an affordable product is a separate challenge.',
    'The payoff reaches beyond one device. Better storage can affect everyday electronics, transport, and the systems that use renewable power.',
  ],
  [
    'Space launches increasingly support services used on the ground. A satellite network needs vehicles to place equipment in orbit, then enough coverage and capacity to make that equipment useful to customers.',
    'The practical test is connection quality. For people outside strong terrestrial networks, a dependable link can make work, education, and emergency communication easier to reach.',
  ],
  [
    'Dense computing equipment can strain the systems around it. As operators pack more capability into each rack, they have to rethink airflow, liquid cooling, and how quickly a building can move heat away.',
    'Those decisions shape both cost and capacity. A better cooling design can allow more work from the same space while using energy more carefully.',
  ],
  [
    'Moving from a robotics pilot to a normal shift is a test of consistency. A machine must handle routine variation, make its actions understandable to nearby workers, and recover safely from mistakes.',
    'Manufacturers will keep the jobs that produce a clear benefit. The strongest uses may be narrow, repetitive tasks rather than a single robot that attempts to do everything.',
  ],
  [
    'AI tools can help a small company sketch an interface, write an early version, and gather feedback without waiting for a large development cycle. That shortens the path to the first useful question: will anyone choose to use it?',
    'Quick tests are valuable only when teams learn from them. Founders still need to listen closely, revise the product, and decide when an idea is ready for a larger commitment.',
  ],
  [
    'Portable power is a design problem as well as a materials problem. A useful battery has to fit the product, tolerate daily use, and charge at a speed that works for its owner.',
    'Small gains in several measures can add up to a better experience. The work could give future devices more freedom without asking people to carry more weight.',
  ],
  [
    'The processor remains important, but it is only one part of an AI system. Models also need fast access to memory, dependable power, and cooling that keeps equipment operating under load.',
    'That broadens the competition. Teams that design the whole system well may gain more than teams that improve a chip in isolation.',
  ],
  [
    'The most useful workplace agent may begin with an ordinary task: collect information, update a document, and ask for approval before sending a result. Completing the chain requires the software to understand where human judgment belongs.',
    'Teams are testing these boundaries in everyday work. The aim is to remove repetitive steps while making each handoff clear enough to trust.',
  ],
  [
    'New building tools allow a small team to move from an idea to a trial product quickly. That opens the door to more experiments, including ideas that once would have been too expensive to test.',
    'The advantage is strongest when founders use the extra speed to talk with customers. Shipping early helps only if the next version reflects what they learned.',
  ],
  [
    'Device makers are trying to make AI available at the moment it is needed. Voice and cameras can bring context to an assistant, but the interface must be understandable and easy to interrupt.',
    'Battery life and privacy will shape whether these products become daily tools. A novel form matters less than a clear benefit in a real setting.',
  ],
  [
    'Advanced chip supply chains rely on many specialized steps, often in different countries. New manufacturing plans aim to add capacity and reduce exposure to a disruption in any one place.',
    'Factories alone are not enough. Equipment, materials, skilled workers, and reliable trade routes must grow alongside them for production to be resilient.',
  ],
  [
    'A browser already holds much of a person’s daily work: research, forms, documents, and communication. Agent tools could connect those steps in one place, provided they make their actions visible.',
    'The central design challenge is control. People need to know what an agent has read, what it is about to change, and when it needs permission to continue.',
  ],
  [
    'A chat box is useful for asking a question, but many tasks unfold across voice, screens, and actions in the background. New interfaces are exploring how a person can move between those modes without losing context.',
    'The result should feel easier to direct, not harder to understand. Clear feedback matters when software is doing work beyond the visible conversation.',
  ],
  [
    'Search is moving toward an exchange rather than a single list of links. A useful answer can surface the next question, show where information came from, and help a person decide what to explore further.',
    'That saves effort only when the answer is trustworthy. People still need a clear path back to the sources and a way to check what the system may have missed.',
  ],
  [
    'An assistant becomes more useful when it understands a person’s documents, plans, and preferences. That context is also sensitive, so access has to be deliberate and easy to review.',
    'Good controls should make it obvious what data is available for a task and how to withdraw that access. Useful personalization depends on that trust.',
  ],
  [
    'As software gains the ability to act, its controls become part of the experience. A person should be able to see permissions, check a proposed action, and stop the process without searching through settings.',
    'Those small moments of clarity make a larger difference. People are more willing to delegate work when the boundaries remain visible.',
  ],
];

const glanceVisuals = {
  'Technology': [
    'assets/swipe-robotics.jpg', 'assets/swipe-battery.jpg', 'assets/swipe-data-center.jpg',
  ],
  'AI': ['assets/swipe-data-center.jpg', 'assets/swipe-robotics.jpg'],
  'Tech business': [
    'assets/swipe-data-center.jpg', 'assets/swipe-rocket.jpg', 'assets/swipe-battery.jpg',
  ],
  'Founders & startups': ['assets/swipe-founders.jpg', 'assets/swipe-robotics.jpg'],
  'Product launches': [
    'assets/swipe-battery.jpg', 'assets/swipe-robotics.jpg', 'assets/swipe-founders.jpg',
  ],
  'Tech geopolitics': ['assets/swipe-rocket.jpg', 'assets/swipe-data-center.jpg'],
};

const escapeStoryText = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

// Badges come from the pipeline (feed item.badges: [{id, label}]); the samples below carry a few by hand.
const badgeIcons = {
  exclusive: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m8 1 2.1 4.6 5 .6-3.7 3.4 1 5L8 12.1 3.6 14.6l1-5L.9 6.2l5-.6z"/></svg>',
  new: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="4"/></svg>',
  'most-viewed': '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8.6 1c.3 2.2-.6 3.3-1.8 4.6C5.700 6.900 4.500 8.100 4.500 10a3.500 3.500 0 0 0 7 0c0-1.500-.6-2.500-1.400-3.400-.2.900-.7 1.400-1.300 1.600.5-2.300.2-4.700-.2-7.200z"/></svg>',
  'most-read': '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 2.500h4.500A1.500 1.500 0 0 1 8 4v9.500a1.500 1.500 0 0 0-1.500-1.500H2zm12 0H9.500A1.500 1.500 0 0 0 8 4v9.500a1.500 1.500 0 0 1 1.500-1.500H14z"/></svg>',
  'most-glanced': '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3C4.500 3 2 6.100 1 8c1 1.900 3.500 5 7 5s6-3.100 7-5c-1-1.900-3.500-5-7-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3z"/></svg>',
};
const renderBadges = (badges) => (badges && badges.length)
  ? `<span class="badges">${badges.map((badge) => `<span class="badge badge-${escapeStoryText(badge.id)}">${badgeIcons[badge.id] || ''}${escapeStoryText(badge.label)}</span>`).join('')}</span>`
  : '';
const CAT_ALIAS = { founders: 'founders-startups', innovation: 'product-launches' };
const categoryClass = (category) => { const slug = String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return `cat-${CAT_ALIAS[slug] || slug}`; };

const microphoneIcon = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="12" y="4" width="8" height="16" rx="4"/><path d="M8 15a8 8 0 0 0 16 0M16 23v5M11 28h10"/></svg>';

// Ten Spotlight placements, spread evenly so none sit next to each other or a section heading:
// 5 in The Prime, 1 after the swipe cards, 3 in World at a glance, 1 at the end of the issue.
// Positions scale with the story count, so they still land well when the live feed has more or fewer stories.
const SPOTLIGHT_PRIME = 5;
const SPOTLIGHT_GLANCE = 3;
function spotlightSlots(count, slots) {
  const after = new Map(); // 1-based story number -> placement number within this section
  for (let k = 1; k <= slots; k += 1) {
    let at = Math.max(4, Math.round((count * k) / (slots + 1)));   // never right under the top stories
    while (after.has(at) && at < count - 1) at += 1;
    if (at >= 1 && at < count) after.set(at, k);
  }
  return after;
}

// "The day in numbers" and the classifieds under it close each of the three sections (Prime, Swipe cards, At a glance).
// SAMPLE CONTENT: these figures and listings are placeholders for the layout. `story` is the 1-based story inside that
// section that the number opens. Replace with figures taken from each story (pipeline) and real classifieds.
const dayNumbers = {
  prime: [
    { value: '$15B', label: 'DeepSeek’s reported funding round', story: 1 },
    { value: '$220B', label: 'Amazon’s planned 2026 capex', story: 3 },
    { value: '5,000', label: 'Barclays planned job cuts', story: 6 },
    { value: '22×', label: 'Jio Platforms IPO oversubscription', story: 9 },
    { value: '$25B', label: 'Meta’s New Mexico court penalty', story: 12 },
  ],
  swipe: [
    { value: '30 min', label: 'Starship booster turnaround target', story: 1 },
    { value: '3×', label: 'Data center compute demand by 2028', story: 2 },
    { value: '40%', label: 'Routine factory tasks in robot trials', story: 3 },
    { value: '+20%', label: 'Capacity gain the new cell targets', story: 5 },
    { value: '45°C', label: 'Server inlet limit in new cooling designs', story: 7 },
  ],
  glance: [
    { value: '$40B', label: 'Chipmakers’ planned fab spend by 2027', story: 1 },
    { value: '1 in 3', label: 'Teams now testing AI agents at work', story: 2 },
    { value: '2×', label: 'Faster from prototype to launch', story: 3 },
    { value: '5', label: 'New AI device types shown this year', story: 4 },
    { value: '12', label: 'Countries with national chip plans', story: 5 },
  ],
};
const classifiedSets = {
  prime: [
    ['Hiring', 'Founding engineer for a seed-stage logistics startup. Remote, equity.', 'jobs@northwind.example', 'https://example.com/classifieds/jobs-northwind-example'],
    ['For hire', 'Freelance motion designer for product launches and explainers.', '@framebyframe', 'https://example.com/classifieds/framebyframe'],
    ['Office', 'Two desks free in a quiet Bengaluru studio, month to month.', 'desks@studio.example', 'https://example.com/classifieds/desks-studio-example'],
  ],
  swipe: [
    ['Hiring', 'Hardware lead for a battery start-up. Lab in Pune.', 'team@cellworks.example', 'https://example.com/classifieds/team-cellworks-example'],
    ['For sale', 'Used rack servers, tested and ready to ship. Bulk prices.', 'sales@racks.example', 'https://example.com/classifieds/sales-racks-example'],
    ['Wanted', 'Co-founder with robotics experience for a warehouse pilot.', '@pilotseeker', 'https://example.com/classifieds/pilotseeker'],
  ],
  glance: [
    ['Hiring', 'Community manager for a builders’ network. Part-time.', 'join@builders.example', 'https://example.com/classifieds/join-builders-example'],
    ['Services', 'Fractional CFO for early-stage companies. First call free.', 'cfo@fractional.example', 'https://example.com/classifieds/cfo-fractional-example'],
    ['For sale', 'Domain names for AI tools, priced to move.', '@namesforsale', 'https://example.com/classifieds/namesforsale'],
  ],
};

// PULSE: short 9:16 voice-over clips (rendered by pipeline/pulse.py into public/pulse/<clip>.pulse.mp4 + .jpg).
// `ad: true` is the paid "Clip break" slot from the auction.
const pulseClips = [
  { category: 'AI', title: 'DeepSeek nears a $15B round at a $75B valuation', clip: 'deepseek', happened: 'DeepSeek is reportedly nearing a $15B funding round at a $75B valuation.', matters: 'A round this size buys chips, data and talent as the AI race speeds up.', length: '0:32' },
  { category: 'Product Launches', title: 'Apple’s foldable iPhone Duo goes on sale at $1,999', clip: 'apple-duo', happened: 'Apple’s foldable iPhone Duo is now on sale at $1,999.', matters: 'It tests whether buyers will pay a premium for a phone that folds.', length: '0:26' },
  { category: 'AI', title: 'Moonshot’s Kimi K3.1 Pro beats GPT-6 Astra on a key coding test', clip: 'kimi', happened: 'Moonshot’s Kimi K3.1 Pro beat GPT-6 Astra on a key coding test.', matters: 'Coding is where AI earns its money, so a lead can move developers.', length: '0:28' },
  { ad: true, title: 'Every street, mapped', length: '0:24', won: 'Won at $520 today' },
  { category: 'Tech Business', title: 'Amazon’s cloud is sold out through 2027, Andy Jassy says', clip: 'amazon-cloud', happened: 'CEO Andy Jassy says Amazon’s cloud capacity is sold out through 2027.', matters: 'Demand for AI computing is outrunning supply, so customers book years ahead.', length: '0:27' },
  { category: 'Founders & Startups', title: 'Year-old Flapping Airplanes raises $1B at a $6B valuation', clip: 'flapping-airplanes', happened: 'Year-old Flapping Airplanes raised $1B at a $6B valuation.', matters: 'Investors are backing teams early, which shows how hot the market is.', length: '0:24' },
  { category: 'Technology', title: 'Chipmakers race to ship 2nm processors in volume', clip: 'chipmakers-2nm', happened: 'Chipmakers are racing to ship 2nm processors in volume.', matters: 'Smaller chips mean faster devices and cheaper AI, so who ships first matters.', length: '0:25' },
  { category: 'Tech Geopolitics', title: 'Countries redraw the map for advanced chips', clip: 'chip-map', happened: 'Countries are redrawing the map for advanced chips.', matters: 'Chips are now a national priority tied to trade and security.', length: '0:22' },
];

function renderPulse() {
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const shown = pulseClips.filter((clip) => !clip.ad).slice(0, 3);   // three clips, never more (the paid "Clip break" slot is not shown for now)
  const cards = shown.map((clip) => `
      <li class="pulse-item">
        <div class="pulse-card ${categoryClass(clip.category)}" data-clip="${clip.clip}" role="group" aria-label="Clip: ${escapeStoryText(clip.title)}">
          <video class="pulse-video" src="pulse/${clip.clip}.pulse.mp4?v=10" poster="pulse/${clip.clip}.pulse.jpg?v=10" playsinline preload="metadata" disablepictureinpicture controlslist="nodownload noremoteplayback" tabindex="-1" aria-hidden="true"></video>
          <button class="pulse-hit" type="button" data-pulse-clip aria-label="Play or pause clip: ${escapeStoryText(clip.title)}"></button>
          <span class="pulse-play" aria-hidden="true">${playIcon}</span>
          <div class="pulse-actions">
            <button class="pulse-action" type="button" data-pulse-share aria-label="Share: ${escapeStoryText(clip.title)}" title="Share"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></svg></button>
            <button class="pulse-action" type="button" data-pulse-share-video hidden aria-label="Share the video file: ${escapeStoryText(clip.title)}" title="Share the video"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg></button>
          </div>
          <div class="pulse-next" hidden role="status">
            <button class="pulse-next-scrim" type="button" data-next-stay aria-label="Stay on this clip"></button>
            <div class="pulse-next-box">
              <span class="next-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /></svg><svg class="next-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 5.500v13l9-6.500zM17 5.500h2v13h-2z" /></svg></span>
              <p class="pulse-next-label" aria-live="polite"></p>
              <p class="pulse-next-hint">Tap to stay</p>
            </div>
          </div>
          <div class="swipe-copy pulse-copy">
            <span class="swipe-tags"><span class="swipe-category">${escapeStoryText(clip.category)}</span></span>
            <h2 class="pulse-headline">${escapeStoryText(clip.title)}</h2>
            <div class="swipe-facts">
              <div><h3>What happened</h3><p>${escapeStoryText(clip.happened)}</p></div>
              <div><h3>Why it matters</h3><p>${escapeStoryText(clip.matters)}</p></div>
            </div>
            <div class="swipe-byline-row">${renderByline({}, true, clip.length + ' watch')}</div>
          </div>
        </div>
      </li>`).join('');
  return `
    <section class="pulse-block" aria-labelledby="pulse-heading">
      <div class="section-break" aria-hidden="true"><span></span><span></span><span></span></div>
      <header class="section-marker"><h2 id="pulse-heading">Pulse</h2>${storyCount(shown.length, 'clip', 'clips', 'swipe →')}</header>
      <ul class="pulse-rail" aria-label="Short video clips">${cards}</ul>
    </section>`;
}

function renderDayNumbers(key, firstStoryNumber, storyCount) {
  const items = dayNumbers[key]
    .filter((item) => item.story <= storyCount)
    .map((item) => `
      <li><button class="day-number" type="button" data-open-story="${firstStoryNumber + item.story - 1}">
        <strong>${escapeStoryText(item.value)}</strong><span>${escapeStoryText(item.label)}</span>
      </button></li>`).join('');
  if (!items) return '';
  return `
    <section class="day-numbers" aria-labelledby="day-numbers-${key}">
      <header><h3 id="day-numbers-${key}">The day in numbers</h3><span class="day-numbers-hint">tap a number for the story</span></header>
      <ul>${items}</ul>
    </section>`;
}

// A listing's website is typed by the advertiser, so only http(s) addresses are ever linked (never javascript: and the like).
function safeWebsite(value) {
  try {
    const text = String(value).trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);   // "shop.com" means https://shop.com
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch (e) { return ''; }
}

const CLASSIFIED_MARKET = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? `${location.protocol}//${location.hostname}:3000/` : '/';   // same address as the end-of-issue classifieds
function renderClassifieds(key) {
  const items = classifiedSets[key].map(([tag, text, contact, website]) => {
    const href = safeWebsite(website);
    const body = href
      ? `<a class="classified-link" href="${escapeStoryText(href)}" target="_blank" rel="noopener noreferrer sponsored">${escapeStoryText(text)}<span class="classified-out" aria-hidden="true"> ↗</span><span class="sr-only"> (opens the advertiser’s website)</span></a>`
      : escapeStoryText(text);
    return `
      <li><span class="classified-tag">${escapeStoryText(tag)}</span><p>${body} <span class="classified-contact">${escapeStoryText(contact)}</span></p></li>`;
  }).join('');
  return `
    <section class="classifieds" aria-labelledby="classifieds-${key}">
      <header><h3 id="classifieds-${key}">Classifieds</h3></header>
      <ul>${items}</ul>
      <a class="classified-place" href="${CLASSIFIED_MARKET}" data-leave-confirm>Place a line in an upcoming issue</a>
    </section>`;
}

function renderSpotlightPlacement(number) {
  return `
    <figure class="spotlight-placement" id="spotlight-${number}" aria-label="Bought Spotlight placement">
      <figcaption class="spotlight-label">Bought Spotlight <span class="spotlight-dot" aria-hidden="true"></span></figcaption>
      <img src="assets/bought-spotlight-placement.webp" alt="A presenter on screen with the quote: Your design system is productivity theatre." loading="lazy">
    </figure>`;
}

// SAMPLE text: the live feed carries a headline and a summary only, so "Why it matters" falls back to one line per section until the
// pipeline supplies a real one (item.why_it_matters). Replace these when the feed has it.
const SAMPLE_WHY = {
  'ai': 'The test for AI is shifting from clever demos to dependable, everyday work.',
  'technology': 'The next gains may come from the whole system, not from one component.',
  'tech business': 'Where the money moves first shows which bets the industry believes in.',
  'founders': 'What founders do under pressure is an early signal for the companies that follow.',
  'product launches': 'Launches show what people will be offered, and what they will be asked to pay for.',
  'tech geopolitics': 'Rules and supply lines set what technology can be built, and where.',
};
const PRIME_COUNT = 20;   // how many Prime stories one issue carries
// ---- The issue is six sections of 50 stories: Technology, AI, Tech business and Founders & startups carry 10 each, Product launches and Tech
// geopolitics 5 each. A story goes to the section named by its topic (live feed: Prime, cards and glance lists together; stories with a video
// are picked first). When a topic has fewer stories than its section, the rest come from the hand-written sample stories above and the
// SAMPLE_GEO ones below (the feed has no Tech geopolitics yet). Inside a section the cards mix video, photo and text.
const SECTIONS = [['Technology', 10], ['AI', 10], ['Tech business', 10], ['Founders & startups', 10], ['Product launches', 5], ['Tech geopolitics', 5]];   // the order of the issue and how many stories each section carries (50 in all)
const CANON = { business: 'Tech business', innovation: 'Product launches', founders: 'Founders & startups' };
const canon = (c) => CANON[String(c).toLowerCase()] || c;
// SAMPLE text for the topic the feed does not cover yet.
const SAMPLE_GEO = [
  { title: 'Export rules for AI chips tighten again', deck: 'New limits widen the list of processors that need a licence to leave the country.', matters: 'Supply rules now decide which labs can train the largest models, and where.' },
  { title: 'A chip plant in a new region changes the supply map', deck: 'The planned fab would give buyers a second source outside the usual two or three hubs.', matters: 'Spreading manufacturing lowers one risk and raises the cost of everything else.' },
  { title: 'A trade deal puts battery and chip materials on the table', deck: 'Negotiators are trading access to minerals and components that nearly every device depends on.', matters: 'Whoever controls the raw inputs gets a say in who can make the finished product.' },
  { title: 'Undersea cables become a security question', deck: 'Governments are asking who owns, repairs and protects the lines that carry most internet traffic.', matters: 'The physical internet is thinner than it looks, and a few cuts can slow whole regions.' },
];
function buildSections() {
  const visuals = (cat, k) => (glanceVisuals[cat] || glanceVisuals.Technology)[k % (glanceVisuals[cat] || glanceVisuals.Technology).length];
  const pool = [], seen = new Set();
  const feed = window.liveFeed;
  if (feed) {
    ['prime', 'cards', 'glance'].forEach((list) => (feed[list] || []).forEach((item, i) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      const cat = canon(item.category), hasVideo = list === 'prime' && i < PRIME_COUNT;
      pool.push({
        category: cat, title: item.headline, deck: item.summary, happened: item.happened || item.summary,
        matters: item.why_it_matters || SAMPLE_WHY[String(cat).toLowerCase()] || SAMPLE_WHY.technology,
        image: hasVideo ? item.image_url : visuals(cat, pool.length), imageAlt: '', imagePosition: 'center 42%',
        ...(hasVideo ? { video: `prime/${item.id}.mp4?v=5`, poster: `prime/${item.id}.jpg?v=5` } : { isImage: true }),
        badges: item.badges || [], id: item.id, audio: item.audio_url || '', source: item.source, link: item.link,
        seconds: Number(item.duration_s) || 0, script: item.script || '',
      });
    }));
  }
  const spare = [...sampleStories, ...imageStories, ...glanceStories].map((st, k) => ({ ...st, category: canon(st.category), image: st.image || visuals(canon(st.category), k), imageAlt: st.imageAlt || st.alt || '', imagePosition: st.imagePosition || 'center 42%', happened: st.happened || st.deck, isImage: !st.video }));
  const geo = SAMPLE_GEO.map((g, k) => ({ category: 'Tech geopolitics', ...g, happened: g.deck, image: visuals('Tech geopolitics', k), imageAlt: '', imagePosition: 'center 42%', isImage: true }));
  return SECTIONS.map(([name, size]) => {
    const take = (list) => list.filter((st) => st.category === name).sort((x, y) => (y.video ? 1 : 0) - (x.video ? 1 : 0));
    const chosen = [];
    [pool, spare, geo].forEach((src) => take(src).forEach((st) => { if (chosen.length < size) chosen.push(st); }));
    return { name, stories: chosen };
  }).filter((sec) => sec.stories.length);
}
const sections = buildSections();
// the rest of the page reads one flat list in display order, so story numbers, Prev/Next and the reader all follow the sections
sampleStories.splice(0, sampleStories.length, ...sections.flatMap((sec) => sec.stories));
imageStories.splice(0);
glanceStories.splice(0);
const STORY_TOTAL = sampleStories.length;   // "N / total" on every card and in the reader

// ---- "Most read today": exactly ONE story in the whole issue carries this: the Most viewed badge plus a "2,341 read this" strip with
// a few reader circles. Any other most-viewed / most-read / most-glanced badge (from the feed or the hand-written samples) is dropped.
// SAMPLE number: there is no reader analytics yet; mostReadToday() is the one place to return the real top story and its count.
function mostReadToday() { return { id: '5a04354ee842f3fe', readers: 2341 }; }
(() => {
  [...sampleStories, ...imageStories, ...glanceStories].forEach((st) => { st.badges = (st.badges || []).filter((b) => !/^most-/.test(b.id)); });
  const top = mostReadToday();
  const story = sampleStories.find((st) => st.id === top.id) || sampleStories[0];
  story.badges = [...story.badges, { id: 'most-viewed', label: 'Most viewed' }];
  story.readers = top.readers;
})();

const JOURNALIST_NAME = 'Nastya';
const storyCount = (count, one = 'story', many = 'stories', hint = '') => `<span class="section-count">${count} ${count === 1 ? one : many}${hint ? `<span class="section-hint">${hint}</span>` : ''}</span>`;

// Who presents the story and where it comes from: [N] Nastya · source. Swipe cards and glances have no presenter, so
// they only show the source, and only when the story has one.
// Stories you have opened in the reader get a small READ tag beside the byline (kept in this browser), as in the Bought. Daily design.
const READ_TAG = '<span class="readtag">Read</span>';
const readStories = new Set((() => { try { return Object.keys(JSON.parse(localStorage.getItem('bought-read') || '{}')); } catch (_) { return []; } })());
function markStoryRead(story) {
  const key = story.id || story.title;
  if (readStories.has(key)) return;
  readStories.add(key);
  try { localStorage.setItem('bought-read', JSON.stringify(Object.fromEntries([...readStories].map((k) => [k, 1])))); } catch (_) { /* kept for this visit */ }
  document.querySelectorAll('.lead-story, .swipe-slide, .glance-item').forEach((el) => {
    if (el.querySelector('h2')?.textContent.trim() === story.title) el.querySelector('.story-byline')?.insertAdjacentHTML('beforeend', READ_TAG);
  });
}
// The comment count on a card: shown exactly when the story has a discussion inside. Opens the story at its discussion.
function renderCardTalk(story, number) {
  if (!window.boughtDiscussion || !story.id || !window.boughtDiscussion.has(story.id)) return '';
  const n = window.boughtDiscussion.count(story.id);
  return `<button class="rd-talk" type="button" data-open-story="${number}" data-to-discussion data-talk-for="${escapeStoryText(story.id)}" aria-label="${n} comments, open the discussion"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><b>${n}</b></button>`;
}
function renderByline(story, withPresenter, readTime = '') {
  const source = story.source
    ? (story.link ? `<a class="byline-source" href="${escapeStoryText(story.link)}" target="_blank" rel="noopener noreferrer">${escapeStoryText(story.source)}</a>` : `<span class="byline-source">${escapeStoryText(story.source)}</span>`)
    : '';
  if (!withPresenter && !source && !readTime) return '';
  const presenter = withPresenter
    ? `<i class="byline-avatar" aria-hidden="true">${escapeStoryText(JOURNALIST_NAME.charAt(0))}</i><span class="byline-name">${escapeStoryText(JOURNALIST_NAME)}</span>`
    : '';
  const dot = withPresenter && source ? '<span class="byline-dot" aria-hidden="true">·</span>' : '';
  const read = readTime ? `${presenter || source ? '<span class="byline-dot" aria-hidden="true">·</span>' : ''}<span class="story-readtime">${escapeStoryText(readTime)}</span>` : '';
  return `<span class="story-byline">${presenter}${dot}${source}${read}${readStories.has(story.id || story.title) ? READ_TAG : ''}</span>`;
}

// Reading time from the text we hold for the story (about 200 words a minute, never under 1 minute).
function readMinutes(...parts) {
  const words = parts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
// The format line beside the section label, as in the Bought. Daily design: "▶ Video inside · 3 min" or "Text · 2 min"
function renderFormat(number, story) {
  const mins = readTimeLabel(number, story).replace(/\D+$/, '').replace(/ min.*/, '');
  if (story.isImage) return `<span class="fmtb">Photo · ${mins} min</span>`;
  return story.video
    ? `<span class="fmtb"><i aria-hidden="true"></i>${story.seconds ? `${Math.floor(story.seconds / 60)}:${String(Math.round(story.seconds % 60)).padStart(2, '0')} · ` : ''}${mins} min</span>`
    : `<span class="fmtb">Text · ${mins} min</span>`;
}
function readTimeLabel(number, story) {
  const detail = story.link ? [] : articleDetails[number - 1] || [story.happened, story.matters];
  return `${readMinutes(story.deck, story.happened, story.matters, ...detail)} min read`;
}

// ---- "Stories that know a little about you": an honest reason on a story ("Because you read AI", "Near you · Bengaluru"), on at most 3
// stories per issue (2 by topic, 1 by place). It only labels; it does not re-rank anything. WHERE THE DATA COMES FROM IS NOT DECIDED:
// personalSignals() is the one place to change. Today it reads a profile from localStorage ('bought-profile', e.g.
// {"topics":["AI"],"city":"Bengaluru"}) and otherwise uses a SAMPLE profile. Real options: the on-device reading history (private, no
// backend), a signed-in account, or a city the reader picks. STORY_PLACES says which stories are local to a place: also SAMPLE data.
const SAMPLE_PROFILE = { topics: ['AI'], city: 'Bengaluru' };
const STORY_PLACES = { '8d12cdc02eef3e38': 'Bengaluru' };   // sample: "Cloud providers expand server capacity as demand rises"
function personalSignals() {
  try { const p = JSON.parse(localStorage.getItem('bought-profile') || 'null'); if (p && typeof p === 'object') return { topics: p.topics || [], city: p.city || null }; } catch (_) { /* use the sample */ }
  return SAMPLE_PROFILE;
}
let reasonMap = null;
function buildReasons() {   // story id -> { kind, text }, at most 2 by topic then 1 by place
  const map = {}, { topics, city } = personalSignals();
  let byTopic = 0, byPlace = 0;
  for (const story of sampleStories) {
    if (!story.id) continue;
    if (byPlace < 1 && city && STORY_PLACES[story.id] === city) { map[story.id] = { kind: 'place', text: `Near you · ${city}` }; byPlace += 1; }
    else if (byTopic < 2 && topics.includes(story.category)) { map[story.id] = { kind: 'topic', text: `Because you read ${story.category}` }; byTopic += 1; }
  }
  return map;
}
function renderReason(story) {
  if (!story.id) return '';
  reasonMap = reasonMap || buildReasons();
  const r = reasonMap[story.id];
  return r ? `<p class="story-reason"><span class="reason-badge is-${r.kind}">${escapeStoryText(r.text)}</span></p>` : '';
}

// ---- ENGAGEMENT STRATEGIES. Only the 20 most interesting of the 50 stories get one, and then exactly ONE, never two or three, chosen from what the news is:
//   Yes / No    a personal or civic choice ("Would you...?", "Should your city...?"): consumer products, services, everyday decisions
//   Agree / Disagree   a contested claim or policy: rules and regulation, "X is better than Y", public-money questions
//   Prediction  a forward-looking event that can be checked later (launch, trial, deadline): scored on the reader's record, no money
//   Slider      a risk, trust or comfort story where strength of feeling is the point: jobs, privacy, health, security
//   Reactions   plain facts with nothing to vote on (earnings, stock moves, funding, infrastructure, science milestones), and any
//               sensitive story where a poll would feel wrong. This is also the default when no question has been written.
// Order of choosing: sensitive -> Reactions; checkable future event -> Prediction; risk or trust -> Slider; contested claim ->
// Agree / Disagree; personal choice -> Yes / No; anything else -> Reactions. Then a variety pass: the same strategy never sits on two
// stories in a row, and no strategy goes past a third of the issue. Every answer (not Reactions) can be turned into a share card.
// Answers and reactions are kept on this device (localStorage). The crowd numbers (percentages, the average reader, reaction counts)
// are SAMPLE numbers seeded from the story id, plus your own tap, until a real backend counts everyone: replace crowdFor() and
// reactCounts() with calls to it and nothing else changes. A story with no entry below gets Reactions.
const YN = ['Yes', 'No'], AD = ['Agree', 'Disagree'];
const poll = (q, labels) => ({ type: 'poll', q, labels });
const ENGAGE = {
  // 1 Chipmakers race to ship 2nm chips: a checkable milestone
  '293873247e6ba2c1': { type: 'predict', q: 'Will a phone with a 2nm chip be on sale before 2027?', labels: ['Yes, before 2027', 'No, later'], by: 'December 31, 2026' },
  // 2 Satellite broadband reaches remote schools: public-money question
  'ec0d5009476c4c94': poll('Satellite internet for remote schools should be free.', AD),
  // 5 Faster-charging batteries for city buses: civic choice
  '402ad39f9a1b17ab': poll('Should your city switch every bus to electric?', YN),
  // 6 AI agents move from prompts to tasks: trust
  '8f4bf0dde4bfd4fb': { type: 'slider', kicker: 'How much would you trust it?', q: 'An AI agent acting for you: booking, buying, replying', lo: 'Not at all', hi: 'Completely', word: 'trusting', avg: 41 },
  // 7 The AI race runs through the data center: a values trade-off
  '5a04354ee842f3fe': poll('Do you want a forest over a data center?', YN),
  // 8 Phishing kits: risk
  'bd16eca1270ba10e': { type: 'slider', kicker: 'How worried are you?', q: 'A wave of AI-built phishing kits', lo: 'Not worried', hi: 'Very worried', word: 'worried', avg: 68 },
  // 9 A smaller model rivals larger ones: contested claim
  'f484e19f4ae82b9e': poll('Smaller AI models are better than giant ones.', AD),
  // 11 Hospitals test AI note-taking: comfort with health data
  '2e9c7e5be873cc6b': { type: 'slider', kicker: 'How comfortable are you?', q: 'AI taking notes at your doctor visit', lo: 'Not comfortable', hi: 'Very comfortable', word: 'comfortable', avg: 47 },
  // 12 Humanoid robots begin warehouse trials: a checkable milestone
  '6cad623749cfa265': { type: 'predict', q: 'Will humanoid robots work a full shift in a major warehouse by 2027?', labels: ['Yes, by 2027', 'No, later'], by: 'December 31, 2027' },
  // 14 Regulators draft rules for AI ads: contested policy
  '2cf54d72426f9a35': poll('AI-made ads should always be labelled.', AD),
  // 18 Streaming giant tests a cheaper ad tier: consumer choice
  '28b9fedabc16067f': poll('Would you watch ads to pay less for streaming?', YN),
  // 20 Smaller teams build faster: jobs
  'f33a68d18fc8f517': { type: 'slider', kicker: 'How concerned are you?', q: 'AI replacing entry-level coding jobs', lo: 'Not worried', hi: 'Very worried', word: 'worried', avg: 64 },
  // ---- World at a glance: one strategy per story, same rules (keyed by position in the section)
  // 1 The chip race moves beyond the processor: a trend, nothing to vote on
  // 2 Agents find a place in everyday work: trust
  'glance-2': { type: 'slider', kicker: 'How much would you hand over?', q: 'AI agents doing parts of your everyday work', lo: 'Nothing', hi: 'Everything', word: 'comfortable', avg: 52 },
  // 4 A new wave of devices puts AI on the go: consumer choice
  'glance-4': poll('Would you wear an AI device all day?', YN),
  // 5 Countries redraw the map for advanced chips: a checkable event
  'glance-5': { type: 'predict', q: 'Will the US and China agree a chip trade deal by 2028?', labels: ['Yes, by 2028', 'No, later'], by: 'December 31, 2028' },
  // 9 Private data becomes useful context: privacy trade-off
  'glance-9': poll('Would you share private data with an assistant to get better help?', YN),
  // 12 Data center power becomes the bottleneck: risk
  'glance-12': { type: 'slider', kicker: 'How worried are you?', q: 'AI’s appetite for electricity', lo: 'Not worried', hi: 'Very worried', word: 'worried', avg: 57 },
  // 13 Early customers shape the first product: no entry, so Reactions. (Also Reactions: 1.)
  // No entry (Reactions) in the Prime section: 3 quantum error correction, 10 cloud capacity, 13 chip stocks, 15 software prices, 17 voice assistants.
};
// Only 20 of the 50 stories carry an engagement strategy (the interesting ones): 17 above plus these 3 with Reactions. All others show none.
const REACT_ON = new Set(['1a0ad868f6c9c489', 'ec45826166dfe7e5', 'glance-1']);
const REACTIONS = [['impressive', '🤯', 'Impressive'], ['concerning', '😬', 'Concerning'], ['overhyped', '🙄', 'Overhyped'], ['unknown', '💡', 'Didn’t know']];
const stateKey = 'bought-engage', reactKey = 'bought-reacts';
const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (_) { return {}; } };
// One-time clean-up (2026-11-04): clears the answers and reactions saved on this device while the engagement design was being reworked.
try { if (localStorage.getItem('bought-engage-reset') !== '2026-11-04') { localStorage.removeItem(stateKey); localStorage.removeItem(reactKey); localStorage.setItem('bought-engage-reset', '2026-11-04'); } } catch (_) { /* nothing saved to clear */ }
const engageState = readJson(stateKey), reactState = readJson(reactKey);
const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* kept for this visit */ } };
const seedOf = (text) => { let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
function crowdFor(id, mine) {   // poll: [% for the first answer, % for the second]
  const h = seedOf(id), total = 700 + (h % 900), a = Math.round(total * (0.36 + (h % 33) / 100));
  const pa = Math.round(((a + (mine === 'a' ? 1 : 0)) / (total + (mine ? 1 : 0))) * 100);
  return [pa, 100 - pa];
}
const reactCounts = (id) => Object.fromEntries(REACTIONS.map(([k], i) => [k, 20 + (seedOf(id + k) % (200 - i * 25))]));
const normalCdf = (z) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));   // good enough for "more worried than X% of readers"
function resultCard(id) {   // what the share card says, from your answer
  const e = ENGAGE[id], v = engageState[id];
  if (v === undefined) return null;
  if (e.type === 'poll') {
    const split = crowdFor(id, v), mine = v === 'a' ? split[0] : split[1], label = e.labels[v === 'a' ? 0 : 1];
    return { kicker: 'My take', headline: mine >= 50 ? `${mine}% of readers agree with me` : `I’m in the ${mine}% who said ${label}`, sub: e.q, pct: mine, tail: `I said ${label}` };
  }
  if (e.type === 'slider') {
    const p = Math.round(normalCdf((v - e.avg) / 24) * 100);
    return { kicker: 'My take', headline: v >= e.avg ? `I’m more ${e.word} than ${p}% of readers` : `I’m less ${e.word} than ${100 - p}% of readers`, sub: e.q, pct: v, tail: `Me: ${v} · Average reader: ${e.avg}` };
  }
  return { kicker: 'My prediction', headline: `I’m calling it: ${e.labels[v === 'a' ? 0 : 1]}`, sub: e.q, pct: null, tail: `Resolves by ${e.by}` };
}
// Right after you answer, the share button floats over your result (which is blurred a little). Tap the ✕ or the blur to see the result.
const freshAnswer = new Set();
const shareOver = (id) => freshAnswer.has(id)
  ? `<div class="share-over" data-dismiss-share><button class="poll-share" type="button" data-share-card>Share your result</button><button class="share-over-x" type="button" data-dismiss-share aria-label="Show my result">×</button></div>`
  : '';
function renderEngageInner(id) {
  const e = ENGAGE[id], v = engageState[id];
  const head = (kicker) => `<span class="poll-label">${escapeStoryText(kicker)}</span><p class="poll-q" id="poll-q-${id}">${escapeStoryText(e.q)}</p>`;
  const shareBtn = `<button class="poll-share" type="button" data-share-card>Share your result</button>`;   // opens the result card as a popup
  if (e.type === 'slider') {   // no save button: the number is final when you let go, and you can drag again to change it
    const done = v !== undefined;
    return `${head(e.kicker)}<div class="slider-wrap"><input class="slider" type="range" min="0" max="100" value="${done ? v : 50}" aria-label="${escapeStoryText(e.q)}: ${e.lo} to ${e.hi}"><i class="slider-avg" style="left:${e.avg}%"${done ? '' : ' hidden'} title="Average reader"></i></div>
      <div class="slider-ends"><span>${e.lo}</span><span>${e.hi}</span></div>
      <div class="engage-foot"><p class="slider-you">You: <b>${done ? v : 50}</b><span class="slider-avgtext"${done ? '' : ' hidden'}> · Average reader: <b>${e.avg}</b></span></p>${shareBtn.replace('<button ', `<button${done ? '' : ' hidden'} `)}</div>`;
  }
  if (e.type === 'predict') {
    if (v === undefined) {
      return `${head('Open prediction')}<div class="poll-choices" role="group" aria-labelledby="poll-q-${id}">
        <button class="poll-choice" type="button" data-poll-vote="a">${e.labels[0]}</button><button class="poll-choice" type="button" data-poll-vote="b">${e.labels[1]}</button></div>
        <p class="poll-note">Scored on your profile once it resolves. No money involved.</p>`;
    }
    const open = Object.keys(engageState).filter((k) => ENGAGE[k] && ENGAGE[k].type === 'predict').length;
    const cells = ['a', 'b'].map((k, i) => `<div class="poll-row${v === k ? ' is-mine' : ''}"><span class="poll-fill"></span><span class="poll-name">${e.labels[i]}${v === k ? ' <i aria-hidden="true">✓</i>' : ''}</span></div>`).join('');
    return `${head('Open prediction')}<div class="poll-reveal"><div class="poll-results${freshAnswer.has(id) ? ' is-blurred' : ''}" role="status">${cells}</div>${shareOver(id)}</div>
      <div class="engage-foot"><p class="poll-note">Resolves by ${e.by} · ${open} open ${open === 1 ? 'prediction' : 'predictions'}</p>${freshAnswer.has(id) ? '' : shareBtn}</div>`;
  }
  if (v === undefined) {   // poll
    return `${head('Your take')}<div class="poll-choices" role="group" aria-labelledby="poll-q-${id}">
      <button class="poll-choice" type="button" data-poll-vote="a">${e.labels[0]}</button><button class="poll-choice" type="button" data-poll-vote="b">${e.labels[1]}</button></div>`;
  }
  const split = crowdFor(id, v);
  const rows = ['a', 'b'].map((k, i) => `<div class="poll-row${v === k ? ' is-mine' : ''}"><span class="poll-fill" style="width:${split[i]}%"></span><span class="poll-name">${e.labels[i]}${v === k ? ' <i aria-hidden="true">✓</i>' : ''}</span><b>${split[i]}%</b></div>`).join('');
  return `${head('Your take')}<div class="poll-reveal"><div class="poll-results${freshAnswer.has(id) ? ' is-blurred' : ''}" role="status">${rows}</div>${shareOver(id)}</div><div class="engage-foot"><p class="poll-note">You voted <b>${e.labels[v === 'a' ? 0 : 1]}</b>.</p>${freshAnswer.has(id) ? '' : shareBtn}</div>`;
}
const renderEngage = (story) => (story.id && ENGAGE[story.id]) ? `<div class="story-poll" data-poll="${story.id}" data-kind="${ENGAGE[story.id].type}">${renderEngageInner(story.id)}</div>` : '';
function renderReacts(story) {
  if (!story.id || ENGAGE[story.id] || !REACT_ON.has(story.id)) return '';   // one strategy per story, and only 20 of the 50 stories get one at all
  const counts = reactCounts(story.id), mine = (reactState[story.id] || []).slice(0, 1);
  return `<div class="story-reacts${mine.length ? ' has-choice' : ''}" data-react-for="${story.id}" role="group" aria-label="React to this story"><span class="poll-label">React</span><div class="react-row">${REACTIONS.map(([k, emoji, name]) => {
    const on = mine.includes(k);
    return `<button class="react-btn${on ? ' is-on' : ''}" type="button" data-react="${k}" aria-pressed="${on}"><span class="react-emoji" aria-hidden="true">${emoji}</span>${name} <b>${counts[k] + (on ? 1 : 0)}</b></button>`;
  }).join('')}</div></div>`;
}

// The share card: a small branded image of your answer, made to be saved or posted. Drawn on a canvas so it can be shared as a file.
async function buildResultCard(id) {
  const d = resultCard(id), W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  await Promise.all(['700 80px Newsreader', '400 40px "DM Sans"'].map((f) => document.fonts.load(f).catch(() => {})));
  const accent = getComputedStyle(document.querySelector(`[data-poll="${id}"]`)).getPropertyValue('--cat').trim() || '#ad4038';
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#efece5'); g.addColorStop(1, '#bdb6a8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#16150f'; ctx.font = '700 86px Newsreader, Georgia, serif'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Bought', 90, 170); const w = ctx.measureText('Bought').width; ctx.fillStyle = accent; ctx.fillText('.', 90 + w, 170);
  ctx.fillStyle = accent; ctx.font = '700 30px "DM Sans", Arial, sans-serif'; ctx.fillText(d.kicker.toUpperCase().split('').join(' '), 90, 330);
  const wrap = (text, font, maxw) => { ctx.font = font; const out = []; let cur = ''; for (const wd of text.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxw && cur) { out.push(cur); cur = wd; } else cur = t; } return out.concat(cur); };
  let y = 440; ctx.fillStyle = '#16150f';
  for (const ln of wrap(d.headline, '700 104px Newsreader, Georgia, serif', W - 180).slice(0, 4)) { ctx.fillText(ln, 90, y); y += 120; }
  y += 20; ctx.fillStyle = '#45403a';
  for (const ln of wrap(d.sub, '400 44px "DM Sans", Arial, sans-serif', W - 180).slice(0, 3)) { ctx.fillText(ln, 90, y); y += 60; }
  if (d.pct !== null) {
    const by = 1050; ctx.fillStyle = 'rgba(22,21,15,.18)'; ctx.beginPath(); ctx.roundRect(90, by, W - 180, 36, 18); ctx.fill();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(90, by, Math.max(36, (W - 180) * d.pct / 100), 36, 18); ctx.fill();
  }
  ctx.fillStyle = '#16150f'; ctx.font = '700 40px "DM Sans", Arial, sans-serif'; ctx.fillText(d.tail, 90, 1160);
  ctx.fillStyle = '#625a51'; ctx.font = '400 32px "DM Sans", Arial, sans-serif'; ctx.fillText('What’s your take?  Today’s issue on Bought.', 90, 1250);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}
// The card only appears when the Share button is pressed: a popup with the picture, a Share button (phones) and Save image.
let cardPopup = null, cardTrigger = null;
function closeCardPopup() {
  if (!cardPopup || cardPopup.hidden) return;
  cardPopup.hidden = true;
  URL.revokeObjectURL(cardPopup.querySelector('img').src);
  document.body.style.overflow = '';
  cardTrigger?.focus();
}
async function openCardPopup(id, trigger) {
  cardTrigger = trigger;
  if (!cardPopup) {
    cardPopup = document.createElement('div');
    cardPopup.className = 'card-popup'; cardPopup.hidden = true;
    cardPopup.setAttribute('role', 'dialog'); cardPopup.setAttribute('aria-modal', 'true'); cardPopup.setAttribute('aria-label', 'Your result card');
    cardPopup.innerHTML = `<div class="card-popup-box"><button class="card-popup-close" type="button" aria-label="Close">×</button><img class="card-popup-img" alt="Your result card, ready to share"><div class="card-popup-actions"><button class="card-popup-share" type="button">Share</button><button class="card-popup-save" type="button">Save image</button></div></div>`;
    document.body.append(cardPopup);
    cardPopup.addEventListener('click', (event) => { if (event.target === cardPopup || event.target.closest('.card-popup-close')) closeCardPopup(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCardPopup(); });
    cardPopup.querySelector('.card-popup-save').addEventListener('click', () => {
      const a = document.createElement('a'); a.href = cardPopup.querySelector('img').src; a.download = 'bought-my-take.png'; a.click(); showActionFeedback('Card saved');
    });
    cardPopup.querySelector('.card-popup-share').addEventListener('click', async () => {
      const file = new File([cardPopup._blob], 'bought-my-take.png', { type: 'image/png' }), id2 = cardPopup.dataset.id;
      try { await navigator.share({ files: [file], title: 'My take on Bought.', url: id2.startsWith('glance-') ? location.origin + location.pathname : sharePageUrl(id2) }); }
      catch (error) { if (error.name !== 'AbortError') showActionFeedback('Could not share the card'); }
    });
  }
  const blob = await buildResultCard(id);
  cardPopup._blob = blob; cardPopup.dataset.id = id;
  cardPopup.querySelector('img').src = URL.createObjectURL(blob);
  cardPopup.querySelector('.card-popup-share').hidden = !canShareFiles;
  cardPopup.hidden = false;
  document.body.style.overflow = 'hidden';
  cardPopup.querySelector('.card-popup-close').focus();
}

// The Prime is "the important news", laid out like the Bought. Daily design: the first three in one ranked row, then a grid that mixes
// formats: a wide video story, two medium cards (one video, one text), then three small text stories, and again.
// A 'text' card shows no picture and says "Text"; a 'video' card shows the player.
function primeShape(index, story = {}) {
  // a video slot with no video behind it shows the story's photo instead; text slots stay text
  const media = (slot) => (slot === 'video' && !story.video ? 'image' : slot);
  if (index === 0) return { size: 'lead', media: media('video') };   // the lead story: big video beside a big headline
  if (index < 4) return { size: 'top', media: media(index < 3 ? 'video' : 'text'), rank: index };
  const at = (index - 4) % 6;
  return { size: ['xl', 'm', 'm', 's', 's', 's'][at], media: media(['video', 'video', 'text', 'text', 'text', 'text'][at]) };
}
function renderStory(story, number, saveKey = number, shape = {}) {
  const loading = number === 1 ? 'eager' : 'lazy';
  const showMedia = shape.media !== 'text';
  const asText = !showMedia ? { ...story, video: '', isImage: false } : story;
  return `
    <article class="lead-story ${categoryClass(story.category)}${shape.size ? ` prime-card sz-${shape.size}${showMedia ? '' : ' is-text'}` : ''}" id="story-${number}" data-story-id="${escapeStoryText(story.id || '')}" aria-labelledby="story-title-${number}" data-story-number="${number}" data-save-key="${saveKey}">
      ${showMedia ? `
      <div class="video-poster${story.video ? ' has-video' : ''}">
        ${story.video
          ? `<video class="hero-image" src="${escapeStoryText(story.video)}" ${story.poster ? `poster="${escapeStoryText(story.poster)}" preload="none"` : 'preload="metadata"'} playsinline disablepictureinpicture disableremoteplayback aria-label="Story video: ${escapeStoryText(story.title)}"></video>`
          : `<img class="hero-image" src="${story.image}" alt="${escapeStoryText(story.imageAlt)}" style="object-position: ${escapeStoryText(story.imagePosition)}" loading="${loading}">`}
        <span class="video-story-number" aria-label="Story ${number} of ${STORY_TOTAL}">${number} / ${STORY_TOTAL}</span>
        ${story.video ? `<button class="play-news" type="button" aria-label="Play the news: ${escapeStoryText(story.title)}">
          <span class="microphone-circle">${microphoneIcon}<b class="countdown-num" aria-hidden="true"></b><svg class="stop-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" /></svg><svg class="countdown-ring" viewBox="0 0 70 70" aria-hidden="true" focusable="false"><circle cx="35" cy="35" r="32" /></svg></span>
          <span class="countdown-label" aria-live="polite"></span>
        </button>
        <button class="pin-close" type="button" aria-label="Close the player"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <span class="seek-flash" aria-hidden="true"></span>
        <span class="video-progress" aria-hidden="true"><i></i></span>` : ''}
      </div>
      ` : ''}

      <div class="story-copy">
        ${shape.rank ? `<span class="rank" aria-hidden="true">${shape.rank}</span>` : ''}
        <div class="story-meta">
          <span class="story-tags"><span class="story-section">${shape.size === 'lead' ? 'Lead story · ' : ''}${escapeStoryText(story.category)}</span>${renderFormat(number, asText)}${renderBadges(story.badges)}</span>
          <div class="story-actions">
            <button class="story-action" type="button" data-action="save" aria-label="Save story ${number}" aria-pressed="false" title="Save story">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4.5h12v15l-6-4-6 4z" /></svg>
            </button>
            <button class="story-action" type="button" data-action="share" aria-label="Share story ${number}" title="Share story">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></svg>
            </button>
            ${asText.video ? `<button class="story-action" type="button" data-action="share-video" hidden aria-label="Share the video file, story ${number}" title="Share the video">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>
            </button>` : ''}
          </div>
        </div>
        ${renderReason(story)}
        <h2 id="story-title-${number}"><button class="story-title-button" type="button" data-open-story="${number}" aria-label="Read full story: ${escapeStoryText(story.title)}">${escapeStoryText(story.title)}</button></h2>
        <p class="story-deck">${escapeStoryText(story.deck)}</p>
        <div class="story-byline-row rd-byrow">${renderByline(story, true)}${renderCardTalk(story, number)}</div>
        ${story.readers ? `<div class="story-readers"><span class="readers-stack" aria-hidden="true"><i></i><i></i><i></i></span><span><b>${story.readers.toLocaleString('en-US')}</b> read this</span></div>` : ''}
        ${renderEngage(story)}
        ${renderReacts(story)}
        <button class="more" type="button" data-open-story="${number}">Read the full story <span aria-hidden="true">→</span></button>
        ${story.link
          ? ''
          : `<div class="story-facts">
          <div><h3>What happened</h3><p>${escapeStoryText(story.happened)}</p></div>
          <div><h3>Why it matters</h3><p>${escapeStoryText(story.matters)}</p></div>
        </div>`}
      </div>
    </article>`;
}

function renderImageCarousel() {
  const slides = imageStories.map((story, index) => {
    const number = index + sampleStories.length + 1;
    return `
      <article class="swipe-slide ${categoryClass(story.category)}" id="story-${number}" aria-labelledby="swipe-title-${number}" aria-hidden="${index !== 0}" ${index !== 0 ? 'inert' : ''}>
        <img class="swipe-image" src="${story.image}" alt="${escapeStoryText(story.alt)}" loading="lazy" draggable="false">
        <span class="swipe-story-number" aria-label="Story ${number} of 50">${number} / 50</span>
        <div class="swipe-copy">
          <span class="swipe-tags"><span class="swipe-category">${escapeStoryText(story.category)}</span>${renderBadges(story.badges)}${renderByline(story, false)}</span>
          <h2 id="swipe-title-${number}"><button class="story-title-button" type="button" data-open-story="${number}" aria-label="Read full story: ${escapeStoryText(story.title)}">${escapeStoryText(story.title)}</button></h2>
          <div class="swipe-facts">
            <div><h3>What happened</h3><p>${escapeStoryText(story.deck)}</p></div>
            <div><h3>Why it matters</h3><p>${escapeStoryText(story.matters)}</p></div>
          </div>
          <div class="swipe-byline-row">${renderByline(story, true, readTimeLabel(number, story))}</div>
        </div>
      </article>`;
  }).join('');

  const progress = imageStories.map((_, index) => `
    <button class="swipe-progress-step" type="button" aria-label="Show image story ${index + 1} of ${imageStories.length}" aria-current="${index === 0}" data-slide="${index}"></button>`).join('');

  return `
    <section class="image-swipe-block" aria-label="Image news stories">
      <div class="section-break" aria-hidden="true"><span></span><span></span><span></span></div>
      <header class="section-marker"><h2 data-i18n="sec.swipe">Swipe cards</h2>${storyCount(imageStories.length, 'story', 'stories', 'swipe →')}</header>
      <div class="image-swipe-card" tabindex="0" aria-roledescription="carousel" aria-label="Image news stories. Swipe or tap the sides to change stories.">
        <div class="swipe-track">${slides}</div>
        <div class="swipe-progress" aria-label="Image story navigation">${progress}</div>
      </div>
      <span class="sr-only swipe-announcement" role="status" aria-live="polite">Image story 1 of ${imageStories.length}</span>
    </section>`;
}

function renderGlances() {
  const glanceSpotlights = spotlightSlots(glanceStories.length, SPOTLIGHT_GLANCE);
  const visualCounts = {};
  const items = glanceStories.map((story, index) => {
    const number = sampleStories.length + imageStories.length + index + 1;
    const visualSet = glanceVisuals[story.category] || glanceVisuals.Technology;
    const visualIndex = visualCounts[story.category] || 0;
    visualCounts[story.category] = visualIndex + 1;
    const image = visualSet[visualIndex % visualSet.length];
    const imageSide = index % 2 === 0 ? 'start' : 'end';
    const item = `
      <article class="glance-item ${categoryClass(story.category)}${story.deck ? '' : ' is-brief'} is-image-${imageSide}${index === 0 ? ' is-feature' : index === 5 ? ' is-wide' : ''}" id="story-${number}" aria-labelledby="glance-title-${number}">
        <div class="glance-visual" aria-hidden="true"><img src="${image}" alt="" loading="${index < 4 ? 'eager' : 'lazy'}"><span class="glance-image-number">${number} / 50</span></div>
        <div class="glance-copy">
          <div class="glance-meta"><span class="glance-tags"><span class="glance-category">${escapeStoryText(story.category)}</span>${renderFormat(number, story)}${renderBadges(story.badges)}${renderByline(story, false)}</span><span class="sr-only">Story ${number} of 50</span></div>
          <h3 id="glance-title-${number}"><button class="story-title-button" type="button" data-open-story="${number}" aria-label="Read full story: ${escapeStoryText(story.title)}">${escapeStoryText(story.title)}</button></h3>
        </div>
        <div class="glance-facts">
          <div><h4>What happened</h4><p>${escapeStoryText(story.deck)}</p></div>
          <div><h4>Why it matters</h4><p>${escapeStoryText(story.matters)}</p></div>
          <div class="glance-byline-row">${renderByline(story, true, readTimeLabel(number, story))}</div>
        </div>
        ${(ENGAGE[`glance-${index + 1}`] || REACT_ON.has(`glance-${index + 1}`)) ? `<div class="glance-engage">${renderEngage({ id: `glance-${index + 1}` })}${renderReacts({ id: `glance-${index + 1}` })}</div>` : ''}
      </article>`;
    return item + (glanceSpotlights.has(index + 1) ? renderSpotlightPlacement(SPOTLIGHT_PRIME + 1 + glanceSpotlights.get(index + 1)) : '');
  }).join('');

  return `<section class="glance-section" aria-labelledby="glance-heading">
    <div class="section-break" aria-hidden="true"><span></span><span></span><span></span></div>
    <header class="section-marker"><h2 id="glance-heading" data-i18n="sec.glance">World at a glance</h2>${storyCount(glanceStories.length)}</header>
    ${items}
    ${renderDayNumbers('glance', sampleStories.length + imageStories.length + 1, glanceStories.length)}
    ${renderClassifieds('glance')}
  </section>`;
}

const storiesRoot = document.querySelector('#edition-stories');
// One section = a heading, its stories laid out as a mix of video / photo / text cards, and any Spotlight placed between them.
// The first section opens with the lead story and the ranked top three; the others go straight to the mixed grid.
function renderSection(sec, first, k, isFirst) {
  const list = sec.stories, n = list.length;
  const head = isFirst ? 4 : 0;                                          // stories shown above the grid in the first section
  const gridList = list.slice(head);
  const slotsAt = new Set(k.spots.map((_, j) => Math.max(2, Math.round(gridList.length * (j + 1) / (k.spots.length + 1))) - 1));
  const card = (st, i) => renderStory(st, first + i + 1, first + i + 1, primeShape(head ? i : i + 4, st));   // first: i is the section index; others skip the lead/top slots
  let spot = 0;
  const grid = gridList.map((st, g) => card(st, head + g) + (slotsAt.has(g) ? renderSpotlightPlacement(k.spots[spot++]) : '')).join('');
  const id = `sec-${sec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return `<section class="prime-section ${categoryClass(sec.name)}" aria-labelledby="${id}">
    <header class="section-marker prime-marker"><h2 id="${id}">${escapeStoryText(sec.name)}</h2>${storyCount(n)}</header>
    ${head ? `<div class="prime-lead">${card(list[0], 0)}</div>
    <div class="prime-tops">${list.slice(1, 4).map((st, i) => card(st, i + 1)).join('')}</div>` : ''}
    <div class="prime-grid">${grid}</div>
    ${k.extras || ''}
  </section>`;
}
let sectionStart = 0;
const sectionHtml = sections.map((sec, i) => {
  const first = sectionStart;
  sectionStart += sec.stories.length;
  const k = [
    { spots: [1], extras: renderDayNumbers('prime', first + 1, sec.stories.length) + renderClassifieds('prime') },
    { spots: [2] },
    { spots: [3], extras: renderDayNumbers('swipe', first + 1, sec.stories.length) + renderClassifieds('swipe') },
    { spots: [7, 8] },
    { spots: [9] },
    { spots: [], extras: renderDayNumbers('glance', first + 1, sec.stories.length) + renderClassifieds('glance') },
  ][i];
  return renderSection(sec, first, k, i === 0);
});
storiesRoot.innerHTML = [
  ...sectionHtml.slice(0, 3),
  renderPulse(),
  renderSpotlightPlacement(6),
  ...sectionHtml.slice(3),
  renderSpotlightPlacement(10),
].join('');

const allStories = [...sampleStories, ...imageStories, ...glanceStories];
const articleOverlay = document.querySelector('#article-overlay');
const articleOverlayContent = articleOverlay.querySelector('.article-overlay-content');
let articleOpener = null;

function closeFullStory() {
  if (articleOverlay.hidden) return;
  stopReaderMedia();
  articleOverlay.hidden = true;
  syncCardsWithReader();
  document.documentElement.classList.remove('is-reading');
  articleOpener?.focus();
  articleOpener = null;
}


// The reader's Listen button: a story with a video plays that video's voice-over; any other story is read aloud by the browser's voice.
function stopReaderMedia() {
  articleOverlayContent.querySelector('.rd-vid video')?.pause();
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) { /* no speech on this device */ }
  articleOverlayContent.querySelector('[data-listen]')?.classList.remove('is-on');
}
// Answers given inside the reader are shared state: when it closes, redraw the matching engagement blocks on the cards.
function syncCardsWithReader() {
  freshAnswer.clear();
  storiesRoot.querySelectorAll('.story-poll').forEach((box) => { box.innerHTML = renderEngageInner(box.dataset.poll); });
  storiesRoot.querySelectorAll('[data-react-for]').forEach((box) => { box.outerHTML = renderReacts({ id: box.dataset.reactFor }); });
  storiesRoot.querySelectorAll('[data-talk-for]').forEach((talk) => {   // a comment added in the reader counts on the card too
    const n = window.boughtDiscussion.count(talk.dataset.talkFor);
    talk.querySelector('b').textContent = n;
    talk.setAttribute('aria-label', `${n} comments, open the discussion`);
  });
}
function toggleReaderVideo(frame) {
  const v = frame.querySelector('video');
  if (v.paused) v.play().catch(() => {}); else v.pause();
}
[['play', true], ['pause', false], ['ended', false]].forEach(([type, on]) => articleOverlay.addEventListener(type, (event) => {
  const frame = event.target.closest && event.target.closest('[data-rd-vid]');
  if (!frame) return;
  frame.classList.toggle('is-playing', on);
  articleOverlay.querySelector('[data-listen]')?.classList.toggle('is-on', on);
}, true));
articleOverlay.addEventListener('timeupdate', (event) => {
  const v = event.target, frame = v.closest && v.closest('[data-rd-vid]');
  if (!frame || !v.duration) return;
  frame.querySelector('.rd-vid-bar i').style.width = `${v.currentTime / v.duration * 100}%`;
}, true);
articleOverlay.addEventListener('click', (event) => {
  const frame = event.target.closest('[data-rd-vid]');
  if (frame) { toggleReaderVideo(frame); return; }
  if (event.target === articleOverlay) { closeFullStory(); return; }   // tap the dimmed page to close
  if (event.target.closest('[data-jump-discussion]')) { event.preventDefault(); articleOverlayContent.querySelector('#discussion')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const listen = event.target.closest('[data-listen]');
  if (!listen) return;
  const video = articleOverlayContent.querySelector('.rd-vid');
  if (video) { toggleReaderVideo(video); return; }
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (synth.speaking) { stopReaderMedia(); return; }
  const text = [...articleOverlayContent.querySelectorAll('h2, .rd-dek, .rd-info p, .rd-why p')].map((el) => el.textContent).join('. ');
  synth.speak(new SpeechSynthesisUtterance(text));
  listen.classList.add('is-on');
});

if (window.boughtDiscussion) window.boughtDiscussion.mount(articleOverlayContent, (m) => showActionFeedback(m));
let storyTranslations = null;           // {id: {headline, summary}} for the chosen language, or null (English)

function openFullStory(number, opener) {
  const original = allStories[number - 1];
  if (!original) return;
  const tr = storyTranslations && original.id && storyTranslations[original.id];
  const story = tr ? { ...original, title: tr.headline, deck: tr.summary } : original;
  const [opening, continuation] = story.link ? [story.deck, ''] : articleDetails[number - 1] || [story.happened || story.deck, story.matters];
  articleOpener = opener;
  stopReaderMedia();
  storiesRoot.querySelectorAll('video').forEach((v) => v.pause());
  articleOverlayContent.className = `article-overlay-content ${categoryClass(story.category)}`;
  const prevStory = allStories[number - 2], nextStory = allStories[number];
  const nextTitle = nextStory ? escapeStoryText(storyTranslations && nextStory.id && storyTranslations[nextStory.id] ? storyTranslations[nextStory.id].headline : nextStory.title) : "You've reached the last story";
  const paras = story.link ? [] : [opening, continuation];
  const happened = story.happened || story.deck;
  const talk = !!(window.boughtDiscussion && story.id && window.boughtDiscussion.has(story.id)), talkCount = talk ? window.boughtDiscussion.count(story.id) : 0;
  const info = story.script || paras.filter(Boolean).join(' ');
  articleOverlayContent.innerHTML = `
    <div class="rd-top">
      <span class="pos">${escapeStoryText(story.category)} · ${number} of ${STORY_TOTAL}</span>
      <button class="chip-btn" type="button" data-listen>Listen</button>
      <button class="chip-btn article-overlay-close" type="button" aria-label="Close full story">Close</button>
    </div>
    <div class="rd-bar" aria-hidden="true"><i style="width:${number / STORY_TOTAL * 100}%"></i></div>
    <div class="rd-body" id="rd-body">
      <article class="rd-article" aria-labelledby="article-overlay-title">
        <div class="story-tags"><span class="story-section">${escapeStoryText(story.category)}</span>${renderFormat(number, story)}${renderBadges(story.badges)}</div>
        <h2 id="article-overlay-title">${escapeStoryText(story.title)}</h2>
        <p class="rd-dek">${escapeStoryText(story.deck)}</p>
        <div class="story-byline-row rd-byrow">${renderByline(story, true)}${talk ? `<a class="rd-talk" href="#discussion" data-jump-discussion aria-label="${talkCount} comments"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><b data-comment-count>${talkCount}</b></a>` : ''}</div>
        ${story.video ? `<div class="rd-vid" data-rd-vid>
          <video src="${escapeStoryText(story.video)}" ${story.poster ? `poster="${escapeStoryText(story.poster)}"` : ''} playsinline preload="metadata" disablepictureinpicture></video>
          <button class="rd-vid-big" type="button" aria-label="Play the video"><i></i></button>
          <span class="rd-vid-bar"><i></i></span>
        </div>` : story.image ? `<img class="rd-photo" src="${escapeStoryText(story.image)}" alt="${escapeStoryText(story.imageAlt || '')}" style="object-position: ${escapeStoryText(story.imagePosition || 'center')}">` : ''}
        ${info ? `<div class="rd-info"><p>${escapeStoryText(info)}</p></div>` : ''}
        <div class="rd-pair"><div class="rd-why"><b>What happened</b><p>${escapeStoryText(happened)}</p></div>
        ${story.matters ? `<div class="rd-why"><b>Why it matters</b><p>${escapeStoryText(story.matters)}</p></div>` : ''}</div>
        ${renderEngage(story)}
        ${renderReacts(story)}
        ${story.link ? `<div class="rd-acts"><a href="${escapeStoryText(story.link)}" rel="noopener" target="_blank">Read the original on ${escapeStoryText(story.source || 'the source')} <span aria-hidden="true">↗</span></a></div>` : ''}
        ${talk ? window.boughtDiscussion.render(story.id) : ''}
      </article>
    </div>
    <div class="article-overlay-foot">
      <button class="foot-prev" type="button" ${prevStory ? `data-story-step="${number - 1}"` : 'disabled'}>← Prev</button>
      <button class="foot-next" type="button" ${nextStory ? `data-story-step="${number + 1}"` : 'disabled'}><small>${nextStory ? 'Next story' : 'End of issue'}</small><b>${nextTitle}</b></button>
    </div>`;
  articleOverlay.hidden = false;
  markStoryRead(original);
  articleOverlayContent.querySelector('#rd-body').scrollTop = 0;
  document.documentElement.classList.add('is-reading');
  articleOverlay.querySelector('.article-overlay-close').focus();
}

storiesRoot.addEventListener('click', (event) => {
  const title = event.target.closest('[data-open-story]');
  if (title && !(title.closest('.image-swipe-card') && Date.now() < ignoreTapUntil)) {
    openFullStory(Number(title.dataset.openStory), title);
    if (title.hasAttribute('data-to-discussion')) articleOverlayContent.querySelector('#discussion')?.scrollIntoView({ block: 'start' });
  }
});
articleOverlay.addEventListener('click', (event) => {
  if (event.target.closest('.article-overlay-close')) closeFullStory();
  const step = event.target.closest('[data-story-step]');
  if (step) openFullStory(Number(step.dataset.storyStep), articleOpener);
});
document.addEventListener('keydown', (event) => {
  if (articleOverlay.hidden) return;
  if (event.key === 'Escape') closeFullStory();
  if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
    const go = articleOverlay.querySelector(event.key === 'ArrowRight' ? '.foot-next' : '.foot-prev');
    if (go && !go.disabled) { event.preventDefault(); go.click(); }
  }
  if (event.key === 'Tab') {   // keep focus inside the story: close, prev, next
    const ring = [...articleOverlay.querySelectorAll('button:not(:disabled), a[href]')];
    const at = ring.indexOf(document.activeElement), to = event.shiftKey ? at - 1 : at + 1;
    event.preventDefault();
    ring[(to + ring.length) % ring.length].focus();
  }
});

const stickyMasthead = document.querySelector('.sticky-masthead');
function syncMastheadHeight() {
  document.documentElement.style.setProperty('--masthead-height', `${stickyMasthead.getBoundingClientRect().height}px`);
}
syncMastheadHeight();
if ('ResizeObserver' in window) new ResizeObserver(syncMastheadHeight).observe(stickyMasthead);

// ---- "Reading Bought right now" pill in the top bar. SAMPLE number: there is no presence service yet, so readersNow() drifts around a
// plausible value. For the real thing, count live visitors (a heartbeat endpoint or Supabase Realtime presence) and return that here.
(() => {
  const el = document.getElementById('readers-now');
  if (!el) return;
  const num = el.querySelector('.readers-num');
  let n = 1292;
  const readersNow = () => { n = Math.max(900, n + Math.round((Math.random() - 0.48) * 14)); return n; };
  const paint = () => { const v = readersNow(); num.textContent = v.toLocaleString('en-US'); el.setAttribute('aria-label', `${v.toLocaleString('en-US')} people reading Bought right now`); };
  paint();
  setInterval(() => { if (!document.hidden) paint(); }, 6000);
})();
window.addEventListener('resize', syncMastheadHeight);

const swipeCard = storiesRoot.querySelector('.image-swipe-card') || Object.assign(document.createElement('div'), { innerHTML: '<div class="swipe-track"></div>' });   // no swipe strip any more: a detached stand-in keeps the old handlers harmless
const swipeTrack = swipeCard.querySelector('.swipe-track');
const swipeSlides = [...swipeCard.querySelectorAll('.swipe-slide')];
const swipeSteps = [...swipeCard.querySelectorAll('.swipe-progress-step')];
const swipeAnnouncement = storiesRoot.querySelector('.swipe-announcement') || document.createElement('span');
let activeImageStory = 0;

function updateImageStory(index) {
  const next = Math.max(0, Math.min(index, swipeSlides.length - 1));
  if (next === activeImageStory) return;
  activeImageStory = next;
  swipeSlides.forEach((slide, slideIndex) => {
    slide.setAttribute('aria-hidden', String(slideIndex !== next));
    slide.inert = slideIndex !== next;
  });
  swipeSteps.forEach((step, stepIndex) => step.setAttribute('aria-current', String(stepIndex === next)));
  swipeAnnouncement.textContent = `Image story ${next + 1} of ${swipeSlides.length}. Story ${next + sampleStories.length + 1} of 50. ${imageStories[next].title}`;
  if (swipeSlides[next + 1]) swipeSlides[next + 1].querySelector('img').loading = 'eager';
}

function showImageStory(index) {
  const next = Math.max(0, Math.min(index, swipeSlides.length - 1));
  swipeTrack.scrollTo({ left: next * swipeTrack.clientWidth, behavior: 'auto' });
  updateImageStory(next);
}

if (swipeSlides[1]) swipeSlides[1].querySelector('img').loading = 'eager';

let scrollFrame = 0;
swipeTrack.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateImageStory(Math.round(swipeTrack.scrollLeft / swipeTrack.clientWidth));
  });
}, { passive: true });

swipeTrack.addEventListener('dragstart', (event) => event.preventDefault());

let touchStart = null;
let ignoreTapUntil = 0;
swipeTrack.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 1) return;
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
swipeTrack.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  const moved = Math.max(Math.abs(event.changedTouches[0].clientX - touchStart.x), Math.abs(event.changedTouches[0].clientY - touchStart.y));
  if (moved > 8) ignoreTapUntil = Date.now() + 500;
  touchStart = null;
}, { passive: true });

let mouseDrag = null;
swipeTrack.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  mouseDrag = { id: event.pointerId, x: event.clientX, left: swipeTrack.scrollLeft, index: activeImageStory, moved: false };
});
window.addEventListener('pointermove', (event) => {
  if (!mouseDrag || event.pointerId !== mouseDrag.id) return;
  const distance = event.clientX - mouseDrag.x;
  if (Math.abs(distance) < 4 && !mouseDrag.moved) return;
  mouseDrag.moved = true;
  swipeTrack.style.scrollSnapType = 'none';
  swipeTrack.scrollLeft = mouseDrag.left - distance;
  if (event.cancelable) event.preventDefault();
});
window.addEventListener('pointerup', (event) => {
  if (!mouseDrag || event.pointerId !== mouseDrag.id) return;
  const drag = mouseDrag;
  mouseDrag = null;
  if (!drag.moved) return;
  swipeTrack.style.scrollSnapType = '';
  ignoreTapUntil = Date.now() + 500;
  const distance = event.clientX - drag.x;
  showImageStory(drag.index + (Math.abs(distance) >= 18 ? (distance < 0 ? 1 : -1) : 0));
});
window.addEventListener('pointercancel', (event) => {
  if (!mouseDrag || event.pointerId !== mouseDrag.id) return;
  const index = mouseDrag.index;
  mouseDrag = null;
  swipeTrack.style.scrollSnapType = '';
  showImageStory(index);
});

swipeCard.addEventListener('click', (event) => {
  if (Date.now() < ignoreTapUntil) return;
  const step = event.target.closest('[data-slide]');
  if (step) {
    showImageStory(Number(step.dataset.slide));
    return;
  }
  if (event.target.closest('[data-open-story]')) return;
  if (!event.target.closest('.swipe-track')) return;
  const bounds = swipeCard.getBoundingClientRect();
  const tapX = (event.clientX - bounds.left) / bounds.width;
  if (tapX < 0.26) showImageStory(activeImageStory - 1);
  else if (tapX > 0.74) showImageStory(activeImageStory + 1);
});

swipeCard.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  showImageStory(activeImageStory + (event.key === 'ArrowRight' ? 1 : -1));
});

const savedStorageKey = 'bought-spotlight-saved-2026-10-13';
let savedStories = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(savedStorageKey) || '[]');
  if (Array.isArray(stored)) savedStories = new Set(stored.map(String));
} catch (_) {
  // Saving still works for this visit if browser storage is unavailable.
}

function updateSaveButton(button, storyNumber, saveKey) {
  const isSaved = savedStories.has(saveKey);
  button.setAttribute('aria-pressed', String(isSaved));
  button.setAttribute('aria-label', `${isSaved ? 'Remove saved' : 'Save'} story ${storyNumber}`);
  button.title = isSaved ? 'Remove saved story' : 'Save story';
}

storiesRoot.querySelectorAll('[data-action="save"]').forEach((button) => {
  const article = button.closest('.lead-story');
  updateSaveButton(button, article.dataset.storyNumber, article.dataset.saveKey);
});

const actionFeedback = document.querySelector('#action-feedback');
let feedbackTimeout;
function showActionFeedback(message) {
  actionFeedback.hidden = false;
  actionFeedback.textContent = message;
  clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => { actionFeedback.hidden = true; }, 2200);
}

// Pulse: like Reels, nothing plays until you tap. Tap a clip to play it (with sound), tap again to pause.
// The only control on screen is the progress bar that is part of the picture; there are no media controls or mute button.
const pulseVideos = () => [...storiesRoot.querySelectorAll('.pulse-video')];
function pausePulse(except) { pulseVideos().forEach((v) => { if (v !== except) { v.pause(); v.closest('.pulse-card').classList.remove('is-playing'); } }); }
let nextUp = null;   // { card, timer, tick } while "Next clip in 3s" is counting down
function hideNextUp() {
  if (!nextUp) return;
  clearTimeout(nextUp.timer); clearInterval(nextUp.tick);
  nextUp.card.querySelector('.pulse-next').hidden = true;
  nextUp = null;
}
function startPulse(card) {
  const v = card.querySelector('.pulse-video');
  hideNextUp();
  pausePulse(v);
  v.muted = false;
  v.play().then(() => card.classList.add('is-playing')).catch(() => { v.muted = true; v.play().then(() => card.classList.add('is-playing')).catch(() => {}); });
}
storiesRoot.addEventListener('click', (event) => {
  if (event.target.closest('[data-next-stay]')) { hideNextUp(); return; }   // tap the dimmed picture: stay on this clip
  const hit = event.target.closest('[data-pulse-clip]');
  if (!hit) return;
  const card = hit.closest('.pulse-card');
  const v = card.querySelector('.pulse-video');
  if (v.paused) startPulse(card);
  else { v.pause(); card.classList.remove('is-playing'); }
});
// A clip that plays to the end: "Next clip in 3s" (tap to stay), then the next clip loads and plays. The last clip just goes back to its start.
pulseVideos().forEach((v) => v.addEventListener('ended', () => {
  const card = v.closest('.pulse-card'), cards = [...storiesRoot.querySelectorAll('.pulse-card')], next = cards[cards.indexOf(card) + 1];
  card.classList.remove('is-playing');
  hideNextUp();
  if (!next) { v.currentTime = 0; return; }
  const pop = card.querySelector('.pulse-next'), label = pop.querySelector('.pulse-next-label'), ring = pop.querySelector('.next-ring');
  let left = 3;
  const show = () => { label.textContent = `Next clip in ${left}s`; };
  show(); pop.hidden = false;
  ring.classList.remove('is-counting'); void ring.offsetWidth; ring.classList.add('is-counting');
  next.querySelector('video').preload = 'auto';   // start fetching the next clip now, so it is ready at zero
  nextUp = {
    card,
    tick: setInterval(() => { left = Math.max(1, left - 1); show(); }, 1000),
    timer: setTimeout(() => { hideNextUp(); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); startPulse(next); }, 3000),
  };
}));
// leaving the page or scrolling a clip out of view stops it
document.addEventListener('visibilitychange', () => { if (document.hidden) pausePulse(null); });
if ('IntersectionObserver' in window) {
  const leave = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.intersectionRatio < 0.3 && !en.target.paused) { en.target.pause(); en.target.closest('.pulse-card').classList.remove('is-playing'); }
  }), { threshold: [0, 0.3] });
  pulseVideos().forEach((v) => leave.observe(v));
}

async function copyStoryText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Use the selection fallback below.
    }
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (_) { /* Copy may be blocked. */ }
  field.remove();
  return copied;
}

async function shareStory(article) {
  const title = article.querySelector('h2').textContent;
  const summary = article.querySelector('.story-deck').textContent;
  const shareData = { title: `${title} — Bought. Spotlight`, text: summary };
  if (location.protocol === 'https:' || location.protocol === 'http:') {
    // Stories from the feed are shared by their own preview page, /s/<id>/ (its tags carry the story's picture and video, so
    // chat apps and X show them); the built-in samples, which have no page, by position.
    if (article.dataset.storyId) shareData.url = sharePageUrl(article.dataset.storyId);
    else { const url = new URL(location.href); url.hash = article.id; shareData.url = url.href; }
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  const copy = [title, summary, shareData.url].filter(Boolean).join('\n\n');
  showActionFeedback(await copyStoryText(copy) ? 'Story copied' : 'Could not share story');
}

// ---- Sharing. A link goes to /s/<id>/, a small page whose tags carry that story's picture and video (chat apps, X and the like read
// those; they never see the part after '#'). "Share video" hands the mp4 file itself to the phone's share sheet, so it can be posted
// to Instagram, X, WhatsApp and so on. That button only appears where the browser can share files.
const canShareFiles = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] })); } catch (_) { return false; } })();
function sharePageUrl(slug) { return new URL(`s/${slug}/`, location.origin + location.pathname.replace(/[^/]*$/, '')).href; }
async function shareLink({ title, text, url }) {
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title, text, url }); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  showActionFeedback(await copyStoryText([title, text, url].filter(Boolean).join('\n\n')) ? 'Link copied' : 'Could not copy the link');
}
async function shareVideoFile(video, title, text, slug) {
  showActionFeedback('Preparing the video…');
  try {
    const blob = await (await fetch(video.currentSrc || video.src)).blob();
    const file = new File([blob], `${slug}.mp4`, { type: 'video/mp4' });
    if (!navigator.canShare({ files: [file] })) throw new Error('unsupported');
    await navigator.share({ files: [file], title, text });
    actionFeedback.hidden = true;
  } catch (error) {
    if (error.name === 'AbortError') actionFeedback.hidden = true;
    else showActionFeedback('Could not share the video');
  }
}
storiesRoot.querySelectorAll('[data-action="share-video"], [data-pulse-share-video]').forEach((b) => { b.hidden = !canShareFiles; });
storiesRoot.addEventListener('click', (event) => {   // Pulse card buttons
  const btn = event.target.closest('.pulse-action');
  if (!btn) return;
  const card = btn.closest('.pulse-card');
  const title = card.querySelector('.pulse-headline').textContent;
  const text = card.querySelector('.swipe-facts p').textContent;
  if (btn.hasAttribute('data-pulse-share-video')) shareVideoFile(card.querySelector('video'), title, text, card.dataset.clip);
  else shareLink({ title: `${title} — Bought. Pulse`, text, url: sharePageUrl(`pulse-${card.dataset.clip}`) });
});

function refreshEngage(box) { box.innerHTML = renderEngageInner(box.dataset.poll); }
const engageRoots = [storiesRoot, articleOverlay];
const onEngageInput = (event) => {   // slider: show your number as you drag
  const slider = event.target.closest('.slider');
  if (slider) slider.closest('.story-poll').querySelector('.slider-you b').textContent = slider.value;
};
const onEngageChange = (event) => {   // slider: when you let go, that number is your answer (drag again to change it)
  const slider = event.target.closest('.slider');
  if (!slider) return;
  const box = slider.closest('.story-poll'), id = box.dataset.poll;
  engageState[id] = Number(slider.value);
  saveJson(stateKey, engageState);
  box.querySelector('.slider-avg').hidden = false;
  box.querySelector('.slider-avgtext').hidden = false;
  box.querySelector('.poll-share').hidden = false;   // the share button (and its card) follow your latest number
};
const onEngageClick = async (event) => {   // answers, predictions, sliders, reactions and result cards
  const react = event.target.closest('[data-react]');
  if (react) {   // one reaction at a time: choosing another moves your choice, tapping yours again takes it back
    const id = react.closest('.story-reacts').dataset.reactFor, k = react.dataset.react, current = (reactState[id] || [])[0];
    reactState[id] = current === k ? [] : [k];
    saveJson(reactKey, reactState);
    react.closest('.story-reacts').outerHTML = renderReacts({ id });
    if (event.detail === 0) document.querySelector(`[data-react-for="${id}"] [data-react="${k}"]`)?.focus();   // keep the keyboard place; a mouse click needs no ring
    return;
  }
  const vote = event.target.closest('[data-poll-vote]'), card = event.target.closest('[data-share-card]'), dismiss = event.target.closest('[data-dismiss-share]');
  if (!vote && !card && !dismiss) return;
  const box = event.target.closest('.story-poll'), id = box.dataset.poll;
  if (card) { openCardPopup(id, card); return; }
  if (dismiss) { freshAnswer.delete(id); refreshEngage(box); box.querySelector('.poll-share')?.focus?.({ preventScroll: true }); return; }
  engageState[id] = vote.dataset.pollVote;   // an answer or a prediction is final once given: no "change" button
  freshAnswer.add(id);
  saveJson(stateKey, engageState);
  refreshEngage(box);
  box.querySelector('.poll-share')?.focus?.({ preventScroll: true });
};
engageRoots.forEach((root) => { root.addEventListener('input', onEngageInput); root.addEventListener('change', onEngageChange); root.addEventListener('click', onEngageClick); });


storiesRoot.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const article = button.closest('.lead-story');
  const storyNumber = article.dataset.storyNumber;
  const saveKey = article.dataset.saveKey;

  if (button.dataset.action === 'save') {
    if (savedStories.has(saveKey)) savedStories.delete(saveKey);
    else savedStories.add(saveKey);
    updateSaveButton(button, storyNumber, saveKey);
    try { localStorage.setItem(savedStorageKey, JSON.stringify([...savedStories])); } catch (_) { /* In-memory state remains. */ }
    showActionFeedback(savedStories.has(saveKey) ? 'Story saved' : 'Removed from saved');
  } else if (button.dataset.action === 'share') {
    shareStory(article);
  } else if (button.dataset.action === 'share-video') {
    const video = article.querySelector('.video-poster video');
    if (video) shareVideoFile(video, article.querySelector('h2').textContent, article.querySelector('.story-deck').textContent, article.dataset.storyId || article.id);
  }
});

// ---- Prime videos: no media controller. Mic button in the middle plays/pauses, the left and right thirds jump 5 s,
// and when a video ends the mic button counts down 3 s, then the page scrolls to the next news video and plays it.
// Tapping the button during the countdown stops the auto-advance.
(() => {
  const SEEK = 5, COUNTDOWN_MS = 3000;
  const posters = () => [...storiesRoot.querySelectorAll('.video-poster.has-video')];
  let countdown = null;                                   // { poster, timer, tick }

  function cancelCountdown() {
    if (!countdown) return;
    clearTimeout(countdown.timer);
    clearInterval(countdown.tick);
    countdown.poster.classList.remove('is-counting');
    countdown.poster.querySelector('.countdown-label').textContent = '';
    countdown = null;
  }

  function flash(poster, text, side) {
    const el = poster.querySelector('.seek-flash');
    el.textContent = text;
    el.dataset.side = side;
    el.classList.remove('is-on');
    void el.offsetWidth;                                  // restart the fade
    el.classList.add('is-on');
  }

  // ---- A playing video that scrolls out of view pins itself under the top bar and keeps playing.
  let pinned = null;                                        // { poster, slot } while a video rides along at the top
  const wide = window.matchMedia('(min-width: 900px)');
  const mastheadHeight = () => document.querySelector('.sticky-masthead').getBoundingClientRect().height;

  function pin(poster, from) {
    if (pinned) return;
    const box = poster.getBoundingClientRect();
    const slot = document.createElement('div');             // keeps the card's height so nothing below jumps
    slot.className = 'video-slot';
    slot.style.height = `${box.height}px`;
    poster.before(slot);
    if (!wide.matches) { poster.style.left = `${box.left}px`; poster.style.width = `${box.width}px`; }
    poster.classList.add('is-pinned');
    pinned = { poster, slot, from };                        // from: which edge it left through, 'top' or 'bottom'
  }

  function unpin() {
    if (!pinned) return;
    pinned.poster.classList.remove('is-pinned');
    pinned.poster.style.left = pinned.poster.style.width = '';
    pinned.slot.remove();
    pinned = null;
  }

  function checkPin() {
    if (pinned) {                                           // back in view: put it in its place again
      const slot = pinned.slot.getBoundingClientRect();
      const top = mastheadHeight();
      if (!(pinned.from === 'top' ? slot.top > top + 4 : (slot.top < window.innerHeight - 40 && slot.bottom > top + 24))) return;
      unpin();                                              // then look again: it may have gone off the other edge
    }
    const playing = storiesRoot.querySelector('.video-poster.has-video.is-playing');
    if (!playing) return;
    const box = playing.getBoundingClientRect();
    // it rides along at the top whichever way it left: scrolled down past it, or scrolled back up above it
    if (box.bottom < mastheadHeight() + 24) pin(playing, 'top');
    else if (box.top >= window.innerHeight) pin(playing, 'bottom');
  }
  let pinFrame = 0;
  window.addEventListener('scroll', () => {
    if (!pinFrame) pinFrame = requestAnimationFrame(() => { pinFrame = 0; checkPin(); });
  }, { passive: true });
  window.addEventListener('resize', unpin);

  storiesRoot.addEventListener('click', (event) => {
    const close = event.target.closest('.pin-close');
    if (!close) return;
    event.stopPropagation();
    const poster = close.closest('.video-poster');
    poster.querySelector('video').pause();
    cancelCountdown();
    unpin();
  }, true);

  function playPoster(poster) {
    const video = poster.querySelector('video');
    posters().forEach((other) => { if (other !== poster) other.querySelector('video').pause(); });
    if (pinned && pinned.poster !== poster) unpin();        // the next video takes over: the old one goes home
    cancelCountdown();
    if (video.ended) video.currentTime = 0;
    return video.play().catch(() => { /* blocked by the browser: the mic button stays for a tap */ });
  }

  storiesRoot.addEventListener('click', (event) => {
    const poster = event.target.closest('.video-poster.has-video');
    if (!poster) return;
    const video = poster.querySelector('video');
    if (poster.classList.contains('is-counting')) {            // only a tap inside the circle stops the auto-advance
      if (event.target.closest('.microphone-circle')) cancelCountdown();
      return;
    }
    const box = poster.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const onButton = event.target.closest('.play-news');
    if (!onButton && x < 0.3) {
      video.currentTime = Math.max(0, video.currentTime - SEEK);
      flash(poster, `−${SEEK}s`, 'back');
    } else if (!onButton && x > 0.7) {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + SEEK);
      flash(poster, `+${SEEK}s`, 'fwd');
    } else if (video.paused || video.ended) {
      playPoster(poster);
    } else {
      video.pause();
    }
  });

  storiesRoot.addEventListener('keydown', (event) => {
    const button = event.target.closest('.play-news');
    const poster = button && button.closest('.video-poster.has-video');
    if (!poster || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const video = poster.querySelector('video');
    const delta = event.key === 'ArrowLeft' ? -SEEK : SEEK;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + delta));
    flash(poster, `${delta < 0 ? '−' : '+'}${SEEK}s`, delta < 0 ? 'back' : 'fwd');
    event.preventDefault();
  });

  // Media events do not bubble, so listen on each video.
  posters().forEach((poster) => {
    const video = poster.querySelector('video');
    const bar = poster.querySelector('.video-progress i');
    video.addEventListener('play', () => poster.classList.add('is-playing'));
    video.addEventListener('pause', () => {
      poster.classList.remove('is-playing');
      if (pinned && pinned.poster === poster && !video.ended) unpin();      // paused: back to its place (ended keeps the countdown on top)
    });
    video.addEventListener('timeupdate', () => { bar.style.width = `${video.duration ? (video.currentTime / video.duration) * 100 : 0}%`; });
    video.addEventListener('ended', () => {
      poster.classList.remove('is-playing');
      bar.style.width = '100%';
      const all = posters();
      const next = all[all.indexOf(poster) + 1];
      if (!next) return;                                  // last video: stay on it with the mic button to replay
      const num = poster.querySelector('.countdown-num');
      const label = poster.querySelector('.countdown-label');
      let left = COUNTDOWN_MS / 1000;
      const show = () => { num.textContent = left; label.textContent = `Next story in ${left}s · tap the circle to stay`; };
      show();
      poster.classList.add('is-counting');
      next.querySelector('video').preload = 'auto';          // only now start fetching the next video, so it is ready at zero
      countdown = {
        poster,
        tick: setInterval(() => { left = Math.max(1, left - 1); show(); }, 1000),
        timer: setTimeout(() => {
          cancelCountdown();
          next.scrollIntoView({ behavior: 'smooth', block: 'center' });
          playPoster(next);
        }, COUNTDOWN_MS),
      };
    });
  });
})();

// ---- Language: the picker (language.js) announces a choice; feed stories swap to their translation (or back to English).
async function applyStoryLanguage(locale, name = '', announce = false) {
  storyTranslations = await window.loadTranslations(locale);
  if (announce && locale !== 'en' && !storyTranslations) showActionFeedback(`Stories are not translated into ${name} yet. Showing English.`);
  storiesRoot.querySelectorAll('.lead-story[data-story-id]').forEach((article) => {
    const tr = storyTranslations && storyTranslations[article.dataset.storyId];
    const title = article.querySelector('.story-title-button');
    const deck = article.querySelector('.story-deck');
    title.dataset.en = title.dataset.en || title.textContent;
    if (deck) deck.dataset.en = deck.dataset.en || deck.textContent;
    const headline = tr ? tr.headline : title.dataset.en;
    title.textContent = headline;
    title.setAttribute('aria-label', `Read full story: ${headline}`);
    if (deck) deck.textContent = tr ? tr.summary : deck.dataset.en;
  });
  if (!articleOverlay.hidden) closeFullStory();
}
document.addEventListener('bought:language', (event) => applyStoryLanguage(event.detail.locale, event.detail.name, true));
window.applyUiText();
if (window.boughtLanguage && window.boughtLanguage.locale !== 'en') applyStoryLanguage(window.boughtLanguage.locale);

// ---- Shared links: the page opens at the story that was shared ----
// #s-<id> is a feed story, #story-<n> a story by position (swipe cards and glance stories included).
function findLinkedStory() {
  const key = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (/^s-[\w-]+$/.test(key)) return [...storiesRoot.querySelectorAll('[data-story-id]')].find((el) => el.dataset.storyId === key.slice(2)) || null;
  if (/^pulse-[\w-]+$/.test(key)) return storiesRoot.querySelector(`.pulse-card[data-clip="${key.slice(6)}"]`);
  if (/^story-\d+$/.test(key)) return storiesRoot.querySelector(`#${key}`);
  return null;
}

let linkedFlashTimer;
function openLinkedStory(flash) {
  const target = findLinkedStory();
  if (!target) return false;
  const slide = target.closest('.swipe-slide');
  if (slide) showImageStory(swipeSlides.indexOf(slide));                 // bring that card to the front of the swipe row
  const place = slide ? slide.closest('.image-swipe-block') : target;    // the swipe row fills the screen: show all of it
  place.scrollIntoView({ block: 'start', behavior: 'auto' });            // headers are sticky; scroll-margin keeps it clear of them
  if (flash && !slide) {
    target.classList.add('is-linked');
    clearTimeout(linkedFlashTimer);
    linkedFlashTimer = setTimeout(() => target.classList.remove('is-linked'), 2600);
  }
  return true;
}

if (location.hash && openLinkedStory(true)) {
  // Pictures and videos above the story keep loading and push it down: settle on it again, unless the reader has started scrolling.
  let readerMoved = false;
  const stop = () => { readerMoved = true; };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) => window.addEventListener(type, stop, { once: true, passive: true }));
  const settle = () => { if (!readerMoved) openLinkedStory(false); };
  window.addEventListener('load', settle, { once: true });
  setTimeout(settle, 700);
  setTimeout(settle, 1800);
}
window.addEventListener('hashchange', () => openLinkedStory(true));
