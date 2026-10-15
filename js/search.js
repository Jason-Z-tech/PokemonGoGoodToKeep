'use strict';

// Suche oben auf der Seite: Name (deutsch oder englisch) oder Pokédex-Nummer eingeben, Vorschläge erscheinen
// darunter (Pfeiltasten + Enter oder antippen). Auf der Ansicht "Alle Pokémon" filtert die Eingabe zugleich die Liste.
// Aufbau nach dem ARIA-Muster "Combobox mit Listbox".

const Search = (() => {
  const { el, data } = Power;
  const MAX_SUGGESTIONS = 8;
  const index = new Map(data.pokemon.map((p) => [p.key, Power.searchIndex(p)]));
  const queryListeners = [];
  let input = null;
  let list = null;
  let options = [];
  let active = -1;

  const VARIANT_ORDER = (p) => (p.shadow ? 2 : p.variant === 'normal' ? 0 : 1);

  // Treffer, beste zuerst: Name beginnt mit der Eingabe, dann ein Wort darin, dann irgendwo; Nummer genau.
  function matches(query) {
    const q = Power.normalize(query);
    if (!q) return [];
    const number = /^\d+$/.test(q) ? Number(q) : null;
    const hits = [];
    for (const p of data.pokemon) {
      if (!Power.visible(p)) continue;
      const n = index.get(p.key);
      let score = null;
      if (number !== null) score = p.dex === number ? 0 : String(p.dex).startsWith(q) ? 3 : null;
      else if (n.name.startsWith(q)) score = 0;
      else if (n.text.split(' ').some((w) => w.startsWith(q))) score = 1;
      else if (Power.matchesQuery(n, q)) score = 2;
      if (score !== null) hits.push({ p, score });
    }
    return hits.sort((a, b) => a.score - b.score || VARIANT_ORDER(a.p) - VARIANT_ORDER(b.p) || a.p.dex - b.p.dex
      || a.p.name.localeCompare(b.p.name, 'de')).map((h) => h.p);
  }

  function setActive(i) {
    active = i;
    options.forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', options[i].id);
      options[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }

  function choose(option) {
    const hash = option.dataset.href;
    close();
    if (hash.startsWith('#pokemon=')) {
      input.value = '';
      notify();
    }
    PowerApp.navigate(hash, { scroll: true });
  }

  function render() {
    const query = input.value.trim();
    const hits = matches(query);
    document.getElementById('search-clear').hidden = !query;
    options = [];
    if (!query) { list.replaceChildren(); close(); return; }
    const shown = hits.slice(0, MAX_SUGGESTIONS);
    options = shown.map((p, i) => el('li', {
      id: `search-option-${i}`, role: 'option', class: 'suggest__option', 'aria-selected': 'false', data: { href: `#pokemon=${p.key}`, pokemon: p.key },
    }, [
      Power.pokemonArt(p, { size: 'xs' }),
      el('span', { class: 'suggest__name' }, [p.name, el('small', { text: ` #${String(p.dex).padStart(3, '0')}` })]),
      Power.verdictBadge(p, { small: true }),
    ]));
    options.push(el('li', {
      id: 'search-option-all', role: 'option', class: 'suggest__option suggest__option--all', 'aria-selected': 'false', data: { href: '' },
    }, [hits.length ? `Alle ${Power.formatNumber(hits.length)} Treffer in der Liste zeigen` : `Kein Pokémon passt zu „${query}“`]));
    list.replaceChildren(...options);
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  }

  const notify = () => { for (const fn of queryListeners) fn(input.value); };

  function onKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) render();
      if (!options.length) return;
      e.preventDefault();
      // Reihum durch die Vorschläge; nach dem letzten wieder ins Eingabefeld (-1).
      let next = active + (e.key === 'ArrowDown' ? 1 : -1);
      if (next >= options.length) next = -1;
      else if (next < -1) next = options.length - 1;
      setActive(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Ohne gewählten Vorschlag: alle Treffer in der Liste zeigen.
      if (active >= 0) choose(options[active]);
      else if (options.length) choose(options[options.length - 1]);
    } else if (e.key === 'Escape') {
      if (!list.hidden) { e.preventDefault(); close(); } else if (input.value) { input.value = ''; render(); notify(); }
    }
  }

  function init() {
    input = document.getElementById('search');
    list = document.getElementById('search-suggest');
    input.addEventListener('input', () => { render(); notify(); });
    input.addEventListener('keydown', onKey);
    input.addEventListener('focus', () => { if (input.value.trim()) render(); });
    document.getElementById('finder').addEventListener('submit', (e) => e.preventDefault());
    // Maus und Finger: mousedown statt click, damit das Eingabefeld den Fokus nicht vorher verliert.
    list.addEventListener('mousedown', (e) => {
      const option = e.target.closest('[role="option"]');
      if (!option) return;
      e.preventDefault();
      choose(option);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#finder')) close(); });
    document.getElementById('search-clear').addEventListener('click', () => {
      input.value = '';
      render();
      notify();
      input.focus();
    });
    // Der Browser stellt Formularwerte beim Neuladen wieder her.
    window.addEventListener('pageshow', () => { notify(); document.getElementById('search-clear').hidden = !input.value; });
    Power.onSettingsChange(() => { if (!list.hidden) render(); });
  }

  return {
    init,
    onQuery: (fn) => queryListeners.push(fn),
    query: () => input?.value ?? '',
    clear: () => { if (input) { input.value = ''; render(); notify(); } },
    // Eingabe setzen, ohne die Liste zu benachrichtigen (Zurück stellt eine frühere Liste wieder her).
    set: (value) => { if (input) { input.value = value; document.getElementById('search-clear').hidden = !value; close(); } },
    matches,
  };
})();
