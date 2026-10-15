'use strict';

// Rechnung des Power-Kompass: Werte auf jedem Level, Power-up-Kosten, Raid-Stärke (DPS/TDO) und
// IV-Rang für die Ligen. Klassisches Skript (läuft per Doppelklick über file://) – dasselbe Skript
// nutzt das Daten-Skript in Node, damit Seite und Build garantiert gleich rechnen.

const PowerCalc = (() => {
  // Kosten werden aufgerundet; 1,2 × 10 ergibt in Gleitkomma 12,000000000000002 und darf nicht zu 13 werden.
  const EPS = 1e-9;
  const ceil = (x) => Math.ceil(x - EPS);

  // ---------- Level und Werte ----------

  // CP-Multiplikator für ganze und halbe Level (Spieldaten liefern nur ganze Level).
  function cpmAt(data, level) {
    const table = data.rules.cpm;
    const lower = Math.floor(level);
    if (lower === level) return table[lower - 1];
    const a = table[lower - 1];
    const b = table[lower];
    // Halbe Level liegen auf der Wurzel-Mitte zwischen den ganzen (so rechnet das Spiel).
    return Math.sqrt((a * a + b * b) / 2);
  }

  const FULL_IV = Object.freeze({ atk: 15, def: 15, sta: 15 });

  function combatPower(base, iv, cpm) {
    const a = base.atk + iv.atk;
    const d = base.def + iv.def;
    const s = base.sta + iv.sta;
    return Math.max(10, Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * cpm * cpm) / 10));
  }

  const hpOf = (base, iv, cpm) => Math.max(10, Math.floor((base.sta + iv.sta) * cpm));

  // Werte auf einem Level. Crypto-Pokémon greifen im Kampf mit 1,2 × Angriff an und haben 0,83 × Verteidigung;
  // ihre WP zeigen das nicht.
  function statsAt(data, pokemon, level, iv = FULL_IV, { battle = true } = {}) {
    const cpm = cpmAt(data, level);
    const shadow = battle && pokemon.shadow;
    return {
      level,
      cp: combatPower(pokemon.base, iv, cpm),
      atk: (pokemon.base.atk + iv.atk) * cpm * (shadow ? data.rules.shadowAttack : 1),
      def: (pokemon.base.def + iv.def) * cpm * (shadow ? data.rules.shadowDefense : 1),
      hp: hpOf(pokemon.base, iv, cpm),
    };
  }

  // Höchstes erreichbares Level (inkl. Boost): normales Maximum + Bester Kumpel + Super-Max-Level einer Mega.
  // Ob sich die beiden Boosts addieren, ist nicht bekannt – gerechnet wird mit dem größeren.
  function levelBoost(data, { buddy = false, megaBoost = 0 } = {}) {
    return Math.max(buddy ? data.rules.buddyBoostLevels : 0, megaBoost);
  }

  // ---------- Power-up-Kosten ----------

  function upgradeTable(data, pokemon) {
    return data.upgradeOverrides[pokemon.speciesId] ?? data.upgrades;
  }

  // Sternenstaub, Bonbons und Bonbons XL von Level "from" bis "to" (halbe Schritte).
  // Crypto: 1,2 × Staub und Bonbons, Erlöst: 0,9 ×, Glücks-Pokémon: halber Staub. Jeder Schritt wird aufgerundet.
  function powerUpCost(data, pokemon, from, to, { purified = false, lucky = false } = {}) {
    const t = upgradeTable(data, pokemon);
    const shadow = pokemon.shadow;
    const dustFactor = (shadow ? t.shadowStardust : 1) * (purified ? t.purifiedStardust : 1) * (lucky ? data.rules.luckyStardust : 1);
    const candyFactor = (shadow ? t.shadowCandy : 1) * (purified ? t.purifiedCandy : 1);
    let stardust = 0;
    let candy = 0;
    let xl = 0;
    for (let level = from; level < to - EPS; level += 0.5) {
      const i = Math.floor(level) - 1;
      stardust += ceil(t.stardust[i] * dustFactor);
      if (level < t.xlMinLevel) candy += ceil(t.candy[i] * candyFactor);
      else xl += ceil(t.xl[Math.floor(level) - t.xlMinLevel] * candyFactor);
    }
    return { stardust, candy, xl };
  }

  // ---------- Raids: DPS, TDO und Wertung ----------

  // Schaden eines Treffers: floor(0,5 × Stärke × Angriff/Verteidigung × Faktoren) + 1.
  const hit = (power, atk, def, multiplier) => Math.floor((0.5 * power * atk * multiplier) / def) + 1;

  // Gegner für die Typ-Ranglisten: ein typischer Raid-Boss (5 Sterne), der gegen den Angriffstyp schwach ist
  // und gegen alle anderen Typen neutral. Seinen Schaden schätzt die GamePress-Formel mit y = 900 / Verteidigung.
  function pveTarget(data, type) {
    const r = data.rules.pve;
    return { type, def: (r.targetDefense + 15) * r.targetCpm };
  }

  function moveFactor(data, attacker, move, target) {
    return (attacker.types.includes(move.type) ? data.rules.stab : 1) * (move.type === target.type ? data.rules.superEffective : 1);
  }

  // DPS und TDO mit einem Attacken-Paar (Formel nach GamePress, "Comprehensive DPS"): Energie kommt aus
  // Sofort-Attacken und aus erlittenem Schaden (0,5 pro KP). stats: Angriff, Verteidigung, KP im Kampf.
  function pvePerformance(data, attacker, stats, fast, charged, target) {
    const y = data.rules.pve.incoming / stats.def;
    const fastDamage = hit(fast.power, stats.atk, target.def, moveFactor(data, attacker, fast, target));
    const chargedDamage = hit(charged.power, stats.atk, target.def, moveFactor(data, attacker, charged, target));
    const fdps = fastDamage / fast.durationS;
    const feps = fast.energy / fast.durationS;
    const cdps = chargedDamage / charged.durationS;
    const cost = -charged.energy;
    const ceps = cost / charged.durationS;
    const x = 0.5 * cost + 0.5 * fast.energy;
    const cycle = (fdps * ceps + cdps * feps) / (ceps + feps);
    let dps = cycle + ((cdps - fdps) / (ceps + feps)) * (0.5 - x / stats.hp) * y;
    dps = Math.max(dps, fdps); // Lade-Attacke lohnt sich nicht: nur Sofort-Attacken
    const tdo = dps * (stats.hp / y);
    return { dps, tdo, score: Math.pow(dps * dps * dps * tdo, 0.25) };
  }

  // Attacke mit Daten; Zusatz-Attacken einer Mega ("+") werden mit dem Faktor ihres Mega-Levels stärker.
  function moveOf(data, id, plusFactor = 1) {
    const m = data.moves[id];
    if (!m) return null;
    return m.plus ? { id, ...m, power: m.power * plusFactor } : { id, ...m };
  }

  // Attacken, die ein Pokémon in Raids einsetzen kann. Kraftreserve fällt weg (Typ im Spiel zufällig).
  function pveMoves(data, pokemon, { elite = true, megaLevel = null } = {}) {
    const plusFactor = data.rules.plusMoveFactor[(megaLevel ?? pokemon.megaLevels ?? 1) - 1] ?? 1;
    const ids = (list) => list.filter(Boolean);
    const fast = ids([...pokemon.fast, ...(elite ? pokemon.eliteFast : [])]).map((id) => moveOf(data, id)).filter((m) => m?.type);
    const charged = ids([...pokemon.charged, ...(elite ? pokemon.eliteCharged : []), pokemon.plusMove])
      .map((id) => moveOf(data, id, plusFactor)).filter((m) => m?.type);
    return { fast, charged };
  }

  // Bestes Attacken-Paar gegen einen Boss, der schwach gegen "type" ist. Die Lade-Attacke muss diesen Typ
  // haben (sonst wäre es kein Angreifer dieses Typs), die Sofort-Attacke darf beliebig sein.
  function bestPve(data, pokemon, stats, type, { elite = true, megaLevel = null } = {}) {
    const target = pveTarget(data, type);
    const { fast, charged } = pveMoves(data, pokemon, { elite, megaLevel });
    let best = null;
    for (const c of charged) {
      if (c.type !== type) continue;
      for (const f of fast) {
        const perf = pvePerformance(data, pokemon, stats, f, c, target);
        if (!best || perf.score > best.score) best = { ...perf, fast: f.id, charged: c.id };
      }
    }
    return best;
  }

  // Alle Angriffstypen eines Pokémon mit ihrem besten Paar (sortiert, stärkster zuerst).
  function pveByType(data, pokemon, stats, opts = {}) {
    const types = new Set(pveMoves(data, pokemon, opts).charged.map((m) => m.type));
    return [...types].map((type) => ({ type, ...bestPve(data, pokemon, stats, type, opts) }))
      .sort((a, b) => b.score - a.score);
  }

  // Werte für die Raid-Rechnung: Level und IVs, bei Mega auf Super-Max-Level 2 Level höher.
  function pveStats(data, pokemon, { level = data.rules.pve.level, iv = FULL_IV, buddy = false, megaLevel = null } = {}) {
    const megaBoost = megaLevel ? data.rules.megaLevels[megaLevel - 1]?.selfCpBoost ?? 0 : 0;
    return statsAt(data, pokemon, level + levelBoost(data, { buddy, megaBoost }), iv);
  }

  // ---------- Ligen: IV-Rang ----------

  // Höchstes Level (in halben Schritten bis maxLevel), auf dem die WP-Grenze nicht überschritten wird.
  // WP steigen mit dem Level nie – deshalb genügt eine binäre Suche über die halben Level.
  function levelUnderCap(data, base, iv, cap, maxLevel) {
    if (!Number.isFinite(cap)) return maxLevel;
    const steps = Math.round((maxLevel - 1) * 2);
    const cpAtStep = (i) => combatPower(base, iv, cpmAt(data, 1 + i / 2));
    if (cpAtStep(0) > cap) return null;
    let lo = 0;
    let hi = steps;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (cpAtStep(mid) <= cap) lo = mid; else hi = mid - 1;
    }
    return 1 + lo / 2;
  }

  // Werte in einer Liga: Level unter der Grenze, WP, Angriff, Verteidigung, KP und Stat-Produkt.
  function leagueStats(data, base, iv, cap, maxLevel) {
    const level = levelUnderCap(data, base, iv, cap, maxLevel);
    if (level === null) return null;
    const cpm = cpmAt(data, level);
    const atk = (base.atk + iv.atk) * cpm;
    const def = (base.def + iv.def) * cpm;
    const hp = hpOf(base, iv, cpm);
    return { level, cp: combatPower(base, iv, cpm), atk, def, hp, product: atk * def * hp };
  }

  const ivCache = new Map();

  // Alle 4096 IV-Kombinationen, nach Stat-Produkt sortiert (bestes zuerst). minIv: Mindestwert (z. B. Raids: 10).
  function ivTable(data, pokemon, cap, maxLevel) {
    const key = `${pokemon.base.atk}|${pokemon.base.def}|${pokemon.base.sta}|${cap}|${maxLevel}`;
    if (ivCache.has(key)) return ivCache.get(key);
    const list = [];
    for (let a = 0; a <= 15; a++) for (let d = 0; d <= 15; d++) for (let s = 0; s <= 15; s++) {
      const st = leagueStats(data, pokemon.base, { atk: a, def: d, sta: s }, cap, maxLevel);
      if (st) list.push({ iv: { atk: a, def: d, sta: s }, ...st });
    }
    list.sort((x, y) => y.product - x.product || y.atk - x.atk);
    if (ivCache.size > 60) ivCache.clear();
    ivCache.set(key, list);
    return list;
  }

  // Rang einer IV-Kombination in einer Liga (1 = bestes Stat-Produkt; gleiche Produkte teilen sich den Rang).
  function ivRank(data, pokemon, iv, cap, maxLevel) {
    const table = ivTable(data, pokemon, cap, maxLevel);
    const mine = leagueStats(data, pokemon.base, iv, cap, maxLevel);
    if (!mine || !table.length) return null;
    const better = table.findIndex((e) => e.product <= mine.product + EPS);
    return {
      ...mine,
      rank: (better < 0 ? table.length : better) + 1,
      of: table.length,
      percent: mine.product / table[0].product,
      best: table[0],
    };
  }

  // Maximale WP auf einem Level – ob ein Pokémon überhaupt an eine WP-Grenze herankommt.
  const maxCp = (data, pokemon, level) => combatPower(pokemon.base, FULL_IV, cpmAt(data, level));

  return {
    FULL_IV, cpmAt, combatPower, statsAt, levelBoost, powerUpCost, upgradeTable,
    pveTarget, pvePerformance, pveMoves, bestPve, pveByType, pveStats, moveOf,
    levelUnderCap, leagueStats, ivTable, ivRank, maxCp,
  };
})();

if (typeof module === 'object' && module.exports) module.exports = PowerCalc;
