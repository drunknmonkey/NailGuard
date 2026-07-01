# Spike: Tauri 2.x Machbarkeit für NailGuard

**Status:** ABGESCHLOSSEN. Wegwerf-Spike (kein Produktiv-Code). Branch:
`claude/spike-tauri-nailguard-tqlfm1`. `main` und der PWA-Code bleiben unangetastet;
die einzige Ergänzung am App-Code ist ein klar markierter, inerter Zähler-Hook in
`app.js` (`window.__nailguardSpike`).

Der Spike beantwortet zwei Fragen:

1. **Kamera:** Funktioniert `getUserMedia` / MediaPipe im WKWebView der Tauri-App auf macOS?
2. **Hintergrund-Throttling:** Läuft die rAF-Erkennungsschleife weiter, wenn das Fenster
   den Fokus verliert, verdeckt oder **minimiert** ist – und mit welcher Rate?

## TL;DR – Ergebnis

- **Kamera: funktioniert** – aber **nur** mit drei zusammenwirkenden Bausteinen (Standard-
  Tauri-Setup allein reicht NICHT): `NSCameraUsageDescription` + ein eigener
  **WKUIDelegate-Grant** (WRY macht das für die Kamera nicht – wry#1195) + das
  **Kamera-Entitlement** unter Hardened Runtime. Dann erscheint der System-Dialog (einmalig)
  und die Erkennung läuft mit voller Rate.
- **Hintergrund-Erkennung: NO-GO mit der reinen rAF-Schleife.** Sobald das Fenster
  `hidden` ist (egal ob **minimiert** *oder* von einem anderen Fenster **verdeckt**),
  stoppt `requestAnimationFrame` und die Erkennung fällt auf **~0/s** – trotz
  `backgroundThrottling: "disabled"`. Unfokussiert-aber-sichtbar läuft dagegen voll weiter.
- **Empfehlung:** **GO** für eine Tauri-Desktop-App, aber die Hintergrund-Erkennung
  **darf nicht** auf der WebView-rAF-Schleife basieren. Siehe „Empfehlung" unten.

## Testumgebung

- Chip: **Apple Silicon (arm64)** (Bundle: `…_aarch64.dmg`).
- macOS-Version: **macOS 14+ (Sonoma/Sequoia)** — genaue Version bitte noch bestätigen.
- Kamera: integrierte Mac-Kamera.

---

## Was gebaut wurde

```
src-tauri/
├── Cargo.toml            # Tauri-2-Deps (+ objc2/block2 nur für macOS)
├── build.rs
├── Info.plist            # NSCameraUsageDescription (von Tauri auto-gemerged)
├── Entitlements.plist    # com.apple.security.device.camera/microphone/audio-input
├── tauri.conf.json       # lädt spike-dist/, backgroundThrottling:"disabled", entitlements
├── capabilities/default.json
└── src/main.rs           # nativer 1-s-CSV-Logger + WKUIDelegate-Kamera-Grant + Commands
spike/
├── spike.js              # On-Screen-Overlay + Brücke zu den Rust-Commands
├── build-frontend.sh     # kopiert die PWA nach spike-dist/ und injiziert spike.js
└── analyze.py            # wertet spike-log.csv pro Phase aus
.github/workflows/
└── spike-mac-build.yml   # baut unsignierte .app/.dmg auf macos-14 (+ Bundle-Diagnose)
```

**Architektur der Messung:** Die App nutzt **dieselbe rAF-Schleife** wie die echte PWA
(`detection.loop` → `detectFrame`). Jeder abgeschlossene Detection-Callback ruft
`window.__nailguardSpike.onDetection()` → `invoke("spike_tick")`. Das **lückenlose Logging
macht die Rust-Seite**: ein nativer Thread in `main.rs` tickt jede Sekunde und schreibt eine
CSV-Zeile – auch dann, wenn der WebView (rAF + JS-Timer) eingefroren ist. Genau deshalb
erscheint im versteckten Zustand eine Zeile mit `callbacks_letzte_sekunde = 0`, statt dass
die Messung „stehenbleibt". Fokus wird zusätzlich nativ über `WindowEvent::Focused` verfolgt.

CSV: `~/Desktop/nailguard-spike-log.csv`
Spalten: `iso_timestamp, sekunden_seit_start, callbacks_letzte_sekunde, visibilityState, hasFocus`

> Hinweis Datenhygiene: Der Logger hängt an dieselbe Datei an (kein Truncate pro Start),
> deshalb sammelten sich frühere Fehlversuche (Kamera blockiert → lauter Nullen) in derselben
> CSV. `analyze.py` bzw. die Auswertung trennt nach Sessions (Reset von `sekunden_seit_start`);
> ausgewertet wurde die letzte, kamera-aktive Session.

---

## Wie man es baut & startet

### Variante A – über GitHub Actions (ohne Mac)

1. Workflow **Spike macOS Build** läuft automatisch beim Push (oder manuell „Run workflow").
2. **Actions → der Run → Artifacts → `NailGuard-Spike-macOS`** herunterladen (ZIP mit `.dmg`/`.app`).
3. Der Workflow-Schritt „Inspect bundle" druckt zur Kontrolle `NSCameraUsageDescription`,
   Codesign-Flags und Entitlements des gebauten Bundles.

### Variante B – lokal auf einem Mac

```bash
# Voraussetzungen: Rust (rustup), Node, Xcode Command Line Tools
npm install -g @tauri-apps/cli@^2
tauri icon icons/icon-512.png   # generiert src-tauri/icons (einmalig)
tauri build                     # -> src-tauri/target/release/bundle/{dmg,macos}
```

`build-frontend.sh` läuft automatisch als `beforeBuildCommand` und erzeugt `spike-dist/`.

---

## Anleitung für Paul (zum Anklicken)

1. Alte „NailGuard Spike"-App in den Papierkorb (damit sicher die neue läuft).
2. Aktuelles Artefakt aus GitHub Actions laden, entpacken, `.dmg` öffnen, App nach
   **Programme** ziehen.
3. Unsigniert öffnen: **Rechtsklick auf die App → „Öffnen" → im Dialog „Öffnen"**.
4. **„Kamera starten"** klicken → macOS fragt nach der **Kamera** → **„Erlauben"**.
5. Overlay oben rechts prüfen: **Video läuft, Rate > 0.**

### Test-Choreografie (Kamera bleibt durchgehend an)

| Schritt | Aktion | Dauer |
|--------:|--------|-------|
| 1 | Vordergrund lassen | ~30 s |
| 2 | In eine **andere App** klicken (Fokus weg, sichtbar) | ~30 s |
| 3 | Ein **anderes Fenster komplett über** NailGuard legen | ~30 s |
| 4 | NailGuard **minimieren** | ~60 s |
| 5 | Wiederherstellen | – |

Danach App schließen → `nailguard-spike-log.csv` liegt auf dem Schreibtisch.
Auswertung: `python3 spike/analyze.py ~/Desktop/nailguard-spike-log.csv`.

---

## Ergebnisse

### Kamera

Funktioniert. **Wichtig – mit Standard-Tauri-2-Konfiguration startet die Kamera NICHT**
(sofortiger „blockiert"-Fehler, **kein** System-Dialog). Nötig waren drei Dinge zusammen:

1. `NSCameraUsageDescription` in `src-tauri/Info.plist` (wird auto-gemerged).
2. Ein eigener **WKUIDelegate**, der
   `webView:requestMediaCapturePermissionForOrigin:…:decisionHandler:` mit *grant* beantwortet
   (gesetzt via `with_webview`/`setUIDelegate:`). WRY implementiert das für Screen-Sharing,
   **nicht** für die Kamera – das ist der offene Punkt wry#1195.
3. Das **Kamera-Entitlement** (`com.apple.security.device.camera`) – unter Hardened Runtime
   verweigert macOS sonst still (ohne Dialog).

Berechtigungsdialog: erschien **einmal** (kein doppelter Prompt). Sobald erteilt, lieferte
die bestehende MediaPipe-Schleife volle Bildrate.

### Hintergrund-Throttling (kamera-aktive Session, 317 s, Apple Silicon)

| Phase | `visibilityState`/`hasFocus` | Ø Callbacks/s | max | Anmerkung |
|-------|------------------------------|---------------|-----|-----------|
| Vordergrund (fokussiert, sichtbar) | visible / true | **~51** | 58 | volle Rate |
| Unfokussiert, **sichtbar** | visible / false | **~53** | 57 | **kein Throttling** |
| **Verdeckt** (Fenster komplett drüber) | hidden / false | **~0,5** | 20 | rAF gestoppt; nur 2 von 41 s ≠ 0 |
| **Minimiert** | hidden / false | **~0,0** | 1 | praktisch tot: 1 Callback in 158 s |

(Erste ~16 s = Aufwärmphase: Kamera starten + Berechtigung erteilen, daher 0/s.)

Kernbefund: **`requestAnimationFrame` ist an das Rendern gekoppelt.** macOS meldet sowohl
beim Minimieren als auch beim vollständigen Verdecken `visibilityState = hidden` und stellt
das Rendern – und damit rAF – ein. `backgroundThrottling: "disabled"` (gesetzt) ändert das
nicht: es hebt nur die Timer-Suspendierung auf, lässt rAF aber ohne Rendering nicht feuern.

---

## Einschätzung der Reserve für NailGuards Hintergrund-Erkennung

Eine Hand-zu-Mund-Bewegung dauert grob 1–3 s; schon 2–3 Detections/s würden reichen, um sie
zu erfassen. Das Problem ist **nicht die nötige Kadenz, sondern dass es im versteckten
Zustand gar keine Kadenz gibt** (~0/s). Besonders relevant: Schon das **bloße Verdecken**
durch ein anderes Fenster – der Normalfall, wenn jemand in einer anderen App arbeitet –
genügt, um die Erkennung zu stoppen. Es muss also nicht einmal minimiert sein.

Positiv: Solange das Fenster **sichtbar** bleibt (auch unfokussiert oder nur teilweise frei),
läuft die Erkennung mit voller Rate (~50–60/s).

## Empfehlung: GO (mit klarer Auflage)

**GO** für eine Tauri-Desktop-App – die Kamera funktioniert zuverlässig, und im sichtbaren
Zustand trägt die bestehende Erkennungsschleife voll. **Aber:** Die Hintergrund-Erkennung
**darf nicht** auf der WebView-`requestAnimationFrame`-Schleife basieren. Für NailGuards
Kernversprechen (Erkennen, während der Nutzer in anderen Apps arbeitet) ist mindestens eine
dieser Gegenmaßnahmen nötig:

1. **Erfassung + Inferenz auf die Rust-Seite ziehen** (native Kamera-Aufnahme per Timer im
   `backgroundThrottling`-unabhängigen Rust-Thread, Inferenz nativ oder im Worker).
   Entkoppelt die Erkennung vollständig von rAF/Rendering. **Empfohlener Weg.**
2. **Fenster nie verstecken lassen:** kleines, immer sichtbares Menüleisten-/Overlay-Fenster,
   das weiter gerendert wird (statt Minimieren/Verdecken). Pragmatisch, aber UX-Kompromiss.
3. **Web Worker** für die Detection (Worker-Timer werden anders gedrosselt als rAF) – günstiger
   Umbau, hängt aber weiter am Rendering, wenn Frames per `<video>`/`canvas` gezogen werden;
   muss separat verifiziert werden.
4. **Niedrigere Ziel-FPS** – löst den Versteckt-=-0-Fall **nicht** und ist daher keine Lösung.

Konkreter nächster Schritt nach dem „Go": kleiner Folge-Spike mit nativer Rust-Kamera-Erfassung,
gemessen gegen die hier ermittelte Vordergrund-Referenz (~50/s).

> Was beim Kamera-Blocker half (für die Produkt-App relevant): Der Spike stoppte zunächst bei
> „Kamera blockiert, kein Dialog". Ursache war die Kombination aus fehlendem WKUIDelegate-Grant
> **und** fehlendem Kamera-Entitlement unter Hardened Runtime. Beide sind im Repo umgesetzt und
> per CI-Bundle-Diagnose verifiziert (NSCameraUsageDescription, Entitlements, Codesign-Flags).

---

## Außerhalb des Scopes (bewusst nicht gemacht)

Keine Notarisierung (nur Ad-hoc-Signatur), kein Autostart, kein Tray-Icon, keine saubere
Architektur – Wegwerf-Code, fokussiert auf die zwei Fragen. Kommt erst nach dem „Go".
