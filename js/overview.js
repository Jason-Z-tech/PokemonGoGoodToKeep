'use strict';

// Ansicht "Alle Pokémon": jedes Pokémon mit Bewertung für Raids und Arenen – Suche (oben auf der Seite), Filter
// (Anzeige, Bewertung, Typ, Art) und Sortierung. Mit "Rangliste" und einem Typ wird die Liste zur vollständigen
// Rangliste dieses Angriffstyps.
// Der Schalter "Crypto-Pokémon" blendet Crypto-Pokémon aus und rechnet Plätze und Bewertungen ohne sie.

const Overview = (() => {
  const { el, data, formatNumber } = Power;

  const STEP = 48;
  // Bewertet wird nur für Raids und Arenen. "Urteil": jedes Pokémon mit seinem Urteil; "Rangliste": nach Platz
  // als Angreifer (mit Typ: die ganze Rangliste dieses Angriffstyps).
  const USES = [
    { id: 'all', label: 'Urteil' },
    { id: 'raid', label: 'Rangliste', inLabel: 'in der Raid-Rangliste' },
  ];
  const GROUPS = [
    { id: 'all', label: 'Alle' },
    { id: 'normal', label: 'Normal (ohne Crypto)' },
    { id: 'legendary', label: 'Legendär, Mysteriös & Ultrabestien' },
    { id: 'mega', label: 'Mega & Proto' },
    { id: 'shadow', label: 'Nur Crypto', crypto: true },
  ];
  const GRADE_FILTERS = [
    { id: 'all', label: 'Alle' },
    { id: 'top', label: 'Spitze', grade: 3 },
    { id: 'good', label: 'Lohnt sich', grade: 2 },
    { id: 'niche', label: 'Nische', grade: 1 },
    { id: 'no', label: 'Lohnt nicht', grade: 0 },
    { id: 'evolve', label: 'Entwickeln' },
  ];
  const DEFAULTS = { grade: 'all', group: 'all', use: 'all', type: '', sort: 'dex' };
  const state = { ...DEFAULTS, query: '', shown: STEP };
  const renderListeners = [];

  const index = new Map(data.pokemon.map((p) => [p.key, Power.searchIndex(p)]));

  // Variante: normal vor Mega/Proto vor Crypto (bei gleicher Pokédex-Nummer).
  const VARIANT_ORDER = (p) => (p.shadow ? 2 : p.variant === 'normal' ? 0 : 1);
  const byDex = (a, b) => a.dex - b.dex || VARIANT_ORDER(a) - VARIANT_ORDER(b) || a.name.localeCompare(b.name, 'de');

  // ---------- Plätze ----------

  // Platz in der vollständigen Raid-Rangliste eines Typs – mit und ohne Crypto-Pokémon.
  const ranks = { crypto: new Map(), plain: new Map() };
  for (const [type, t] of Object.entries(data.raidTables)) {
    t.normal.forEach((k, i) => ranks.crypto.set(`${type}|${k}`, i + 1));
    t.normal.filter((k) => !Power.pokemon(k).shadow).forEach((k, i) => ranks.plain.set(`${type}|${k}`, i + 1));
    t.megas.forEach((k, i) => { ranks.crypto.set(`${type}|${k}`, i + 1); ranks.plain.set(`${type}|${k}`, i + 1); });
  }
  const raidRank = (type, key) => (Power.settings.crypto ? ranks.crypto : ranks.plain).get(`${type}|${key}`) ?? null;

  // Stufe und Platz für die gewählte Liste.
  function useRating(p, use = state.use, type = state.type, group = state.group) {
    if (use === 'all') return { grade: Power.gradeOf(p), rank: null };
    // Megas haben eine eigene Rangliste (pro Person nur eine aktiv) – nur unter "Mega & Proto".
    if ((p.variant !== 'normal') !== (group === 'mega')) return null;
    const list = Power.raidList(p);
    if (type) {
      const rank = raidRank(type, p.key);
      if (!rank) return null;
      return { grade: list.find((r) => r.type === type)?.grade ?? 0, rank, type };
    }
    return list[0] ? { grade: list[0].grade, rank: list[0].rank, type: list[0].type } : null;
  }

  // ---------- Filter ----------

  function matchesGroup(p, group) {
    if (group === 'normal') return p.variant === 'normal' && !p.shadow && !p.class;
    if (group === 'legendary') return Boolean(p.class) && p.variant === 'normal';
    if (group === 'mega') return p.variant !== 'normal';
    if (group === 'shadow') return p.shadow;
    return true;
  }

  function matchesGrade(p, filter, rating) {
    if (filter === 'all') return true;
    if (filter === 'evolve') return Boolean(Power.evolveOf(p));
    const g = GRADE_FILTERS.find((f) => f.id === filter).grade;
    if (state.use === 'all') return !Power.evolveOf(p) && Power.gradeOf(p) === g;
    return rating.grade === g;
  }

  function candidates(overrides = {}) {
    const s = { ...state, ...overrides };
    const query = Power.normalize(s.query);
    const list = [];
    for (const p of data.pokemon) {
      if (!Power.visible(p)) continue;
      if (query && !Power.matchesQuery(index.get(p.key), query)) continue;
      if (!matchesGroup(p, s.group)) continue;
      const rating = useRating(p, s.use, s.type, s.group);
      if (!rating) continue;
      // Typ-Filter: in der Raid-Rangliste der Angriffstyp, sonst der Typ des Pokémon.
      if (s.type && s.use === 'all' && !p.types.includes(s.type)) continue;
      list.push({ p, rating });
    }
    return list;
  }

  function sorted(list) {
    const ranked = state.use !== 'all';
    const cmp = {
      dex: (a, b) => byDex(a.p, b.p),
      name: (a, b) => a.p.name.localeCompare(b.p.name, 'de'),
      best: ranked
        ? (a, b) => (a.rating.rank ?? 1e9) - (b.rating.rank ?? 1e9) || b.rating.grade - a.rating.grade || byDex(a.p, b.p)
        : (a, b) => b.rating.grade - a.rating.grade || Number(Boolean(Power.evolveOf(a.p))) - Number(Boolean(Power.evolveOf(b.p))) || byDex(a.p, b.p),
    }[state.sort];
    return [...list].sort(cmp);
  }

  // ---------- Darstellung ----------

  // Kachel eines Pokémon (auch von den anderen Ansichten genutzt). rank: Platz oben rechts, reason: Text darunter.
  function tile(p, { rank = null, grade = null, reason = null, rankTitle = 'Platz' } = {}) {
    return el('a', {
      class: `poke-tile poke-tile--${grade === null ? Power.verdictOf(p).id : Power.GRADES[grade].id}${rank ? ' poke-tile--ranked' : ''}`,
      href: `#pokemon=${p.key}`, data: { pokemon: p.key },
    }, [
      rank ? el('span', { class: 'poke-tile__rank', title: rankTitle, text: `#${rank}` }) : null,
      Power.pokemonArt(p, { size: 'md' }),
      el('span', { class: 'poke-tile__body' }, [
        el('span', { class: 'poke-tile__name' }, [el('span', { text: p.name })]),
        el('span', { class: 'poke-tile__meta' }, [
          el('span', { class: 'poke-tile__dex', text: `#${String(p.dex).padStart(3, '0')}` }),
          Power.typeDots(p.types),
          ...Power.badges(p),
        ]),
        el('span', { class: 'poke-tile__verdict' }, [
          grade === null ? Power.verdictBadge(p) : Power.gradeBadge(grade),
          el('span', { class: 'poke-tile__reason', text: reason ?? Power.shortReason(p) }),
        ]),
      ]),
    ]);
  }

  function useText(p, rating) {
    const type = rating.type ?? state.type;
    return `Platz ${rating.rank}${type ? ` als ${data.types[type]}-Angreifer` : ''}${p.variant !== 'normal' ? ' (Megas)' : ''}`;
  }

  function chipGroup(id, label, options, key, counts = null) {
    return el('div', { class: 'chips', role: 'group', 'aria-label': label, id }, [
      el('span', { class: 'control-label', text: label }),
      el('div', { class: 'chips__list' }, options.map((o) => el('button', {
        type: 'button',
        class: `chip${o.grade !== undefined ? ` chip--grade chip--${o.id}` : o.id === 'evolve' ? ' chip--grade chip--evolve' : ''}`,
        'aria-pressed': String(state[key] === o.id),
        data: { value: o.id },
        onclick: () => {
          state[key] = o.id;
          state.shown = STEP;
          if (key === 'use' && o.id !== 'all' && state.sort === 'dex') state.sort = 'best';
          render();
          const chip = document.querySelector(`#${id} button[data-value="${o.id}"]`);
          chip?.focus({ preventScroll: true });
          // Handy: Die Chip-Zeile scrollt seitlich – der gewählte Chip bleibt sichtbar.
          chip?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        },
      }, [o.label, counts ? el('small', { class: 'chip__count', text: ` ${counts[o.id] ?? 0}` }) : null]))),
    ]);
  }

  function select(id, label, options, key) {
    return el('label', { class: 'select' }, [
      el('span', { class: 'control-label', text: label }),
      el('select', {
        id, autocomplete: 'off',
        onchange: (e) => {
          state[key] = e.target.value;
          state.shown = STEP;
          render();
          document.getElementById(id)?.focus({ preventScroll: true });
        },
      }, options.map((o) => el('option', { value: o.id, selected: state[key] === o.id, text: o.label }))),
    ]);
  }

  function controls() {
    const gradeCounts = {};
    const base = candidates({ grade: 'all' });
    for (const f of GRADE_FILTERS) gradeCounts[f.id] = base.filter(({ p, rating }) => matchesGrade(p, f.id, rating)).length;
    const gradeOptions = GRADE_FILTERS.filter((f) => f.id !== 'evolve' || state.use === 'all');
    const typeLabel = state.use === 'all' ? 'Typ' : 'Angriffstyp';
    const changed = Object.keys(DEFAULTS).some((k) => state[k] !== DEFAULTS[k]);
    return el('div', { class: 'filters' }, [
      chipGroup('filter-use', 'Anzeige', USES, 'use'),
      chipGroup('filter-grade', 'Bewertung', gradeOptions, 'grade', gradeCounts),
      el('div', { class: 'filters__row' }, [
        select('filter-type', typeLabel, [{ id: '', label: 'Alle Typen' }, ...Power.TYPE_ORDER.map((t) => ({ id: t, label: data.types[t] }))], 'type'),
        select('filter-group', 'Art', GROUPS.filter((g) => !g.crypto || Power.settings.crypto), 'group'),
        select('filter-sort', 'Sortierung', [
          { id: 'dex', label: 'Pokédex-Nummer' },
          { id: 'best', label: state.use === 'all' ? 'Beste zuerst' : 'Rangliste (Platz)' },
          { id: 'name', label: 'Name (A–Z)' },
        ], 'sort'),
      ]),
      changed ? el('button', {
        type: 'button', class: 'reset-btn', id: 'filter-reset',
        onclick: () => {
          Object.assign(state, DEFAULTS, { shown: STEP });
          render();
          document.querySelector('#filter-use button[data-value="all"]')?.focus({ preventScroll: true });
        },
      }, ['Filter zurücksetzen']) : null,
    ]);
  }

  function hintText() {
    const crypto = Power.settings.crypto ? '' : ' Ohne Crypto-Pokémon gerechnet.';
    if (state.use === 'raid') {
      return state.type
        ? `Rangliste: die besten ${data.types[state.type]}-Angreifer gegen einen Raid-Boss, der schwach gegen ${data.types[state.type]} ist (Level 40, 15/15/15). ${state.group === 'mega' ? 'Mega-Entwicklungen auf ihrem höchsten Mega-Level.' : 'Mega-Entwicklungen stehen unter „Art: Mega & Proto“.'}${crypto}`
        : `Pokémon mit ihrem stärksten Angriffstyp. Wähle einen Angriffstyp für die vollständige Rangliste.${crypto}`;
    }
    return null;
  }

  function render() {
    // Filter, die es in dieser Einstellung nicht gibt, fallen weg ("Entwickeln" nur beim Urteil,
    // "Nur Crypto" nur mit Crypto-Pokémon).
    if (state.grade === 'evolve' && state.use !== 'all') state.grade = 'all';
    if (state.group === 'shadow' && !Power.settings.crypto) state.group = 'all';
    const list = sorted(candidates().filter(({ p, rating }) => matchesGrade(p, state.grade, rating)));
    const target = document.getElementById('list-controls');
    // Seitlich gescrollte Chip-Zeilen (Handy) bleiben, wo sie waren.
    const chipScroll = [...target.querySelectorAll('.chips')].map((g) => [g.id, g.querySelector('.chips__list').scrollLeft]);
    target.replaceChildren(controls());
    for (const [gid, x] of chipScroll) {
      const row = target.querySelector(`#${gid} .chips__list`);
      if (row) row.scrollLeft = x;
    }
    const hint = hintText();
    document.getElementById('list-hint').textContent = hint ?? '';
    document.getElementById('list-hint').hidden = !hint;
    const query = state.query.trim();
    document.getElementById('list-count').textContent = list.length
      ? `${formatNumber(list.length)} Pokémon${query ? ` ${list.length === 1 ? 'passt' : 'passen'} zu „${query}“` : ''}`
      : `Kein Pokémon passt${query ? ` zu „${query}“` : ''} – Filter lockern?`;
    const shown = list.slice(0, state.shown);
    const ranked = state.use !== 'all';
    document.getElementById('poke-grid').replaceChildren(...shown.map(({ p, rating }) => el('li', {}, [
      ranked ? tile(p, { rank: rating.rank, grade: rating.grade, reason: useText(p, rating), rankTitle: `Platz ${USES.find((u) => u.id === state.use)?.inLabel ?? ''}` }) : tile(p),
    ])));
    const rest = list.length - shown.length;
    const more = document.getElementById('list-more');
    more.hidden = rest <= 0;
    more.textContent = `Weitere ${Math.min(STEP, rest)} anzeigen (noch ${formatNumber(rest)})`;
    for (const fn of renderListeners) fn();
  }

  function showMore() {
    const before = state.shown;
    state.shown += STEP;
    render();
    document.querySelector(`#poke-grid > li:nth-child(${before + 1}) a`)?.focus({ preventScroll: true });
  }

  function init() {
    document.getElementById('list-more').addEventListener('click', showMore);
    Search.onQuery((q) => { state.query = q; state.shown = STEP; render(); });
    Power.onSettingsChange(() => {
      state.shown = STEP;
      render();
    });
    state.query = Search.query();
    render();
  }

  // Für Adressen wie #rangliste=raid-fire: die ganze Rangliste zeigen (ohne Suche).
  function showRanking({ use, type = '', group = 'all' }) {
    Object.assign(state, DEFAULTS, { use, type, group, sort: 'best', shown: STEP, query: '' });
    Search.set('');
    render();
  }

  // Zustand der Liste für den Verlauf: Zurück zeigt die Liste so, wie sie war (Filter, Suche, Anzahl).
  const snapshot = () => ({ query: state.query, grade: state.grade, group: state.group, use: state.use, type: state.type, sort: state.sort, shown: state.shown });
  // Gemerkte Stände können aus einer älteren Version stammen (z. B. Anzeige "Max-Kämpfe"): Unbekanntes fällt weg.
  function restore(saved) {
    Object.assign(state, DEFAULTS, { shown: STEP }, saved);
    if (!USES.some((u) => u.id === state.use)) state.use = DEFAULTS.use;
    if (!GRADE_FILTERS.some((f) => f.id === state.grade)) state.grade = DEFAULTS.grade;
    if (!GROUPS.some((g) => g.id === state.group)) state.group = DEFAULTS.group;
    if (!['dex', 'best', 'name'].includes(state.sort)) state.sort = DEFAULTS.sort;
    if (state.type && !Power.TYPE_ORDER.includes(state.type)) state.type = DEFAULTS.type;
    if (!(state.shown >= STEP)) state.shown = STEP;
    if (typeof state.query !== 'string') state.query = '';
    Search.set(state.query);
    render();
  }

  // onRender: nach jeder Änderung der Liste (die Navigation merkt sich den Stand im Verlaufseintrag).
  return { init, render, showRanking, snapshot, restore, onRender: (fn) => renderListeners.push(fn), tile, raidRank, byDex };
})();
