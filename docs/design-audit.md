# Design-Audit „Atem & Ruhe" — Befund & Umsetzung (2026-07-01)

Ziel: Konsistenz, Vollständigkeit, Feinschliff — keine Neugestaltung.
Umgesetzt in drei gestapelten PRs: **01 Tokens · 02 Zustände · 03 Kontrast**.
Erkennungslogik und Layout unangetastet.

---

## Phase 1 – Token-Treue (PR `design/01-tokens`)

Inventar vorher → nachher (alles `app/style.css`, sofern nicht anders genannt):

| Kategorie | Vorher | Nachher |
|---|---|---|
| Hex/rgba außerhalb `:root` | 35 Stellen | **0** (nur `50%`-Kreise und `border-radius: 0` bleiben roh) |
| Font-Größen | 27 Streuwerte (0.68–2.1rem) | 7 Stufen `--text-xs…2xl` |
| Zeilenhöhen | 10 Streuwerte (1.08–1.7) | 3 Stufen `--leading-tight/normal/relaxed` |
| Abstände | ~60 Streuwerte | `--space-1…8` (4px-Grid), Deltas ≤ 2–3px |
| Radien | 9 Werte | `--radius-xs/sm/md/lg/full` |
| Schatten | 2 Ad-hoc-Werte | `--shadow-soft/--shadow-lifted` (color-mix statt rgba) |
| Motion | 12 Ad-hoc-Durationen/Easings | `--dur-quick/soft/calm/drift` + `--ease-calm/--ease-breath` |

Entscheidungen:
- **Office Mode** behält seine markenfremde Optik (Tarnung, siehe decisions.md
  2026-06-10), wird aber als eigene `--office-*`-Gruppe systematisiert —
  gleiche Farben, jetzt zentral. `#E3E6EA` → `--office-line` (Ausreißer
  angeglichen), Status-Punkt warm/ember nutzt jetzt direkt `var(--warm/--ember)`.
- **JS token-treu**: Proximity-Meter setzt `var(--warm/--breath)` als
  Inline-Style; Canvas-Overlay liest Tokens über `getComputedStyle`
  (`tokenColor()`-Cache in app.js). Privacy-SVG: `stroke="currentColor"`.
- **Bewusste Ausnahmen**: weiße Konturen im Video-Overlay
  (`rgba(255,255,255,…)` in drawPoint/drawLine — Sichtbarkeit auf Livebild,
  kein UI-Element); responsive `clamp()`-Displaygrößen; `7rem` Freiraum
  unter `.app-shell` (Funktionsmaß für die fixe Tab-Leiste).
- `--breath-dur` behält seinen Namen (Pill-Spike hängt daran).
- `prefers-reduced-motion` deckt jetzt auch `veil-in` (Alert) und
  `soft-arrive` (Onboarding) ab, nicht mehr nur den Ring.

## Phase 2 – Zustands-Vollständigkeit (PR `design/02-states`)

- **Fokus-Ringe markenkonform**: global `2px var(--ember)` (3.4:1 auf Mist ✓)
  statt Pine; `textarea` in die globale Regel aufgenommen. Auf dem
  Pine-Schleier (Alert) ist Paper der Fokus-Ring. Office bleibt bewusst
  System-Ink (Tarnung), inkl. neu sichtbarem Fokus der Editor-Textarea
  (vorher `outline: none` = unsichtbar für Tastatur-Nutzer).
- **Buttons**: `:active` (Pine-Einschlag), `:disabled` (55 % Deckkraft,
  Hover neutralisiert via `:not(:disabled)`). Der Start-Button ist während
  des Modell-Ladens jetzt erkennbar inaktiv.
- **Selects** hovern wie Buttons (+ `cursor: pointer`), **Slider-Thumbs**
  dunkeln auf `--pine-deep` nach.
- **Mode-Tabs**: gedrückt nur Farbwechsel, keine Pill-Fläche (Textmarken).
- `body[data-state]`-Durchgang (calm/warm/ember/paused): konsistent —
  Ring-Farbe/Tempo, state-word-Farbe, Office-Punkt und Pausen-Button folgen
  alle derselben Logik. Einzige Lücke: `state.emberHint` ist leer (→ Phase 5c).

## Phase 3 – Kontrast (PR `design/03-contrast`)

WCAG-AA-Prüfung aller Text/Hintergrund-Paare der Palette (4.5:1 Fließtext,
3:1 große Schrift/UI). **Verstöße und Fixes** (Ton nachjustiert, Palette
unverändert):

| Paar | Vorher | Nachher |
|---|---|---|
| `--moss` auf Mist (Sekundärtext, meistgenutzt) | 4.05:1 ✗ | `#567163` → **4.70:1 ✓** |
| `--moss` auf Paper | 4.45:1 ✗ | **5.17:1 ✓** |
| `--office-muted` auf Office-Bar (Fußzeile 12px) | 3.05:1 ✗ | `#68707A` → **4.85:1 ✓** |
| `--office-placeholder` auf Weiß | 1.89:1 ✗ | `#6F7780` → **4.54:1 ✓** |

Bestanden (unverändert): `--warm-text` 5.6:1, `--ember-text` 6.6:1,
`--paper-dim` auf Pine 9.1:1, Paper auf Pine 11.8:1, `--office-text` 6.0:1,
Ember-Fokusring 3.4:1 (≥3:1 für Indikatoren).

**Bewusst nicht „gefixt"** (Grafik, kein Text — Sanftheit ist Designabsicht;
dokumentiert statt verändert): Breath-Balken auf Paper 1.8:1, Warm-Peak
2.5:1, Paused-Ring (`--still`) 1.6:1. Empfehlung, falls Barrierefreiheit
vertieft wird: 1px-Kontur `--moss` auf Chart-Balken (S).

## Phase 4 – Referenz-Lücken (nur Bericht)

Zum Zeitpunkt dieses Audits zeigte `docs/design-referenz.html` nur Focus /
Review / Einstellungen. **Damals fehlten reale App-Zustände:**
- Start-Panel (First-Run) und Fehlerzustand (`.error-message`)
- Onboarding-Wizard (4 Schritte, Blur-Overlay)
- Interventions-Panel (Pine-Vollbild-Schleier) — der wichtigste Moment der App
- paused-Zustand (Still-Ring) als eigenes Bild
- Office Mode (bewusst markenfrei — trotzdem als Referenz-Screen wertvoll)
- Landing (tawel.app) und Pill-Modus (Tauri) als neue Oberflächen

**Nachtrag 2026-07-21 (Codex):** Die Referenz wurde zur lebenden Token-Ansicht
umgebaut und deckt Buttons/Inputs, Ringzustände, Kamera-Fehler, Review-Leere und
Office Mode ab. Landing und native Mac-Flächen werden als Geltungsbereich bzw.
separate Abgleichsflächen dokumentiert; sie werden nicht als erfundene UI
nachgebaut.

**Dark Mode — Empfehlung (nicht umgesetzt):** Durch die Token-Basis jetzt
realistisch als reine `:root`-Umbelegung unter
`@media (prefers-color-scheme: dark)` (+ `color-scheme: light dark`).
Umzubelegen: Flächen (mist/paper → tiefe Grüntöne), Text (pine/moss →
helle Töne), Zustandsfarben leicht aufhellen, `--shadow-*` abdunkeln;
`color-mix`-Ableitungen gegenprüfen. Sonderfall: Office-Tarnung braucht ein
eigenes dunkles Set (heller Fake-Editor fällt im Dark-System auf).
Aufwand grob: **M** (1 fokussierte Session + Kontrast-Pass).

**Icon-Inventar:** Nur ein Inline-SVG in der App (Schild, stroke 1.4,
runde Joins) + `icons/icon.svg` (flächig) — noch kein Stil-Konflikt.
Pill-Steuerung (Spike) nutzt Text-Glyphen (✕ ⤢). Empfehlung: ab dem
nächsten Icon ein Mini-Set festschreiben (1.5px Strich, runde Kappen,
16er-Raster) und Text-Glyphen durch SVGs ersetzen (S).

## Phase 5 – Premium-Roadmap (Vorschläge, nicht gebaut)

Priorisiert nach Premium-Effekt ÷ Aufwand:

1. **Ring-Zustandswechsel wirklich fließend (M)** — Das Atmen selbst ist
   jetzt sinusförmig (`--ease-breath`), aber beim Zustandswechsel springt
   `--breath-dur` hart von 4.6s auf 2.6/1.6s: `animation-duration` ist nicht
   interpolierbar → die Ring-Phase ruckt genau in dem Moment, der Achtsamkeit
   vermitteln soll. Vorschlag: Atmen per Web Animations API treiben und beim
   Zustandswechsel `updatePlaybackRate()` sanft rampen (Phase bleibt erhalten,
   Tempo gleitet). Halo minimal versetzt takten (Delay ~ -8 %) für organische
   Tiefe. Größter Hebel: Signature-Element der Marke.
2. **Microcopy der Randzustände (S)** — `state.emberHint` ist leer (unter
   „Innehalten" fehlt die eine ruhige Zeile); „Nähe: wartet" / „Distanz: --"
   klingen nach Debug-Ausgabe; Fehler-Hints nennen MediaPipe (Nutzern fremd).
   Ein Text-Pass über ~10 i18n-Keys (DE+EN) im Markenton — billigster
   Premium-Gewinn im ganzen Audit.
3. **First-Run veredeln (M)** — Nach „Kamera starten" wechselt nur der
   Button-Text („Modell wird geladen …"); kein ruhiges Lade-Visual. Vorschlag:
   den atmenden Ring bereits als Ladezustand zeigen (Still-Farbe → Breath beim
   Bereitwerden), Onboarding-Signale weicher formulieren. Der allererste
   Moment entscheidet über „wertig vs. technisch".
4. **App-Icon (M)** — `icon.svg` hat ein starkes Konzept (Lunula/Nagelmond in
   Markenfarben), ist aber flächig-flach: kein macOS-Squircle-Masterformat,
   keine Tiefe/Licht, im Dock-Format schwach differenziert. Für den
   Mac-Launch: 1024px-Master mit dezentem Verlauf/Licht, korrekte
   macOS-Maske, Test auf hellem/dunklem Dock. (Richtung Launch, nicht jetzt.)
