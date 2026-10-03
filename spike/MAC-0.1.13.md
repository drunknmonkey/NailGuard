# Mac-Alpha 0.1.13 · Kameravorschau und Erkennung entkoppeln

Paul meldet in 0.1.12 ruckelige Vorschau und nach Rückkehr zum Fokus ausbleibende Erkennung. Ohne zugeordnetes Hardwarelog ist die genaue Ursache offen. Der Code zeigt jedoch eine vermeidbare Engstelle: CIImage/JPEG/JSON laufen auf der seriellen Capture-/Vision-Queue, bevor Erkennungsergebnis und Hinweiszustand gemeldet werden. Preview- und Kameranamenabfragen warten synchron auf diese Queue.

0.1.13 rendert Vorschaubilder auf einer separaten Utility-Queue in Software, damit die Vorschau keine zusätzlichen GPU-Aufträge neben Vision erzeugt. Eine kleine threadsichere Mailbox erlaubt höchstens einen Auftrag; neue Vorschauarbeit fällt aus, solange dieser läuft. Capture/Vision wartet nicht auf den Encoder. Beim Verlassen oder Pausieren wird die Lease invalidiert; verspätete Ergebnisse der alten Vorschau werden verworfen. Status/Kameraname warten nicht mehr auf Capture/Vision. Vorschau: maximal 480 Pixel Breite und zehn Bilder/s, UI-Abfrage achtmal/s, höchstens ein Decode, identische Bilder werden nicht nochmals dekodiert. Kamera, Gate und Session werden bei Fokus-/Einstellungswechsel nicht angehalten oder neu gestartet.

Vier technische CSV-Spalten ergänzen letzte und maximale Inferenz-/Vorschauzeit in Millisekunden. Kein Kamerabild oder Landmark-Verlauf wird gespeichert. Snapshot, JPEG und seine Landmark-Punkte stammen weiterhin aus derselben nativen Auswertung.

Tests: Preview-Mailbox mit simuliertem langsamen Encoder, begrenztem Auftrag, Lease-Ablauf, verspätetem Ergebnis nach Seitenwechsel und Wiederanlauf; UI mit verspätetem Decode, maximal einer Bildverarbeitung und unveränderter Kamerasteuerung beim Fokuswechsel; bisherige Kamera-/Gate-/Overlay-/Layout-Verträge bleiben bestehen.

Hardwareabnahme offen: dieselbe externe Webcam 20 Sekunden mit Vorschau, danach Fokus und echte Hand-zum-Mund-Bewegung. CSV-Zähler und neue Zeitwerte vor/während/nach Vorschau vergleichen. Der Build korrigiert die gefundene Engstelle; er ist ohne diesen Test kein Beleg, dass Pauls konkret beobachteter Ausfall behoben ist.
