# 0.1.31 · Weicherer Ein- und Ausstieg der Unschärfe

## Anlass (Paul, 10.10.2026, 16:31)

Das Ein- und Ausblenden des Fokusverlusts soll noch etwas smoother wirken.

## Wie der Fokusverlust seit 0.1.30 abläuft

Ein Treffer löst den Hinweis einmal aus. Der native Takt (16 ms) fährt einen
Pegel 0 → 1 über die Einblendzeit, hält 1 s, und fährt ihn über die
Ausblendzeit zurück. Der Pegel steuert zwei Schichten: die Unschärfe
(Radius von 1 px bis zum Regler „Unschärfe") und einen hellen Schleier
(Deckkraft 0 → eingestellte Stärke). Beide bewegen sich gleichzeitig.

Zwei Stellen waren noch „kantig":

- Der Radius folgte dem Pegel mit Exponent 0,7 – am Anfang des Einblendens
  (und am Ende des Ausblendens) sprang die Unschärfe deshalb überproportional
  schnell an. Der Exponent stammte aus der Zeit vor dem 1-px-Restradius und
  ist seitdem überflüssig.
- Die Kurve (Sinus in-out) hat an den Enden zwar keine Geschwindigkeit, aber
  noch Beschleunigung – man spürt den Moment, in dem es losgeht.

## Änderungen

- **Radius linear zum Pegel** (`RADIUS_EXPONENT` 1,0 statt 0,7). Unschärfe
  und Schleier bewegen sich jetzt exakt im gleichen Rhythmus.
- **Quintische Smoothstep-Kurve** (6t⁵ − 15t⁴ + 10t³) statt Sinus: an beiden
  Enden weder Geschwindigkeit noch Beschleunigung – kein spürbarer Einsatz,
  kein spürbares Aufsetzen. Ein- und Ausblenden bleiben exakte Spiegelbilder.
- Sonst unverändert (Impulsverhalten, 1 s Halten, Tor vor dem Verstecken,
  Kameravorschau).

## Tipp für den Test

Die Regler bestimmen die Dauer: 800–1200 ms Ein- und Ausblenden und
Unschärfe 3–4 px wirken am ruhigsten. Bei 1,3 px Unschärfe trägt fast nur der
Schleier; wenn es dann „zu wenig" ist, Intensität „mittel" oder „deutlich".

## Tests

`hint_finish.rs` (Kurve ohne spürbaren Einsatz, symmetrisch; Radius linear),
`hint-overlay.test.js`, Browser-Check, `mac.test.js` grün.
