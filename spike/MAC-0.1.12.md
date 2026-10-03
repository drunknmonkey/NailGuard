# Mac-Alpha 0.1.12

Fokus zeigt den größeren, mehrschichtigen Atemring und die Sessionsteuerung. Kamera und Hinweiswahl liegen ausschließlich in den Einstellungen. Drei Einstellungsseiten trennen Erkennungsabstand, Bild & Ton und Kamera. Rückblick und Ton bleiben erhalten.

Die freiwillige Kameravorschau nutzt ausschließlich den bereits gewählten nativen AVFoundation-Stream. Bild, Mundkontur, Handgelenke und Verbindungslinien stammen aus demselben Vision-Durchlauf. Koordinaten und Bild werden gemeinsam gespiegelt. Verdeckte Punkte unter der Konfidenzgrenze werden nicht erfunden oder durch Linien überbrückt. Die Verbindungen zum Mund zeigen die aktuell verwendeten Spitzen bzw. bei einer Episode die benachbarten Gelenke.

Es wird nur ein aktuelles JPEG im Arbeitsspeicher gehalten, auf 640 Pixel Breite und maximal 5 Bilder/s begrenzt. Sichtbare Kameraeinstellungen erneuern eine einsekündige Lease. Verstecken, Minimieren, Seitenwechsel, Pause und Kamerawechsel stoppen die Vorschau; die native Erkennung bleibt von der Vorschau unabhängig. Keine Bilder landen in Logs, UserDefaults oder Dateien.

Automatisierte Gates: Shell-Verträge inklusive Vorschau-Lifecycle; bestehende Bridge-/Overlay-Regressionen; Layout ohne horizontalen oder vertikalen Überlauf bei 680×800 und 520×760; native Swift-/Rust-Kompilierung auf macOS. Größere Schrift/Zoom darf weiterhin scrollen.

Noch am Mac zu prüfen: Livebild der gewählten Webcam, Deckungsgleichheit der gespiegelten Punkte und Linien, Performance, Vorschau nach Pause/Fortsetzen sowie Erkennung nach Fenster-Schließen und Space-Wechsel. Screenshotprüfungen verwenden simulierte Zustandsdaten, keinen echten Kamera-Hardwaretest.
