# Nail Guard

Nail Guard ist ein lokaler Browser-Coach gegen Nägelkauen. Die App nutzt die Webcam, erkennt Gesicht/Mund und Hand/Fingerkuppen im Browser und unterbricht sanft, wenn Finger länger als die eingestellte Haltezeit nahe am Mund bleiben.

Die App ist als statische Web-App vorbereitet und kann per HTTPS auf Cloudflare Pages gehostet werden. Die Kameraauswertung bleibt auch im Deployment lokal im Browser.

## Projektstruktur

```text
NailGuard/
├── index.html
├── style.css
├── app.js
├── robots.txt
├── README.md
├── .gitignore
└── docs/
    └── DEPLOYMENT.md
```

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
- Die Content-Security-Policy erlaubt nur die App selbst, jsDelivr und Google Storage für MediaPipe-Dateien.

Extern geladen werden aktuell:

- `@mediapipe/tasks-vision@0.10.15` als ES-Modul von `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/+esm`
- MediaPipe WASM-Dateien von `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm`
- FaceLandmarker-Modell von `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- HandLandmarker-Modell von `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`

Für einen späteren vollständigen Offline-Modus können diese Dateien lokal gespiegelt und die URLs in `app.js` im Objekt `MEDIAPIPE` auf lokale Pfade geändert werden.

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
- Firmen-PCs können Kamera, WebAssembly, WebGL/GPU oder externe Modell-CDNs per Browser-/Netzwerk-Policy blockieren.
- Manche Firmen-Proxys oder Browser-Erweiterungen blockieren `cdn.jsdelivr.net` oder `storage.googleapis.com`; dann können MediaPipe oder die Modelle nicht laden.
- In verwalteten Browsern kann `localStorage` gelöscht, deaktiviert oder beim Schließen bereinigt werden; dann bleiben Statistik und Settings nicht dauerhaft erhalten.
- Das MVP unterscheidet nicht sicher zwischen Nägelkauen, Lippen berühren, Trinken oder anderen Hand-zum-Gesicht-Bewegungen. Deshalb wird die Warnung manuell klassifiziert.
- Licht, Kamerawinkel, verdeckte Finger und schnelle Bewegungen beeinflussen die Erkennung.
- Die Distanzschwelle ist normalisiert auf Bildkoordinaten, nicht auf echte Zentimeter.
- Beim ersten Start ist eine Internetverbindung nötig, solange MediaPipe-Dateien von CDN/Google Storage geladen werden.

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
