'use strict';

// Start und Navigation: Liste aller Pokémon (Startseite), #pokemon=<schlüssel> (Pokémon-Seite) und
// #rangliste=<einsatz> (Liste als Rangliste, z. B. #rangliste=raid-fire, #rangliste=great).
// Zurück führt zur Liste – an die gemerkte Stelle und auf die Kachel, von der man kam.

(() => {
  const views = {
    list: document.getElementById('view-list'),
    detail: document.getElementById('view-detail'),
  };
  const BASE_TITLE = document.title;
  let current = null;
  const scrollMemory = new Map();

  const routeKey = (r) => (r.view === 'detail' ? `pokemon:${r.key}` : `list:${r.ranking ?? ''}`);

  // Ranglisten-Adressen: raid-<typ>[-mega], great, ultra, master, max-<typ>.
  function parseRanking(text) {
    const league = Power.data.rules.leagues.find((l) => l.id === text);
    if (league) return { use: league.id };
    const m = /^(raid|max)-([a-z]+)(-mega)?$/.exec(text);
    if (!m) return null;
    const type = m[2].toUpperCase();
    if (!Power.TYPE_ORDER.includes(type)) return null;
    return { use: m[1], type, group: m[3] ? 'mega' : 'all' };
  }

  function parse(hash = window.location.hash) {
    const poke = /^#pokemon=([a-z0-9-]+)$/.exec(hash);
    if (poke && Power.pokemon(poke[1])) return { view: 'detail', key: poke[1] };
    const ranking = /^#rangliste=([a-z0-9-]+)$/.exec(hash);
    if (ranking && parseRanking(ranking[1])) return { view: 'list', ranking: ranking[1] };
    return { view: 'list' };
  }

  const hashOf = (r) => (r.view === 'detail' ? `#pokemon=${r.key}` : r.ranking ? `#rangliste=${r.ranking}` : '');

  function scrollToMain() {
    const top = document.getElementById('main').getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - 8));
  }

  function show(r, { restore = false } = {}) {
    const previous = current;
    if (previous && routeKey(previous) === routeKey(r)) return;
    if (previous) scrollMemory.set(routeKey(previous), window.scrollY);
    for (const [name, view] of Object.entries(views)) view.hidden = name !== r.view;
    if (previous?.view === 'detail' && r.view !== 'detail') views.detail.replaceChildren();
    current = r;

    if (r.view === 'detail') {
      const from = history.state?.inApp ? history.state.from ?? '' : '';
      Detail.render(r.key, views.detail, { backLabel: from.startsWith('#rangliste=') ? '← Zur Rangliste' : '← Alle Pokémon' });
      document.title = `${Power.pokemon(r.key).name} – lohnt sich das Power-up? | Power-Kompass`;
      scrollToMain();
      document.getElementById('detail-title')?.focus({ preventScroll: true });
      return;
    }

    document.title = BASE_TITLE;
    // Ranglisten-Adresse: Filter setzen (nur beim Wechsel dorthin, nicht beim Zurückkehren aus einem Pokémon).
    if (r.ranking && !(restore && previous?.view === 'detail')) {
      Overview.showRanking(parseRanking(r.ranking));
      if (!restore) { scrollToMain(); document.getElementById('list-title')?.focus({ preventScroll: true }); return; }
    }
    if (restore && scrollMemory.has(routeKey(r))) {
      window.scrollTo(0, scrollMemory.get(routeKey(r)));
      const tile = previous?.view === 'detail'
        ? [...views.list.querySelectorAll(`a.poke-tile[data-pokemon="${previous.key}"]`)].find((a) => a.getClientRects().length)
        : null;
      (tile ?? document.getElementById('main')).focus({ preventScroll: true });
    } else if (previous) {
      window.scrollTo(0, 0);
      document.getElementById('main').focus({ preventScroll: true });
    }
  }

  function navigate(hash) {
    history.pushState({ inApp: true, from: current ? hashOf(current) : null }, '', hash || window.location.pathname + window.location.search);
    show(parse(hash));
  }

  function init() {
    if (!Power.ready) {
      document.getElementById('main').replaceChildren(Power.el('div', { class: 'state state--error' }, [
        Power.el('p', { class: 'state__title', text: 'Die Daten konnten nicht geladen werden.' }),
        Power.el('p', { text: 'Die Datei data/pokemon-data.js fehlt oder ist leer. Führe "node scripts/build-data.mjs" aus.' }),
      ]));
      return;
    }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    Power.renderSources();
    Overview.init();

    document.querySelector('.skip-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      const main = document.getElementById('main');
      main.focus({ preventScroll: true });
      main.scrollIntoView();
    });

    document.getElementById('main').addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      // Zurück-Link: kam man aus der Liste, per Verlauf zurück (mit Scroll-Position und Fokus), sonst zur Startseite.
      if (link.id === 'back') {
        e.preventDefault();
        const from = history.state?.inApp ? history.state.from : undefined;
        if (from !== undefined && from !== null && !from.startsWith('#pokemon=')) history.back();
        else navigate('');
        return;
      }
      const hash = link.getAttribute('href');
      if (!/^#(pokemon|rangliste)=/.test(hash)) return;
      e.preventDefault();
      navigate(hash);
    });

    window.addEventListener('popstate', () => show(parse(), { restore: true }));
    window.addEventListener('hashchange', () => show(parse(), { restore: true }));
    show(parse());
  }

  document.addEventListener('DOMContentLoaded', init);
})();
