// Asks before leaving the newspaper for the Bought home: used by the Bought. logo, "See the market" and the Bid buttons.
// "Don't ask me again" is remembered in this browser only (localStorage).
(() => {
  const SKIP_KEY = 'bought-skip-home-confirm';
  // The market lives in the main Bought app: port 3000 while developing locally, the same site once deployed.
  const HOME = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? `${location.protocol}//${location.hostname}:3000/` : '/';
  const skip = () => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return false; } };
  const remember = () => { try { localStorage.setItem(SKIP_KEY, '1'); } catch (e) { /* private mode: asks again next time */ } };

  function dialog() {
    let d = document.querySelector('#leave-dialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'leave-dialog';
    d.className = 'leave-dialog';
    d.setAttribute('aria-labelledby', 'leave-title');
    d.innerHTML = `
      <form method="dialog">
        <h2 id="leave-title">Go to Bought?</h2>
        <p>This takes you to the Bought home, where today’s market is open.</p>
        <label class="leave-remember"><input type="checkbox" name="remember"> Don’t ask me again</label>
        <div class="leave-actions">
          <button type="button" class="leave-stay" value="stay">Stay here</button>
          <button type="button" class="leave-go" value="go">Take me there</button>
        </div>
      </form>`;
    document.body.append(d);
    d.addEventListener('click', (event) => {
      if (event.target === d) d.close();                              // a click on the backdrop closes it
      const button = event.target.closest('button[value]');
      if (!button) return;
      if (button.value === 'go') {
        if (d.querySelector('input[name=remember]').checked) remember();
        location.href = d.dataset.href || HOME;
      } else d.close();
    });
    return d;
  }

  function ask(href) {
    if (skip()) { location.href = href || HOME; return; }
    const d = dialog();
    d.dataset.href = href || HOME;
    d.querySelector('input[name=remember]').checked = false;
    d.showModal();
    d.querySelector('.leave-go').focus();
  }

  function target(event) {
    if (event.defaultPrevented || event.button > 0) return null;
    if (event.type === 'click' && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return null;  // let "open in new tab" work
    return event.target.closest('[data-leave-confirm], .wordmark');
  }
  document.addEventListener('click', (event) => {
    const el = target(event);
    if (!el) return;
    event.preventDefault();
    ask(el.getAttribute('href'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target.closest && event.target.closest('.wordmark');
    if (!el) return;
    event.preventDefault();
    ask(null);
  });

  // The logo is a plain text element: make it reachable and announced as a link.
  function markLogo() {
    document.querySelectorAll('.wordmark').forEach((el) => {
      if (el.getAttribute('role')) return;
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'Bought home');
    });
  }
  markLogo();
  new MutationObserver(markLogo).observe(document.body, { childList: true, subtree: true });
})();
