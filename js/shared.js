'use strict';

// Gemeinsame Bausteine: Datenzugriff, DOM-Helfer, Texte, Bewertungen und Formatierung.
// Klassisches Skript statt ES-Modul, damit die Seite auch per Doppelklick (file://) läuft.
// Alle Inhalte werden per textContent/DOM gebaut, nie per innerHTML (Schutz vor XSS).

const Power = (() => {
  const data = window.POWER_DATA ?? null;
  const ready = Boolean(data?.pokemon?.length && data?.moves);
  const byKey = new Map(ready ? data.pokemon.map((p) => [p.key, p]) : []);

  const TYPE_ORDER = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND',
    'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];

  // Bewertungs-Stufen (aus dem Daten-Skript): 3 Spitze, 2 lohnt sich, 1 Nische, 0 lohnt sich nicht.
  const GRADES = [
    { id: 'no', label: 'Lohnt nicht', long: 'Lohnt sich nicht', word: 'schwach' },
    { id: 'niche', label: 'Nische', long: 'Nur für Nischen', word: 'Nische' },
    { id: 'good', label: 'Lohnt sich', long: 'Lohnt sich', word: 'gut' },
    { id: 'top', label: 'Spitze', long: 'Spitze – lohnt sich sehr', word: 'Spitze' },
  ];
  const EVOLVE = { id: 'evolve', label: 'Entwickeln', long: 'Erst entwickeln' };

  const CLASSES = { legendary: 'Legendär', mythical: 'Mysteriös', ultrabeast: 'Ultrabestie' };

  // ---------- Einstellung "Crypto-Pokémon" (gilt für alle Ansichten) ----------

  // An: Crypto-Pokémon zählen mit (Listen, Plätze, Bewertungen). Aus: Sie fehlen in Listen und Ranglisten, und
  // Plätze und Bewertungen sind ohne sie gerechnet (Daten-Skript: *NS-Felder).
  const settings = { crypto: true };
  const listeners = [];
  const onSettingsChange = (fn) => listeners.push(fn);
  function setCrypto(on) {
    if (settings.crypto === on) return;
    settings.crypto = on;
    for (const fn of listeners) fn(settings);
  }
  const visible = (p) => settings.crypto || !p.shadow;
  const gradeOf = (p) => (settings.crypto ? p.rating.grade : p.rating.gradeNS);
  const evolveOf = (p) => (settings.crypto ? p.rating.evolve : p.rating.evolveNS) ?? null;
  // Werte eines Raid-Eintrags (ein Angriffstyp) im aktuellen Modus.
  const raidView = (x) => (settings.crypto || !x
    ? x
    : { ...x, rank: x.rankNS, of: x.ofNS, ratio: x.ratioNS, grade: x.gradeNS, plainGrade: x.plainGradeNS });
  // Raid-Einträge eines Pokémon im aktuellen Modus, stärkster zuerst.
  const raidList = (p) => (p.rating.raid ?? []).map(raidView).sort((a, b) => b.grade - a.grade || b.ratio - a.ratio);

  // ---------- DOM ----------

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style') for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v);
      else if (key === 'data') for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const formatNumber = (n, digits = 0) => n.toLocaleString('de-CH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const formatLevel = (level) => formatNumber(level, Number.isInteger(level) ? 0 : 1);
  const formatPercent = (ratio, digits = 0) => `${formatNumber(ratio * 100, digits)} %`;
  const formatDate = (iso) => new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  const slugOf = (type) => type.toLowerCase();
  const ivPercent = (iv) => (iv.atk + iv.def + iv.sta) / 45;

  // Suche ohne Rücksicht auf Groß-/Kleinschreibung und Akzente ("pokemon" findet "Pokémon").
  const normalize = (text) => text.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9♀♂]+/g, ' ').trim();

  // ---------- Bewertung ----------

  // Gesamturteil eines Pokémon: Stufe, oder "Erst entwickeln", wenn eine Entwicklung deutlich mehr taugt.
  function verdictOf(p) {
    const evolve = evolveOf(p);
    if (evolve) return { ...EVOLVE, grade: gradeOf(p), target: byKey.get(evolve.key) };
    return { ...GRADES[gradeOf(p)], grade: gradeOf(p) };
  }

  // Stärkster Grund für die Bewertung – als Kurztext für Listen ("Raids: Platz 3 Feuer").
  function shortReason(p) {
    const evolve = evolveOf(p);
    if (evolve) return `Zu ${byKey.get(evolve.key).name} entwickeln`;
    const raid = raidList(p)[0];
    const reasons = [];
    if (raid?.grade) reasons.push({ grade: raid.grade, text: `Raids: Platz ${raid.rank} ${data.types[raid.type]}${p.variant !== 'normal' ? ' (Megas)' : ''}` });
    if (p.rating.mega && p.rating.mega.grade > (raid?.grade ?? 0)) {
      const mega = byKey.get(p.rating.mega.key);
      const mr = mega.rating.raid?.[0];
      reasons.push({ grade: p.rating.mega.grade, text: `Als ${mega.name}${mr ? `: Platz ${mr.rank} ${data.types[mr.type]}` : ''}` });
    }
    reasons.sort((a, b) => b.grade - a.grade);
    if (reasons.length) return reasons[0].text;
    if (p.rating.max?.grade >= 2) return 'Nur als Dynamax stark (Max-Kämpfe)';
    if (p.variant !== 'normal') return 'Mega-Bonus nutzbar, als Angreifer schwach';
    return raid ? `Raids: Platz ${raid.rank} ${data.types[raid.type]} – zu weit hinten` : 'Kein Raid-Angreifer';
  }

  // ---------- Bausteine ----------

  function typeChip(type, small = false) {
    if (!type) return el('span', { class: `type-chip type-random${small ? ' type-chip--small' : ''}`, text: 'Zufall' });
    return el('span', { class: `type-chip type-${slugOf(type)}${small ? ' type-chip--small' : ''}`, text: data.types[type] });
  }

  function typeDots(types) {
    return el('span', { class: 'type-dots' }, types.map((t) => el('span', { class: `type-dot type-${slugOf(t)}`, title: data.types[t] })));
  }

  function verdictBadge(p, { long = false, small = false } = {}) {
    const v = verdictOf(p);
    return el('span', { class: `verdict verdict--${v.id}${small ? ' verdict--small' : ''}`, text: long ? v.long : v.label });
  }

  function gradeBadge(grade, text = GRADES[grade].label) {
    return el('span', { class: `verdict verdict--${GRADES[grade].id} verdict--small`, text });
  }

  // Marken eines Pokémon: Legendär/Mysteriös/Ultrabestie, Mega/Proto, Crypto.
  function badges(p) {
    const list = [];
    if (p.shadow) list.push(el('span', { class: 'badge badge--shadow', text: 'Crypto' }));
    if (p.variant === 'mega') list.push(el('span', { class: 'badge badge--mega', text: 'Mega' }));
    if (p.variant === 'primal') list.push(el('span', { class: 'badge badge--primal', text: 'Proto' }));
    if (p.class) list.push(el('span', { class: `badge badge--${p.class}`, text: CLASSES[p.class] }));
    return list;
  }

  function eliteBadge(text = 'Elite-TM') {
    return el('span', { class: 'badge badge--elite', text, title: 'Nur mit Elite-TM, von Community Days oder bei bestimmten Events erhältlich' });
  }

  // Ohne Bild (Plan B oder seltene Form): Pokédex-Nummer auf einem Verlauf der Typfarben.
  function artFallback(p) {
    const [first, second = first] = p.types.map(slugOf);
    return el('span', {
      class: 'art__fallback',
      style: { '--c1': `var(--t-${first})`, '--c2': `var(--t-${second})` },
    }, [`#${String(p.dex).padStart(3, '0')}`]);
  }

  function pokemonArt(p, { eager = false, size = 'md' } = {}) {
    const variant = p.variant === 'normal' ? '' : ` art--${p.variant}`;
    return el('div', { class: `art art--${size}${variant}${p.shadow ? ' art--shadow' : ''}` }, [
      p.image
        ? el('img', { src: p.image, alt: '', width: 256, height: 256, loading: eager ? 'eager' : 'lazy', decoding: 'async' })
        : artFallback(p),
    ]);
  }

  function meter(label, valueText, ratio, modifier) {
    const pct = Math.max(3, Math.min(100, Math.round(ratio * 100)));
    return el('div', { class: `meter meter--${modifier}` }, [
      el('div', { class: 'meter__head' }, [el('span', { text: label }), el('strong', { text: valueText })]),
      el('div', { class: 'meter__track', role: 'img', 'aria-label': `${label}: ${valueText}` }, [
        el('span', { class: 'meter__fill', style: { '--fill': `${pct}%` } }),
      ]),
    ]);
  }

  function pokemonLink(p, { size = 'xs', text = p.name } = {}) {
    return el('a', { class: 'mini-link', href: `#pokemon=${p.key}`, data: { pokemon: p.key } }, [
      pokemonArt(p, { size }),
      el('span', { text }),
    ]);
  }

  function renderSources() {
    const target = document.getElementById('sources');
    if (!target || !ready) return;
    const { gameMaster, texts, pvpoke, dyna, images, gameMasterDate } = data.sources;
    const link = (source) => el('a', { href: source.url, text: source.name });
    const hasArtwork = data.pokemon.some((p) => p.image);
    target.replaceChildren(
      'Quellen: Spieldaten von ', link(gameMaster),
      gameMasterDate ? ` (Stand ${formatDate(gameMasterDate)})` : '',
      ', deutsche Namen aus den Spieltexten (', link(texts), '), erschienene Pokémon nach ', link(pvpoke),
      ', Dynamax-Pokémon vom ', link(dyna),
      ...(hasArtwork ? [', Bilder von ', link(images)] : []), '. ',
      `Seite erstellt am ${formatDate(data.generatedAt)}.`,
      hasArtwork ? ' Artworks © Pokémon/Nintendo/Creatures/GAME FREAK.' : '',
    );
  }

  return {
    data, ready, TYPE_ORDER, GRADES, EVOLVE, CLASSES,
    settings, setCrypto, onSettingsChange, visible, gradeOf, evolveOf, raidView, raidList,
    el, formatNumber, formatLevel, formatPercent, formatDate, slugOf, normalize, ivPercent,
    verdictOf, shortReason,
    typeChip, typeDots, verdictBadge, gradeBadge, badges, eliteBadge, pokemonArt, meter, pokemonLink, renderSources,
    pokemon: (key) => byKey.get(key) ?? null,
    move: (id) => (data.moves[id] ? { id, ...data.moves[id] } : null),
  };
})();
