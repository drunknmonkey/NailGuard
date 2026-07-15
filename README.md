# Tawel

Tawel ist eine ruhige, private Unterstützung gegen unbewusstes
Hand-zum-Mund-Verhalten bzw. Nägelkauen. Die Webcam-Auswertung
(Gesicht/Mund + Hand/Fingerkuppen) läuft vollständig lokal; wenn Finger
länger als die eingestellte Haltezeit nahe am Mund bleiben, erscheint
ein ruhiger visueller Hinweis statt eines Alarms.

> Historie: Das Repo heißt aus historischen Gründen `NailGuard`, ebenso
> einige technische Bezeichner (localStorage-Keys, Event-Namen). Das
> Produkt heißt sichtbar überall **Tawel**.

## Produktebenen

| | Web-Version | Mac-App |
|---|---|---|
| Status | live unter [tawel.app/app](https://tawel.app/app) | in Entwicklung (Kernprodukt) |
| Preis | dauerhaft kostenlos | Preismodell offen: Einmalkauf oder Jahresabo (Entscheidung steht aus) |
| Einschränkung | Tab muss geöffnet und **sichtbar** bleiben; im Hintergrund drosseln Browser Kamera und Verarbeitung | soll zuverlässig im Hintergrund laufen |
| Hinweis-Anzeige | atmender Ring + kleine Notiz | geplant: Glühen am Bildschirmrand, das in Calls, Screen-Sharing und Aufnahmen unsichtbar bleibt (bislang nur im Tauri-Spike validiert) |

## Struktur

```text
NailGuard/
├── index.html          Landingpage (tawel.app)
├── datenschutz.html    Legal-Platzhalter
├── impressum.html      Legal-Platzhalter
├── _headers            Cloudflare-Pages-Cache-Regeln
├── app/                Web-App (tawel.app/app)
│   ├── index.html
│   ├── app.js          gesamte App-Logik
│   ├── i18n.js         DE/EN-Wörterbücher
│   ├── style.css       geteiltes Design-System (auch für die Landing)
│   ├── sw.js           Service Worker (offlinefähige PWA)
│   ├── fonts/          self-hosted Schriften
│   ├── vendor/         MediaPipe (self-hosted, kein CDN)
│   └── models/         Erkennungsmodelle
├── spike/, src-tauri/  Tauri-Spike (Wegwerf-Experiment, kein Produkt-Code)
└── docs/               Entscheidungen, Deployment, Audits
```

## Lokal starten

```bash
python3 -m http.server 4173
# Landing:  http://localhost:4173
# Web-App:  http://localhost:4173/app/
```

Kamera braucht einen sicheren Kontext (`localhost` oder HTTPS). Beim
ersten Start führt ein kurzer Assistent durch die Einrichtung des
persönlichen Sitzabstands (keine lernende KI-Funktion – der gemessene
Abstand bestimmt die Empfindlichkeit; jederzeit wiederholbar über
Einstellungen → „Abstand neu einrichten").

## App-Modi

- **Fokus** – atmender Ring, Status, ruhige Zeit, Momente heute
- **Rückblick** – menschliche Tageszusammenfassung, dann Charts/Detailwerte
- **Einstellungen** – Hinweise, Erkennungs-Presets, Kamera, Privatsphäre, Office Mode, Daten-Export/-Import
- **Office Mode** – neutrale Notizseiten-Ansicht fürs Büro; die Erkennung
  läuft diskret weiter, Hinweise erscheinen nur als kleine Randnotiz.
  Verlassen per Esc oder Klick auf den Status-Punkt.

## Privatsphäre

Die Kameraauswertung findet lokal im Browser statt. Kamerabilder und
Videos werden weder gespeichert noch hochgeladen. Beim Start lädt die
App nur eigene Dateien und Erkennungsmodelle (self-hosted, inklusive
Schriften – keine externen CDNs) – das sind keine Kameradaten. Alle
Statistiken liegen in `localStorage`.

## Deployment

Statische Site auf Cloudflare Pages, kein Build-Prozess (Output
directory `/`). Details in `docs/DEPLOYMENT.md`, Produktentscheidungen
chronologisch in `docs/decisions.md`.
