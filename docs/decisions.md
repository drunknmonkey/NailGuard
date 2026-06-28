# NailGuard – Getroffene Entscheidungen

Chronologisch. Neue Entscheidungen unten anhängen.

---

## 2026-06-09 – Design-Sprache „Atem & Ruhe" (PR #1 + #2)

Erster großer Redesign-Pass. Ziel war ein ruhiger, nicht-überwachender Look.

- **Ruhiger Begleiter statt Überwachungstool** – kein Rot, keine Alarmikonik,
  sanfte Farbübergänge, atmender Ring als Signatur-Element.
- **body[data-state]** statt direkter DOM-Manipulation: zentraler State-Key
  steuert alle animierten CSS-Zustandsübergänge.
- **Drei Reiter** (Focus / Review / Einstellungen) statt flache Navigation.
  Office Mode ist Zustand, nicht Reiter – Vollbild ohne Header (Tarnung).
- **Auto-Tune-Feedback**: Treffer/Fehlalarm/Gesicht-berührt justieren
  distanceThreshold × Faktor und holdSeconds ± Delta (begrenzt + quantisiert).

---

## 2026-06-09 – i18n DE/EN ab Start (PR #1)

- Alle User-sichtbaren Strings durch `t(key)` ersetzt; Rohstrings verboten.
- Sprach-Autodetect aus Browser; persisiert in `localStorage`.
- Entscheidung: **nur DE + EN**, kein Mehrsprachigkeits-Framework.

---

## 2026-06-09 – Kalibrierungs-Wizard (PR #1)

- 4-Schritt-Onboarding beim ersten Kamerastart (Gesicht → Hand → Mund → Fertig).
- Abgeleitet: persönlicher distanceThreshold = touchMin × 1.35, begrenzt auf 0.045–0.13.
- Jederzeit über Einstellungen neu startbar; Abschluss in `localStorage` gespeichert.

---

## 2026-06-09 – MediaPipe vollständig self-hosted (PR #3)

- FaceLandmarker + HandLandmarker, WASM und ES-Modul liegen unter `vendor/` + `models/`.
- Kein externer CDN-Aufruf, kein Netzwerk nötig nach erstem Load.
- Service Worker precacht alles; App ist offline-fähig.

---

## 2026-06-10 – Office Mode = Tarnung als Texteditor (PR #5)

- **Verworfen**: Uhranzeige (Pauls ursprüngliche Idee).
- **Entschieden**: Schlichte Texteditor-Oberfläche (Notizen.txt) mit Menüleiste,
  Textarea, Fußzeile + Wortzahl. Beschreibbar, Inhalt in `localStorage`.
- Status-Punkt (kleines Dot in Fußleiste) spiegelt Ring-Farbe (calm/warm/ember).
- Verlassen per Klick auf Punkt, ✕ oder Esc-Taste.
- Office-Optionen (Status-Punkt an/aus, dezente Interventionen) in den Einstellungen,
  nie im Office-View selbst.

---

## 2026-06-17 – Tauri-Spike: rAF-Throttling im WKWebView (Spike-Branch)

- **Kamera OK** in WKWebView mit drei Teilen: NSCameraUsageDescription + WKUIDelegate-Grant + Kamera-Entitlement.
- **rAF-Hintergrund: NO-GO** – macOS drosselt auf ~0/s, sobald Fenster hidden.
- **Lösung: Pill-Modus** – immer sichtbares Mini-Fenster (transparent, always-on-top,
  alle Spaces). Solange sichtbar: Ø 44,5/s, kein Throttling, 0 hidden-Sekunden.
- Architektur-Entscheidung: **Ein Fenster, ein WebView** – Moduswechsel ändert nur
  CSS-Klasse + Fenster-Properties, Stream läuft durch.

---

## 2026-06-28 – Kameraauswahl: facingMode durch enumerateDevices ersetzen

- `getUserMedia({ video: { facingMode: "user" } })` ohne `deviceId` wählt auf macOS
  manchmal virtuelle Kameras (OBS) statt der echten Webcam.
- **Entschieden**: Dropdown mit `enumerateDevices()`, Default-Heuristik bevorzugt
  echte Webcam (schließt "virtual", "obs", "snap", "camo", "ndivideokit" im Namen aus);
  Live-Wechsel ohne Neustart (Stream wird sauber neu aufgebaut).

---

## 2026-06-28 – Tab-Sichtbarkeit: Page Visibility API → paused-Zustand

- Wenn der Tab in den Hintergrund wechselt, pausiert die App automatisch
  (= paused-Ring-Zustand). Bei Rückkehr wird die Pause aufgehoben.
- Begründung: rAF läuft zwar weiter, aber macOS drosselt; „Ruhig" anzuzeigen,
  während nichts ausgewertet wird, ist irreführend.
- Screen Wake Lock hält den Bildschirm wach, solange der Tab aktiv ist (best-effort).

---

## 2026-06-28 – Spike: Ambientes Display-Signal (Mac), Branch `spike/ambient-glow`

Machbarkeits-Spike für ein ambientes Glühen als zusätzliches Interventions-Signal
neben Ring + Sound. Auf eigenem Branch im Hauptrepo (nicht im alten Spike-Sandkasten),
damit das Overlay später neben floating Ring + MediaPipe wachsen kann.

- **Zweites natives Fenster** statt In-Page-Overlay: ganzflächig, transparent,
  always-on-top, klick-durchlässig, über alle Spaces – per `WebviewWindowBuilder`
  in `setup()` erzeugt, unabhängig vom Inhalt des Hauptfensters (additiv integrierbar).
- **Capture-Ausschluss via objc2**: `setSharingType: NSWindowSharingNone (0)` direkt
  am NSWindow (wie schon `collectionBehavior` beim Pill-Spike). Tauri v2 hätte mit
  `set_content_protected` eine High-Level-Variante; bewusst der direkte objc-Weg
  gewählt – versionsunabhängig und exakt wie in der Aufgabe gefordert.
  Caveat: `sharingType` ist seit macOS 13 deprecated (funktioniert weiter); die
  reale Wirkung kann **nur auf macOS** verifiziert werden (→ Paul).
- **Zwei Stile, A/B (nicht gestapelt)**: Vignette (Glühen wächst von den Rändern)
  vs. Screen-Wash (flächige Tönung). Gesteuert durch ein 0–1-Signal + Max-Deckkraft.
- **Easing rein über CSS** (`@property --signal` + Transition, `@keyframes` Atmen):
  bewusst **ohne** `requestAnimationFrame`, weil macOS Hintergrund-Timer drosselt
  (Lehre aus dem rAF-Spike). Atemtempo folgt calm→warm→ember (4.6/2.6/1.6 s).
- **Default dezent** (Max-Deckkraft 18 %), `prefers-reduced-motion` schaltet
  Easing + Atmen ab. Keine System-Helligkeit/Gamma – die App rendert nur selbst.
- **.dmg** wird über GitHub Actions (`ambient-mac-build.yml`, `macos-14`,
  unsigniert/ad-hoc) gebaut – kein lokaler Mac, da Claude unter Linux läuft.
- Befund/Anleitung: `docs/ambient-glow-spike.md`. Status bleibt **Backlog** (nur Spike).
