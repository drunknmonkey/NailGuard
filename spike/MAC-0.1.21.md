# 0.1.21 · Strukturstabile Hinweisschicht

Pauls A/B-Lauf mit 0.1.20: A (Fenster bleibt nach dem Ausblenden offen) flackert
einmal nach, B (Fenster wird 600 ms später versteckt) flackert zweimal, das zweite
Mal kürzer. Die JS/Rust-Logik (Revisionen, Ausfall-Timer, Abschlussmeldung) wurde
Schritt für Schritt nachvollzogen und ist in sich konsistent; ein zweiter Start
oder ein verfrühter Timer erklärt das Nachflackern nicht.

## Hypothese

Beide beobachteten Momente fallen mit einer **strukturellen Änderung des
Backdrop-Layers** zusammen, während er noch auf dem Bildschirm ist:

1. Das erste Flackern (A und B) tritt auf, wenn der Filter am Ende exakt
   `blur(0px)` erreicht. Während der Animation ändert sich nur der Radius-Wert
   (gleiche Filterstruktur, kein Flackern); bei Null kann der Compositor den
   Filter als wirkungslos behandeln und den Render-Pfad wechseln. Da der
   Smoothstep-Ausklang schon deutlich vor der echten Null unsichtbar ist,
   wirkt der Sprung „kurz nach dem Verschwinden“ – bei längeren
   Ausblendzeiten entsprechend später.
2. Das zweite, kürzere Flackern (B) ist das Verstecken des Fensters, solange der
   Backdrop-Layer darin noch existiert. Im Produktpfad (sofortiges Verstecken)
   liegen beide Momente direkt hintereinander.

Unabhängig davon macht tao `show()` als `makeKeyAndOrderFront:`. Das Overlay
konnte dadurch Key-Window werden und dem Hauptfenster bei jedem Hinweis kurz den
Fokus nehmen. Das ist kein bewiesener Flackergrund, aber ein unnötiger
Nebeneffekt bei jedem Treffer.

Ein bestimmter WebKit-/macOS-Fehler ist damit noch nicht bewiesen; die Hypothese
ist aber überprüfbar, weil 0.1.21 beide Strukturänderungen aus dem sichtbaren
Zeitraum entfernt und die Testknöpfe genau diese Trennung behalten.

## Änderungen

- **Renderer**: Unschärfe und Entsättigung werden pro Hinweis einmal gesetzt
  (`--cue-blur-max`, `--cue-saturation-min`) und ändern sich danach nicht mehr.
  Animiert wird ausschließlich die Deckkraft der Schicht – weiterhin über die
  eine rAF-Uhr, ohne CSS-Transitionen oder Keyframes. Nach dem Ausblenden bleibt
  die Schicht bei Deckkraft 0 im DOM; es wird nichts entfernt.
- **Nativer Abschluss**: Nach der Abschlussmeldung setzt Rust zuerst
  `NSWindow.alphaValue = 0` und versteckt das Fenster erst 80 ms später. Fenster-
  Alpha wendet der Window Server auf das fertige Fensterbild an – was auch immer
  beim Abbau des Backdrop-Layers passiert, wird mit 0 multipliziert. Vor dem
  nächsten Anzeigen wird Alpha wieder auf 1 gesetzt (der Inhalt steht dann schon
  auf Deckkraft 0). Der Ausfall-Timer bleibt und setzt ebenfalls erst Alpha 0.
- **Fokus**: Das Hinweisfenster ist `focusable(false)`; `canBecomeKeyWindow`
  liefert NO. `show()` ordnet es nur noch nach vorn.
- **Protokoll**: Neben der CSV entsteht beim ersten Hinweis
  `~/Desktop/tawel-alpha-hints-<Stempel>.log` mit Millisekunden-Zeitstempel und
  Revision: `show`, `ready`, `renderer shown/held/release`, `clear`, `complete`
  (Modus, Alpha, geplantes Verstecken), `hide` bzw. `hide skipped` (Grund:
  complete/delayed/fallback). Damit sind Abschlussmeldungen und Hide-Aufrufe
  erstmals belegt statt vermutet. Keine Kameradaten, nur Skalare.

## Testknöpfe (Einstellungen → Animation, Kamera pausiert)

- **A · Fenster offen lassen**: Nach dem Ausblenden bleibt das Fenster offen,
  Schicht bei Deckkraft 0, Filter unverändert. Prüft allein das Ende der
  Animation. Erwartung: kein Flackern mehr.
- **B · Alt schließen (Kontrolle)**: Fenster wird wie bisher 0,6 s nach dem
  Ausblenden versteckt, ohne Alpha 0. Erwartung: wenn das Verstecken mit lebendem
  Backdrop-Layer die Ursache des zweiten Flackerns war, flackert B weiterhin genau
  einmal (beim Verstecken) – und der Produktpfad nicht.
- **Echte Treffer, Vorschau, „Test beenden“**: neuer Abschluss (Alpha 0, dann
  Verstecken).

## Verifikation

Rust-Policy prüft Produktpfad (Alpha-Tor + Settle), A, B und veraltete
Revisionen. Overlay-Vertrag prüft, dass die Filterstärke während der Freigabe
konstant bleibt, nur die Deckkraft monoton sinkt, kein Radius pro Frame mehr
gesetzt wird und der Renderer Zeitmarken meldet. Chromium-Prüfung bestätigt für
alle fünf Varianten einen unveränderten `backdrop-filter` bei Deckkraft → 0 ohne
konkurrierende Animationen. Die Darstellung auf macOS bleibt Hardwaretest;
Erkennung, Tonlogik und die Web-App unter `app/` sind unverändert.

## Hardwaretest

1. Erkennung pausieren. Gleiche Effekt-/Zeitwerte wie beim 0.1.20-Lauf behalten.
2. Normale Vorschau dreimal, A dreimal, B dreimal. Jeweils zwei Sekunden nach
   dem Ausblenden beobachten.
3. Dann Erkennung starten, fünfmal Hand annähern, halten, wegnehmen.
4. `tawel-alpha-hints-<Stempel>.log` vom Desktop mitschicken. Pro Hinweis sollten
   dort genau ein `complete` und – außer bei A – genau ein `hide` stehen; ein
   `hide reason=fallback` zeigt, dass der Renderer keine Null gemeldet hat.
