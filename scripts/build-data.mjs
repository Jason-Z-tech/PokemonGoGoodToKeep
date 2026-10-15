// Baut data/pokemon-data.js aus den Spieldaten (Game Master), den offiziellen deutschen Spieltexten,
// den Release-Angaben von PvPoke, den Dynamax-Daten des Dyna-Kompass und den Artworks von PokeAPI.
// Nur Node-Bordmittel (ab Node 22) und Chrome/Edge für die Bilder.
// Aufruf: node scripts/build-data.mjs [--refresh] [--no-images] [--report]
//   --refresh    alle Quellen neu herunterladen (sonst Zwischenspeicher in scripts/.cache/)
//   --no-images  Plan B: ohne offizielle Artworks bauen und assets/img/ entfernen
//   --report     Ranglisten und Bewertungen zur Kontrolle ausgeben

import { mkdir, readFile, writeFile, access, rm, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertToWebp } from './images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
const IMG_RAW_DIR = path.join(CACHE_DIR, 'img');
const IMG_DIR = path.join(ROOT, 'assets', 'img');
const OUT_FILE = path.join(ROOT, 'data', 'pokemon-data.js');
const REFRESH = process.argv.includes('--refresh');
const NO_IMAGES = process.argv.includes('--no-images');
const REPORT = process.argv.includes('--report');
// Nur zum Entwickeln: Bilder-Schritt überspringen (assets/img/ bleibt unverändert, die Daten verweisen auf kein Bild).
const SKIP_IMAGES = process.argv.includes('--skip-images');

const RAW = 'https://raw.githubusercontent.com';
const PVPOKE = `${RAW}/pvpoke/pvpoke/master/src/data`;
const SOURCES = {
  gameMaster: `${RAW}/PokeMiners/game_masters/master/latest/latest.json`,
  gameMasterTime: `${RAW}/PokeMiners/game_masters/master/latest/timestamp.txt`,
  pvpoke: `${PVPOKE}/gamemaster.json`,
  textsDe: `${RAW}/sora10pls/holoholo-text/main/Release/German/de-de_raw.json`,
  textsEn: `${RAW}/sora10pls/holoholo-text/main/Release/English/en-us_raw.json`,
  dyna: `${RAW}/Jason-Z-tech/dyna-kompass/main/data/pokemon-data.js`,
  pokeapiPokemon: `${RAW}/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv`,
  artwork: (id) => `${RAW}/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
};

const PowerCalc = createRequire(import.meta.url)(path.join(ROOT, 'js', 'calc.js'));

// ---------- Regeln ----------

// Gegner für die Raid-Ranglisten: typischer 5-Sterne-Boss (Verteidigung 200, Boss-Multiplikator wie in Raids),
// schwach gegen den Angriffstyp. Eingehender Schaden nach GamePress: y = 900 / Verteidigung.
const PVE = { level: 40, targetDefense: 200, targetCpm: 0.79030001, incoming: 900 };

// Bewertungs-Stufen: 3 = Spitze, 2 = Gut, 1 = Nische, 0 = lohnt sich nicht.
// Raids: Wertung im Vergleich zum 5.-besten Angreifer des Typs ohne Mega – einmal mit Crypto-Pokémon, einmal ohne
// (für den Schalter "Crypto-Pokémon" auf der Seite).
const RAID_GRADES = [1.0, 0.9, 0.8];
// Mega-Entwicklungen: im Vergleich zur besten Mega des Typs.
const MEGA_GRADES = [0.95, 0.85, 0.75];
// Max-Kämpfe: Max-Schaden im Vergleich zum besten Dynamax-Pokémon des Typs.
const MAX_GRADES = [0.92, 0.82, 0.72];

const TYPES = {
  NORMAL: 'Normal', FIRE: 'Feuer', WATER: 'Wasser', GRASS: 'Pflanze', ELECTRIC: 'Elektro',
  ICE: 'Eis', FIGHTING: 'Kampf', POISON: 'Gift', GROUND: 'Boden', FLYING: 'Flug',
  PSYCHIC: 'Psycho', BUG: 'Käfer', ROCK: 'Gestein', GHOST: 'Geist', DRAGON: 'Drache',
  DARK: 'Unlicht', STEEL: 'Stahl', FAIRY: 'Fee',
};

// Reihenfolge der Verteidiger-Typen in "attackScalar" (interne Typ-Nummerierung des Spiels).
const SCALAR_ORDER = ['NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'STEEL',
  'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'PSYCHIC', 'ICE', 'DRAGON', 'DARK', 'FAIRY'];

const WEATHER = [
  { id: 'CLEAR', text: 'weather_sunny' },
  { id: 'RAINY', text: 'weather_rainy' },
  { id: 'PARTLY_CLOUDY', text: 'weather_partly_cloudy' },
  { id: 'OVERCAST', text: 'weather_overcast' },
  { id: 'WINDY', text: 'weather_windy' },
  { id: 'SNOW', text: 'weather_snow' },
  { id: 'FOG', text: 'weather_fog' },
];

// Attacken, die nur Platzhalter sind oder nur nach Erlösen/als Crypto kommen (Frustration, Rückkehr).
const SKIPPED_MOVES = new Set(['FRUSTRATION', 'RETURN', 'STRUGGLE', 'TRANSFORM_FAST', 'SPLASH_FAST']);

// Attacken mit zufälligem Typ: in Raids nicht planbar.
const RANDOM_TYPE_MOVES = new Set(['HIDDEN_POWER_FAST']);

// Deutsche Namen, die sich nicht aus den Spieltexten ableiten lassen.
const NAME_FIXES = { MEWTWO_A: 'Mewtu (Rüstung)' };

// Formen, deren PokeAPI-Bild anders heißt als die Spiel-ID.
const POKEAPI_FORM_SLUGS = {
  NECROZMA_DUSK_MANE: 'necrozma-dusk', NECROZMA_DAWN_WINGS: 'necrozma-dawn',
  ZACIAN_HERO: 'zacian', ZAMAZENTA_HERO: 'zamazenta',
  ZACIAN_CROWNED_SWORD: 'zacian-crowned', ZAMAZENTA_CROWNED_SHIELD: 'zamazenta-crowned',
  KYUREM_NORMAL: 'kyurem', DIALGA_NORMAL: 'dialga', PALKIA_NORMAL: 'palkia',
  ZYGARDE_COMPLETE_TEN_PERCENT: 'zygarde-10', ZYGARDE_COMPLETE_FIFTY_PERCENT: 'zygarde-50', ORICORIO_POMPOM: 'oricorio-pom-pom',
};
const NO_POKEAPI_ART = new Set(['MEWTWO_A']);

// Formen, die es nur im Kampf gibt (kein eigenes Pokémon in der Sammlung).
const BATTLE_ONLY_FORMS = new Set(['MORPEKO_HANGRY', 'AEGISLASH_BLADE', 'DARMANITAN_ZEN', 'DARMANITAN_GALARIAN_ZEN', 'MIMIKYU_BUSTED']);

// Von Hand gepflegte Korrekturen zu PvPoke: Dort sind Pokémon, die im Trainerkampf nicht antreten können
// (Ditto, Ninjatom, Cosmog …), als "nicht erschienen" geführt – im Spiel gibt es sie aber.
// Riffex ist seit dem 16.11.2024 als Dynamax-Pokémon im Spiel.
const RELEASE_FIXES = new Set(['DITTO', 'SHEDINJA', 'SPEWPA', 'COSMOG', 'COSMOEM', 'TOXTRICITY', 'TOXTRICITY_AMPED', 'TOXTRICITY_LOW_KEY']);

// PvPoke kennt neue Attacken oft früher als der Game Master (z. B. Zeitenlärm für Ur-Dialga, Mystoschwert für
// Keldeo, Volttackle für Raichu). Seine Attacken-Listen ergänzen deshalb die Spieldaten. Abweichende Namen:
const PVPOKE_MOVE_ALIASES = { FUTURE_SIGHT: 'FUTURESIGHT', TECHNO_BLAST_DOUSE: 'TECHNO_BLAST_WATER' };
// Einträge, deren PvPoke-Name sich nicht aus dem Schlüssel ableiten lässt (Schlüssel -> PvPoke-IDs).
const PVPOKE_KEY_ALIASES = {
  keldeo: ['keldeo_ordinary', 'keldeo_resolute'], aegislash: ['aegislash_shield'], morpeko: ['morpeko_full_belly'],
  tatsugiri: ['tatsugiri_curly'], 'mewtwo-a': ['mewtwo_armored'], 'zygarde-complete-fifty-percent': ['zygarde'],
  'zygarde-complete-ten-percent': ['zygarde_10'], 'oricorio-pompom': ['oricorio_pom_pom'],
};

// Besonderheiten, die nicht in den Spieldaten stehen: kurze Hinweise auf der Detailseite (Spiel-ID der Art oder Form).
const NOTES = {
  LUGIA: 'Crypto-Lugia gibt es nur als Apex-Form mit der exklusiven Attacke Luftstoß+; erlöst wird daraus Luftstoß++.',
  HO_OH: 'Crypto-Ho-Oh gibt es nur als Apex-Form mit der exklusiven Attacke Läuterfeuer+; erlöst wird daraus Läuterfeuer++.',
  ZYGARDE: 'Die Zygarde-Formen tauschst du mit Zygarde-Zellen (Routen) um – 10 %, 50 % und Optimum haben eigene Werte.',
  SMEARGLE: 'Farbeagle lernt die Attacken, die es auf deinen Schnappschüssen sieht – nicht über TMs.',
  DITTO: 'Ditto verwandelt sich im Kampf in sein Gegenüber und übernimmt dessen Attacken – eine eigene Bewertung gibt es deshalb nicht.',
  SHEDINJA: 'Ninjatom hat die Basis-Ausdauer 1 und damit auf jedem Level nur die Mindest-KP (10–13): Fast jeder Treffer besiegt es. Hochleveln lohnt sich nur für die Sammlung.',
};

// ---------- Hilfsfunktionen ----------

const typeKey = (gmType) => gmType?.replace('POKEMON_TYPE_', '');
const pad = (n, width) => String(n).padStart(width, '0');
const round = (n, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function fetchWithRetry(url, kind, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'power-kompass-builder' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (kind === 'json') return await res.json();
      if (kind === 'text') return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= tries) throw new Error(`Download fehlgeschlagen: ${url} (${err.message})`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// Lädt eine Quelle und legt sie im Zwischenspeicher ab, damit wiederholte Builds schnell sind.
async function cached(name, url, kind = 'json') {
  const file = path.join(CACHE_DIR, name);
  if (await exists(file) && !REFRESH) {
    const text = await readFile(file, 'utf8');
    return kind === 'json' ? JSON.parse(text) : text;
  }
  const data = await fetchWithRetry(url, kind);
  if (data === null) throw new Error(`Quelle nicht gefunden: ${url}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, kind === 'json' ? JSON.stringify(data) : data);
  return data;
}

async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const titleCase = (id) => id.toLowerCase().split(/[_\s-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// Spieltexte liegen als flache Liste [Schlüssel, Text, …] vor. Verweise wie "<<move_name_0383>>+" werden aufgelöst.
function textMap(raw) {
  const map = new Map();
  for (let i = 0; i < raw.data.length; i += 2) map.set(raw.data[i], raw.data[i + 1]);
  const resolve = (text, depth = 0) => (depth > 3 ? text : text.replace(/<<([a-z0-9_]+)>>/g, (all, key) => (map.has(key) ? resolve(map.get(key), depth + 1) : all)));
  for (const [k, v] of map) if (v.includes('<<')) map.set(k, resolve(v));
  return map;
}

// ---------- Game Master ----------

function indexGameMaster(gm) {
  const templates = [];
  const moves = new Map();
  const moveNamesById = new Map();
  const formSettings = new Map();
  const typeScalars = new Map();
  const weather = new Map();
  const signatureMoves = new Map();
  const upgradeOverrides = new Map();
  const megaLevels = new Map(); // "SPECIES|level" bzw. "|level" -> Einstellungen
  const plusMoves = new Map(); // "SPECIES|TEMP_EVOLUTION_MEGA_X" -> { id, settings, combat }
  let cpm = null;
  let battle = null;
  let upgrades = null;
  let lucky = null;
  let primal = null;
  let megaSettings = null;
  for (const { templateId, data } of gm) {
    if (data?.pokemonSettings) {
      const dex = Number(/^V(\d{4})_POKEMON_/.exec(templateId)?.[1]);
      if (dex) templates.push({ dex, settings: data.pokemonSettings });
      const s = data.pokemonSettings;
      for (const fc of s.formChange ?? []) {
        for (const r of fc.moveReassignment?.cinematicMoves ?? []) {
          const elite = (r.existingMoves ?? []).length > 0 && r.existingMoves.every((m) => (s.eliteCinematicMove ?? []).includes(m));
          for (const target of fc.availableForm ?? []) {
            if (!signatureMoves.has(target)) signatureMoves.set(target, []);
            const list = signatureMoves.get(target);
            const key = JSON.stringify([r.replacementMoves, elite]);
            if (!list.some((x) => JSON.stringify([x.moves, x.elite]) === key)) list.push({ moves: r.replacementMoves ?? [], elite });
          }
        }
      }
    } else if (data?.moveSettings && /^V\d{4}_MOVE_/.test(templateId)) {
      const num = Number(templateId.slice(1, 5));
      const name = templateId.replace(/^V\d{4}_MOVE_/, '');
      moves.set(name, { num, settings: data.moveSettings });
      if (typeof data.moveSettings.movementId === 'number') moveNamesById.set(data.moveSettings.movementId, name);
    } else if (data?.moveSettings && /^VM_MOVE_TEMP_EVOLUTION_/.test(templateId)) {
      // Zusatz-Lade-Attacke einer Mega ("+"): VM_MOVE_TEMP_EVOLUTION_MEGA_X_V0150_POKEMON_MEWTWO
      const m = /^VM_MOVE_(TEMP_EVOLUTION_[A-Z_]+?)_V(\d{4})_POKEMON_(.+)$/.exec(templateId);
      if (m) plusMoves.set(`${m[3]}|${m[1]}`, { num: data.moveSettings.movementId, settings: data.moveSettings, tempEvoId: m[1], speciesId: m[3] });
    } else if (data?.formSettings) {
      formSettings.set(data.formSettings.pokemon, data.formSettings.forms ?? []);
    } else if (data?.typeEffective) {
      typeScalars.set(typeKey(data.typeEffective.attackType), data.typeEffective.attackScalar);
    } else if (data?.weatherAffinities) {
      weather.set(data.weatherAffinities.weatherCondition, data.weatherAffinities.pokemonType.map(typeKey));
    } else if (templateId === 'PLAYER_LEVEL_SETTINGS') {
      cpm = data.playerLevel.cpMultiplier;
    } else if (templateId === 'BATTLE_SETTINGS') {
      battle = data.battleSettings;
    } else if (templateId === 'POKEMON_UPGRADE_SETTINGS') {
      upgrades = data.pokemonUpgrades;
    } else if (/^POKEMON_UPGRADE_OVERRIDE_SETTINGS_V\d{4}_POKEMON_/.test(templateId)) {
      upgradeOverrides.set(templateId.replace(/^POKEMON_UPGRADE_OVERRIDE_SETTINGS_V\d{4}_POKEMON_/, ''), data.pokemonUpgrades);
    } else if (templateId === 'LUCKY_POKEMON_SETTINGS') {
      lucky = data.luckyPokemonSettings;
    } else if (templateId === 'PRIMAL_EVO_SETTINGS') {
      primal = data.primalEvoSettings;
    } else if (templateId === 'MEGA_EVO_SETTINGS') {
      megaSettings = data.megaEvoSettings;
    } else if (data?.megaEvoLevelSettings) {
      const s = data.megaEvoLevelSettings;
      megaLevels.set(`${s.pokemonId ?? ''}|${s.level ?? 0}`, s);
    }
  }
  if (!cpm || !battle || !upgrades) throw new Error('Spieldaten unvollständig: Level-Tabelle, Kampf- oder Power-up-Einstellungen fehlen.');
  return {
    templates, moves, moveNamesById, formSettings, typeScalars, weather, cpm, battle, signatureMoves,
    upgrades, upgradeOverrides, lucky, primal, megaSettings, megaLevels, plusMoves,
  };
}

function buildTypeEffectiveness(index) {
  if (index.typeScalars.size !== SCALAR_ORDER.length) {
    throw new Error(`Typ-Tabelle unvollständig: ${index.typeScalars.size} statt 18 Typen in den Spieldaten.`);
  }
  const table = {};
  for (const [attackType, scalars] of index.typeScalars) {
    table[attackType] = Object.fromEntries(SCALAR_ORDER.map((defType, i) => [defType, scalars[i]]));
  }
  return table;
}

const moveName = (index, id) => (typeof id === 'number' ? index.moveNamesById.get(id) : id);

// Power-up-Kosten in kompakter Form für calc.js.
function upgradeTable(u) {
  return {
    candy: u.candyCost, stardust: u.stardustCost, xl: u.xlCandyCost,
    xlMinLevel: u.xlCandyMinPokemonLevel, maxLevel: u.maxNormalUpgradeLevel,
    shadowStardust: u.shadowStardustMultiplier, shadowCandy: u.shadowCandyMultiplier,
    purifiedStardust: u.purifiedStardustMultiplier, purifiedCandy: u.purifiedCandyMultiplier,
  };
}

// Eine Form pro Spielwert-Kombination (wie im Raid-Kompass): Kostüme fallen weg, ebenso die alte Vorlage
// ohne Form, wenn es dieselbe Art auch mit Form gibt.
function canonicalForms(index) {
  const bySpecies = new Map();
  for (const t of index.templates) {
    const s = t.settings;
    if (!s.stats?.baseAttack || BATTLE_ONLY_FORMS.has(s.form)) continue;
    if (!bySpecies.has(s.pokemonId)) bySpecies.set(s.pokemonId, []);
    bySpecies.get(s.pokemonId).push(t);
  }
  const statSignature = (s) => JSON.stringify([s.stats, s.type, s.type2]);
  const result = [];
  for (const [speciesId, list] of bySpecies) {
    const costumes = new Set((index.formSettings.get(speciesId) ?? []).filter((f) => f.isCostume).map((f) => f.form));
    const withForm = list.filter((t) => t.settings.form);
    const regular = withForm.filter((t) => !costumes.has(t.settings.form));
    const regularStats = new Set(regular.map((t) => statSignature(t.settings)));
    const special = withForm.filter((t) => costumes.has(t.settings.form) && !regularStats.has(statSignature(t.settings)));
    const formStats = new Set([...regular, ...special].map((t) => statSignature(t.settings)));
    const legacy = list.filter((t) => !t.settings.form && !formStats.has(statSignature(t.settings)));
    const multiStat = new Set([...regular, ...special, ...legacy].map((t) => statSignature(t.settings))).size > 1;
    const order = (t) => (!t.settings.form || t.settings.form.endsWith('_NORMAL') ? 0 : /\d|COPY|_S$/.test(t.settings.form) ? 2 : 1);
    const kept = [];
    const seen = new Set();
    const seenStats = new Set();
    for (const t of [...legacy, ...regular, ...special].sort((a, b) => order(a) - order(b))) {
      const s = t.settings;
      const signature = JSON.stringify([s.stats, s.type, s.type2, [...(s.quickMoves ?? [])].sort(), [...(s.cinematicMoves ?? [])].sort()]);
      if (seen.has(signature) || (order(t) === 2 && seenStats.has(statSignature(s)))) continue;
      seen.add(signature);
      seenStats.add(statSignature(s));
      kept.push(t);
    }
    for (const t of kept) {
      const form = t.settings.form;
      const showForm = form && !(form.endsWith('_NORMAL') && !multiStat) && kept.length > 1;
      // Alle Vorlagen mit denselben Werten (z. B. Apex-Lugia "LUGIA_S"): für Crypto-Attacken.
      const siblings = list.filter((x) => statSignature(x.settings) === statSignature(t.settings));
      // Weggefallene Formen, die sich anders entwickeln (Burmy mit Sand-/Lumpenumhang, Wuffels mit Eigenem Tempo).
      const dropped = siblings.filter((x) => !kept.includes(x) && x.settings.form && x.settings.form !== form);
      result.push({ ...t, formId: showForm ? form : null, siblings, dropped });
    }
  }
  return result;
}

// ---------- PvPoke: was ist erschienen? ----------

const statKey = (dex, stats, types) => `${dex}|${stats.atk}|${stats.def}|${stats.hp}|${[...types].sort().join(',')}`;

function releaseIndex(pvpoke) {
  const released = new Set();
  const shadow = new Set();
  const pvpokeMegas = pvpoke.pokemon.filter((p) => p.released !== false && (p.tags ?? []).includes('mega'));
  const byId = new Map(pvpoke.pokemon.map((p) => [p.speciesId, p]));
  for (const p of pvpoke.pokemon) {
    const types = p.types.filter((t) => t !== 'none').map((t) => t.toUpperCase());
    const key = statKey(p.dex, p.baseStats, types);
    const isShadow = (p.tags ?? []).includes('shadow');
    if (p.released === false) continue;
    if (isShadow) shadow.add(key); else released.add(key);
  }
  return { released, shadow, pvpokeMegas, byId };
}

// ---------- Namen ----------

const REGIONAL = { ALOLA: 'Alola', GALARIAN: 'Galar', HISUIAN: 'Hisui', PALDEA: 'Paldea' };
const TEMP_EVO_NUMBER = { TEMP_EVOLUTION_MEGA: 1, TEMP_EVOLUTION_MEGA_X: 2, TEMP_EVOLUTION_MEGA_Y: 3, TEMP_EVOLUTION_PRIMAL: 4 };

function germanName(texts, dex, speciesId, formId) {
  const base = texts.get(`pokemon_name_${pad(dex, 4)}`) ?? titleCase(speciesId);
  if (!formId || formId === `${speciesId}_NORMAL`) return base;
  if (NAME_FIXES[formId]) return NAME_FIXES[formId];
  const suffix = formId.slice(speciesId.length + 1);
  const region = Object.keys(REGIONAL).find((r) => suffix === r || suffix.startsWith(`${r}_`));
  if (region) {
    const rest = suffix.slice(region.length + 1);
    const label = rest && rest !== 'STANDARD' ? texts.get(`form_${formId.toLowerCase()}`) ?? texts.get(`form_${rest.toLowerCase()}`)
      ?? texts.get(`form_paldea_${rest.toLowerCase()}`) ?? titleCase(rest) : null;
    return `${REGIONAL[region]}-${base}${label ? ` (${label})` : ''}`;
  }
  const label = (texts.get(`form_${formId.toLowerCase()}`) ?? texts.get(`form_${suffix.toLowerCase()}`)
    ?? texts.get(`form_${suffix.toLowerCase()}_cloak`) ?? titleCase(suffix)).replace(/-?\n/g, '');
  if (!label.trim()) return base;
  return label.includes(base) ? label : `${base} (${label})`;
}

function germanMegaName(texts, dex, base, tempEvoId) {
  const fromTexts = texts.get(`pokemon_name_${pad(dex, 4)}_${pad(TEMP_EVO_NUMBER[tempEvoId], 4)}`);
  if (fromTexts) return fromTexts;
  if (tempEvoId === 'TEMP_EVOLUTION_PRIMAL') return `Proto-${base}`;
  const letter = /_(X|Y)$/.exec(tempEvoId)?.[1];
  return `Mega-${base}${letter ? ` ${letter}` : ''}`;
}

// Englischer Name für die Suche ("Shadow Mamoswine", "Mega Gengar", "Crowned Sword Zacian").
function englishName(textsEn, p) {
  const species = textsEn.get(`pokemon_name_${pad(p.dex, 4)}`) ?? titleCase(p.speciesId);
  let base = species;
  if (p.formId === 'MEWTWO_A') base = `Armored ${species}`;
  else if (p.formId && !p.formId.endsWith('_NORMAL')) {
    const suffix = p.formId.slice(p.speciesId.length + 1);
    const regional = { ALOLA: 'Alolan', GALARIAN: 'Galarian', HISUIAN: 'Hisuian', PALDEA: 'Paldean' }[suffix.split('_')[0]];
    const label = regional ?? (textsEn.get(`form_${p.formId.toLowerCase()}`) ?? textsEn.get(`form_${suffix.toLowerCase()}`) ?? titleCase(suffix)).replace(/-?\n/g, '');
    const breed = regional && suffix.includes('_') ? titleCase(suffix.slice(suffix.indexOf('_') + 1)) : null;
    base = regional ? `${regional} ${species}${breed ? ` (${breed})` : ''}` : label.includes(species) ? label : `${species} ${label}`;
  }
  const prefix = p.variant === 'primal' ? 'Primal ' : p.variant === 'mega' ? 'Mega ' : '';
  const letter = /_(X|Y)$/.exec(p.tempEvoId ?? '')?.[1];
  return `${p.shadow ? 'Shadow ' : ''}${prefix}${base}${letter ? ` ${letter}` : ''}`;
}

// ---------- Einträge bauen ----------

const slugOf = (text) => text.toLowerCase().replace(/_/g, '-');

function classOf(settings) {
  return {
    POKEMON_CLASS_LEGENDARY: 'legendary',
    POKEMON_CLASS_MYTHIC: 'mythical',
    POKEMON_CLASS_ULTRA_BEAST: 'ultrabeast',
  }[settings.pokemonClass] ?? null;
}

function buildPokemon(index, texts, releases, hints) {
  const pokemon = [];
  const moveIds = new Set();
  const useMoves = (ids) => ids.map((id) => moveName(index, id))
    .filter((id) => id && index.moves.has(id) && !SKIPPED_MOVES.has(id))
    .map((id) => { moveIds.add(id); return id; });

  for (const { dex, settings: s, formId, siblings, dropped } of canonicalForms(index)) {
    const speciesId = s.pokemonId;
    const types = [typeKey(s.type), typeKey(s.type2)].filter(Boolean);
    const base = { atk: s.stats.baseAttack, def: s.stats.baseDefense, sta: s.stats.baseStamina };
    const key = statKey(dex, { atk: base.atk, def: base.def, hp: base.sta }, types);
    const released = releases.released.has(key) || RELEASE_FIXES.has(s.form) || RELEASE_FIXES.has(speciesId);
    if (!released) continue;
    const fast = useMoves(s.quickMoves ?? []);
    const charged = useMoves(s.cinematicMoves ?? []);
    const eliteFast = useMoves(s.eliteQuickMove ?? []).filter((m) => !fast.includes(m));
    const eliteCharged = useMoves(s.eliteCinematicMove ?? []).filter((m) => !charged.includes(m));
    // Signatur-Attacken, die eine Form erst durch Fusion oder Krone bekommt (Behemoth-Klinge, Sonnenstahlstrahl …).
    for (const sig of index.signatureMoves.get(s.form) ?? []) {
      for (const m of useMoves(sig.moves)) {
        const target = sig.elite ? eliteCharged : charged;
        if (!charged.includes(m) && !eliteCharged.includes(m)) target.push(m);
      }
    }
    const name = germanName(texts, dex, speciesId, formId);
    const entryKey = slugOf(formId && !formId.endsWith('_NORMAL') ? formId : speciesId);
    const entry = {
      key: entryKey,
      speciesId,
      formId,
      form: s.form ?? null,
      dex,
      name,
      types,
      base,
      class: classOf(s),
      variant: 'normal',
      shadow: false,
      family: s.familyId ?? null,
      fast, charged, eliteFast, eliteCharged,
      // Der Game Master lässt "isTradable" bei nicht tauschbaren Arten weg. Fusions- und Kronen-Formen gelten wie ihre Art.
      tradable: s.isTradable === true || index.templates.some((t) => t.settings.pokemonId === speciesId && t.settings.isTradable === true),
      buddyKm: s.kmBuddyDistance ?? null,
      thirdMove: s.thirdMove ? { stardust: s.thirdMove.stardustToUnlock ?? 0, candy: s.thirdMove.candyToUnlock ?? 0 } : null,
      purification: s.shadow ? { stardust: s.shadow.purificationStardustNeeded, candy: s.shadow.purificationCandyNeeded } : null,
      upgradeOverride: index.upgradeOverrides.has(speciesId),
      // Attacken, die es nicht per Top-TM gibt, sondern nur über ein Event-Item (Zenitstürmer per Meteorit).
      specialMoves: (s.nonTmCinematicMoves ?? []).map((id) => moveName(index, id)).filter(Boolean),
      siblingBranches: dropped.flatMap((t) => (t.settings.evolutionBranch ?? [])
        .map((b) => ({ ...b, fromForm: germanName(texts, dex, speciesId, t.settings.form) }))),
      settings: s, // nur im Build: Entwicklungen, Formwechsel
    };
    pokemon.push(entry);

    // Crypto-Version: gleiche Werte, im Kampf 1,2 × Angriff und 0,83 × Verteidigung, teurer im Power-up.
    if (releases.shadow.has(key)) {
      const special = siblings.map((t) => t.settings.shadow?.shadowChargeMove).find((m) => m && m !== 'FRUSTRATION');
      const purifiedSpecial = siblings.map((t) => t.settings.shadow?.purifiedChargeMove).find((m) => m && m !== 'RETURN');
      const shadowCharged = [...charged];
      if (special && index.moves.has(special)) { moveIds.add(special); shadowCharged.push(special); }
      if (purifiedSpecial && index.moves.has(purifiedSpecial)) moveIds.add(purifiedSpecial);
      pokemon.push({
        ...entry,
        key: `crypto-${entryKey}`,
        name: `Crypto-${name}`,
        shadow: true,
        normalKey: entryKey,
        charged: shadowCharged,
        shadowMove: special ?? null,
        purifiedMove: purifiedSpecial ?? null,
        tradable: false,
      });
      entry.shadowKey = `crypto-${entryKey}`;
      if (purifiedSpecial) entry.purifiedMove = purifiedSpecial;
    }

    // Mega-Entwicklungen, die eine bestimmte Attacke voraussetzen (Mega-Rayquaza: Zenitstürmer): Die normale Form
    // kann sie lernen (nur per Event/Elite-TM), die Mega kennt sie immer.
    for (const b of s.evolutionBranch ?? []) {
      const required = b.temporaryEvolution && b.evolutionMoveRequirement;
      if (!required || !index.moves.has(required) || charged.includes(required) || entry.eliteCharged.includes(required)) continue;
      moveIds.add(required);
      entry.eliteCharged = [...entry.eliteCharged, required];
    }

    // Mega-Entwicklungen und Protomorphosen: eigene Werte und Typen, Attacken der normalen Form.
    for (const evo of s.tempEvoOverrides ?? []) {
      if (!evo.tempEvoId || !evo.stats) continue;
      const evoTypes = [typeKey(evo.typeOverride1), typeKey(evo.typeOverride2)].filter(Boolean);
      const evoBase = { atk: evo.stats.baseAttack, def: evo.stats.baseDefense, sta: evo.stats.baseStamina };
      const evoKey = statKey(dex, { atk: evoBase.atk, def: evoBase.def, hp: evoBase.sta }, evoTypes);
      if (!releases.released.has(evoKey)) continue;
      pokemon.push(megaEntry(index, texts, entry, evo.tempEvoId, evoTypes, evoBase, moveIds));
    }
  }
  addMissingMegas(index, pokemon, texts, releases.pvpokeMegas, moveIds);
  addPvpokeMoves(index, pokemon, releases, moveIds, hints);
  return { pokemon, moveIds };
}

// Attacken, die PvPoke für eine Form kennt, die Spieldaten aber (noch) nicht: in den Attacken-Pool übernehmen.
// Elite-/Legacy-Attacken bei PvPoke zählen als Top-TM-Attacken.
function pvpokeIdsOf(p) {
  const key = p.shadow ? p.normalKey : p.key;
  if (PVPOKE_KEY_ALIASES[key]) return PVPOKE_KEY_ALIASES[key];
  const id = key.replace(/-alola\b/, '-alolan').replace(/-paldea-/, '-').replace(/-paldea$/, '-paldean').replace(/-/g, '_');
  return [id];
}

function addPvpokeMoves(index, pokemon, releases, moveIds, hints) {
  const unknown = new Set();
  for (const p of pokemon) {
    if (p.speciesId === 'SMEARGLE') continue; // Farbeagle lernt Attacken über Schnappschüsse
    for (const id of pvpokeIdsOf(p)) {
      const q = releases.byId.get(id);
      if (!q) continue;
      const elite = new Set([...(q.eliteMoves ?? []), ...(q.legacyMoves ?? [])]);
      const add = (raw, fastMove) => {
        const name = PVPOKE_MOVE_ALIASES[raw] ?? raw;
        const gmId = fastMove ? `${name}_FAST` : name;
        if (SKIPPED_MOVES.has(gmId) || /^HIDDEN_POWER/.test(name)) return;
        if (!index.moves.has(gmId)) { unknown.add(raw); return; }
        const all = fastMove ? [p.fast, p.eliteFast] : [p.charged, p.eliteCharged];
        if (all.some((list) => list.includes(gmId)) || p.plusMove === gmId) return;
        moveIds.add(gmId);
        const target = elite.has(raw) ? (fastMove ? 'eliteFast' : 'eliteCharged') : (fastMove ? 'fast' : 'charged');
        p[target] = [...p[target], gmId];
        (p.addedMoves ??= []).push(gmId);
      };
      for (const m of q.fastMoves ?? []) add(m, true);
      for (const m of q.chargedMoves ?? []) add(m, false);
    }
  }
  if (unknown.size) hints.push(`PvPoke-Attacken ohne Gegenstück in den Spieldaten (ignoriert): ${[...unknown].sort().join(', ')}`);
  const added = pokemon.filter((p) => p.addedMoves && !p.shadow && p.variant === 'normal');
  if (added.length) console.log(`   ${added.length} Pokémon mit Attacken von PvPoke ergänzt (Game Master noch nicht aktuell)`);
  for (const p of pokemon) delete p.addedMoves;
}

function megaEntry(index, texts, root, tempEvoId, types, base, moveIds) {
  const primal = tempEvoId === 'TEMP_EVOLUTION_PRIMAL';
  const suffix = tempEvoId.replace('TEMP_EVOLUTION_', '').toLowerCase().replace(/_/g, '-');
  const plus = index.plusMoves.get(`${root.speciesId}|${tempEvoId}`);
  let plusMove = null;
  if (plus) {
    plusMove = `MEGA_PLUS_${root.speciesId}${/_(X|Y)$/.exec(tempEvoId)?.[0] ?? ''}`;
    moveIds.add(plusMove);
    index.moves.set(plusMove, { num: plus.num, settings: plus.settings, plus: true });
  }
  const levels = index.megaLevels.has(`${root.speciesId}|4`) ? 4 : 3;
  const branch = (root.settings.evolutionBranch ?? []).find((b) => b.temporaryEvolution === tempEvoId);
  const required = branch?.evolutionMoveRequirement && index.moves.has(branch.evolutionMoveRequirement) ? branch.evolutionMoveRequirement : null;
  return {
    ...root,
    ...(required ? {
      charged: [...root.charged, required],
      eliteCharged: root.eliteCharged.filter((m) => m !== required),
      requiredMove: required,
    } : {}),
    key: `${root.key}-${suffix}`,
    name: germanMegaName(texts, root.dex, root.name, tempEvoId),
    types,
    base,
    variant: primal ? 'primal' : 'mega',
    tempEvoId,
    parent: root.key,
    shadow: false,
    plusMove,
    megaLevels: levels,
    megaEnergy: {
      first: branch?.temporaryEvolutionEnergyCost ?? null,
      unlockSuperMax: levels === 4 ? index.megaLevels.get(`${root.speciesId}|4`).megaEnergyCostToUnlock ?? null : null,
    },
    // Typen, deren Attacken die Form im Raid um 30 % verstärkt (Proto-Kyogre/-Groudon und Mega-Rayquaza haben drei).
    boostTypes: (index.primal?.typeBoosts ?? []).find((b) => b.pokemonId === root.speciesId)?.boostType.map(typeKey) ?? types,
    // Gehört zur normalen Form: Crypto-Version, Erlösen, Entwicklung und Formwechsel gibt es für die Mega nicht.
    shadowKey: undefined,
    purification: null,
    purifiedMove: undefined,
  };
}

// Mega-Entwicklungen, die schon erschienen sind, aber im Game Master noch fehlen: Werte von PvPoke.
function addMissingMegas(index, pokemon, texts, pvpokeMegas, moveIds) {
  for (const m of pvpokeMegas) {
    const suffix = /_(mega_x|mega_y|mega|primal)$/.exec(m.speciesId)?.[1];
    if (!suffix) continue;
    const tempEvoId = `TEMP_EVOLUTION_${suffix.toUpperCase()}`;
    const root = pokemon.find((p) => p.dex === m.dex && p.variant === 'normal' && !p.shadow && !p.formId);
    if (!root || pokemon.some((p) => p.parent === root.key && p.tempEvoId === tempEvoId)) continue;
    pokemon.push(megaEntry(index, texts, root, tempEvoId,
      m.types.filter((t) => t !== 'none').map((t) => t.toUpperCase()),
      { atk: m.baseStats.atk, def: m.baseStats.def, sta: m.baseStats.hp }, moveIds));
  }
}

function buildMoves(index, texts, moveIds) {
  const moves = {};
  for (const id of [...moveIds].sort()) {
    const { num, settings: m, plus } = index.moves.get(id);
    moves[id] = {
      name: texts.get(`move_name_${pad(num, 4)}`) ?? titleCase(id.replace(/_FAST$/, '')),
      type: RANDOM_TYPE_MOVES.has(id) ? null : typeKey(m.pokemonType),
      power: m.power ?? 0,
      durationS: m.durationMs / 1000,
      // Beginn des Schadensfensters (GamePress-Korrektur für Lade-Attacken mit 100 Energie).
      ...(id.endsWith('_FAST') ? {} : { dwsS: (m.damageWindowStartMs ?? 0) / 1000 }),
      energy: m.energyDelta ?? 0,
      fast: id.endsWith('_FAST'),
      ...(plus ? { plus: true } : {}),
    };
  }
  return moves;
}

// ---------- Entwicklungen und Formwechsel ----------

function resolveForm(pokemon, speciesId, form) {
  const candidates = pokemon.filter((p) => p.speciesId === speciesId && p.variant === 'normal' && !p.shadow);
  return candidates.find((p) => p.form === form || p.formId === form)
    ?? candidates.find((p) => !p.formId && (!form || form.endsWith('_NORMAL')))
    ?? candidates.find((p) => !p.formId)
    ?? candidates[0] ?? null;
}

function itemName(texts, item) {
  return texts.get(`${item.toLowerCase()}_name`) ?? titleCase(item.replace(/^ITEM_/, ''));
}

function linkFamilies(pokemon, texts) {
  const byKey = new Map(pokemon.map((p) => [p.key, p]));
  for (const p of pokemon) {
    if (p.variant !== 'normal' || p.shadow) continue;
    const s = p.settings;
    const evolutions = [];
    for (const b of [...(s.evolutionBranch ?? []), ...(p.siblingBranches ?? [])]) {
      if (!b.evolution || b.temporaryEvolution) continue;
      const target = resolveForm(pokemon, b.evolution, b.form);
      if (!target || target.key === p.key) continue;
      // Entwicklung einer weggefallenen Form: nur, wenn sie zu einer eigenen Form führt (nicht bei rein optischen Formen).
      if (b.fromForm && (evolutions.some((e) => e.key === target.key) || (b.form && target.form !== b.form)
        || (s.formChange ?? []).some((fc) => (fc.availableForm ?? []).includes(b.form)))) continue;
      const conditions = [];
      if (b.fromForm) conditions.push(`nur als ${b.fromForm}`);
      if (b.evolutionItemRequirement) conditions.push(`${b.evolutionItemRequirementCost ? `${b.evolutionItemRequirementCost}× ` : ''}${itemName(texts, b.evolutionItemRequirement)}`);
      if (b.lureItemRequirement) conditions.push(`an einem ${itemName(texts, b.lureItemRequirement)}`);
      if (b.kmBuddyDistanceRequirement) conditions.push(`${b.kmBuddyDistanceRequirement} km als Kumpel`);
      if (b.onlyDaytime) conditions.push('tagsüber');
      if (b.onlyNighttime) conditions.push('nachts');
      if (b.onlyDuskPeriod) conditions.push('in der Dämmerung');
      if (b.onlyFullMoon) conditions.push('bei Vollmond');
      if (b.onlyUpsideDown) conditions.push('Handy kopfüber');
      if (b.genderRequirement) conditions.push(b.genderRequirement === 'FEMALE' ? 'nur weiblich' : 'nur männlich');
      if (b.questDisplay?.length) conditions.push('mit Entwicklungs-Aufgabe');
      if (b.noCandyCostViaTrade) conditions.push('nach einem Tausch ohne Bonbons');
      if (!evolutions.some((e) => e.key === target.key)) {
        evolutions.push({ key: target.key, candy: b.candyCost ?? 0, candyPurified: b.candyCostPurified ?? null, conditions });
      }
      target.preEvo ??= p.key;
    }
    if (evolutions.length) p.evolutions = evolutions;

    const changes = [];
    for (const fc of s.formChange ?? []) {
      for (const formId of fc.availableForm ?? []) {
        const target = resolveForm(pokemon, p.speciesId, formId);
        if (!target || target.key === p.key || changes.some((c) => c.key === target.key)) continue;
        const partner = fc.componentPokemonSettings?.formChangeType === 'FUSE' ? resolveForm(pokemon, fc.componentPokemonSettings.pokedexId, null) : null;
        const replaces = (fc.moveReassignment?.cinematicMoves ?? []).flatMap((r) => (r.replacementMoves ?? []).map((to) => ({ from: r.existingMoves?.[0] ?? null, to })));
        changes.push({
          key: target.key,
          candy: fc.candyCost ?? 0,
          stardust: fc.stardustCost ?? 0,
          item: fc.item ? itemName(texts, fc.item) : null,
          itemCount: fc.itemCostCount ?? null,
          partner: partner?.key ?? null,
          partnerCandy: fc.componentPokemonSettings?.componentCandyCost ?? null,
          requires: (fc.requiredCinematicMoves ?? []).flatMap((r) => r.requiredMoves ?? []),
          replaces,
          unfuse: fc.componentPokemonSettings?.formChangeType === 'UNFUSE',
          maxBattle: Boolean(fc.requiredBreadMoves),
        });
      }
    }
    if (changes.length) p.formChanges = changes;
  }
  for (const p of pokemon) {
    // Mega/Proto: an der normalen Form vermerken; Crypto: Entwicklungen der normalen Form.
    if (p.parent) (byKey.get(p.parent).megas ??= []).push(p.key);
  }
  for (const p of pokemon) {
    if (!p.shadow) continue;
    const normal = byKey.get(p.normalKey);
    const crypto = (k) => byKey.get(`crypto-${k}`)?.key ?? null;
    if (normal.evolutions) p.evolutions = normal.evolutions.map((e) => ({ ...e, key: crypto(e.key) ?? e.key }));
    // Vorstufe nur, wenn es sie auch als Crypto gibt (Crypto-Kicklee kommt nicht von Rabauz).
    const pre = normal.preEvo && crypto(normal.preEvo);
    if (pre) p.preEvo = pre;
  }
}

const gradeByRatio = (ratio, limits) => (ratio >= limits[0] - 1e-9 ? 3 : ratio >= limits[1] ? 2 : ratio >= limits[2] ? 1 : 0);

// ---------- Raids ----------

function applyRaidRankings(data) {
  const { pokemon } = data;
  const attackers = pokemon.filter((p) => p.fast.length + p.eliteFast.length && p.charged.length + p.eliteCharged.length + (p.plusMove ? 1 : 0));
  const isMega = (p) => p.variant !== 'normal';
  const tables = {};
  for (const type of Object.keys(TYPES)) {
    const rows = [];
    for (const p of attackers) {
      const megaLevel = isMega(p) ? p.megaLevels : null;
      const stats = PowerCalc.pveStats(data, p, { level: PVE.level, megaLevel });
      const best = PowerCalc.bestPve(data, p, stats, type, { elite: true, megaLevel });
      if (!best) continue;
      const plain = PowerCalc.bestPve(data, p, stats, type, { elite: false, megaLevel });
      rows.push({ p, best, plain });
    }
    const normal = rows.filter((r) => !isMega(r.p)).sort((a, b) => b.best.score - a.best.score);
    const megas = rows.filter((r) => isMega(r.p)).sort((a, b) => b.best.score - a.best.score);
    // Ohne Crypto: dieselbe Rangliste ohne Crypto-Pokémon, mit eigener Vergleichsgröße.
    const plainList = normal.filter((r) => !r.p.shadow);
    const refOf = (list) => list[Math.min(4, list.length - 1)]?.best.score ?? 1;
    const ref = refOf(normal);
    const refNoShadow = refOf(plainList);
    const megaRef = megas[0]?.best.score ?? 1;
    const rankNoShadow = new Map(plainList.map((r, i) => [r.p.key, i + 1]));
    const assign = (list, refScore, limits, ref2 = refScore) => list.forEach((r, i) => {
      const grades = (refValue) => {
        const grade = gradeByRatio(r.best.score / refValue, limits);
        const plainGrade = r.plain ? gradeByRatio(r.plain.score / refValue, limits) : 0;
        return { grade, plainGrade: plainGrade < grade ? plainGrade : undefined };
      };
      const withShadow = grades(refScore);
      const without = r.p.shadow ? withShadow : grades(ref2);
      r.p.rating ??= {};
      (r.p.rating.raid ??= []).push({
        type,
        rank: i + 1,
        of: list.length,
        ratio: round(r.best.score / refScore, 3),
        grade: withShadow.grade,
        // Spitze nur mit Elite-Attacke? Dann steht hier die Stufe ohne.
        plainGrade: withShadow.plainGrade,
        // Dasselbe ohne Crypto-Pokémon (Megas: gleich, sie haben eine eigene Liste).
        rankNS: isMega(r.p) ? i + 1 : rankNoShadow.get(r.p.key) ?? null,
        ofNS: isMega(r.p) ? list.length : plainList.length,
        ratioNS: round(r.best.score / ref2, 3),
        gradeNS: without.grade,
        plainGradeNS: without.plainGrade,
        fast: r.best.fast,
        charged: r.best.charged,
        dps: round(r.best.dps, 2),
        tdo: round(r.best.tdo, 1),
      });
    });
    assign(normal, ref, RAID_GRADES, refNoShadow);
    assign(megas, megaRef, MEGA_GRADES);
    tables[type] = { normal: normal.map((r) => r.p.key), megas: megas.map((r) => r.p.key) };
  }
  // Pro Pokémon: die Typen nach Stärke ordnen, nur die besten behalten.
  for (const p of pokemon) {
    if (!p.rating?.raid) continue;
    p.rating.raid.sort((a, b) => b.grade - a.grade || b.ratio - a.ratio);
    const keep = p.rating.raid.filter((r, i) => i < 1 || r.grade > 0 || r.gradeNS > 0);
    p.rating.raid = keep;
  }
  return tables;
}

// ---------- Max-Kämpfe (Daten des Dyna-Kompass) ----------

function parseDyna(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(text.slice(start, end + 1));
}

function applyMax(pokemon, dyna, hints) {
  if (!dyna) return null;
  const today = new Date().toISOString().slice(0, 10);
  const released = dyna.pokemon.filter((d) => !d.releaseDate || d.releaseDate <= today);
  // Dynamax- und Gigadynamax-Eintrag derselben Art landen beim selben Pokémon.
  const targetOf = (d) => (d.formId ? resolveForm(pokemon, d.speciesId, d.formId)
    : pokemon.find((p) => p.variant === 'normal' && !p.shadow && p.speciesId === d.speciesId
      && (!p.formId || p.formId === `${d.speciesId}_NORMAL` || p.formId === `${d.speciesId}_STANDARD`)));
  const targets = new Map();
  for (const d of released) {
    const t = targetOf(d);
    if (t) targets.set(d, t);
    else hints.push(`Dyna-Kompass: ${d.name} (${d.speciesId}/${d.formId}) keinem Pokémon zugeordnet.`);
  }
  const roles = [];
  for (const d of targets.keys()) {
    if (!d.fastMoves.length) continue;
    const role = (type, power) => ({ d, type, damage: (power * d.atk40 * (d.types.includes(type) ? dyna.rules.stab : 1)) / 100 });
    if (d.kind === 'gigantamax' && d.gmaxMove) roles.push(role(d.gmaxMove.type, dyna.rules.gmaxMovePower));
    else for (const type of new Set(d.fastMoves.map((m) => m.type))) roles.push(role(type, dyna.rules.maxMovePower));
  }
  // Ranglisten je Typ: jedes Pokémon einmal, mit seiner besten Max-Attacke (Dynamax oder Gigadynamax).
  const tables = {};
  const entries = new Map(); // Pokémon-Schlüssel -> { kinds, move, attack: [...] }
  for (const type of Object.keys(TYPES)) {
    const best = new Map();
    for (const r of roles.filter((x) => x.type === type).sort((a, b) => b.damage - a.damage)) {
      const key = targets.get(r.d).key;
      if (!best.has(key)) best.set(key, r);
    }
    const list = [...best.entries()];
    tables[type] = list.map(([key]) => key);
    const top = list[0]?.[1].damage ?? 1;
    list.forEach(([key, r], i) => {
      const e = entries.get(key) ?? { attack: [] };
      e.attack.push({ type, rank: i + 1, of: list.length, ratio: round(r.damage / top, 3), grade: gradeByRatio(r.damage / top, MAX_GRADES), kind: r.d.kind });
      entries.set(key, e);
    });
  }
  // Ausdauer (Tank): jedes Pokémon einmal.
  const bulk = (d) => d.def40 * d.hp40;
  const tankList = [...new Map([...targets.keys()].sort((a, b) => bulk(b) - bulk(a)).map((d) => [targets.get(d).key, d])).keys()];
  for (const [d, target] of targets) {
    const e = entries.get(target.key) ?? { attack: [] };
    e.kinds = [...new Set([...(e.kinds ?? []), d.kind])];
    if (d.kind === 'gigantamax' && d.gmaxMove) e.move = d.gmaxMove.name;
    entries.set(target.key, e);
  }
  for (const [key, e] of entries) {
    const target = pokemon.find((p) => p.key === key);
    const tankRank = tankList.indexOf(key) + 1;
    e.attack.sort((a, b) => b.grade - a.grade || b.ratio - a.ratio);
    target.rating ??= {};
    target.rating.max = {
      kinds: e.kinds,
      move: e.move ?? null,
      attack: e.attack,
      tankRank,
      tankOf: tankList.length,
      grade: Math.max(e.attack[0]?.grade ?? 0, tankRank <= 10 ? 2 : tankRank <= 25 ? 1 : 0),
    };
  }
  return { matched: targets.size, total: released.length, tables };
}

// ---------- Gesamturteil ----------

// Stufe für Raids & Arenen (bester Angriffstyp) – mit und ohne Crypto-Pokémon (Schalter auf der Seite).
// Max-Kämpfe zählen nicht mit: Dafür braucht man ein eigenes Dynamax-Pokémon (aus Max-Kämpfen) – die Bewertung
// steht deshalb getrennt. Eine Mega-Entwicklung zählt für ihre normale Form mit: Wer sie hochlevelt, levelt auch
// die Mega. Vorstufen verweisen auf ihre beste Entwicklung.
function applyVerdicts(pokemon) {
  const byKey = new Map(pokemon.map((p) => [p.key, p]));
  for (const p of pokemon) {
    p.rating ??= {};
    p.rating.grade = Math.max(0, ...(p.rating.raid ?? []).map((r) => r.grade));
    p.rating.gradeNS = Math.max(0, ...(p.rating.raid ?? []).map((r) => r.gradeNS));
  }
  for (const p of pokemon) {
    if (!p.megas) continue;
    const best = p.megas.map((k) => byKey.get(k)).sort((a, b) => b.rating.grade - a.rating.grade)[0];
    if (best.rating.grade > 0) p.rating.mega = { key: best.key, grade: best.rating.grade };
    p.rating.grade = Math.max(p.rating.grade, best.rating.grade);
    p.rating.gradeNS = Math.max(p.rating.gradeNS, best.rating.grade);
  }
  // Beste erreichbare Entwicklung (über mehrere Stufen), je Modus.
  const bestEvolution = (p, field, seen = new Set()) => {
    let best = null;
    for (const e of p.evolutions ?? []) {
      const t = byKey.get(e.key);
      if (!t || seen.has(t.key)) continue;
      seen.add(t.key);
      const candidate = { key: t.key, grade: t.rating[field] };
      const deeper = bestEvolution(t, field, seen);
      for (const c of [candidate, deeper]) if (c && (!best || c.grade > best.grade)) best = c;
    }
    return best;
  };
  // "Erst entwickeln" nur für Vorstufen ohne eigenen Nutzen; taugt die Vorstufe selbst schon etwas, bleibt ihr
  // Urteil, und die stärkere Entwicklung ist nur ein Hinweis (better).
  const mark = (p, evo, own, evolveField, betterField) => {
    if (!evo || evo.grade <= own) return;
    p.rating[own === 0 ? evolveField : betterField] = evo;
  };
  for (const p of pokemon) {
    mark(p, bestEvolution(p, 'grade'), p.rating.grade, 'evolve', 'better');
    // Crypto-Vorstufen entwickeln sich zu Crypto-Pokémon – ohne Crypto gibt es sie nicht.
    if (!p.shadow) mark(p, bestEvolution(p, 'gradeNS'), p.rating.gradeNS, 'evolveNS', 'betterNS');
  }
}

// ---------- Bilder ----------

function pokeApiIndex(csv) {
  const byIdentifier = new Map();
  const defaultBySpecies = new Map();
  for (const line of csv.trim().split('\n').slice(1)) {
    const [id, identifier, speciesId, , , , , isDefault] = line.split(',');
    byIdentifier.set(identifier, Number(id));
    if (isDefault === '1') defaultBySpecies.set(Number(speciesId), Number(id));
  }
  return { byIdentifier, defaultBySpecies };
}

function pokeApiId(api, p) {
  if (p.formId && NO_POKEAPI_ART.has(p.formId)) return null;
  const species = p.speciesId.toLowerCase().replace(/_/g, '-');
  const form = p.formId
    ? POKEAPI_FORM_SLUGS[p.formId] ?? p.formId.toLowerCase().replace(/_/g, '-')
      .replace(/-galarian\b/, '-galar').replace(/-hisuian\b/, '-hisui').replace(/-paldea-(\w+)$/, '-paldea-$1-breed')
    : null;
  const candidates = [];
  if (p.variant === 'mega' || p.variant === 'primal') {
    const suffix = p.tempEvoId.replace('TEMP_EVOLUTION_', '').toLowerCase().replace(/_/g, '-');
    candidates.push(`${form ?? species}-${suffix}`, `${species}-${suffix}`);
  }
  if (form) candidates.push(form, form.replace(/-(normal|standard|ordinary|altered|incarnate|land|aria|average|confined|hero|natural|plant|red-striped|baile|midday|amped|full-belly|single-strike|family-of-four|zero|curly|green-plumage|two-segment|chest)$/, '-$1'));
  candidates.push(species);
  for (const c of candidates) if (api.byIdentifier.has(c)) return api.byIdentifier.get(c);
  if (p.variant !== 'normal') return null;
  return api.defaultBySpecies.get(p.dex) ?? null;
}

async function loadImages(pokemon, api, missing) {
  const jobs = [];
  await mapLimited(pokemon.filter((p) => !p.shadow), 8, async (p) => {
    const id = pokeApiId(api, p);
    if (!id) { missing.push(p.name); return; }
    const raw = path.join(IMG_RAW_DIR, `${id}.png`);
    if (!await exists(raw)) {
      const buf = await fetchWithRetry(SOURCES.artwork(id), 'buffer');
      if (!buf) { missing.push(p.name); return; }
      await mkdir(IMG_RAW_DIR, { recursive: true });
      await writeFile(raw, buf);
    }
    p.image = `assets/img/${id}.webp`;
    jobs.push({ src: raw, dest: path.join(IMG_DIR, `${id}.webp`) });
  });
  // Crypto-Pokémon zeigen das Bild der normalen Form (mit violetter Aura auf der Seite).
  const byKey = new Map(pokemon.map((p) => [p.key, p]));
  for (const p of pokemon) if (p.shadow) p.image = byKey.get(p.normalKey)?.image ?? null;
  const unique = [...new Map(jobs.map((j) => [j.dest, j])).values()];
  const converted = await convertToWebp(unique, {
    onProgress: (done, total) => { if (done % 100 === 0 || done === total) console.log(`   ${done}/${total} Bilder umgewandelt`); },
  });
  const keep = new Set(unique.map((j) => path.basename(j.dest)));
  for (const file of await readdir(IMG_DIR).catch(() => [])) if (!keep.has(file)) await rm(path.join(IMG_DIR, file));
  return { total: unique.length, converted };
}

// ---------- Kontrolle ----------

function report(data, raidTables) {
  const byKey = new Map(data.pokemon.map((p) => [p.key, p]));
  for (const [type, t] of Object.entries(raidTables)) {
    console.log(`\n${type}: ${t.normal.slice(0, 15).map((k) => byKey.get(k).name).join(', ')}`);
    console.log(`  Mega: ${t.megas.slice(0, 5).map((k) => byKey.get(k).name).join(', ')}`);
  }
  const grades = [0, 0, 0, 0];
  for (const p of data.pokemon) grades[p.rating.grade]++;
  console.log(`\nStufen (nein/Nische/gut/Spitze): ${grades.join(' / ')} · Entwickeln-Hinweise: ${data.pokemon.filter((p) => p.rating.evolve).length}`);
}

// ---------- Ablauf ----------

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  console.log('1/6 Spieldaten, Texte und Ranglisten laden …');
  const gm = await cached('game-master.json', SOURCES.gameMaster);
  const gmTime = await cached('game-master-timestamp.txt', SOURCES.gameMasterTime, 'text').catch(() => null);
  const pvpoke = await cached('pvpoke.json', SOURCES.pvpoke);
  const textsDe = textMap(await cached('texts-de.json', SOURCES.textsDe));
  const textsEn = textMap(await cached('texts-en.json', SOURCES.textsEn));
  const hints = [];
  let dyna = null;
  try {
    dyna = parseDyna(await cached('dyna-kompass.js', SOURCES.dyna, 'text'));
  } catch (err) {
    hints.push(`Dyna-Kompass-Daten nicht lesbar (${err.message}) – Max-Kämpfe ohne Bewertung.`);
  }
  const index = indexGameMaster(gm);

  console.log('2/6 Pokémon, Attacken, Entwicklungen und Formen zusammenstellen …');
  const releases = releaseIndex(pvpoke);
  const { pokemon, moveIds } = buildPokemon(index, textsDe, releases, hints);
  const moves = buildMoves(index, textsDe, moveIds);
  linkFamilies(pokemon, textsDe);
  for (const p of pokemon) p.nameEn = englishName(textsEn, p);

  const upgrades = upgradeTable(index.upgrades);
  const megaLevelRules = [1, 2, 3, 4].map((level) => {
    const s = index.megaLevels.get(`|${level}`) ?? [...index.megaLevels.entries()].find(([k]) => k.endsWith(`|${level}`))?.[1];
    const e = s?.effects ?? {};
    return {
      level,
      name: textsDe.get(`mega_level_${level}`) ?? `Mega-Level ${level}`,
      megaEvolutions: s?.progression?.pointsRequired ?? null,
      cooldownDays: s?.cooldown?.durationMs ? Number(s.cooldown.durationMs) / 86400000 : null,
      candy: e.sameTypeExtraCatchCandy ?? 0,
      xp: e.sameTypeExtraCatchXp ?? 0,
      xlChance: e.sameTypeExtraCatchCandyXlChance ?? 0,
      selfCpBoost: e.selfCpBoostAdditionalLevel ?? 0,
      sameTypeBoost: e.sameTypeAttackBoost ?? index.megaSettings?.attackBoostFromMegaSameType ?? 1.3,
      otherTypeBoost: e.differentTypeAttackBoost ?? index.megaSettings?.attackBoostFromMegaDifferentType ?? 1.1,
    };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    sources: {
      gameMasterDate: gmTime ? new Date(Number(gmTime.trim())).toISOString() : null,
      gameMaster: { name: 'PokeMiners/game_masters', url: 'https://github.com/PokeMiners/game_masters' },
      texts: { name: 'holoholo-text', url: 'https://github.com/sora10pls/holoholo-text' },
      pvpoke: { name: 'PvPoke', url: 'https://github.com/pvpoke/pvpoke' },
      dyna: { name: 'Dyna-Kompass', url: 'https://jason-z-tech.github.io/dyna-kompass/' },
      images: { name: 'PokeAPI', url: 'https://pokeapi.co/' },
    },
    rules: {
      cpm: index.cpm,
      stab: index.battle.sameTypeAttackBonusMultiplier,
      superEffective: 1.6,
      shadowAttack: index.battle.shadowPokemonAttackBonusMultiplier,
      shadowDefense: index.battle.shadowPokemonDefenseBonusMultiplier,
      luckyStardust: index.lucky?.powerUpStardustDiscountPercent ?? 0.5,
      buddyBoostLevels: index.upgrades.defaultCpBoostAdditionalLevel ?? 1,
      maxLevel: index.upgrades.maxNormalUpgradeLevel,
      pve: PVE,
      plusMoveFactor: [1, 1.1, 1.2, 1.3],
      megaLevels: megaLevelRules,
      megaDurationH: index.megaSettings ? Number(index.megaSettings.evolutionLengthMs) / 3600000 : 8,
      grades: { raid: RAID_GRADES, mega: MEGA_GRADES, max: MAX_GRADES },
    },
    upgrades,
    upgradeOverrides: Object.fromEntries([...index.upgradeOverrides].map(([k, v]) => [k, upgradeTable(v)])),
    types: TYPES,
    typeEffectiveness: buildTypeEffectiveness(index),
    weather: WEATHER.map((w) => ({ id: w.id, name: textsDe.get(w.text) ?? titleCase(w.id), types: index.weather.get(w.id) ?? [] })),
    moves,
    pokemon,
  };

  console.log('3/6 Raid-Ranglisten rechnen …');
  const raidTables = applyRaidRankings(data);

  console.log('4/6 Max-Kämpfe (Dyna-Kompass) zuordnen und Urteile vergeben …');
  const max = applyMax(pokemon, dyna, hints);
  if (max) console.log(`   ${max.matched} von ${max.total} Dynamax-/Gigadynamax-Pokémon zugeordnet`);
  data.maxTables = max?.tables ?? {};
  applyVerdicts(pokemon);
  for (const p of pokemon) {
    const note = NOTES[p.formId] ?? NOTES[p.speciesId];
    if (note) p.note = note;
    delete p.settings;
    delete p.siblingBranches;
  }
  data.raidTables = raidTables;

  const missingImages = [];
  if (NO_IMAGES) {
    console.log('5/6 Ohne Bilder (--no-images): assets/img/ wird entfernt …');
    for (const p of pokemon) p.image = null;
    delete data.sources.images;
    await rm(IMG_DIR, { recursive: true, force: true });
  } else if (SKIP_IMAGES) {
    console.log('5/6 Bilder übersprungen (--skip-images)');
    for (const p of pokemon) p.image = null;
  } else {
    console.log('5/6 Bilder laden und in WebP umwandeln …');
    const api = pokeApiIndex(await cached('pokeapi-pokemon.csv', SOURCES.pokeapiPokemon, 'text'));
    const { total, converted } = await loadImages(pokemon, api, missingImages);
    console.log(`   ${total} Bilder, davon ${converted} neu umgewandelt`);
  }

  console.log('6/6 Daten schreiben …');
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `// Automatisch erzeugt von scripts/build-data.mjs – nicht von Hand bearbeiten.\nwindow.POWER_DATA = ${JSON.stringify(data)};\n`);

  if (REPORT) report(data, raidTables);
  const count = (f) => pokemon.filter(f).length;
  console.log(`\nFertig: ${pokemon.length} Einträge (${count((p) => p.variant === 'normal' && !p.shadow)} Pokémon, ${count((p) => p.shadow)} Crypto, ${count((p) => p.variant !== 'normal')} Mega/Proto), ${Object.keys(moves).length} Attacken → ${path.relative(ROOT, OUT_FILE)}`);
  if (hints.length) console.warn(`\nHinweis – bitte prüfen (${hints.length}):\n  ${hints.join('\n  ')}`);
  if (missingImages.length) console.warn(`\nWarnung – ohne Bild (${missingImages.length}):\n  ${missingImages.join('\n  ')}`);
}

main().catch((err) => {
  console.error(`\nFehler: ${err.stack ?? err.message}`);
  process.exit(1);
});
