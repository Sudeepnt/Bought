/* Discussion under the first ten Prime stories (the reader's last block).
   SAMPLE comments: written by hand for each story so every thread talks about that story, not about "tech" in general. There is no comments
   backend yet. A reader's own comments, replies and votes are kept in this browser (localStorage 'bought-discussion'); for the real thing,
   replace loadThreads(id) / saveComment(...) with calls to the comments service and keep the markup. Shape of a comment:
   [user, role, age, text, votes, replies[]]  (age is shown as written; replies nest as deep as you like). */
(() => {
  const SEED = {
    // 1 · Chipmakers race to ship 2nm processors in volume
    '293873247e6ba2c1': [
      ['sid_hw', 'Hardware', '3h', 'Volume is the whole story. Anyone can show a 2nm wafer; shipping a million of them with decent yield is the part that took the last node two extra years.', 412, [
        ['leela.codes', 'Engineer', '2h', 'Yield numbers are never public until the quarter is over, so I would wait for the first teardown before cheering.', 188, [
          ['sid_hw', 'Hardware', '2h', 'Fair. Teardowns will also tell us whether the power claims survive a real phone battery.', 61, []]]]]],
      ['rohan.m', 'Student', '5h', 'Will this make laptops cheaper, or just the flagship phones? Every new node seems to start at the top of the price list.', 236, [
        ['ananya.writes', 'Journalist', '4h', 'Flagship first, then two or three years of waiting. The fabs need the premium buyers to pay for the line.', 144, []]]],
      ['devika_ops', 'Operator', '6h', 'For data centres the interesting number is performance per watt, not the node name. Marketing gave up on nanometres meaning anything years ago.', 301, []],
      ['arjun.dev', 'Engineer', '9h', 'Does anyone know how many companies can actually make these? I count about two, which is a lot of the world riding on one island.', 175, [
        ['meera_vc', 'Investor', '8h', 'Three if you are generous. That concentration is the real risk behind every roadmap in this story.', 97, []]]],
    ],
    // 2 · Satellite broadband reaches remote schools in pilot
    'ec0d5009476c4c94': [
      ['teacher.priya', 'Teacher', '2h', 'I teach in a district where the one fibre line goes down every monsoon. A dish on the roof would change my whole term. What does the school pay per month?', 389, [
        ['ananya.writes', 'Journalist', '1h', 'The pilot is subsidised, so no price yet. That question is going to decide whether this scales.', 142, []]]],
      ['kabir.net', 'Engineer', '4h', 'Latency is fine for lessons. The real limit is how many students can share a dish before video calls turn to slideshows.', 266, [
        ['chen.w', 'Engineer', '3h', 'A school router with caching helps a lot. Download the lesson once overnight, serve it all day.', 118, []]]],
      ['nikhil.ships', 'Founder', '7h', 'Connectivity without devices and trained staff is half a project. Who pays for the laptops?', 204, []],
      ['isha.t', 'Student', '10h', 'We had one phone with data in our whole hostel. This would have been huge.', 87, []],
    ],
    // 3 · Quantum error correction passes a key lab milestone
    '1a0ad868f6c9c489': [
      ['omar.f', 'Researcher', '1h', 'The milestone that matters is logical error rates dropping as you add physical qubits. If that held here, it is a genuinely big result, not a press release.', 355, [
        ['sana.k', 'Analyst', '1h', 'Did the paper say how many physical qubits per logical one? That ratio is what decides whether this is practical.', 129, [
          ['omar.f', 'Researcher', '45m', 'Still hundreds to thousands. Useful proof, long road to anything you can sell.', 74, []]]]]],
      ['vik.capital', 'Investor', '3h', 'Every quantum headline gets a funding round. I would like to see one customer paying for a result they could not get classically.', 232, []],
      ['rohan.m', 'Student', '5h', 'Can someone explain error correction like I am not a physicist? Why is it harder for quantum than normal computers?', 198, [
        ['arjun.dev', 'Engineer', '4h', 'Normal bits can be copied and checked. Qubits cannot be copied, and looking at them disturbs them, so you have to check them indirectly.', 156, []]]],
    ],
    // 4 · Open-source operating system gains ground in public offices
    '6526647b6166458f': [
      ['sid_hw', 'Hardware', '4h', 'The licence savings get the headlines, but the real win is not being locked to one vendor refresh cycle. Offices keep PCs for ten years.', 287, []],
      ['kabir.net', 'Engineer', '6h', 'Migrations fail on the odd things: that one spreadsheet macro, the scanner driver from 2011. Budget for the odd things.', 341, [
        ['devika_ops', 'Operator', '5h', 'And for retraining. Staff accept a new desktop faster than they accept losing their shortcut keys.', 163, []]]],
      ['ananya.writes', 'Journalist', '8h', 'Who maintains it after the pilot? Governments love launching and hate paying for a support contract.', 214, []],
      ['isha.t', 'Student', '12h', 'Our college lab moved to Linux two years ago. The first month was awful, then nobody noticed.', 96, []],
    ],
    // 5 · Battery makers promise faster charging for city buses
    '402ad39f9a1b17ab': [
      ['arjun.dev', 'Engineer', '2h', 'Fast charging at the depot is solved with more chargers. The hard part is doing it without cooking the pack in three years.', 318, [
        ['sid_hw', 'Hardware', '1h', 'Exactly. Ask for cycle-life numbers at that charge rate, not just the ten-minute headline.', 140, []]]],
      ['commuter.ria', 'Commuter', '4h', 'My bus is late every day for reasons that are not the battery, but sure, charge it faster.', 276, []],
      ['nikhil.ships', 'Founder', '6h', 'Fleet operators only care about cost per kilometre. If it charges in ten minutes and the pack dies early, the maths flips.', 209, [
        ['vik.capital', 'Investor', '5h', 'Battery leasing models solve some of that. The operator pays per kilometre and the maker carries the ageing risk.', 88, []]]],
    ],
    // 6 · AI agents move from prompts to complete tasks
    '8f4bf0dde4bfd4fb': [
      ['leela.codes', 'Engineer', '1h', 'The demos always book the flight. Nobody shows the agent when the airline site changes its layout at 2am and it confidently books the wrong day.', 452, [
        ['arjun.dev', 'Engineer', '1h', 'The boring fix is a human approval step on anything that spends money. Slower, and still far more useful.', 191, []]]],
      ['meera_vc', 'Investor', '3h', 'The question I ask founders now: what happens when your agent is wrong, and who eats the cost? Most do not have an answer yet.', 267, []],
      ['aisha_r', 'Designer', '5h', 'Nobody talks about the interface. I do not want to read a log of what the agent did, I want to see what changed and undo it in one tap.', 233, []],
      ['rohan.m', 'Student', '9h', 'Is this going to take entry-level jobs first? The tasks being automated are exactly what interns do.', 178, [
        ['ananya.writes', 'Journalist', '8h', 'Early data says tasks change before jobs disappear, but the first rung of the ladder does get thinner.', 120, []]]],
    ],
    // 7 · The AI race now runs through the data center
    '5a04354ee842f3fe': [
      ['devika_ops', 'Operator', '2h', 'Power is the constraint nobody planned for. We can order the chips, we cannot order a substation. Lead times on grid connections are years.', 498, [
        ['sid_hw', 'Hardware', '1h', 'Cooling too. Liquid cooling retrofits into old halls are far uglier than the slides suggest.', 164, []]]],
      ['vik.capital', 'Investor', '4h', 'Capex numbers are now so large that the question is no longer who wins but who is still funding this in three years.', 322, [
        ['meera_vc', 'Investor', '3h', 'Circular deals worry me. Chip maker invests in cloud, cloud buys the chips, both book growth.', 205, []]]],
      ['ananya.writes', 'Journalist', '6h', 'Local communities get the noise and the water use, and a handful of jobs. That trade is going to be a political issue soon.', 241, []],
    ],
    // 8 · Cybersecurity teams brace for a wave of phishing kits
    'bd16eca1270ba10e': [
      ['kabir.net', 'Security', '2h', 'The kits are not the scary part, the lures are. Generated text with no spelling mistakes removes the one tell people were trained to look for.', 377, [
        ['chen.w', 'Engineer', '1h', 'Hardware keys and passkeys beat training. You cannot phish a credential that never gets typed.', 252, [
          ['isha.t', 'Student', '50m', 'Our uni still sends the password reset link over plain email. Passkeys feel very far away.', 66, []]]]]],
      ['nikhil.ships', 'Founder', '5h', 'Small teams get hit hardest. We have no security staff, so I treat every invoice email as hostile and it is exhausting.', 289, []],
      ['devika_ops', 'Operator', '7h', 'Run a fake phishing test on yourself monthly. The first result will humble the whole company.', 203, []],
    ],
    // 9 · Researchers publish a smaller model that rivals larger ones
    'f484e19f4ae82b9e': [
      ['arjun.dev', 'Engineer', '1h', 'Check the benchmark list before cheering. Small models often match big ones on the tests they were tuned for and fall apart on the weird ones.', 361, [
        ['fatima.ai', 'Researcher', '1h', 'Agreed, but the data-quality angle is real. Cleaner training data gets you further than another few billion parameters.', 187, []]]],
      ['rohan.m', 'Student', '3h', 'Can I run this on my laptop? That is the only thing I care about, honestly.', 245, [
        ['leela.codes', 'Engineer', '2h', 'If it fits in 8 to 16 GB once quantised, yes. Wait for the community builds in a few days.', 133, []]]],
      ['meera_vc', 'Investor', '5h', 'If small models keep closing the gap, the moat moves from model size to distribution and data. That changes who can compete.', 268, []],
      ['aisha_r', 'Designer', '8h', 'On-device models also mean offline features and no round trip to a server. As a designer that unlocks a lot of calm interfaces.', 154, []],
    ],
    // 10 · Cloud providers expand server capacity as demand rises
    '8d12cdc02eef3e38': [
      ['devika_ops', 'Operator', '2h', 'Capacity on paper is not capacity you can book. Try getting a block of GPUs in one region for a month without a sales call.', 334, [
        ['nikhil.ships', 'Founder', '1h', 'We now reserve a year ahead and eat the cost whether we use it or not. That is a big cost for a startup.', 176, []]]],
      ['vik.capital', 'Investor', '4h', 'Expansion this fast is how overbuild cycles start. I am watching utilisation numbers more than the announcements.', 247, []],
      ['kabir.net', 'Engineer', '6h', 'Multi-cloud keeps being sold as the answer. In practice you pay twice and still get stuck on one provider’s managed database.', 298, [
        ['sid_hw', 'Hardware', '5h', 'Egress fees are the quiet lock-in. Nobody mentions them in the capacity press releases.', 119, []]]],
      ['isha.t', 'Student', '10h', 'Does more capacity mean the free tiers get better, or just the enterprise contracts?', 71, []],
    ],
  };

  const KEY = 'bought-discussion';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* kept for this visit */ } };
  const mine = read();   // { [storyId]: { added: [comment...], votes: { [commentKey]: 1 | -1 } } }
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#3f8f6b', '#4f7fb8', '#b8734f', '#8a5fbf', '#b84f6b', '#9a8a3f', '#3f9aa8'];
  const hue = (name) => COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
  const ago = { m: 1, h: 60, d: 1440 };
  const mins = (age) => { const m = /^(\d+)([mhd])/.exec(age); return m ? Number(m[1]) * ago[m[2]] : 0; };

  // ---- data: seed + what this reader added, as one tree per story (seed comments are keyed s0, s0.1 ...; the reader's own get a stable id)
  const toNode = (c) => ({ user: c[0], role: c[1], age: c[2], text: c[3], votes: c[4], replies: (c[5] || []).map(toNode) });
  function build(id) {
    const state = mine[id] || (mine[id] = { added: [], votes: {} });
    const roots = SEED[id].map(toNode);
    const keyed = (list, prefix) => list.forEach((c, i) => { c.key = `${prefix}${i}`; keyed(c.replies, `${c.key}.`); });
    keyed(roots, 's');
    const find = (list, key) => { for (const c of list) { if (c.key === key) return c; const f = find(c.replies, key); if (f) return f; } return null; };
    const added = state.added.map((a) => ({ ...a, replies: [], mine: true }));
    added.filter((a) => a.parent).forEach((a) => { (find(roots, a.parent) || find(added, a.parent) || { replies: roots }).replies.push(a); });
    return [...added.filter((a) => !a.parent), ...roots];
  }
  const countAll = (list) => list.reduce((n, c) => n + 1 + countAll(c.replies), 0);
  const score = (id, c) => c.votes + (((mine[id] || {}).votes || {})[c.key] || 0);

  window.boughtDiscussion = {
    has: (id) => !!SEED[id],
    count: (id) => (SEED[id] ? countAll(build(id)) : 0),
    // markup for the whole block: header + sort, form, comments
    render(id, sort = 'best', shown = 4) {
      const list = build(id), total = countAll(list);
      const by = { best: (a, b) => score(id, b) - score(id, a), top: (a, b) => countAll(b.replies) + score(id, b) - countAll(a.replies) - score(id, a), new: (a, b) => (a.mine === b.mine ? mins(a.age) - mins(b.age) : a.mine ? -1 : 1) }[sort];
      const sorted = [...list].sort(by), head = sorted.slice(0, shown);
      const one = (c, depth) => `<div class="dc${depth ? ' is-reply' : ''}" data-key="${c.key}">
        <div class="dc-row"><i class="dc-av" style="--av:${hue(c.user)}" aria-hidden="true">${esc(c.user.charAt(0).toUpperCase())}</i><b class="dc-name">${esc(c.user)}</b><span class="dc-role">${esc(c.role)}</span><span class="dc-age">· ${esc(c.age)}</span></div>
        <div class="dc-body"><p>${esc(c.text)}</p>
          <div class="dc-acts"><span class="dc-vote"><button type="button" data-vote="1" aria-label="Upvote" class="${((mine[id].votes || {})[c.key] === 1) ? 'is-on' : ''}">▲</button><b>${score(id, c).toLocaleString('en-US')}</b><button type="button" data-vote="-1" aria-label="Downvote" class="${((mine[id].votes || {})[c.key] === -1) ? 'is-on' : ''}">▼</button></span>
            <button type="button" data-reply>Reply</button><button type="button" data-dshare>Share</button><button type="button" data-report>Report</button></div>
          ${c.replies.length ? `<div class="dc-replies">${c.replies.map((r) => one(r, depth + 1)).join('')}</div>` : ''}</div></div>`;
      return `<section class="disc" id="discussion" data-disc="${id}" data-order="${sort}" data-shown="${shown}" aria-labelledby="disc-h">
        <header class="disc-head"><h3 id="disc-h">Discussion</h3><span class="disc-count">${total} comments</span>
          <span class="disc-tabs" role="tablist">${['best', 'top', 'new'].map((s) => `<button type="button" role="tab" data-sort="${s}" aria-selected="${s === sort}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</span></header>
        <form class="disc-form" data-disc-form>
          <label for="disc-name">Name shown with your comment</label>
          <input id="disc-name" name="name" type="text" maxlength="40" placeholder="e.g. Utsav S." autocomplete="nickname" value="${esc(localStorage.getItem('bought-disc-name') || '')}">
          <textarea name="text" rows="4" maxlength="1000" placeholder="Add to the discussion" aria-label="Add to the discussion"></textarea>
          <div class="disc-foot"><span>Be kind. Argue with ideas, not people.</span><button type="submit" class="disc-send">Comment</button></div>
        </form>
        <div class="disc-list">${head.map((c) => one(c, 0)).join('')}</div>
        ${sorted.length > shown ? `<button type="button" class="disc-more" data-more>Show ${sorted.length - shown} more of ${sorted.length} threads</button>` : ''}
      </section>`;
    },
    // wire up one rendered block (call once on the container that holds it; it re-renders itself)
    mount(root, toast) {
      const redraw = (sec, patch) => {
        const id = sec.dataset.disc;
        const next = this.render(id, patch.sort || sec.dataset.order, patch.shown || Number(sec.dataset.shown));
        const keepY = sec.closest('.rd-body')?.scrollTop;
        sec.outerHTML = next;
        const body = root.querySelector('.rd-body'); if (body && keepY != null) body.scrollTop = keepY;
        root.querySelectorAll('[data-comment-count]').forEach((el) => { el.textContent = this.count(id); });
      };
      root.addEventListener('click', (e) => {
        const sec = e.target.closest('.disc'); if (!sec) return;
        const id = sec.dataset.disc, node = e.target.closest('.dc');
        const sort = e.target.closest('[data-sort]'), more = e.target.closest('[data-more]'), vote = e.target.closest('[data-vote]');
        if (sort) return redraw(sec, { sort: sort.dataset.sort });
        if (more) return redraw(sec, { shown: 999 });
        if (vote && node) {
          const v = Number(vote.dataset.vote), votes = mine[id].votes, cur = votes[node.dataset.key] || 0;
          if (cur === v) delete votes[node.dataset.key]; else votes[node.dataset.key] = v;
          write(mine); return redraw(sec, {});
        }
        if (e.target.closest('[data-reply]') && node) {
          const body = node.querySelector(':scope > .dc-body');
          const open = body.querySelector(':scope > .dc-replybox');
          if (open) { open.remove(); return; }
          body.insertAdjacentHTML('beforeend', `<form class="dc-replybox" data-reply-form><textarea rows="2" maxlength="600" placeholder="Reply" aria-label="Reply"></textarea><button type="submit" class="disc-send">Reply</button></form>`);
          body.querySelector('.dc-replybox textarea').focus(); return;
        }
        if (e.target.closest('[data-dshare]')) {
          const url = `${location.origin}${location.pathname}#discussion-${id}`;
          (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied'), () => toast('Copy this page’s address to share'));
          return;
        }
        if (e.target.closest('[data-report]')) toast('Thanks, we will take a look');
      });
      root.addEventListener('submit', (e) => {
        const sec = e.target.closest('.disc'); if (!sec) return;
        e.preventDefault();
        const id = sec.dataset.disc, state = mine[id] || (mine[id] = { added: [], votes: {} });
        if (e.target.matches('[data-disc-form]')) {
          const name = e.target.name.value.trim() || 'Reader', text = e.target.text.value.trim();
          if (!text) { e.target.text.focus(); return; }
          try { localStorage.setItem('bought-disc-name', e.target.name.value.trim()); } catch (_) { /* */ }
          state.added.unshift({ key: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, user: name, role: 'Reader', age: 'now', text, votes: 0 });
        } else {
          const text = e.target.querySelector('textarea').value.trim(); if (!text) return;
          const name = localStorage.getItem('bought-disc-name') || 'Reader';
          state.added.push({ key: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, user: name, role: 'Reader', age: 'now', text, votes: 0, parent: e.target.closest('.dc').dataset.key });
        }
        write(mine); redraw(sec, { sort: 'new' });
      });
    },
  };
})();
