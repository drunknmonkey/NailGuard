# Pill-Modus (immer sichtbares Mini-Fenster)

Erster Produkt-Baustein auf dem validierten Spike-Scaffold. Aufbauend auf dem
Spike-Ergebnis: Die WebView-Erkennung läuft mit voller Rate (~50/s), **solange das
Fenster sichtbar ist – auch unfokussiert**; sobald es `hidden` ist (minimiert oder
komplett verdeckt), stoppt `requestAnimationFrame` auf ~0/s.

Der Pill-Modus macht genau den Fall „unfokussiert, aber sichtbar" dauerhaft: ein
kompaktes, **immer im Vordergrund** schwebendes Mini-Fenster, das der Nutzer in eine
Bildschirmecke heftet, während er in anderen Apps arbeitet.

## Architektur: EIN Fenster, EIN WebView

Es gibt nur ein Fenster mit einem WebView. Voll- und Pill-Modus sind nur zwei
Darstellungen desselben WebViews. **Kamera-Stream und rAF-Erkennungsschleife laufen
über den Moduswechsel hinweg unverändert weiter** – der Stream wird nie abgebaut, das
WebView nie ausgetauscht. Ein zweites Fenster/WebView hätte den Kamera-Stream nicht.

Der Wechsel ändert nur:

- **CSS-Klasse** `body.pill-mode` (blendet die volle UI aus, zeigt die Pill-Bühne).
- **Fenster-Eigenschaften** über kleine Rust-Commands (Größe, rahmenlos, immer oben,
  alle Spaces, Collection Behavior).

Dass die Erkennung bei ausgeblendeter UI weiterläuft, ist abgesichert: Die App erkennt
bereits im Focus-/Office-Modus, während die Kamera-Ansicht (ein inaktives `display:none`-
View) verborgen ist. Der Pill-Modus blendet zusätzlich `.app-shell` aus – dieselbe
Mechanik.

## Bausteine

| Datei | Rolle |
|-------|-------|
| `spike/pill.js` | Baut die Pill-Bühne (Ring + Drag-Grip) und den „Andocken"-Button; ruft die Rust-Commands; merkt die Position. |
| `spike/pill.css` | Pill-Styling. **Wiederverwendung:** Ring-Farbe `--ring-color`, Atem-Dauer `--breath-dur` und die `@keyframes breathe` stammen aus `style.css` und folgen `body[data-state]`. |
| `src-tauri/src/main.rs` | Commands `enter_pill` / `exit_pill` / `pill_position`; macOS-`setCollectionBehavior`. |

Der Ring spiegelt die **bestehende** Zustandsmaschine (`body[data-state]`:
calm/warm/ember/paused), gesetzt von `refreshAppState()` in `app.js`. Keine neue Erkennung.

## Verhalten im Pill-Modus

- Fenster schrumpft auf ~220×120, **rahmenlos** (`set_decorations(false)`).
- **Immer im Vordergrund** (`set_always_on_top(true)`).
- **Auf allen Spaces/Workspaces** sichtbar (`set_visible_on_all_workspaces(true)` +
  NSWindow `collectionBehavior |= canJoinAllSpaces | fullScreenAuxiliary`).
- **Verschieben:** schmale Drag-Region oben (`data-tauri-drag-region`). Die letzte
  Position wird in `localStorage` gesichert (alle 2 s sowie beim Verlassen) und beim
  nächsten Andocken wiederhergestellt.
- **Klick auf den Ring → zurück in den Voll-Modus** (Größe/Fensterebene/Dekoration
  zurückgesetzt, Fenster zentriert).
- Im Voll-Modus gibt es unten links den Button **„Als Pille andocken"**.

### Bekannte Grenze: Vollbild einer anderen App

`canJoinAllSpaces | fullScreenAuxiliary` lässt die Pille über eigene Vollbild-Spaces und
über normalen Fenstern schweben. Über dem **echten Vollbild einer anderen App** ist das
nicht garantiert (macOS-Verhalten; vgl. tauri-apps/tauri#5566 – `setCollectionBehavior`
greift im Release teils anders als im Dev). In diesem Randfall kann die Pille verdeckt
sein und die Erkennung pausiert – akzeptabler Randfall. Normales Arbeiten mit nicht-
vollbildigen Fenstern ist abgedeckt.

## Build & Übergabe

Doppelklickbares `.app`/`.dmg` über den bestehenden GitHub-Actions-Workflow
(`Spike macOS Build`, unsigniert). Artefakt `NailGuard-Spike-macOS`.

### Anleitung für Paul

1. **Alte „NailGuard Spike"-App** aus dem Ordner **Programme** in den Papierkorb
   (damit sicher die neue Version läuft).
2. Neues Artefakt aus GitHub Actions laden, entpacken, `.dmg` öffnen, App nach
   **Programme** ziehen.
3. Öffnen: **Rechtsklick auf die App → „Öffnen" → im Dialog „Öffnen"**.
4. **„Kamera starten"**, Zugriff **erlauben**.
5. Unten links **„Als Pille andocken"** klicken; die Pille in eine **Bildschirmecke** ziehen
   (am Streifen oben anfassen).

### Bestätigungs-Test

1. ~5 Minuten ganz normal in anderen Apps arbeiten (Browser, Mail …) – die Pille bleibt
   sichtbar in der Ecke.
2. Zwischendurch ein Fenster dorthin schieben, wo die Pille ist – sie sollte oben bleiben.
3. App schließen; die Datei `nailguard-spike-log-<Zeitstempel>.csv` vom **Schreibtisch**
   zurückschicken.

Auswertung: `python3 spike/analyze.py ~/Desktop/nailguard-spike-log-<Zeitstempel>.csv`.
Erwartung als Beleg: durchgehend ~50/s, **keine `hidden`-/0-Strecken**, solange die Pille
sichtbar in der Ecke liegt.

### Bestätigungs-Ergebnis (gemessen)

Lauf vom 18.06.2026, ~19,5 Minuten Pill-Modus in der Ecke, parallel in anderen Apps gearbeitet
(Apple Silicon):

| Kennzahl | Wert |
|----------|------|
| Dauer | 1169 s (19,5 min) |
| `hidden`-Sekunden | **0** (durchgehend `visible`, meist unfokussiert) |
| Ø Rate nach Aufwärmen (8 s) | **44,5/s** (Median 46/s) |
| Sekunden mit 0/s nach Aufwärmen | **0 (0,0 %)** |
| Längste 0-Strecke | **0 s** |

Damit ist belegt: Solange die Pille sichtbar in der Ecke schwebt, bleibt `visibilityState`
durchgehend `visible`, die rAF-Schleife läuft nie leer, und die Erkennung hält volle Rate –
auch unfokussiert und während in anderen Apps gearbeitet wird. Kein Throttling, keine Lücken.

> Pro App-Start wird jetzt eine **eigene, mit Zeitstempel benannte** Log-Datei geschrieben
> – damit sich (anders als beim ersten Spike-Lauf) keine mehreren Sessions in einer Datei
> mischen.

## Nicht im Scope

Tray-Icon, Autostart, Signierung/Notarisierung, Face-Touch-Modus – spätere Roadmap.
Der Kamera-Fix des Spikes (WKUIDelegate-Grant + Kamera-Entitlement +
`NSCameraUsageDescription`) bleibt unverändert erhalten.
