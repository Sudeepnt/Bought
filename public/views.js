// The Newspaper and the Podcast are two sections of ONE page. Switching only shows one and hides the other; nothing is reloaded.
// The Podcast's styles, script and audio are not requested until it is opened for the first time, so the newspaper loads without them.
// The address becomes /#podcast while it is open (the Back button works); any other address shows the newspaper.
(() => {
  window.boughtLoadScript = (src) => new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = el.onerror = resolve;
    document.body.append(el);
  });

  const page = document.querySelector('main.page');
  const view = document.getElementById('podcast-view');
  const buttons = [...document.querySelectorAll('.view-option[data-view]')];
  let loading = null;

  function loadPodcast() {
    if (!loading) {
      loading = (async () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'podcast.css?v=6';
        document.head.append(link);
        await new Promise((resolve) => { link.onload = link.onerror = resolve; });
        await window.liveFeedReady;                                  // the episode (audio address, chapters) comes with the feed
        await window.boughtLoadScript('podcast.js?v=5');             // creates the audio element; the audio itself streams from here on
      })();
    }
    return loading;
  }

  let token = 0;
  async function setView(name) {
    const mine = ++token;
    if (name === 'podcast') {
      buttons.forEach((b) => b.setAttribute('aria-busy', String(b.dataset.view === 'podcast')));
      await loadPodcast();
      if (mine !== token) return;                                    // the reader already went somewhere else
      buttons.forEach((b) => b.removeAttribute('aria-busy'));
    }
    page.dataset.view = name;
    view.hidden = name !== 'podcast';
    buttons.forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.title = name === 'podcast' ? 'Bought. — Today\'s Brief' : 'Bought. — Today\'s issue';
  }

  const fromAddress = () => (location.hash === '#podcast' ? 'podcast' : 'newspaper');
  buttons.forEach((button) => button.addEventListener('click', () => {
    const name = button.dataset.view;
    if (name === (page.dataset.view || 'newspaper')) return;
    history.pushState(null, '', name === 'podcast' ? '#podcast' : location.pathname + location.search);
    setView(name);
    window.scrollTo(0, 0);
  }));
  window.addEventListener('popstate', () => setView(fromAddress()));
  window.addEventListener('hashchange', () => setView(fromAddress()));
  if (fromAddress() === 'podcast') setView('podcast');
})();
