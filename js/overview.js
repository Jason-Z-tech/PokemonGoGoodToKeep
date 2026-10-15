'use strict';

// Startseite: alle Pokémon mit Bewertung – Suche, Filter (Bewertung, Einsatz, Typ, Art) und Sortierung.
// Mit Einsatz "Raids" und einem Typ wird die Liste zur Rangliste der besten Angreifer dieses Typs.

const Overview = (() => {
  const { el, data, formatNumber } = Power;

  const STEP = 48;
  const USES = [
    { id: 'all', label: 'Alle Einsätze' },
    { id: 'raid', label: 'Raids & Arenen' },
    ...data.rules.leagues.map((l) => ({ id: l.id, label: l.name })),
    { id: 'max', label: 'Max-Kämpfe' },
  ];
  const GROUPS = [
    { id: 'all', label: 'Alle' },
    { id: 'normal', label: 'Normal' },
    { id: 'legendary', label: 'Legendär & Mysteriös' },
    { id: 'mega', label: 'Mega & Proto' },
    { id: 'shadow', label: 'Crypto' },
  ];
  const GRADE_FILTERS = [
    { id: 'all', label: 'Alle' },
    { id: 'top', label: 'Spitze', grade: 3 },
    { id: 'good', label: 'Lohnt sich', grade: 2 },
    { id: 'niche', label: 'Nische', grade: 1 },
    { id: 'no', label: 'Lohnt nicht', grade: 0 },
    { id: 'evolve', label: 'Entwickeln' },
  ];
  const DEFAULTS = { query: '', grade: 'all', group: 'all', use: 'all', type: '', sort: 'dex' };
  const state = { ...DEFAULTS, shown: STEP };

  const normalized = new Map(data.pokemon.map((p) => [p.key, Power.normalize(`${p.name} ${p.nameEn} ${p.dex}`)]));

  // Variante: normal vor Mega/Proto vor Crypto (bei gleicher Pokédex-Nummer).
  const VARIANT_ORDER = (p) => (p.shadow ? 2 : p.variant === 'normal' ? 0 : 1);
  const byDex = (a, b) => a.dex - b.dex || VARIANT_ORDER(a) - VARIANT_ORDER(b) || a.name.localeCompare(b.name, 'de');

  // ---------- Bewertung je Einsatz ----------

  function raidEntry(p, type) {
    if (!p.rating.raid) return null;
    if (!type) return p.rating.raid[0];
    return p.rating.raid.find((r) => r.type === type) ?? null;
  }

  // Platz in der Raid-Rangliste eines Typs – aus der vollständigen Liste (auch ohne eigene Bewertung).
  const raidRank = new Map();
  for (const [type, t] of Object.entries(data.raidTables)) {
    t.normal.forEach((k, i) => raidRank.set(`${type}|${k}`, i + 1));
    t.megas.forEach((k, i) => raidRank.set(`${type}|${k}`, i + 1));
  }

  // Stufe und Platz für den gewählten Einsatz (Typ nur bei Raids und Max-Kämpfen).
  function useRating(p, use = state.use, type = state.type, group = state.group) {
    if (use === 'all') return { grade: p.rating.grade, rank: null };
    if (use === 'raid') {
      // Megas haben eine eigene Rangliste (pro Person nur eine aktiv) – nur unter "Mega & Proto".
      if ((p.variant !== 'normal') !== (group === 'mega')) return null;
      if (type) {
        const rank = raidRank.get(`${type}|${p.key}`);
        if (!rank) return null;
        return { grade: raidEntry(p, type)?.grade ?? 0, rank };
      }
      const r = raidEntry(p);
      return r ? { grade: r.grade, rank: r.rank, type: r.type } : null;
    }
    if (use === 'max') {
      const m = p.rating.max;
      if (!m) return null;
      if (type) {
        const a = m.attack.find((x) => x.type === type);
        return a ? { grade: a.grade, rank: a.rank } : null;
      }
      return { grade: m.grade, rank: m.attack[0]?.rank ?? null, type: m.attack[0]?.type };
    }
    const l = p.rating[use];
    return l ? { grade: l.grade, rank: l.rank } : null;
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
    if (filter === 'evolve') return Boolean(p.rating.evolve);
    const g = GRADE_FILTERS.find((f) => f.id === filter).grade;
    if (state.use === 'all') return !p.rating.evolve && p.rating.grade === g;
    return rating.grade === g;
  }

  function candidates(overrides = {}) {
    const s = { ...state, ...overrides };
    const query = Power.normalize(s.query);
    const list = [];
    for (const p of data.pokemon) {
      if (query && !normalized.get(p.key).includes(query)) continue;
      if (!matchesGroup(p, s.group)) continue;
      const rating = useRating(p, s.use, s.type, s.group);
      if (!rating) continue;
      // Typ-Filter: bei Raids und Max-Kämpfen der Angriffstyp, sonst der Typ des Pokémon.
      if (s.type && s.use !== 'raid' && s.use !== 'max' && !p.types.includes(s.type)) continue;
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
        : (a, b) => b.rating.grade - a.rating.grade || Number(Boolean(a.p.rating.evolve)) - Number(Boolean(b.p.rating.evolve)) || byDex(a.p, b.p),
    }[state.sort];
    return [...list].sort(cmp);
  }

  // ---------- Darstellung ----------

  function tile(p, rating) {
    const ranked = state.use !== 'all' && rating.rank;
    const use = USES.find((u) => u.id === state.use);
    return el('a', { class: `poke-tile poke-tile--${Power.verdictOf(p).id}${ranked ? ' poke-tile--ranked' : ''}`, href: `#pokemon=${p.key}`, data: { pokemon: p.key } }, [
      ranked ? el('span', { class: 'poke-tile__rank', title: `Platz in ${use.label}`, text: `#${rating.rank}` }) : null,
      Power.pokemonArt(p, { size: 'md' }),
      el('span', { class: 'poke-tile__body' }, [
        el('span', { class: 'poke-tile__name' }, [el('span', { text: p.name })]),
        el('span', { class: 'poke-tile__meta' }, [
          el('span', { class: 'poke-tile__dex', text: `#${String(p.dex).padStart(3, '0')}` }),
          Power.typeDots(p.types),
          ...Power.badges(p),
        ]),
        el('span', { class: 'poke-tile__verdict' }, [
          state.use === 'all' ? Power.verdictBadge(p) : Power.gradeBadge(rating.grade),
          el('span', { class: 'poke-tile__reason', text: state.use === 'all' ? Power.shortReason(p) : useText(p, rating) }),
        ]),
      ]),
    ]);
  }

  function useText(p, rating) {
    const type = rating.type ?? state.type;
    if (state.use === 'raid') return `Platz ${rating.rank}${type ? ` als ${data.types[type]}-Angreifer` : ''}${p.variant !== 'normal' ? ' (Megas)' : ''}`;
    if (state.use === 'max') return `Platz ${rating.rank} ${type ? `(${data.types[type]})` : ''} – nur als Dynamax`;
    const l = p.rating[state.use];
    return `Platz ${l.rank} von ${formatNumber(l.of)} · Wertung ${formatNumber(l.score, 1)}`;
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
          if (key === 'use' && o.id === 'all' && state.grade === 'evolve') state.grade = 'all';
          render();
          document.querySelector(`#${id} button[data-value="${o.id}"]`)?.focus({ preventScroll: true });
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
    const typeLabel = state.use === 'raid' || state.use === 'max' ? 'Angriffstyp' : 'Typ';
    const changed = Object.keys(DEFAULTS).some((k) => k !== 'query' && state[k] !== DEFAULTS[k]);
    return el('div', { class: 'filters' }, [
      chipGroup('filter-use', 'Einsatz', USES, 'use'),
      chipGroup('filter-grade', 'Bewertung', gradeOptions, 'grade', gradeCounts),
      el('div', { class: 'filters__row' }, [
        select('filter-type', typeLabel, [{ id: '', label: 'Alle Typen' }, ...Power.TYPE_ORDER.map((t) => ({ id: t, label: data.types[t] }))], 'type'),
        select('filter-group', 'Art', GROUPS, 'group'),
        select('filter-sort', 'Sortierung', [
          { id: 'dex', label: 'Pokédex-Nummer' },
          { id: 'best', label: state.use === 'all' ? 'Beste zuerst' : 'Rangliste (Platz)' },
          { id: 'name', label: 'Name (A–Z)' },
        ], 'sort'),
      ]),
      changed ? el('button', {
        type: 'button', class: 'reset-btn', id: 'filter-reset',
        onclick: () => {
          Object.assign(state, { ...DEFAULTS, query: state.query, shown: STEP });
          render();
          document.querySelector('#filter-use button[data-value="all"]')?.focus({ preventScroll: true });
        },
      }, ['Filter zurücksetzen']) : null,
    ]);
  }

  function hintText() {
    if (state.use === 'raid') {
      return state.type
        ? `Rangliste: die besten ${data.types[state.type]}-Angreifer gegen einen Raid-Boss, der schwach gegen ${data.types[state.type]} ist (Level 40, 15/15/15). ${state.group === 'mega' ? 'Mega-Entwicklungen auf ihrem höchsten Mega-Level.' : 'Mega-Entwicklungen stehen unter „Art: Mega & Proto“.'}`
        : 'Pokémon mit ihrem stärksten Angriffstyp. Wähle einen Angriffstyp für die vollständige Rangliste.';
    }
    if (state.use === 'max') return 'Gilt nur für Dynamax- und Gigadynamax-Pokémon aus Max-Kämpfen – mehr im Dyna-Kompass.';
    if (state.use !== 'all') return `Platz in der Gesamt-Rangliste von PvPoke für die ${Power.league(state.use).name} – mit passenden IVs (Details auf der Pokémon-Seite).`;
    return null;
  }

  function render() {
    const list = sorted(candidates().filter(({ p, rating }) => matchesGrade(p, state.grade, rating)));
    const target = document.getElementById('list-controls');
    target.replaceChildren(controls());
    const hint = hintText();
    document.getElementById('list-hint').textContent = hint ?? '';
    document.getElementById('list-hint').hidden = !hint;
    const query = state.query.trim();
    document.getElementById('list-count').textContent = list.length
      ? `${formatNumber(list.length)} ${list.length === 1 ? 'Pokémon' : 'Pokémon'}${query ? ` passen zu „${query}“` : ''}`
      : `Kein Pokémon passt${query ? ` zu „${query}“` : ''} – Filter lockern?`;
    const shown = list.slice(0, state.shown);
    document.getElementById('poke-grid').replaceChildren(...shown.map(({ p, rating }) => el('li', {}, [tile(p, rating)])));
    const rest = list.length - shown.length;
    const more = document.getElementById('list-more');
    more.hidden = rest <= 0;
    more.textContent = `Weitere ${Math.min(STEP, rest)} anzeigen (noch ${formatNumber(rest)})`;
    document.getElementById('search-clear').hidden = !state.query;
  }

  function showMore() {
    const before = state.shown;
    state.shown += STEP;
    render();
    document.querySelector(`#poke-grid > li:nth-child(${before + 1}) a`)?.focus({ preventScroll: true });
  }

  function init() {
    const count = (f) => data.pokemon.filter(f).length;
    document.getElementById('data-meta').replaceChildren(
      el('strong', { text: formatNumber(count((p) => p.variant === 'normal' && !p.shadow)) }), ' Pokémon · ',
      `${formatNumber(count((p) => p.shadow))} Crypto · ${count((p) => p.variant !== 'normal')} Mega & Proto`,
      data.sources.gameMasterDate ? ` · Spieldaten vom ${Power.formatDate(data.sources.gameMasterDate)}` : '',
    );
    const search = document.getElementById('search');
    search.addEventListener('input', () => { state.query = search.value; state.shown = STEP; render(); });
    document.getElementById('finder').addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('search-clear').addEventListener('click', () => {
      search.value = '';
      state.query = '';
      state.shown = STEP;
      render();
      search.focus();
    });
    document.getElementById('list-more').addEventListener('click', showMore);
    // Der Browser stellt Formularwerte beim Neuladen wieder her – Anzeige daran angleichen.
    window.addEventListener('pageshow', () => { state.query = search.value; render(); });
    render();
  }

  // Für Direktlinks wie #raid=FIRE: Rangliste eines Typs zeigen.
  function showRanking({ use, type = '', group = 'all' }) {
    Object.assign(state, { ...DEFAULTS, use, type, group, sort: 'best', shown: STEP });
    document.getElementById('search').value = '';
    render();
  }

  return { init, render, showRanking, useRating, raidRank: (type, key) => raidRank.get(`${type}|${key}`) ?? null };
})();
