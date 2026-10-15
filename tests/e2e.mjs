// Klickt die Seite mit echten Mausklicks durch – auf Desktop-, Tablet- und Handy-Breite – und rechnet
// WP, Werte und Power-up-Kosten unabhängig von js/calc.js nach.
// Aufruf: node tests/e2e.mjs                 (lokale Kopie)
//         node tests/e2e.mjs --url <Adresse> (veröffentlichte Seite)

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, sleep } from '../scripts/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const urlArg = process.argv.indexOf('--url');
const BASE = urlArg > 0 ? process.argv[urlArg + 1].replace(/\/?$/, '/') : null;
const url = (file, hash = '') => (BASE ? new URL(file, BASE).href : pathToFileURL(path.join(ROOT, file)).href) + hash;

// "every": jeder wievielte Eintrag beim Rendern aller Pokémon-Seiten geprüft wird.
const VIEWPORTS = [
  { label: 'Desktop', width: 1280, height: 900, every: 1 },
  { label: 'Tablet', width: 820, height: 1180, mobile: true, every: 7 },
  { label: 'Handy', width: 390, height: 844, mobile: true, every: 5 },
  { label: 'Klein', width: 320, height: 640, mobile: true, every: 13 },
];

let passed = 0;
const failures = [];
function check(condition, message) {
  if (condition) passed++;
  else failures.push(message);
}

async function loadSource(file) {
  if (!BASE) return readFile(path.join(ROOT, file), 'utf8');
  const res = await fetch(new URL(file, BASE));
  if (!res.ok) throw new Error(`${file} von ${BASE} nicht geladen (HTTP ${res.status})`);
  return res.text();
}
async function loadData() {
  const text = await loadSource('data/pokemon-data.js');
  return JSON.parse(text.slice(text.indexOf('=') + 1).trim().replace(/;$/, ''));
}
const DATA = await loadData();
const byKey = new Map(DATA.pokemon.map((p) => [p.key, p]));

// Zahlen wie auf der Seite (de-CH: 45’899) zurück in Zahlen.
const num = (text) => Number(String(text).replace(/[’'\s]/g, '').replace(',', '.'));

// ---------- unabhängige Rechnung (bewusst nicht calc.js) ----------

function cpm(level) {
  const t = DATA.rules.cpm;
  if (Number.isInteger(level)) return t[level - 1];
  const a = t[Math.floor(level) - 1];
  const b = t[Math.floor(level)];
  return Math.sqrt((a * a + b * b) / 2);
}
const cpOf = (p, level, iv) => Math.max(10, Math.floor((p.base.atk + iv.atk) * Math.sqrt(p.base.def + iv.def) * Math.sqrt(p.base.sta + iv.sta) * cpm(level) ** 2 / 10));
const hpOf = (p, level, iv) => Math.max(10, Math.floor((p.base.sta + iv.sta) * cpm(level)));

// Power-up-Kosten Schritt für Schritt (jeder halbe Level aufgerundet).
function cost(p, from, to, { shadow = p.shadow, purified = false, lucky = false } = {}) {
  const u = DATA.upgradeOverrides[p.speciesId] ?? DATA.upgrades;
  let stardust = 0;
  let candy = 0;
  let xl = 0;
  const mDust = (shadow ? u.shadowStardust : 1) * (purified ? u.purifiedStardust : 1) * (lucky ? 0.5 : 1);
  const mCandy = (shadow ? u.shadowCandy : 1) * (purified ? u.purifiedCandy : 1);
  for (let l = from; l < to; l += 0.5) {
    const i = Math.floor(l) - 1;
    stardust += Math.ceil(u.stardust[i] * mDust - 1e-9);
    if (l < 40) candy += Math.ceil(u.candy[i] * mCandy - 1e-9);
    else xl += Math.ceil(u.xl[Math.floor(l) - 40] * mCandy - 1e-9);
  }
  return { stardust, candy, xl };
}

function testCalc() {
  const mewtwo = byKey.get('mewtwo');
  const full = { atk: 15, def: 15, sta: 15 };
  // Bekannte Werte aus dem Spiel.
  check(cpOf(mewtwo, 40, full) === 4178 && cpOf(mewtwo, 50, full) === 4724 && cpOf(mewtwo, 51, full) === 4780, 'Mewtu: WP 4178 / 4724 / 4780 erwartet');
  check(cpOf(byKey.get('machamp'), 40, full) === 3056 && cpOf(byKey.get('blissey'), 40, full) === 2757, 'Machomei 3056 / Heiteira 2757 WP auf Level 40 erwartet');
  const c1 = cost(mewtwo, 1, 40);
  const c2 = cost(mewtwo, 40, 50);
  check(c1.stardust === 270000 && c1.candy === 304, `Kosten 1→40: ${JSON.stringify(c1)}`);
  check(c2.stardust === 250000 && c2.xl === 296, `Kosten 40→50: ${JSON.stringify(c2)}`);
  check(cost(mewtwo, 40, 50, { shadow: true }).xl === 360 && cost(mewtwo, 40, 50, { purified: true }).xl === 272, 'Crypto 360 XL, Erlöst 272 XL erwartet');
  check(cost(mewtwo, 1, 40, { shadow: true }).candy === 406, 'Crypto 1→40: 406 Bonbons erwartet');
  // Datenbestand: jedes Pokémon mit gültigen Werten, Bewertungen im Bereich, Verweise gültig.
  for (const p of DATA.pokemon) {
    const ok = ['atk', 'def', 'sta'].every((k) => p.base[k] > 0) && p.types.length >= 1
      && [0, 1, 2, 3].includes(p.rating.grade) && [0, 1, 2, 3].includes(p.rating.gradeNS);
    check(ok, `${p.key}: ungültige Grundwerte oder Bewertung`);
    for (const k of [p.parent, p.normalKey, p.shadowKey, p.preEvo, ...(p.megas ?? []), ...(p.evolutions ?? []).map((e) => e.key), ...(p.formChanges ?? []).map((f) => f.key)]) {
      if (k) check(byKey.has(k), `${p.key}: Verweis auf unbekanntes Pokémon ${k}`);
    }
    for (const id of [...p.fast, ...p.charged, ...p.eliteFast, ...p.eliteCharged]) check(Boolean(DATA.moves[id]), `${p.key}: unbekannte Attacke ${id}`);
  }
  // Ohne Crypto steht ein normales Pokémon nie schlechter da als mit (die Crypto-Pokémon fallen ja weg).
  for (const p of DATA.pokemon.filter((q) => !q.shadow && q.variant === 'normal')) {
    for (const r of p.rating.raid ?? []) check(r.rankNS <= r.rank && r.gradeNS >= r.grade && r.ratioNS >= r.ratio, `${p.key} ${r.type}: ohne Crypto schlechter als mit`);
  }
  // Ranglisten: jede Typ-Liste enthält nur Pokémon mit einer Lade-Attacke dieses Typs.
  for (const [type, t] of Object.entries(DATA.raidTables)) {
    for (const k of t.normal.slice(0, 10)) {
      const p = byKey.get(k);
      const r = p.rating.raid.find((x) => x.type === type);
      check(r && DATA.moves[r.charged].type === type, `Rangliste ${type}: ${k} ohne passende Lade-Attacke`);
    }
    check(t.megas.every((k) => byKey.get(k).variant !== 'normal') && t.normal.every((k) => byKey.get(k).variant === 'normal'), `Rangliste ${type}: Mega und normal vermischt`);
  }
  // Keine Max-Kämpfe in den Daten.
  check(!DATA.maxTables && !DATA.sources.dyna && DATA.pokemon.every((p) => !p.rating.max), 'Daten enthalten noch Max-Kämpfe');
  // Mega-Level 4 nur für Megas, die es im Spiel haben; Super-Max-Boost +2 Level.
  check(DATA.rules.megaLevels[3].selfCpBoost === 2 && DATA.rules.megaLevels.map((l) => l.candy).join() === '1,1,2,3', 'Mega-Level-Regeln aus den Spieldaten');
  check(byKey.get('starmie-mega').megaLevels === 4 && byKey.get('gengar-mega').megaLevels === 3, 'Super-Max-Level: Mega-Starmie ja, Mega-Gengar nein');
}

// ---------- Startseite und Filter ----------

const listState = (page) => page.eval(`(() => ({
  count: document.getElementById('list-count').textContent,
  tiles: [...document.querySelectorAll('#poke-grid .poke-tile')].map((a) => ({
    key: a.dataset.pokemon,
    verdict: [...a.querySelector('.verdict').classList].find((c) => c.startsWith('verdict--') && c !== 'verdict--small'),
    rank: a.querySelector('.poke-tile__rank') ? Number(a.querySelector('.poke-tile__rank').textContent.slice(1)) : null,
  })),
  more: !document.getElementById('list-more').hidden,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()`);

const GRADE_IDS = ['no', 'niche', 'good', 'top'];
const Power_TYPES = Object.keys(DATA.raidTables);

async function testStart(page, vp) {
  const tag = `[${vp.label}]`;
  await page.goto(url('index.html'));
  let s = await listState(page);
  check(s.tiles.length === 48 && s.more, `${tag} Startseite: 48 Kacheln und "Weitere anzeigen" erwartet (${s.tiles.length})`);
  check(num(s.count.split(' ')[0]) === DATA.pokemon.length, `${tag} Anzahl: ${s.count}`);
  check(s.overflow <= 0, `${tag} Startseite läuft seitlich über (${s.overflow}px)`);
  // Pokédex-Reihenfolge.
  const dex = s.tiles.map((t) => byKey.get(t.key).dex);
  check(dex.every((d, i) => i === 0 || dex[i - 1] <= d), `${tag} Liste nicht nach Pokédex sortiert`);

  // Weitere anzeigen: 48 mehr, Fokus auf der ersten neuen Kachel.
  await page.click('#list-more');
  s = await listState(page);
  const focused = await page.eval('document.activeElement?.dataset?.pokemon ?? null');
  check(s.tiles.length === 96 && focused === s.tiles[48].key, `${tag} "Weitere anzeigen": ${s.tiles.length} Kacheln, Fokus ${focused}`);

  // Suche oben (deutsch, englisch, Nummer): filtert die Liste und zeigt Vorschläge.
  // Auch: Nummer wie auf den Kacheln (#025), ohne Bindestrich (hooh), Umlaut als ue (ruestung).
  for (const [query, expect] of [['mamutel', 'mamoswine'], ['Mamoswine', 'crypto-mamoswine'], ['445', 'garchomp'], ['mega gengar', 'gengar-mega'],
    ['#025', 'pikachu'], ['hooh', 'ho-oh'], ['ruestung', 'mewtwo-a']]) {
    await page.type('#search', query);
    s = await listState(page);
    check(s.tiles.some((t) => t.key === expect), `${tag} Suche "${query}" findet ${expect} nicht`);
    const suggest = await page.eval(`[...document.querySelectorAll('#search-suggest [data-pokemon]')].map((o) => o.dataset.pokemon)`);
    check(suggest.includes(expect), `${tag} Vorschläge zu "${query}" ohne ${expect}: ${suggest.join(', ')}`);
  }
  await page.type('#search', 'endynalos');
  s = await listState(page);
  check(/^1 Pokémon passt zu/.test(s.count), `${tag} Einzahl: ${s.count}`);
  await page.key('Escape');
  check(await page.eval(`document.getElementById('search-suggest').hidden`), `${tag} Escape schließt die Vorschläge`);
  await page.click('#search-clear');
  s = await listState(page);
  check(s.tiles.length === 48 && (await page.eval('document.getElementById("search").value')) === '', `${tag} Suche leeren`);
  // Nummern: Vorschläge und Liste zählen gleich ("25" → 25, 250 …; "025" → nur 25, Einzahl).
  await page.type('#search', '25');
  s = await listState(page);
  const all25 = await page.eval(`document.getElementById('search-option-all').textContent`);
  check(num(all25.split(' ')[1]) === num(s.count.split(' ')[0]), `${tag} Suche "25": ${all25} / ${s.count}`);
  await page.type('#search', '025');
  check((await page.eval(`document.getElementById('search-option-all').textContent`)) === '1 Treffer in der Liste zeigen', `${tag} Suche "025": Einzahl`);
  await page.key('Escape');
  await page.click('#search-clear');

  // Bewertungs-Filter: jede Kachel trägt die gewählte Stufe, Anzahl wie in den Daten.
  for (const [i, id] of GRADE_IDS.entries()) {
    await page.click(`#filter-grade button[data-value="${id}"]`);
    s = await listState(page);
    const expected = DATA.pokemon.filter((p) => !p.rating.evolve && p.rating.grade === i).length;
    check(num(s.count.split(' ')[0]) === expected, `${tag} Filter ${id}: ${s.count} statt ${expected}`);
    check(s.tiles.every((t) => t.verdict === `verdict--${id}`), `${tag} Filter ${id}: falsche Kachel`);
  }
  await page.click('#filter-grade button[data-value="evolve"]');
  s = await listState(page);
  check(s.tiles.length && s.tiles.every((t) => t.verdict === 'verdict--evolve' && byKey.get(t.key).rating.evolve), `${tag} Filter Entwickeln`);
  // "Entwickeln" gibt es nur bei "Urteil": Beim Wechsel zur Rangliste fällt der Filter weg.
  await page.click('#filter-use button[data-value="raid"]');
  s = await listState(page);
  const allChip = await page.eval(`(() => { const b = document.querySelector('#filter-grade button[data-value="all"]'); return { pressed: b.getAttribute('aria-pressed'), count: b.querySelector('.chip__count').textContent }; })()`);
  check(allChip.pressed === 'true' && num(allChip.count) === num(s.count.split(' ')[0]), `${tag} Entwickeln → Raids: Filter "Alle" erwartet (${JSON.stringify(allChip)}, ${s.count})`);
  await page.click('#filter-use button[data-value="all"]');

  // Raids mit Angriffstyp: genau die Rangliste aus den Daten.
  await page.click('#filter-use button[data-value="raid"]');
  for (const type of ['FIRE', 'DRAGON', 'FAIRY']) {
    await page.eval(`(() => { const s = document.getElementById('filter-type'); s.value = '${type}'; s.dispatchEvent(new Event('change')); })()`);
    s = await listState(page);
    const expected = DATA.raidTables[type].normal.slice(0, 48);
    check(s.tiles.map((t) => t.key).join() === expected.join(), `${tag} Raids ${type}: Reihenfolge weicht ab`);
    check(s.tiles.every((t, i) => t.rank === i + 1), `${tag} Raids ${type}: Plätze nicht 1, 2, 3 …`);
    await page.eval(`(() => { const s = document.getElementById('filter-group'); s.value = 'mega'; s.dispatchEvent(new Event('change')); })()`);
    s = await listState(page);
    check(s.tiles.map((t) => t.key).join() === DATA.raidTables[type].megas.slice(0, 48).join(), `${tag} Raids ${type} (Mega): Reihenfolge weicht ab`);
    await page.eval(`(() => { const s = document.getElementById('filter-group'); s.value = 'all'; s.dispatchEvent(new Event('change')); })()`);
  }

  // Crypto-Schalter aus: keine Crypto-Pokémon mehr, Plätze ohne sie neu gezählt, Bewertungen ohne sie.
  await page.eval(`(() => { const s = document.getElementById('filter-type'); s.value = 'FIRE'; s.dispatchEvent(new Event('change')); })()`);
  await page.click('#crypto-toggle');
  s = await listState(page);
  const plainFire = DATA.raidTables.FIRE.normal.filter((k) => !byKey.get(k).shadow);
  check(s.tiles.map((t) => t.key).join() === plainFire.slice(0, 48).join() && s.tiles.every((t, i) => t.rank === i + 1), `${tag} Ohne Crypto: Feuer-Rangliste falsch`);
  await page.click('#filter-reset');
  s = await listState(page);
  check(num(s.count.split(' ')[0]) === DATA.pokemon.filter((p) => !p.shadow).length && s.tiles.every((t) => !byKey.get(t.key).shadow), `${tag} Ohne Crypto: ${s.count}`);
  await page.click('#filter-grade button[data-value="top"]');
  s = await listState(page);
  const topNS = DATA.pokemon.filter((p) => !p.shadow && !p.rating.evolveNS && p.rating.gradeNS === 3).length;
  check(num(s.count.split(' ')[0]) === topNS, `${tag} Ohne Crypto, Spitze: ${s.count} statt ${topNS}`);
  await page.click('#filter-grade button[data-value="all"]');
  await page.click('#crypto-toggle');
  s = await listState(page);
  check(num(s.count.split(' ')[0]) === DATA.pokemon.length, `${tag} Crypto wieder an: ${s.count}`);
  check(s.overflow <= 0, `${tag} Liste läuft seitlich über`);

  // Vorschlag per Tastatur öffnen: Pfeil runter, Enter.
  await page.type('#search', 'mamu');
  await page.key('ArrowDown', 'ArrowDown');
  const first = await page.eval(`document.querySelector('#search-suggest [aria-selected="true"]')?.dataset.pokemon ?? null`);
  check(first && (await page.eval(`document.getElementById('search').getAttribute('aria-activedescendant')`)), `${tag} Vorschlag nicht ausgewählt`);
  await page.key('Enter');
  await sleep(150);
  const opened = await page.eval(`({ title: document.getElementById('detail-title')?.textContent ?? null, hash: location.hash })`);
  check(first && opened.hash === `#pokemon=${first}` && opened.title === byKey.get(first).name, `${tag} Vorschlag öffnen: ${JSON.stringify(opened)}`);
}

// ---------- Ansichten "Nach Typ" und "Top-Rankings" ----------

async function testBrowse(page, vp) {
  const tag = `[${vp.label}]`;
  await page.goto(url('index.html'));
  await page.click('.view-tabs__link[data-view="type"]');
  check(await page.eval(`document.querySelectorAll('.type-btn').length`) === 18, `${tag} Nach Typ: 18 Typ-Knöpfe erwartet`);
  await page.click('a.type-btn[data-type="FIRE"]');
  const fire = await page.eval(`({
    raid: [...document.querySelectorAll('#type-raid-list a')].map((a) => a.dataset.pokemon),
    mega: [...document.querySelectorAll('#type-mega-list a')].map((a) => a.dataset.pokemon),
    all: [...document.querySelectorAll('#type-grid-list a')].map((a) => a.dataset.pokemon),
    hash: location.hash,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  })`);
  check(fire.hash === '#typ=fire', `${tag} Typ-Adresse: ${fire.hash}`);
  check(fire.raid.join() === DATA.raidTables.FIRE.normal.slice(0, 10).join(), `${tag} Feuer: Top 10 weichen von der Rangliste ab`);
  check(fire.mega.join() === DATA.raidTables.FIRE.megas.slice(0, 3).join(), `${tag} Feuer: Top-Megas weichen ab`);
  check(fire.all.length === 48 && fire.all.every((k) => byKey.get(k).types.includes('FIRE')), `${tag} Feuer: "Alle Feuer-Pokémon" enthält andere Typen`);
  check(fire.overflow <= 0, `${tag} Nach Typ läuft seitlich über`);
  // Lange Namen laufen nicht in die Bewertung (alle Typen).
  const overlaps = [];
  for (const type of Power_TYPES) {
    await page.eval(`location.hash = '#typ=${type.toLowerCase()}'`);
    await sleep(60);
    overlaps.push(...await page.eval(`[...document.querySelectorAll('#type-raid-list .rank-row')].filter((row) => {
      const a = row.querySelector('.rank-row__name > span').getBoundingClientRect();
      const b = row.querySelector(':scope > .verdict').getBoundingClientRect();
      return a.right > b.left + 1 && a.bottom > b.top + 1 && b.bottom > a.top + 1;
    }).map((row) => row.dataset.pokemon)`));
  }
  check(!overlaps.length, `${tag} Ranglisten-Zeilen: Name überdeckt die Bewertung (${overlaps.slice(0, 5).join(', ')})`);
  await page.eval(`location.hash = '#typ=fire'`);
  await sleep(60);
  // Ohne Crypto: Top 10 ohne Crypto-Pokémon.
  await page.click('#crypto-toggle');
  const plain = await page.eval(`[...document.querySelectorAll('#type-raid-list a')].map((a) => a.dataset.pokemon)`);
  check(plain.join() === DATA.raidTables.FIRE.normal.filter((k) => !byKey.get(k).shadow).slice(0, 10).join(), `${tag} Feuer ohne Crypto weicht ab`);
  await page.click('#crypto-toggle');
  // Pokémon öffnen und zurück: wieder bei den Feuer-Pokémon, Fokus auf dem Eintrag.
  const key = DATA.raidTables.FIRE.normal[1];
  await page.click(`#type-raid-list a[data-pokemon="${key}"]`);
  check((await page.eval(`document.getElementById('back').textContent`)) === '← Feuer-Pokémon', `${tag} Zurück-Link zu Feuer-Pokémon`);
  await page.click('#back');
  await sleep(150);
  const back = await page.eval(`({ hash: location.hash, focus: document.activeElement?.dataset?.pokemon ?? null })`);
  check(back.hash === '#typ=fire' && back.focus === key, `${tag} Zurück aus Typ-Ansicht: ${JSON.stringify(back)}`);

  // Top-Rankings: beste Angreifer nach Wertung, Karten je Typ.
  await page.click('.view-tabs__link[data-view="top"]');
  const top = await page.eval(`[...document.querySelectorAll('#top-list a')].map((a) => a.dataset.pokemon)`);
  const ratio = (k) => Math.max(...byKey.get(k).rating.raid.map((r) => r.ratio));
  check(top.length === 50 && top.every((k, i) => i === 0 || ratio(top[i - 1]) >= ratio(k) - 1e-9), `${tag} Top-Rankings: nicht nach Wertung sortiert`);
  const best = DATA.pokemon.filter((p) => p.variant === 'normal' && p.rating.raid?.length).sort((a, b) => ratio(b.key) - ratio(a.key))[0];
  check(top[0] === best.key, `${tag} Top-Rankings: Platz 1 ${top[0]} statt ${best.key}`);
  for (const [tab, list, n] of [['raid', 'normal', 5], ['mega', 'megas', 3]]) {
    await page.click(`.sub-tabs__link[data-top="${tab}"]`);
    const cards = await page.eval(`[...document.querySelectorAll('#top-cards .type-card')].map((c) => ({ type: c.dataset.type, keys: [...c.querySelectorAll('a.card-row')].map((a) => a.dataset.pokemon) }))`);
    check(cards.length === 18 && cards.every((c) => c.keys.join() === DATA.raidTables[c.type][list].slice(0, n).join()), `${tag} Top-Rankings ${tab}: Karten weichen von den Ranglisten ab`);
  }
  // Max-Kämpfe gibt es nur im Dyna-Kompass: kein Reiter, keine Liste, alte Adressen führen zur Übersicht.
  check(!(await page.eval(`document.querySelector('.sub-tabs__link[data-top="max"]')`)), `${tag} Top-Rankings: Reiter Max-Kämpfe darf es nicht geben`);
  await page.goto(url('index.html', '#top=max'));
  check(await page.eval(`document.querySelector('.sub-tabs__link[aria-current="page"]')?.dataset.top`) === 'gesamt', `${tag} #top=max → Beste Angreifer`);
  await page.goto(url('index.html', '#typ=fire'));
  check(!(await page.eval(`document.getElementById('type-max-list')`)), `${tag} Nach Typ: keine Max-Liste`);
  await page.goto(url('index.html', '#rangliste=max-fire'));
  const oldMax = await listState(page);
  check(oldMax.tiles.length === 48 && oldMax.tiles.every((t) => t.rank === null), `${tag} #rangliste=max-fire → normale Liste`);
  check((await page.eval(`[...document.querySelectorAll('#filter-use button')].map((b) => b.dataset.value).join()`)) === 'all,raid', `${tag} Liste: nur Urteil und Raid-Rangliste`);
  await page.click('.view-tabs__link[data-view="top"]');
  check((await page.eval('document.documentElement.scrollWidth - document.documentElement.clientWidth')) <= 0, `${tag} Top-Rankings läuft seitlich über`);
  // Zurück zu "Alle Pokémon".
  await page.click('.view-tabs__link[data-view="all"]');
  check(!(await page.eval(`document.getElementById('panel-all').hidden`)) && (await page.eval('location.hash')) === '', `${tag} Reiter "Alle Pokémon"`);
}

// ---------- Pokémon-Seite ----------

const detailState = (page) => page.eval(`(() => ({
  title: document.getElementById('detail-title')?.textContent,
  verdict: document.querySelector('.poke-head .verdict')?.className,
  ivTotal: document.getElementById('iv-total')?.textContent,
  my: document.getElementById('my-verdict')?.textContent,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  tab: document.querySelector('.tabs__btn[aria-selected="true"]')?.id,
}))()`);

async function selectValue(page, selector, value) {
  await page.eval(`(() => { const s = document.querySelector(${JSON.stringify(selector)}); s.value = ${JSON.stringify(String(value))}; s.dispatchEvent(new Event('change')); })()`);
  await sleep(60);
}

async function levelTable(page) {
  return page.eval(`[...document.querySelectorAll('#level-table tbody tr')].map((tr) => ({
    level: Number(tr.dataset.level), cells: [...tr.querySelectorAll('td')].map((td) => td.textContent),
  }))`);
}

async function testDetail(page, vp) {
  const tag = `[${vp.label}]`;
  // Aus der Liste öffnen, zurück zur gemerkten Stelle.
  await page.goto(url('index.html', '#rangliste=raid-psychic'));
  await page.click('a.poke-tile[data-pokemon="mewtwo"]');
  let s = await detailState(page);
  check(s.title === 'Mewtu' && s.tab === 'tab-bewertung', `${tag} Mewtu öffnen: ${s.title}`);
  check(s.overflow <= 0, `${tag} Mewtu läuft seitlich über (${s.overflow}px)`);
  check(/100\s*%/.test(s.ivTotal), `${tag} IV-Anzeige 100 %: ${s.ivTotal}`);

  // Werte & Kosten: WP und KP auf jedem Level unabhängig nachgerechnet, Kosten ab Level 20.
  const mewtwo = byKey.get('mewtwo');
  await page.click('#tab-werte');
  let rows = await levelTable(page);
  const full = { atk: 15, def: 15, sta: 15 };
  check(rows.length === 50, `${tag} Level-Tabelle: ${rows.length} Zeilen statt 50`);
  check(rows.every((r) => num(r.cells[0]) === cpOf(mewtwo, r.level, full) && num(r.cells[3]) === hpOf(mewtwo, r.level, full)), `${tag} Mewtu: WP/KP in der Tabelle falsch`);
  const row50 = rows.find((r) => r.level === 50);
  const c = cost(mewtwo, 20, 50);
  check(num(row50.cells[4]) === c.stardust && num(row50.cells[5]) === c.candy && num(row50.cells[6]) === c.xl, `${tag} Kosten 20→50: ${row50.cells.slice(4).join(' / ')}`);

  // IVs ändern (0/14/13): WP neu, Gesamt-IV und Urteil ändern sich.
  await selectValue(page, '#iv-atk', 0);
  await selectValue(page, '#iv-def', 14);
  await selectValue(page, '#iv-sta', 13);
  rows = await levelTable(page);
  const iv = { atk: 0, def: 14, sta: 13 };
  check(rows.every((r) => num(r.cells[0]) === cpOf(mewtwo, r.level, iv)), `${tag} WP mit IVs 0/14/13 falsch`);
  s = await detailState(page);
  check(/60\s*%/.test(s.ivTotal), `${tag} IV-Anzeige 0/14/13 = 60 %: ${s.ivTotal}`);

  // Halbe Level, Bester Kumpel (+1 Level), Level jetzt.
  await page.click('#opt-half');
  rows = await levelTable(page);
  check(rows.length === 99, `${tag} Halbe Level: ${rows.length} Zeilen statt 99`);
  await page.click('#opt-buddy');
  rows = await levelTable(page);
  check(rows.every((r) => num(r.cells[0]) === cpOf(mewtwo, r.level + 1, iv)), `${tag} Bester Kumpel: WP nicht +1 Level`);
  await page.click('#opt-buddy');
  await selectValue(page, '#level-now', 40);
  rows = await levelTable(page);
  check(num(rows.find((r) => r.level === 50).cells[6]) === cost(mewtwo, 40, 50).xl, `${tag} Kosten ab Level 40`);
  check(rows.find((r) => r.level === 40).cells[4] === 'jetzt', `${tag} aktuelles Level markiert`);

  // WP eingeben: passende WP setzen das Level.
  const cp25 = cpOf(mewtwo, 25, iv);
  await page.type('#cp', String(cp25));
  await page.key('Enter');
  await page.eval(`document.getElementById('cp').dispatchEvent(new Event('change'))`);
  await sleep(80);
  check((await page.eval(`document.getElementById('level-now').value`)) === '25', `${tag} WP ${cp25} → Level 25 erwartet`);
  check(await page.eval(`document.getElementById('cp-feedback')?.classList.contains('cp-feedback--ok')`), `${tag} WP-Rückmeldung`);

  // Glücks-Pokémon: halber Sternenstaub.
  await page.click('#opt-lucky');
  rows = await levelTable(page);
  check(num(rows.find((r) => r.level === 40).cells[4]) === cost(mewtwo, 25, 40, { lucky: true }).stardust, `${tag} Glücks-Pokémon: Sternenstaub nicht halbiert`);

  // Erst WP, dann IVs: Das Level wird mit den neuen IVs neu gesucht; die Statuszeile meldet es Screenreadern.
  const cp30 = cpOf(mewtwo, 30, full);
  await page.type('#cp', String(cp30));
  await page.eval(`document.getElementById('cp').dispatchEvent(new Event('change'))`);
  await sleep(80);
  await page.click('#preset-full');
  const synced = await page.eval(`({ level: document.getElementById('level-now').value, ok: document.getElementById('cp-feedback')?.classList.contains('cp-feedback--ok'), status: document.getElementById('mine-status').textContent })`);
  check(synced.level === '30' && synced.ok, `${tag} WP ${cp30}, dann 15/15/15 → Level 30 erwartet: ${JSON.stringify(synced)}`);
  check(/passen zu Level 30/.test(synced.status) && /Mit deinen IVs: \S/.test(synced.status), `${tag} Statuszeile: ${synced.status}`);

  // Reiter per Tastatur, Attacken-Tabelle.
  await page.click('#tab-werte');
  await page.key('ArrowRight');
  s = await detailState(page);
  check(s.tab === 'tab-attacken' && await page.eval(`document.querySelectorAll('#charged-table tbody tr').length`) === mewtwo.charged.length + mewtwo.eliteCharged.length, `${tag} Reiter Attacken`);

  // Zurück zur Liste: Suche bleibt, Fokus auf der Kachel.
  await page.click('#back');
  await sleep(150);
  const back = await page.eval(`({ hidden: document.getElementById('view-list').hidden, focus: document.activeElement?.dataset?.pokemon ?? null })`);
  check(!back.hidden && back.focus === 'mewtwo', `${tag} Zurück: Fokus ${back.focus}`);

  // Mamutel: Angriff 0 ist für Raids zu schwach, Vorlage "Glücks-Minimum" setzt 12/12/12.
  await page.goto(url('index.html', '#pokemon=mamoswine'));
  await selectValue(page, '#iv-atk', 0);
  s = await detailState(page);
  check(/Angriff ist zu niedrig/.test(s.my), `${tag} Mamutel 0/15/15: ${s.my}`);
  await page.click('#preset-lucky');
  s = await detailState(page);
  check(/12\/12\/12/.test(s.ivTotal) && /80\s*%/.test(s.ivTotal) && !/zu niedrig/.test(s.my), `${tag} Glücks-Minimum: ${s.ivTotal} · ${s.my}`);
  // Crypto aus: Platz ohne Crypto.
  await page.click('#crypto-toggle');
  const rankNS = byKey.get('mamoswine').rating.raid.find((r) => r.type === 'ICE').rankNS;
  check((await page.eval(`document.querySelector('#raid-rows li[data-type="ICE"] .rank-link').textContent`)) === `Platz ${rankNS} von ${byKey.get('mamoswine').rating.raid[0].ofNS} ohne Crypto`, `${tag} Mamutel ohne Crypto: Platz`);
  await page.click('#crypto-toggle');

  // Mega-Starmie: Super-Max-Level, Zusatz-Attacke, Werte 2 Level höher.
  await page.goto(url('index.html', '#pokemon=starmie-mega'));
  const levels = await page.eval(`document.querySelectorAll('#mega-level input').length`);
  check(levels === 4, `${tag} Mega-Starmie: ${levels} Mega-Level statt 4`);
  check(await page.eval(`document.querySelectorAll('#mega-table tbody tr').length`) === 4, `${tag} Mega-Tabelle`);
  await page.click('#tab-werte');
  rows = await levelTable(page);
  const mega = byKey.get('starmie-mega');
  check(num(rows.find((r) => r.level === 50).cells[0]) === cpOf(mega, 52, full), `${tag} Mega-Starmie Super-Max: WP von Level 52 erwartet`);
  await page.click('input[name="mega-level"][value="1"]');
  rows = await levelTable(page);
  check(num(rows.find((r) => r.level === 50).cells[0]) === cpOf(mega, 50, full), `${tag} Mega-Starmie Basis-Level: WP von Level 50 erwartet`);

  // Crypto: 20 % teurer, kein Glücks-Pokémon.
  await page.goto(url('index.html', '#pokemon=crypto-mamoswine'));
  check(await page.eval(`document.getElementById('opt-lucky').disabled`), `${tag} Crypto: Glücks-Schalter muss gesperrt sein`);
  await page.click('#tab-werte');
  rows = await levelTable(page);
  const shadow = byKey.get('crypto-mamoswine');
  check(num(rows.find((r) => r.level === 50).cells[6]) === cost(shadow, 20, 50).xl, `${tag} Crypto: XL-Kosten`);

  // Mega einer Form mit Crypto-Version: "Erlöst" gilt auch hier (Power-ups gehen an die normale Form).
  await page.goto(url('index.html', '#pokemon=charizard-mega-x'));
  check(await page.eval(`Boolean(document.getElementById('opt-purified'))`), `${tag} Mega-Glurak X: Schalter "Erlöst" fehlt`);

  // Rayquaza: Zenitstürmer nur per Meteorit, die anderen Spezial-Attacken per Top-TM.
  await page.goto(url('index.html', '#pokemon=rayquaza'));
  await page.click('#tab-attacken');
  const badges = await page.eval(`[...document.querySelectorAll('#charged-table .badge--elite')].map((b) => b.closest('tr').querySelector('.move__name').textContent + ':' + b.textContent)`);
  check(badges.includes('Zenitstürmer:Meteorit') && badges.some((b) => b.endsWith(':Top-TM')) && !badges.includes('Zenitstürmer:Top-TM'), `${tag} Rayquaza-Marken: ${badges.join(', ')}`);

  // Vorstufe: Hinweis "Entwickeln" mit Link auf die Entwicklung.
  await page.goto(url('index.html', '#pokemon=charmander'));
  s = await detailState(page);
  check(/verdict--evolve/.test(s.verdict), `${tag} Glumanda: "Entwickeln" erwartet`);
  // Rangliste aus der Raid-Karte.
  await page.goto(url('index.html', '#pokemon=reshiram'));
  await page.click('#raid-rows a.rank-link');
  const ranking = await listState(page);
  check(ranking.tiles[0]?.key === DATA.raidTables.FIRE.normal[0], `${tag} Rangliste Feuer aus der Raid-Karte`);
}

// Zurück zeigt die Liste so, wie sie war: Suche und Filter gehören zum Verlaufseintrag. Eine Rangliste aus der
// Pokémon-Seite zeigt dagegen alle Plätze (ohne die Suche).
async function testHistory(page, vp) {
  const tag = `[${vp.label}]`;
  const search = () => page.eval(`document.getElementById('search').value`);
  // Alter gemerkter Stand (Version mit "Max-Kämpfe"): fällt auf "Urteil" zurück, ohne Fehler.
  await page.goto(url('index.html'));
  await page.eval(`history.replaceState({ overview: { query: '', grade: 'all', group: 'all', use: 'max', type: '', sort: 'best', shown: 48 } }, '')`);
  await page.eval(`location.hash = '#typ=fire'`);
  await sleep(100);
  await page.eval('history.back()');
  await sleep(150);
  check((await page.eval(`document.querySelector('#filter-use button[aria-pressed="true"]')?.dataset.value`)) === 'all'
    && (await page.eval(`document.querySelector('.view-tabs__link[aria-current="page"]')?.dataset.view`)) === 'all', `${tag} Alter Stand "max": Liste "Urteil" erwartet`);
  // Neue Liste über "Alle Treffer", zurück und wieder vor: die Suche bleibt.
  await page.click('.view-tabs__link[data-view="type"]');
  await page.type('#search', 'pika');
  await page.key('Enter');
  await sleep(150);
  check((await search()) === 'pika' && (await page.eval('location.hash')) === '', `${tag} Alle Treffer: Liste mit Suche "pika"`);
  for (const step of ['back', 'back', 'forward', 'forward']) {
    await page.eval(`history.${step}()`);
    await sleep(150);
  }
  const pika = await listState(page);
  check((await search()) === 'pika' && pika.tiles.length && pika.tiles.every((t) => /Pikachu/i.test(byKey.get(t.key).name + byKey.get(t.key).nameEn)), `${tag} Vor zur Trefferliste: Suche "${await search()}"`);
  // Ranglisten-Adresse auf einer Pokémon-Seite eingetippt: zeigt die Rangliste.
  await page.goto(url('index.html', '#pokemon=charizard'));
  await page.eval(`location.hash = '#rangliste=raid-water'`);
  await sleep(150);
  const water = await listState(page);
  check(water.tiles[0]?.key === DATA.raidTables.WATER.normal[0] && water.tiles[0]?.rank === 1, `${tag} Eingetippte Rangliste aus der Pokémon-Seite: ${water.tiles[0]?.key}`);

  await page.goto(url('index.html'));
  await page.type('#search', 'glurak');
  await page.key('Escape');
  await page.click('a.poke-tile[data-pokemon="charizard"]');
  await sleep(120);
  await page.click('#raid-rows a.rank-link');
  await sleep(120);
  let s = await listState(page);
  check((await search()) === '' && s.tiles.length === 48 && s.tiles.every((t, i) => t.rank === i + 1), `${tag} Rangliste aus der Pokémon-Seite: ohne Suche, Plätze 1–48 erwartet`);
  await page.eval('history.back()');
  await sleep(150);
  check((await page.eval(`document.getElementById('detail-title')?.textContent`)) === 'Glurak', `${tag} Zurück: Glurak erwartet`);
  await page.eval('history.back()');
  await sleep(150);
  s = await listState(page);
  const query = await search();
  check(query === 'glurak' && s.tiles.length > 1 && s.tiles.every((t) => /Glurak/.test(byKey.get(t.key).name) && t.rank === null),
    `${tag} Zurück: Liste mit Suche "glurak" erwartet (Suche "${query}", ${s.tiles.length} Kacheln: ${s.tiles.slice(0, 4).map((t) => t.key).join(', ')})`);
  check((await page.eval('document.activeElement?.dataset?.pokemon ?? null')) === 'charizard', `${tag} Zurück: Fokus auf Glurak`);
  // Vor bis zur Rangliste: wieder die ganze Feuer-Rangliste (jeder Eintrag merkt sich seinen eigenen Stand).
  await page.eval('history.forward()');
  await sleep(150);
  await page.eval('history.forward()');
  await sleep(150);
  s = await listState(page);
  check((await page.eval('location.hash')) === '#rangliste=raid-fire' && (await search()) === '' && s.tiles[0]?.key === DATA.raidTables.FIRE.normal[0] && s.tiles[0]?.rank === 1,
    `${tag} Vor zur Rangliste: Feuer-Rangliste erwartet (${s.tiles.slice(0, 3).map((t) => t.key).join(', ')})`);
  // Neue Suche, dann Vor und Zurück: die neue Suche bleibt.
  await page.eval('history.back()');
  await sleep(150);
  await page.eval('history.back()');
  await sleep(150);
  await page.type('#search', 'pikachu');
  await page.key('Escape');
  await page.eval('history.forward()');
  await sleep(150);
  await page.eval('history.back()');
  await sleep(150);
  check((await search()) === 'pikachu', `${tag} Zurück nach neuer Suche: "${await search()}" statt "pikachu"`);
}

// ---------- Vergleich ----------

const compareState = (page) => page.eval(`({
  hash: location.hash,
  title: document.getElementById('compare-verdict-title')?.textContent ?? null,
  lead: document.querySelector('.compare-verdict__lead')?.textContent ?? null,
  names: [0, 1].map((i) => document.getElementById('c' + i + '-pick')?.value ?? null),
  type: document.getElementById('compare-type')?.value ?? null,
  cells: Object.fromEntries([...document.querySelectorAll('.compare-table tbody tr')].map((tr) => [
    tr.querySelector('th').textContent,
    [...tr.querySelectorAll('td')].map((td) => ({ text: td.textContent.replace('✓ ', '').replace('besser: ', '').trim(), better: td.classList.contains('is-better') })),
  ])),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
})`);
async function setNumber(page, selector, value) {
  await page.eval(`(() => { const i = document.querySelector(${JSON.stringify(selector)}); i.value = ${JSON.stringify(String(value))}; i.dispatchEvent(new Event('change')); })()`);
  await sleep(60);
}
// "270’000 Sternenstaub · 312 Bonbons · 360 Bonbons XL" → { stardust, candy, xl }
function costCell(text) {
  const out = { stardust: 0, candy: 0, xl: 0 };
  for (const part of text.split(' · ')) {
    const n = num(part.split(' ')[0]);
    if (part.endsWith('Sternenstaub')) out.stardust = n;
    else if (part.endsWith('XL')) out.xl = n;
    else out.candy = n;
  }
  return out;
}
const sameCost = (a, b) => a.stardust === b.stardust && a.candy === b.candy && a.xl === b.xl;

async function testCompare(page, vp) {
  const tag = `[${vp.label}]`;
  // Beispiel: Crypto-Mewtu 13/12/13 gegen Mewtu 15/15/14, beide auf Level 20.
  await page.goto(url('index.html', '#vergleich=crypto-mewtwo:13-12-13:20,mewtwo:15-15-14:20'));
  let s = await compareState(page);
  const shadow = byKey.get('crypto-mewtwo');
  const mewtwo = byKey.get('mewtwo');
  const ivA = { atk: 13, def: 12, sta: 13 };
  const ivB = { atk: 15, def: 15, sta: 14 };
  check(s.names.join() === 'Crypto-Mewtu,Mewtu' && s.type === 'PSYCHIC', `${tag} Vergleich aus der Adresse: ${s.names.join()} / ${s.type}`);
  check(s.title === 'Lohnt sich mehr: Crypto-Mewtu (84 %)', `${tag} Vergleich: Crypto-Mewtu 84 % sollte vorne liegen (${s.title})`);
  check(s.overflow <= 0, `${tag} Vergleich läuft seitlich über (${s.overflow}px)`);
  // WP, Angriff und Kosten unabhängig nachgerechnet.
  check(num(s.cells['WP auf Level 40'][0].text) === cpOf(shadow, 40, ivA) && num(s.cells['WP auf Level 50'][1].text) === cpOf(mewtwo, 50, ivB)
    && s.cells['Level jetzt'][0].text === `Level 20 (aus ${cpOf(shadow, 20, ivA).toLocaleString('de-CH')} WP)`, `${tag} Vergleich: WP falsch (${s.cells['Level jetzt'][0].text})`);
  const atkA = (shadow.base.atk + 13) * cpm(40) * DATA.rules.shadowAttack;
  const atkB = (mewtwo.base.atk + 15) * cpm(40);
  check(Math.abs(num(s.cells['Angriff im Kampf (Level 40)'][0].text) - atkA) < 0.051 && Math.abs(num(s.cells['Angriff im Kampf (Level 40)'][1].text) - atkB) < 0.051
    && s.cells['Angriff im Kampf (Level 40)'][0].better, `${tag} Vergleich: Angriff im Kampf (Crypto ×1.2)`);
  check(sameCost(costCell(s.cells['Kosten bis Level 40'][0].text), cost(shadow, 20, 40)) && sameCost(costCell(s.cells['Kosten bis Level 50'][1].text), cost(mewtwo, 20, 50))
    && s.cells['Kosten bis Level 40'][1].better, `${tag} Vergleich: Kosten falsch (${s.cells['Kosten bis Level 40'].map((c) => c.text).join(' | ')})`);
  // Markierungen passen zu den Zahlen.
  for (const rowName of ['DPS (Level 40)', 'TDO (Level 50)', 'WP auf Level 40']) {
    const [x, y] = s.cells[rowName].map((c) => num(c.text));
    const marked = s.cells[rowName].findIndex((c) => c.better);
    check(marked === (x > y ? 0 : 1), `${tag} Vergleich: "besser" bei ${rowName} falsch`);
  }

  // WP statt Level: aus der Adresse stehen die WP im Feld.
  check((await page.eval(`document.getElementById('c0-cp').value`)) === String(cpOf(shadow, 20, ivA)), `${tag} Vergleich: WP-Feld aus der Adresse`);
  check(!(await page.eval(`document.querySelector('#c0-fast, #c0-charged, #c1-fast, #c1-charged, #c0-level, #c1-level')`)), `${tag} Vergleich: keine Attacken- oder Level-Auswahl mehr`);
  // WP eingeben: das Level folgt (Adresse, Rückmeldung, Kosten).
  const cp30 = cpOf(mewtwo, 30, ivB);
  await setNumber(page, '#c1-cp', cp30);
  s = await compareState(page);
  check(s.hash === '#vergleich=crypto-mewtwo:13-12-13:20,mewtwo:15-15-14:30' && /= Level 30$/.test(await page.eval(`document.getElementById('c1-cp-feedback').textContent`))
    && sameCost(costCell(s.cells['Kosten bis Level 40'][1].text), cost(mewtwo, 30, 40)), `${tag} Vergleich: WP ${cp30} → Level 30 (${s.hash})`);
  // IVs ändern: dieselben WP, das Level wird neu gesucht.
  const iv10 = { ...ivB, atk: 10 };
  let level10 = null;
  for (let l = 1; l <= DATA.rules.maxLevel && level10 === null; l += 0.5) if (cpOf(mewtwo, l, iv10) === cp30) level10 = l;
  await selectValue(page, '#c1-iv-atk', 10);
  s = await compareState(page);
  check(s.hash === `#vergleich=crypto-mewtwo:13-12-13:20,mewtwo:10-15-14${level10 === null ? '' : `:${level10}`}` && num(s.cells['WP auf Level 40'][1].text) === cpOf(mewtwo, 40, iv10)
    && (await page.eval(`document.getElementById('c1-cp').value`)) === String(cp30), `${tag} Vergleich: IVs ändern → ${s.hash} (erwartet Level ${level10})`);

  // Anderes Pokémon über das Suchfeld (Tastatur): gemeinsamer Angriffstyp Eis.
  await page.type('#c1-pick', 'mamu');
  await page.key('ArrowDown');
  await page.key('Enter');
  await sleep(120);
  s = await compareState(page);
  check(s.names[1] === 'Mamutel' && s.hash.endsWith(',mamoswine:10-15-14') && s.type === 'ICE', `${tag} Vergleich: Mamutel wählen → ${s.names[1]}, ${s.hash}, ${s.type}`);
  // Ohne WP: Level 20 angenommen, gut sichtbar.
  check(/Level 20/.test(await page.eval(`document.getElementById('c1-cp-feedback').textContent`)) && /ab Level 20/.test(s.cells['Kosten bis Level 40'][1].text)
    && sameCost(costCell(s.cells['Kosten bis Level 40'][1].text.replace(/ \(ab Level 20\)$/, '')), cost(byKey.get('mamoswine'), 20, 40)), `${tag} Vergleich: ohne WP Level 20`);
  check((await page.eval(`document.activeElement?.id`)) === 'c1-pick', `${tag} Vergleich: Fokus bleibt im Suchfeld`);
  // Typ, den nur eines kann.
  await selectValue(page, '#compare-type', 'PSYCHIC');
  s = await compareState(page);
  check(s.type === 'PSYCHIC' && /nur Crypto-Mewtu/.test(s.lead ?? '') && s.title === 'Lohnt sich mehr: Crypto-Mewtu (84 %)', `${tag} Vergleich: Psycho nur Crypto-Mewtu (${s.lead})`);
  // Tauschen.
  await page.click('#compare-swap');
  s = await compareState(page);
  check(s.names.join() === 'Mamutel,Crypto-Mewtu' && s.hash === '#vergleich=mamoswine:10-15-14,crypto-mewtwo:13-12-13:20', `${tag} Vergleich: Tauschen → ${s.hash}`);
  // Alte Adresse mit Attacken dahinter: geht noch, die Attacken fallen weg (immer die besten).
  await page.goto(url('index.html', '#vergleich=crypto-mewtwo:13-12-13:20:::ICE_BEAM,mewtwo:15-15-14:20'));
  s = await compareState(page);
  check(s.hash === '#vergleich=crypto-mewtwo:13-12-13:20,mewtwo:15-15-14:20' && s.type === 'PSYCHIC', `${tag} Vergleich: alte Adresse mit Attacke → ${s.hash}`);

  // Mega auf Super-Max-Level: WP 2 Level höher, Kosten ab Level 40 bis 40 schon erreicht.
  await page.goto(url('index.html', '#vergleich=mewtwo-mega-y:15-15-15:40:m4,mewtwo:15-15-15:40'));
  s = await compareState(page);
  const full = { atk: 15, def: 15, sta: 15 };
  check(num(s.cells['WP auf Level 40'][0].text.split(' ')[0]) === cpOf(byKey.get('mewtwo-mega-y'), 42, full) && /\(wie Level 42\)/.test(s.cells['WP auf Level 40'][0].text)
    && s.cells['Kosten bis Level 40'][0].text === 'schon erreicht'
    && sameCost(costCell(s.cells['Kosten bis Level 50'][0].text), cost(mewtwo, 40, 50)), `${tag} Vergleich: Mega-Mewtu Y Super-Max`);
  check(await page.eval(`document.querySelector('input[name="c0-mega-level"][value="4"]')?.checked`), `${tag} Vergleich: Mega-Level 4 gewählt`);
  // Bei einer Mega gelten die WP der normalen Form.
  check((await page.eval(`document.getElementById('c0-cp').value`)) === String(cpOf(mewtwo, 40, full))
    && /normale Form/.test(await page.eval(`document.querySelector('#c0-slot .compare-cp .control-label')?.textContent ?? ''`)), `${tag} Vergleich: WP der Mega = WP der normalen Form`);

  // Leer: Beispiel per Knopf.
  await page.goto(url('index.html', '#vergleich'));
  check(await page.eval(`document.querySelector('.view-tabs__link[data-view="compare"]').getAttribute('aria-current')`) === 'page', `${tag} Reiter Vergleich`);
  await page.click('#compare-example');
  s = await compareState(page);
  check(s.names.join() === 'Crypto-Mewtu,Mewtu' && s.hash === '#vergleich=crypto-mewtwo:13-12-13:20,mewtwo:15-15-14:20', `${tag} Vergleich: Beispiel-Knopf → ${s.hash}`);

  // Von der Pokémon-Seite: mit den eigenen IVs, daneben die normale Form; zu einem Pokémon und zurück.
  await page.goto(url('index.html', '#pokemon=crypto-mewtwo'));
  await selectValue(page, '#iv-atk', 12);
  await page.click('#compare-link');
  await sleep(120);
  s = await compareState(page);
  check(s.hash === '#vergleich=crypto-mewtwo:12-15-15:20,mewtwo:15-15-15:20' && s.names.join() === 'Crypto-Mewtu,Mewtu', `${tag} Vergleich von der Pokémon-Seite: ${s.hash}`);
  await setNumber(page, '#c1-cp', cpOf(mewtwo, 30, full));
  await page.click('a.compare-slot__head[data-pokemon="mewtwo"]');
  await sleep(120);
  check((await page.eval(`document.getElementById('detail-title')?.textContent`)) === 'Mewtu' && (await page.eval(`document.getElementById('back').textContent`)) === '← Zum Vergleich', `${tag} Vergleich → Pokémon-Seite`);
  await page.click('#back');
  await sleep(150);
  s = await compareState(page);
  check(s.hash === '#vergleich=crypto-mewtwo:12-15-15:20,mewtwo:15-15-15:30' && s.names.join() === 'Crypto-Mewtu,Mewtu', `${tag} Zurück zum Vergleich: ${s.hash}`);
  check((await page.eval('document.activeElement?.dataset?.pokemon ?? null')) === 'mewtwo', `${tag} Zurück zum Vergleich: Fokus auf Mewtu`);
  // Crypto aus: Platz des normalen Mewtu ohne Crypto, Crypto-Mewtu behält seinen Platz mit Crypto.
  await page.click('#crypto-toggle');
  s = await compareState(page);
  const stand = s.cells['Stufe mit diesen IVs (Level 40)'].map((c) => c.text);
  check(!/ohne Crypto/.test(stand[0]) && /ohne Crypto/.test(stand[1]), `${tag} Vergleich ohne Crypto: ${stand.join(' | ')}`);
  await page.click('#crypto-toggle');
  check(s.overflow <= 0, `${tag} Vergleich läuft seitlich über`);
}

// Jede Pokémon-Seite (bzw. jede n-te) mit allen drei Reitern: keine Fehler, kein Überlauf.
async function testAllPages(page, vp) {
  await page.goto(url('index.html'));
  const result = await page.eval(`(() => {
    const keys = window.POWER_DATA.pokemon.map((p) => p.key).filter((_, i) => i % ${vp.every} === 0);
    const errors = [];
    const target = document.getElementById('view-detail');
    document.getElementById('view-list').hidden = true;
    target.hidden = false;
    let overflow = [];
    for (const key of keys) {
      try {
        Detail.render(key, target);
        for (const tab of ['werte', 'attacken', 'bewertung']) {
          target.querySelector('#tab-' + tab).click();
          if (document.documentElement.scrollWidth > document.documentElement.clientWidth) overflow.push(key + ':' + tab);
        }
        if (!target.querySelector('#findings') || !target.querySelector('#detail-title').textContent) errors.push(key + ': leer');
        // Nichts ragt aus seinem Feld (IV-Felder, verwandte Formen) – auch auf schmalen Handys.
        const box = (n) => n.getBoundingClientRect();
        if ([...target.querySelectorAll('.iv > *, .related__list li')].some((n) => box(n).right > box(n.parentElement).right + 1)) overflow.push(key + ':eng');
        // Keine Lücken im Text ("null", "undefined", "NaN").
        if (/\bnull\b|undefined|NaN/.test(target.textContent)) errors.push(key + ': null/undefined im Text');
        // Keine Max-Kämpfe auf der Pokémon-Seite (die stehen im Dyna-Kompass).
        // ("Dynamax-Kanone" ist eine normale Attacke von Endynalos.)
        if (/Max-Kampf|Max-Kämpf|Dynamax(?!-Kanone)/.test(target.textContent)) errors.push(key + ': Max-Kämpfe');
        // Crypto-Pokémon lassen sich nicht tauschen.
        if (Power.pokemon(key).shadow && /Tausch/.test(target.querySelector('#verdict-summary').textContent)) errors.push(key + ': Tausch bei Crypto');
      } catch (err) { errors.push(key + ': ' + err.message); }
    }
    // Dasselbe ohne Crypto (jede zehnte Seite und jede Crypto-Seite).
    Power.setCrypto(false);
    for (const key of keys.filter((k, i) => i % 10 === 0 || Power.pokemon(k).shadow)) {
      try {
        Detail.render(key, target);
        if (/\bnull\b|undefined|NaN/.test(target.textContent)) errors.push(key + ' (ohne Crypto): null/undefined im Text');
      } catch (err) { errors.push(key + ' (ohne Crypto): ' + err.message); }
    }
    Power.setCrypto(true);
    return { count: keys.length, errors: errors.slice(0, 20), overflow: overflow.slice(0, 20) };
  })()`);
  check(!result.errors.length, `[${vp.label}] Fehler auf Pokémon-Seiten: ${result.errors.join('; ')}`);
  check(!result.overflow.length, `[${vp.label}] Seitlicher Überlauf: ${result.overflow.join(', ')}`);
  console.log(`  ${vp.label}: ${result.count} Pokémon-Seiten gerendert`);
}

async function testLegal(page, vp) {
  await page.goto(url('datenschutz.html'));
  const info = await page.eval(`({ h1: document.querySelector('h1').textContent, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
  check(info.h1 === 'Datenschutz' && info.overflow <= 0, `[${vp.label}] Datenschutz-Seite: ${JSON.stringify(info)}`);
}

if (BASE) console.log(`Teste veröffentlichte Seite: ${BASE}`);
testCalc();
for (const vp of VIEWPORTS) {
  const page = await launchBrowser(vp);
  try {
    await testStart(page, vp);
    await testBrowse(page, vp);
    await testDetail(page, vp);
    await testHistory(page, vp);
    await testCompare(page, vp);
    await testAllPages(page, vp);
    await testLegal(page, vp);
  } catch (err) {
    failures.push(`[${vp.label}] Abbruch: ${err.stack ?? err.message}`);
  }
  for (const e of page.errors) failures.push(`[${vp.label}] Browser-Fehler: ${e}`);
  await page.close();
}

console.log(`\n${passed} Prüfungen bestanden, ${failures.length} fehlgeschlagen.`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
