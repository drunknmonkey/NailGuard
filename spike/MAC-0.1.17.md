# 0.1.17 · Wiedererkennung, Status und echte Analyseauflösung

## Anlass

Pauls CSV vom 09.10.2026, 10:45:53, Build d058b5f / 0.1.16:
2168 abgeschlossene Analysen mit Gesicht, null Fehler/Neustarts,
sechs Hinweispräsentationen und drei Episoden. Mehrfach Wiedereinschalten
nach Ablauf der achtsekündigen Tracking-Frist. Alle sechs Tonstarts akzeptiert.
CPU-Median etwa 30 % eines Kerns, Thermik normal. Sowohl im Standard- als auch
Detailprofil tatsächlich 1920 × 1080 Pixel: Preset-Auswahl allein begrenzte
das Analysebild in diesem Hardwarelauf nicht.

## Verhalten

Nach längerem Tracking-Verlust bleibt ein ausgeblendeter Hinweis aus, bis
mindestens 650 ms ohne fehlenden/zu fernen Punkt Nähe <= radius bestätigt ist.
Ein einzelner Punkt im Hystereseband reicht nicht. Callback-Lücke >550 ms
unterbricht die Wiederbestätigung; bei >=8 s ohne Distanz wird die Sichtbarkeit
auch dann verworfen, wenn direkt ein gültiger Frame zurückkommt. Dieselbe
Episode zählt nicht erneut im Rückblick. Bestätigte Entfernung beendet sie;
eine neue Annäherung benötigt weiterhin 350 ms Qualifikation + 2 s Haltezeit.
Während Wiederbestätigung haben sichere Spitzen Vorrang vor DIP/IP; nur
aktive Hinweise dürfen die etablierte zusätzliche Gelenkstütze nutzen.
Die achtsekündige Überbrückung bei einem bereits sichtbaren Hinweis bleibt.

Keine Hand im Bild ist ein normaler Zustand, auch nach einer Episode.
Fehlender Mund/Gesicht, sichtbare Hand ohne nutzbare Punkte und technische
Analysefehler/Stillstand werden in Fokus und Menüleiste unterschieden.
Fokus erkennt Stillstand anhand des Alters abgeschlossener Analysen (>3 s).
Start, bewusste Pause und Snooze behalten ihre eigenen Zustände.

## Auflösung

Session-Preset bleibt ein Wunsch an die Kamera. Zusätzlich begrenzt ein
serieller Core-Image-Schritt das tatsächliche Vision-Eingangsbild auf maximal
640 × 480 bzw. 1280 × 720. Ohne Beschnitt oder Hochskalieren, Seitenverhältnis
bis auf ganzzahlige Pixelrundung erhalten. Full-HD ergibt 640 × 360 bzw.
1280 × 720. Die Oberfläche benennt ausdrücklich die Analyseauflösung.
Ein wiederverwendeter Pixelpuffer; Vision verarbeitet synchron. Die Vorschau
verwendet weiter den Originalframe mit normalisierten Landmark-Koordinaten.
Kameraquelle und Analysebild werden getrennt im CSV erfasst. Der Schritt
begrenzt Analysearbeit, nicht zwingend Kamera-Transport oder Systemverbrauch.

## Diagnose

14 weitere CSV-Spalten (insgesamt 89): Quellbreite/-höhe, Vorbereitungszeit,
letzter Grund und Gate-Phase, nutzbare Finger/Ersatzfinger, kumulative
Framezähler je Grund. Grund: 1 Mund fehlt, 2 keine Hand, 3 keine nutzbaren
Fingerpunkte, 4 außerhalb Radius, 5 Bestätigung/Haltezeit läuft, 6 aktiver
Hinweis, 7 Analysefehler. Phase: 0 keine Annäherung, 1 Qualifikation,
2 Haltezeit, 3 aktiv, 4 aktiv/verdeckte Hand, 5 Wiederbestätigung nötig.
Die Zähler zählen Analysen, keine Sekunden oder echten Fehlentscheidungen.
Handbewegungen als Vergleichswahrheit bleiben manuell zu melden.
CPU-/Audio-Messgrenzen aus 0.1.16 gelten weiter, keine Bildspeicherung.

## Tests und Hardwareabnahme

Regressionen für einzelne Wiedererkennungspunkte, Unterbrechung durch nil/
Hystereseband, echte Wiederbestätigung, Callback-Stillstand und neue Episode.
Native Bildprüfung mit synthetischem Full-HD-Farbbild: beide Zielgrößen,
Profilwechsel zurück und unveränderte Links-/Rechtsausrichtung. Rust trennt
fehlende Hände, Gesicht, unsichere Fingerpunkte und technischen Stillstand.
UI-Verträge prüfen Texte und Pause in allen laufenden Statuszuständen.

Paul: Kamera auswählen, jeweils kurz Standard/Detail prüfen (bei Full HD
640 × 360 / 1280 × 720). Danach fünf Annäherungen mindestens 4 s halten,
Hand vollständig aus dem Bild nehmen und mindestens 12 s warten. Kein
zweiter Hinweis allein durch einzelne flüchtige Punkte, kein Fehlerstatus
allein wegen fehlender Hand. Erneut bewusst annähern; Hinweis/Ton prüfen.
Zusätzlich Gesicht aus Bild, Handpunkte verdecken, Pause/Fortsetzen,
Kameravorschau→Fokus und Hintergrund testen. CSV senden. Echte Trefferquote,
Bildqualität und Kosten des Resize-Schritts bleiben Hardwarefragen.
