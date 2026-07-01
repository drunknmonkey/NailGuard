# NailGuard – Entwicklungskontext

## Was ist NailGuard?

Datenschutzfreundlicher Webcam-Coach gegen Nägelkauen. MediaPipe läuft vollständig
lokal im Browser (kein Cloud-Backend, kein Videospeicher). Ziel: Desktop-App via
Tauri 2.x, Vertrieb als One-Time-Purchase über einen Merchant of Record.

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

Referenz: `docs/nailguard-design-referenz.html`

| Token | Wert | Bedeutung |
|-------|------|-----------|
| `--mist` | #EDF2ED | Hintergrund |
| `--paper` | #FAFCFA | Karten |
| `--pine` | #1E3B34 | Primärtext |
| `--moss` | #5E7C6C | Sekundärtext |
| `--breath` | #A8C7B4 | Ring ruhig |
| `--warm` | #D9914F | Ring warm |
| `--ember` | #C46A4A | Ring Alarm |
| `--still` | #B8C2BC | Ring pausiert |

Schriften: Fraunces (Display) · Atkinson Hyperlegible (Body) · Spline Sans Mono (Zahlen)

### Zustands-Maschine

`body[data-state]` = calm / warm / ember / paused  
Gesetzt von `refreshAppState()` in `app.js`. Steuert Ring-Animation (--breath-dur),
Farben und den Pill-Ring im Tauri-Spike.

## App-Modi

- **Focus** – Ring + Status + Timer, Hauptansicht
- **Review** – Karten mit Tagesstatistik, Streak
- **Einstellungen** (calibration) – Kamera-Preview, Detection-Slider, Sound, Office-Optionen, Daten
- **Office Mode** (neutral) – Tarn-Texteditor (Notizen.txt), kein NailGuard-Branding,
  Status-Punkt als einziges verräterisches Element. Verlassen: Klick auf Punkt oder Esc.

## Konventionen

- Kein externer API-Aufruf aus `app.js`. Alle Daten in `localStorage`.
- i18n über `t(key)` / `t(key, { count })` – nie Rohstring in JS oder HTML.
- Klassen und IDs auf Englisch, Nutzer-sichtbare Strings nur über i18n.js.
- Settings werden mit `saveSettings()` sofort persistiert.
- Stats werden mit `saveStats()` in einem tagesgruppierten Objekt gespeichert.
- Commits auf Deutsch (Betreff + Body), PR-Beschreibungen auf Deutsch.
- Keine `console.log`-Aufrufe im Produktiv-Code.
- Keine externen Dependencies außer den self-hosted MediaPipe-Dateien.
