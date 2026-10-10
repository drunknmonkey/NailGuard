# 0.1.20 · Ausblendabschluss A/B

Pauls Hardwaretest mit 0.1.19 flackert auch bei pausierter Kamera am Ende der
Vorschau. Die CSV bestätigt die Pause von etwa 17:43:53 bis 17:44:30 am
09.10.2026: keine neuen Kameraframes oder Treffer. Die Vorschau-Ereignisse werden
nicht vom nativen Trefferzähler erfasst. Ein Rendering-/Fensterproblem ist damit
isoliert; ein bestimmter WebKit-/macOS-Fehler ist noch nicht bewiesen.

Zwei explizite Testknöpfe unter Einstellungen → Animation nutzen dieselbe
Darstellung, dieselben Einstellungen und dieselbe Haltezeit von 3 Sekunden:

- A: Nach gemeldetem Filterwert null bleibt das klickdurchlässige transparente
  Fenster stehen. Auch der native Ausfall-Timer darf es dann nicht verstecken.
- B: Nach derselben Meldung wird das Fenster erst nach 600 ms versteckt.
- Test beenden: gibt einen laufenden Test frei und versteckt das Testfenster.

Die Tests erfordern eine pausierte oder nicht gestartete Kamera (UI und native
Prüfung). Sie starten keine Kamera und spielen keinen Ton. Sie verändern keine
gespeicherte Einstellung. Echte Treffer und normale Vorschauen nutzen weiterhin
den bisherigen sofortigen Fensterabschluss als Kontrolle.

Revisionsprüfung verhindert, dass eine alte Abschlussmeldung/ein Timer einen
neuen Hinweis versteckt. Ein fehlender Renderer-Abschluss lässt weiterhin den
nativen Sicherheitstimer greifen. Es laufen keine Frames im neutralen Zustand.

Tests: Rust-Policy prüft unterschiedliche Abschlussregeln, aufgehobenen Fallback
bei Erfolg und veraltete Revisionen. UI-Vertrag prüft A/B, Pausenvoraussetzung und
Aufräumen. Die bestehenden Animations-, Browser-, Erkennungs- und Bundleprüfungen
bleiben Bestandteil des Workflows. Die Darstellung am Mac ist offen.

Hardwaretest: pausieren, gleiche Effekt-/Zeitwerte behalten, A dreimal und B
dreimal starten, jeweils zwei Sekunden nach dem Ausblenden beobachten. Bei A
zusätzlich melden, ob erst „Test beenden“ flackert. Keine neue Änderung der
Erkennungsschwellen, Kameraauflösung, Tonlogik oder Web-App.
