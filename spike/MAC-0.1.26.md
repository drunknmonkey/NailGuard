# 0.1.26 · Die Dauer sichtbar machen

## Befund aus dem 0.1.25-Lauf (10.10.2026, 14:48–14:51)

Die Regler wirken mechanisch exakt: Einblenden 500 → 503 ms, 1500 → 1507 ms;
Ausblenden 150 → 159 ms, 500 → 503 ms, 1500 → 1500 ms. Paul sieht trotzdem nur
beim Unschärfe-Schieber einen Unterschied. Die Ursache ist Wahrnehmung, nicht
Technik.

Das Fenster-Alpha mischt das unscharfe Bild über das scharfe:
`Ergebnis = a · unscharf + (1 − a) · scharf`. Solange ein nennenswerter scharfer
Rest bleibt, liest das Auge „scharf mit leichtem Schleier"; erst wenn der Rest
unter etwa 15 % fällt, liest es „unscharf". Mit der bisherigen Sinus-Kurve ist
das erst ab 75 % der Laufzeit der Fall:

| Ausblenddauer | davon unsichtbar | sichtbarer Verlauf |
|---|---|---|
| 150 ms | 112 ms | 38 ms |
| 500 ms | 374 ms | 126 ms |
| 1500 ms | 1120 ms | 380 ms |

Der Regler verschiebt also vor allem den *Zeitpunkt*, zu dem der Hinweis
aufpoppt, kaum den Übergang selbst. Genau das beschreibt Paul.

## Änderungen

- **Alpha folgt der wahrgenommenen Stärke.** Die Atemkurve läuft jetzt in
  Wahrnehmungsraum; das Fenster-Alpha wird über `perceived ≈ alpha^gamma`
  zurückgerechnet (`alpha_for`). Der unsichtbare untere Bereich wird schnell
  durchlaufen, die ganze eingestellte Zeit liegt im sichtbaren Teil. Nach der
  halben Einblendzeit ist der Hinweis bereits deutlich da statt bei 50 % Mischung.
- **Gamma je Variante.** Fokusverlust und Farbhauch → Fokus hängen von der
  Unschärfe ab (`5,5 − 0,35 · px`, begrenzt auf 2–5,5), Entsättigung 2,0,
  Vignette und Ambient Glow 1,0 – ein reiner Farbschleier ist bereits linear.
  Die Zahlen sind ein Modell, kein Messwert; das Log schreibt das verwendete
  Gamma mit, damit ein Hardwarelauf sie korrigieren kann.
- **Kein Sprung auf null mehr.** Ein Treffer während des Ausatmens atmet vom
  aktuellen Alpha weiter ein, statt hart auf null zu springen und neu zu
  beginnen (im 0.1.25-Log mehrfach als `fade in start 0.541->0.000`).
- Ausatmen hält den starken Teil nun etwas länger (vorher ließ es früher los).
- Log: `show … gamma=…`, `fade … gamma=…`, `ready window=shown was_visible=…`.

## Verifikation

Rust: Kurven monoton und an beiden Enden weich, Endpunkte exakt, kompensierte
Kurve liegt zur Halbzeit über 0,8, reiner Farbschleier bleibt unverändert
linear. Overlay-Vertrag und Chromium-Prüfung wie in 0.1.25 – die Schicht selbst
bleibt statisch, die Bewegung macht weiterhin allein das Fenster.

## Hardwaretest

Fokusverlust, Unschärfe 1,3. Vorschau je dreimal mit Ausblenden 150, 500 und
1500 – der Unterschied muss jetzt im Übergang liegen, nicht nur in der
Verzögerung. Danach Einblenden 500 gegen 1500. Zum Schluss drei echte Treffer
und einmal zwei Treffer kurz hintereinander (kein harter Neustart mehr).
