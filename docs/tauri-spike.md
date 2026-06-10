# Tauri-Spike: NailGuard als macOS-Desktop-App

Branch: `claude/nailguard-tauri-macos-spike-19mukz` · Stand: 2026-06-10

## Zusammenfassung

| Spike-Punkt | Status |
| --- | --- |
| 1. Tauri-2-Setup (`src-tauri/`, Fenster 1100×800, kein Build-Tool) | ✅ erledigt, kompiliert (`cargo check` + `cargo build` grün) |
| 2. Kamera-Berechtigung (Info.plist, Entitlement, WebView-Flags) | ✅ konfiguriert — Wirksamkeit nur auf einem echten Mac prüfbar |
| 3. Funktionstest (Kamera, lokale Modelle, Erkennung) | ⏳ vorbereitet, **nicht ausgeführt** (s.u.) |
| 4. Throttling-Test mit echten Zahlen | ⏳ Messwerkzeuge eingebaut, **Zahlen offen** (s.u.) |
| 5. Doku + Go/No-Go | ✅ dieses Dokument; Empfehlung: **bedingtes Go** |

**Wichtige Einschränkung:** Dieser Spike wurde in einer Linux-Container-Umgebung
ohne macOS, ohne Kamera und ohne Display umgesetzt. Alles, was sich dort
verifizieren lässt, wurde verifiziert (Projektstruktur, Dependency-Auflösung,
Rust-Kompilation inkl. Validierung von `tauri.conf.json`/Capabilities durch
`tauri-build`, ES-Modul-Validität des Desktop-Frontends, vollständige Entfernung
aller CDN-Referenzen). Die macOS-spezifischen Tests (Punkte 3 und 4) sind als
präzises, in ~15 Minuten abarbeitbares Protokoll vorbereitet — die
Ergebnis-Tabellen unten sind bewusst leer und müssen auf einem Mac gefüllt
werden, bevor die Go-Entscheidung final ist.

---

## 1. Was eingerichtet wurde

### Struktur

```
desktop/              ← Frontend für Tauri (generierte Kopie + lokale Assets)
  index.html          ← aus index.html generiert (CSP lokal, keine Google Fonts,
                         kein Manifest, FPS-Logger eingebunden)
  app.js              ← aus app.js generiert (lokale MediaPipe-Pfade, kein
                         Service Worker, instrumentierte Erkennungsschleife)
  fps-logger.js       ← FPS-Protokollierung für den Throttling-Test
  style.css, i18n.js, icons/   ← unveränderte Kopien
  models/             ← MediaPipe-Bibliothek, WASM, beide .task-Modelle (~30 MB)
src-tauri/            ← Tauri 2.x (Rust), Fenster „NailGuard“ 1100×800
tools/sync-desktop-frontend.py   ← regeneriert desktop/ aus der Web-App
tools/fetch-mediapipe-assets.sh  ← lädt desktop/models/ neu herunter
package.json          ← nur @tauri-apps/cli (kein Build-Tool)
```

### Warum eine generierte Kopie statt `frontendDist` direkt aufs Repo-Root?

Die Vorgabe „Web-App unverändert als Frontend“ kollidiert mit zwei Fakten:

1. **Es gab kein lokales `models/`-Verzeichnis.** Die Web-App lädt die
   MediaPipe-Bibliothek per statischem ES-Import von `cdn.jsdelivr.net` und die
   Modelle von `storage.googleapis.com` (`app.js`, Zeilen 1–14). Ein statischer
   Import einer absoluten CDN-URL lässt sich von außen nicht umbiegen — ohne
   Eingriff in `app.js` gibt es keinen CDN-freien Betrieb.
2. `frontendDist` aufs Repo-Root würde bei `tauri build` das gesamte Repo
   (inkl. `src-tauri/target/`) ins App-Bundle packen.

Lösung: `tools/sync-desktop-frontend.py` erzeugt `desktop/` deterministisch aus
den **unangetasteten** Originalen und wendet genau fünf dokumentierte Patches an
(lokaler MediaPipe-Import, lokale Modell-Pfade, Service Worker aus, CDN-freie
CSP, umschaltbarer Schleifentreiber). Ändert sich die Web-App, schlägt das
Skript hart fehl statt still zu driften. Die Web-App selbst wurde mit keinem
Byte verändert.

### Lokale MediaPipe-Assets

`desktop/models/` enthält exakt die Version, die die Web-App vom CDN lädt
(`@mediapipe/tasks-vision@0.10.15`, beide float16-Modelle). Herkunft und
Aktualisierung: `desktop/models/README.md`. **„Kein CDN-Request“ ist strukturell
erzwungen:** Die CSP in `desktop/index.html` erlaubt nur noch `'self'` — ein
versehentlicher CDN-Zugriff würde geblockt und die App würde sichtbar
fehlschlagen, statt still aufs Netz auszuweichen. Zusätzliche Verifikation auf
dem Mac: siehe Testprotokoll Schritt 3.

## 2. Build & Start auf dem Mac

Voraussetzungen: Rust (rustup), Xcode Command Line Tools, Node ≥ 18.

```bash
npm install
npm run tauri dev      # erster Rust-Build dauert einige Minuten
```

Beim ersten Klick auf „Kamera starten“ muss der macOS-Kamera-Prompt mit dem
konfigurierten deutschen Text erscheinen.

## 3. Kamera-Konfiguration: was tatsächlich nötig war

| Baustein | Datei | Anmerkung |
| --- | --- | --- |
| `NSCameraUsageDescription` | `src-tauri/Info.plist` | Pflicht; Tauri merged die Datei ins Bundle und bettet sie via `embed_plist` auch ins **dev**-Binary ein, der Prompt funktioniert also schon unter `tauri dev`. Achtung: Im dev-Modus attribuiert macOS (TCC) die Berechtigung u.U. dem Terminal/IDE-Prozess. |
| `com.apple.security.device.camera` | `src-tauri/entitlements.plist`, referenziert in `tauri.conf.json` → `bundle.macOS.entitlements` | Wirkt erst bei signierten Builds (Hardened Runtime/Sandbox, d.h. `tauri build` + Codesigning/Notarisierung). Für `tauri dev` irrelevant, aber jetzt schon korrekt verdrahtet. |
| WebView-Media-Capture | — | **Kein zusätzliches Flag nötig.** wry (Tauris WebView-Layer) implementiert den `WKUIDelegate`-Handler `requestMediaCapturePermissionForOrigin` und gibt Capture frei; es bleibt der OS-Prompt. `macOSPrivateApi` ist **nicht** erforderlich (das Flag betrifft transparente Fenster, nicht Media Capture) und steht explizit auf `false`. |
| `minimumSystemVersion: 12.3` | `tauri.conf.json` | `getUserMedia` in WKWebView ist erst ab macOS 12.x verfügbar; konservativ auf 12.3 gesetzt. |

**Bekanntes Risiko (recherchiert, nicht selbst reproduzierbar):** Unter
macOS 14.x gab es in wry einen Bug-Komplex um den Kamera-Prompt — doppelter
Prompt (App- und WebView-Ebene) bzw. zeitweise gar kein Prompt; ein Fix wurde
wegen einer Regression revertiert, Ursache ist ein von Apple später behobener
WebKit-Bug ([wry #1195](https://github.com/tauri-apps/wry/issues/1195),
[tauri #11951](https://github.com/tauri-apps/tauri/issues/11951)). Beim
Funktionstest gezielt prüfen, wie sich der Prompt auf der Ziel-macOS-Version
verhält. Ein doppelter Prompt wäre kosmetisch (akzeptabel für den Spike), ein
ausbleibender Prompt wäre ein Blocker im Sinne des Abbruchkriteriums.

## 4. Throttling-Test: Werkzeuge & Protokoll

### Eingebaute Messwerkzeuge

- `desktop/fps-logger.js` loggt alle 5 s:
  `[nailguard-fps] mode=raf fps=29.8 intervalSec=5.0 visibility=visible cameraFramesAdvancing=true`
  — in die DevTools-Konsole **und** (über das Tauri-Command `log_fps`, mit
  Unix-Timestamp) ins `tauri dev`-Terminal, damit die Werte auch bei
  verstecktem Fenster ablesbar sind. `fps` rechnet mit der real verstrichenen
  Zeit; wird der Logger selbst suspendiert, verraten das die Timestamp-Lücken
  im Terminal und ein `intervalSec` ≫ 5.
- Die Erkennungsschleife läuft über einen umschaltbaren Treiber
  (DevTools-Konsole, wird in localStorage persistiert):
  - `__nailguardSetLoopMode("raf")` — `requestAnimationFrame` (Standard, wie Web-App)
  - `__nailguardSetLoopMode("interval")` — `setTimeout`-Kette (33 ms)
  - `__nailguardSetLoopMode("worker")` — Web-Worker-Ticks (33 ms), Verarbeitung weiter im Main Thread
- Rust-Commands für reproduzierbare Fensterzustände (DevTools-Konsole):
  - `__TAURI__.core.invoke("minimize_for_secs", { secs: 30 })` — Test (a)
  - `__TAURI__.core.invoke("hide_for_secs", { secs: 30 })` — Test (c)
  - `__TAURI__.core.invoke("offscreen_for_secs", { secs: 30 })` — Gegenmaßnahme „off-screen statt verstecken“
  - Test (b) „hinter anderen Fenstern“: manuell ein Vollbild-Fenster davorlegen.

Wichtig: `cameraFramesAdvancing` getrennt von `fps` lesen — es ist möglich,
dass die Schleife weiterläuft (Worker-Modus), macOS/WebKit aber den
**Kamera-Stream** pausiert. Dann steht dort `false`, und die Erkennung ist
trotz laufender Schleife blind. Das wäre der härteste Befund gegen das
Verkaufsargument „läuft unsichtbar im Hintergrund“.

### Testprotokoll (auf dem Mac, ~15 Minuten)

1. `npm run tauri dev`, Kamera starten, Onboarding durchlaufen/skippen.
2. **Funktionstest:** Kamerabild sichtbar? Gesicht-/Hand-Signale reagieren?
   Hand 2 s an den Mund → Intervention löst aus?
3. **CDN-Check:** Rechtsklick → Inspect Element → Netzwerk-Tab, Seite neu
   laden: alle Requests nur `tauri://localhost` (bzw. lokal)? Zur Sicherheit
   WLAN aus und App neu starten — sie muss vollständig funktionieren.
4. **Baseline:** 2–3 Logzeilen bei sichtbarem Fenster notieren (erwartet: ~30
   fps, da an die Kamera-Framerate gekoppelt — die Schleife tickt mit
   Display-Hz, `detectForVideo` läuft nur bei neuen Video-Frames; `fps` zählt
   Schleifen-Ticks).
5. Pro Loop-Modus (`raf` → `interval` → `worker`; nach Umschalten kurz warten):
   je 30 s minimiert, verdeckt, versteckt, off-screen (Commands oben), danach
   die Terminal-Logzeilen in die Tabelle übertragen.

### Ergebnisse (auszufüllen)

Schleifen-Ticks/s (`fps`) und Kamera-Status (`cameraFramesAdvancing`):

| Fensterzustand | mode=raf | mode=interval | mode=worker | Kamera läuft? |
| --- | --- | --- | --- | --- |
| sichtbar (Baseline) | _____ | _____ | _____ | _____ |
| (a) minimiert | _____ | _____ | _____ | _____ |
| (b) verdeckt (occluded) | _____ | _____ | _____ | _____ |
| (c) `hide()` | _____ | _____ | _____ | _____ |
| off-screen (Gegenmaßnahme) | _____ | _____ | _____ | _____ |

### Erwartung laut Recherche (zu verifizieren)

- **rAF wird bei unsichtbarem WebView komplett pausiert** (WKWebView koppelt
  rAF an die Occlusion-/Visibility-State des Fensters) → erwartet ~0 fps bei
  (a) und (c), möglicherweise auch bei (b).
- **DOM-Timer** (`setTimeout`/`setInterval`) werden in versteckten WebKit-Pages
  auf ≥ 1 s geclampt → erwartet ~1 fps im `interval`-Modus. 1 fps könnte für
  eine Gewohnheits-Erkennung mit 2 s Haltezeit knapp ausreichen — Grenzfall.
- **Worker-Timer werden nicht geclampt** → bester Kandidat. Offen ist, ob die
  Main-Thread-Verarbeitung der Worker-Messages und vor allem der
  **Kamera-Stream** bei verstecktem Fenster weiterlaufen.
- **App Nap** (macOS-Prozess-Drosselung bei verdeckten Apps) kann zusätzlich
  den ganzen Prozess einschläfern. Gegenmaßnahme für Phase 1, falls die
  Messung das zeigt: im Rust-Setup eine `NSProcessInfo`-Activity halten
  (`beginActivityWithOptions: NSActivityUserInitiated |
  NSActivityIdleSystemSleepDisabled`, via `objc2-foundation`); alternativ/
  zusätzlich Fenster off-screen positionieren statt `hide()`.

Quellen: [WebKit-Timer-Throttling/Worker-Verhalten](https://medium.com/@adithyaviswam/overcoming-browser-throttling-of-setinterval-executions-45387853a826),
[WKWebView-rAF/Timer in unsichtbaren Views](https://github.com/liquidx/webviewscreensaver/issues/75),
[wry #1195](https://github.com/tauri-apps/wry/issues/1195).

## 5. Go/No-Go-Empfehlung

**Bedingtes Go.** Die Machbarkeit der Hülle ist gezeigt: Tauri 2 ließ sich ohne
Build-Tool über die bestehende Vanilla-JS-App legen, der Rust-Teil kompiliert,
die App ist vollständig CDN-frei, und die Kamera-Konfiguration entspricht dem
dokumentierten Stand von Tauri/wry. Es gibt keinen bekannten strukturellen
Blocker.

Final wird das Go aber von zwei empirischen Fragen abhängig gemacht, die nur
der Mac-Lauf beantwortet (Tabellen oben):

1. **Kamera-Prompt erscheint und `getUserMedia` liefert Frames** auf der
   Ziel-macOS-Version (Risiko: wry-#1195-Komplex unter macOS 14.x).
   Wenn nein → Abbruchkriterium des Spikes greift, No-Go dokumentieren.
2. **Mindestens eine Loop-Variante hält die Erkennung bei unsichtbarem Fenster
   bei ≥ ~5 fps, inklusive laufendem Kamera-Stream.** Wenn der Kamera-Stream
   bei verstecktem Fenster hart pausiert wird und auch die
   Off-Screen-/App-Nap-Gegenmaßnahmen nichts ändern, ist „Erkennung läuft
   unsichtbar im Hintergrund“ als Verkaufsargument nicht haltbar — dann bliebe
   nur ein sichtbares Mini-Fenster (z.B. immer im Vordergrund, klein) als
   Produktkompromiss.

### Offene Risiken

- **Throttling-Zahlen fehlen** (Kernrisiko, s.o.).
- **macOS-14.x-Prompt-Bug** in wry (doppelter/ausbleibender Kamera-Prompt).
- **Repo +30 MB** durch eingecheckte MediaPipe-Binärdateien → vor Phase 1 auf
  Git LFS oder `tools/fetch-mediapipe-assets.sh` als Setup-Schritt umstellen.
- **Doppelpflege `desktop/`**: generierte Kopien sind eingecheckt; nach jeder
  Web-App-Änderung `npm run sync-desktop` ausführen (Skript bricht bei
  Patch-Drift hart ab, das Risiko ist also sichtbar, aber manuell).
- **localStorage in WKWebView** hängt am WebKit-DataStore der App und kann bei
  Updates/Neuinstallation verloren gehen — bestätigt den Plan, in Phase 1 auf
  `tauri-plugin-store` zu wechseln.
- **Dauerhafter Kamera-Betrieb** = sichtbare Kamera-LED + Energieverbrauch;
  für eine Hintergrund-App produktseitig einzuordnen (kein technischer Blocker).
- **Verteilung** erfordert Codesigning + Notarisierung (Entitlement ist
  vorbereitet); ungeklärt, bewusst außerhalb des Spike-Scopes.

## 6. Phase-1-Anschluss (Ausblick)

Tray-Icon, Autostart und `tauri-plugin-store` setzen direkt auf diesem Gerüst
auf (`src-tauri/capabilities/default.json` ist vorhanden, Plugins werden dort
freigeschaltet). Sollte der Throttling-Test den Worker-Modus als Sieger zeigen,
sollte Phase 1 den Schleifentreiber fest auf Worker stellen und die
rAF-Variante entfernen.
