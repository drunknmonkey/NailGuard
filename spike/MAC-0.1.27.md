# 0.1.27 · Der Radius atmet, nicht das Alpha

## Befund aus dem 0.1.26-Lauf (10.10.2026, 15:05–15:07)

Die Alpha-Rampen liefen exakt (z. B. 1500 → 1505 ms, 150 → 154 ms), die
Wahrnehmungskorrektur war aktiv (`gamma=5.04`) – und Paul sieht weiterhin
keinen Unterschied zwischen den Dauern; nur der Unschärfe-Schieber wirkt.
Zusammen mit 0.1.25 lässt das nur einen Schluss zu: **Das Fenster-Alpha wirkt
auf den Backdrop-Filter nicht.** Der Compositor filtert den Hintergrund „in
place" und ignoriert dabei das Alpha des Fensters; gedämpft wird nur der
praktisch unsichtbare Farbschleier. Das erklärt rückwirkend auch:

- 0.1.21 (WebKit-Deckkraft der Schicht) war als Fade sichtbar – „die normale
  Animation kommt" –, der Fenster-Fade seit 0.1.22 wirkt nur als An/Aus.
- Der Abschluss seit 0.1.22 ist sauber, weil das Verstecken bei „Alpha 0,02"
  in Wahrheit ein hartes Abschalten ohne nachgespielte Ausblendung ist.
- Der einzige Regler mit Effekt ist der Radius, weil der Radius das Einzige
  ist, was der Compositor bei diesem Filter tatsächlich darstellt.

## Änderungen

- **Der native Takt sendet einen Pegel 0..1** (`tawel:hint-level`, ein Schritt
  pro Bild), der Renderer bildet ihn auf die **Filterstärke** ab: Radius bei
  Fokusverlust/Farbhauch, Sättigung bei Entsättigung, Deckkraft nur bei den
  reinen Farbschleiern (Vignette, Ambient Glow – ohne Backdrop). Backdrop-
  Schichten behalten Deckkraft 1; genau Deckkraft-Fades ließ der Compositor
  in A/B/C nachspielen.
- **Restradius 0,3 px statt null.** Der Filter wird nie strukturell entfernt
  (0.1.20 flackerte bei `blur(0)`), und beim Verstecken steht kein voller
  Filter mehr, den der Compositor nachspielen könnte – das war in A/B/C der
  Fall, weil Deckkraft-Fades den Filter selbst voll stehen lassen.
- Fenster-Alpha bleibt nur als Tor: 1 vor dem Anzeigen, 0,02 nach dem
  Ausatmen, dann 80 ms später `orderOut` – exakt der bestätigte Abschluss.
- Ein Treffer während des Ausatmens atmet vom aktuellen Pegel weiter ein.
- Wahrnehmungs-Gamma (0.1.26) entfällt; der Radius ist annähernd linear
  wahrnehmbar.
- Log: `fade in|out start a->b ms=…`, `fade … end level=… actual_ms=…`,
  `alpha 1.000 before show`, `alpha 0.020 gate before hide`.

## Risiko

Der Radius wird nun wieder pro Bild von WebKit gesetzt (wie 0.1.20, aber mit
Restradius und sauberem Tor). 0.1.20 flackerte nur am Ende; der Hardwaretest
muss zeigen, dass mit Restradius auch das Ende ruhig bleibt. Falls nicht, ist
der nächste Schritt ein höherer Restradius (0,5 px) beim Verstecken.

## Verifikation

Rust: Pegelkurven monoton, Restradius, Fortsetzung mitten im Ausatmen.
Overlay-Vertrag: Pegelstrom nur für die aktuelle Revision, Radius wächst
monoton bis zum eingestellten Wert und endet am Restwert, keine Deckkraft-
Variable für Backdrop-Schichten, Farbhauch zweistufig. Chromium: berechnete
`backdrop-filter`-Werte `blur(0.3px)` → `blur(6px)` → `blur(0.3px)` bei
Deckkraft 1; Entsättigung `saturate(1)` → `saturate(0.56)`; Schleier per
Deckkraft. Die Bewegung selbst bleibt Hardwaretest.

## Hardwaretest

Fokusverlust, Unschärfe 1,3 und einmal 7. Vorschau je dreimal mit Ausblenden
150 / 500 / 1500 und Einblenden 500 / 1500 – jetzt muss die Dauer sichtbar
sein. Dann drei echte Treffer und zwei Treffer kurz hintereinander. Vor allem:
**Flackert am Ende wieder etwas nach?** Log mitschicken.
