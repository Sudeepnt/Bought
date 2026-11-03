// Light / dark theme button, placed before the language button. The choice is remembered in this browser.
// (The inline snippet in each page's <head> applies the saved theme before the first paint.)
(() => {
  const KEY = 'bought-theme';
  const root = document.documentElement;
  const sun = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
  const current = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  function apply(theme, save) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#151412' : '#efece5';
    if (save) { try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: not remembered */ } }
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      const dark = theme === 'dark';
      const icon = dark ? sun : moon;                            // the icon shows what a click switches to
      if (button.dataset.icon !== (dark ? 'sun' : 'moon')) { button.innerHTML = icon; button.dataset.icon = dark ? 'sun' : 'moon'; }
      button.setAttribute('aria-label', dark ? 'Switch to the light theme' : 'Switch to the dark theme');
      button.title = dark ? 'Light theme' : 'Dark theme';
      button.setAttribute('aria-pressed', String(dark));
    });
  }

  function mount() {
    document.querySelectorAll('.masthead').forEach((masthead) => {
      if (masthead.querySelector('.theme-toggle')) return;
      const picker = masthead.querySelector('.language-picker');
      if (!picker) return;
      const button = document.createElement('button');
      button.className = 'theme-toggle';
      button.type = 'button';
      picker.before(button);
    });
    apply(current(), false);
  }
  const mountIfMissing = () => {
    const missing = [...document.querySelectorAll('.masthead')].some((m) => m.querySelector('.language-picker') && !m.querySelector('.theme-toggle'));
    if (missing) mount();
  };
  document.addEventListener('click', (event) => {
    if (event.target.closest('.theme-toggle')) apply(current() === 'dark' ? 'light' : 'dark', true);
  });
  mount();
  new MutationObserver(mountIfMissing).observe(document.body, { childList: true, subtree: true });
})();
