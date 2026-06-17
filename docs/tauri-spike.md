# Spike: Tauri 2.x Machbarkeit für NailGuard

**Status:** Wegwerf-Spike (kein Produktiv-Code). Branch: `claude/spike-tauri-nailguard-tqlfm1`.
`main` und der PWA-Code bleiben unangetastet; die einzige Ergänzung am App-Code
ist ein klar markierter, inerter Zähler-Hook in `app.js` (`window.__nailguardSpike`).

Der Spike beantwortet genau zwei Fragen:

1. **Kamera:** Funktioniert `getUserMedia` / MediaPipe im WKWebView der Tauri-App auf macOS?
2. **Hintergrund-Throttling:** Läuft die rAF-Erkennungsschleife weiter, wenn das Fenster
   den Fokus verliert, verdeckt oder **minimiert** ist – und mit welcher Rate?

> **Wichtiger Hinweis zum Status:** Der Spike wurde in einer Linux-Cloud-Umgebung
> entwickelt (dort kein macOS/WKWebView, keine Rust-Kompilierung – crates.io gesperrt).
> Das **macOS-Bundle wird daher von GitHub Actions** auf einem `macos-14`-Runner gebaut
> (`.github/workflows/spike-mac-build.yml`). Konsequenz:
>
> - Der **Code ist vollständig** (Scaffold, Mess-Instrumentierung, Auswertung, CI-Workflow).
> - Das **.app/.dmg** entsteht durch den Actions-Lauf (Artefakt `NailGuard-Spike-macOS`)
>   oder lokal per `tauri build` auf einem Mac (Variante B).
> - Der eigentliche **Mess-Lauf** und damit die `[MESSEN]`-Felder unten erfolgen auf Pauls
>   Mac (Abschnitt „Test-Choreografie").

---

## Was gebaut wurde

```
src-tauri/
├── Cargo.toml            # Tauri-2-Abhängigkeiten
├── build.rs
├── Info.plist            # NSCameraUsageDescription (wird von Tauri auto-gemerged)
├── tauri.conf.json       # lädt spike-dist/, backgroundThrottling: "disabled"
└── src/main.rs           # nativer 1-Sekunden-CSV-Logger + Tauri-Commands
spike/
├── spike.js              # On-Screen-Overlay + Brücke zu den Rust-Commands
├── build-frontend.sh     # kopiert die PWA nach spike-dist/ und injiziert spike.js
└── analyze.py            # wertet spike-log.csv pro Phase aus
.github/workflows/
└── spike-mac-build.yml   # baut unsignierte .app/.dmg auf macos-14
```

**Architektur der Messung (der Knackpunkt):** Die App nutzt **dieselbe rAF-Schleife**
wie die echte PWA (`detection.loop` → `detectFrame`). Jeder abgeschlossene
Detection-Callback ruft `window.__nailguardSpike.onDetection()` → `invoke("spike_tick")`.

Entscheidend: Das **lückenlose Logging macht die Rust-Seite**, nicht das WebView.
Ein nativer Thread in `main.rs` tickt jede Sekunde und schreibt eine CSV-Zeile –
**auch dann, wenn der WebView (rAF + JS-Timer) von macOS eingefroren ist.** Genau
deshalb taucht im minimierten Zustand eine Zeile mit `callbacks_letzte_sekunde = 0`
auf, statt dass die Messung einfach „stehenbleibt". Der Fensterfokus wird zusätzlich
nativ über Tauris `WindowEvent::Focused` verfolgt.

CSV-Datei: `~/Desktop/nailguard-spike-log.csv`
Spalten: `iso_timestamp, sekunden_seit_start, callbacks_letzte_sekunde, visibilityState, hasFocus`

---

## Wie man es baut & startet

### Variante A – über GitHub Actions (ohne Mac, empfohlen für die Bundle-Erstellung)

1. Workflow **Spike macOS Build** läuft automatisch beim Push auf den Branch
   (oder manuell über „Run workflow").
2. Nach dem Lauf: **Actions → der Run → Artifacts → `NailGuard-Spike-macOS`** herunterladen.
   Das ZIP enthält die `.dmg` und die `.app`.

> **Status: Build ist grün.** Letzter erfolgreicher Lauf:
> <https://github.com/drunknmonkey/NailGuard/actions/runs/27698487672> – Artefakt
> `NailGuard-Spike-macOS` (~34 MB, enthält `.dmg` + `.app`). Download oben rechts im Run
> unter „Artifacts" (GitHub-Login nötig). Damit ist das doppelklickbare Bundle vorhanden;
> es fehlt nur noch Pauls Mess-Lauf.

### Variante B – lokal auf einem Mac (für Entwickler)

```bash
# Voraussetzungen: Rust (rustup), Node 20, Xcode Command Line Tools
npm install -g @tauri-apps/cli@^2
tauri icon icons/icon-512.png   # generiert src-tauri/icons (einmalig)
tauri build                     # erzeugt src-tauri/target/release/bundle/{dmg,macos}
# oder zum Entwickeln:
tauri dev
```

`build-frontend.sh` läuft automatisch als `beforeBuildCommand` und erzeugt `spike-dist/`.

---

## Anleitung für Paul (einfach, zum Anklicken)

1. **Datei holen:** Die Datei `NailGuard Spike_…_.dmg` liegt im heruntergeladenen
   Ordner (aus GitHub Actions, Artefakt `NailGuard-Spike-macOS`).
2. **Installieren:** Doppelklick auf die `.dmg`. Im Fenster das **NailGuard-Spike-Symbol
   in den Ordner „Programme" ziehen** (oder einfach direkt aus dem `.dmg` starten).
3. **Unsignierte App öffnen:** Beim ersten Start meldet macOS „nicht verifizierter
   Entwickler". Deshalb **nicht** doppelklicken, sondern:
   **Rechtsklick auf die App → „Öffnen" → im Dialog noch einmal „Öffnen"**.
   (Bei sehr neuem macOS ggf.: **Systemeinstellungen → Datenschutz & Sicherheit →
   ganz unten „Dennoch öffnen".**)
4. **Kamera erlauben:** Wenn macOS fragt „… möchte auf die Kamera zugreifen", auf
   **„Erlauben"** klicken. *Es kann sein, dass die Frage zweimal kommt* (einmal für die
   App, einmal für den WebView) – beide Male **„Erlauben"**.
5. In der App auf **„Kamera starten"** klicken und auch dort den Zugriff erlauben.
6. Oben rechts erscheint das **schwarze Mess-Overlay** mit „Rate /s", „Zeit", „visibility"
   und „hasFocus". Prüfen: **Video läuft, Rate ist größer als 0.**

### Test-Choreografie (bitte in dieser Reihenfolge, Kamera bleibt durchgehend an)

| Schritt | Aktion | Dauer |
|--------:|--------|-------|
| 1 | App im Vordergrund lassen, nichts tun | ~30 s |
| 2 | In eine **andere App** klicken (NailGuard verliert den Fokus, bleibt aber sichtbar) | ~30 s |
| 3 | Ein **anderes Fenster komplett über** NailGuard legen (verdeckt) | ~30 s |
| 4 | NailGuard **minimieren** (gelber Knopf / ⌘M) | ~60 s |
| 5 | Fenster **wiederherstellen** | – |

Danach die App schließen. Auf dem **Schreibtisch** liegt jetzt die Datei
`nailguard-spike-log.csv`. Diese Datei an die Entwickler schicken.

### Auswertung

```bash
python3 spike/analyze.py ~/Desktop/nailguard-spike-log.csv
```

Gibt die durchschnittliche Rate pro Phase und die komplette Zeitreihe aus.

---

## Ergebnisse

### Testumgebung `[MESSEN]`

- macOS-Version: `[MESSEN, z. B. 14.5 Sonoma / 15.x Sequoia]`
- Chip: `[MESSEN, Apple Silicon (M-Serie) oder Intel]`
- Kamera: `[MESSEN, z. B. integrierte FaceTime-HD]`

### Kamera `[MESSEN]`

- Video im WebView sichtbar? `[ja/nein]`
- Berechtigungsdialog(e): `[einmal / zweimal / gar nicht]`
- Macken: `[z. B. doppelter Prompt, Verzögerung, schwarzes Bild]`

> **Technische Erwartung:** Mit `NSCameraUsageDescription` in der `Info.plist` startet
> `getUserMedia` im WKWebView. Bekannte Macke auf macOS 14: der Berechtigungsdialog kann
> **zweimal** erscheinen (App-Ebene + WebView-Ebene). Bleibt das Bild schwarz oder startet
> die Kamera gar nicht → siehe „Bei hartem Blocker" unten.

### Hintergrund-Throttling `[MESSEN]`

Werte aus `analyze.py` eintragen:

| Phase | Ø Callbacks/s | Anmerkungen |
|-------|---------------|-------------|
| Vordergrund (fokussiert, sichtbar) | `[MESSEN]` | Referenzrate, vermutlich ~30–60 |
| Unfokussiert, sichtbar | `[MESSEN]` | |
| Verdeckt (anderes Fenster darüber) | `[MESSEN]` | |
| Minimiert | `[MESSEN]` | **der eigentliche Knackpunkt** |

---

## Technische Einschätzung & Empfehlung

> Diese Einschätzung beruht auf der dokumentierten WKWebView-/macOS-Mechanik. Sie ist
> **vor** dem Mess-Lauf formuliert; die `[MESSEN]`-Tabelle bestätigt oder widerlegt sie.

**Frage 1 – Kamera: voraussichtlich GO.** `getUserMedia` + MediaPipe laufen im WKWebView,
sobald `NSCameraUsageDescription` gesetzt ist. Einziger zu erwartender Reibungspunkt ist
der mögliche Doppel-Prompt – kein Blocker.

**Frage 2 – Hintergrund-Erkennung im minimierten Zustand: voraussichtlich NO-GO für die
unveränderte rAF-Schleife.** Grund: `requestAnimationFrame` ist an das Rendern des Fensters
gekoppelt. Ein **minimiertes oder vollständig verdecktes** WKWebView wird von macOS nicht
gerendert, `document.visibilityState` wird `hidden`, und rAF-Callbacks werden praktisch
gestoppt (erwartete Rate ~0/s). Wichtig: Tauris `backgroundThrottling: "disabled"` (in
`tauri.conf.json` gesetzt) hebt zwar die **Timer-Suspendierung** auf, ändert aber nichts
daran, dass **rAF ohne Rendering nicht feuert**. Genau deshalb misst der Spike mit der
optimistischen Einstellung `"disabled"` – wenn es **damit** nicht läuft, ist es ein
belastbares NO-GO für „Erkennung per WebView-rAF im Hintergrund".

**Entscheidungsregel an der Messung:**

- **Minimiert ≥ ~10 Callbacks/s →** GO. Tauri-WebView taugt auch für die Hintergrund-Erkennung;
  ggf. Ziel-FPS senken reicht als Optimierung.
- **Minimiert ~1–5 Callbacks/s →** GRENZWERTIG. Für Nägelkauen (Hand-zu-Mund dauert i. d. R.
  > 1 s) evtl. gerade ausreichend, aber riskant → Gegenmaßnahmen nötig (siehe unten).
- **Minimiert ~0 Callbacks/s →** NO-GO für „minimiert erkennen" mit der reinen rAF-Schleife.
  Vordergrund/unfokussiert-sichtbar bleiben aber nutzbar.

**Bewertung der Reserve für NailGuard:** Eine Hand-zu-Mund-Bewegung dauert grob 1–3 Sekunden.
Selbst 2–3 zuverlässige Detections/s würden zum Erfassen reichen. Das Problem ist nicht die
nötige Kadenz, sondern dass rAF im **minimierten** Zustand voraussichtlich komplett pausiert –
dann gibt es gar keine Kadenz. „Verdeckt, aber nicht minimiert" ist der Grenzfall, der über
die Praxistauglichkeit entscheidet und deshalb in der Choreografie separat getestet wird.

### Empfehlung

**GO für eine Tauri-Desktop-App – aber NICHT für „Hintergrund-Erkennung per WebView-rAF im
minimierten Zustand".** Die Kamera funktioniert, und solange das Fenster sichtbar ist (auch
unfokussiert), trägt die bestehende Erkennungsschleife. Für NailGuards Kernversprechen
(Erkennen, während der Nutzer in anderen Apps arbeitet) braucht es **mindestens eine** der
folgenden Gegenmaßnahmen – abhängig vom Messergebnis:

- **Stream/Erfassung auf die Rust-Seite ziehen:** Kamera nativ in Rust öffnen, Frames per
  Timer (vom `backgroundThrottling`-unabhängigen Rust-Thread) ziehen und an die Inferenz
  geben. Entkoppelt die Erkennung vollständig von rAF/Rendering.
- **Detection in einen Web Worker** verlagern (Worker-Timer werden anders gedrosselt als rAF;
  in Kombination mit `backgroundThrottling: "disabled"` zu prüfen) – günstigerer Umbau, aber
  hängt weiter am Rendering, wenn die Frames per `<video>`/`canvas` gezogen werden.
- **Fenster nie minimieren lassen:** Statt Minimieren in ein kleines, immer sichtbares
  Menüleisten-/Overlay-Fenster ausweichen, das weiter gerendert wird (native Wake-Strategie).
- **Niedrigere Ziel-FPS** – nur relevant, falls die Messung „grenzwertig" ergibt; löst den
  Minimiert-=-0-Fall **nicht**.

Konkrete nächste Schritte nach einem „Go": kleinen Folge-Spike mit nativer Rust-Kamera-Erfassung
bauen und gegen die hier gemessene Vordergrund-Referenzrate vergleichen.

---

## Bei hartem Blocker

Startet die Kamera im WKWebView trotz `NSCameraUsageDescription` partout nicht (schwarzes
Bild, kein Prompt, sofortiger Crash): **stoppen und dokumentieren** statt Workarounds zu
basteln. Das ist selbst ein Ergebnis für das Gate. Relevante Infos für die Doku: macOS-Version,
Chip, ob ein Prompt erschien, Konsolen-/Crash-Log.

---

## Außerhalb des Scopes (bewusst nicht gemacht)

Keine Signierung/Notarisierung, kein Autostart, kein Tray-Icon, keine saubere Architektur –
das ist Wegwerf-Code, fokussiert auf die zwei Fragen. Kommt erst nach einem „Go".
