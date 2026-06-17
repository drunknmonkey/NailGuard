# Entscheidungs-Log — NailGuard

Kurze Einträge, je: **Entscheidung**, **Kontext/Begründung**, ggf. **Verworfen**.
Damit kein Tool (und kein Zukunfts-Ich) getroffene Entscheidungen neu aufrollt.
Neueste oben.

-----

## 2026-06-16 — Designrichtung „Atem & Ruhe”

**Entscheidung:** Gesamtes UI folgt der Richtung „Atem & Ruhe”: ruhiger
Begleiter statt Überwachungs-Tool. Zentrales Element ist ein atmender
Status-Ring, der sich farblich aufwärmt, wenn die Hand näher kommt.
**Begründung:** Verkörpert, was die App tut (unterbrechen und beruhigen), und ist
auf einer Landingpage sofort wiedererkennbar. Verbindliche Referenz:
`docs/nailguard-design-referenz.html`.
**Verworfen:** „Stilles Instrument” (Messgerät-Ästhetik), „Unsichtbarer
Begleiter” (durchgehende Office-Ästhetik).

## 2026-06-16 — Lesbarkeit in Warnzuständen

**Entscheidung:** Zustandstext steht **unter** dem Ring auf ruhiger Fläche, und
Warnzustände nutzen eigene dunkle Textfarben (`--warm-text`, `--ember-text`).
**Begründung:** Schrift war auf dem aufgewärmten Hintergrund schlecht lesbar.

## 2026-06-16 — Privacy-Avatar verworfen

**Entscheidung:** Kein schematischer Avatar anstelle des Kamerabilds.
**Begründung:** Auf Wunsch zurückgenommen; offen gelassen, was (falls überhaupt)
in der Ringmitte angezeigt wird.

## 2026-06-16 — Office Mode: Zustand statt Reiter

**Entscheidung:** Office Mode ist kein Navigations-Reiter, sondern ein Zustand.
Aktivierung über Button im Focus Mode; läuft vollflächig ohne Header und
Navigation. Verlassen per Klick auf den getarnten Status-Punkt **und** per
`Esc`-Taste. Navigation hat dadurch nur drei Reiter (Focus, Review,
Einstellungen).
**Begründung:** Man „besucht” den Office Mode nicht — und sichtbare Navigation
würde die Tarnung verraten.

## 2026-06-16 — Office-Tarnung = funktionierender Texteditor

**Entscheidung:** Die Tarn-Ansicht ist ein echter, schlichter Texteditor
(„Notizen.txt”), kein Platzhalter und keine reine Uhr/Datum-Ansicht. Der
Editorinhalt soll persistiert werden (localStorage → später `tauri-plugin-store`).
Der Erkennungs-Status sitzt getarnt als kleiner Punkt in der Statusleiste und
folgt der Ring-Farblogik.
**Begründung:** Maximal unauffällig — wer rüberschaut, sieht jemanden beim
Schreiben; nebenbei echt nutzbar.
**Verworfen:** Ursprüngliche Idee „Screen mit Uhrzeit/Datum/Status”; Notizen-
/Tasks-Karten aus dem ersten Mockup.

## 2026-06-16 — Office-Optionen in den Einstellungen

**Entscheidung:** Alle Office-Mode-Optionen leben in den Einstellungen, nie auf
der Office-Seite selbst.
**Begründung:** Jedes NailGuard-Element auf der Tarn-Seite schwächt die Tarnung.

## 2026-06-16 — Einstellungen als thematische Karten

**Entscheidung:** Einstellungen in Karten gruppieren (Erkennung / Hinweise /
Privatsphäre / Office Mode / Sprache + Daten) statt einer flachen langen Liste.
**Begründung:** Erweiterte Einstellungen sollen sekundär wirken.

## 2026-06-16 — Flow nach Kalibrierung

**Entscheidung:** Nach Abschluss der Kalibrierung wechselt die App in den Focus
Mode, nicht in die Einstellungen.
**Begründung:** Der Nutzer soll im Kernerlebnis ankommen, nicht in der Verwaltung.

## 2026-06-16 — Zeitformat im Tracker

**Entscheidung:** Ruhige Zeit / Session-Dauer ab 60 Minuten als „1 Std 18 Min”
bzw. „h:mm” darstellen statt „78 min”.
**Begründung:** Lange Sessions in Minuten sind schlecht lesbar.

## 2026-06-16 — Gesichtsberührungs-Modus

**Entscheidung:** Eigener, umschaltbarer Modus, der auf jede Gesichtsberührung
reagiert (nicht nur am Mund), mit eigener, längerer Haltezeit. UI-Schalter ist im
Design bereits angelegt.
**Begründung:** Das Gesicht ist eine viel größere Zielfläche — Brille richten,
Kinn aufstützen würden sonst ständig fehlauslösen.

## 2026-06-16 — MediaPipe self-hosten

**Entscheidung:** Modelldateien aus `models/` im Repo ausliefern statt von
`storage.googleapis.com` / jsDelivr laden. Lade-URLs auf relative Pfade umstellen.
**Begründung:** Firmen-Proxys blockieren die CDNs (App startet sonst nicht), und
die Privacy-Aussage wird wasserdicht (kein externer Request beim Start). Für die
Tauri-App ohnehin Pflicht.

## 2026-06-16 — localStorage absichern + Datenportabilität

**Entscheidung:** `navigator.storage.persist()` beim Start aufrufen; JSON-Export
und -Import aller NailGuard-Daten in den Einstellungen anbieten.
**Begründung:** localStorage ist fragil (Browser-Cleanup, „Websitedaten löschen”).
Wer 40 Tage Streak verliert, deinstalliert. Export ist zugleich ein
Vertrauenssignal und die Migrationsbrücke in die Desktop-App.

## 2026-06-16 — Desktop-App mit Tauri 2.x

**Entscheidung:** Die Desktop-App wird mit Tauri 2.x gebaut (nicht Electron). Die
bestehende Web-App lebt unverändert im selben Repo weiter, Tauri kommt als
`src-tauri/` dazu. Web = kostenlose Demo, Desktop = Bezahlprodukt.
**Begründung:** Leichtgewichtiger als Electron; löst die Kernlimitierung des
Browsers (Hintergrunderkennung). Liefert macOS/Windows/Linux aus einer Codebasis.

## 2026-06-16 — Spike vor Tauri-Commitment

**Entscheidung:** Vor dem eigentlichen Bau ein Machbarkeits-Spike auf Branch
`spike/tauri`: Kamera in WKWebView, lokale Modell-Pfade, und vor allem ein
Throttling-Test (Erkennung bei minimiertem/verstecktem Fenster) mit echten
Frame-Raten. Ergebnis als Go/No-Go in `docs/tauri-spike.md`.
**Begründung:** Kamera im WKWebView und Background-Throttling sind die zwei
Punkte, die das ganze Vorhaben kippen könnten — zuerst absichern.

## 2026-06-16 — Vertrieb: Merchant of Record + Apple-Signierung

**Entscheidung:** Verkauf über einen Merchant of Record (Lemon Squeezy oder
Paddle); Apple-Developer-Konto für Signierung und Notarisierung der macOS-App.
**Begründung:** MoR übernimmt die EU-Umsatzsteuer-Abwicklung. Ohne Notarisierung
blockt macOS die App auf fremden Rechnern.
**Status:** Richtung festgelegt, Anbieterwahl (Lemon Squeezy vs. Paddle) offen.

## 2026-06-16 — Web-Limitierung ehrlich abbilden (Backlog)

**Entscheidung:** Im Browser läuft die Erkennung nur bei sichtbarem, aktivem Tab.
Statt dagegen zu kämpfen: bei Tab-Wechsel automatisch in den `paused`-Zustand
(Page Visibility API), Bildschirm wach halten bei aktivem Tab (Screen Wake Lock).
**Begründung:** Hintergrunderkennung ist im Browser nicht lösbar — das ist genau
der Daseinsgrund der Desktop-App. Die Limitierung transparent machen, nicht
verstecken.
**Status:** Im Backlog (mittel), noch nicht umgesetzt.
