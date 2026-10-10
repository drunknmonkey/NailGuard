# 0.1.19 · Gleichmäßiges Ausblenden

Pauls 0.1.18-Lauf enthält sechs Treffer, sechs visuelle Starts und sechs
erfolgreiche Tonstarts. Kein zusätzlicher gezählter Start erklärt das gemeldete
Flackern. Die sekündliche CSV belegt keine einzelnen dargestellten Frames.

Der bisherige Renderer ließ Einblend-Keyframes (einschließlich verzögertem
Kombinations-Blur) während der Deckkraft-Ausblendung des Elternteils weiterlaufen.
Dies ist eine mögliche Verstärkung während des Ausblendens, kein abschließend
auf dem Mac reproduzierter Ursachenbeweis.

Ein einzelner Animationswert steuert jetzt den Filter direkt. Beim Lösen wird
die Einblendung abgebrochen; der Wert sinkt vom zuletzt gezeichneten Stand auf
null. Keine Eltern-Deckkraft, keine unabhängigen CSS-Keyframes. Im gehaltenen
Zustand laufen keine Animationsframes. Die native Kamera/Gate-Logik bleibt gleich.

Revisionsnummern schützen vor alten Ereignissen und Abschlussmeldungen. Vor dem
Öffnen bestätigt der Renderer einen neutralen Filter. Nach Erreichen von null
bestätigt er das Verstecken. Der native Timer bleibt als Ausfallsicherung.

Einstellungen → Animation → „Dauereffekt testen · 3 Sekunden“ funktioniert ohne
Kamera über denselben Renderer. Dazu Erkennung pausieren; der Test startet sie
nicht und löst keinen Ton aus. Ein echter Treffer darf eine Vorschau ersetzen.

Verifikation: deterministische Frames für alle fünf Varianten, vorzeitiges
Wegnehmen, langes Halten, neue Treffer während des Ausblendens, veraltete Befehle,
Vorschau und reduzierte Bewegung. Browserprüfung kontrolliert zusätzlich echte
berechnete Filterwerte. macOS-Bundle und tatsächlicher Desktop-Compositor werden
separat geprüft; Chromium allein beweist kein flackerfreies macOS-Verhalten.

Hardwaretest: erst pausiert dreimal den Dauereffekt-Test ausführen. Anschließend
fünfmal Hand annähern, halten und wegnehmen; einmal schon während der Einblendung
wegnehmen. Bei erneutem Flackern angeben, ob es auch ohne Kamera passiert und
welche Variante/Einblend-/Ausblenddauer gewählt war.
