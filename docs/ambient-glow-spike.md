# Ambient-Glow-Spike (Mac) – Test-Anleitung & Befund

Branch: `spike/ambient-glow` · unsigniert · macOS 14+

Ein zweites, natives Overlay-Fenster legt ein warmes Ember-Glühen über den
ganzen Bildschirm. Ein Steuerfenster simuliert das 0–1-Erkennungssignal (ohne
Kamera/MediaPipe). Kernfrage des Spikes: **bleibt das Glühen in einer
Bildschirmaufnahme unsichtbar?**

---

## 0. ZUERST: der Make-or-break-Test (Capture-Ausschluss)

Das ist der Schritt, an dem der Spike steht oder fällt:

1. **Bildschirmaufnahme starten** – macOS-eigene Aufnahme (`⇧⌘5` → „Ganzen
   Bildschirm aufnehmen"), **oder** in Zoom/Meet einen **Screenshare** des ganzen
   Bildschirms starten.
2. Im Steuerfenster den Regler **Test-Signal** nach rechts ziehen (oder
   **Leertaste** für einen Puls) und die **Max. Deckkraft** hochdrehen, bis das
   Glühen am Bildschirmrand deutlich sichtbar ist.
3. **Prüfen:** In der Aufnahme / im geteilten Bild muss das Glühen **fehlen** –
   du siehst es auf dem Monitor, die Aufnahme zeigt den Bildschirm ohne Tönung.

✅ Glühen fehlt in der Aufnahme → Capture-Ausschluss funktioniert, der Spike
trägt.
❌ Glühen ist in der Aufnahme sichtbar → `NSWindowSharingNone` greift auf deiner
Konfiguration nicht; bitte melden (macOS-Version + Aufnahme-App notieren).

> Hinweis Doppelmonitor: Der Spike legt das Overlay nur über den **Hauptmonitor**.

---

## 1. Installation (Gatekeeper)

Die App ist **unsigniert**. Beim ersten Start blockt macOS sie:

- **Rechtsklick auf die App → „Öffnen"** → im Dialog erneut „Öffnen".
- (Alternativ: Systemeinstellungen → Datenschutz & Sicherheit → „Trotzdem öffnen".)

Danach startet sie normal per Doppelklick.

---

## 2. Die beiden Stile vergleichen (A/B)

Im Steuerfenster oben, Karte **Stil (A/B)** – immer nur EINER aktiv:

- **Vignette** (Taste `1`): warmes Glühen wächst von den Rändern herein, Mitte
  bleibt frei. Dezent, „aus dem Augenwinkel".
- **Screen-Wash** (Taste `2`): ganzer Bildschirm leicht amber getönt.

Welcher fühlt sich beim Arbeiten weniger störend, aber trotzdem spürbar an?

## 3. Regler & Puls

- **Test-Signal (0–1):** simuliert die Hand-zu-Mund-Nähe. Bei 0 ist das Overlay
  unsichtbar, bei 1 maximal (bis zur eingestellten Deckkraft).
- **Leertaste / „Puls auslösen":** fährt das Signal kurz auf 1 und im Atem-Tempo
  wieder zurück – so fühlst du das Easing.
- **Max. Deckkraft:** Obergrenze des Glühens bei Signal = 1. Default bewusst
  dezent (18 %); zum Sichtbarmachen im Capture-Test ruhig hochdrehen.
- **Bewegung reduzieren:** Ist in den macOS-Bedienungshilfen „Bewegung
  reduzieren" aktiv, entfallen Atmen und Easing automatisch (Status-Karte zeigt
  es an).

---

## Was implementiert ist

- Zweites natives Tauri-Fenster: ganzflächig, transparent, `always_on_top`,
  klick-durchlässig (`set_ignore_cursor_events` **und** `setIgnoresMouseEvents`),
  über alle Spaces (`collectionBehavior`), über Menüleiste/Dock (`level 1000`).
- **Capture-Ausschluss** des Overlay-NSWindow via `setSharingType:
  NSWindowSharingNone` (objc2, direkt am NSWindow – analog zum Pill-Spike).
- Zwei Stile (Vignette / Screen-Wash), A/B-Umschalter, Intensitäts-Regler.
- Manueller Trigger: Regler, „Puls"-Button, Leertaste; Stil-Tasten `1`/`2`.
- Easing im Atem-Tempo rein über CSS (`@property --signal` + Transition) und
  leises Atmen (`@keyframes`), drossel-resistent ohne `requestAnimationFrame`.
- `prefers-reduced-motion` respektiert; Default dezent.
- App rendert nur eigene CSS-Schichten – **keine** System-Helligkeit/Gamma.

## Was Claude NICHT verifizieren konnte (→ Paul)

Claude Code läuft unter Linux, **ohne macOS-Laufzeit**. Daher konnte Folgendes
nicht selbst geprüft werden und muss auf echter Hardware bestätigt werden:

1. **Der Capture-Ausschluss** (Abschnitt 0) – die eigentliche Kernfrage.
2. Dass das Overlay tatsächlich über Menüleiste/Dock und neben Vollbild-Apps
   schwebt und klick-durchlässig bleibt.
3. Optik/Tempo der beiden Stile auf einem echten Display.

## Ausblick: vom Spike zum Feature

Das Overlay ist additiv gebaut: `spawn_overlay()` + `configure_overlay_macos()`
lassen sich in die volle App übernehmen, ohne Ring/Erkennung anzufassen. Statt
des Test-Signals würde später `refreshAppState()` den Wert 0–1 über denselben
`ambient:state`-Event senden (calm→warm→ember). Steuerfenster und
`ambient-dist/` sind reiner Spike-Code und entfallen dann.
