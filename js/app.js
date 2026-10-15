'use strict';

// Start und Navigation. Drei Ansichten der Liste – "Alle Pokémon" (Startseite, #rangliste=<einsatz> als Rangliste),
// "Nach Typ" (#typ, #typ=<typ>) und "Top-Rankings" (#top=<liste>) – und die Pokémon-Seite (#pokemon=<schlüssel>).
// Zurück führt dorthin, wo man herkam – an die gemerkte Stelle und auf den Eintrag, von dem man kam.

const PowerApp = (() => {
  let views = null;
  const BASE_TITLE = document.title;
  let current = null;
  const scrollMemory = new Map();

  const routeKey = (r) => {
    if (r.view === 'detail') return `pokemon:${r.key}`;
    if (r.sub === 'type') return `typ:${r.type ?? ''}`;
    if (r.sub === 'top') return `top:${r.top}`;
    return `alle:${r.ranking ?? ''}`;
  };

  // Ranglisten-Adressen der Ansicht "Alle Pokémon": raid-<typ>[-mega], max-<typ>.
  function parseRanking(text) {
    const m = /^(raid|max)-([a-z]+)(-mega)?$/.exec(text);
    if (!m || (m[1] === 'max' && m[3])) return null;
    const type = m[2].toUpperCase();
    if (!Power.TYPE_ORDER.includes(type)) return null;
    return { use: m[1], type, group: m[3] ? 'mega' : 'all' };
  }

  function parse(hash = window.location.hash) {
    const poke = /^#pokemon=([a-z0-9-]+)$/.exec(hash);
    if (poke && Power.pokemon(poke[1])) return { view: 'detail', key: poke[1] };
    const ranking = /^#rangliste=([a-z0-9-]+)$/.exec(hash);
    if (ranking && parseRanking(ranking[1])) return { view: 'list', sub: 'all', ranking: ranking[1] };
    const type = /^#typ(?:=([a-z]+))?$/.exec(hash);
    if (type) {
      const t = type[1]?.toUpperCase();
      return { view: 'list', sub: 'type', type: t && Power.TYPE_ORDER.includes(t) ? t : null };
    }
    const top = /^#top(?:=([a-z]+))?$/.exec(hash);
    if (top) return { view: 'list', sub: 'top', top: Browse.hasTop(top[1]) ? top[1] : 'gesamt' };
    return { view: 'list', sub: 'all' };
  }

  function hashOf(r) {
    if (r.view === 'detail') return `#pokemon=${r.key}`;
    if (r.sub === 'type') return r.type ? `#typ=${r.type.toLowerCase()}` : '#typ';
    if (r.sub === 'top') return `#top=${r.top}`;
    return r.ranking ? `#rangliste=${r.ranking}` : '';
  }

  // Beschriftung des Zurück-Links: dorthin, woher man kam.
  function backLabel(from) {
    if (!from) return '← Alle Pokémon';
    const r = parse(from);
    if (r.view === 'detail') return '← Alle Pokémon';
    if (r.sub === 'type') return r.type ? `← ${Power.data.types[r.type]}-Pokémon` : '← Nach Typ';
    if (r.sub === 'top') return '← Top-Rankings';
    return r.ranking ? '← Zur Rangliste' : '← Alle Pokémon';
  }

  function scrollToMain() {
    const top = document.getElementById('main').getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - 8));
  }

  function setTabs(sub) {
    for (const link of document.querySelectorAll('.view-tabs__link')) {
      if (link.dataset.view === sub) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    // "Nach Typ" merkt sich den zuletzt gewählten Typ.
    const typeTab = document.querySelector('.view-tabs__link[data-view="type"]');
    const last = Browse.currentType();
    typeTab.setAttribute('href', last ? `#typ=${last.toLowerCase()}` : '#typ');
  }

  function show(r, { restore = false } = {}) {
    const previous = current;
    if (previous && routeKey(previous) === routeKey(r)) return;
    if (previous) scrollMemory.set(routeKey(previous), window.scrollY);
    views.list.hidden = r.view !== 'list';
    views.detail.hidden = r.view !== 'detail';
    if (previous?.view === 'detail' && r.view !== 'detail') views.detail.replaceChildren();
    current = r;

    if (r.view === 'detail') {
      const from = history.state?.inApp ? history.state.from ?? '' : '';
      Detail.render(r.key, views.detail, { backLabel: backLabel(from) });
      document.title = `${Power.pokemon(r.key).name} – lohnt sich das Power-up? | Power-Kompass`;
      scrollToMain();
      document.getElementById('detail-title')?.focus({ preventScroll: true });
      return;
    }

    views.all.hidden = r.sub !== 'all';
    views.browse.hidden = r.sub === 'all';
    const backFromDetail = restore && previous?.view === 'detail';
    if (r.sub === 'type') {
      Browse.showType(r.type, views.browse);
      document.title = r.type ? `${Power.data.types[r.type]}-Pokémon – Power-Kompass` : `Nach Typ – Power-Kompass`;
    } else if (r.sub === 'top') {
      Browse.showTop(r.top, views.browse);
      document.title = 'Top-Rankings – Power-Kompass';
    } else {
      document.title = BASE_TITLE;
      // Ranglisten-Adresse: Filter setzen (nicht beim Zurückkehren aus einem Pokémon – dort bleibt alles, wie es war).
      if (r.ranking && !backFromDetail) Overview.showRanking(parseRanking(r.ranking));
    }
    setTabs(r.sub);

    if (restore && scrollMemory.has(routeKey(r))) {
      window.scrollTo(0, scrollMemory.get(routeKey(r)));
      const origin = previous?.view === 'detail'
        ? [...views.list.querySelectorAll(`a[data-pokemon="${previous.key}"]`)].find((a) => a.getClientRects().length)
        : null;
      (origin ?? document.getElementById('main')).focus({ preventScroll: true });
    } else if (previous) {
      scrollToMain();
      document.getElementById(r.sub === 'all' ? 'all-title' : 'browse-title')?.focus({ preventScroll: true });
    }
  }

  // Vorwärts innerhalb der Seite: neuer Verlaufseintrag mit der Adresse, von der man kam.
  // scroll: zur Liste springen, auch wenn die Ansicht schon offen ist (Suche "Alle Treffer").
  function navigate(hash, { scroll = false } = {}) {
    const next = parse(hash);
    if (current && routeKey(current) === routeKey(next)) {
      if (scroll) { scrollToMain(); document.getElementById(next.view === 'detail' ? 'detail-title' : next.sub === 'all' ? 'all-title' : 'browse-title')?.focus({ preventScroll: true }); }
      return;
    }
    history.pushState({ inApp: true, from: current ? hashOf(current) : null }, '', hash || window.location.pathname + window.location.search);
    show(next);
  }

  function init() {
    views = {
      list: document.getElementById('view-list'),
      all: document.getElementById('panel-all'),
      browse: document.getElementById('panel-browse'),
      detail: document.getElementById('view-detail'),
    };
    if (!Power.ready) {
      document.getElementById('main').replaceChildren(Power.el('div', { class: 'state state--error' }, [
        Power.el('p', { class: 'state__title', text: 'Die Daten konnten nicht geladen werden.' }),
        Power.el('p', { text: 'Die Datei data/pokemon-data.js fehlt oder ist leer. Führe "node scripts/build-data.mjs" aus.' }),
      ]));
      return;
    }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    Power.renderSources();
    const count = (f) => Power.data.pokemon.filter(f).length;
    document.getElementById('data-meta').replaceChildren(
      Power.el('strong', { text: Power.formatNumber(count((p) => p.variant === 'normal' && !p.shadow)) }), ' Pokémon · ',
      `${Power.formatNumber(count((p) => p.shadow))} Crypto · ${count((p) => p.variant !== 'normal')} Mega & Proto`,
      Power.data.sources.gameMasterDate ? ` · Spieldaten vom ${Power.formatDate(Power.data.sources.gameMasterDate)}` : '',
    );
    Search.init();
    Overview.init();
    Browse.init();

    // Schalter "Crypto-Pokémon": gilt für alle Ansichten und die Pokémon-Seite.
    const crypto = document.getElementById('crypto-toggle');
    const cryptoHint = document.getElementById('crypto-hint');
    const syncCrypto = () => {
      Power.setCrypto(crypto.checked);
      cryptoHint.textContent = crypto.checked ? 'an – Crypto-Pokémon zählen mit' : 'aus – Listen und Plätze ohne Crypto';
    };
    crypto.addEventListener('change', syncCrypto);
    window.addEventListener('pageshow', syncCrypto);
    syncCrypto();

    document.querySelector('.skip-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      const main = document.getElementById('main');
      main.focus({ preventScroll: true });
      main.scrollIntoView();
    });

    document.getElementById('main').addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      // Zurück-Link: per Verlauf zurück (mit Scroll-Position und Fokus), wenn man aus einer Liste kam, sonst zur Startseite.
      if (link.id === 'back') {
        e.preventDefault();
        const from = history.state?.inApp ? history.state.from : undefined;
        if (from !== undefined && from !== null && !from.startsWith('#pokemon=')) history.back();
        else navigate('');
        return;
      }
      const hash = link.getAttribute('href');
      if (hash !== '#' && !/^#(pokemon|rangliste|typ|top)(=|$)/.test(hash)) return;
      e.preventDefault();
      navigate(hash === '#' ? '' : hash);
    });

    window.addEventListener('popstate', () => show(parse(), { restore: true }));
    window.addEventListener('hashchange', () => show(parse(), { restore: true }));
    show(parse());
  }

  document.addEventListener('DOMContentLoaded', init);
  return { navigate };
})();
