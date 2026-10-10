# 0.1.32 · Nativer Hinweis (Core Animation), umschaltbar

## Befund aus den 0.1.31-Läufen (10.10.2026, 17:05–17:14)

Alle Soll-Dauern werden eingehalten, kein Nachflackern, kein Ausfallpfad.
Trotzdem läuft der Hinweis nicht bei jedem Durchlauf gleich – und das Log
zeigt, wo: Bei Vorschau-Klicks vergehen vom Auslösen bis zum Animationsstart
2–5 ms, bei allen fünf **echten Treffern** 46–94 ms, jedes Mal anders; einmal
meldet sich der Renderer erst 60 ms nach dem Start. Der Weg jedes
Animationsschritts (Rust-Thread → Hauptschleife → WebView → JavaScript →
WebKit → Compositor) ist genau dann belastet, wenn ein Treffer kommt
(Erkennungsergebnis, Statuswechsel im Hauptfenster). Regler und Kurven
ändern daran nichts; die Auffälligkeit trifft den Fall, der zählt.

Paul: Mit mehr Unschärfe wirkt es besser („bei 1 zu wenig Bandbreite" – 1 px
ist der Boden, der Regler setzt das Maximum, der Weg ist die Differenz).
Entweder clean und immer gleich „wie von Apple" – oder etwas anderes.

## Änderungen

### Nativer Hinweis (`spike/native/NativeCue.swift`, `CueTimeline.swift`)

- Eigenes randloses, klickdurchlässiges, nicht aktivierendes Panel
  (Screen-Saver-Level, alle Spaces, Vollbild-Hilfsfenster, `sharingType =
  none` als Vorbereitung der geplanten Unsichtbarkeit in Aufnahmen – noch
  nicht geprüft). Fenster-Animationen von AppKit aus.
- **Ein Hinweis = eine Keyframe-Animation**: Werte [0, Spitze, Spitze, 0] mit
  Zeitmarken Einblenden / Halten (1 s) / Ausblenden, Ease-in-out auf beiden
  Flanken, linear beim Halten. Einmal übergeben, danach läuft sie auf dem
  Render-Server – unabhängig von App, WebView und Erkennung. Ein neuer
  Treffer während eines laufenden Hinweises setzt beim aktuellen Pegel an.
- Effekte als Core-Animation-Schichten mit denselben Farben und Alphas wie
  das Web-Overlay: Vignette und Ambient Glow als einmal gezeichnete
  Verläufe (Deckkraft animiert), Fokusverlust = Backdrop-Unschärfe (Radius
  0 → Regler) + Schleier, Entsättigung = Backdrop-Sättigung (1 → Minimum) +
  Schleier, Farbhauch → Fokus = Farbschicht + Unschärfe + Schleier.
- Backdrop-Unschärfe/-Sättigung über die QuartzCore-Schicht, die WebKit und
  Apples Milchglas-Flächen intern nutzen (`CABackdropLayer` + `CAFilter`,
  nicht öffentlich dokumentiert; für Direktvertrieb üblich, für den Mac App
  Store ein Ausschlusskriterium). Ist sie nicht verfügbar, bleiben die
  Schleier; das Log vermerkt `backdrop=false`.
- Reduce Motion: Flanken auf 150 ms, Halten bleibt.
- Stufen im Hinweis-Log: `show renderer=native …`, `native-cue show
  backdrop=…`, `committed total_ms`, `complete elapsed_ms`, `hidden`,
  `superseded`, `safety-net`.

### Umschalter

Einstellungen → Hinweis → **„Nativ zeichnen (Test)"**. Aus = bisheriges
WebView-Overlay (unverändert, 0.1.31). Stil, Stärke, Unschärfe, Ein-/Ausblendzeit
und das 1-s-Halten gelten für beide; Vorschau-Knopf und echte Treffer nutzen
den gewählten Renderer. Gespeichert in `tawel.alpha.hint-renderer.v1`.

## Tests

- `NativeCueTests.swift`: Zeitleiste (Zeitmarken, Fortsetzen vom aktuellen
  Pegel, Sättigungsrichtung, Reduce Motion, kaputte Eingaben), Rezepte
  (Stil-/Stärke-Clamping, Unschärfebereich). Dazu eine Typprüfung von
  `NativeCue.swift` in CI mit Fehler-Annotationen.
- `mac.test.js`: Umschalter standardmäßig aus, wird persistiert, erreicht den
  Host vor dem Stil, Umschalten spielt eine Vorschau.
- Bisherige Tests unverändert grün.

## Hardwaretest

1. Umschalter an, Fokusverlust bei Unschärfe 3–4, 1000/1000 ms: fünf
   Vorschau-Klicks, dann fünf echte Treffer. Erwartung: jeder Durchlauf
   identisch, weich, ohne Nachflackern. Log zeigt `backdrop=true` – sonst
   fehlt die Unschärfe und nur der Schleier ist zu sehen (bitte melden).
2. Dieselbe Runde mit Vignette und Ambient Glow.
3. Umschalter aus → alter Weg zum direkten Vergleich.
4. Falls beim Ein- oder Ausblenden des nativen Hinweises ein Blitz oder ein
   Sprung zu sehen ist: Zeitpunkt (Anfang/Ende) und Stil nennen.
