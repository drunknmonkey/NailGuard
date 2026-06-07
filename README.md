# Nail Guard

Nail Guard ist ein lokaler Browser-Coach gegen Nägelkauen. Die App nutzt die Webcam, erkennt Gesicht/Mund und Hand/Fingerkuppen im Browser und unterbricht sanft, wenn Finger länger als die eingestellte Haltezeit nahe am Mund bleiben.

Die App ist als statische Web-App vorbereitet und kann per HTTPS auf Cloudflare Pages gehostet werden. Die Kameraauswertung bleibt auch im Deployment lokal im Browser.

## Projektstruktur

```text
NailGuard/
├── index.html          # Statische App-Shell
├── style.css           # UI, Layout und responsive Darstellung
├── app.js              # MediaPipe-Erkennung, Settings, Statistik und Interventionen
├── robots.txt          # Verhindert Indexierung der privaten App
├── README.md           # Projekt-, Datenschutz- und Testdokumentation
├── .gitignore          # Lokale Dateien, Secrets und Build-Artefakte ausschließen
└── docs/
    └── DEPLOYMENT.md   # Cloudflare-Pages-Anleitung
```

Nicht Teil des eigentlichen Projekts sind Chat-Artefakte wie `.git` aus dem Arbeitsordner, `work/`, `outputs/`, temporäre Screenshots oder `.DS_Store`-Dateien.

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

- Status `Erkennung läuft`
- aktuelle Streak / ruhige Zeit
- bestätigte Nägelkau-Episoden heute
- Ersatzhandlungsempfehlung
- Pause/Fortsetzen
- kleine, unaufdringliche Kameravorschau
- keine technischen Slider

### Calibration Mode

Die technische Ansicht für Setup und Tuning:

- großes Kamerabild
- Overlay für Mundpunkt und Fingerkuppen
- Live-Distanzwert
- Sensitivität
- Haltezeit
- Cooldown
- Farbwarnung, Ton und Vibration
- Tonpresets, Lautstärke und Testton
- Testwarnung

### Review Mode

Die Tagesauswertung:

- Warnungen heute
- bestätigtes Nägelkauen
- Fehlalarme
- Gesicht-berührt-Episoden
- längste ruhige Phase
- aktuelle Streak
- motivierende Tageszusammenfassung
- Statistik zurücksetzen

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
- UI Rendering: Moduswechsel, Status, Statistik, Warn-Dialog

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
4. Zwischen `Focus`, `Calibration` und `Review` wechseln.
5. In `Calibration` prüfen: Gesicht/Hand-Status, Distanzwert und Overlay reagieren auf Kamera-Bewegung.
6. Haltezeit auf `0.5 s` setzen und Sensitivität erhöhen, dann eine Hand in die Nähe des Mundes halten.
7. Prüfen, dass die Farbwarnung ansteigt und danach eine ruhige Warnung erscheint.
8. Warnung als `Ja, Nägelkauen`, `Fehlalarm` oder `Nur Gesicht berührt` markieren.
9. In `Review` prüfen, dass Statistik und Tageszusammenfassung aktualisiert werden.
10. Seite neu laden und prüfen, dass Settings und Statistik erhalten bleiben.
11. Statistik mit `Statistik zurücksetzen` löschen.
