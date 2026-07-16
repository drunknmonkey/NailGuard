# Nail Guard

Nail Guard ist ein lokaler Browser-Coach gegen Nägelkauen. Die App nutzt die Webcam, erkennt Gesicht/Mund und Hand/Fingerkuppen im Browser und unterbricht sanft, wenn Finger länger als die eingestellte Haltezeit nahe am Mund bleiben.

Die App ist als statische Web-App vorbereitet und kann per HTTPS auf Cloudflare Pages gehostet werden. Die Kameraauswertung bleibt auch im Deployment lokal im Browser.

Die Oberfläche ist zweisprachig (Deutsch und Englisch). Die Sprache wird automatisch aus der Browser-Sprache erkannt und kann oben rechts mit `DE | EN` umgeschaltet werden; die Wahl wird lokal gespeichert.

Die App ist eine installierbare PWA: Manifest, Icons und ein Service Worker sind enthalten. Nach dem ersten Besuch wird die App-Shell gecacht, MediaPipe-Dateien und Modelle werden beim ersten Lauf in den Cache übernommen — danach startet die App auch offline.

## Projektstruktur

```text
NailGuard/
├── index.html
├── style.css
├── app.js
├── i18n.js
├── sw.js
├── desktop.html
├── landing.js
├── manifest.webmanifest
├── functions/
│   └── api/
│       └── waitlist.js
├── icons/
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
├── tools/
│   └── generate-icons.py
├── robots.txt
├── README.md
├── .gitignore
└── docs/
    └── DEPLOYMENT.md
```

Die PNG-Icons werden aus demselben Design wie `icons/icon.svg` mit `python3 tools/generate-icons.py` erzeugt (benötigt `pillow`).

## Desktop-Landingpage und Warteliste

`desktop.html` ist eine zweisprachige Landingpage für die geplante Desktop-App (Menüleisten-App für macOS/Windows). Sie erklärt den Mehrwert gegenüber der Web-App und sammelt Wartelisten-Anmeldungen über `POST ./api/waitlist` (Cloudflare Pages Function in `functions/api/waitlist.js`, Speicherung in einem KV-Namespace — Einrichtung siehe `docs/DEPLOYMENT.md`). Solange das KV-Binding fehlt, zeigt die Seite einen „noch nicht freigeschaltet"-Hinweis. Die Web-App verlinkt vom Startpanel auf die Landingpage.

## Start am Mac

```bash
python3 -m http.server 4173
```

Danach in Chrome oder Safari öffnen:

```text
http://localhost:4173
```

Beim ersten Start fragt der Browser nach Kamerazugriff. Wähle `Erlauben`.

Hinweis: Der Codex in-app Browser kann Kamerazugriff blockieren. Für den echten Webcam-Test öffne `http://localhost:4173` direkt in Chrome oder Safari. Wenn du die Kamera versehentlich blockiert hast, öffne die Website-Einstellungen in der Adressleiste, setze Kamera auf `Erlauben` und lade die Seite neu.

## Cloudflare Pages

Für das Deployment ist kein Build-Prozess nötig:

```text
Framework preset: None
Build command: leer lassen
Output directory: /
```

Details stehen in `docs/DEPLOYMENT.md`.

Für Kamera-Zugriff im Browser ist ein sicherer Kontext nötig. Lokal funktioniert `http://localhost`; öffentlich muss die App über `https://` laufen. Cloudflare Pages stellt HTTPS automatisch bereit.

## App-Modi

### Focus Mode

Die ruhige Nutzungsansicht für den Alltag:

- Status `Aktiv` / `Pausiert`
- ruhige Zeit
- heute unterbrochene Momente
- Pause/Fortsetzen
- Office Mode öffnen
- keine technischen Slider

### Geführte Kalibrierung (Onboarding)

Beim ersten Start führt ein kurzer Assistent (ca. 30 Sekunden) durch die Einrichtung:

1. Gesicht zeigen, bis es erkannt wird
2. eine Hand zeigen
3. einen Finger langsam zum Mund führen und kurz halten

Aus dem dabei gemessenen Abstand leitet Nail Guard eine persönliche Empfindlichkeit ab (begrenzt auf einen sinnvollen Bereich) und speichert sie als Preset `custom`. Der Assistent kann übersprungen und jederzeit über `Einstellungen → Kalibrierung neu starten` wiederholt werden. Während der Kalibrierung werden keine Interventionen ausgelöst.

### Einstellungen

Die technische Ansicht ist als `Erweiterte Einstellungen` bewusst sekundär:

- großes Kamerabild
- Overlay für Mundpunkt und Fingerkuppen
- Live-Distanzwert
- einfache Voreinstellungen `Sanft`, `Normal`, `Präzise`
- Sensitivität
- Haltezeit
- Cooldown
- Farbwarnung, Ton und Vibration
- Tonpresets, Lautstärke und Testton
- Mini-Reset testen

### Automatische Anpassung (Auto-Tuning)

Jede Intervention wird vom Nutzer als `Treffer`, `Fehlalarm` oder `Gesicht berührt` klassifiziert. Bei aktivierter Option `Automatisch anpassen` (Standard, abschaltbar in den erweiterten Einstellungen) nutzt Nail Guard diese Rückmeldung, um die Erkennung schrittweise zu personalisieren:

- `Fehlalarm`: Empfindlichkeit sinkt (Schwelle × 0.93), Haltezeit steigt (+0.2 s)
- `Gesicht berührt`: Empfindlichkeit sinkt leicht (Schwelle × 0.97)
- `Treffer`: Empfindlichkeit steigt leicht (Schwelle × 1.02), Haltezeit sinkt (−0.1 s)

Alle Anpassungen sind begrenzt (Schwelle 0.045–0.14, Haltezeit 0.5–4 s) und werden auf das Raster der Slider gerundet, damit gespeicherte und angezeigte Werte identisch bleiben. Nach einer Anpassung steht das Preset auf `custom`.

### Review Mode

Die Tagesauswertung beginnt mit einer kurzen, motivierenden Zusammenfassung. Danach folgen die Zahlen:

- unterbrochene Momente
- Treffer
- Fehlalarme
- Gesicht-berührt-Episoden
- längste ruhige Phase
- ruhige Zeit
- Statistik zurücksetzen

### Office Mode

Unauffällige Büro-/iPad-Ansicht, während die Kameraauswertung im Hintergrund weiterläuft:

- keine große Kameravorschau
- keine technischen Live-Werte
- neutrale Seitentitel und Statusanzeigen
- 10 auswählbare Layouts: Uhr & Datum, Fokus-Timer, Notizseite, Tagesplan, Atemübung, Wasser-Reminder, Kalender-Look, Minimal Dashboard, Lesemodus und Blank Screen
- gewähltes Layout bleibt nach Reload gespeichert
- neutrale Einblendungen wie `Mini-Reset`, `Atmen` oder `Zurück zum Fokus`
- Option für sehr dezente Einblendungen

Im Office Mode werden im sichtbaren UI keine Begriffe zum eigentlichen Tracking-Thema angezeigt. Die Verarbeitung bleibt unverändert lokal im Browser.

## Datenschutz

- Es werden keine Webcam-Bilder oder Videos gespeichert.
- Es werden keine Canvas-Frames oder Standbilder gespeichert.
- Es werden keine Webcam-Bilder oder Videos hochgeladen.
- Webcam-Frames werden nicht an Cloudflare, jsDelivr, Google Storage oder andere Server gesendet.
- Es gibt keine Accounts, keine externe Datenbank und kein Tracking.
- Statistiken und Einstellungen bleiben ausschließlich lokal im Browser-Speicher (`localStorage`) des jeweiligen Geräts.
- Die Verarbeitung der Kameraframes findet lokal im Browser statt.
- Die Content-Security-Policy der App erlaubt Skripte, Styles und Schriften nur von der eigenen Herkunft.

MediaPipe wird vollständig self-hosted ausgeliefert, es werden keine MediaPipe-CDNs mehr angefragt:

- `@mediapipe/tasks-vision@0.10.15` als ES-Modul samt WASM-Dateien unter `vendor/mediapipe/tasks-vision/`
- FaceLandmarker- und HandLandmarker-Modelle (float16) unter `models/`

Die Schriften werden vollständig self-hosted unter `app/fonts/` ausgeliefert. Als externer Dienst lädt nur die Landingpage das MailerLite-Wartelistenformular von `assets.mailerlite.com`; Datenschutz- und Impressumsseite laden dieses Script nicht.

Der Service Worker (`sw.js`) cacht alle Dateien nach dem ersten erfolgreichen Laden lokal. Damit funktioniert die App nach dem ersten Lauf auch offline.

## Design „Atem & Ruhe"

Die App folgt einer eigenen Designsprache: ruhiger Begleiter statt Überwachungs-Tool.

- **Tokens** (in `style.css` unter `:root`): Flächen `--mist`/`--paper`, Text `--pine`/`--moss`, Zustände `--breath` (ruhig), `--warm` (Hand nähert sich), `--ember` (Intervention). Für Text in Warnzuständen immer die dunklen Varianten `--warm-text`/`--ember-text` verwenden (Lesbarkeit).
- **Schriften**: Instrument Sans (Display und Body), Spline Sans Mono (Zahlen, `tabular-nums`) — self-hosted unter `app/fonts/`; der Service Worker cacht die Fonts nach dem ersten Laden.
- **Signatur-Element**: der atmende Status-Ring im Focus-Modus. Der Zustand liegt als `data-state` auf `<body>` (`calm` 4,6 s Atemzyklus → `warm` 2,6 s → `ember` 1,6 s → `paused` steht). Gesteuert wird er zentral über `refreshAppState()` in `app.js`.
- **Intervention**: Vollbild-Veil in `--pine` („Kurz innehalten") mit den drei Feedback-Optionen.
- **Office Mode** verwendet dieses Design **bewusst nicht** (Tarnung): neutrale System-Schrift, graue Flächen, keine Markenbegriffe. Nur der kleine Status-Punkt übernimmt diskret dieselbe Farblogik wie der Ring.

## Sprachen (i18n)

- Alle UI-Texte liegen in `i18n.js` in einem Wörterbuch für `de` und `en`.
- Statische Texte in `index.html` sind mit `data-i18n`-Attributen (bzw. `data-i18n-aria-label` für ARIA-Labels) markiert.
- Dynamische Texte in `app.js` laufen über die Funktion `t(key, params)`.
- Die Spracherkennung folgt `navigator.language`; die manuelle Wahl wird unter `nail-guard.locale.v1` in `localStorage` gespeichert.
- Datum und Uhrzeit werden passend zur Sprache formatiert (`de-AT` bzw. `en-US`).

Eine weitere Sprache hinzuzufügen heißt: in `i18n.js` einen neuen Eintrag im `translations`-Objekt anlegen und den Code in `SUPPORTED_LOCALES` ergänzen.

## Architektur

Die App bleibt bewusst ohne Build-Step und ohne zusätzliche Dependencies. `app.js` ist strukturell in Bereiche getrennt:

- Detection: MediaPipe, Webcam, Landmark-Erkennung, Distanz und Haltezeit
- Settings: UI-Werte, Persistenz in `localStorage`
- Statistics: Tageswerte, Streaks und lokale Speicherung
- Intervention: zentrale Funktion `triggerIntervention(reason, confidence)`
- UI Rendering: Moduswechsel, Status, Statistik, Warn-Dialog und Neutral-Ansichten

Die zentrale Intervention ist vorbereitet, damit eine spätere Mac-App statt des Browser-Dialogs ein natives Desktop-Overlay auslösen kann.

## Grenzen der Browser-Version

- Der Browser darf die echte Mac-Bildschirmhelligkeit oder globale Bildschirmfarbe nicht verändern.
- Systemweites Abdunkeln, ein globales Overlay oder Steuerung von Display-Farbfiltern ist erst mit einer Mac-App möglich, z. B. Electron, Tauri oder einer nativen Swift-App.
- Firmen-PCs können Kamera, WebAssembly oder WebGL/GPU per Browser-/Netzwerk-Policy blockieren.
- Manche Firmen-Proxys oder Browser-Erweiterungen blockieren externe Wartelisten-Embeds wie `assets.mailerlite.com`; dann ist das Formular nicht nutzbar.
- In verwalteten Browsern kann `localStorage` gelöscht, deaktiviert oder beim Schließen bereinigt werden; dann bleiben Statistik und Settings nicht dauerhaft erhalten.
- Das MVP unterscheidet nicht sicher zwischen Nägelkauen, Lippen berühren, Trinken oder anderen Hand-zum-Gesicht-Bewegungen. Deshalb wird die Warnung manuell klassifiziert.
- Licht, Kamerawinkel, verdeckte Finger und schnelle Bewegungen beeinflussen die Erkennung.
- Die Distanzschwelle ist normalisiert auf Bildkoordinaten, nicht auf echte Zentimeter.
- Beim ersten Start ist eine Internetverbindung nötig, bis der Service Worker die App-Dateien (inkl. WASM und Modelle) gecacht hat.

## Manuelle Tests

1. Server starten: `python3 -m http.server 4173`
2. `http://localhost:4173` in Chrome oder Safari öffnen.
3. `Kamera starten` klicken und Kamerazugriff erlauben.
4. Zwischen `Focus`, `Einstellungen`, `Review` und `Office` wechseln.
5. In `Einstellungen` prüfen: Gesicht/Hand-Status, Distanzwert und Overlay reagieren auf Kamera-Bewegung.
6. In `Office` alle 10 Layouts einmal auswählen und die Seite neu laden; die letzte Auswahl soll erhalten bleiben.
7. Haltezeit auf `0.5 s` setzen und Sensitivität erhöhen, dann eine Hand in die Nähe des Mundes halten.
8. Prüfen, dass der Farbwechsel ansteigt und in `Office` nur eine dezente neutrale Einblendung erscheint.
9. Den Mini-Reset in den anderen Modi als `Treffer`, `Fehlalarm` oder `Gesicht berührt` markieren.
10. In `Review` prüfen, dass Statistik und Tageszusammenfassung aktualisiert werden.
11. Seite neu laden und prüfen, dass Settings und Statistik erhalten bleiben.
12. Statistik mit `Statistik zurücksetzen` löschen.
13. Oben rechts auf `EN` umschalten und prüfen, dass alle Texte (inkl. Status, Tabs, Statistik) wechseln; Seite neu laden — die Sprache soll erhalten bleiben.
14. Über das Browser-Menü „App installieren" wählen; die App soll mit eigenem Icon als Standalone-Fenster starten.
15. Nach einem vollständigen ersten Lauf die Netzwerkverbindung trennen und die Seite neu laden; die App-Shell soll aus dem Cache laden.
