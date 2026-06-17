# CLAUDE.md — NailGuard

Projektkontext für Claude Code, Cowork und jede andere KI-Oberfläche, die an
diesem Repo arbeitet. Kurz halten, aktuell halten. Entscheidungen und ihre
Begründungen stehen in `docs/decisions.md`, das laufende Was in Notion
(„NailGuard – Update Backlog”).

-----

## Was ist NailGuard

Eine PWA, die per Kamera und MediaPipe (Hand- und Face-Landmarks) hilft, das
Nägelkauen abzugewöhnen. Erkennt, wenn die Hand sich dem Mund/Gesicht nähert,
und unterbricht sanft.

**Doppeltes Ziel:** persönliche Nutzung *und* späterer Verkauf. Die Web-Version
ist die kostenlose Demo, die geplante Desktop-App (Tauri) wird das Bezahlprodukt.

## Leitprinzipien

1. **Privacy on-device.** Die gesamte Auswertung läuft lokal. Es wird kein Bild
   oder Video gespeichert oder übertragen. Das ist das zentrale Verkaufsargument
   und darf durch keine Änderung verwässert werden (auch keine CDN-Requests beim
   Start — siehe Self-Hosting in decisions.md).
1. **Einfachheit.** Onboarding in unter einer Minute, ohne Pflicht-Einstellungen.
   „Erweiterte Einstellungen” müssen sekundär wirken.

## Tech-Stack

- Vanilla JS, kein Build-Tool im Web-Teil
- MediaPipe (hand_landmarker, face_landmarker) — Modelle werden self-hosted aus
  `models/` geladen, nicht vom CDN
- Persistenz: localStorage (Web) → später `tauri-plugin-store` (Desktop)
- Desktop-Ziel: Tauri 2.x (macOS zuerst, dann Windows/Linux)

## Repo-Struktur

```
index.html                          App-Shell, alle Modi
app.js                              Logik: Erkennung, Kalibrierung, State
i18n.js                             DE/EN-Texte
style.css                           Styles + Design-Tokens
sw.js                               Service Worker (PWA-Offline-Cache)
manifest.webmanifest                PWA-Manifest
desktop.html                        Landing-/Warteliste-Seite (Desktop-App)
landing.js                          Logik der Landing-Seite
robots.txt
icons/                              App-Icons (PWA, Apple-Touch, SVG)
models/                             MediaPipe-Modelle (self-hosted)
  face_landmarker.task
  hand_landmarker.task
vendor/mediapipe/tasks-vision/      MediaPipe-Bibliothek + WASM (self-hosted)
functions/api/waitlist.js           Serverless-Endpoint (Warteliste)
tools/generate-icons.py             Hilfsskript zur Icon-Erzeugung
docs/
  nailguard-design-referenz.html    verbindliche Design-Referenz
  decisions.md                      Entscheidungs-Log
  DEPLOYMENT.md                     Deployment-Hinweise
  tauri-spike.md (geplant)          Ergebnis des Tauri-Machbarkeits-Spikes
src-tauri/ (geplant)                Tauri-Desktop-Hülle
```

## Designsystem

Verbindliche Quelle: **`docs/nailguard-design-referenz.html`** — Richtung
„Atem & Ruhe”. Der Kommentarblock am Dateianfang dokumentiert alle Regeln.

- **Tokens** (CSS-Variablen in `:root`): Flächen `--mist`/`--paper`, Text
  `--pine`/`--moss`, Zustände `--breath`/`--warm`/`--ember`/`--still`, plus die
  **dunklen Textvarianten `--warm-text`/`--ember-text`** für lesbare Schrift in
  Warnzuständen.
- **Schriften:** Fraunces (Display) · Atkinson Hyperlegible (Body) ·
  Spline Sans Mono (Zahlen, `tabular-nums`).
- **Signatur-Element:** atmender Status-Ring, zustandsgesteuert über
  `body[data-state]` (calm 4,6s / warm 2,6s / ember 1,6s / paused angehalten).
  `prefers-reduced-motion` respektieren.

## Harte Regeln (nicht ohne Rücksprache ändern)

- **Erkennungs- und Kalibrierungslogik in `app.js` bleibt unangetastet**, außer
  es ist ausdrücklich Teil der Aufgabe. Design-/UI-Arbeit fasst diese Logik nicht
  an — Ausnahmen: der Flow-Redirect nach Kalibrierung und das Verdrahten neuer
  Schalter.
- **Navigation: nur drei Reiter** — Focus, Review, Einstellungen.
- **Office Mode ist ein Zustand, kein Reiter.** Aktivierung über Button im Focus
  Mode; läuft vollflächig **ohne Header und Navigation** (`body[data-view="office"]`
  blendet beide aus — das ist die Tarnung). Die Tarnung ist ein **funktionierender,
  schlichter Texteditor**; sein Inhalt soll persistiert werden. Verlassen per Klick
  auf den getarnten Status-Punkt **und** per `Esc`. Office-Optionen liegen in den
  Einstellungen, nie auf der Office-Seite.
- **Nach der Kalibrierung landet der Nutzer im Focus Mode**, nicht in den
  Einstellungen.

## Arbeitsweise

- **Ein Thema pro Commit.** Größere Aufgaben in der vorgegebenen Reihenfolge als
  getrennte Commits abarbeiten.
- **Ein primärer Builder pro Datei.** Nicht zwei Agenten gleichzeitig dieselbe
  Datei ändern lassen. Wenn parallel gearbeitet wird, strikt nach Dateien trennen
  und sequenzieren (z.B. Design-Integration und MediaPipe-Self-Hosting fassen
  beide `app.js`/`index.html` an → nacheinander mergen).
- **Backlog ist der Hub.** Aufgaben fließen über das Notion-Backlog: Idee →
  Backlog → Prompt → Status (Backlog / In Progress / Done).
- **Entscheidungen werden geloggt.** Jede Architektur- oder Designentscheidung
  kommt nach `docs/decisions.md`, damit sie nicht neu aufgerollt wird.

## Roadmap (Reihenfolge)

1. Design-Integration abschließen (aus der Design-Referenz)
1. Gesichtsberührungs-Modus (eigener Schalter, längere Haltezeit)
1. MediaPipe self-hosten + `navigator.storage.persist()` + JSON-Export/Import
1. Tauri-Desktop-App (Spike zuerst — siehe `docs/tauri-spike.md`)
1. Landing Page mit Demo-Video + Vertrieb (Merchant of Record, Apple-Signierung)
