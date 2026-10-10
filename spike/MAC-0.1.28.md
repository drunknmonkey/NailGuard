# 0.1.28 · Spiegelbildlich atmen

## Befund aus dem 0.1.27-Lauf (10.10.2026, 15:20–15:22)

Kein Nachflackern mehr – der Radius-Pfad mit Restwert hält. Dauern treffen
(150 → 152 ms, 1500 → 1501 ms, 2800 → 2803 ms). Paul: Ein- und Ausblenden
wirken wie zwei verschiedene Effekte. Zwei Gründe im Code:

1. Die Kurven waren nicht spiegelbildlich: Einatmen Sinus, Ausatmen
   `Sinus^1.15` (hält länger im starken Bereich).
2. Pegel → Radius war linear. Radien unter etwa einem Pixel liegen unter der
   Sehschärfe; beim Einatmen wirkt der Anfang daher leer und das Ende schnell,
   beim Ausatmen umgekehrt lang und dann plötzlich weg.

## Änderungen

- Eine Kurve für beide Richtungen (Sinus-In-Out); das Ausatmen ist das exakte
  Spiegelbild des Einatmens.
- Pegel → Radius mit Exponent 0,7 (in Renderer und Policy gleich): der
  Sub-Pixel-Bereich wird in beiden Richtungen schnell durchlaufen, die
  eingestellte Zeit liegt im sichtbaren Teil. Restradius 0,3 px und Tor vor dem
  Verstecken unverändert.

## Hardwaretest

Fokusverlust 1,3: Vorschau mit Ein-/Ausblenden 500/500 und 1500/1500 – beide
Richtungen sollen sich wie derselbe Atemzug vorwärts und rückwärts anfühlen.
Dann drei Treffer. Log mitschicken.
