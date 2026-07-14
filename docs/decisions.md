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

---

## 2026-07-02 – UX-Audit Top-5 umgesetzt (drei PRs)

Alle fünf Klasse-2-Vorschläge aus docs/ux-audit.md von Paul freigegeben und
umgesetzt. Stapel: basiert auf PR #17/#18 (Merge-Reihenfolge beachten).

- **Top-5 #1+#2 (Settings-Struktur):** Karten-Reihenfolge jetzt Alltag zuerst
  (Hinweise → Erkennung → Kamera → Privatsphäre → Office → Daten). Kamera-
  Vorschau + Live-Signale sowie die drei Erkennungs-Slider ruhen hinter
  nativen `<details>`-Zeilen („Vorschau & Live-Signale" / „Feinjustierung") –
  Progressive Disclosure ohne JS, Presets sind die primäre Wahl. Erkennung
  läuft bei eingeklappter Vorschau unverändert (Video-Element bleibt aktiv;
  Overlay-Canvas skaliert bei 0×0 einfach leer).
- **Top-5 #4 (Office-Erstnutzung):** Beim allerersten Wechsel in den Office
  Mode erscheint einmalig die dezente Notiz „Zurück mit Esc …" über das
  bestehende neutral-intervention-Element (localStorage-Flag
  `nail-guard.office-hint.v1`); Tarnung bleibt, Erwartungsbruch entschärft.
- **Top-5 #3 (Landing-Visual):** „So funktioniert's" wird zweispaltig mit
  einem stillen CSS-Produkt-Visual (stilisierter Bildschirm + atmendes
  Ember-Glühen am Rand) – zeigt das Kernversprechen statt es nur zu
  beschreiben. Reine Token-CSS, kein Bild-Asset, reduced-motion respektiert.
- **Top-5 #5 (Weg + Auffindbarkeit):** Entschieden: dezenter Footer-Link
  „Web-Version ausprobieren" → /app auf der Landing. `robots.txt` geöffnet:
  Landing indexierbar, `/app/` bleibt ausgenommen (Werkzeug, kein Content).

---

## 2026-07-03 – Treffer-Abfrage vollständig entfernt

Umsetzung der Notion-Entscheidung vom 2026-06-28 ("Treffer-Abfrage im
Fokusmodus überarbeiten"): die Nachfrage "war das wirklich ein Treffer?"
(Treffer/Gesicht berührt/Fehlalarm) sollte komplett weg, nicht ersetzt werden.

- **Bestandsaufnahme:** Es ist EINE gemeinsame Komponente (`#alertPanel` +
  `triggerIntervention()`/`showBrowserIntervention()`), keine drei getrennten
  Implementierungen. Sie erscheint an drei Stellen, weil die Erkennung
  tab-unabhängig weiterläuft (`evaluateProximity()` prüft nicht `activeMode`)
  – ein Treffer während Focus, Review oder Einstellungen aktiv ist, zeigt
  denselben fixen Vollbild-Overlay. Der "Probe-Hinweis ansehen"-Button in
  den Einstellungen nutzt denselben Pfad (`countStats:false`).
- **Entfernt:** die drei Buttons (`.alert-actions`) inkl. i18n-Keys
  (`alert.hit/face/false`) und die Frage "Was war das gerade?" aus
  `alert.body`. `role="dialog"/aria-modal` → `role="status"/aria-live`, da
  nichts mehr auf Eingabe wartet.
- **Tracking bleibt lückenlos:** `resolveInterventionSilently()` (vormals
  `resolveIntervention(kind)`) zählt jeden Trigger automatisch als Treffer
  (`stats.confirmed`, `lastConfirmedAt`) – dieselben Daten, die Review-Zähler
  und die "Ruhige Zeit"-Uhr im Fokusmodus speisen. Ausgelöst per Timer
  (4.6s) statt per Klick; kein toter Zustand möglich, das Panel schließt
  sich garantiert selbst (vorher konnte ein ignoriertes Panel unbegrenzt
  offen bleiben – das ist mit behoben).
- **Bewusst NICHT mehr aufgerufen: `autoTuneFromFeedback()`.** Die
  Feinjustierung beruhte auf dem Gegensignal "Fehlalarm" (macht strenger),
  ausbalanciert gegen "Treffer" (macht empfindlicher). Ohne Abfrage gäbe es
  nur noch das "Treffer"-Signal – bei jedem Trigger automatisch gefüttert,
  würde die Empfindlichkeit ungebremst zum Maximum (holdSeconds → 0.5s,
  distanceThreshold → 0.14) driften. Die Funktion bleibt im Code (für eine
  spätere, andere Rückmeldequelle), wird aber aktuell nirgends mehr
  aufgerufen. **Offene Folgefrage (nicht Teil dieses Fixes):** Der
  „Automatisch anpassen"-Schalter in den Einstellungen hat dadurch aktuell
  keine Wirkung mehr – ob er entfernt, umbeschriftet oder durch eine neue
  stille Rückmeldequelle ersetzt wird, ist eine eigene Produktentscheidung.
- Office Mode (`showNeutralIntervention`) war schon vorher still (nie eine
  Abfrage) und bleibt unverändert.

---

## 2026-07-03 – Nachjustierung: Vollbild-Fläche durch kleine Notiz ersetzt

Direktes Live-Feedback von Paul nach dem obigen Fix: die grüne
Vollbild-Fläche ("Kurz innehalten") blieb in Focus/Review/Settings
bestehen (nur ohne Buttons), während Office Mode schon immer nur eine
kleine, dezente Notiz zeigte — spürbare Inkonsistenz, und ein
Vollbild-Overlay widerspricht dem eigenen Markenversprechen
("kein Vollbild-Schreck", siehe Landing-Copy).

- **Entschieden (auf Nachfrage bestätigt): dieselbe Behandlung wie Office
  Mode überall.** `.alert-panel` (voller Bildschirm, Pine-Hintergrund,
  `position:fixed; inset:0`) → `.calm-toast`: kleine Karte oben mittig
  (320px, `--paper`-Hintergrund, Pine/Moss-Text), exakt dieselbe Geometrie
  wie `.neutral-intervention`, nur im Marken-Look statt im Tarn-Look.
  Ring, Statistiken und Bedienelemente bleiben während der Anzeige
  sichtbar und nutzbar.
- Anzeigedauer 4,6s → 3200ms, angeglichen an die Office-Standarddauer
  (`neutralSubtleInterventions` ist standardmäßig aktiv).
- Markup vereinfacht (`<h2>` → `<strong>`, kein `role="status"` mehr nötig,
  nur noch `aria-live="polite"` wie bei der Office-Notiz).
- Verifiziert (Playwright): Toast-Box 320×62px statt Vollbild, in Focus
  UND Review identisch, Tracking (`stats.confirmed`, `lastConfirmedAt`)
  weiterhin lückenlos.

---

## 2026-07-14 – Landingpage-Politur Runde 2 + Fonts self-hosted

Sieben visuelle Fixes nach Pauls Feedback plus Schrift-Testseite,
Leitprinzip Einfachheit (bei jedem Fix gefragt: kann etwas WEG?).
Branch `landing/polish-runde-2`.

- **Hero-Ring:** stand im blassen Ruhezustand (`--breath`) und war fast
  unsichtbar. Zeigt jetzt das Produktversprechen: Ember-Ton, Halo
  26% → 42%, Außenring 2px, Innenring-Opacity 0.55 → 0.7. Atmung
  bewusst im Ruhe-Tempo (4,6s) belassen – präsent, nicht grell.
  Gleiche `.stage/.halo/.ring`-Struktur wie in der App.
- **Hero-CTA (Root-Cause):** Dem Anker fehlte die Klasse mit der
  Button-Geometrie – die base-`button`-Regel greift nur für `<button>`,
  `.primary-action` liefert nur Farben. Daher wirkte der Link wie ein
  kaputter Fokus-Kasten. Utility umbenannt `.waitlist-jump` →
  `.pill-link` (trägt jetzt drei Links) und am Hero-CTA ergänzt.
- **Sekundärer CTA:** „Web-Version ausprobieren" → /app als neue
  `.ghost-action` (ruhige Outline, transparent) neben dem Pine-Pill.
  „Bald verfügbar für macOS" als eigene Zeile unter die Button-Reihe.
- **Preis-Sektion: radikal vereinfacht.** Die zentrierte Karte brach als
  einzige die linke Sektions-Achse. Karte weg, `.price-card`-CSS
  ersatzlos raus – Eyebrow/H2/Subtext wie jede andere Sektion.
- **MailerLite:** Embed-Kopfzeile per CSS ausgeblendet (Paul entfernt
  sie zusätzlich in ML), Wrapper-Fläche/Zentrierung neutralisiert
  (eine Achse mit der Karten-Überschrift), Checkbox `accent-color:
  pine`, Labels in Moss/Body-Schrift, reCAPTCHA falls aktiv auf 85%
  skaliert. Selektoren als `[class*=…]`-Attribute, gleiche
  Robustheits-Linie wie die bestehenden Overrides. **Nicht lokal
  verifizierbar** (assets.mailerlite.com in der Sandbox blockiert) –
  Sichtprüfung auf pages.dev nötig.
- **„So funktioniert's"-Visual:** Skeleton-Zeilen ersatzlos entfernt.
  Jetzt ein stilisierter Bildschirm (Bezel via `--frame-dark`,
  angedeutete Menüleiste) mit Ember-Saum, der als inset-Schatten vom
  Rand hereinatmet – zeigt exakt das Versprechen aus dem Text daneben.
  Gleiche Motion-Tokens, reduced-motion respektiert.
- **Fonts self-hosted (global):** Alle vier Seiten luden von
  fonts.googleapis.com (IP-Übermittlung an Google, Abmahnrisiko DE).
  Latin-Subsets als woff2 unter `app/fonts/`, `@font-face` in
  style.css, Preloads statt CDN-Links, App-CSP auf `'self'`
  verschärft, Fonts im SW-Precache (v7), Google-Runtime-Caching aus
  sw.js entfernt. Kursives Fraunces wird weiterhin vom Browser
  synthetisiert (wie zuvor: die CDN-Einbindung lud auch keine Italics).
- **Schrift-Testseite `/schrift-test`:** Hero dreimal gestapelt –
  A Status quo, B Sora-Headline, C Instrument Sans durchgängig
  (Kandidaten-Wahl aus den „z.B."-Vorgaben). Testfonts liegen lokal,
  laden aber nur dort. Nicht verlinkt, noindex. Stolperstein
  dokumentiert: `--font-body` am Wrapper zu überschreiben reicht nicht,
  weil Fließtext den an `<body>` berechneten Wert erbt – `font-family`
  muss am Wrapper direkt gesetzt werden. Paul entscheidet nach Ansicht;
  global wird nichts umgestellt.

Verifiziert (Playwright, lokal): Landing + Testseite bei 390px und
1280px, App-Startscreen und Datenschutz-Seite ohne Konsolenfehler,
`document.fonts.check` bestätigt lokale Ladung aller Schnitte; einziger
externer Request bleibt MailerLite auf der Landing.

---

## 2026-07-14 – Nachjustierung nach Pauls Sichtung: Schrift, Ring, Footer

Folge-Änderungen auf demselben Branch/PR (#25).

- **Schrift-Entscheidung: Variante C – Instrument Sans durchgängig.**
  Global über die Font-Tokens (Landing + App teilen weiter EIN
  Design-System); `--font-display`/`--font-body` bleiben als getrennte
  Tokens erhalten (Rollen lesbar, Display-Wechsel bliebe eine Zeile).
  Konsequenz für die Hierarchie: Ohne Serifen-Kontrast trägt das
  GEWICHT die Auszeichnung – alle Headlines (h2, Hero, State-Word,
  Wordmark, Legal-h1, Toast) von 400/500 auf 600, große Grade mit
  leicht negativem letter-spacing; Tagline 500. Die Größenstufen
  (--text-*) blieben unverändert: Instrument Sans hat eine größere
  x-Höhe als Fraunces, wirkt bei gleicher Stufe also eher größer.
  **Hero-Akzent „Ruhig": Farbe (Moss) + Gewicht 500 statt Kursive** –
  es liegt kein echter Italic-Schnitt vor, und ein synthetischer
  Browser-Schrägsatz sähe nachlässig aus. Fraunces/Atkinson/Sora aus
  dem Repo entfernt (Font-Budget: nur noch Instrument Sans + Mono,
  ~66 KB), /schrift-test gelöscht. App-Screens (Focus/Review/Settings,
  echt gestartet mit Fake-Kamera) gegengeprüft – Hierarchie trägt.
- **Grundsatz Ring-Farbe: Der Ring auf der Landing zeigt den
  RUHEZUSTAND (grün). Ember bleibt der Warnfarbe vorbehalten.** Der
  Ember-Hero-Ring aus der Politur-Runde zeigte Tawel im Alarm statt im
  Normalbetrieb („calm over alarm" verletzt). Korrektur: grüne Palette,
  aber Präsenz über Sättigung/Stärke statt Farbwechsel – Breath
  Richtung Pine vertieft (color-mix 45/55), 2px-Linie, 45%-Halo,
  Ruhe-Atmung. Kein Ember-Akzent im Ring: das warme Glühen gehört ins
  „So funktioniert's"-Visual, wo der Text es erklärt.
- **Fußzeile zentriert** (Pauls Wunsch). Im Gesamtbild geprüft: liest
  sich als Kolophon unter der Trennlinie – der einzige bewusste
  Ausbruch aus der linken Achse, stört nicht.
- **MailerLite-Restprüfung:** Paul hat Formulartitel + reCAPTCHA in
  MailerLite entfernt. Das CSS ist darauf ausgelegt (display:none auf
  die Kopfzeile wird zum No-Op, der reCAPTCHA-Selektor greift ins
  Leere, keine Abstände hängen an den entfernten Blöcken – Margins
  liegen auf Input/Button selbst). Das Embed lädt in der Sandbox
  weiterhin nicht (assets.mailerlite.com blockiert), am echten Markup
  verifizieren war also NICHT möglich. Auf pages.dev zu sichten:
  Input-Pill mit Ember-Fokusring, Pine-Button (hover/active), Checkbox
  pine + lesbares Label in Moss, linke Achse mit der Karten-Überschrift,
  kein Leerraum wo Titel/reCAPTCHA saßen, Fehler-/Erfolgszustand.
