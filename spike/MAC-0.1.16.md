# 0.1.16 · Bilddetails, verdeckte Spitzen und messbare Hinweise

## Anlass und Logbeleg (9. Oktober 2026)

Paul meldet weiterhin verpasste Annäherungen und Hinweise ohne bzw. mit verspätetem Ton.
CSV `tawel-alpha-log-20261009-091837.csv`, Build 0.1.15 / fe89c8fe:
1358 Messzeilen, aktive Analyse etwa 23 Minuten, 15215 abgeschlossene Analysen,
0 Fehler/Neustarts. Kameraquelle 1 = intern. Stichproben der letzten Inferenz:
Median 65 ms, p95 104 ms; interne maximale Laufzeit 538 ms.
15 sichtbare Wiedereinschaltungen, aber 6 neue Ereignisse. Bisher spielte nur
jedes neue Ereignis einen Ton; eine Wiedererkennung derselben Episode nicht.
Das erklärt einen möglichen Teil der fehlenden Töne, beweist keine Audioausgabe.
Handpräsenz im Log ist keine Trefferquote: Es fehlt eine manuell markierte Wahrheit.

## Änderungen

- Einstellungen → Leistung: 480p / 720p und Ersatzpunkte separat wählbar.
  Initial 720p + Ersatzpunkte; bestehende gewählte Kamera bleibt erhalten.
  Auflösungswechsel startet diese Kamera kurz neu (5 s Aufwärmzeit).
  Bei fehlender Unterstützung VGA, dann Medium; tatsächliche Größe wird angezeigt.
- Ein sicher erkannter Tip bleibt maßgeblich. Nur bei fehlendem Tip darf der DIP
  (Daumen IP) als Ersatz dienen. Aktive Episoden behalten ihre bisherige Tip/DIP-Logik.
  Confidence bleibt 0,3. Kein ROI, keine pauschale Absenkung auf 0,15 und keine
  weitere Radiusänderung: Diese Faktoren würden Fehlhinweise schwer zuordnen lassen.
- Zeitliche Stabilisierung aus 0.1.15 bleibt erhalten.
- Ton beim erneuten Einschalten eines erkannten visuellen Hinweises, auch bei
  derselben Episode; mindestens 3 s zwischen Tönen, kein Wiederholen während Halten.
  Rückblick zählt weiterhin nur neue Episoden. Deaktivierter Ton bleibt aus.
- Wellenformen werden abseits der Kamera-Queue vorbereitet und zwischengespeichert.
  Pause, Stopp und Stummschalten verwerfen ausstehende Wiedergaben.

## Messwerte und Grenzen

CSV ergänzt 16 Spalten: CPU-Prozent, Peak-RSS in MiB, Thermik (0 normal bis 3 kritisch),
Profil (Bit 0 HD, Bit 1 Ersatzpunkte), tatsächliche Breite/Höhe, Face-/Hand-Zeit,
Ton-Anfragen/Starts/Fehlschläge, letzte Ton-Startlatenz, visuelle Präsentationen/
Dispatch-Latenz, Ton aktiviert/Lautstärke. Zähler kumulativ pro Prozess.
CPU ist Delta von getrusage über verstrichene Zeit; 100 % = ein CPU-Kern.
Das umfasst nur den Tawel-Hauptprozess, nicht WebKit-Helfer, GPU, ANE oder Energie.
Thermik beschreibt den ganzen Mac. Peak-RSS ist ein bisheriger Höchstwert,
kein aktueller Speicherverbrauch. Messwerte laufen auch bei pausierter Kamera.
Ton-Start bedeutet NSSound.play akzeptiert, nicht physisch hörbar; Fehlschläge
enthalten abgebrochene veraltete Requests. Tonlatenz misst Request bis Play-Aufruf,
visuelle Latenz Request bis Fenster-/Event-Dispatch, nicht den sichtbaren Monitorframe.
Kein Video und keine Landmark-Koordinaten werden im CSV gespeichert.

## Hardwarevergleich

Gleiche Kamera (Webcam ausdrücklich auswählen), gleiches Licht, gleicher Abstand,
Empfindlichkeit und Ton. Kamera-Vorschau beim Lastvergleich ausschalten.
Jeweils 2 Minuten: (A) 480p/Ersatz aus, (B) 720p/Ersatz aus,
(C) 720p/Ersatz an. Pro Lauf fünf Annäherungen mindestens 4 s halten,
Hand vollständig entfernen, außerdem Tip verdecken und seitlich annähern.
Treffer und Fehlhinweise selbst zählen, CPU/Analysen pro Sekunde beobachten.
Ton einschalten und Probe hören. Danach Hand lange halten, kurz Tracking verlieren,
wiedererkennen lassen; Ton beim erneuten Hinweis prüfen. CSV und Beobachtungen senden.
Zusätzlich Auflösungswechsel aktiv/pausiert, Pause/Fortsetzen, Hintergrund,
Display-Sleep und abgezogene Webcam prüfen. 720p hat dreimal so viele Pixel,
aber der tatsächliche Lastanstieg und Erkennungsgewinn bleiben Hardwarefragen.

## Validierung

JS-Vertragstests prüfen Einstellungen und asynchrone Profilbestätigung;
Swift-Tests prüfen Tip-Priorität/Ersatz und Ton bei Wiedererkennung/Cooldown/Stumm.
Der macOS-Workflow baut die reale Swift/Rust-App und prüft das UI-Layout.
Native Wiedergabe, zusätzliche CPU-Last und Erkennungsqualität benötigen Hardwareabnahme.
