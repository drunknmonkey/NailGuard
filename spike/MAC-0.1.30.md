# 0.1.30 · Hinweis als kurzer Impuls, Kameravorschau flüssiger

## Anlass (Paul, 10.10.2026, 15:54)

Das „Atmen" beim Fokusverlust bzw. den Effekten erst einmal weglassen: Der
Hinweis soll sich weich aktivieren und nach einer Sekunde wieder gehen – wie
der Ton. Außerdem wirkt das Testbild in der Mac-App im Vergleich zur
Browser-Version ruckeliger, niedriger aufgelöst und zeigt öfter „kein Signal".

## Änderungen

### Visueller Hinweis: einmaliger Impuls wie der Ton

- Bisher blieb der Hinweis bei einem echten Treffer **gehalten**, bis die Hand
  den Bereich verließ (dann erst Ausblenden). Jetzt wird er wie der Ton **am
  Beginn eines Treffers einmal ausgelöst**: weich einblenden (Regler
  „Einblenden"), **1 s halten** (`CUE_HOLD_MS`), weich ausblenden (Regler
  „Ausblenden"), Fenster weg. Wie lange die Hand bleibt, spielt keine Rolle;
  das Ende des Treffers löst nichts mehr aus. Der nächste Treffer spielt ihn
  erneut.
- Die Vorschau in den Einstellungen zeigt exakt diesen Ablauf (vorher hielt
  sie 1,2 s). Sie ist auch während eines laufenden Treffers möglich.
- Ein Stilwechsel während eines Treffers schaltet keinen laufenden Hinweis
  mehr um; er gilt ab dem nächsten Treffer. `release_visual_hint` entfällt.
- Die Mechanik von 0.1.22–0.1.29 bleibt (nativer Pegelstrom, Radius-Restwert
  1 px, Backdrop-Deckkraft 1, Schleierschicht beim Fokusverlust, Tor vor dem
  Verstecken, Reduce Motion 150 ms) – nur die Dauer ist jetzt fest.
- Hinweistext unter „Animation" entsprechend angepasst (DE/EN).

### Kameravorschau

Ursachen im Code: Die Vorschau entstand nur **nach** einer vollständigen
Auswertung (max. 15/s, in der Praxis durch Face + Hand-Vision weniger) und
zusätzlich höchstens alle 100 ms – also oft 5–8 Bilder/s. War ein Bild älter
als 0,75 s, lieferte die Mailbox leer, und die Oberfläche blendete sofort auf
„Starte die Kamera …" um – daher das wiederkehrende „kein Signal". Dazu
480 px Breite bei JPEG 0,6 und Abfrage nur 8-mal pro Sekunde.

- **Vorschau folgt der Kamera, nicht der Auswertung**: Jedes Kamerabild kann
  Vorschau werden (Mailbox taktet, nie zwei Encoder gleichzeitig), mit den
  Landmarken der letzten Auswertung. Vision läuft weiterhin höchstens 15/s –
  Erkennung unverändert.
- Takt höchstens **24 Bilder/s** (vorher 10), **640 px Breite** (vorher 480),
  JPEG **0,72** (vorher 0,6). Weiterhin Software-Kontext auf eigener
  Utility-Queue, damit neben Vision keine GPU-Aufträge entstehen.
- **Letztes Bild bleibt 2 s stehen** (vorher 0,75 s), bevor die Mailbox leer
  liefert; die Oberfläche hält ein Bild zusätzlich 1 s über eine leere
  Antwort hinweg. Ein wirklich gestoppter Kamerastrom zeigt die Meldung
  weiterhin.
- Abfrage **alle 40 ms** statt 125 ms (nur bei sichtbarem Kamera-Panel,
  höchstens eine Dekodierung gleichzeitig wie bisher).

## Tests

- `hint-overlay.test.js`: Treffer lösen zeitgesteuerten Hinweis aus
  (`held=false`, `CUE_HOLD_MS`), fallende Flanke wird ignoriert,
  `release_visual_hint` existiert nicht mehr, Vorschau = echter Ablauf.
- `hint_finish.rs`: `CUE_HOLD_MS` zwischen 0,5 und 2 s.
- `PreviewMailboxTests.swift`: Haltefenster 2 s, Takt 24/s, Mindestbreite und
  -qualität, bisherige Lease-/Seitenwechsel-Verträge.
- `mac.test.js`: angezeigtes Bild bleibt über eine kurze leere Antwort stehen,
  längere Lücke zeigt die Wartemeldung, Abfragetakt 40 ms.
- Browser-Check (`check-hint-rendering.js`), Alpha-/Diagnostik-Tests grün.

## Hardwaretest

1. Erkennung starten, Hand länger als drei Sekunden zum Mund: Der Hinweis
   soll einmal weich kommen, etwa eine Sekunde bleiben und von selbst gehen,
   während die Hand noch da ist. Hand weg, erneut hin: Hinweis erneut.
2. Einstellungen → Kamera → Vorschau: flüssiger, schärfer, keine
   wiederkehrende Wartemeldung bei laufender Kamera. Falls die CPU spürbar
   steigt (Aktivitätsanzeige), bitte melden – dann Takt auf 15/s zurück.
