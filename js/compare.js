'use strict';

// Ansicht "Vergleich" (#vergleich=<platz 1>,<platz 2>): zwei Pokémon nebeneinander, jedes mit eigenen IVs, Level,
// Glück, Erlöst, Bester Kumpel, Mega-Level und Attacken. Ergebnis: welches lohnt sich für Raids & Arenen mehr
// (DPS, TDO, Wertung, Stufe und Platz mit diesen IVs), Werte auf Level 40/50 und was das Hochleveln kostet.
// Adresse eines Platzes: schlüssel:angriff-vert-kp:level[:merkmale[:sofort-attacke[:lade-attacke]]] mit den
// Merkmalen g = Glücks-Pokémon, e = Erlöst, k = Bester Kumpel, m1–m4 = Mega-Level. Sie ändert sich mit jeder
// Eingabe, damit man einen Vergleich teilen kann und Zurück ihn wiederherstellt.

const Compare = (() => {
  const { el, data, formatNumber, formatLevel, formatPercent } = Power;

  const FULL = { atk: 15, def: 15, sta: 15 };
  const START_LEVEL = 20;
  const LEVELS = [40, 50];
  const SAME = 0.02; // unter 2 % Unterschied: praktisch gleich stark
  const MAX_SUGGESTIONS = 8;
  const EXAMPLE = 'crypto-mewtwo:13-12-13:20,mewtwo:15-15-14:20';
  const SLOT_NAMES = ['Pokémon 1', 'Pokémon 2'];

  const blankSlot = () => ({ key: null, iv: { ...FULL }, level: START_LEVEL, lucky: false, purified: false, buddy: false, megaLevel: null, fast: null, charged: null });
  const state = { slots: [blankSlot(), blankSlot()], type: null };
  let target = null;
  let active = false;

  // ---------- Pokémon eines Platzes ----------

  const pokemonOf = (s) => (s.key ? Power.pokemon(s.key) : null);
  const isMega = (p) => p.variant !== 'normal';
  const ownerOf = (p) => (isMega(p) ? Power.pokemon(p.parent) : p); // Power-ups gelten für die normale Form
  const canBeLucky = (p) => { const o = ownerOf(p); return o.tradable && !o.shadow; };
  const canBePurified = (p) => { const o = ownerOf(p); return !o.shadow && Boolean(o.shadowKey); };
  const movesOf = (p, megaLevel) => PowerCalc.pveMoves(data, p, { elite: true, megaLevel });
  const ivText = (iv) => formatPercent(Power.ivPercent(iv), 0);
  // Name mit IVs – unterscheidet auch zwei gleiche Pokémon ("Mewtu (98 %)").
  const label = (s) => `${pokemonOf(s).name} (${ivText(s.iv)})`;

  // Nur erlaubte Werte: Glück/Erlöst nur, wo möglich, Mega-Level nur bei Megas, Attacken nur aus dem Attackenpool.
  function normalize(s) {
    const p = pokemonOf(s);
    if (!p) return blankSlot();
    const megaLevel = isMega(p) ? Math.min(s.megaLevel ?? p.megaLevels, p.megaLevels) : null;
    const moves = movesOf(p, megaLevel);
    return {
      ...s,
      lucky: s.lucky && canBeLucky(p),
      purified: s.purified && canBePurified(p),
      megaLevel,
      fast: moves.fast.some((m) => m.id === s.fast) ? s.fast : null,
      charged: moves.charged.some((m) => m.id === s.charged) ? s.charged : null,
    };
  }

  // ---------- Adresse ----------

  function encodeSlot(s) {
    if (!s.key) return '';
    const flags = `${s.lucky ? 'g' : ''}${s.purified ? 'e' : ''}${s.buddy ? 'k' : ''}${s.megaLevel ? `m${s.megaLevel}` : ''}`;
    const parts = [s.key, `${s.iv.atk}-${s.iv.def}-${s.iv.sta}`, String(s.level), flags, s.fast ?? '', s.charged ?? ''];
    while (parts.length > 3 && !parts.at(-1)) parts.pop();
    return parts.join(':');
  }

  function decodeSlot(text) {
    const [key, ivs = '', level = '', flags = '', fast = '', charged = ''] = (text ?? '').split(':');
    const s = blankSlot();
    if (!key || !Power.pokemon(key)) return s;
    s.key = key;
    const iv = ivs.split('-').map(Number);
    if (iv.length === 3 && iv.every((v) => Number.isInteger(v) && v >= 0 && v <= 15)) s.iv = { atk: iv[0], def: iv[1], sta: iv[2] };
    const l = Number(level);
    if (l >= 1 && l <= data.rules.maxLevel && Number.isInteger(l * 2)) s.level = l;
    s.lucky = flags.includes('g');
    s.purified = flags.includes('e');
    s.buddy = flags.includes('k');
    const mega = /m([1-4])/.exec(flags);
    if (mega) s.megaLevel = Number(mega[1]);
    s.fast = fast || null;
    s.charged = charged || null;
    return normalize(s);
  }

  const hash = () => {
    const slots = state.slots.map(encodeSlot);
    return slots.some(Boolean) ? `#vergleich=${slots.join(',')}` : '#vergleich';
  };

  function saveHash() {
    if (active && window.location.hash !== hash()) history.replaceState(history.state, '', hash());
  }

  // Link von der Pokémon-Seite: dieses Pokémon mit seinen Eingaben, daneben die Crypto- bzw. normale Form.
  function linkFor(p, { iv = FULL, level = START_LEVEL, lucky = false, purified = false, buddy = false, megaLevel = null } = {}) {
    const a = normalize({ ...blankSlot(), key: p.key, iv: { ...iv }, level, lucky, purified, buddy, megaLevel });
    const other = p.shadow ? p.normalKey : isMega(p) ? null : p.shadowKey;
    const b = other && Power.pokemon(other) ? normalize({ ...blankSlot(), key: other, level }) : blankSlot();
    return `#vergleich=${encodeSlot(a)},${encodeSlot(b)}`;
  }

  // ---------- Rechnung ----------

  // Wertung aller Pokémon einer Raid-Rangliste (Level 40, 15/15/15, beste Attacken) – wie im Daten-Skript.
  const tables = new Map();
  function tableScores(type, megas) {
    const id = `${type}|${megas}`;
    if (!tables.has(id)) {
      const keys = data.raidTables[type]?.[megas ? 'megas' : 'normal'] ?? [];
      tables.set(id, keys.map((key) => {
        const p = Power.pokemon(key);
        const megaLevel = megas ? p.megaLevels : null;
        const best = PowerCalc.bestPve(data, p, PowerCalc.pveStats(data, p, { megaLevel }), type, { megaLevel });
        return { key, shadow: p.shadow, score: best?.score ?? 0 };
      }).sort((a, b) => b.score - a.score));
    }
    return tables.get(id);
  }

  const gradeByRatio = (ratio, limits) => (ratio >= limits[0] - 1e-9 ? 3 : ratio >= limits[1] ? 2 : ratio >= limits[2] ? 1 : 0);

  // Stufe und Platz in der Rangliste dieses Typs mit der eigenen Wertung (Level 40 und diesen IVs).
  // Vergleichsmaßstab wie in den Ranglisten: der Fünftbeste des Typs, bei Megas die beste Mega.
  function standing(p, type, score) {
    const megas = isMega(p);
    const withCrypto = Power.withCrypto(p);
    const list = tableScores(type, megas).filter((x) => withCrypto || !x.shadow);
    if (!list.length) return null;
    const ref = megas ? list[0].score : list[Math.min(4, list.length - 1)].score;
    const others = list.filter((x) => x.key !== p.key);
    const ratio = score / ref;
    return {
      ratio,
      grade: gradeByRatio(ratio, megas ? data.rules.grades.mega : data.rules.grades.raid),
      rank: 1 + others.filter((x) => x.score > score + 1e-9).length,
      of: others.length + 1,
      megas,
      withCrypto,
    };
  }

  function evaluate(s) {
    const p = pokemonOf(s);
    if (!p) return null;
    const owner = ownerOf(p);
    const megaLevel = isMega(p) ? s.megaLevel : null;
    const megaBoost = megaLevel ? data.rules.megaLevels[megaLevel - 1].selfCpBoost : 0;
    const boost = PowerCalc.levelBoost(data, { buddy: s.buddy, megaBoost });
    const moves = movesOf(p, megaLevel);
    const types = [...new Set(moves.charged.filter((c) => !s.charged || c.id === s.charged).map((c) => c.type))];
    const perf = {};
    for (const type of types) {
      const at = Object.fromEntries(LEVELS.map((level) => [level, PowerCalc.bestPve(data, p,
        PowerCalc.pveStats(data, p, { level, iv: s.iv, buddy: s.buddy, megaLevel }), type,
        { megaLevel, fast: s.fast, charged: s.charged })]));
      if (!at[40]) continue;
      perf[type] = { ...at, standing: standing(p, type, at[40].score) };
    }
    const ranked = Object.keys(perf).sort((a, b) => (perf[b].standing?.grade ?? 0) - (perf[a].standing?.grade ?? 0)
      || (perf[b].standing?.ratio ?? 0) - (perf[a].standing?.ratio ?? 0));
    const opts = { lucky: s.lucky && canBeLucky(p), purified: s.purified && canBePurified(p) };
    return {
      s, p, owner, boost, perf, best: ranked[0] ?? null,
      cp: (level) => PowerCalc.combatPower(p.base, s.iv, PowerCalc.cpmAt(data, level + boost)),
      stats: (level) => PowerCalc.statsAt(data, p, level + boost, s.iv),
      cost: (to) => (s.level < to ? PowerCalc.powerUpCost(data, owner, s.level, to, opts) : null),
    };
  }

  // Angriffstyp für den Vergleich: gewählt, sonst ein gemeinsamer Typ, in dem eines der beiden am besten dasteht.
  function chosenType(ea, eb) {
    const all = Power.TYPE_ORDER.filter((t) => ea?.perf[t] || eb?.perf[t]);
    const both = all.filter((t) => ea?.perf[t] && eb?.perf[t]);
    if (state.type && all.includes(state.type)) return { type: state.type, all, both };
    const score = (t) => Math.max(...[ea, eb].map((e) => (e?.perf[t]?.standing ? e.perf[t].standing.grade * 10 + e.perf[t].standing.ratio : 0)));
    const pool = both.length ? both : all;
    return { type: [...pool].sort((a, b) => score(b) - score(a))[0] ?? null, all, both };
  }

  // ---------- Texte ----------

  const pct = (ratio) => `${ratio >= 1 ? '+' : '−'}${formatNumber(Math.abs(ratio - 1) * 100, 0)} %`;
  const typeName = (type) => data.types[type];

  function standingText(st) {
    if (!st) return '';
    const where = st.megas ? ' Megas' : st.withCrypto ? '' : ' ohne Crypto';
    return `Platz ${st.rank} von ${st.of}${where}`;
  }

  function costText(c) {
    if (!c) return 'schon erreicht';
    const parts = [`${formatNumber(c.stardust)} Sternenstaub`];
    if (c.candy) parts.push(`${formatNumber(c.candy)} ${c.candy === 1 ? 'Bonbon' : 'Bonbons'}`);
    if (c.xl) parts.push(`${formatNumber(c.xl)} Bonbons XL`);
    return parts.join(' · ');
  }

  // Das Urteil: wer lohnt sich für diesen Typ mehr, um wie viel, und was kostet es?
  function verdict(ea, eb, type) {
    const [a, b] = [ea.perf[type], eb.perf[type]];
    const items = [];
    if (!a || !b) {
      const [has, lacks] = a ? [ea, eb] : [eb, ea];
      items.push(el('p', { class: 'compare-verdict__lead', text: `Für ${typeName(type)}-Raids nur ${label(has.s)}: ${label(lacks.s)} hat keine ${typeName(type)}-Lade-Attacke${lacks.s.charged ? ' (mit der gewählten Attacke)' : ''}.` }));
      return { winner: has === ea ? 0 : 1, items };
    }
    const r40 = a[40].score / b[40].score;
    const same = Math.abs(r40 - 1) < SAME;
    const [win, lose, wp, lp, ratio] = r40 >= 1 ? [ea, eb, a, b, r40] : [eb, ea, b, a, 1 / r40];
    const costW = win.cost(40);
    const costL = lose.cost(40);
    const dust = costW && costL ? costW.stardust / costL.stardust : null;
    let winner = r40 >= 1 ? 0 : 1;
    if (same) {
      // Praktisch gleich stark: das günstigere Hochleveln entscheidet.
      const cheaper = dust === null || Math.abs(dust - 1) < 0.01 ? null : dust < 1 ? win : lose;
      winner = cheaper ? (cheaper === ea ? 0 : 1) : null;
      items.push(el('p', { class: 'compare-verdict__lead', text: `Für ${typeName(type)}-Raids praktisch gleich stark (Unterschied unter ${formatNumber(SAME * 100, 0)} %).${cheaper ? ` ${label(cheaper.s)} ist günstiger hochzuleveln – das lohnt sich mehr.` : ''}` }));
    } else {
      items.push(el('p', { class: 'compare-verdict__lead' }, [
        el('strong', { text: label(win.s) }), ` lohnt sich für ${typeName(type)}-Raids mehr: auf Level 40 ${pct(ratio)} Wertung `,
        `(DPS ${pct(wp[40].dps / lp[40].dps)}, TDO ${pct(wp[40].tdo / lp[40].tdo)}).`,
      ]));
      const r50 = wp[50].score / lp[50].score;
      items.push(el('p', { text: r50 >= 1 - 1e-9 ? `Auch auf Level 50 vorne (${pct(r50)}).` : `Auf Level 50 liegt dagegen ${label(lose.s)} vorne (${pct(1 / r50)}).` }));
    }
    if (dust !== null && Math.abs(dust - 1) >= 0.01) {
      const [dear, cheap, f] = dust > 1 ? [win, lose, dust] : [lose, win, 1 / dust];
      items.push(el('p', { text: `Hochleveln bis Level 40 kostet bei ${label(dear.s)} ${formatNumber((f - 1) * 100, 0)} % mehr Sternenstaub als bei ${label(cheap.s)}.` }));
    }
    const grades = [ea, eb].map((e) => {
      const st = e.perf[type].standing;
      return st ? [el('strong', { text: label(e.s) }), ' ', Power.gradeBadge(st.grade), ` (${standingText(st)})`] : null;
    }).filter(Boolean);
    if (grades.length) items.push(el('p', {}, ['Mit diesen IVs auf Level 40: ', ...grades.flatMap((g, i) => (i ? ['; ', ...g] : g)), '.']));
    // Hinweis, wenn eines in einem anderen Typ deutlich besser dasteht.
    for (const e of [ea, eb]) {
      const best = e.best && e.perf[e.best].standing;
      const here = e.perf[type]?.standing;
      if (best && e.best !== type && best.grade > (here?.grade ?? 0)) {
        items.push(el('p', { class: 'compare-verdict__note', text: `${label(e.s)} ist vor allem als ${typeName(e.best)}-Angreifer stark (${Power.GRADES[best.grade].label}, ${standingText(best)}).` }));
      }
    }
    return { winner, items };
  }

  // ---------- Bausteine ----------

  function ivSelect(i, key, text) {
    const s = state.slots[i];
    return el('label', { class: 'iv' }, [
      el('span', { class: 'iv__label', text }),
      el('select', {
        id: `c${i}-iv-${key}`, autocomplete: 'off',
        onchange: (e) => { s.iv[key] = Number(e.target.value); onChange(i, `#c${i}-iv-${key}`); },
      }, Array.from({ length: 16 }, (_, v) => el('option', { value: String(v), selected: s.iv[key] === v, text: String(v) }))),
    ]);
  }

  function toggle(i, key, text, hint, { disabled = false } = {}) {
    const s = state.slots[i];
    return el('label', { class: `toggle${disabled ? ' toggle--disabled' : ''}` }, [
      el('input', {
        type: 'checkbox', id: `c${i}-opt-${key}`, checked: s[key] && !disabled, disabled, autocomplete: 'off',
        onchange: (e) => { s[key] = e.target.checked; onChange(i, `#c${i}-opt-${key}`); },
      }),
      el('span', { class: 'toggle__track', 'aria-hidden': 'true' }),
      el('span', { class: 'toggle__text' }, [text, hint ? el('small', { text: hint }) : null]),
    ]);
  }

  function select(i, id, text, options, value, onPick) {
    return el('label', { class: 'select select--compact' }, [
      el('span', { class: 'control-label', text }),
      el('select', {
        id: `c${i}-${id}`, autocomplete: 'off',
        onchange: (e) => { onPick(e.target.value); onChange(i, `#c${i}-${id}`); },
      }, options.map((o) => el('option', { value: o.value, selected: o.value === value, text: o.text }))),
    ]);
  }

  function moveOption(m) {
    const p = Power.move(m.id);
    return { value: m.id, text: `${p.name} (${typeName(m.type)})` };
  }

  // Suchfeld eines Platzes (Muster "Combobox mit Listbox" wie die Suche oben).
  function picker(i) {
    const s = state.slots[i];
    const p = pokemonOf(s);
    const listId = `c${i}-suggest`;
    let options = [];
    let current = -1;
    const input = el('input', {
      id: `c${i}-pick`, type: 'text', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
      'aria-controls': listId, autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
      placeholder: 'Name oder Nummer, z. B. Mewtu', value: p?.name ?? '',
    });
    const list = el('ul', { class: 'suggest', id: listId, role: 'listbox', 'aria-label': `Vorschläge für ${SLOT_NAMES[i]}`, hidden: true });
    const setActive = (j) => {
      current = j;
      options.forEach((o, k) => o.setAttribute('aria-selected', String(k === j)));
      if (j >= 0) { input.setAttribute('aria-activedescendant', options[j].id); options[j].scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
    };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); setActive(-1); };
    const open = () => {
      const hits = input.value.trim() ? Search.matches(input.value, { all: true }).slice(0, MAX_SUGGESTIONS) : [];
      options = hits.map((q, k) => el('li', { id: `c${i}-option-${k}`, role: 'option', class: 'suggest__option', 'aria-selected': 'false', data: { pokemon: q.key } }, [
        Power.pokemonArt(q, { size: 'xs' }),
        el('span', { class: 'suggest__name' }, [q.name, el('small', { text: ` #${String(q.dex).padStart(3, '0')}` })]),
        Power.verdictBadge(q, { small: true }),
      ]));
      if (!options.length && input.value.trim()) options = [el('li', { id: `c${i}-option-none`, role: 'option', class: 'suggest__option suggest__option--all', 'aria-disabled': 'true', text: `Kein Pokémon passt zu „${input.value.trim()}“` })];
      list.replaceChildren(...options);
      list.hidden = !options.length;
      input.setAttribute('aria-expanded', String(!list.hidden));
      setActive(-1);
    };
    const choose = (key) => {
      close();
      if (!key) return;
      state.slots[i] = normalize({ ...state.slots[i], key, fast: null, charged: null, megaLevel: null });
      render({ focus: `#c${i}-pick` });
    };
    input.addEventListener('input', open);
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.hidden) open();
        const usable = options.filter((o) => o.dataset.pokemon);
        if (!usable.length) return;
        e.preventDefault();
        let next = current + (e.key === 'ArrowDown' ? 1 : -1);
        if (next >= usable.length) next = -1; else if (next < -1) next = usable.length - 1;
        setActive(next);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = current >= 0 ? options[current] : options.find((o) => o.dataset.pokemon);
        choose(pick?.dataset.pokemon);
      } else if (e.key === 'Escape') {
        if (!list.hidden) { e.preventDefault(); close(); }
        input.value = p?.name ?? '';
      }
    });
    input.addEventListener('blur', () => { close(); input.value = pokemonOf(state.slots[i])?.name ?? ''; });
    // Maus und Finger: mousedown statt click, damit das Feld den Fokus nicht vorher verliert.
    list.addEventListener('mousedown', (e) => {
      const option = e.target.closest('[data-pokemon]');
      if (!option) return;
      e.preventDefault();
      choose(option.dataset.pokemon);
    });
    return el('div', { class: 'compare-pick' }, [el('label', { class: 'control-label', for: input.id, text: 'Pokémon' }), input, list]);
  }

  function slotCard(i) {
    const s = state.slots[i];
    const p = pokemonOf(s);
    const children = [el('h3', { class: 'compare-slot__title', id: `c${i}-title`, text: SLOT_NAMES[i] }), picker(i)];
    if (p) {
      const moves = movesOf(p, s.megaLevel);
      children.push(
        el('a', { class: 'compare-slot__head', href: `#pokemon=${p.key}`, data: { pokemon: p.key } }, [
          Power.pokemonArt(p, { size: 'sm' }),
          el('span', { class: 'compare-slot__name' }, [
            el('strong', { text: p.name }),
            el('span', { class: 'compare-slot__chips' }, [...p.types.map((t) => Power.typeChip(t, true)), ...Power.badges(p)]),
          ]),
          Power.verdictBadge(p, { small: true }),
        ]),
        el('p', { class: 'mine__iv-total', id: `c${i}-iv-total` }, [`IVs ${s.iv.atk}/${s.iv.def}/${s.iv.sta} · `, el('strong', { text: ivText(s.iv) })]),
        el('div', { class: 'mine__ivs' }, [ivSelect(i, 'atk', 'Angriff'), ivSelect(i, 'def', 'Verteidigung'), ivSelect(i, 'sta', 'KP')]),
        select(i, 'level', 'Level jetzt', Array.from({ length: (data.rules.maxLevel - 1) * 2 + 1 }, (_, k) => 1 + k / 2)
          .map((l) => ({ value: String(l), text: `Level ${formatLevel(l)}` })), String(s.level), (v) => { s.level = Number(v); }),
        el('div', { class: 'compare-moves' }, [
          select(i, 'fast', 'Sofort-Attacke', [{ value: '', text: 'Beste' }, ...moves.fast.map(moveOption)], s.fast ?? '', (v) => { s.fast = v || null; }),
          select(i, 'charged', 'Lade-Attacke', [{ value: '', text: 'Beste je Typ' }, ...moves.charged.map(moveOption)], s.charged ?? '', (v) => { s.charged = v || null; }),
        ]),
        el('div', { class: 'mine__toggles' }, [
          toggle(i, 'lucky', 'Glücks-Pokémon', canBeLucky(p) ? 'halber Sternenstaub' : 'nicht möglich', { disabled: !canBeLucky(p) }),
          canBePurified(p) ? toggle(i, 'purified', 'Erlöst', '10 % günstiger') : null,
          toggle(i, 'buddy', 'Bester Kumpel', `+${data.rules.buddyBoostLevels} Level`),
        ]),
        isMega(p) ? el('fieldset', { class: 'segmented', id: `c${i}-mega` }, [
          el('legend', { class: 'control-label', text: p.variant === 'primal' ? 'Proto-Level' : 'Mega-Level' }),
          el('div', { class: 'segmented__options' }, data.rules.megaLevels.slice(0, p.megaLevels).map((l) => el('label', {}, [
            el('input', {
              type: 'radio', name: `c${i}-mega-level`, value: String(l.level), checked: s.megaLevel === l.level, autocomplete: 'off',
              onchange: () => { s.megaLevel = l.level; onChange(i, `input[name=c${i}-mega-level][value="${l.level}"]`); },
            }),
            el('span', { text: l.name.replace('-Level', '') }),
          ]))),
        ]) : null,
      );
    }
    return el('section', { class: `compare-slot compare-slot--${i}`, id: `c${i}-slot`, 'aria-labelledby': `c${i}-title` }, children);
  }

  // Zeile der Ergebnis-Tabelle; better: Index des besseren Werts (0, 1) oder null.
  function row(title, cells, better = null) {
    return el('tr', {}, [
      el('th', { scope: 'row', text: title }),
      ...cells.map((c, i) => el('td', { class: better === i ? 'is-better' : null }, [
        better === i ? el('span', { class: 'compare-check', 'aria-hidden': 'true', text: '✓ ' }) : null,
        better === i ? el('span', { class: 'visually-hidden', text: 'besser: ' }) : null,
        ...[].concat(c),
      ])),
    ]);
  }
  const betterOf = (x, y, higher = true) => {
    if (x === null || y === null || x === undefined || y === undefined || Math.abs(x - y) <= Math.abs(y) * 0.005) return null;
    return (x > y) === higher ? 0 : 1;
  };

  function table(id, caption, ea, eb, rows) {
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'data-table compare-table', id }, [
      el('caption', { text: caption }),
      el('thead', {}, [el('tr', {}, [
        el('th', { scope: 'col', text: '' }),
        el('th', { scope: 'col', class: 'compare-col compare-col--0', text: label(ea.s) }),
        el('th', { scope: 'col', class: 'compare-col compare-col--1', text: label(eb.s) }),
      ])]),
      el('tbody', {}, rows),
    ])]);
  }

  function results() {
    const [ea, eb] = state.slots.map(evaluate);
    if (!ea || !eb) {
      return el('div', { class: 'compare-empty', id: 'compare-result' }, [
        el('p', { text: 'Wähle oben zwei Pokémon und gib ihre IVs ein – dann siehst du, welches sich für Raids & Arenen mehr lohnt.' }),
        !ea && !eb ? el('button', {
          type: 'button', class: 'preset', id: 'compare-example',
          onclick: () => { show(EXAMPLE); target.querySelector('#compare-result')?.focus({ preventScroll: true }); },
        }, ['Beispiel: Crypto-Mewtu (84 %) gegen Mewtu (98 %)']) : null,
      ]);
    }
    const { type, all, both } = chosenType(ea, eb);
    if (!type) {
      return el('div', { class: 'compare-empty', id: 'compare-result' }, [el('p', { text: 'Keines der beiden hat eine Lade-Attacke, mit der es in Raids angreifen kann.' })]);
    }
    const v = verdict(ea, eb, type);
    const [a, b] = [ea.perf[type], eb.perf[type]];
    const val = (perf, level, f, d = 1) => (perf ? formatNumber(f(perf[level]), d) : '–');
    const num = (perf, level, f) => (perf ? f(perf[level]) : null);
    const raidRows = [
      row('Stufe mit diesen IVs (Level 40)', [a, b].map((x) => (x?.standing ? [Power.gradeBadge(x.standing.grade), ` ${standingText(x.standing)}`] : '–'))),
      row('Attacken', [a, b].map((x) => (x ? `${Power.move(x[40].fast).name} + ${Power.move(x[40].charged).name}` : '–'))),
      ...LEVELS.flatMap((level) => [
        row(`DPS (Level ${level})`, [val(a, level, (x) => x.dps), val(b, level, (x) => x.dps)], betterOf(num(a, level, (x) => x.dps), num(b, level, (x) => x.dps))),
        row(`TDO (Level ${level})`, [val(a, level, (x) => x.tdo, 0), val(b, level, (x) => x.tdo, 0)], betterOf(num(a, level, (x) => x.tdo), num(b, level, (x) => x.tdo))),
      ]),
      ...LEVELS.map((level) => {
        const top = Math.max(num(a, level, (x) => x.score) ?? 0, num(b, level, (x) => x.score) ?? 0);
        return row(`Wertung (Level ${level})`, [a, b].map((x) => (x ? formatPercent(x[level].score / top, 0) : '–')),
          betterOf(num(a, level, (x) => x.score), num(b, level, (x) => x.score)));
      }),
    ];
    // Mit Kumpel- oder Super-Max-Boost: das Level, auf dem es dann kämpft.
    const boosted = (e, level) => (e.boost ? el('small', { text: ` (wie Level ${formatLevel(level + e.boost)})` }) : null);
    const statRows = [
      row('WP jetzt', [ea, eb].map((e) => [`${formatNumber(e.cp(e.s.level))} · Level ${formatLevel(e.s.level)}`, boosted(e, e.s.level)])),
      ...LEVELS.map((level) => row(`WP auf Level ${level}`, [ea, eb].map((e) => [formatNumber(e.cp(level)), boosted(e, level)]), betterOf(ea.cp(level), eb.cp(level)))),
      row('Angriff im Kampf (Level 40)', [ea, eb].map((e) => formatNumber(e.stats(40).atk, 1)), betterOf(ea.stats(40).atk, eb.stats(40).atk)),
      row('Verteidigung im Kampf (Level 40)', [ea, eb].map((e) => formatNumber(e.stats(40).def, 1)), betterOf(ea.stats(40).def, eb.stats(40).def)),
      row('KP (Level 40)', [ea, eb].map((e) => formatNumber(e.stats(40).hp)), betterOf(ea.stats(40).hp, eb.stats(40).hp)),
      ...LEVELS.map((level) => row(`Kosten bis Level ${level}`, [ea, eb].map((e) => costText(e.cost(level))),
        betterOf(ea.cost(level)?.stardust ?? 0, eb.cost(level)?.stardust ?? 0, false))),
    ];
    const typeSelect = el('label', { class: 'select select--compact compare-type' }, [
      el('span', { class: 'control-label', text: 'Angriffstyp' }),
      el('select', {
        id: 'compare-type', autocomplete: 'off',
        onchange: (e) => { state.type = e.target.value; render({ focus: '#compare-type' }); },
      }, all.map((t) => el('option', { value: t, selected: t === type, text: both.includes(t) ? typeName(t) : `${typeName(t)} (nur ${label((ea.perf[t] ? ea : eb).s)})` }))),
    ]);
    const winnerClass = v.winner === null ? '' : ` compare-verdict--${v.winner}`;
    return el('div', { class: 'compare-result', id: 'compare-result', tabindex: '-1' }, [
      typeSelect,
      el('section', { class: `compare-verdict${winnerClass}`, id: 'compare-verdict', 'aria-labelledby': 'compare-verdict-title' }, [
        el('h3', { class: 'compare-verdict__title', id: 'compare-verdict-title', text: v.winner === null ? 'Gleichstand' : `Lohnt sich mehr: ${label(state.slots[v.winner])}` }),
        ...v.items,
      ]),
      table('compare-raid', `Raids & Arenen: ${typeName(type)}`, ea, eb, raidRows),
      table('compare-stats', 'Werte und Kosten', ea, eb, statRows),
      el('p', { class: 'info-card__line', text: `Gerechnet wie die Ranglisten: gegen einen 5-Sterne-Boss, der schwach gegen ${typeName(type)} ist, mit den gewählten (sonst den besten) Attacken, Crypto mit ×1.2 Angriff und ×0.83 Verteidigung, Kumpel und Super-Max-Level mit ihrem Level-Boost. Kosten ab „Level jetzt“, Power-ups einer Mega gehen an die normale Form.` }),
    ]);
  }

  // ---------- Darstellung ----------

  function render({ focus = null } = {}) {
    if (!target) return;
    const scrollY = window.scrollY;
    target.replaceChildren(
      el('div', { class: 'section-head' }, [
        el('h2', { class: 'section-title', id: 'compare-title', tabindex: '-1', text: 'Vergleich' }),
        el('p', { text: 'Zwei Pokémon mit ihren IVs nebeneinander – welches lohnt sich für Raids & Arenen mehr?' }),
      ]),
      el('div', { class: 'compare-slots' }, [
        slotCard(0),
        el('button', {
          type: 'button', class: 'compare-swap', id: 'compare-swap', 'aria-label': 'Pokémon 1 und 2 tauschen',
          onclick: () => { state.slots.reverse(); render({ focus: '#compare-swap' }); },
        }, ['⇄ Tauschen']),
        slotCard(1),
      ]),
      results(),
    );
    if (focus) target.querySelector(focus)?.focus({ preventScroll: true });
    window.scrollTo(0, scrollY);
    saveHash();
  }

  // Nach einer Eingabe in einem Platz: Werte prüfen und alles neu zeichnen. Beim Ersetzen verliert das alte
  // Eingabefeld den Fokus und meldet evtl. noch ein "change" – das darf nicht ein zweites Mal zeichnen.
  let updating = false;
  function onChange(i, focus) {
    if (updating) return;
    updating = true;
    try {
      state.slots[i] = normalize(state.slots[i]);
      render({ focus });
    } finally {
      updating = false;
    }
  }

  // Ansicht öffnen. params: Plätze aus der Adresse (ohne: so, wie man den Vergleich verlassen hat).
  function show(params, panel = target) {
    target = panel;
    active = true;
    if (params !== null && params !== undefined) {
      const [a = '', b = ''] = params.split(',');
      state.slots = [decodeSlot(a), decodeSlot(b)];
      state.type = null;
    }
    render();
  }

  function hide() { active = false; }

  // Crypto-Schalter: Plätze und Stufen neu (ohne Crypto gezählt, außer für Crypto-Pokémon selbst).
  Power.onSettingsChange(() => { if (active) render(); });

  return { show, hide, hash, linkFor, decodeSlot, encodeSlot };
})();
