# Power-Kompass

**Lohnt sich das Power-up?** Für jedes Pokémon in **Pokémon GO** – normale, regionale Formen, Legendäre,
Mysteriöse, Ultrabestien, **Mega-Entwicklungen und Protomorphosen** sowie alle **Crypto-Pokémon** – zeigt die
Seite, wie gut es in **Raids und Arenen** ist, seine Werte auf jedem Level und was das Hochleveln kostet. Mit eigenen IVs.
Konter für einzelne Raid-Bosse stehen im [Raid-Kompass](https://jason-z-tech.github.io/raid-kompass/), Max-Kämpfe im
[Dyna-Kompass](https://jason-z-tech.github.io/dyna-kompass/). Max-Kämpfe und Trainerkämpfe (GO-Kampfliga) bewertet diese
Seite deshalb bewusst nicht.

- **Oben auf jeder Seite:** die **Suche** (deutsch, englisch oder Pokédex-Nummer wie „445“ oder „#025“; auch ohne
  Bindestrich wie „hooh“ und mit ae/oe/ue statt Umlaut) mit Vorschlägen – Pfeiltasten und Enter oder antippen öffnet
  das Pokémon, „Alle Treffer“ zeigt sie in der Liste – und der Schalter
  **„Crypto-Pokémon“**: An zählen Crypto-Pokémon überall mit; aus fehlen sie in allen Listen, und Plätze und
  Bewertungen sind ohne sie gerechnet (ein normales Mamutel steht dann z. B. bei Eis auf Platz 5 statt 8 und ist
  „Spitze“ statt „Lohnt sich“).
- **Vier Ansichten** (Reiter über der Liste):
  - **Alle Pokémon:** jedes Pokémon mit Urteil – „Spitze“, „Lohnt sich“, „Nische“, „Lohnt nicht“ oder „Entwickeln“
    (Vorstufe: erst entwickeln, dann leveln) – und dem wichtigsten Grund („Raids: Platz 3 Feuer“). Filter nach
    Anzeige (Urteil oder Rangliste), Bewertung, Typ und Art (Normal, Legendär/Mysteriös/Ultrabestien, Mega & Proto,
    nur Crypto). Mit „Rangliste“ und einem Angriffstyp wird die Liste zur vollständigen Raid-Rangliste dieses Typs. Zurück im Browser zeigt die Liste wieder so, wie sie war (Suche, Filter, Anzahl).
  - **Nach Typ:** 18 Typ-Knöpfe. Je Typ: wogegen er stark ist und wogegen seine Pokémon schwach sind, die 10 besten
    Raid-Angreifer, die 3 besten Megas und alle Pokémon dieses Typs (beste zuerst).
  - **Top-Rankings:** die besten Raid-Angreifer über alle Typen (jeweils in ihrem besten Typ), die Top 5 je Typ
    und die Top 3 Megas je Typ.
  - **Vergleich:** zwei Pokémon nebeneinander, jedes mit eigenen IVs und WP (die Seite findet daraus das Level),
    Glücks-Pokémon, Erlöst, Bester Kumpel und Mega-Level – z. B. ein Crypto-Mewtu mit 84 % gegen ein normales Mewtu
    mit 98 %. Gerechnet wird immer mit den besten Attacken (auch Top-TM-Attacken), denn lernen kann man sie alle.
    Ergebnis für einen Angriffstyp (gemeinsamer Typ oder frei wählbar): wer sich mehr lohnt
    (Wertung, DPS und TDO auf Level 40 und 50; unter 2 % Unterschied entscheidet das günstigere Hochleveln), Stufe
    und Platz in der Rangliste mit diesen IVs, WP, Angriff, Verteidigung, KP und die Kosten bis Level 40 und 50.
    Die Adresse enthält den ganzen Vergleich (zum Teilen); „Mit einem anderen Pokémon vergleichen“ auf der
    Pokémon-Seite übernimmt die eigenen Eingaben und stellt die Crypto- bzw. normale Form daneben.
- **Pokémon-Seite:** oben das Urteil mit Begründung und Links zu Crypto-, Mega- und Vorstufen/Entwicklungen.
  Darunter **„Dein Pokémon“**: IVs (standardmäßig 15/15/15 = 100 %, Vorlagen für Glücks-Minimum 12/12/12 und
  Raid-Minimum 10/10/10), „Level jetzt“ (oder WP eingeben – die Seite findet das Level, auch wenn die IVs danach
  kommen), Glücks-Pokémon, Erlöst (auch auf der Mega-Seite), Bester Kumpel und bei Megas das Mega-Level (Basis, High,
  Max, Super-Max). Das Urteil „Mit deinen IVs“ ändert sich mit den Eingaben (und wird Screenreadern angesagt). Drei
  Reiter:
  - **Bewertung:** Raids & Arenen (Platz je Angriffstyp, beste Attacken, DPS/TDO auf Level 40 und 50 mit deinen IVs,
    Hinweis auf nötige Top-TM-Attacken bzw. den Meteoriten für Zenitstürmer), Mega/Proto (Boni je Mega-Level,
    Zusatz-Lade-Attacke „+“, Super-Max-WP-Boost) und Besonderheiten (Formwechsel wie König des Schwertes, Fusionen wie
    Schwarzes Kyurem, Erlösen, zweite Lade-Attacke, Apex-Attacken, Kumpel-Distanz).
  - **Werte & Kosten:** WP, Angriff, Verteidigung und KP auf jedem Level von 1 bis 50 (auf Wunsch mit halben Leveln,
    mit Bester-Kumpel- oder Super-Max-Boost) und die aufsummierten Kosten an Sternenstaub, Bonbons und Bonbons XL ab dem
    aktuellen Level.
  - **Attacken:** alle Sofort- und Lade-Attacken mit ihren Werten für Raids und Arenen.

**Online:** https://jason-z-tech.github.io/PokemonGoGoodToKeep/

## Starten

Lokal: `index.html` doppelklicken. Die Seite braucht keinen Server und keine Installation.
Direktlinks: `index.html#pokemon=mamoswine`, `index.html#pokemon=crypto-mamoswine`, `index.html#pokemon=starmie-mega`,
Ansichten: `#typ` (Typ wählen), `#typ=fire` (Typ englisch), `#top=gesamt`, `#top=raid`, `#top=mega`,
vollständige Ranglisten in „Alle Pokémon“: `#rangliste=raid-fire`, `#rangliste=raid-fire-mega`,
Vergleich: `#vergleich=crypto-mewtwo:13-12-13:20,mewtwo:15-15-14:20` – je Pokémon
`schlüssel:angriff-vert-kp[:level[:merkmale]]` (das Level erscheint auf der Seite als WP), Merkmale `g` Glücks-Pokémon,
`e` Erlöst, `k` Bester Kumpel, `m1`–`m4` Mega-Level (z. B. `mewtwo-mega-y:15-15-15:40:m4`).

## Veröffentlichen (GitHub Pages)

Die Seite liegt im Repository `Jason-Z-tech/PokemonGoGoodToKeep` und wird wie `raid-kompass` und `dyna-kompass` von
GitHub Pages direkt aus dem Branch `main` ausgeliefert (einmalig einschalten: *Settings → Pages → Deploy from a
branch → main / (root)*). Änderungen gehen online, sobald sie committet und gepusht sind:

```powershell
node scripts/build-data.mjs --refresh   # neue Spieldaten
node tests/e2e.mjs                      # alles durchklicken
git add -A
git commit -m "Daten aktualisiert"
git push
```

Nach etwa einer Minute ist die neue Version online.

**Wenn sich etwas in `js/` oder `css/` geändert hat:** vor dem Push in `index.html` und `datenschutz.html` den Zusatz
`?v=2026-10-15-6` an den Skript- und Stylesheet-Adressen auf das heutige Datum setzen (suchen und ersetzen; am selben
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

Startet ein unsichtbares Chrome (oder Edge) und klickt die Seite mit echten Mausklicks durch – auf Desktop-, Tablet-,
Handy- und schmaler Handy-Breite (320 px): Liste, „Weitere anzeigen“, Suche oben (deutsch, englisch, Nummer, „#025“,
„hooh“, „ruestung“; Vorschläge, Escape, Pfeiltasten und Enter öffnen ein Pokémon), jeder Bewertungs-Filter (Anzahl wie
in den Daten; „Entwickeln“ fällt beim Wechsel zur Rangliste weg), die Raid-Ranglisten je Typ
(Reihenfolge und Plätze wie in den Daten, Megas getrennt), der Crypto-Schalter (ohne Crypto: keine Crypto-Pokémon,
Plätze neu gezählt, Bewertungen ohne sie), Filter zurücksetzen, die Ansicht „Nach Typ“ (Top 10, Megas, nur Pokémon
des Typs, zurück mit Fokus auf dem Eintrag), „Top-Rankings“ (Sortierung, Karten je Typ wie die Ranglisten),
Pokémon öffnen und zurück, IV-Eingabe, Vorlagen, halbe Level, Bester Kumpel, Level jetzt, WP-Eingabe (auch erst WP,
dann IVs; Statuszeile für Screenreader), Glücks-Pokémon, Crypto-Kosten, Mega-Level (Super-Max: Werte 2 Level höher),
„Erlöst“ auf der Mega-Seite, die Marken Top-TM und Meteorit, Reiter per Tastatur, Zurück aus einer Rangliste (Liste
mit Suche wie vorher), der Vergleich (WP, Angriff im Kampf und Kosten unabhängig nachgerechnet, Gewinner,
Markierungen, Adresse, WP-Eingabe → Level auch nach geänderten IVs, Suchfeld per Tastatur, Tauschen, Mega auf
Super-Max, Beispiel-Knopf, Link von der Pokémon-Seite und zurück, ohne Crypto) und die Datenschutz-Seite. WP, KP und Kosten rechnet der Test **unabhängig von `js/calc.js`** nach (u. a. Mewtu 4178 WP auf
Level 40 und 4724 auf Level 50, 270 000 Sternenstaub und 304 Bonbons bis Level 40, 296 Bonbons XL bis 50, Crypto 360,
Erlöst 272). Auf dem Desktop wird jede Pokémon-Seite mit allen drei Reitern gezeichnet (auf Tablet, Handy und schmalem
Handy jede siebte, fünfte bzw. dreizehnte), zusätzlich jede zehnte ohne Crypto – ohne Fehler, ohne seitlichen Überlauf
und ohne Felder, die aus ihrem Rahmen ragen.
Benötigt Node.js ab Version 22 und Chrome oder Edge.

## Daten aktualisieren

```powershell
node scripts/build-data.mjs --refresh
```

Das Skript
1. lädt die aktuellen Spieldaten (Game Master von [PokeMiners](https://github.com/PokeMiners/game_masters)), die
   offiziellen deutschen und englischen Spieltexte ([holoholo-text](https://github.com/sora10pls/holoholo-text)),
   die Release-Angaben und Attacken von [PvPoke](https://github.com/pvpoke/pvpoke) (für Attacken, die der Game Master
   noch nicht kennt),
2. nimmt nur Pokémon auf, die im Spiel erschienen sind (Angaben von PvPoke, ergänzt um `RELEASE_FIXES` für Pokémon,
   die im Trainerkampf nicht antreten können – Ditto, Ninjatom, Cosmog …),
3. stellt Crypto-Versionen, Mega-Entwicklungen und Protomorphosen, Entwicklungen und Formwechsel zusammen,
4. rechnet die Raid-Ranglisten je Typ (mit `js/calc.js`, wie die Seite) und vergibt die Bewertungen – einmal mit und
   einmal ohne Crypto-Pokémon,
5. lädt die Artworks von [PokeAPI](https://pokeapi.co) und wandelt sie mit Chrome/Edge in kleine **WebP**-Dateien um,
6. schreibt alles nach `data/pokemon-data.js`.

Ohne `--refresh` werden die zwischengespeicherten Daten aus `scripts/.cache/` verwendet. `--report` gibt zusätzlich
die Top 15 jeder Raid-Rangliste aus. Benötigt nur Node.js (ab Version 22) und Chrome oder Edge, keine Pakete.
Am Ende listet das Skript Hinweise auf, z. B. PvPoke-Attacken ohne Gegenstück in den Spieldaten oder Pokémon ohne Bild.

## So wird bewertet

Das Urteil richtet sich nach **Raids und Arenen** (bester Angriffstyp, bei normalen Pokémon auch ihre Mega-Entwicklung).

- **Raids & Arenen:** Für jeden Angriffstyp eine Rangliste aller Pokémon (normal und Crypto; Mega-Entwicklungen
  getrennt, weil pro Person nur eine aktiv ist) gegen einen 5-Sterne-Boss (Verteidigung 200), der gegen diesen Typ
  schwach ist (×1,6) und gegen alle anderen neutral. Level 40, 15/15/15, beste Attacken (Lade-Attacke dieses Typs,
  Sofort-Attacke beliebig, Kraftreserve nicht). DPS und TDO nach GamePress („Comprehensive DPS“, eingehender Schaden
  y = 900 / Verteidigung; bei Lade-Attacken mit 100 Energie verfällt überschüssige Energie), Wertung
  (DPS³ × TDO)<sup>¼</sup>. **Spitze:** die fünf Besten des Typs; **Lohnt sich:**
  mindestens 90 % der Wertung des Fünftbesten; **Nische:** mindestens 80 %. Megas: Spitze ab 95 % der besten Mega,
  Lohnt sich ab 85 %, Nische ab 75 %. Braucht ein Pokémon dafür eine Top-TM-Attacke (oder Zenitstürmer per
  Meteorit), sagt die Seite, wie es ohne steht.
- **Ohne Crypto:** Dieselben Ranglisten ohne Crypto-Pokémon, mit dem Fünftbesten ohne Crypto als Vergleich – Plätze
  und Stufen (Felder `rankNS`, `gradeNS`, `evolveNS`, `betterNS` in den Daten) gelten, wenn der Schalter aus ist.
- **Mit deinen IVs:** In Raids zählen IVs wenig – erst unter 94 % der Wertung von 15/15/15 sinkt die Stufe um eine
  („Der Angriff ist zu niedrig“).
- **Mega & Proto:** Eine Mega zählt für ihre normale Form mit (wer die normale Form hochlevelt, levelt die Mega mit).
  Gerechnet wird mit dem höchsten Mega-Level: Zusatz-Lade-Attacke „+“ mit ×1,0 / 1,1 / 1,2 / 1,3 (Basis bis
  Super-Max) und auf dem Super-Max-Level 2 Level mehr (`selfCpBoostAdditionalLevel` in den Spieldaten). Boni je Mega-Level
  aus den Spieldaten: Bonbons +1/+1/+2/+3, XL-Chance –/10/25/30 %, EP –/+50/+100/+200 für gefangene Pokémon passender
  Typen, Ruhezeit 7/5/3/1 Tage, Super-Max zusätzlich 5000 Mega-Energie. Der Raid-Bonus (+10 %, eigener Typ +30 %) gilt
  für alle anderen im Raid, nicht für die Mega selbst.
- **Vergleich:** dieselbe Rechnung wie die Ranglisten, aber mit den eingegebenen IVs und dem Level aus den WP beider
  Pokémon gegen denselben Boss (beste Attacken). Stufe und Platz „mit diesen IVs“ vergleichen die eigene Wertung auf Level 40 mit der
  Rangliste des Typs (Maßstab wie dort: der Fünftbeste bzw. die beste Mega).
- **Entwickeln:** Taugt eine Vorstufe selbst nichts (Stufe „Lohnt nicht“), eine Entwicklung aber schon, heißt das
  Urteil „Erst entwickeln“ – mit Kosten und Bedingungen der Entwicklung (bei Crypto ohne Tausch-Bedingung, erlöst mit
  den Erlöst-Bonbons). Taugt die Vorstufe selbst schon etwas, behält sie ihr Urteil, und die Seite nennt die stärkere
  Entwicklung nur als Hinweis („Noch stärker nach der Entwicklung zu …“).

**Werte und Kosten:** WP = ⌊(Angriff + IV) × √(Verteidigung + IV) × √(KP + IV) × CPM² ÷ 10⌋, CPM aus den Spieldaten
(halbe Level als Wurzel-Mitte). Power-up-Kosten aus `POKEMON_UPGRADE_SETTINGS` (Endynalos mit eigener Tabelle):
Crypto ×1,2, Erlöst ×0,9 (Sternenstaub und Bonbons), Glücks-Pokémon ×0,5 Sternenstaub, jeder Schritt aufgerundet.
Ab Level 40 Bonbons XL statt Bonbons. Bester Kumpel kämpft 1 Level höher. Crypto-Pokémon kämpfen mit ×1,2 Angriff und
×0,83 Verteidigung (in den WP nicht sichtbar).

Die Bewertung ist eine Schätzung: Wetter, Freundschafts-Bonus, Ausweichen, Teamwahl und Party-Power sind nicht
eingerechnet.

## Aufbau

```
index.html                 Ansichten Alle Pokémon / Nach Typ / Top-Rankings / Vergleich und Pokémon-Seite (#pokemon=<schlüssel>)
datenschutz.html           Datenschutzerklärung
assets/favicon.svg         Seiten-Icon (eigenes Design: Power-up-Pfeil)
css/style.css              Design
js/calc.js                 Rechnung (Werte, Kosten, Raid-DPS) – auch vom Daten-Skript genutzt
js/shared.js               gemeinsame Bausteine (DOM-Helfer, Bewertungen, Crypto-Schalter, Formatierung)
js/search.js               Suche oben mit Vorschlägen
js/overview.js             Ansicht "Alle Pokémon": Liste, Filter, vollständige Ranglisten
js/browse.js               Ansichten "Nach Typ" und "Top-Rankings"
js/compare.js              Ansicht "Vergleich": zwei Pokémon mit IVs nebeneinander
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
- **Erschienene Pokémon:** Angaben von [PvPoke](https://github.com/pvpoke/pvpoke) (Open Source), mit Quellenangabe.
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
