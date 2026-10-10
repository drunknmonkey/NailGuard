# 0.1.25 · Atmen statt Schalten

Pauls Wunsch nach 0.1.24: Ein- und Ausblenden sollen sich natürlich und flüssig
anfühlen wie der Ring der Web-App; die Ausblendzeit schien keinen Effekt zu
haben. Zwei Ursachen im bisherigen Stand:

- Die Einblendung lief noch im WebView. Bei Treffer 2 beider Hardwareläufe
  lieferte WebKit nach dem Wiederanzeigen ~400 ms keine Frames; der Timer-
  Fallback hielt die Animation mit grobem Takt am Leben – sichtbar als Ruckeln.
- Die Ausblendung lief über AppKits `animator` mit dessen Standardkurve. Die
  eingestellte Dauer kam laut Log an, die Kurve ist bei kurzen Zeiten aber eher
  ein Schnitt als ein Ausatmen.

## Änderungen

- **Beide Richtungen nativ.** Der Renderer stellt die Schicht beim Anzeigen
  einmal fertig (fester Filter, volle Deckkraft) und animiert nie. Das Fenster
  kommt mit Alpha 0 nach vorn und atmet über das Fenster-Alpha ein; beim Lösen
  atmet es auf 0,02 aus, dann wird es versteckt. Kein rAF, kein Timer-Fallback,
  kein WebKit-Frame nötig – damit entfällt die Stall-Problematik.
- **Eigener Takt statt `animator`:** ~120 Schritte/s auf dem Main-Thread,
  Dauer exakt aus den Reglern (Einblenden/Ausblenden), bei „Bewegung
  reduzieren" höchstens 150 ms. Ein neuer Treffer während des Ausatmens löst den
  laufenden Fade ab und atmet vom aktuellen Alpha aus wieder ein.
- **Atemkurven:** Einatmen = Sinus-In-Out (weicher Start, weiche Ankunft);
  Ausatmen = dieselbe Kurve angehoben (löst früh, verweilt im Ausklang). Beide
  starten und enden mit Steigung null – nichts schnappt.
- **Log:** `fade in|out start a->b ms=… curve=…`, `fade … end alpha=… actual_ms=…`,
  `fade … superseded`. Damit lassen sich Soll- und Ist-Dauer der Regler direkt
  vergleichen.
- Vorschau: Haltezeit beginnt nach dem Einatmen (Einblendzeit + 1,2 s).
- Farbhauch → Fokusverlust: beide Schichten atmen gemeinsam ein (vorher
  gestaffelt); die Staffelung lässt sich bei Bedarf nativ nachbauen.

## Verifikation

Rust: Kurven monoton, 0→1, weich an beiden Enden, Ausatmen verweilt länger;
Dauern und Verzögerung. Overlay-Vertrag: Schicht steht vor `ready` auf voller
Deckkraft, kein `requestAnimationFrame` im Renderer, Lösen bestätigt sofort,
Vorschau hält Einblendzeit + Haltezeit, Reduced-Motion-Flag in beiden Richtungen,
veraltete Ereignisse, Reset. Chromium: fünf Varianten statisch mit festem Filter.
Die Bewegung selbst ist nur auf dem Mac sichtbar.

## Hardwaretest

Vorschau dreimal mit Einblenden 500/Ausblenden 500, dann einmal Ausblenden auf
1500 und einmal auf 150 – der Unterschied muss deutlich sein. Danach drei
Treffer. Log mitschicken: `actual_ms` soll den Reglern entsprechen (±20 ms).
0.1.24 und 0.1.25 lassen sich direkt vergleichen; der Abschluss ohne
Nachflackern bleibt in beiden gleich.
