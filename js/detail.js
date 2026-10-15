'use strict';

// Pokémon-Seite: oben das Urteil und "Dein Pokémon" (IVs, Level, Glück, Erlöst, Bester Kumpel, Mega-Level),
// darunter drei Reiter – "Bewertung" (Raids, Ligen, Max-Kämpfe, Mega), "Werte & Kosten" (alle Level mit
// Power-up-Kosten) und "Attacken".

const Detail = (() => {
  const { el, data, formatNumber, formatLevel, formatPercent } = Power;

  const TABS = [
    { id: 'bewertung', label: 'Bewertung' },
    { id: 'werte', label: 'Werte & Kosten' },
    { id: 'attacken', label: 'Attacken' },
  ];
  const FULL = { atk: 15, def: 15, sta: 15 };
  const START_LEVEL = 20; // Fang aus Raids und Eiern
  // Markierte Level in der Tabelle.
  const MILESTONES = {
    15: 'Feldforschung', 20: 'Raid- und Ei-Fang', 25: 'Fang mit Wetterboost', 30: 'höchster Wildfang (ohne Wetter)',
    35: 'höchster Wildfang mit Wetter', 40: 'Ende Bonbons – ab hier Bonbons XL', 50: 'höchstes Level',
  };

  const state = {
    iv: { ...FULL }, level: START_LEVEL, lucky: false, purified: false, buddy: false, megaLevel: null,
    tab: 'bewertung', halfLevels: false, family: null, cpText: '',
  };
  let p = null;
  let container = null;

  const raidLevels = () => [40, 50];
  const maxLevel = () => data.rules.maxLevel + (state.buddy ? data.rules.buddyBoostLevels : 0);
  const isMega = () => p.variant !== 'normal';
  const megaBoost = () => (isMega() ? data.rules.megaLevels[(state.megaLevel ?? 1) - 1].selfCpBoost : 0);
  const costOptions = () => ({ lucky: state.lucky && canBeLucky(), purified: state.purified && canBePurified() });
  const canBeLucky = () => p.tradable && !p.shadow;
  const canBePurified = () => !p.shadow && Boolean(p.shadowKey);
  const ownerOf = () => (isMega() ? Power.pokemon(p.parent) : p); // Power-up gilt immer für die normale Form

  // ---------- kleine Bausteine ----------

  const moveName = (id) => Power.move(id)?.name ?? id;

  function moveChip(id, { pokemon = p, small = true } = {}) {
    const m = Power.move(id);
    if (!m) return null;
    const elite = pokemon.eliteFast.includes(id) || pokemon.eliteCharged.includes(id);
    return el('span', { class: 'move' }, [
      el('span', { class: 'move__name', text: m.name }),
      Power.typeChip(m.type, small),
      elite ? Power.eliteBadge() : null,
      m.plus ? el('span', { class: 'badge badge--mega', text: 'Mega+', title: 'Zusatz-Lade-Attacke der Mega-Entwicklung, stärker mit höherem Mega-Level' }) : null,
      pokemon.shadowMove === id ? el('span', { class: 'badge badge--shadow', text: 'Apex', title: 'Nur die Crypto-Apex-Form kennt diese Attacke' }) : null,
    ]);
  }

  function movesLine(ids, pokemon = p) {
    const parts = [];
    ids.forEach((id, i) => {
      if (i) parts.push(el('span', { class: 'row__plus', 'aria-hidden': 'true', text: i === 1 ? '+' : '/' }));
      parts.push(moveChip(id, { pokemon }));
    });
    return el('p', { class: 'moves-line' }, parts);
  }

  const card = (title, children, { id = null, modifier = '' } = {}) => el('article', { class: `info-card${modifier ? ` info-card--${modifier}` : ''}`, id }, [
    el('h3', { class: 'info-card__title', text: title }), ...children,
  ]);

  const line = (children, cls = '') => el('p', { class: `info-card__line${cls ? ` ${cls}` : ''}` }, children);

  function costText(cost) {
    const parts = [`${formatNumber(cost.stardust)} Sternenstaub`];
    if (cost.candy) parts.push(`${formatNumber(cost.candy)} Bonbons`);
    if (cost.xl) parts.push(`${formatNumber(cost.xl)} Bonbons XL`);
    return parts.join(', ');
  }

  // Kosten vom aktuellen Level bis zu einem Ziel (Bester Kumpel ist ein Boost, kein Power-up).
  function costTo(target) {
    const to = Math.min(target - (state.buddy ? data.rules.buddyBoostLevels : 0), data.rules.maxLevel);
    if (to <= state.level) return null;
    return PowerCalc.powerUpCost(data, ownerOf(), state.level, to, costOptions());
  }

  // ---------- Kopf ----------

  function header() {
    const v = Power.verdictOf(p);
    const owner = ownerOf();
    return el('section', { class: `poke-head poke-head--${v.id}`, 'aria-labelledby': 'detail-title' }, [
      Power.pokemonArt(p, { size: 'lg', eager: true }),
      el('div', { class: 'poke-head__info' }, [
        el('p', { class: 'poke-head__label', text: `#${String(p.dex).padStart(3, '0')}${p.class ? ` · ${Power.CLASSES[p.class]}` : ''}${p.nameEn ? ` · ${p.nameEn}` : ''}` }),
        el('h2', { class: 'poke-head__name', id: 'detail-title', tabindex: '-1', text: p.name }),
        el('div', { class: 'poke-head__chips' }, [...p.types.map((t) => Power.typeChip(t)), ...Power.badges(p)]),
        el('div', { class: 'poke-head__verdict' }, [
          el('span', { class: 'poke-head__question', text: 'Lohnt sich das Power-up?' }),
          Power.verdictBadge(p, { long: true }),
        ]),
        el('p', { class: 'poke-head__summary', id: 'verdict-summary', text: summaryText(v) }),
        relatedLinks(owner),
      ]),
    ]);
  }

  // Ein Satz zum Urteil: wofür das Pokémon taugt.
  function summaryText(v) {
    const r = p.rating;
    if (v.id === 'evolve') {
      const t = v.target;
      return `${p.name} selbst taugt wenig – entwickle es zuerst zu ${t.name} (${Power.GRADES[t.rating.grade].long.toLowerCase()}). Power-ups vor der Entwicklung bleiben erhalten, aber hochleveln lohnt sich erst danach.`;
    }
    const uses = [];
    const bestRaid = (r.raid ?? []).filter((x) => x.grade === Math.max(...r.raid.map((y) => y.grade)) && x.grade > 0).slice(0, 2);
    if (bestRaid.length) uses.push(`Raids als ${bestRaid.map((x) => `${data.types[x.type]}-Angreifer (Platz ${x.rank})`).join(' und ')}`);
    for (const l of data.rules.leagues) if (r[l.id]?.grade >= Math.max(1, r.grade - 1)) uses.push(`${l.name} (Platz ${r[l.id].rank})`);
    if (r.mega) uses.push(`als ${Power.pokemon(r.mega.key).name}`);
    const text = uses.length ? `Stark für: ${uses.join(', ')}.` : 'In keinem Einsatz weit vorne – nur für Sammlung, Kumpel-Bonbons oder zum Tauschen.';
    const max = r.max?.grade >= 2 ? ' Als Dynamax-Pokémon zusätzlich gut in Max-Kämpfen.' : '';
    return `${text}${max}`;
  }

  // Verwandte Einträge: normale Form, Crypto, Mega/Proto, Vorstufe, Entwicklungen, Formwechsel.
  function relatedLinks(owner) {
    const keys = [];
    const add = (key, label) => {
      const q = Power.pokemon(key);
      if (q && q.key !== p.key && !keys.some((k) => k.q.key === q.key)) keys.push({ q, label });
    };
    if (p.shadow) add(p.normalKey, 'Normal');
    if (p.parent) add(p.parent, 'Normal');
    if (owner.shadowKey) add(owner.shadowKey, 'Crypto');
    for (const m of owner.megas ?? []) add(m, Power.pokemon(m).variant === 'primal' ? 'Proto' : 'Mega');
    if (p.preEvo) add(p.preEvo, 'Vorstufe');
    for (const e of p.evolutions ?? []) add(e.key, 'Entwicklung');
    for (const f of owner.formChanges ?? []) add(f.key, 'Form');
    if (!keys.length) return null;
    return el('nav', { class: 'related', 'aria-label': 'Verwandte Formen und Entwicklungen' }, [
      el('ul', { class: 'related__list' }, keys.map(({ q, label }) => el('li', {}, [
        el('a', { class: 'related__link', href: `#pokemon=${q.key}`, data: { pokemon: q.key } }, [
          Power.pokemonArt(q, { size: 'xs' }),
          el('span', { class: 'related__text' }, [el('small', { text: label }), el('span', { text: q.name })]),
          Power.verdictBadge(q, { small: true }),
        ]),
      ]))),
    ]);
  }

  // ---------- Dein Pokémon ----------

  function ivSelect(key, label) {
    return el('label', { class: 'iv' }, [
      el('span', { class: 'iv__label', text: label }),
      el('select', {
        id: `iv-${key}`, autocomplete: 'off',
        onchange: (e) => { state.iv[key] = Number(e.target.value); onChange(`#iv-${key}`); },
      }, Array.from({ length: 16 }, (_, i) => el('option', { value: String(i), selected: state.iv[key] === i, text: String(i) }))),
    ]);
  }

  function presetButton(id, label, iv, title = null) {
    const active = state.iv.atk === iv.atk && state.iv.def === iv.def && state.iv.sta === iv.sta;
    return el('button', {
      type: 'button', class: 'preset', id: `preset-${id}`, title, 'aria-pressed': String(active),
      onclick: () => { state.iv = { ...iv }; onChange(`#preset-${id}`); },
    }, [label]);
  }

  function toggle(key, label, hint, { disabled = false } = {}) {
    return el('label', { class: `toggle${disabled ? ' toggle--disabled' : ''}` }, [
      el('input', {
        type: 'checkbox', id: `opt-${key}`, checked: state[key] && !disabled, disabled, autocomplete: 'off',
        onchange: (e) => { state[key] = e.target.checked; onChange(`#opt-${key}`); },
      }),
      el('span', { class: 'toggle__track', 'aria-hidden': 'true' }),
      el('span', { class: 'toggle__text' }, [label, hint ? el('small', { text: hint }) : null]),
    ]);
  }

  // WP eingeben: passt sie zu den IVs, setzt sie das aktuelle Level.
  function cpInput() {
    return el('label', { class: 'cp-input' }, [
      el('span', { class: 'control-label', text: 'Oder WP eingeben' }),
      el('input', {
        id: 'cp', type: 'number', inputmode: 'numeric', min: '10', max: '9999', placeholder: 'z. B. 2390', value: state.cpText, autocomplete: 'off',
        onchange: (e) => {
          state.cpText = e.target.value.trim();
          const cp = Number(state.cpText);
          const owner = ownerOf();
          if (cp) {
            const levels = [];
            for (let l = 1; l <= data.rules.maxLevel; l += 0.5) {
              if (PowerCalc.combatPower(owner.base, state.iv, PowerCalc.cpmAt(data, l)) === cp) levels.push(l);
            }
            if (levels.length) state.level = levels[0];
          }
          onChange('#cp');
        },
      }),
    ]);
  }

  function cpFeedback() {
    const cp = Number(state.cpText);
    if (!cp) return null;
    const owner = ownerOf();
    const at = PowerCalc.combatPower(owner.base, state.iv, PowerCalc.cpmAt(data, state.level));
    if (at === cp) return el('p', { class: 'cp-feedback cp-feedback--ok', id: 'cp-feedback', text: `${formatNumber(cp)} WP passen zu Level ${formatLevel(state.level)} (mit diesen IVs, ohne Bester-Kumpel-Boost).` });
    return el('p', { class: 'cp-feedback', id: 'cp-feedback', text: `${formatNumber(cp)} WP passen mit ${state.iv.atk}/${state.iv.def}/${state.iv.sta} zu keinem Level von ${owner.name} – stimmen die IVs? (WP ${isMega() ? 'der normalen Form ' : ''}ohne Mega-Entwicklung eingeben)` });
  }

  function controls() {
    const owner = ownerOf();
    const great = PowerCalc.ivTable(data, owner, 1500, data.rules.maxLevel)[0];
    const ultra = PowerCalc.ivTable(data, owner, 2500, data.rules.maxLevel)[0];
    const reachesGreat = PowerCalc.maxCp(data, owner, data.rules.maxLevel) > 1500;
    const reachesUltra = PowerCalc.maxCp(data, owner, data.rules.maxLevel) > 2500;
    const level = el('label', { class: 'select select--compact' }, [
      el('span', { class: 'control-label', text: 'Level jetzt' }),
      el('select', {
        id: 'level-now', autocomplete: 'off',
        onchange: (e) => { state.level = Number(e.target.value); state.cpText = ''; onChange('#level-now'); },
      }, Array.from({ length: (data.rules.maxLevel - 1) * 2 + 1 }, (_, i) => 1 + i / 2).map((l) => el('option', {
        value: String(l), selected: state.level === l, text: `Level ${formatLevel(l)}`,
      }))),
    ]);
    return el('form', { class: 'mine', id: 'mine', autocomplete: 'off', onsubmit: (e) => e.preventDefault(), 'aria-labelledby': 'mine-title' }, [
      el('div', { class: 'mine__head' }, [
        el('h3', { class: 'section-title section-title--small', id: 'mine-title', text: 'Dein Pokémon' }),
        el('p', { class: 'mine__iv-total', id: 'iv-total' }, ivTotalText()),
      ]),
      el('div', { class: 'mine__ivs' }, [ivSelect('atk', 'Angriff'), ivSelect('def', 'Verteidigung'), ivSelect('sta', 'KP')]),
      myVerdict(),
      el('div', { class: 'mine__presets', role: 'group', 'aria-label': 'IV-Vorlagen' }, [
        presetButton('full', '100 % (15/15/15)', FULL),
        reachesGreat ? presetButton('great', `Superliga-Ideal (${great.iv.atk}/${great.iv.def}/${great.iv.sta})`, great.iv, 'Bestes Stat-Produkt unter 1500 WP') : null,
        reachesUltra ? presetButton('ultra', `Hyperliga-Ideal (${ultra.iv.atk}/${ultra.iv.def}/${ultra.iv.sta})`, ultra.iv, 'Bestes Stat-Produkt unter 2500 WP') : null,
        presetButton('raid', 'Raid-Minimum (10/10/10)', { atk: 10, def: 10, sta: 10 }),
      ]),
      el('div', { class: 'mine__row' }, [level, cpInput()]),
      cpFeedback(),
      el('div', { class: 'mine__toggles' }, [
        toggle('lucky', 'Glücks-Pokémon', canBeLucky() ? 'halber Sternenstaub' : 'nicht möglich (nicht tauschbar)', { disabled: !canBeLucky() }),
        canBePurified() ? toggle('purified', 'Erlöst', '10 % günstiger, kein Crypto-Bonus') : null,
        toggle('buddy', 'Bester Kumpel', `+${data.rules.buddyBoostLevels} Level (bis ${data.rules.maxLevel + data.rules.buddyBoostLevels})`),
      ]),
      isMega() ? megaLevelControl() : null,
    ]);
  }

  function ivTotalText() {
    const pct = Power.ivPercent(state.iv);
    return [`IVs ${state.iv.atk}/${state.iv.def}/${state.iv.sta} · `, el('strong', { text: formatPercent(pct, Number.isInteger(Math.round(pct * 1000) / 10) ? 0 : 1) })];
  }

  function megaLevelControl() {
    const levels = data.rules.megaLevels.slice(0, p.megaLevels);
    return el('fieldset', { class: 'segmented', id: 'mega-level' }, [
      el('legend', { class: 'control-label', text: 'Mega-Level' }),
      el('div', { class: 'segmented__options' }, levels.map((l) => el('label', {}, [
        el('input', {
          type: 'radio', name: 'mega-level', value: String(l.level), checked: state.megaLevel === l.level, autocomplete: 'off',
          onchange: () => { state.megaLevel = l.level; onChange(`input[name=mega-level][value="${l.level}"]`); },
        }),
        el('span', { text: l.name.replace('-Level', '') }),
      ]))),
    ]);
  }

  // Nach jeder Eingabe: Bedienfeld und Reiter neu zeichnen, Fokus und Scroll-Position behalten.
  // Beim Ersetzen verliert das alte Eingabefeld den Fokus und meldet dabei evtl. noch ein "change" – das darf
  // nicht ein zweites Mal neu zeichnen.
  let updating = false;
  function onChange(focusSelector) {
    if (updating) return;
    updating = true;
    try {
      const scrollY = window.scrollY;
      container.querySelector('#mine').replaceWith(controls());
      renderPanel();
      container.querySelector(focusSelector)?.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
    } finally {
      updating = false;
    }
  }

  // ---------- Reiter "Bewertung" ----------

  function findings() {
    const r = p.rating;
    const items = [];
    const li = (grade, children) => el('li', { class: 'finding' }, [grade === null ? Power.verdictBadge(p) : Power.gradeBadge(grade), el('span', {}, children)]);
    if (r.evolve) {
      const t = Power.pokemon(r.evolve.key);
      const direct = (p.evolutions ?? []).find((e) => e.key === t.key);
      items.push(el('li', { class: 'finding' }, [
        el('span', { class: 'verdict verdict--evolve verdict--small', text: 'Entwickeln' }),
        el('span', {}, [
          'Entwickle es zu ', el('a', { href: `#pokemon=${t.key}`, data: { pokemon: t.key }, text: t.name }),
          direct ? ` (${direct.candy} Bonbons${direct.conditions.length ? `, ${direct.conditions.join(', ')}` : ''})` : ' (über eine Zwischenstufe)',
          ` – dort: ${Power.GRADES[t.rating.grade].long}. IVs bleiben beim Entwickeln gleich.`,
        ]),
      ]));
    }
    for (const x of r.raid ?? []) {
      if (!x.grade && items.length) continue;
      items.push(li(x.grade, [
        `Raids: Platz ${x.rank} von ${x.of} ${isMega() ? `${data.types[x.type]}-Megas` : `${data.types[x.type]}-Angreifern`} mit ${moveName(x.fast)} + ${moveName(x.charged)}.`,
        x.plainGrade !== undefined ? ` Ohne Elite-Attacke nur „${Power.GRADES[x.plainGrade].label}“.` : '',
      ]));
    }
    if (r.mega) {
      const m = Power.pokemon(r.mega.key);
      const mr = m.rating.raid?.[0];
      items.push(li(r.mega.grade, [
        'Als ', el('a', { href: `#pokemon=${m.key}`, data: { pokemon: m.key }, text: m.name }),
        mr ? `: Platz ${mr.rank} von ${mr.of} ${data.types[mr.type]}-Megas in Raids.` : '.',
        ' Wer die normale Form hochlevelt, levelt die Mega mit.',
      ]));
    }
    for (const l of data.rules.leagues) {
      const x = r[l.id];
      if (x) items.push(li(x.grade, [`${l.name}: Platz ${formatNumber(x.rank)} von ${formatNumber(x.of)} (PvPoke-Wertung ${formatNumber(x.score, 1)}).`]));
    }
    if (r.max) items.push(li(r.max.grade, [`Max-Kämpfe (nur als ${r.max.kinds.map((k) => (k === 'gigantamax' ? 'Gigadynamax' : 'Dynamax')).join(' oder ')}): ${maxText(r.max)}`]));
    if (!items.length) items.push(li(0, ['Kein Einsatz, in dem es weit vorne steht.']));
    return el('ul', { class: 'findings', id: 'findings' }, items);
  }

  function maxText(m) {
    const best = m.attack[0];
    const parts = [];
    if (best) parts.push(`Platz ${best.rank} von ${best.of} ${data.types[best.type]}-Angreifern`);
    parts.push(`Platz ${m.tankRank} von ${m.tankOf} bei der Ausdauer (Tank)`);
    return `${parts.join(', ')}.`;
  }

  // Wie gut passen die eingegebenen IVs – je Einsatz. quality: 2 sehr gut, 1 brauchbar, 0 schwach.
  // adjusted: die Stufe des Einsatzes mit diesen IVs (in den Ligen zählen IVs viel, in Raids wenig).
  function raidQuality(pokemon, type, megaLevel = null) {
    const stats = (iv) => PowerCalc.pveStats(data, pokemon, { level: 40, iv, buddy: state.buddy, megaLevel });
    const opts = { elite: true, megaLevel };
    const mine = PowerCalc.bestPve(data, pokemon, stats(state.iv), type, opts);
    const full = PowerCalc.bestPve(data, pokemon, stats(FULL), type, opts);
    if (!mine || !full) return null;
    const ratio = mine.score / full.score;
    return { ratio, quality: ratio >= 0.98 ? 2 : ratio >= 0.94 ? 1 : 0 };
  }

  function assessIvs() {
    const owner = ownerOf();
    const rows = [];
    const raid = p.rating.raid?.[0];
    if (raid) {
      const q = raidQuality(p, raid.type, isMega() ? state.megaLevel : null);
      if (q) {
        rows.push({
          id: 'raid', label: 'Raids', grade: raid.grade, adjusted: Math.max(0, raid.grade - (q.quality ? 0 : 1)), quality: q.quality,
          value: `${formatPercent(q.ratio, 1)} der Raid-Wertung von 15/15/15 (${data.types[raid.type]})`,
        });
      }
    }
    if (p.rating.mega) {
      const mega = Power.pokemon(p.rating.mega.key);
      const mr = mega.rating.raid?.[0];
      const q = mr ? raidQuality(mega, mr.type, mega.megaLevels) : null;
      if (q) {
        rows.push({
          id: 'mega', label: `Als ${mega.name}`, grade: p.rating.mega.grade, adjusted: Math.max(0, p.rating.mega.grade - (q.quality ? 0 : 1)), quality: q.quality,
          value: `${formatPercent(q.ratio, 1)} der Raid-Wertung von 15/15/15`,
        });
      }
    }
    for (const l of data.rules.leagues) {
      if (!p.rating[l.id] || isMega()) continue;
      const rank = PowerCalc.ivRank(data, owner, state.iv, l.cap ?? Infinity, maxLevel());
      if (!rank) continue;
      const quality = rank.percent >= 0.98 ? 2 : rank.percent >= 0.95 ? 1 : 0;
      const grade = p.rating[l.id].grade;
      rows.push({
        id: l.id, label: l.name, grade, adjusted: Math.max(0, grade - (2 - quality)), quality,
        value: `IV-Rang ${formatNumber(rank.rank)} von ${formatNumber(rank.of)} (${formatPercent(rank.percent, 1)} des besten Stat-Produkts)`,
      });
    }
    return rows;
  }

  // Urteil mit den eingegebenen IVs – steht direkt unter den Eingabefeldern und ändert sich mit ihnen.
  function myVerdict() {
    const rows = assessIvs();
    const counted = rows.filter((r) => r.grade > 0);
    if (!counted.length) {
      return el('p', { class: 'my-verdict', id: 'my-verdict' }, [
        el('span', { class: 'my-verdict__label', text: 'Mit deinen IVs:' }), Power.verdictBadge(p),
        el('span', { class: 'my-verdict__text', text: p.rating.evolve ? 'Erst entwickeln – die IVs bleiben dabei gleich.' : 'Die IVs ändern daran nichts.' }),
      ]);
    }
    const best = Math.max(...counted.map((r) => r.adjusted));
    const strong = counted.filter((r) => r.adjusted === best && best > 0).map((r) => r.label);
    const weak = counted.filter((r) => r.grade >= 2 && r.adjusted < r.grade).map((r) => r.label);
    const parts = [];
    if (strong.length) parts.push(`am besten für ${strong.join(', ')}.`);
    if (weak.length) parts.push(`Für ${weak.join(', ')} passen diese IVs schlecht – dort lohnt sich ein besseres Exemplar.`);
    if (!strong.length && !weak.length) parts.push('Mit diesen IVs in keinem Einsatz vorne.');
    return el('p', { class: 'my-verdict', id: 'my-verdict', data: { grade: String(best) } }, [
      el('span', { class: 'my-verdict__label', text: 'Mit deinen IVs:' }), Power.gradeBadge(best),
      el('span', { class: 'my-verdict__text', text: parts.join(' ') }),
    ]);
  }

  function ivVerdict() {
    const rows = assessIvs();
    if (!rows.length) return null;
    const words = ['schwach', 'brauchbar', 'sehr gut'];
    return el('section', { class: 'iv-verdict', 'aria-labelledby': 'iv-verdict-title' }, [
      el('h4', { id: 'iv-verdict-title', text: `Deine IVs (${state.iv.atk}/${state.iv.def}/${state.iv.sta})` }),
      el('ul', { class: 'iv-verdict__list', id: 'iv-verdict' }, rows.map((r) => el('li', { class: `iv-verdict__row iv-verdict__row--${r.quality}`, data: { use: r.id } }, [
        el('strong', { text: r.label }), el('span', { text: r.value }), el('em', { text: words[r.quality] }),
      ]))),
    ]);
  }

  const pveOpts = () => ({ elite: true, megaLevel: isMega() ? state.megaLevel : null });
  const pveStats = (level, iv) => PowerCalc.pveStats(data, p, { level, iv, buddy: state.buddy, megaLevel: isMega() ? state.megaLevel : null });

  function raidCard() {
    const list = p.rating.raid ?? [];
    if (!list.length) {
      return card('Raids & Arenen', [line([p.charged.length + p.eliteCharged.length ? 'Seine Lade-Attacken taugen gegen keinen Raid-Boss.' : 'Keine Lade-Attacke – als Angreifer ungeeignet.'])], { id: 'raid-card' });
    }
    const rows = list.map((x) => {
      const numbers = raidLevels().map((level) => {
        const mine = PowerCalc.bestPve(data, p, pveStats(level, state.iv), x.type, pveOpts());
        return el('span', { class: 'raid-row__level' }, [
          `Level ${level}${state.buddy ? `+${data.rules.buddyBoostLevels}` : ''}: `,
          mine ? el('strong', { text: `${formatNumber(mine.dps, 1)} DPS` }) : '–',
          mine ? ` · ${formatNumber(mine.tdo)} TDO` : '',
        ]);
      });
      return el('li', { class: 'raid-row', data: { type: x.type } }, [
        el('div', { class: 'raid-row__head' }, [
          Power.typeChip(x.type, true),
          Power.gradeBadge(x.grade),
          el('a', { class: 'rank-link', href: `#rangliste=raid-${x.type.toLowerCase()}${isMega() ? '-mega' : ''}`, text: `Platz ${x.rank} von ${x.of}` }),
        ]),
        movesLine([x.fast, x.charged]),
        el('p', { class: 'raid-row__numbers' }, numbers),
      ]);
    });
    const shadowNote = p.shadow ? ' Crypto-Bonus (+20 % Angriff, −17 % Verteidigung) ist eingerechnet.' : '';
    return card('Raids & Arenen', [
      el('ul', { class: 'raid-rows', id: 'raid-rows' }, rows),
      line([`DPS und TDO gegen einen 5-Sterne-Boss, der schwach gegen den Typ ist – mit deinen IVs.${shadowNote} Platz: Rangliste auf Level 40 mit 15/15/15${isMega() ? ', Mega auf dem höchsten Mega-Level' : ''}; ein Tipp darauf zeigt die ganze Rangliste.`]),
      isMega() ? line([`Die Mega-Entwicklung verstärkt zusätzlich die Attacken aller anderen im Raid (+${Math.round((data.rules.megaLevels[0].otherTypeBoost - 1) * 100)} %, Attacken ihres Typs +${Math.round((data.rules.megaLevels[0].sameTypeBoost - 1) * 100)} %) – ihre eigenen nicht.`]) : null,
    ], { id: 'raid-card' });
  }

  function leagueCard() {
    const owner = ownerOf();
    if (isMega()) return card('Kampfliga', [line(['Mega-Entwicklungen sind in der Superliga, Hyperliga und Meisterliga nicht erlaubt (nur in besonderen Cups). Für die Ligen zählt die normale Form.'])], { id: 'league-card' });
    const max50 = PowerCalc.maxCp(data, owner, data.rules.maxLevel);
    const rows = data.rules.leagues.map((l) => {
      const x = p.rating[l.id];
      const cap = l.cap ?? Infinity;
      const rank = PowerCalc.ivRank(data, owner, state.iv, cap, maxLevel());
      const cost = rank ? costTo(rank.level) : null;
      const tooWeak = l.cap && max50 < l.cap * 0.93;
      return el('div', { class: 'league', id: `league-${l.id}` }, [
        el('div', { class: 'league__head' }, [
          el('h4', { text: `${l.name}${l.cap ? ` (bis ${formatNumber(l.cap)} WP)` : ''}` }),
          x ? Power.gradeBadge(x.grade) : el('span', { class: 'verdict verdict--no verdict--small', text: 'Nicht gelistet' }),
        ]),
        x ? el('p', { class: 'league__rank' }, [
          el('a', { class: 'rank-link', href: `#rangliste=${l.id}`, text: `Platz ${formatNumber(x.rank)} von ${formatNumber(x.of)}` }),
          ` · Wertung ${formatNumber(x.score, 1)}`,
        ]) : el('p', { class: 'league__rank', text: 'Steht nicht in der Rangliste von PvPoke.' }),
        x?.moves.length ? movesLine(x.moves) : null,
        rank ? el('dl', { class: 'facts facts--league' }, [
          fact('Level', `${formatLevel(rank.level)}${state.buddy && rank.level > data.rules.maxLevel ? ' (Kumpel)' : ''}`),
          fact('WP', formatNumber(rank.cp)),
          fact('IV-Rang', `${formatNumber(rank.rank)} / ${formatNumber(rank.of)}`),
          fact('Stat-Produkt', formatPercent(rank.percent, 1)),
        ]) : null,
        rank && l.cap ? line([
          `Beste IVs: ${rank.best.iv.atk}/${rank.best.iv.def}/${rank.best.iv.sta} (Level ${formatLevel(rank.best.level)}, ${formatNumber(rank.best.cp)} WP). `,
          cost ? `Von Level ${formatLevel(state.level)} bis Level ${formatLevel(rank.level)}: ${costText(cost)}.`
            : rank.level === state.level ? `Level ${formatLevel(state.level)} ist genau richtig – nicht weiter leveln!`
              : `Auf Level ${formatLevel(state.level)} liegt es schon über ${formatNumber(l.cap)} WP – zu hoch für diese Liga (Power-ups lassen sich nicht zurücknehmen).`,
        ]) : null,
        tooWeak ? line([`Erreicht selbst auf Level ${data.rules.maxLevel} nur ${formatNumber(max50)} WP – zu schwach für die Grenze.`], 'info-card__line--warn') : null,
        !l.cap && rank ? line([cost ? `Bis Level ${formatLevel(rank.level)}: ${costText(cost)}.` : 'Schon auf dem höchsten Level.']) : null,
      ]);
    });
    return card('Kampfliga', [
      ...rows,
      line(['Platz und Attacken: Gesamt-Rangliste von PvPoke. IV-Rang: alle 4096 IV-Kombinationen nach Stat-Produkt (Angriff × Verteidigung × KP) unter der WP-Grenze – in der Super- und Hyperliga gewinnen oft niedrige Angriffs-IVs.']),
      p.shadow ? line(['Crypto-Pokémon machen auch im Trainerkampf 20 % mehr Schaden und nehmen 20 % mehr.']) : null,
    ], { id: 'league-card' });
  }

  const fact = (label, value) => el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]);

  function maxCard() {
    const m = p.rating.max;
    if (!m) return null;
    const dyna = data.sources.dyna.url;
    return card('Max-Kämpfe', [
      line([`Gilt nur für ${m.kinds.map((k) => (k === 'gigantamax' ? 'Gigadynamax' : 'Dynamax')).join('- und ')}-Exemplare aus Max-Kämpfen – ein normales ${p.name} kann nicht dynamaximieren.`]),
      el('ul', { class: 'plain-list' }, [
        ...m.attack.map((a) => el('li', {}, [Power.typeChip(a.type, true), ` Angreifer: Platz ${a.rank} von ${a.of} `, Power.gradeBadge(a.grade)])),
        el('li', {}, [`Tank (Ausdauer): Platz ${m.tankRank} von ${m.tankOf}`]),
        m.move ? el('li', {}, [`Gigadynamax-Attacke: ${m.move}`]) : null,
      ]),
      line(['Alle Teams und Konter für Max-Kämpfe: ', el('a', { href: dyna, text: 'Dyna-Kompass' }), '.']),
    ], { id: 'max-card' });
  }

  function megaCard() {
    const owner = ownerOf();
    if (!isMega()) {
      if (!owner.megas?.length) return null;
      return card('Mega-Entwicklung', [
        line([`${p.name} kann ${owner.megas.length > 1 ? 'mehrere Mega-Formen' : 'eine Mega-Form'} annehmen: `,
          ...owner.megas.flatMap((k, i) => [i ? ', ' : '', el('a', { href: `#pokemon=${k}`, data: { pokemon: k }, text: Power.pokemon(k).name })]), '.']),
        line(['Für den Bonbon-Bonus der Mega musst du nichts hochleveln – nur für den eigenen Schaden zählt das Level.']),
      ], { id: 'mega-card' });
    }
    const levels = data.rules.megaLevels.slice(0, p.megaLevels);
    const plus = p.plusMove ? Power.move(p.plusMove) : null;
    const primal = p.variant === 'primal';
    return card(primal ? 'Protomorphose' : 'Mega-Entwicklung', [
      line([
        `Aktiv ${data.rules.megaDurationH} Stunden. Im Raid verstärkt sie die Attacken aller anderen Trainer um ${Math.round((levels[0].otherTypeBoost - 1) * 100)} %, `,
        `Attacken vom Typ ${(p.boostTypes ?? p.types).map((t) => data.types[t]).join(', ')} um ${Math.round((levels[0].sameTypeBoost - 1) * 100)} %. `,
        `Beim Fangen von Pokémon dieser Typen gibt es Extra-Bonbons und -EP (siehe Tabelle).`,
      ]),
      el('div', { class: 'table-wrap' }, [el('table', { class: 'data-table mega-table', id: 'mega-table' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', { scope: 'col', text: primal ? 'Proto-Level' : 'Mega-Level' }), el('th', { scope: 'col', text: 'Nötig' }), el('th', { scope: 'col', text: 'Ruhezeit' }),
          el('th', { scope: 'col', text: 'Bonbons' }), el('th', { scope: 'col', text: 'XL-Chance' }), el('th', { scope: 'col', text: 'EP' }),
          el('th', { scope: 'col', text: 'Eigene WP' }), plus ? el('th', { scope: 'col', text: plus.name }) : null,
        ])]),
        el('tbody', {}, levels.map((l) => el('tr', { class: l.level === state.megaLevel ? 'is-current' : null }, [
          el('th', { scope: 'row', text: l.name }),
          el('td', { text: l.level === 4 ? `${l.megaEvolutions}× + ${formatNumber(p.megaEnergy.unlockSuperMax ?? 5000)} Energie` : `${l.megaEvolutions}× entwickelt` }),
          el('td', { text: `${formatNumber(l.cooldownDays)} ${l.cooldownDays === 1 ? 'Tag' : 'Tage'}` }),
          el('td', { text: `+${l.candy}` }),
          el('td', { text: l.xlChance ? `+${formatPercent(l.xlChance)}` : '–' }),
          el('td', { text: l.xp ? `+${l.xp}` : '–' }),
          el('td', { text: l.selfCpBoost ? `+${l.selfCpBoost} Level` : '–' }),
          plus ? el('td', { text: `${formatNumber(plus.power * data.rules.plusMoveFactor[l.level - 1])}` }) : null,
        ]))),
      ])]),
      p.megaEnergy.first ? line([`Erste ${primal ? 'Protomorphose' : 'Mega-Entwicklung'}: ${formatNumber(p.megaEnergy.first)} ${primal ? 'Proto' : 'Mega'}-Energie. Danach kostet sie in der Ruhezeit Energie (je kürzer die Ruhezeit, desto weniger).`]) : null,
      plus ? line([`Zusatz-Lade-Attacke ${plus.name} (${data.types[plus.type]}): nur als Mega, in Raids ${formatNumber(plus.power)} Stärke auf Basis-Level, bis ×${formatNumber(data.rules.plusMoveFactor[p.megaLevels - 1], 1)} auf dem höchsten Mega-Level. Gilt in Raids und Trainerkämpfen, nicht beim Verteidigen von Arenen.`]) : null,
      p.megaLevels === 4 ? line([`Super-Max-Level: Die Mega selbst kämpft wie ${data.rules.megaLevels[3].selfCpBoost} Level höher (Level 50 → 52).`], 'info-card__line--highlight') : null,
      line([`Tipp: Für Bonbons, XL-Chance und EP zählt nur das ${primal ? 'Proto' : 'Mega'}-Level – dafür musst du ${p.name} nicht hochleveln.`]),
    ], { id: 'mega-card' });
  }

  function specialCard() {
    const owner = ownerOf();
    const items = [];
    if (p.note) items.push(el('li', { text: p.note }));
    for (const f of owner.formChanges ?? []) {
      const t = Power.pokemon(f.key);
      if (f.unfuse) {
        items.push(el('li', {}, ['Kann wieder in ', el('a', { href: `#pokemon=${t.key}`, data: { pokemon: t.key }, text: t.name }), ' und seinen Partner getrennt werden.']));
        continue;
      }
      const cost = [];
      if (f.stardust) cost.push(`${formatNumber(f.stardust)} Sternenstaub`);
      if (f.candy) cost.push(`${f.candy} Bonbons`);
      if (f.item) cost.push(`${formatNumber(f.itemCount ?? 1)}× ${f.item}`);
      if (f.partner) cost.push(`dazu ${Power.pokemon(f.partner).name} (${f.partnerCandy} seiner Bonbons)`);
      items.push(el('li', {}, [
        f.partner ? 'Fusion zu ' : 'Formwechsel zu ', el('a', { href: `#pokemon=${t.key}`, data: { pokemon: t.key }, text: t.name }),
        ` (Bewertung: ${Power.GRADES[t.rating.grade].label})`,
        cost.length ? `: ${cost.join(', ')}` : '',
        f.requires.length ? `. Braucht die Attacke ${f.requires.map(moveName).join(' oder ')}` : '',
        f.replaces.length ? `. ${f.replaces.map((r) => (r.from ? `${moveName(r.from)} wird zu ${moveName(r.to)}` : `Lernt ${moveName(r.to)}`)).join(', ')}` : '',
        f.maxBattle ? ' (auch über die Max-Attacke im Max-Kampf)' : '',
        '.',
      ]));
    }
    if (p.shadow && p.purification) {
      items.push(el('li', {}, [`Erlösen kostet ${formatNumber(p.purification.stardust)} Sternenstaub und ${p.purification.candy} Bonbons: Das Pokémon wird mindestens Level 25 und jeder IV-Wert steigt um 2 (höchstens 15). `,
        p.rating.grade > (Power.pokemon(p.normalKey)?.rating.grade ?? 0) ? 'Als Crypto ist es aber stärker – lieber nicht erlösen.' : 'Danach sind Power-ups 10 % günstiger statt 20 % teurer.',
        p.purifiedMove ? ` Erlöst lernt es ${moveName(p.purifiedMove)}.` : '']));
    }
    if (p.requiredMove) items.push(el('li', { text: `Nur ${owner.name} mit der Attacke ${moveName(p.requiredMove)} kann sich in ${p.name} verwandeln – die Mega kennt sie deshalb immer.` }));
    if (!isMega() && (owner.megas ?? []).some((k) => Power.pokemon(k).requiredMove)) {
      const m = Power.pokemon(owner.megas.find((k) => Power.pokemon(k).requiredMove));
      items.push(el('li', { text: `Für die Mega-Entwicklung braucht ${p.name} die Attacke ${moveName(m.requiredMove)} (nur bei Events oder per Elite-TM).` }));
    }
    if (owner.thirdMove && owner.thirdMove.candy < 10000 && owner.charged.length + owner.eliteCharged.length > 1) items.push(el('li', { text: `Zweite Lade-Attacke: ${formatNumber(owner.thirdMove.stardust)} Sternenstaub und ${owner.thirdMove.candy} Bonbons${p.shadow ? ' (Crypto: 20 % mehr)' : ''} – lohnt sich vor allem für die Kampfliga.` }));
    if (owner.buddyKm) items.push(el('li', { text: `Als Kumpel: 1 Bonbon alle ${formatNumber(owner.buddyKm)} km.` }));
    if (owner.upgradeOverride) items.push(el('li', { text: `${owner.name} braucht für Power-ups deutlich mehr Bonbons als andere Pokémon (siehe „Werte & Kosten“).` }));
    if (!owner.tradable) items.push(el('li', { text: 'Nicht tauschbar – deshalb gibt es kein Glücks-Pokémon und keinen Tausch-Rabatt.' }));
    if (!items.length) return null;
    return card('Besonderheiten', [el('ul', { class: 'plain-list', id: 'specials' }, items)], { id: 'special-card' });
  }

  function ratingPanel() {
    return [
      findings(),
      ivVerdict(),
      el('div', { class: 'info-grid' }, [raidCard(), leagueCard(), megaCard(), maxCard(), specialCard()].filter(Boolean)),
    ];
  }

  // ---------- Reiter "Werte & Kosten" ----------

  function levelRows() {
    const step = state.halfLevels ? 0.5 : 1;
    const levels = [];
    for (let l = 1; l <= data.rules.maxLevel + 1e-9; l += step) levels.push(l);
    return levels;
  }

  function statsPanel() {
    const owner = ownerOf();
    const boost = PowerCalc.levelBoost(data, { buddy: state.buddy, megaBoost: megaBoost() });
    const opts = costOptions();
    const summary = [40, 50].filter((l) => l > state.level).map((l) => {
      const c = PowerCalc.powerUpCost(data, owner, state.level, l, opts);
      return el('li', {}, [el('strong', { text: `Level ${formatLevel(state.level)} → ${l}: ` }), costText(c)]);
    });
    const rows = levelRows().map((level) => {
      const s = PowerCalc.statsAt(data, p, level + boost, state.iv, { battle: false });
      const cost = level > state.level ? PowerCalc.powerUpCost(data, owner, state.level, level, opts) : null;
      const milestone = MILESTONES[level];
      return el('tr', { class: `${level === state.level ? 'is-current' : ''}${milestone ? ' is-milestone' : ''}`.trim() || null, data: { level: String(level) } }, [
        el('th', { scope: 'row' }, [formatLevel(level), boost ? el('small', { text: ` (→ ${formatLevel(level + boost)})` }) : null, milestone ? el('small', { class: 'milestone', text: milestone }) : null]),
        el('td', {}, [el('strong', { text: formatNumber(s.cp) })]),
        el('td', { text: formatNumber(s.atk, 1) }),
        el('td', { text: formatNumber(s.def, 1) }),
        el('td', { text: formatNumber(s.hp) }),
        el('td', { text: cost ? formatNumber(cost.stardust) : level === state.level ? 'jetzt' : '–' }),
        el('td', { text: cost ? formatNumber(cost.candy) : '–' }),
        el('td', { text: cost?.xl ? formatNumber(cost.xl) : '–' }),
      ]);
    });
    const notes = [];
    if (boost) notes.push(`Werte mit +${boost} Level (${state.buddy && megaBoost() <= data.rules.buddyBoostLevels ? 'Bester Kumpel' : 'Super-Max-Level'}); die Kosten gelten für das echte Level.`);
    if (isMega()) notes.push(`Werte der Mega-Form; Power-ups gelten für ${owner.name}.`);
    if (p.shadow) notes.push(`Im Kampf zusätzlich ×${formatNumber(data.rules.shadowAttack, 1)} Angriff und ×${formatNumber(data.rules.shadowDefense, 2)} Verteidigung (Crypto). Power-ups kosten 20 % mehr.`);
    if (opts.purified) notes.push('Erlöst: Power-ups 10 % günstiger.');
    if (opts.lucky) notes.push('Glücks-Pokémon: halber Sternenstaub.');
    return [
      el('section', { class: 'cost-summary', 'aria-labelledby': 'cost-title' }, [
        el('h3', { class: 'section-title section-title--small', id: 'cost-title', text: 'Was kostet das Hochleveln?' }),
        summary.length ? el('ul', { class: 'cost-summary__list', id: 'cost-summary' }, summary) : el('p', { id: 'cost-summary', text: 'Schon auf dem höchsten Level.' }),
        ...notes.map((n) => el('p', { class: 'info-card__line', text: n })),
      ]),
      el('div', { class: 'stats-head' }, [
        el('h3', { class: 'section-title section-title--small', id: 'stats-title', text: 'Werte auf jedem Level' }),
        toggleHalf(),
      ]),
      el('div', { class: 'table-wrap table-wrap--tall' }, [el('table', { class: 'data-table level-table', id: 'level-table', 'aria-labelledby': 'stats-title' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', { scope: 'col', text: 'Level' }), el('th', { scope: 'col', text: 'WP' }), el('th', { scope: 'col', text: 'Angriff' }),
          el('th', { scope: 'col', text: 'Vert.' }), el('th', { scope: 'col', text: 'KP' }),
          el('th', { scope: 'col', text: 'Sternenstaub' }), el('th', { scope: 'col', text: 'Bonbons' }), el('th', { scope: 'col', text: 'XL' }),
        ])]),
        el('tbody', {}, rows),
      ])]),
      el('p', { class: 'info-card__line', text: `Kosten jeweils ab Level ${formatLevel(state.level)} (aufsummiert). Ab Level 40 kosten Power-ups Bonbons XL statt Bonbons. Mit IVs ${state.iv.atk}/${state.iv.def}/${state.iv.sta}.` }),
    ];
  }

  function toggleHalf() {
    return el('label', { class: 'toggle' }, [
      el('input', {
        type: 'checkbox', id: 'opt-half', checked: state.halfLevels, autocomplete: 'off',
        onchange: (e) => { state.halfLevels = e.target.checked; renderPanel(); container.querySelector('#opt-half')?.focus({ preventScroll: true }); },
      }),
      el('span', { class: 'toggle__track', 'aria-hidden': 'true' }),
      el('span', { class: 'toggle__text', text: 'Halbe Level' }),
    ]);
  }

  // ---------- Reiter "Attacken" ----------

  function movesPanel() {
    const fast = [...p.fast, ...p.eliteFast];
    const charged = [...p.charged, ...p.eliteCharged, ...(p.plusMove ? [p.plusMove] : [])];
    const plusFactor = isMega() ? data.rules.plusMoveFactor[(state.megaLevel ?? 1) - 1] : 1;
    const num = (n, d = 0) => (n === null || n === undefined ? '–' : formatNumber(n, d));
    const fastRows = fast.map((id) => {
      const m = Power.move(id);
      return el('tr', {}, [
        el('th', { scope: 'row' }, [moveChip(id)]),
        el('td', { text: num(m.power) }), el('td', { text: num(m.durationS, 1) }), el('td', { text: num(m.energy) }),
        el('td', { text: num(m.power / m.durationS, 1) }), el('td', { text: num(m.energy / m.durationS, 1) }),
        el('td', { text: num(m.pvp?.power) }), el('td', { text: num(m.pvp?.energy) }), el('td', { text: num(m.pvp?.turns) }),
      ]);
    });
    const chargedRows = charged.map((id) => {
      const m = Power.move(id);
      const power = m.plus ? m.power * plusFactor : m.power;
      return el('tr', {}, [
        el('th', { scope: 'row' }, [moveChip(id)]),
        el('td', { text: num(power) }), el('td', { text: num(m.durationS, 1) }), el('td', { text: num(-m.energy) }),
        el('td', { text: num(power / m.durationS, 1) }), el('td', { text: m.energy ? num(power / -m.energy, 2) : '–' }),
        el('td', { text: num(m.pvp?.power) }), el('td', { text: m.pvp ? num(-m.pvp.energy) : '–' }),
        el('td', { text: m.pvp?.buffs ?? '–' }),
      ]);
    });
    const table = (id, caption, head, rows) => el('div', { class: 'table-wrap' }, [el('table', { class: 'data-table move-table', id }, [
      el('caption', { text: caption }),
      el('thead', {}, [
        el('tr', {}, [el('th', { scope: 'col', rowspan: '2', text: 'Attacke' }), el('th', { scope: 'colgroup', colspan: '5', text: 'Raids & Arenen' }), el('th', { scope: 'colgroup', colspan: '3', text: 'Kampfliga' })]),
        el('tr', {}, head.map((h) => el('th', { scope: 'col', text: h }))),
      ]),
      el('tbody', {}, rows),
    ])]);
    return [
      table('fast-table', 'Sofort-Attacken', ['Stärke', 'Dauer s', 'Energie', 'DPS', 'EPS', 'Stärke', 'Energie', 'Runden'], fastRows),
      table('charged-table', 'Lade-Attacken', ['Stärke', 'Dauer s', 'Kosten', 'DPS', 'DPE', 'Stärke', 'Kosten', 'Effekt'], chargedRows),
      el('p', { class: 'info-card__line', text: 'Ohne STAB und Wetter. Elite-TM: nur mit Elite-TM, an Community Days oder bei Events. Kraftreserve hat einen zufälligen Typ und fehlt in den Ranglisten.' }),
      p.purifiedMove ? el('p', { class: 'info-card__line', text: `Erlöst lernt es ${moveName(p.purifiedMove)} (statt der Crypto-Attacke).` }) : null,
    ];
  }

  // ---------- Reiter ----------

  function tabs() {
    return el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Ansicht' }, TABS.map((t) => el('button', {
      type: 'button', role: 'tab', id: `tab-${t.id}`, class: 'tabs__btn',
      'aria-selected': String(t.id === state.tab), 'aria-controls': 'tab-panel', tabindex: t.id === state.tab ? '0' : '-1',
      onclick: () => selectTab(t.id), onkeydown: onTabKey,
    }, [t.label])));
  }

  function selectTab(id) {
    state.tab = id;
    for (const btn of container.querySelectorAll('.tabs__btn')) {
      const active = btn.id === `tab-${id}`;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    }
    container.querySelector('#tab-panel').setAttribute('aria-labelledby', `tab-${id}`);
    renderPanel();
    container.querySelector(`#tab-${id}`).focus();
  }

  function onTabKey(e) {
    const i = TABS.findIndex((t) => t.id === state.tab);
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: TABS.length - 1 - i };
    if (!(e.key in moves)) return;
    e.preventDefault();
    selectTab(TABS[(i + moves[e.key] + TABS.length) % TABS.length].id);
  }

  function renderPanel() {
    const scrollY = window.scrollY;
    const content = { bewertung: ratingPanel, werte: statsPanel, attacken: movesPanel }[state.tab]();
    container.querySelector('#tab-panel').replaceChildren(...content.filter(Boolean));
    window.scrollTo(0, scrollY);
  }

  function render(key, target, { backLabel = '← Alle Pokémon' } = {}) {
    const next = Power.pokemon(key);
    // IVs und Level bleiben innerhalb einer Familie (Entwicklung, Mega, Crypto) – wie im Spiel beim Entwickeln.
    if (!p || next.family !== state.family) {
      Object.assign(state, { iv: { ...FULL }, level: START_LEVEL, lucky: false, purified: false, buddy: false, cpText: '' });
    }
    if (p?.key !== key) state.tab = 'bewertung';
    p = next;
    state.family = p.family;
    state.megaLevel = isMega() ? p.megaLevels : null;
    if (!canBePurified()) state.purified = false;
    container = target;
    target.replaceChildren(
      el('a', { class: 'back-link', href: '#', id: 'back' }, [backLabel]),
      header(),
      controls(),
      tabs(),
      el('div', { id: 'tab-panel', class: 'tab-panel', role: 'tabpanel', 'aria-labelledby': `tab-${state.tab}` }),
    );
    renderPanel();
  }

  return { render, current: () => p };
})();
