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
