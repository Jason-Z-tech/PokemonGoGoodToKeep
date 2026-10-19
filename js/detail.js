'use strict';

// Pokémon-Seite: oben das Urteil und "Dein Pokémon" (IVs, Level, Glück, Erlöst, Bester Kumpel, Mega-Level),
// darunter drei Reiter – "Bewertung" (Raids & Arenen, Mega/Proto, Besonderheiten), "Werte & Kosten" (alle Level mit
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
    15: 'Feldforschung', 20: 'Raid- und Ei-Fang', 25: 'Raid-Fang mit Wetterboost', 30: 'höchster Wildfang (ohne Wetter)',
    35: 'höchster Wildfang mit Wetter', 40: 'Ende Bonbons – ab hier Bonbons XL', 50: 'höchstes Level',
  };

  const state = {
    iv: { ...FULL }, level: START_LEVEL, lucky: false, purified: false, buddy: false, shiny: false, megaLevel: null,
    tab: 'bewertung', halfLevels: false, family: null, cpText: '',
  };
  let p = null;
  let container = null;

  const raidLevels = () => [40, 50];
  const isMega = () => p.variant !== 'normal';
  const megaBoost = () => (isMega() ? data.rules.megaLevels[(state.megaLevel ?? 1) - 1].selfCpBoost : 0);
  const costOptions = () => ({ lucky: state.lucky && canBeLucky(), purified: state.purified && canBePurified() });
  const ownerOf = () => (isMega() ? Power.pokemon(p.parent) : p); // Power-up gilt immer für die normale Form
  // Glück und Erlösen hängen an der normalen Form – auch auf der Seite ihrer Mega.
  const canBeLucky = () => { const o = ownerOf(); return o.tradable && !o.shadow; };
  const canBePurified = () => { const o = ownerOf(); return !o.shadow && Boolean(o.shadowKey); };
  const isPrimalOnly = (owner) => (owner.megas ?? []).length > 0 && owner.megas.every((k) => Power.pokemon(k).variant === 'primal');

  // ---------- kleine Bausteine ----------

  const moveName = (id) => Power.move(id)?.name ?? id;
  const candyText = (n) => `${formatNumber(n)} ${n === 1 ? 'Bonbon' : 'Bonbons'}`;
  const joinList = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} und ${list.at(-1)}` : list[0] ?? '');

  // Attacken, die es nur mit einem Event-Item gibt (nicht per Top-TM).
  const ITEM_MOVES = { DRAGON_ASCENT: { item: 'Meteorit', how: 'mit einem Meteoriten' } };
  const itemMove = (pokemon, id) => ((pokemon.specialMoves ?? []).includes(id) ? ITEM_MOVES[id] ?? { item: 'Event-Item', how: 'mit einem Event-Item' } : null);

  function moveChip(id, { pokemon = p, small = true } = {}) {
    const m = Power.move(id);
    if (!m) return null;
    const item = itemMove(pokemon, id);
    const elite = !item && (pokemon.eliteFast.includes(id) || pokemon.eliteCharged.includes(id));
    return el('span', { class: 'move' }, [
      el('span', { class: 'move__name', text: m.name }),
      Power.typeChip(m.type, small),
      elite ? Power.eliteBadge() : null,
      item ? Power.eliteBadge(item.item, `Nur ${item.how} erlernbar (gibt es bei Events), nicht per Top-TM`) : null,
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
    if (cost.candy) parts.push(candyText(cost.candy));
    if (cost.xl) parts.push(`${formatNumber(cost.xl)} Bonbons XL`);
    return parts.join(', ');
  }

  // ---------- Kopf ----------

  function header() {
    const v = Power.verdictOf(p);
    const owner = ownerOf();
    return el('section', { class: `poke-head poke-head--${v.id}`, 'aria-labelledby': 'detail-title' }, [
      headerArt(),
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

  // Bild oben – als Shiny, wenn eingeschaltet (nur das Aussehen, die Werte bleiben gleich).
  const headerArt = () => Power.pokemonArt(p, { size: 'lg', eager: true, shiny: state.shiny });

  // Ein Satz zum Urteil: wofür das Pokémon taugt.
  function summaryText(v) {
    const r = p.rating;
    if (v.id === 'evolve') {
      const t = v.target;
      return `${p.name} selbst taugt wenig – entwickle es zuerst zu ${t.name} (Bewertung: ${Power.GRADES[Power.gradeOf(t)].label}). Power-ups vor der Entwicklung bleiben erhalten, aber das Hochleveln lohnt sich erst danach.`;
    }
    // Jeder Einsatz mit seiner eigenen Stufe: "Spitze in Raids …", "Als Mega-… stark in Raids."
    const LEAD = ['', 'Brauchbar als Ersatz', 'Stark', 'Spitze'];
    const parts = [];
    const raids = Power.raidList(p);
    const top = Math.max(0, ...raids.map((x) => x.grade));
    const bestRaid = raids.filter((x) => x.grade === top && x.grade > 0).slice(0, 2);
    const where = isMega() ? ' unter den Megas' : Power.withCrypto(p) ? '' : ' ohne Crypto';
    if (bestRaid.length) parts.push(`${LEAD[top]} in Raids und Arenen als ${joinList(bestRaid.map((x) => `${data.types[x.type]}-Angreifer (Platz ${x.rank}${where})`))}.`);
    if (r.mega && r.mega.grade >= Math.max(1, top)) {
      parts.push(`Als ${Power.pokemon(r.mega.key).name} ${['', 'brauchbar als Ersatz', 'stark', 'Spitze'][r.mega.grade]} in Raids.`);
    }
    const hasUse = parts.length > 0;
    const tradable = ownerOf().tradable && !p.shadow;
    const weak = isMega()
      ? `Als Angreifer zu schwach – ${p.variant === 'primal' ? 'die Protomorphose' : 'die Mega-Entwicklung'} lohnt sich trotzdem für den Raid-Bonus der anderen und für Extra-Bonbons.`
      : `Als Raid-Angreifer zu schwach – nur für Sammlung${tradable ? ', Kumpel-Bonbons oder zum Tauschen' : ' oder Kumpel-Bonbons'}.`;
    const better = Power.betterOf(p);
    if (better) parts.push(`Als ${Power.pokemon(better.key).name} wäre es noch stärker (${Power.GRADES[Power.gradeOf(Power.pokemon(better.key))].label}).`);
    return [hasUse ? null : weak, ...parts].filter(Boolean).join(' ');
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
          Power.pokemonArt(q, { size: 'xs', shiny: state.shiny }),
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
          // Enter (Feld behält den Fokus): gleich neu zeichnen. Sonst erst nach dem Klick/Tab woanders hin – der
          // Vergleichen-Link bekommt das neue Level sofort.
          if (document.activeElement === e.target) { onChange('#cp'); return; }
          syncLevelFromCp();
          container.querySelector('#compare-link')?.setAttribute('href', compareHref());
          const page = p;
          Power.afterPointer(() => { if (p === page && container.isConnected && container.querySelector('#mine')) onChange(Power.focusedSelector()); });
        },
      }),
    ]);
  }

  // Eingegebene WP: das erste Level, auf dem sie mit den IVs passen – nach jeder Änderung neu gesucht.
  // Mit "Bester Kumpel" gelten die WP so, wie das Spiel sie beim aktiven besten Kumpel zeigt (+1 Level).
  const cpMatch = () => PowerCalc.matchCp(data, ownerOf().base, state.iv, Number(state.cpText), state.buddy);

  function syncLevelFromCp() {
    if (!Number(state.cpText)) return;
    const match = cpMatch();
    if (match) state.level = match.level;
  }

  function cpFeedback() {
    const cp = Number(state.cpText);
    if (!cp) return null;
    const owner = ownerOf();
    const match = cpMatch();
    if (match && match.level === state.level) {
      const how = !state.buddy
        ? ' Ist es dein aktiver bester Kumpel, zeigt das Spiel die WP schon mit Boost (1 Level höher) – dann schalte „Bester Kumpel“ ein.'
        : match.boosted
          ? ' Gelesen mit Kumpel-Boost, wie das Spiel die WP beim aktiven besten Kumpel zeigt.'
          : ' Gelesen ohne Kumpel-Boost (mit Boost passen sie zu keinem Level).';
      return el('p', { class: 'cp-feedback cp-feedback--ok', id: 'cp-feedback', text: `${formatNumber(cp)} WP passen zu Level ${formatLevel(state.level)} (mit diesen IVs).${how}` });
    }
    const megaHint = isMega() || owner.megas?.length
      ? ` (WP ${isMega() ? 'der normalen Form ' : ''}ohne ${isPrimalOnly(owner) ? 'Protomorphose' : 'Mega-Entwicklung'} eingeben)`
      : '';
    return el('p', { class: 'cp-feedback', id: 'cp-feedback', text: `${formatNumber(cp)} WP passen mit ${state.iv.atk}/${state.iv.def}/${state.iv.sta} zu keinem Level von ${owner.name} – stimmen die IVs?${megaHint}` });
  }

  function controls() {
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
        presetButton('lucky', 'Glücks-Minimum (12/12/12)', { atk: 12, def: 12, sta: 12 }, 'Glücks-Pokémon aus einem Tausch haben mindestens 12/12/12'),
        presetButton('raid', 'Raid-Minimum (10/10/10)', { atk: 10, def: 10, sta: 10 }, 'Pokémon aus Raids, Eiern und Forschung haben mindestens 10/10/10'),
      ]),
      el('div', { class: 'mine__row' }, [level, cpInput()]),
      cpFeedback(),
      el('div', { class: 'mine__toggles' }, [
        toggle('lucky', 'Glücks-Pokémon', canBeLucky() ? 'halber Sternenstaub' : `nicht möglich (${ownerOf().shadow ? 'Crypto ist ' : ''}nicht tauschbar)`, { disabled: !canBeLucky() }),
        canBePurified() ? toggle('purified', 'Erlöst', '10 % günstiger, kein Crypto-Bonus') : null,
        toggle('buddy', 'Bester Kumpel', `+${data.rules.buddyBoostLevels} Level (bis ${data.rules.maxLevel + data.rules.buddyBoostLevels})`),
        toggle('shiny', 'Shiny', p.imageShiny ? 'nur das Aussehen – Werte bleiben gleich' : 'kein Shiny-Bild', { disabled: !p.imageShiny }),
      ]),
      isMega() ? megaLevelControl() : null,
      el('a', { class: 'compare-link', id: 'compare-link', href: compareHref() }, ['⇄ Mit einem anderen Pokémon vergleichen']),
    ]);
  }

  // Vergleich mit diesem Pokémon und allen Eingaben.
  const compareHref = () => Compare.linkFor(p, {
    iv: state.iv, level: state.level, lucky: state.lucky && canBeLucky(), purified: state.purified && canBePurified(),
    buddy: state.buddy, shiny: state.shiny && Boolean(p.imageShiny), megaLevel: state.megaLevel,
  });

  function ivTotalText() {
    const pct = Power.ivPercent(state.iv);
    return [`IVs ${state.iv.atk}/${state.iv.def}/${state.iv.sta} · `, el('strong', { text: formatPercent(pct, Number.isInteger(Math.round(pct * 1000) / 10) ? 0 : 1) })];
  }

  function megaLevelControl() {
    const levels = data.rules.megaLevels.slice(0, p.megaLevels);
    return el('fieldset', { class: 'segmented', id: 'mega-level' }, [
      el('legend', { class: 'control-label', text: p.variant === 'primal' ? 'Proto-Level' : 'Mega-Level' }),
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
      syncLevelFromCp();
      container.querySelector('#mine').replaceWith(controls());
      // Bild und verwandte Formen nur neu, wenn Shiny umgeschaltet wurde (sonst springt das Bild bei jeder Eingabe).
      const art = container.querySelector('.poke-head > .art');
      if (art && art.classList.contains('art--shiny') !== (state.shiny && Boolean(p.imageShiny))) {
        art.replaceWith(headerArt());
        container.querySelector('.poke-head .related')?.replaceWith(relatedLinks(ownerOf()));
      }
      renderPanel();
      announce();
      container.querySelector(focusSelector)?.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
    } finally {
      updating = false;
    }
  }

  // Für Screenreader: das neue Urteil und die WP-Prüfung nach jeder Eingabe ansagen (das Formular wird ersetzt,
  // die Statuszeile bleibt stehen).
  function announce() {
    const text = ['#my-verdict', '#cp-feedback'].map((s) => container.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
    const live = container.querySelector('#mine-status');
    if (live && live.textContent !== text) live.textContent = text;
  }

  // ---------- Reiter "Bewertung" ----------

  function findings() {
    const r = p.rating;
    const items = [];
    const noCrypto = Power.withCrypto(p) ? '' : ' (ohne Crypto)';
    const li = (grade, children) => el('li', { class: 'finding' }, [grade === null ? Power.verdictBadge(p) : Power.gradeBadge(grade), el('span', {}, children)]);
    // Entwicklung: "Entwickle es zu …" (Vorstufe ohne eigenen Nutzen) oder "Noch stärker nach der Entwicklung zu …"
    // (nur ein Hinweis).
    const evolveItem = (target, first) => {
      const t = Power.pokemon(target.key);
      const direct = (p.evolutions ?? []).find((e) => e.key === t.key);
      return el('li', { class: 'finding' }, [
        el('span', { class: 'verdict verdict--evolve verdict--small', text: 'Entwickeln' }),
        el('span', {}, [
          first ? 'Entwickle es zu ' : 'Noch stärker nach der Entwicklung zu ', el('a', { href: `#pokemon=${t.key}`, data: { pokemon: t.key }, text: t.name }),
          direct ? evolveCost(direct) : ' (über eine Zwischenstufe)',
          ` – dort: ${Power.GRADES[Power.gradeOf(t)].long}. IVs bleiben beim Entwickeln gleich.`,
        ]),
      ]);
    };
    const evolve = Power.evolveOf(p);
    if (evolve) items.push(evolveItem(evolve, true));
    for (const x of Power.raidList(p)) {
      if (!x.grade && items.length) continue;
      // Ohne Spezial-Attacken (Top-TM, Event-Item wie Meteorit) gerechnet: plainGrade.
      const special = [x.fast, x.charged].find((id) => itemMove(p, id));
      const otherElite = [...p.eliteFast, ...p.eliteCharged].some((id) => !itemMove(p, id));
      const without = special ? `${moveName(special)}${otherElite ? ' und Top-TM-Attacken' : ''}` : 'Top-TM-Attacke';
      items.push(li(x.grade, [
        `Raids: Platz ${x.rank} von ${x.of} ${isMega() ? `${data.types[x.type]}-Megas` : `${data.types[x.type]}-Angreifern${noCrypto}`} mit ${moveName(x.fast)} + ${moveName(x.charged)}.`,
        x.plainGrade !== undefined ? ` Ohne ${without} nur „${Power.GRADES[x.plainGrade].label}“.` : '',
      ]));
    }
    if (r.mega) {
      const m = Power.pokemon(r.mega.key);
      const mr = m.rating.raid?.[0];
      items.push(li(r.mega.grade, [
        'Als ', el('a', { href: `#pokemon=${m.key}`, data: { pokemon: m.key }, text: m.name }),
        mr ? `: Platz ${mr.rank} von ${mr.of} ${data.types[mr.type]}-Megas in Raids.` : '.',
        ` Wer die normale Form hochlevelt, levelt die ${m.variant === 'primal' ? 'Proto-Form' : 'Mega'} mit.`,
      ]));
    }
    const better = Power.betterOf(p);
    if (better) items.push(evolveItem(better, false));
    if (!items.length) items.push(li(0, ['Keine Lade-Attacke – als Angreifer ungeeignet.']));
    return el('ul', { class: 'findings', id: 'findings' }, items);
  }

  // Kosten und Bedingungen einer Entwicklung. Crypto-Pokémon lassen sich nicht tauschen; erlöste Pokémon
  // brauchen teils weniger Bonbons.
  function evolveCost(e) {
    const purified = state.purified && canBePurified() && (e.candyPurified ?? e.candy) !== e.candy;
    const candy = purified ? e.candyPurified : e.candy;
    const tradable = p.tradable && !p.shadow;
    const parts = [
      candy ? `${candyText(candy)}${purified ? ' als Erlöstes' : ''}` : null,
      ...e.conditions.filter((c) => tradable || c !== 'nach einem Tausch ohne Bonbons'),
    ].filter(Boolean);
    return parts.length ? ` (${parts.join(', ')})` : '';
  }


  // Wie gut passen die eingegebenen IVs? quality: 2 sehr gut, 1 brauchbar, 0 schwach.
  // adjusted: die Stufe mit diesen IVs (in Raids zählen IVs wenig – erst unter 94 % der Wertung eine Stufe weniger).
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
    const rows = [];
    const raid = Power.raidList(p)[0];
    if (raid) {
      const q = raidQuality(p, raid.type, isMega() ? state.megaLevel : null);
      if (q) {
        rows.push({
          id: 'raid', label: 'Raids', phrase: 'für Raids', weakPhrase: 'für Raids', grade: raid.grade, adjusted: Math.max(0, raid.grade - (q.quality ? 0 : 1)), quality: q.quality,
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
          id: 'mega', label: `Als ${mega.name}`, phrase: `als ${mega.name}`, weakPhrase: `für ${mega.name}`, grade: p.rating.mega.grade, adjusted: Math.max(0, p.rating.mega.grade - (q.quality ? 0 : 1)), quality: q.quality,
          value: `${formatPercent(q.ratio, 1)} der Raid-Wertung von 15/15/15`,
        });
      }
    }
    return rows;
  }

  // Urteil mit den eingegebenen IVs – steht direkt unter den Eingabefeldern und ändert sich mit ihnen.
  function myVerdict() {
    const rows = assessIvs();
    const counted = rows.filter((r) => r.grade > 0);
    const verdict = (badge, text, grade = null) => el('p', { class: 'my-verdict', id: 'my-verdict', data: grade === null ? null : { grade: String(grade) } }, [
      el('span', { class: 'my-verdict__label', text: 'Mit deinen IVs:' }), ' ', badge, ' ', el('span', { class: 'my-verdict__text', text }),
    ]);
    if (!counted.length) {
      const evolve = Power.evolveOf(p);
      return verdict(Power.verdictBadge(p), evolve ? `Erst zu ${Power.pokemon(evolve.key).name} entwickeln – die IVs bleiben dabei gleich.` : 'Die IVs ändern daran nichts.');
    }
    const best = Math.max(...counted.map((r) => r.adjusted));
    const weak = counted.filter((r) => r.grade >= 2 && r.adjusted < r.grade);
    const strong = counted.filter((r) => r.adjusted === best && best > 0 && !weak.includes(r));
    const parts = [];
    if (strong.length) parts.push(`Am besten ${joinList(strong.map((r) => r.phrase))}.`);
    if (weak.length) parts.push(`Der Angriff ist zu niedrig – ${joinList(weak.map((r) => r.weakPhrase))} lohnt sich ein besseres Exemplar.`);
    if (!strong.length && !weak.length) parts.push('Mit diesen IVs als Angreifer zu schwach.');
    const better = Power.betterOf(p);
    if (better) parts.push(`Als ${Power.pokemon(better.key).name} wäre es ${best > 0 ? 'noch ' : ''}stärker – die IVs bleiben beim Entwickeln gleich.`);
    return verdict(Power.gradeBadge(best), parts.join(' '), best);
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
    const list = Power.raidList(p);
    if (!list.length) {
      return card('Raids & Arenen', [line([p.charged.length + p.eliteCharged.length ? 'Seine Lade-Attacken taugen gegen keinen Raid-Boss.' : 'Keine Lade-Attacke – als Angreifer ungeeignet.'])], { id: 'raid-card' });
    }
    const boost = PowerCalc.levelBoost(data, { buddy: state.buddy, megaBoost: megaBoost() });
    const rows = list.map((x) => {
      const numbers = raidLevels().map((level) => {
        const mine = PowerCalc.bestPve(data, p, pveStats(level, state.iv), x.type, pveOpts());
        return el('span', { class: 'raid-row__level' }, [
          `Level ${level}${boost ? ` (→ ${formatLevel(level + boost)})` : ''}: `,
          mine ? el('strong', { text: `${formatNumber(mine.dps, 1)} DPS` }) : '–',
          mine ? ` · ${formatNumber(mine.tdo)} TDO` : '',
        ]);
      });
      return el('li', { class: 'raid-row', data: { type: x.type } }, [
        el('div', { class: 'raid-row__head' }, [
          Power.typeChip(x.type, true),
          Power.gradeBadge(x.grade),
          el('a', { class: 'rank-link', href: `#rangliste=raid-${x.type.toLowerCase()}${isMega() ? '-mega' : ''}`, text: `Platz ${x.rank} von ${x.of}${Power.withCrypto(p) || isMega() ? '' : ' ohne Crypto'}` }),
        ]),
        movesLine([x.fast, x.charged]),
        el('p', { class: 'raid-row__numbers' }, numbers),
      ]);
    });
    const shadowNote = p.shadow ? ' Crypto-Bonus (+20 % Angriff, −17 % Verteidigung) ist eingerechnet.' : '';
    const megaNote = isMega() ? (p.variant === 'primal' ? ', Proto-Form auf dem höchsten Proto-Level' : ', Mega auf dem höchsten Mega-Level') : '';
    const cryptoOff = p.shadow && !Power.settings.crypto ? ' Der Schalter „Crypto-Pokémon“ ist aus – für dieses Crypto-Pokémon zählen die Plätze trotzdem mit Crypto.' : '';
    return card('Raids & Arenen', [
      el('ul', { class: 'raid-rows', id: 'raid-rows' }, rows),
      line([`DPS und TDO gegen einen 5-Sterne-Boss, der schwach gegen den Typ ist – mit deinen IVs.${shadowNote} Platz: Rangliste auf Level 40 mit 15/15/15${megaNote}; ein Tipp darauf zeigt die ganze Rangliste.${cryptoOff}`]),
      isMega() ? line([`${p.variant === 'primal' ? 'Die Protomorphose' : 'Die Mega-Entwicklung'} verstärkt zusätzlich die Attacken aller anderen im Raid (+${Math.round((data.rules.megaLevels[0].otherTypeBoost - 1) * 100)} %, Attacken vom Typ ${joinList((p.boostTypes ?? p.types).map((t) => data.types[t]))} +${Math.round((data.rules.megaLevels[0].sameTypeBoost - 1) * 100)} %) – ihre eigenen nicht.`]) : null,
    ], { id: 'raid-card' });
  }

  function megaCard() {
    const owner = ownerOf();
    if (!isMega()) {
      if (!owner.megas?.length) return null;
      const primalOnly = isPrimalOnly(owner);
      return card(primalOnly ? 'Protomorphose' : 'Mega-Entwicklung', [
        line([`${p.name} kann ${owner.megas.length > 1 ? 'mehrere Mega-Formen' : primalOnly ? 'eine Proto-Form' : 'eine Mega-Form'} annehmen: `,
          ...owner.megas.flatMap((k, i) => [i ? (i === owner.megas.length - 1 ? ' und ' : ', ') : '', el('a', { href: `#pokemon=${k}`, data: { pokemon: k }, text: Power.pokemon(k).name })]), '.']),
        line([`Für den Bonbon-Bonus der ${primalOnly ? 'Proto-Form' : 'Mega'} musst du nichts hochleveln – nur für den eigenen Schaden zählt das Level.`]),
      ], { id: 'mega-card' });
    }
    const levels = data.rules.megaLevels.slice(0, p.megaLevels);
    const plus = p.plusMove ? Power.move(p.plusMove) : null;
    const primal = p.variant === 'primal';
    return card(primal ? 'Protomorphose' : 'Mega-Entwicklung', [
      line([
        `Aktiv ${data.rules.megaDurationH} Stunden. Im Raid verstärkt sie die Attacken aller anderen Trainer um ${Math.round((levels[0].otherTypeBoost - 1) * 100)} %, `,
        `Attacken vom Typ ${joinList((p.boostTypes ?? p.types).map((t) => data.types[t]))} um ${Math.round((levels[0].sameTypeBoost - 1) * 100)} %. `,
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
      plus ? line([`Zusatz-Lade-Attacke ${plus.name} (${data.types[plus.type]}): nur als Mega, in Raids ${formatNumber(plus.power)} Stärke auf Basis-Level, bis ×${formatNumber(data.rules.plusMoveFactor[p.megaLevels - 1], 1)} auf dem höchsten Mega-Level. Gilt in Raids, aber nicht in Arenenkämpfen.`]) : null,
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
      if (f.candy) cost.push(candyText(f.candy));
      if (f.item) cost.push(`${formatNumber(f.itemCount ?? 1)}× ${f.item}`);
      if (f.partner) cost.push(`dazu ${Power.pokemon(f.partner).name} (${f.partnerCandy} seiner Bonbons)`);
      items.push(el('li', {}, [
        f.partner ? 'Fusion: ' : 'Formwechsel: ', el('a', { href: `#pokemon=${t.key}`, data: { pokemon: t.key }, text: t.name }),
        ` (Bewertung: ${Power.GRADES[Power.gradeOf(t)].label})`,
        cost.length ? `: ${cost.join(', ')}` : '',
        f.requires.length ? `. Braucht die Attacke ${f.requires.map(moveName).join(' oder ')}` : '',
        f.replaces.length ? `. ${f.replaces.map((r) => (r.from ? `${moveName(r.from)} wird zu ${moveName(r.to)}` : `Lernt ${moveName(r.to)}`)).join(', ')}` : '',
        '.',
      ]));
    }
    if (p.shadow && p.purification) {
      items.push(el('li', {}, [`Erlösen kostet ${formatNumber(p.purification.stardust)} Sternenstaub und ${candyText(p.purification.candy)}: Das Pokémon wird mindestens Level 25 und jeder IV-Wert steigt um 2 (höchstens 15). `,
        p.rating.grade > (Power.pokemon(p.normalKey)?.rating.grade ?? 0) ? 'Als Crypto ist es aber stärker – lieber nicht erlösen.' : 'Danach sind Power-ups 10 % günstiger statt 20 % teurer.',
        p.purifiedMove ? ` Erlöst lernt es ${moveName(p.purifiedMove)}.` : '']));
    }
    if (p.requiredMove) items.push(el('li', { text: `Nur ${owner.name} mit der Attacke ${moveName(p.requiredMove)} kann sich in ${p.name} verwandeln – die Mega kennt sie deshalb immer.` }));
    if (!isMega() && (owner.megas ?? []).some((k) => Power.pokemon(k).requiredMove)) {
      const m = Power.pokemon(owner.megas.find((k) => Power.pokemon(k).requiredMove));
      const item = itemMove(p, m.requiredMove);
      items.push(el('li', { text: `Für die Mega-Entwicklung braucht ${p.name} die Attacke ${moveName(m.requiredMove)}${item ? ` – die lernt es nur ${item.how} (gibt es bei Events), nicht per Top-TM` : ' (nur per Top-TM oder bei Events)'}.` }));
    }
    if (owner.thirdMove && owner.thirdMove.candy < 10000 && owner.charged.length + owner.eliteCharged.length > 1) items.push(el('li', { text: `Zweite Lade-Attacke: ${formatNumber(owner.thirdMove.stardust)} Sternenstaub und ${candyText(owner.thirdMove.candy)}${p.shadow ? ' (Crypto: 20 % mehr)' : ''} – nützlich, wenn es gegen verschiedene Raid-Bosse antreten soll.` }));
    if (owner.buddyKm) items.push(el('li', { text: `Als Kumpel: 1 Bonbon alle ${formatNumber(owner.buddyKm)} km.` }));
    if (owner.upgradeOverride) items.push(el('li', { text: `${owner.name} braucht für Power-ups deutlich mehr Bonbons als andere Pokémon (siehe „Werte & Kosten“).` }));
    // Crypto-Pokémon sind nie tauschbar; erlöst schon, wenn die normale Form es ist.
    if (p.shadow && Power.pokemon(p.normalKey)?.tradable) items.push(el('li', { text: 'Crypto-Pokémon sind nicht tauschbar – erst erlöst kann es getauscht und zum Glücks-Pokémon werden.' }));
    else if (!owner.tradable) items.push(el('li', { text: 'Nicht tauschbar – deshalb gibt es kein Glücks-Pokémon und keinen Tausch-Rabatt.' }));
    if (!items.length) return null;
    return card('Besonderheiten', [el('ul', { class: 'plain-list', id: 'specials' }, items)], { id: 'special-card' });
  }

  function ratingPanel() {
    return [
      findings(),
      ivVerdict(),
      el('div', { class: 'info-grid' }, [raidCard(), megaCard(), specialCard()].filter(Boolean)),
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
    if (isMega()) notes.push(`Werte der ${p.variant === 'primal' ? 'Proto-Form' : 'Mega-Form'}; Power-ups gelten für ${owner.name}.`);
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
      ]);
    });
    const chargedRows = charged.map((id) => {
      const m = Power.move(id);
      const power = m.plus ? m.power * plusFactor : m.power;
      return el('tr', {}, [
        el('th', { scope: 'row' }, [moveChip(id)]),
        el('td', { text: num(power) }), el('td', { text: num(m.durationS, 1) }), el('td', { text: num(-m.energy) }),
        el('td', { text: num(power / m.durationS, 1) }), el('td', { text: m.energy ? num(power / -m.energy, 2) : '–' }),
      ]);
    });
    const table = (id, caption, head, rows) => el('div', { class: 'table-wrap' }, [el('table', { class: 'data-table move-table', id }, [
      el('caption', { text: caption }),
      el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: 'Attacke' }), ...head.map((h) => el('th', { scope: 'col', text: h }))])]),
      el('tbody', {}, rows),
    ])]);
    return [
      table('fast-table', 'Sofort-Attacken', ['Stärke', 'Dauer s', 'Energie', 'DPS', 'EPS'], fastRows),
      table('charged-table', 'Lade-Attacken', ['Stärke', 'Dauer s', 'Kosten', 'DPS', 'DPE'], chargedRows),
      el('p', { class: 'info-card__line', text: 'Werte für Raids und Arenen, ohne STAB und Wetter. Top-TM: nur mit Top-Sofort- bzw. Top-Lade-TM, an Community Days oder bei Events. Kraftreserve hat einen zufälligen Typ und fehlt in den Ranglisten.' }),
      ...[...fast, ...charged].filter((id) => itemMove(p, id)).map((id) => el('p', { class: 'info-card__line', text: `${itemMove(p, id).item}: ${moveName(id)} lernt ${ownerOf().name} nur ${itemMove(p, id).how} (gibt es bei Events), nicht per Top-TM.` })),
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

  let lastBackLabel = '← Alle Pokémon';
  // Crypto-Schalter umgelegt: Seite mit denselben Eingaben neu zeichnen.
  Power.onSettingsChange(() => {
    if (p && container && !container.hidden && container.isConnected && container.querySelector('#detail-title')) {
      render(p.key, container, { backLabel: lastBackLabel });
    }
  });

  function render(key, target, { backLabel = '← Alle Pokémon' } = {}) {
    lastBackLabel = backLabel;
    const next = Power.pokemon(key);
    const prevBase = p ? ownerOf().base : null;
    // IVs und Level bleiben innerhalb einer Familie (Entwicklung, Mega, Crypto) – wie im Spiel beim Entwickeln.
    if (!p || next.family !== state.family) {
      Object.assign(state, { iv: { ...FULL }, level: START_LEVEL, lucky: false, purified: false, buddy: false, shiny: false, cpText: '' });
    }
    if (p?.key !== key) state.tab = 'bewertung';
    p = next;
    state.family = p.family;
    state.megaLevel = isMega() ? p.megaLevels : null;
    if (!canBePurified()) state.purified = false;
    // Andere Basiswerte (z. B. nach dem Entwickeln): die eingegebenen WP gehören zum alten Pokémon.
    const base = ownerOf().base;
    if (prevBase && (prevBase.atk !== base.atk || prevBase.def !== base.def || prevBase.sta !== base.sta)) state.cpText = '';
    container = target;
    target.replaceChildren(
      el('a', { class: 'back-link', href: '#', id: 'back' }, [backLabel]),
      header(),
      controls(),
      el('p', { class: 'visually-hidden', id: 'mine-status', role: 'status' }),
      tabs(),
      el('div', { id: 'tab-panel', class: 'tab-panel', role: 'tabpanel', 'aria-labelledby': `tab-${state.tab}` }),
    );
    renderPanel();
  }

  return { render, current: () => p };
})();
