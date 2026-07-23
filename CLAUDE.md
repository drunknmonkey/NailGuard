# Tawel (Repo: NailGuard) – Entwicklungskontext

## Was ist Tawel?

Ruhige, private Unterstützung gegen unbewusstes Hand-zum-Mund-Verhalten /
Nägelkauen. MediaPipe läuft vollständig lokal im Browser (kein Cloud-Backend,
kein Videospeicher). Produktname sichtbar überall **Tawel**; Repo und
technische Bezeichner (localStorage-Keys, `nailguard:intervention`-Event)
heißen historisch NailGuard und bleiben so (Migrationsrisiko ohne Nutzen).

### Produktebenen

- **Web-Version** (`/app`): dauerhaft kostenlos. Ehrliche Einschränkung
  überall kommunizieren: Der Tab muss geöffnet und sichtbar bleiben –
  im Hintergrund drosseln Browser Kamera und Verarbeitung.
- **Mac-App** (via Tauri 2.x): das Kernprodukt, in Entwicklung. Soll
  zuverlässig im Hintergrund laufen; Bildschirmrand-Glühen mit
  Unsichtbarkeit in Calls/Screen-Sharing/Aufnahmen ist ein ZIEL (nur im
  Spike validiert) – immer als „geplant/soll" formulieren, nie als Fakt.
- **Preismodell offen**: Einmalkauf oder Jahresabo, Entscheidung steht
  aus. Keine definitiven Preisaussagen auf Landing/App; Vertrieb
  voraussichtlich über einen Merchant of Record.
- **Keine Launch-Termine erfinden.** Warteliste ja, „bald verfügbar" nein.

## Architektur

```
index.html   – Shell, alle Views inline
app.js       – Gesamte App-Logik (Detection, State, Settings, Stats, UI)
i18n.js      – DE/EN Wörterbücher + t(key, params) Helper
style.css    – Design-System „Atem & Ruhe" (Tokens, Ring-Animation, alle Views)
sw.js        – Service Worker (Precache, offline-fähig)
```

MediaPipe (`vendor/mediapipe/`) und Modelle (`models/`) sind vollständig
self-hosted – keine CDN-Anfragen. Gesicht + Hand werden mit FaceLandmarker /
HandLandmarker erkannt.

### Tauri-Spike (`spike/`, `src-tauri/`)

Wegwerf-Experiment (nicht Produkt-Code). Misst rAF-Throttling im WKWebView.
Ergebnis: Camera OK (3-teiliger Fix nötig), rAF im Hintergrund gedrosselt → **Pill-Modus**
als Lösung (immer sichtbarer Ring, Erkennung bleibt auf voller Rate).

## Design: „Atem & Ruhe"

Lebende Referenz: `docs/design-referenz.html` (importiert direkt
`app/style.css`; Werte nicht in dieser Datei duplizieren).

| Token | Bedeutung |
|-------|-----------|
| `--mist` / `--paper` | warme Grund- und Kartenflächen |
| `--pine` / `--moss` | Primär- und Sekundärtext |
| `--breath` | Ring ruhig |
| `--warm` | Ring bei Annäherung |
| `--ember` | ausschließlich Warnung, nie dekorativ |
| `--still` | Ring pausiert |
| `--office-*` | neutrale Tarnoberfläche, bewusst markenfremd |

Schriften: Instrument Sans (Display + Body) · Fraunces Italic (nur einzelne
Akzentwörter) · Spline Sans Mono (Zahlen)

### Zustands-Maschine

`body[data-state]` = calm / warm / ember / paused  
Gesetzt von `refreshAppState()` in `app.js`. Steuert Ring-Animation (--breath-dur),
Farben und den Pill-Ring im Tauri-Spike.

## App-Modi

- **Fokus** (focus) – Ring + Status + Timer, Hauptansicht
- **Rückblick** (review) – menschliche Tageszusammenfassung zuerst, dann
  Karten mit Tagesstatistik und Streak
- **Einstellungen** (calibration) – Kamera-Preview, Detection-Slider, Sound, Office-Optionen, Daten
- **Office Mode** (neutral) – Kernfeature: neutraler Texteditor (Notizen.txt), kein Tawel-Branding,
  Status-Punkt als einziges verräterisches Element. Verlassen: Klick auf Punkt oder Esc.
  Nach außen nie „Tarnmodus" nennen – „Office Mode" oder „diskreter Arbeitsmodus".

## Produkt-Grundsätze (Sprache)

- **Kalibrierung ist keine KI**: Die App „lernt" nicht – sie „richtet den
  persönlichen Abstand ein". Der 4-Schritt-Wizard bleibt erhalten und ist
  über Einstellungen → „Abstand neu einrichten" wiederholbar.
- **Kein Auto-Tune**: Der Schalter „Automatisch anpassen" wurde entfernt
  (die Treffer-/Fehlalarm-Abfrage existiert nicht mehr, ohne Rückmeldung
  wäre eine Lernfunktion ein leeres Versprechen). Nicht wieder einführen,
  solange es keine belastbare Rückmeldequelle gibt.
- **Datenschutz einheitlich und ohne Jargon**: Auswertung lokal;
  Bilder/Videos werden weder gespeichert noch hochgeladen; beim Start
  lädt die App nur eigene Dateien und Erkennungsmodelle – das sind keine
  Kameradaten. Begriffe wie WASM/CSP/MediaPipe nicht in Startscreens.

## Konventionen

- Kein externer API-Aufruf aus `app.js`. Alle Daten in `localStorage`.
- i18n über `t(key)` / `t(key, { count })` – nie Rohstring in JS oder HTML.
- Klassen und IDs auf Englisch, Nutzer-sichtbare Strings nur über i18n.js.
- Settings werden mit `saveSettings()` sofort persistiert.
- Stats werden mit `saveStats()` in einem tagesgruppierten Objekt gespeichert.
- Commits auf Deutsch (Betreff + Body), PR-Beschreibungen auf Deutsch.
- Keine `console.log`-Aufrufe im Produktiv-Code.
- Keine externen Dependencies außer den self-hosted MediaPipe-Dateien.
