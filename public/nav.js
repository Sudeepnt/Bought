// Switches between the Newspaper and Podcast editions without a page load, so the podcast audio
// (window.boughtAudio, created by podcast.js) keeps playing while the reader browses the other edition.
(() => {
  const tracked = [];                                     // listeners and timers the current edition added
  const nativeAdd = EventTarget.prototype.addEventListener;
  const nativeSetInterval = window.setInterval;
  const own = new WeakSet();                              // this file's own listeners survive a swap
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (!own.has(fn)) tracked.push(() => this.removeEventListener(type, fn, opts));
    return nativeAdd.call(this, type, fn, opts);
  };
  window.setInterval = function (...args) {
    const id = nativeSetInterval.apply(window, args);
    tracked.push(() => clearInterval(id));
    return id;
  };
  const listen = (target, type, fn) => { own.add(fn); nativeAdd.call(target, type, fn); };

  const isEdition = (url) => url.origin === location.origin && /\/(index\.html|podcast\.html)?$/.test(url.pathname);
  const pages = {};
  let swapping = false;

  let switched = false;
  // Pages load their scripts through this. After the first switch they are wrapped so top-level const/let can be declared again.
  window.boughtLoadScript = async (src) => {
    const el = document.createElement('script');
    if (!switched) {
      el.src = src;
      await new Promise((resolve) => { el.onload = el.onerror = resolve; document.body.append(el); });
      return;
    }
    el.textContent = `(() => {\n${await fetch(src).then((r) => r.text())}\n})();`;
    document.body.append(el);
  };

  async function runScripts(scripts) {
    for (const old of scripts) {
      if (/nav\.js/.test(old.src)) continue;
      if (old.src) await window.boughtLoadScript(old.getAttribute('src'));
      else {
        const el = document.createElement('script');
        el.textContent = old.textContent;
        document.body.append(el);
      }
    }
  }

  async function show(url, push) {
    if (swapping) return;
    swapping = true;
    try {
      pages[url.href] = pages[url.href] || fetch(url.href).then((r) => r.text());
      const doc = new DOMParser().parseFromString(await pages[url.href], 'text/html');
      tracked.splice(0).forEach((undo) => undo());
      document.title = doc.title;
      const sheets = [...doc.head.querySelectorAll('link[rel=stylesheet]')];
      await Promise.all(sheets.map((sheet) => new Promise((resolve) => {
        if ([...document.head.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === sheet.href)) return resolve();
        const link = sheet.cloneNode();
        link.onload = link.onerror = resolve;
        document.head.append(link);
      })));
      document.head.querySelectorAll('link[rel=stylesheet]').forEach((l) => {
        if (!sheets.some((s) => s.href === l.href)) l.remove();
      });
      const scripts = [...doc.body.querySelectorAll('script')];
      scripts.forEach((s) => s.remove());
      document.body.className = doc.body.className;
      document.body.replaceChildren(...doc.body.childNodes);
      if (push) history.pushState({}, '', url.href);
      scrollTo(0, 0);
      switched = true;
      await runScripts(scripts);
    } finally { swapping = false; }
  }

  listen(document, 'click', (event) => {
    const link = event.target.closest && event.target.closest('a.view-option[href]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
    const url = new URL(link.href, location.href);
    if (!isEdition(url)) return;
    event.preventDefault();
    show(url, true);
  });
  listen(window, 'popstate', () => show(new URL(location.href), false));
})();
