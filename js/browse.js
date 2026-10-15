'use strict';

// Ansichten "Nach Typ" (#typ, #typ=<typ>) und "Top-Rankings" (#top=<liste>).
// Beide halten sich an den Schalter "Crypto-Pokémon": Aus heißt ohne Crypto-Pokémon, Plätze neu gezählt.

const Browse = (() => {
  const { el, data, formatNumber } = Power;

  const STEP = 48;
  const TOP_TABS = [
    { id: 'gesamt', label: 'Beste Angreifer' },
    { id: 'raid', label: 'Raids je Typ' },
    { id: 'mega', label: 'Megas je Typ' },
    { id: 'max', label: 'Max-Kämpfe je Typ' },
  ];
  const state = { type: null, top: 'gesamt', typeShown: STEP, topShown: 50 };
  let target = null;
  let mode = null; // 'type' oder 'top'

  const typeSlug = (type) => type.toLowerCase();
  const typeName = (type) => data.types[type];

  // ---------- Daten je Typ ----------

  // Raid-Rangliste eines Typs im aktuellen Modus (ohne Crypto: ohne sie, Plätze neu gezählt).
  function raidTop(type, { megas = false, limit = Infinity } = {}) {
    const keys = data.raidTables[type][megas ? 'megas' : 'normal'];
    const list = [];
    for (const key of keys) {
      const p = Power.pokemon(key);
      if (!Power.visible(p)) continue;
      list.push({ p, entry: raidInfo(p, type), rank: list.length + 1 });
      if (list.length >= limit) break;
    }
    return list;
  }

  // Raid-Werte eines Pokémon für einen Typ: aus den Daten oder (für Typen ohne Bewertung) frisch gerechnet.
  function raidInfo(p, type) {
    const stored = Power.raidList(p).find((r) => r.type === type);
    if (stored) return stored;
    const megaLevel = p.variant !== 'normal' ? p.megaLevels : null;
    const best = PowerCalc.bestPve(data, p, PowerCalc.pveStats(data, p, { megaLevel }), type, { megaLevel });
    return best ? { type, grade: 0, fast: best.fast, charged: best.charged, dps: best.dps, tdo: best.tdo } : null;
  }

  // Dynamax-Pokémon mit Max-Attacke dieses Typs, bester zuerst.
  function maxTop(type, limit = Infinity) {
    return data.pokemon.filter((p) => p.rating.max?.attack.some((a) => a.type === type))
      .map((p) => ({ p, a: p.rating.max.attack.find((a) => a.type === type) }))
      .sort((x, y) => x.a.rank - y.a.rank)
      .slice(0, limit);
  }

  // ---------- Bausteine ----------

  const moveName = (id) => Power.move(id)?.name ?? id;

  function rankRow(p, rank, grade, detail) {
    return el('li', {}, [el('a', { class: 'rank-row', href: `#pokemon=${p.key}`, data: { pokemon: p.key } }, [
      el('span', { class: 'rank-row__rank', text: String(rank) }),
      Power.pokemonArt(p, { size: 'sm' }),
      el('span', { class: 'rank-row__body' }, [
        el('span', { class: 'rank-row__name' }, [el('span', { text: p.name }), ...Power.badges(p)]),
        el('span', { class: 'rank-row__detail', text: detail }),
      ]),
      Power.gradeBadge(grade),
    ])]);
  }

  function section(id, title, intro, children) {
    return el('section', { class: 'browse-section', 'aria-labelledby': `${id}-title` }, [
      el('div', { class: 'section-head' }, [
        el('h3', { class: 'section-title section-title--small', id: `${id}-title`, text: title }),
        intro ? el('p', { text: intro }) : null,
      ]),
      ...children,
    ]);
  }

  function typeGrid(selected) {
    return el('nav', { class: 'type-grid', 'aria-label': 'Typ wählen' }, [el('ul', { class: 'type-grid__list' }, Power.TYPE_ORDER.map((t) => el('li', {}, [
      el('a', {
        class: `type-btn type-${typeSlug(t)}`, href: `#typ=${typeSlug(t)}`, data: { type: t },
        'aria-current': selected === t ? 'page' : null,
      }, [el('span', { class: 'type-btn__dot', 'aria-hidden': 'true' }), typeName(t)]),
    ])))]);
  }

  // Effektivität: wogegen der Typ stark ist (Angriff) und wogegen Pokémon dieses Typs schwach sind (Verteidigung).
  function typeFacts(type) {
    const eff = data.typeEffectiveness;
    const strong = Power.TYPE_ORDER.filter((d) => eff[type][d] > 1);
    const weakTo = Power.TYPE_ORDER.filter((a) => eff[a][type] > 1);
    const chips = (list) => (list.length ? list.map((t) => Power.typeChip(t, true)) : [el('span', { class: 'muted', text: 'keine' })]);
    return el('dl', { class: 'type-facts' }, [
      el('div', {}, [el('dt', { text: `${typeName(type)}-Attacken sind sehr effektiv gegen` }), el('dd', {}, chips(strong))]),
      el('div', {}, [el('dt', { text: `${typeName(type)}-Pokémon sind schwach gegen` }), el('dd', {}, chips(weakTo))]),
    ]);
  }

  // ---------- Ansicht "Nach Typ" ----------

  function renderType() {
    const type = state.type;
    const head = el('div', { class: 'section-head' }, [
      el('h2', { class: 'section-title', id: 'browse-title', tabindex: '-1', text: type ? `${typeName(type)}-Pokémon` : 'Nach Typ' }),
      el('p', { text: type ? 'Die besten Angreifer dieses Typs und alle Pokémon mit diesem Typ.' : 'Wähle einen Typ.' }),
    ]);
    if (!type) return [head, typeGrid(null)];

    const crypto = Power.settings.crypto ? '' : ' (ohne Crypto)';
    const attackers = raidTop(type, { limit: 10 });
    const megas = raidTop(type, { megas: true, limit: 3 });
    const dynamax = maxTop(type, 5);
    const own = data.pokemon.filter((p) => Power.visible(p) && p.types.includes(type))
      .sort((a, b) => Power.gradeOf(b) - Power.gradeOf(a) || Number(Boolean(Power.evolveOf(a))) - Number(Boolean(Power.evolveOf(b))) || Overview.byDex(a, b));
    const shown = own.slice(0, state.typeShown);
    const rest = own.length - shown.length;
    const raidDetail = (x) => (x.entry ? `${moveName(x.entry.fast)} + ${moveName(x.entry.charged)}` : '');
    return [
      head,
      typeGrid(type),
      typeFacts(type),
      section('type-raid', `Beste ${typeName(type)}-Angreifer für Raids${crypto}`, 'Gegen einen Raid-Boss, der schwach gegen diesen Typ ist (Level 40, 15/15/15).', [
        el('ol', { class: 'rank-rows', id: 'type-raid-list' }, attackers.map((x) => rankRow(x.p, x.rank, x.entry?.grade ?? 0, raidDetail(x)))),
        el('a', { class: 'more-link', href: `#rangliste=raid-${typeSlug(type)}`, text: `Ganze Rangliste (${formatNumber(raidTop(type).length)} Pokémon) →` }),
      ]),
      megas.length ? section('type-mega', `Beste ${typeName(type)}-Megas`, 'Pro Person ist im Raid nur eine Mega aktiv – auf ihrem höchsten Mega-Level gerechnet.', [
        el('ol', { class: 'rank-rows', id: 'type-mega-list' }, megas.map((x) => rankRow(x.p, x.rank, x.entry?.grade ?? 0, raidDetail(x)))),
      ]) : null,
      dynamax.length ? section('type-max', `Beste ${typeName(type)}-Angreifer in Max-Kämpfen`, 'Nur Dynamax- und Gigadynamax-Exemplare aus Max-Kämpfen.', [
        el('ol', { class: 'rank-rows', id: 'type-max-list' }, dynamax.map((x) => rankRow(x.p, x.a.rank, x.a.grade, x.p.rating.max.kinds.includes('gigantamax') ? 'Dynamax / Gigadynamax' : 'Dynamax'))),
      ]) : null,
      section('type-all', `Alle ${typeName(type)}-Pokémon`, `${formatNumber(own.length)} Pokémon mit diesem Typ – beste Bewertung zuerst.`, [
        el('ul', { class: 'poke-grid', id: 'type-grid-list' }, shown.map((p) => el('li', {}, [Overview.tile(p)]))),
        rest > 0 ? el('button', {
          type: 'button', class: 'more-btn', id: 'type-more',
          onclick: () => {
            const before = state.typeShown;
            state.typeShown += STEP;
            render();
            target.querySelector(`#type-grid-list > li:nth-child(${before + 1}) a`)?.focus({ preventScroll: true });
          },
        }, [`Weitere ${Math.min(STEP, rest)} anzeigen (noch ${formatNumber(rest)})`]) : null,
      ]),
    ];
  }

  // ---------- Ansicht "Top-Rankings" ----------

  // Stärkste Raid-Angreifer über alle Typen: jedes Pokémon mit seinem besten Typ, verglichen mit den Top 5 dieses Typs.
  function overallTop() {
    return data.pokemon.filter((p) => p.variant === 'normal' && Power.visible(p) && p.rating.raid?.length)
      .map((p) => ({ p, best: Power.raidList(p)[0] }))
      .sort((a, b) => b.best.ratio - a.best.ratio || Overview.byDex(a.p, b.p));
  }

  function topTabs() {
    return el('nav', { class: 'sub-tabs', 'aria-label': 'Rangliste wählen' }, [el('ul', { class: 'sub-tabs__list' }, TOP_TABS.map((t) => el('li', {}, [
      el('a', { class: 'sub-tabs__link', href: `#top=${t.id}`, data: { top: t.id }, 'aria-current': state.top === t.id ? 'page' : null, text: t.label }),
    ])))]);
  }

  function typeCard(type, rows, more) {
    return el('article', { class: `type-card type-${typeSlug(type)}`, data: { type } }, [
      el('h3', { class: 'type-card__head' }, [Power.typeChip(type), el('a', { class: 'type-card__more', href: more, text: 'Alle →' })]),
      rows.length ? el('ol', { class: 'type-card__list' }, rows) : el('p', { class: 'muted', text: 'Keine.' }),
    ]);
  }

  function cardRow(p, rank, grade, detail) {
    return el('li', {}, [el('a', { class: 'card-row', href: `#pokemon=${p.key}`, data: { pokemon: p.key } }, [
      el('span', { class: 'card-row__rank', text: String(rank) }),
      Power.pokemonArt(p, { size: 'xs' }),
      el('span', { class: 'card-row__name' }, [el('strong', { text: p.name }), detail ? el('span', { text: detail }) : null]),
      Power.gradeBadge(grade),
    ])]);
  }

  function renderTop() {
    const crypto = Power.settings.crypto ? 'mit Crypto-Pokémon' : 'ohne Crypto-Pokémon';
    const head = el('div', { class: 'section-head' }, [
      el('h2', { class: 'section-title', id: 'browse-title', tabindex: '-1', text: 'Top-Rankings' }),
      el('p', { text: `Raids & Arenen, ${crypto}. Level 40, 15/15/15.` }),
    ]);
    let body;
    if (state.top === 'gesamt') {
      const list = overallTop();
      const shown = list.slice(0, state.topShown);
      body = [
        el('p', { class: 'list-hint', text: 'Jedes Pokémon mit seinem stärksten Angriffstyp – sortiert nach der Wertung im Vergleich zum Fünftbesten dieses Typs. Megas stehen unter „Megas je Typ“.' }),
        el('ol', { class: 'rank-rows', id: 'top-list' }, shown.map((x, i) => rankRow(x.p, i + 1, x.best.grade,
          `${typeName(x.best.type)}: Platz ${x.best.rank} · ${moveName(x.best.fast)} + ${moveName(x.best.charged)}`))),
        list.length > shown.length ? el('button', {
          type: 'button', class: 'more-btn', id: 'top-more',
          onclick: () => {
            const before = state.topShown;
            state.topShown += 50;
            render();
            target.querySelector(`#top-list > li:nth-child(${before + 1}) a`)?.focus({ preventScroll: true });
          },
        }, [`Weitere 50 anzeigen`]) : null,
      ];
    } else {
      const cards = Power.TYPE_ORDER.map((type) => {
        if (state.top === 'raid') {
          return typeCard(type, raidTop(type, { limit: 5 }).map((x) => cardRow(x.p, x.rank, x.entry?.grade ?? 0, x.entry ? `${moveName(x.entry.fast)} + ${moveName(x.entry.charged)}` : '')), `#typ=${typeSlug(type)}`);
        }
        if (state.top === 'mega') {
          return typeCard(type, raidTop(type, { megas: true, limit: 3 }).map((x) => cardRow(x.p, x.rank, x.entry?.grade ?? 0, x.entry ? `${moveName(x.entry.fast)} + ${moveName(x.entry.charged)}` : '')), `#rangliste=raid-${typeSlug(type)}-mega`);
        }
        return typeCard(type, maxTop(type, 5).map((x) => cardRow(x.p, x.a.rank, x.a.grade, x.p.rating.max.kinds.includes('gigantamax') ? 'auch Gigadynamax' : 'Dynamax')), `#rangliste=max-${typeSlug(type)}`);
      });
      const intro = {
        raid: 'Die fünf besten Angreifer je Typ gegen einen Raid-Boss, der schwach gegen diesen Typ ist.',
        mega: 'Die drei besten Mega- und Proto-Entwicklungen je Typ, auf ihrem höchsten Mega-Level.',
        max: 'Nur Dynamax- und Gigadynamax-Exemplare aus Max-Kämpfen (Daten des Dyna-Kompass).',
      }[state.top];
      body = [el('p', { class: 'list-hint', text: intro }), el('div', { class: 'type-cards', id: 'top-cards' }, cards)];
    }
    return [head, topTabs(), ...body];
  }

  // ---------- Steuerung ----------

  function render() {
    if (!target) return;
    const scrollY = window.scrollY;
    target.replaceChildren(...(mode === 'type' ? renderType() : renderTop()).filter(Boolean));
    window.scrollTo(0, scrollY);
  }

  function showType(type, panel) {
    if (state.type !== type) state.typeShown = STEP;
    state.type = type;
    mode = 'type';
    target = panel;
    render();
  }

  function showTop(tab, panel) {
    if (state.top !== tab) state.topShown = 50;
    state.top = tab;
    mode = 'top';
    target = panel;
    render();
  }

  function init() {
    Power.onSettingsChange(() => { state.typeShown = STEP; state.topShown = 50; if (target && !target.hidden) render(); });
  }

  return {
    init, showType, showTop, raidTop, overallTop, maxTop,
    TOP_TABS, hasTop: (id) => TOP_TABS.some((t) => t.id === id), currentType: () => state.type,
  };
})();
