# Cloudflare Pages Deployment

Nail Guard ist eine statische Web-App ohne Build-Prozess. Die Kameraauswertung bleibt lokal im Browser; Cloudflare Pages hostet nur HTML, CSS und JavaScript.

## Voraussetzungen

- Repository mit diesen Dateien im Root-Verzeichnis:
  - `index.html`
  - `style.css`
  - `app.js`
  - `robots.txt`
  - `README.md`
  - `.gitignore`
- Deployment-Dokumentation unter:
  - `docs/DEPLOYMENT.md`
- Cloudflare Account
- GitHub oder GitLab Repository, das mit Cloudflare Pages verbunden werden kann

## Cloudflare Pages Einstellungen

In Cloudflare:

1. `Workers & Pages` öffnen.
2. `Create application` wählen.
3. `Pages` wählen.
4. Repository verbinden.
5. Build-Konfiguration setzen:

```text
Framework preset: None
Build command: leer lassen
Output directory: /
Root directory: /
Environment variables: keine nötig
```

Falls Cloudflare im Dashboard ein Build command erzwingt, kann alternativ `exit 0` verwendet werden. Für diese App ist kein Build-Schritt erforderlich.

## HTTPS und Kamera

Browser erlauben Kamerazugriff normalerweise nur in sicheren Kontexten:

- `https://...` auf Cloudflare Pages
- `http://localhost...` für lokale Entwicklung

Eine per Cloudflare Pages veröffentlichte URL ist automatisch HTTPS-fähig. Ohne HTTPS kann `navigator.mediaDevices.getUserMedia()` blockiert werden.

## Datenschutz beim Deployment

Die deployte App:

- speichert keine Webcam-Bilder
- speichert keine Videos
- speichert keine Frames
- lädt keine Webcam-Daten hoch
- sendet keine Statistik an Cloudflare oder andere Server
- nutzt `localStorage` nur im jeweiligen Browser des Nutzers

Externe Netzwerkziele beim Start:

- jsDelivr für `@mediapipe/tasks-vision@0.10.15`
- jsDelivr für MediaPipe WASM-Dateien
- Google Storage für MediaPipe Face- und Hand-Modelle

Diese externen Dateien sind Programmcode/Modelle. Die Webcam-Frames werden nur lokal im Browser an MediaPipe übergeben.

## Nach dem Deployment testen

1. Cloudflare Pages URL öffnen.
2. Prüfen, dass die URL mit `https://` beginnt.
3. `Kamera starten` klicken.
4. Kamerazugriff im Browser erlauben.
5. In `Calibration` prüfen, ob Gesicht, Hand und Distanzwert erkannt werden.
6. Seite neu laden und prüfen, dass Einstellungen und Statistik im gleichen Browser erhalten bleiben.
7. `robots.txt` prüfen: `https://deine-domain.example/robots.txt`.

## Bekannte Grenzen

- Firmen-PCs können Kamera, WebAssembly, WebGL/GPU oder externe Modell-CDNs per Policy blockieren.
- Manche Browser-Erweiterungen blockieren `cdn.jsdelivr.net` oder `storage.googleapis.com`.
- Vollständiger Offline-Betrieb erfordert lokale Kopien der MediaPipe-Bibliothek, WASM-Dateien und Modelle.
- Systemweites Abdunkeln oder ein Mac-Desktop-Overlay ist in der Browser-Version nicht möglich. Dafür braucht es eine Mac-App, z. B. mit Electron, Tauri oder Swift.
