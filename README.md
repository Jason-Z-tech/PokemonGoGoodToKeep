# Power-Kompass

**Lohnt sich das Power-up?** Für jedes Pokémon in **Pokémon GO** – normale, regionale Formen, Legendäre,
Mysteriöse, Ultrabestien, **Mega-Entwicklungen und Protomorphosen** sowie alle **Crypto-Pokémon** – zeigt die
Seite, wofür es taugt, seine Werte auf jedem Level und was das Hochleveln kostet. Mit eigenen IVs.
Raid-Konter stehen im [Raid-Kompass](https://jason-z-tech.github.io/raid-kompass/), Max-Kämpfe im
[Dyna-Kompass](https://jason-z-tech.github.io/dyna-kompass/).

- **Startseite:** alle Pokémon mit Urteil – „Spitze“, „Lohnt sich“, „Nische“, „Lohnt nicht“ oder „Entwickeln“
  (Vorstufe: erst entwickeln, dann leveln) – und dem wichtigsten Grund („Raids: Platz 3 Feuer“, „Superliga: Platz 12“).
  Suche (deutsch, englisch, Pokédex-Nummer), Filter nach Bewertung, Einsatz (Raids & Arenen, Superliga, Hyperliga,
  Meisterliga, Max-Kämpfe), Typ und Art (Normal, Legendär & Mysteriös, Mega & Proto, Crypto). Mit Einsatz „Raids“
  und einem Angriffstyp wird die Liste zur Rangliste der besten Angreifer dieses Typs (Megas getrennt).
- **Pokémon-Seite:** oben das Urteil mit Begründung und Links zu Crypto-, Mega- und Vorstufen/Entwicklungen.
  Darunter **„Dein Pokémon“**: IVs (standardmäßig 15/15/15 = 100 %, Vorlagen für Superliga- und Hyperliga-Ideal),
  „Level jetzt“ (oder WP eingeben – die Seite findet das Level), Glücks-Pokémon, Erlöst, Bester Kumpel und bei
  Megas das Mega-Level (Basis, High, Max, Super-Max). Das Urteil „Mit deinen IVs“ ändert sich mit den Eingaben.
  Drei Reiter:
  - **Bewertung:** Raids & Arenen (Platz je Angriffstyp, beste Attacken, DPS/TDO auf Level 40 und 50 mit deinen IVs,
    Hinweis auf nötige Elite-Attacken), Kampfliga (Platz bei PvPoke, empfohlene Attacken, Level/WP/IV-Rang deiner IVs
    unter der WP-Grenze, Kosten bis dorthin), Mega/Proto (Boni je Mega-Level, Zusatz-Lade-Attacke „+“,
    Super-Max-WP-Boost), Max-Kämpfe (nur Dynamax-Exemplare) und Besonderheiten (Formwechsel wie König des Schwertes,
    Fusionen wie Schwarzes Kyurem, Erlösen, zweite Lade-Attacke, Apex-Attacken, Kumpel-Distanz).
  - **Werte & Kosten:** WP, Angriff, Verteidigung und KP auf jedem Level von 1 bis 50 (auf Wunsch mit halben Leveln,
    mit Bester-Kumpel- oder Super-Max-Boost) und die aufsummierten Kosten an Sternenstaub, Bonbons und Bonbons XL ab dem
    aktuellen Level.
  - **Attacken:** alle Sofort- und Lade-Attacken mit Werten für Raids und für die Kampfliga.

**Online:** https://jason-z-tech.github.io/PokemonGoGoodToKeep/

## Starten

Lokal: `index.html` doppelklicken. Die Seite braucht keinen Server und keine Installation.
Direktlinks: `index.html#pokemon=mamoswine`, `index.html#pokemon=crypto-mamoswine`, `index.html#pokemon=starmie-mega`,
Ranglisten: `index.html#rangliste=raid-fire` (Typ englisch), `#rangliste=raid-fire-mega`, `#rangliste=great`,
`#rangliste=ultra`, `#rangliste=master`.

## Veröffentlichen (GitHub Pages)

Die Seite liegt im Repository `Jason-Z-tech/PokemonGoGoodToKeep` und wird wie `raid-kompass` und `dyna-kompass` von
GitHub Pages direkt aus dem Branch `main` ausgeliefert (einmalig einschalten: *Settings → Pages → Deploy from a
branch → main / (root)*). Änderungen gehen online, sobald sie committet und gepusht sind:

```powershell
node scripts/build-data.mjs --refresh   # neue Spieldaten und Ranglisten
node tests/e2e.mjs                      # alles durchklicken
git add -A
git commit -m "Daten aktualisiert"
git push
```

Nach etwa einer Minute ist die neue Version online.

**Wenn sich etwas in `js/` oder `css/` geändert hat:** vor dem Push in `index.html` und `datenschutz.html` den Zusatz
`?v=2026-10-15-1` an den Skript- und Stylesheet-Adressen auf das heutige Datum setzen (suchen und ersetzen; am selben
Tag mit `-2`, `-3` … anhängen). Browser behalten Dateien von GitHub Pages bis zu 10 Minuten und würden sonst alte und
neue Skripte mischen.

GitHub Pages unterstützt keine eigenen HTTP-Header; die Sicherheitsregeln (Content-Security-Policy) stehen deshalb als
`<meta>`-Tag in jeder Seite. `_headers` gilt nur, falls die Seite auf Netlify / Cloudflare Pages umzieht.
`.nojekyll` sorgt dafür, dass GitHub die Dateien unverändert ausliefert.

## Testen

```powershell
node tests/e2e.mjs                                                       # lokale Kopie
node tests/e2e.mjs --url https://jason-z-tech.github.io/PokemonGoGoodToKeep/   # veröffentlichte Seite
```

Startet ein unsichtbares Chrome (oder Edge) und klickt die Seite mit echten Mausklicks durch – auf Desktop-, Tablet-
und Handy-Breite: Liste, „Weitere anzeigen“, Suche (deutsch, englisch, Nummer), jeder Bewertungs-Filter (Anzahl wie in
den Daten), die Ranglisten der drei Ligen und der Raid-Typen (Reihenfolge wie in den Daten), Filter zurücksetzen,
Pokémon öffnen und zurück (Fokus auf der Kachel), IV-Eingabe, Vorlagen, halbe Level, Bester Kumpel, Level jetzt,
WP-Eingabe, Glücks-Pokémon, Crypto-Kosten, Mega-Level (Super-Max: Werte 2 Level höher), Reiter per Tastatur und die
Datenschutz-Seite. WP, KP und Kosten rechnet der Test **unabhängig von `js/calc.js`** nach (u. a. Mewtu 4178 WP auf
Level 40 und 4724 auf Level 50, 270 000 Sternenstaub und 304 Bonbons bis Level 40, 296 Bonbons XL bis 50, Crypto 360,
Erlöst 272). Auf dem Desktop wird jede Pokémon-Seite mit allen drei Reitern gezeichnet (auf Tablet und Handy jede
siebte bzw. fünfte) – ohne Fehler und ohne seitlichen Überlauf.
Benötigt Node.js ab Version 22 und Chrome oder Edge.

## Daten aktualisieren

```powershell
node scripts/build-data.mjs --refresh
```

Das Skript
1. lädt die aktuellen Spieldaten (Game Master von [PokeMiners](https://github.com/PokeMiners/game_masters)), die
   offiziellen deutschen und englischen Spieltexte ([holoholo-text](https://github.com/sora10pls/holoholo-text)),
   die Liga-Ranglisten und Release-Angaben von [PvPoke](https://github.com/pvpoke/pvpoke) und die Dynamax-Daten des
   [Dyna-Kompass](https://github.com/Jason-Z-tech/dyna-kompass),
2. nimmt nur Pokémon auf, die im Spiel erschienen sind (Angaben von PvPoke, ergänzt um `RELEASE_FIXES` für Pokémon,
   die im Trainerkampf nicht antreten können – Ditto, Ninjatom, Cosmog …),
3. stellt Crypto-Versionen, Mega-Entwicklungen und Protomorphosen, Entwicklungen und Formwechsel zusammen,
4. rechnet die Raid-Ranglisten je Typ (mit `js/calc.js`, wie die Seite) und vergibt die Bewertungen,
5. lädt die Artworks von [PokeAPI](https://pokeapi.co) und wandelt sie mit Chrome/Edge in kleine **WebP**-Dateien um,
6. schreibt alles nach `data/pokemon-data.js`.

Ohne `--refresh` werden die zwischengespeicherten Daten aus `scripts/.cache/` verwendet. `--report` gibt zusätzlich
die Top 15 jeder Raid-Rangliste aus. Benötigt nur Node.js (ab Version 22) und Chrome oder Edge, keine Pakete.
Am Ende listet das Skript Hinweise auf, z. B. ein Dynamax-Pokémon, das es keinem Eintrag zuordnen konnte.

## So wird bewertet

Pro Pokémon gibt es eine Stufe je Einsatz; das Urteil ist die beste davon.

- **Raids & Arenen:** Für jeden Angriffstyp eine Rangliste aller Pokémon (normal und Crypto; Mega-Entwicklungen
  getrennt, weil pro Person nur eine aktiv ist) gegen einen 5-Sterne-Boss (Verteidigung 200), der gegen diesen Typ
  schwach ist (×1,6) und gegen alle anderen neutral. Level 40, 15/15/15, beste Attacken (Lade-Attacke dieses Typs,
  Sofort-Attacke beliebig, Kraftreserve nicht). DPS und TDO nach GamePress („Comprehensive DPS“, eingehender Schaden
  y = 900 / Verteidigung), Wertung (DPS³ × TDO)<sup>¼</sup>. **Spitze:** die fünf Besten des Typs; **Lohnt sich:**
  mindestens 90 % der Wertung des Fünftbesten; **Nische:** mindestens 80 %. Megas: Spitze ab 95 % der besten Mega,
  Lohnt sich ab 85 %, Nische ab 75 %. Braucht ein Pokémon dafür eine Elite-Attacke, sagt die Seite, wie es ohne steht.
- **Kampfliga:** Platz in der Gesamt-Rangliste von PvPoke: Top 25 Spitze, Top 75 Lohnt sich, Top 200 Nische.
  Für deine IVs rechnet die Seite selbst: höchstes Level unter der WP-Grenze (bis Level 50, mit Bester Kumpel 51),
  Stat-Produkt (Angriff × Verteidigung × KP) und Rang unter allen 4096 IV-Kombinationen.
- **Mit deinen IVs:** In den Ligen zählen IVs viel – unter 98 % des besten Stat-Produkts sinkt die Stufe um eine,
  unter 95 % um zwei. In Raids zählen sie wenig – erst unter 94 % der Wertung von 15/15/15 sinkt sie um eine.
- **Mega & Proto:** Eine Mega zählt für ihre normale Form mit (wer die normale Form hochlevelt, levelt die Mega mit).
  Gerechnet wird mit dem höchsten Mega-Level: Zusatz-Lade-Attacke „+“ mit ×1,0 / 1,1 / 1,2 / 1,3 (Basis bis
  Super-Max) und auf dem Super-Max-Level 2 Level mehr (`selfCpBoostAdditionalLevel` in den Spieldaten). Boni je Mega-Level
  aus den Spieldaten: Bonbons +1/+1/+2/+3, XL-Chance –/10/25/30 %, EP –/+50/+100/+200 für gefangene Pokémon passender
  Typen, Ruhezeit 7/5/3/1 Tage, Super-Max zusätzlich 5000 Mega-Energie. Der Raid-Bonus (+10 %, eigener Typ +30 %) gilt
  für alle anderen im Raid, nicht für die Mega selbst.
- **Max-Kämpfe:** Nur für Dynamax-/Gigadynamax-Exemplare – deshalb zählen sie nicht zum Urteil, sondern stehen getrennt
  (Platz als Angreifer je Typ und als Tank, Daten des Dyna-Kompass).
- **Entwickeln:** Taugt eine Entwicklung mehr als das Pokémon selbst, heißt das Urteil „Erst entwickeln“ – mit Kosten
  und Bedingungen der Entwicklung.

**Werte und Kosten:** WP = ⌊(Angriff + IV) × √(Verteidigung + IV) × √(KP + IV) × CPM² ÷ 10⌋, CPM aus den Spieldaten
(halbe Level als Wurzel-Mitte). Power-up-Kosten aus `POKEMON_UPGRADE_SETTINGS` (Endynalos mit eigener Tabelle):
Crypto ×1,2, Erlöst ×0,9 (Sternenstaub und Bonbons), Glücks-Pokémon ×0,5 Sternenstaub, jeder Schritt aufgerundet.
Ab Level 40 Bonbons XL statt Bonbons. Bester Kumpel kämpft 1 Level höher. Crypto-Pokémon kämpfen mit ×1,2 Angriff und
×0,83 Verteidigung (in den WP nicht sichtbar).

Die Bewertung ist eine Schätzung: Wetter, Freundschafts-Bonus, Ausweichen, Teamwahl und Party-Power sind nicht
eingerechnet.

## Aufbau

```
index.html                 Startseite (Liste, #rangliste=…) und Pokémon-Seite (#pokemon=<schlüssel>)
datenschutz.html           Datenschutzerklärung
assets/favicon.svg         Seiten-Icon (eigenes Design: Power-up-Pfeil)
css/style.css              Design
js/calc.js                 Rechnung (Werte, Kosten, Raid-DPS, IV-Rang) – auch vom Daten-Skript genutzt
js/shared.js               gemeinsame Bausteine (DOM-Helfer, Bewertungen, Formatierung)
js/overview.js             Startseite: Liste, Suche, Filter, Ranglisten
js/detail.js               Pokémon-Seite: Urteil, Dein Pokémon, Reiter Bewertung / Werte & Kosten / Attacken
js/app.js                  Start und Navigation (Zurück-Link, Browser-Verlauf, Fokus)
data/pokemon-data.js       erzeugte Daten (nicht von Hand bearbeiten)
assets/img/                Pokémon-Bilder als WebP (erzeugt)
assets/fonts/              Schriften, lokal eingebunden
scripts/build-data.mjs     Daten-Skript
scripts/images.mjs         Bilder mit Chrome in WebP umwandeln
scripts/browser.mjs        steuert Chrome (für Bilder und Tests)
tests/e2e.mjs              Klick-Test
.nojekyll                  GitHub Pages liefert die Dateien unverändert aus
_headers                   Sicherheits-Header, falls die Seite später auf Netlify / Cloudflare Pages umzieht
```

## Lizenzen und Hinweise

- **Schriften:** Chakra Petch und Manrope, SIL Open Font License (siehe `assets/fonts/OFL-*.txt`).
- **Bilder:** Offizielle Artworks über PokeAPI. Sie sind urheberrechtlich geschützt (Nintendo / Creatures / GAME FREAK)
  und werden hier ohne Lizenz in einem nicht-kommerziellen Fanprojekt verwendet – wie auf vielen Pokémon-GO-Infoseiten.
- **Liga-Ranglisten:** [PvPoke](https://pvpoke.com) (Open Source), mit Quellenangabe.
- Inoffizielles, nicht-kommerzielles Fanprojekt ohne Verbindung zu Nintendo, The Pokémon Company oder Scopely.
  Pokémon, Pokémon GO und die Namen der Pokémon sind Marken von Nintendo. © Pokémon/Nintendo/Creatures/GAME FREAK.

## Plan B: Bilder entfernen

Falls eine Löschaufforderung (z. B. an GitHub) kommt, sofort ohne offizielle Bilder neu bauen und veröffentlichen:

```powershell
node scripts/build-data.mjs --no-images   # entfernt assets/img/, zeigt Pokédex-Nummer + Typfarben
git add -A
git commit -m "Offizielle Artworks entfernt"
git push
```

Wichtig: Die Bilder bleiben danach noch in der Git-Historie. Verlangt die Meldung auch deren Entfernung,
muss die Historie bereinigt oder das Repository neu angelegt werden.
Mit einem normalen `node scripts/build-data.mjs` kommen die Bilder aus dem Zwischenspeicher zurück.
