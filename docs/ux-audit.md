# UX-Audit Landing + App — Befund (2026-07-02)

Fokus: intuitiv, einfach, premium. Zwei Ergebnisklassen:
**Klasse 1** (unstrittig, direkt umgesetzt): PR `landing/embed-states` +
PR `ux/wording-clarity`. **Klasse 2** (verschiebt/entfernt/sortiert um):
NUR Vorschläge, unten als Top-5 — Paul wählt aus.
Erkennungslogik und Layout unangetastet.

---

## Teil A – Landingpage-Verifikation nach Design-Audit

| Prüfpunkt | Befund |
|---|---|
| **Token-Erbschaft** | ✓ Landing verlinkt `/app/style.css` → Kontrast-Fix `--moss #567163` greift automatisch im gesamten Fließtext. Landing-CSS-Block ist vollständig tokenisiert (Spacing-/Typo-/Radius-Skala aktiv, keine Rohwerte). Letzte Ausreißer (Inline-`text-decoration` auf den Legal-Wortmarken) in CSS überführt. |
| **MailerLite-Zustände** | Umgesetzt per CSS im `.ml-embedded`-Scope: E-Mail-Feld als Paper-Pill mit **Ember-Fokusring** (statt Browser-Blau), Submit im `primary-action`-Stil mit hover/active/disabled, Fehlermeldung in `--ember-text`. Selektoren über Element-Typen (nicht ML-Klassen) → degradiert bei Embed-Updates auf ML-Default, bricht nie. **Harte Grenzen des Embeds:** reCAPTCHA-Badge, Success-Screen-Inhalte und der Lade-Spinner des Buttons sind von außen nicht stylbar. Geprüft gegen repräsentatives ML-Markup — die Sandbox erreicht `assets.mailerlite.com` nicht (Netzwerk-Policy), **Live-Gegenprobe → Paul** (E-Mail-Feld fokussieren: Ember-Ring? Falsche E-Mail: lesbare Meldung?). |
| **Hero-Ring** | ✓ Dasselbe geteilte Bauteil (`.stage/.halo/.ring`) wie die App, kein Nachbau. Die Tempo-Rampen (PR #15) betreffen ihn **bewusst nicht**: Die Landing hat keine Zustandsmaschine, der Ring atmet konstant ruhig (4.6s) über den CSS-Pfad — genau der dokumentierte Fallback. Kein Handlungsbedarf. |
| **Mobile ~390px** | ✓ Ring über der Headline, Sektionen einspaltig, Formular volle Breite, Abstände auf der Skala. Screenshot-geprüft. |

## Teil B – UX-Audit

### App

- **Hierarchie ✓**: Focus-View ist vorbildlich — Ring dominiert, ein
  Zustandswort, zwei Zahlen, zwei Aktionen. Nichts konkurriert.
- **Wege**: Kamera starten = 1 Klick (0 Entscheidungen davor) ✓. Pausieren =
  sichtbar, 1 Klick ✓. **Ton wählen = 2 Klicks + langer Scroll** an
  Kamera-Preview und Erkennungs-Karte vorbei → Top-5 #1.
- **Erste Nutzung ✓**: Permission → 4-Schritte-Einrichtung (übersprungbar)
  → Focus. Nur eine echte Entscheidung vor dem ersten Erfolg. (First-Run-
  Ladevisual bleibt Premium-Roadmap #3.)
- **Beschriftung** (Klasse 1, umgesetzt): „Sensitivität" ↔ „Empfindlichkeit"
  war inkonsistent (Auto-Tune-Hinweis nutzte bereits „Empfindlichkeit");
  „Cooldown" (Gamer-Anglizismus) → „Ruhepause"; das klinische
  „Intervention" widersprach der eigenen Markensprache („Sanfte Hinweise",
  start.step3 + Landing) → überall „Hinweis"/„nudge"; „Mini-Reset testen"
  (kryptisch — was passiert beim Klick?) → „Probe-Hinweis ansehen";
  „Kalibrierung neu starten" (Fachwort) → „Abstand neu einrichten".
- **Erwartung/Sackgassen ✓**: Fehlerpanel → „Erneut versuchen"; Einrichtung
  → „Überspringen"; leerer Review-Tag → ermutigender Text. Zwei weiche
  Erwartungsbrüche: Office-Mode-Einstieg (Top-5 #4) und das Hinweis-Panel
  ohne „einfach schließen" (nur 3 Feedback-Buttons — bewusst? Feedback
  füttert Auto-Tune; als Beobachtung notiert, kein Vorschlag).
- **Bewusst belassen**: Tab-Namen „Focus/Review" (englische Produktbegriffe
  in DE-UI — Markenentscheidung); Office-Tarnung komplett.

### Landing

- **Hierarchie ✓**: Versprechen + CTA + Ring above the fold; CTA 3× (Header,
  Hero, Warteliste) ohne Aufdringlichkeit.
- **Wege ✓**: E-Mail eintragen = 1 Anker-Klick oder 1 Scroll. Minimal.
- **Reihenfolge ✓**: Preis-Ehrlichkeit direkt VOR der Warteliste ist richtig
  platziert (Early-Bird-Argument zahlt aufs Formular ein).
- **Ausstiegsrisiko**: Problem + So-funktioniert's sind zwei reine Textblöcke
  hintereinander → Top-5 #3.
- **Offen (Entscheidung Paul)**: kein Weg zur Web-App von der Landing →
  Top-5 #5; `robots.txt` steht noch auf `Disallow: /` (Pre-Launch-Stealth) —
  für eine Warteliste kontraproduktiv, gehört vor den Launch geöffnet.

## Top-5 Klasse-2-Vorschläge

**→ UMSETZUNG (2026-07-02): Alle fünf von Paul freigegeben und umgesetzt** —
#1+#2 in PR `ux/settings-structure`, #4 in PR `ux/office-first-hint`,
#3+#5 in PR `landing/visual-and-path` (Details: docs/decisions.md).

1. **Einstellungen umsortieren: Alltag nach oben (M)**
   Problem: Häufigste Wege (Ton, Hinweise) liegen hinter Kamera-Preview +
   Erkennungs-Karte; die Kamera braucht man nach der Einrichtung selten.
   Vorschlag: Reihenfolge Hinweise → Erkennung → Kamera → Office → Daten;
   Kamera-Preview + Live-Chips in der Karte einklappbar („Details anzeigen").
   Effekt: Ton wählen ohne Scroll, ruhigere Seite, Premium-Gefühl „es zeigt
   mir nur, was ich brauche".
2. **Erkennung: Presets vorn, Slider hinter „Feinjustierung" (S/M)**
   Problem: Drei Slider + drei Presets konkurrieren; Erstnutzer kann die
   Slider-Werte (0.090?) nicht einordnen. Vorschlag: Presets als primäre
   Wahl, Slider eingeklappt („Feinjustierung"). Effekt: 3 klare Optionen
   statt 6 Reglern; Auto-Tune arbeitet ohnehin im Hintergrund.
3. **Landing: die zwei Textblöcke visuell brechen (M)**
   Problem: Problem + So-funktioniert's = längste textnur-Strecke der Seite,
   wahrscheinlichster Ausstiegspunkt. Vorschlag: ein einziges stilles
   Produkt-Visual (App im calm-Zustand / Glow am Bildschirmrand) neben oder
   zwischen den Blöcken. Effekt: Scannbarkeit + zeigt das Produkt, statt es
   nur zu beschreiben.
4. **Office Mode: einmaliger Ausstiegs-Hinweis (S)**
   Problem: Erster Klick auf „Office Mode" wirft einen ohne Erklärung in den
   Tarn-Editor; der Rückweg (Status-Punkt/Esc) ist absichtlich unsichtbar.
   Vorschlag: beim allerersten Wechsel eine dezente, selbstverschwindende
   Notiz „Zurück mit Esc" (localStorage-Flag). Effekt: Erwartungsbruch
   entschärft, Tarnung bleibt.
5. **Landing ↔ App: den Weg bewusst entscheiden (S)**
   Problem: Von tawel.app führt kein Link zur Web-App — Conversion-Fokus
   oder Versehen? Vorschlag: entweder dezenter Footer-Link („Web-Version
   ausprobieren") oder dokumentiert bewusst weglassen; im selben Zug
   `robots.txt` vor Launch öffnen. Effekt: klare Absicht statt Zufall.
