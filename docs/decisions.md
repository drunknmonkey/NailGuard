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

## 2026-07-01 – Repo-Struktur: Landing an / , Web-App an /app (tawel.app)

Ein Repo, ein Cloudflare-Pages-Deploy („nailguard") liefert künftig beides:
`tawel.app` (Landing) und `tawel.app/app` (Web-App). Pages serviert das Repo-Root
statisch (kein Build-Schritt), daher gilt Ordnerstruktur = URL-Struktur.

- **Web-App nach `app/` verschoben** (`git mv` – Historie bleibt): index.html,
  app.js, style.css, i18n.js, sw.js, manifest.webmanifest, vendor/, models/, icons/.
  → served unter `/app`. Alle App-Asset-Pfade sind relativ (`./…`), lösen daher
  unter `/app/` unverändert auf; auch Service-Worker-Scope (`./`) bleibt korrekt.
- **Landing an der Root** (`index.html`) + `datenschutz.html` / `impressum.html`.
- **Gemeinsames Design-System, EINE Quelle**: Die Landing verlinkt `/app/style.css`
  (absolut) – exakt dieselbe Datei wie die App. Tokens **und** das atmende
  Ring-Bauteil (`.stage/.halo/.ring`) werden geteilt, nicht nachgebaut. Warum die
  Datei in `app/` und nicht an der Root liegt: So bleibt die App self-contained und
  der **Tauri-Bundle unberührt** – ein Root-`style.css` hätte im App-`../`-Import
  die Bundle-Wurzel verlassen.
- **Tauri weiter lauffähig**: `spike/build-frontend.sh` kopiert jetzt aus `app/`
  (statt Root) nach `spike-dist/`; `tauri.conf.json` (frontendDist `../spike-dist`)
  und die Rust-Seite bleiben unverändert. CI-Icon-Quelle → `app/icons/icon-512.png`.
  Verifiziert: spike-dist wird korrekt zusammengesetzt (index.html + Pill-Assets +
  relative Pfade intakt).
- **Prototyp entfernt**: `desktop.html` + `landing.js` (custom `/api/waitlist`) sind
  durch die neue Landing + MailerLite ersetzt. Der App-Link „zur Warteliste" zeigt
  nun auf `/#warteliste`. SW-Precache entsprechend bereinigt (v5 → v6). Die
  Pages-Function `functions/api/waitlist.js` bleibt liegen (aktuell ungenutzt).
- **Warteliste = MailerLite** (Universal-Script im `<head>` jeder Seite,
  Embed-Form `CmB4SX` auf heller Karte). **Kein CSP-Meta auf den Landing-Seiten**,
  damit das Drittanbieter-Embed lädt; die App behält ihre strikte CSP.
- **Legal**: `/datenschutz` + `/impressum` sind bewusst schlichte Platzhalter
  („Inhalt folgt / wird rechtlich ergänzt") – keine erfundenen Rechtstexte.

---

## 2026-07-01 – Design-Audit: Token-System, Zustände, WCAG-Kontrast

Systematisierung von „Atem & Ruhe" (keine Neugestaltung), drei gestapelte PRs.
Vollständiger Befund: `docs/design-audit.md`.

- **Token-System im :root** ist ab jetzt die einzige Quelle für Farben, Typo-
  Stufen (`--text-*`/`--leading-*`), Abstände (`--space-1…8`, 4px-Grid), Radien,
  Schatten und Motion (`--dur-*`/`--ease-*`). Keine Streuwerte mehr im
  Stylesheet-Körper; Canvas/JS lesen Tokens über `getComputedStyle`.
- **Office Mode** bleibt bewusst markenfremd (Tarnung), bekommt aber eine eigene
  `--office-*`-Gruppe — Tarnfarben zentral statt gestreut.
- **Fokus-Ringe markenkonform Ember** (statt Pine/Browser-Default); auf dem
  Pine-Schleier Paper; im Office System-Ink. Disabled-/Active-Zustände ergänzt.
- **Kontrast-Fixes minimal-invasiv**: `--moss` #5E7C6C→#567163 (4.05→4.7:1),
  `--office-muted`/`--office-placeholder` nachgedunkelt. Grafik-Sanftheit
  (Breath-Balken, Still-Ring) bewusst unter 3:1 belassen — Designabsicht.

---

## 2026-07-02 – Ring-Tempo-Rampen über die Web Animations API

Premium-Roadmap Punkt 1 (docs/design-audit.md): `animation-duration` ist per
CSS nicht interpolierbar – der Ring sprang beim Zustandswechsel hart ins neue
Tempo (4.6s → 2.6s → 1.6s).

- **Entschieden: WAAPI führt den Atem** (`ringBreath` in app.js, `id:
  "ring-breath"`); Zustandswechsel gleiten über `playbackRate` in einer
  sinusförmigen 2s-Rampe ans Ziel. Die Atem-Phase bleibt erhalten (kein
  Reset auf Phase 0). Raten: calm 1 · warm 1.77 · ember 2.88 · paused 0 –
  paused atmet aus in den Stillstand statt einzufrieren, Fortsetzen atmet an.
- **CSS bleibt der Fallback**: `body.ring-waapi` schaltet nur dann die
  CSS-Animation ab, wenn WAAPI aktiv ist. Ohne `Element.animate` (sehr alte
  WebViews), ohne JS (Landing) oder bei „Bewegung reduzieren" läuft exakt
  der bisherige CSS-Pfad. Die erwogene rAF-getriebene Phasen-Alternative ist
  damit unnötig: WAAPI ist in WKWebView seit Safari 13.1 verlässlich, und
  der Fallback deckt den Rest ab.
- `prefers-reduced-motion` wird live respektiert (matchMedia-Listener:
  Rampen aus → CSS-reduced-Pfad, und zurück).
