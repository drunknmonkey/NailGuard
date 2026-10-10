# 0.1.18 · Hinweis nach bestätigter Handentfernung lösen

## Hardwarebefund 0.1.17

Pauls Log vom 09.10.2026, 15:15:27: Erkennung subjektiv recht gut, Bild und Ton passend. 2168 Analysen, keine Fehler/Neustarts. Analysegrößen korrekt: Standard 640 × 360, Detail 1280 × 720 bei 1920 × 1080 Quelle. Fünf visuelle Präsentationen und fünf erfolgreiche Tonstarts; zwei gezählte Episoden. CPU-Median 32,4 % eines Kerns, Thermik normal. Resize-Median 3,2 ms, p95 5,3 ms.

Der Effekt blieb nach Übergang zu „keine Hand“ jeweils etwa acht bis zehn Sekunden aktiv. Ursache: nil-Distanz wurde unabhängig von den neuen Diagnosegründen als mögliche Verdeckung behandelt und erst nach acht Sekunden ausgeblendet.

## Änderung

`ProximityGate.update` erhält die Information, ob Apple Vision noch eine Handbeobachtung liefert:

- Gesicht sichtbar, keine Handbeobachtung: nach 550 ms bestätigter Abwesenheit Hinweis aus und Episode beendet. Eine neue Annäherung benötigt wieder die vollständige Qualifikation/Haltezeit.
- Handbeobachtung vorhanden, aber keine ausreichend sicheren Fingerpunkte: weiterhin mögliche Verdeckung; sichtbarer Hinweis und Episode werden bis zu acht Sekunden überbrückt.
- Technischer/anderer unbekannter Messausfall: bestehende vorsichtige achtsekündige Behandlung.
- Ein neuer gültiger Abstand verwirft die Abwesenheitsfrist.

Damit liegt die erwartete Reaktion bei rund 0,55 Sekunden plus eingestellter Ausblendzeit. Die App kann eine vollständig vom Modell verlorene, tatsächlich noch am Mund liegende Hand nicht von einer entfernten Hand unterscheiden; in diesem Fall bevorzugt 0.1.18 das von Paul gewünschte schnelle Ende.

## Tests

Swift-Regressionen prüfen getrennt: sichere Handabwesenheit beendet Hinweis und Episode; sichtbare Hand mit verdeckten/unsicheren Punkten hält den Hinweis. Bestehende Wiederbestätigung, Hysterese, neue Episode, Bilddimensionen und Ausrichtung bleiben abgedeckt. Hardwaretest: fünf Annäherungen, jeweils Hand vollständig aus dem Bild; Ausblendzeit beobachten. Zusätzlich Finger im Mund halten und prüfen, ob Apple Vision wenigstens eine Handbeobachtung behält. CSV und subjektive Beobachtung zu spät/früh senden.
