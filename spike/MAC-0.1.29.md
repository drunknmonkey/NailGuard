# 0.1.29 · Fokusverlust atmet über einen Schleier

## Befund aus dem 0.1.28-Lauf (10.10.2026, 15:35–15:38)

Kein Nachflackern. Vignette, Ambient Glow, Entsättigung und Farbhauch wirken
als ein Effekt, der kommt und geht. Nur der sanfte Fokusverlust wirkt wie zwei
getrennte Effekte, dazwischen fast klar, mit leichtem Schimmern.

Unterschied im Code: Die vier guten Varianten animieren kontinuierliche
Größen (Deckkraft eines Farbschleiers, Sättigung). Der Fokusverlust animierte
allein den Unschärferadius – bei Pauls Einstellung von 0,3 px bis 1,3 px, also
fast ganz im Sub-Pixel-Bereich. Dort rechnet der Compositor den Weichzeichner
in diskreten Kernel-Stufen (Text schimmert beim Verändern), und der gehaltene
Zustand bei 1,3 px ist so dezent, dass er nach dem Schimmern wie „klar" wirkt.

## Änderungen

- **Eigene Schleierschicht ohne Backdrop** für den Fokusverlust
  (`.hint-focus-veil`), die per Deckkraft mit dem Pegel atmet – stufenlos wie
  Vignette und Glow. Sie trägt die Bewegung und macht den gehaltenen Zustand
  sichtbar. Die Backdrop-Schicht behält Deckkraft 1 (kein Nachspielen).
- Schleierstärke je Intensität 0,06 / 0,09 / 0,13 (vorher 0,012–0,028,
  praktisch unsichtbar).
- **Restradius 1 px** statt 0,3 px: unterhalb schimmert der Weichzeichner nur.
  Die Unschärfe läuft weiter mit Exponent 0,7 vom Restwert bis zum Regler.
- Alles Übrige (Pegelstrom, Spiegelkurve, Tor vor dem Verstecken) unverändert.

## Hardwaretest

Fokusverlust bei Unschärfe 1,3 und einmal 3–4 (Vorschau 500/500 und
1500/1500): Der Hinweis soll jetzt wie die anderen Varianten als ein Atemzug
kommen und gehen, der gehaltene Zustand sichtbar sein, kein Schimmern. Falls
der Schleier zu hell wirkt: Intensität „leicht" probieren – oder sagen, dann
senke ich die Werte.
