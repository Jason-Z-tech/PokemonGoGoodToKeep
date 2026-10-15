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
  for (const [query, expect] of [['mamutel', 'mamoswine'], ['Mamoswine', 'crypto-mamoswine'], ['445', 'garchomp'], ['mega gengar', 'gengar-mega']]) {
    await page.type('#search', query);
    s = await listState(page);
    check(s.tiles.some((t) => t.key === expect), `${tag} Suche "${query}" findet ${expect} nicht`);
    const suggest = await page.eval(`[...document.querySelectorAll('#search-suggest [data-pokemon]')].map((o) => o.dataset.pokemon)`);
    check(suggest.includes(expect), `${tag} Vorschläge zu "${query}" ohne ${expect}: ${suggest.join(', ')}`);
  }
  await page.key('Escape');
  check(await page.eval(`document.getElementById('search-suggest').hidden`), `${tag} Escape schließt die Vorschläge`);
  await page.click('#search-clear');
  s = await listState(page);
  check(s.tiles.length === 48 && (await page.eval('document.getElementById("search").value')) === '', `${tag} Suche leeren`);

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
  await page.click('#filter-grade button[data-value="all"]');

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
  await page.click('.sub-tabs__link[data-top="max"]');
  check(await page.eval(`document.querySelectorAll('#top-cards .type-card').length`) === 18, `${tag} Top-Rankings Max-Kämpfe`);
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
      } catch (err) { errors.push(key + ': ' + err.message); }
    }
    // Dasselbe ohne Crypto (jede zehnte Seite).
    Power.setCrypto(false);
    for (const key of keys.filter((_, i) => i % 10 === 0)) {
      try { Detail.render(key, target); } catch (err) { errors.push(key + ' (ohne Crypto): ' + err.message); }
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
  check(info.h1 === 'Datenschutz' && info.overflow <= 0, `[${vp.label}] Datenschutz-Seite`);
}

if (BASE) console.log(`Teste veröffentlichte Seite: ${BASE}`);
testCalc();
for (const vp of VIEWPORTS) {
  const page = await launchBrowser(vp);
  try {
    await testStart(page, vp);
    await testBrowse(page, vp);
    await testDetail(page, vp);
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
