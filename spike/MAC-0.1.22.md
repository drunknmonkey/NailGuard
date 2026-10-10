# 0.1.22 · Nie auf dem Bildschirm abbauen

## Befund aus dem 0.1.21-Lauf (10.10.2026, 09:14–09:18)

Das neue Hinweis-Log belegt pro Treffer genau ein `show`, ein `complete` und ein
`hide`; die CSV zählt 9 Treffer = 9 Darstellungen = 9 Tonstarts. Kein zweiter
Start, kein verfrühter Timer. Paul sieht trotzdem: normale Ausblendung, kurz
Ruhe, dann **noch einmal ein Ausblendeffekt**. Dieser zweite Effekt entsteht
also im Compositor – im Zeitfenster zwischen Fenster-Alpha 0 (T+506 ms) und
`orderOut` (T+588 ms) bzw. beim `orderOut` selbst. Weder Deckkraft 0 der
Schicht noch Alpha 0 des Fensters verhindern ihn: Der Compositor baut den
Backdrop-Layer offenbar mit einer eigenen Ausblendung aus dessen ungedämpfter
Ausgabe ab, sobald das Fenster vom Bildschirm genommen wird.

Zweiter Befund: Treffer 09:14:53 (rev 3) erreichte nie `held`; der rAF-Takt im
Overlay stand zwölf Sekunden still, der native Ausfall-Timer hat versteckt. Der
Hinweis blieb unsichtbar.

## Änderungen

- **Nie sichtbar abbauen.** Vor jedem Verstecken wird das Fenster um 20 000 px
  rechts unterhalb des Displays geparkt und erst dort `orderOut` gegeben. Was
  der Compositor beim Abbau des Backdrop-Layers zeichnet, zeichnet er außerhalb
  jedes Displays. `fit_hint_overlay_to_main` holt das Fenster vor dem nächsten
  Anzeigen zurück. Auch der Ausfall-Timer parkt.
- **Produktpfad `native`:** Beim Lösen bestätigt der Renderer nur noch; seine
  Schicht bleibt unverändert (Deckkraft 1, fester Filter). Der Window Server
  blendet das Fenster über `NSAnimationContext`/`animator` auf Alpha 0,02 aus –
  nicht 0, damit die Backdrop-Gruppe bis zum Parken erhalten bleibt. Danach
  Parken, Verstecken, `tawel:hint-reset` an den Renderer, der die Schicht
  unsichtbar auf Deckkraft 0 stellt. Vor dem nächsten Anzeigen setzt `ready`
  Alpha mit Dauer 0 zurück auf 1 (bricht einen laufenden Fade ab).
- **Renderer-Takt:** rAF bleibt die Uhr; feuert 120 ms lang kein Frame,
  übernimmt ein Timer den Schritt und meldet `renderer stall` ins Log. Das
  Overlay-WebView läuft mit `backgroundThrottling: disabled`
  (`WKPreferences.inactiveSchedulingPolicy = none`).
- **Testknöpfe:** A (Schicht blendet auf 0, Fenster bleibt), B (alt: nach
  600 ms auf dem Bildschirm versteckt, Kontrolle), neu C (Schicht blendet auf
  0,02, dann Parken + Verstecken ohne Fenster-Alpha). Vorschau, echte Treffer
  und „Test beenden" nutzen `native`.

## Was der nächste Lauf zeigt

| Beobachtung | Schluss |
|---|---|
| Vorschau/Treffer sauber, B flackert | Abbau auf dem Bildschirm war die Ursache; Parken genügt |
| Vorschau sauber, C flackert | Web-Fade bis Deckkraft 0,02 reicht nicht, erst der Fenster-Fade |
| A flackert weiterhin | Schon Deckkraft 0 der Schicht löst den Abbau aus – Produktpfad betrifft das nicht |
| Vorschau flackert weiterhin | Der Effekt entsteht vor dem Parken; dann Lavendel-Vignette (ohne Backdrop) als Gegenprobe |

## Verifikation

Rust-Policy prüft Produktpfad (Renderer `native`, Fenster-Fade, Parken,
Verzögerung = Ausblendzeit + 80 ms), A, B, C und veraltete Revisionen.
Overlay-Vertrag prüft: `native` lässt die Schicht unberührt und bestätigt
sofort, Reset neutralisiert nur die aktuelle Revision, Lösen während der
Einblendung friert sie ein, `floor` endet bei 0,02, der Timer-Fallback treibt
die Animation ohne rAF zu Ende und meldet den Stillstand genau einmal.
Chromium-Prüfung: fünf Varianten mit festem Filter, `native` ohne Änderung an
Filter oder Deckkraft. Die Darstellung auf macOS bleibt Hardwaretest;
Erkennung, Tonlogik und Web-App unverändert.

## Hardwaretest

1. Erkennung pausieren, gleiche Werte (Fokusverlust, Unschärfe 1,3, 500/500 ms).
2. Je dreimal: Vorschau, A, B, C. Zwei Sekunden nach dem Ausblenden beobachten.
3. Einmal Lavendel-Vignette wählen, Vorschau dreimal (Gegenprobe ohne Backdrop).
4. Erkennung starten, fünfmal Hand annähern, halten, wegnehmen.
5. `tawel-alpha-hints-<Stempel>.log` mitschicken und je Knopf sagen: zweiter
   Effekt ja/nein.
