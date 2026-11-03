// End of the issue: email opt-in, the day's classifieds and the ad auction. Everything here stays in this browser:
// nothing is sent anywhere yet. SAMPLE CONTENT: the issue number, classified lines and bids are placeholders.
(() => {
  const root = document.querySelector('#issue-end');
  if (!root) return;

  const ISSUE = 288;
  // The market lives in the main Bought app. On localhost that app runs on port 3000; when deployed it shares the origin.
  const MARKET = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? `${location.protocol}//${location.hostname}:3000/` : '/';
  const EMAILS_KEY = 'bought-newsletter-emails';      // every address typed here, newest first
  const OPTIN_KEY = 'bought-newsletter-optin';        // the address that opted in
  const MEMBER_KEY = 'bought-newsletter-member';      // "already in the club" without giving an address here (e.g. signed up on another device)
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: nothing is remembered */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* nothing to remove */ } },
  };

  // Advertisers type their own website, so only http(s) addresses are ever linked (never javascript: and the like).
  const safeWebsite = (value) => { try { const t = String(value).trim(); const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch (err) { return ''; } };

  // Classifieds and the auction can be folded away: a clear "Hide / Show" button with an arrow sits beside each title.
  const foldBar = (id, title, open = true) => `<button class="end-fold-toggle" type="button" aria-expanded="${open}" aria-controls="${id}-body">
          <h2 id="${id}-title">${esc(title)}</h2><span class="end-fold-label">${open ? 'Hide' : 'Show'}</span><span class="end-fold-arrow" aria-hidden="true"></span>
        </button>`;

  const classifieds = [
    ['$95', 'Hiring a founding ML engineer, Bengaluru or remote. Equity-heavy.', 'Saltpan AI', 'https://example.com/classifieds/saltpan-ai'],
    ['$72', 'Two seats free on a Dublin founders’ table, 14 Nov.', 'Harbour Club', 'https://example.com/classifieds/harbour-club'],
    ['$60', 'Office seats in Indiranagar from ₹9,000 a month.', 'Common Desk Co.', 'https://example.com/classifieds/common-desk-co'],
    ['$41', 'Looking for a co-founder who has shipped a B2B payments product.', 'Ankita R.', 'https://example.com/classifieds/ankita-r'],
    ['$18', 'Free to a good home: 40 whiteboard markers, most still work.', 'Anonymous', 'https://example.com/classifieds/anonymous'],
  ];
  const spots = [
    ['Left ear', 'Masthead, left of the nameplate', 'Broadcast video', '$560', '', 9],
    ['Right ear', 'Masthead, right of the nameplate', 'Creative', '$495', '', 8],
    ['Front-page banner', 'Below the day in numbers', 'Broadcast video', '$2,750', '', 23],
    ['AI section sponsor', 'Header of the AI section', 'Broadcast video', '$840', '', 12],
    ['In-feed card, AI', 'Inside the AI stories', 'Broadcast video', '$480', '', 12],
    ['Half page', 'Between Business and Founders', 'Broadcast video', '$1,770', '', 12],
    ['Founders section sponsor', 'Header of the Founders section', 'Broadcast video', '$470', '', 5],
    ['In-feed card, Geopolitics', 'Inside the Geopolitics stories', 'Broadcast video', '$390', '', 10],
    ['Clip break', 'Inside the 60-second clips', 'Broadcast video', '$700', '', 14],
    ['Classified line', 'Classifieds, five lines a day', 'Text line', '$39', '5th-highest', 10],
  ];

  root.innerHTML = `
    <div class="issue-end-inner">
      <div id="subscribe-slot"></div>

      <section class="end-classifieds" aria-labelledby="end-classifieds-title">
        <div class="end-fold-zone">
          ${foldBar('end-classifieds', 'Classifieds')}
          <p class="end-sub">Five lines a day.</p>
        </div>
        <div class="end-fold-body" id="end-classifieds-body">
        <ol>${classifieds.map(([price, text, who, website]) => { const href = safeWebsite(website); return `<li><span class="end-price">${esc(price)}</span><p>${href ? `<a class="end-line-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer sponsored">${esc(text)}<span aria-hidden="true"> ↗</span><span class="sr-only"> (opens the advertiser’s website)</span></a>` : esc(text)} <span class="end-who">– ${esc(who)}</span></p></li>`; }).join('')}</ol>
        <a class="end-pill" href="${MARKET}" data-leave-confirm>Place a line for Issue ${ISSUE} · from $40</a>
        </div>
      </section>

      <section class="end-auction" aria-labelledby="end-auction-title">
        <div class="end-fold-zone">
          <header>
            ${foldBar('end-auction', `Bid for Issue ${ISSUE}`, false)}
            <a class="end-pill" href="${MARKET}" data-leave-confirm>See the market</a>
          </header>
          <p class="end-sub">Highest bid at 23:59 IST wins. Only the winner pays.</p>
        </div>
        <div class="end-fold-body" id="end-auction-body" hidden>
        <p class="end-countdown">Bidding closes in <b id="bid-countdown">--:--:--</b> · 23:59 IST</p>
        <div class="spot-table" role="table" aria-label="Ad spots for Issue ${ISSUE}">
          <div class="spot-row spot-head" role="row"><span role="columnheader">Spot</span><span role="columnheader">Format</span><span role="columnheader">Highest bid</span><span role="columnheader">Bids</span><span role="columnheader"></span></div>
          ${spots.map(([name, where, format, bid, note, bids]) => `
          <div class="spot-row" role="row">
            <span class="spot-name" role="cell"><strong>${esc(name)}</strong><small>${esc(where)}</small></span>
            <span role="cell"><em class="spot-format ${format === 'Broadcast video' ? 'is-video' : ''}">${esc(format)}</em></span>
            <span class="spot-bid" role="cell">${esc(bid)}${note ? `<small>${esc(note)}</small>` : ''}</span>
            <span class="spot-count" role="cell">${bids} <small>bids</small></span>
            <span role="cell"><a class="end-pill end-pill-small" href="${MARKET}" data-leave-confirm aria-label="Bid on ${esc(name)}">Bid</a></span>
          </div>`).join('')}
        </div>
        </div>
      </section>

      <footer class="end-footer">
        <p>© 2026 Bought. Ad spots are sold by daily public auction.</p>
        <nav aria-label="Footer"><a href="${MARKET}newspaper" data-leave-confirm>Archive</a><a href="${MARKET}" data-leave-confirm>Advertise</a><a href="${MARKET}terms" data-leave-confirm>Privacy</a></nav>
      </footer>
    </div>`;


  // ---- Fold / unfold ----
  root.addEventListener('click', (event) => {
    const zone = event.target.closest('.end-fold-zone');
    if (!zone || event.target.closest('a, input, textarea, select')) return;   // the See the market link keeps working
    const toggle = zone.querySelector('.end-fold-toggle');
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.end-fold-label').textContent = open ? 'Hide' : 'Show';
    root.querySelector('#' + toggle.getAttribute('aria-controls')).hidden = !open;
  });

  // ---- Countdown to 23:59 IST (UTC+5:30) ----
  const countdown = root.querySelector('#bid-countdown');
  function tick() {
    const ist = Date.now() + 19800000;                       // "now" read as IST wall-clock time, through UTC getters
    const d = new Date(ist);
    let close = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 0);
    if (close <= ist) close += 86400000;
    const s = Math.max(0, Math.floor((close - ist) / 1000));
    countdown.textContent = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  }
  tick();
  setInterval(tick, 1000);

  // ---- Email opt-in, remembered in this browser only ----
  const slot = root.querySelector('#subscribe-slot');
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function renderSubscribed(email) {
    slot.innerHTML = `
      <div class="subscribe is-done">
        <strong>You’re in the club. Tomorrow’s issue arrives in your inbox at 7:00 IST.</strong>
        ${email ? `<span class="subscribe-who">${esc(email)}</span>` : ''}
        <button class="subscribe-change" type="button">${email ? 'Use a different email' : 'Not signed up yet?'}</button>
      </div>`;
    slot.querySelector('.subscribe-change').addEventListener('click', () => { store.remove(MEMBER_KEY); renderForm(); });
  }

  function renderForm() {
    slot.innerHTML = `
      <form class="subscribe" novalidate>
        <strong>New here? Get tomorrow’s issue in your inbox at 7:00 IST</strong>
        <div class="subscribe-field">
          <input type="email" name="email" placeholder="you@company.com" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="email" aria-label="Email address" role="combobox" aria-expanded="false" aria-controls="subscribe-history" aria-autocomplete="list">
          <ul id="subscribe-history" class="subscribe-history" role="listbox" hidden></ul>
        </div>
        <button type="submit">Subscribe</button>
        <p class="subscribe-error" role="alert" hidden></p>
        <p class="subscribe-member">Already getting it? <button class="subscribe-change" type="button" data-member>Yes, I’m in the club</button></p>
      </form>`;
    slot.querySelector('form').querySelector('[data-member]').addEventListener('click', () => { store.set(MEMBER_KEY, true); renderSubscribed(''); });
    const form = slot.querySelector('form');
    const input = form.elements.email;
    const list = form.querySelector('.subscribe-history');
    const error = form.querySelector('.subscribe-error');
    let active = -1;

    const options = () => [...list.querySelectorAll('[role="option"]')];
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function open() {
      const typed = input.value.trim().toLowerCase();
      const saved = store.get(EMAILS_KEY, []).filter((e) => e.toLowerCase().includes(typed) && e.toLowerCase() !== typed);
      if (!saved.length) { close(); return; }
      list.innerHTML = saved.map((e, i) => `<li role="option" id="subscribe-opt-${i}" data-email="${esc(e)}">${esc(e)}</li>`).join('')
        + '<li class="subscribe-clear" role="presentation"><button type="button">Clear saved emails</button></li>';
      list.hidden = false; active = -1;
      input.setAttribute('aria-expanded', 'true');
    }
    function pick(email) { input.value = email; error.hidden = true; close(); input.focus(); }
    function highlight(next) {
      const items = options();
      if (!items.length) return;
      active = (next + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('is-active', i === active));
      input.setAttribute('aria-activedescendant', items[active].id);
    }

    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('input', () => { error.hidden = true; open(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); if (list.hidden) open(); highlight(active + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); highlight(active - 1); }
      else if (event.key === 'Enter' && active >= 0 && !list.hidden) { event.preventDefault(); pick(options()[active].dataset.email); }
      else if (event.key === 'Escape') close();
    });
    list.addEventListener('mousedown', (event) => event.preventDefault());   // keep focus in the field while choosing
    list.addEventListener('click', (event) => {
      const option = event.target.closest('[role="option"]');
      if (option) pick(option.dataset.email);
      else if (event.target.closest('.subscribe-clear button')) { store.remove(EMAILS_KEY); close(); }
    });
    document.addEventListener('click', (event) => { if (!form.contains(event.target)) close(); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = input.value.trim();
      if (!validEmail(email)) { error.textContent = 'Enter a valid email address.'; error.hidden = false; input.focus(); return; }
      store.set(EMAILS_KEY, [email, ...store.get(EMAILS_KEY, []).filter((e) => e.toLowerCase() !== email.toLowerCase())].slice(0, 8));
      store.set(OPTIN_KEY, email);
      renderSubscribed(email);
    });
  }

  const optedIn = store.get(OPTIN_KEY, '');
  if (optedIn) renderSubscribed(optedIn);
  else if (store.get(MEMBER_KEY, false)) renderSubscribed('');
  else renderForm();
})();
