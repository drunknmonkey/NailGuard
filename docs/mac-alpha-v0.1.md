# Tawel Mac-Alpha v0.1

Technischer Stand der privaten Alpha auf Branch `agent/mac-alpha-v0-1`.
Produktstatus und offene Entscheidungen bleiben im bestehenden Notion-Eintrag
„Mac-App – private Alpha“; dieses Dokument beschreibt nur Build, Architektur und
reproduzierbare Tests im Repository.

Aktueller Hardware-Testbuild: **Tawel 0.1.4 – Diagnose**. Der Hardwaretest von 0.1.3
zeigte weiterhin Stillstand bei unsichtbarem Fenster; 0.1.4 trennt die Ursachen.

## Architektur

- Die Alpha bündelt die bestehende Web-App in einer Tauri-2-Hülle. `app/` bleibt
  unverändert; `spike/build-frontend.sh` kopiert die Dateien, wendet den kleinen
  Mac-only-Patch `alpha-app.patch` an und ergänzt `alpha.js`, `pill.js` und
  `pill.css` im generierten `spike-dist/`.
- Kamera, MediaPipe und Erkennung leben weiterhin in genau einem WebView. Ein begrenzter
  Timer (33 ms nach jedem Durchlauf, pausiert 200 ms) ersetzt den bisherigen
  `requestAnimationFrame`-Takt, einschließlich Erststart. Die vorhandene
  `backgroundThrottling: disabled`-Einstellung bleibt bestehen. Schließen und
  der Hintergrund-Button verstecken das Fenster; Minimieren bleibt erlaubt.
  Die Pille ist eine optionale Anzeige über das Menü, keine Voraussetzung.
- Alle fünf Testhinweise verwenden ein zweites, rein visuelles Overlay-Fenster
  ohne Kamera, MediaPipe oder Produktzustand. Es wird nur für die 2,5 Sekunden
  eines Hinweises eingeblendet und danach vollständig versteckt; die
  Ein-WebView-Architektur der Erkennung bleibt dadurch erhalten.
- Die native Menüleiste sendet ausschließlich kleine `tawel:control`-Ereignisse
  an diesen WebView. Sie erzeugt keinen zweiten Stream und keine zweite
  Erkennungsinstanz.
- Kamerabilder und Video werden weder gespeichert noch übertragen. Die native
  CSV-Diagnose enthält nur Zeitstempel, Callback-Anzahl, Sichtbarkeit und Fokus.

## Menüleiste und Lifecycle

Die Menüleiste bietet:

- `Tawel öffnen`
- `Im Hintergrund weiterlaufen`
- `Pille anzeigen (optional)`
- `Start`
- `Pausieren` / `Fortsetzen`
- `Snooze · 15/30/60 Minuten`
- `A · Lavendel-Vignette`
- `B · Sanfter Fokusverlust`
- `C · Kurze Entsättigung`
- `D · Ambient Glow`
- `E · Farbhauch → Fokusverlust`
- `Probe-Hinweis anzeigen`
- `Einstellungen öffnen`
- `Tawel beenden`

Pause stoppt den aktiven Kameratrack. Fortsetzen öffnet über die bereits
vorhandene Kameraauswahl einen neuen Stream; die private Web-App-Zustandsmaschine
bleibt dabei führend. Snooze speichert eine absolute lokale Endzeit unter
`tawel.alpha.snooze-until.v1`. Nach Ablauf oder nach einem zwischenzeitlichen
Display-Sleep wird automatisch fortgesetzt. Eine bewusste manuelle Pause oder
ein neuer Start hebt den Snooze auf.

Ein Watchdog prüft einmal pro Sekunde, ob sich die Videozeit bewegt. Bei einem
aktiven und länger als 12 Sekunden stehenden Stream (auch unsichtbar) wird die
gespeicherte Kamera neu geöffnet; zwischen Versuchen liegen mindestens 15
Sekunden. Während Pause/Snooze greift der Watchdog nicht ein. Nach einer
Timerlücke durch Systemschlaf beginnt die Wartezeit für stehende Frames neu.

Der Mac-only-Erkennungsloop verarbeitet während einer Pause und ohne Live-Track
keinen MediaPipe-Frame. Sein nächster Timer wird in einem
`finally` geplant, damit ein einzelner ungültiger Frame den dauerhaften Loop
nicht mehr beenden kann. Eine bereits gestartete Produktsession bleibt auch dann
aktiv, wenn ein Kameraneustart den alten Stream kurz vor dem neuen entfernt;
dadurch kann der Watchdog einen fehlgeschlagenen Neustart erneut versuchen.

`Einstellungen öffnen` funktioniert auch vor dem Kamerastart und fordert dabei
keine Kamerafreigabe an. Office Mode und der Browser-Wartelistenlink werden nur
im injizierten Mac-Frontend ausgeblendet.

## Fünf Hinweisvarianten und Intensität

Alle fünf Varianten reagieren auf dasselbe bestehende
`nailguard:intervention`-Ereignis. Erkennungsschwelle, Statistik und Timing sind
dadurch identisch; verglichen wird ausschließlich die visuelle Form:

1. **A · Lavendel-Vignette:** Ein weicher Lavendelsaum wächst vom Displayrand
   herein; die Bildschirmmitte bleibt visuell frei.
2. **B · Sanfter Fokusverlust:** Der gesamte Arbeitsinhalt verliert für einen
   kurzen Moment minimal an Schärfe.
3. **C · Kurze Entsättigung:** Der Inhalt bleibt scharf, seine Farben ziehen
   sich kurz zurück und kehren weich wieder.
4. **D · Ambient Glow:** Lavendel und Petrol atmen von gegenüberliegenden
   Displayseiten ein, ohne die Mitte flächig einzufärben.
5. **E · Farbhauch → Fokusverlust:** Ein leichter Lavendelhauch erscheint
   zuerst; erst danach folgt der kleine Fokusbruch als sanfte Eskalation.

Die Auswahl wird unter `tawel.alpha.hint-style.v1` ausschließlich lokal
gespeichert. Der Drei-Punkt-Regler `Leicht / Mittel / Deutlich` liegt unter
`tawel.alpha.hint-intensity.v1`; Standard ist `Mittel`. Variante und Intensität
stehen gemeinsam in den normalen Tawel-Einstellungen und werden in der
Menüleiste als `Hinweis: … · …` gespiegelt. Auswahl oder Regler-Änderung zeigt
eine Vorschau; `Probe-Hinweis anzeigen` wiederholt sie, ohne einen Treffer oder
eine Statistik zu erzeugen. Alte Werte `ring`, `vignette` und `wash` werden auf
Lavendel-Vignette beziehungsweise Ambient Glow migriert. Rot/Orange wird im
gesamten injizierten Mac-Hinweiszustand durch Lavendel ersetzt.

Fokusverlust und Entsättigung verwenden CSS `backdrop-filter`. macOS 26 kann
den Inhalt hinter einem transparenten WebView direkt im Compositor filtern;
Tawel nimmt dafür keinen Screenshot auf. Auf älteren, weiterhin baubaren
macOS-Versionen bleibt eine sehr leichte helle Fallback-Fläche sichtbar. Die
ästhetische Wirkung wird deshalb auf Pauls macOS-Tahoe-Gerät abgenommen.
`prefers-reduced-motion` wird respektiert.

## Capture Exclusion

Hauptfenster und visuelles Overlay setzen auf macOS `NSWindowSharingNone`. Das
Overlay ist zusätzlich klickdurchlässig, liegt nur während des Hinweises über
dem Display und wird danach nativ wieder versteckt. Paul hat den Mechanismus
auf echter Mac-Hardware bereits mit Bildschirmaufnahme und Zoom positiv geprüft:
Der sichtbare Impuls wurde nicht aufgezeichnet. Exaktes Datum, macOS-Version und
Build dieses früheren Tests sind nicht dokumentiert. Der aktuelle integrierte
Alpha-Build muss deshalb vor jeder öffentlichen Aussage erneut mit
Bildschirmaufnahme und Screen-Sharing geprüft werden.

## Reproduzierbarer Build

Der Workflow `.github/workflows/spike-mac-build.yml` läuft auf `macos-14` und:

1. verwendet Node 20 und Rust stable,
2. baut das injizierte Frontend und führt `spike/alpha.test.js`,
   `spike/alpha-frontend.test.js`, `spike/hint-overlay.test.js` sowie
   JavaScript-Syntaxprüfungen aus,
3. verwendet die festgeschriebene Tauri CLI `2.11.4`,
4. löst die eingecheckte `src-tauri/Cargo.lock` auf,
5. baut eine unsignierte `.app` und `.dmg`,
6. prüft Kamera-Nutzungstext, Signatur und Entitlements,
7. lädt das Artefakt `Tawel-macOS-Alpha` hoch.

Lokal ausführbare Prüfungen:

```bash
bash spike/build-frontend.sh
node --check spike/alpha.js
node --check spike/pill.js
node --check spike/hint-overlay.js
node spike/alpha.test.js
node spike/alpha-frontend.test.js
node spike/hint-overlay.test.js
node --input-type=module --check < app/app.js
node --input-type=module --check < app/i18n.js
node --check app/sw.js
git diff --check
```

## Hardware-Befund vom 2026-08-04

Erster Abnahmelauf auf einem MacBook Pro 16″ (2023), M2 Pro, 16 GB, macOS
Tahoe 26.0.1:

- Die Erkennung lief vor der Pause 110 protokollierte Sekunden mit
  durchschnittlich 49,97 abgeschlossenen Detection-Callbacks pro Sekunde.
- Ab Sekunde 123 blieb der Zähler trotz `visibilityState=visible` und
  `hasFocus=true` bis zum App-Ende bei null.
- Damit ist eine bloß falsche Handempfindlichkeit ausgeschlossen. Der erste
  Alpha-Build hatte zwei konkrete Recovery-Lücken: Ein Framefehler konnte den
  rAF-Loop vor dessen nächster Planung beenden, und ein vorübergehend fehlender
  `srcObject`-Stream ließ die bereits gestartete Session fälschlich als beendet
  erscheinen.
- Beide Lücken sind im Folge-Build korrigiert und automatisiert abgedeckt.
  Paul hat Pause/Fortsetzen mit Tawel 0.1.1 anschließend auf derselben Hardware
  erfolgreich bestätigt.

## Hardware-Abnahme v0.1

Folgende Punkte benötigen den aktuellen `.dmg` auf echter Mac-Hardware:

1. Erststart und Kamera-Freigabe; interne Kamera wird vorausgewählt.
2. Wechsel auf eine zweite Kamera und Persistenz nach App-Neustart.
3. Start, Schließen des Hauptfensters und mindestens 15 Minuten Arbeit mit
   sichtbarer Pille; CSV hat keine Callback-Lücke.
4. Pause und Fortsetzen über die Menüleiste; Kameraindikator geht aus und wieder
   an.
5. Snooze mit kurzer kontrollierter Restzeit; automatische Fortsetzung inklusive
   Kameraindikator.
6. Display-Sleep von mindestens einer Minute; nach dem Aufwachen setzt die
   Erkennung innerhalb von ungefähr 15 Sekunden fort.
7. Alle fünf Varianten in den Einstellungen auswählen und jeweils in den drei
   Intensitäten ansehen; Vorschau und echter Treffer müssen gleich aussehen.
8. Während jeder Variante normal weiterklicken und tippen; das Overlay darf
   keine Eingabe abfangen.
9. Fokusverlust und Entsättigung müssen den Arbeitsinhalt tatsächlich filtern,
   nicht nur einen hellen Schleier zeigen.
10. Bildschirmaufnahme und Zoom-/Screen-Sharing mit allen fünf Varianten; der
    Tawel-Impuls erscheint nicht im geteilten beziehungsweise aufgezeichneten Bild.
11. App-Neustart; Einstellungen, Kamera-, Hinweis- und Intensitätswahl bleiben
    erhalten.

Noch nicht Bestandteil dieses Alpha-Meilensteins: Autostart bei Anmeldung,
Signierung/Notarisierung, App Store, Lizenz-/Preislogik und öffentliche
Capture-Exclusion-Garantie.


## 2026-09-05 – Hintergrundbetrieb 0.1.3

- Ein ausstehender Timer verhindert doppelte Loops; unveränderte Videoframes
  werden weiterhin nicht erneut ausgewertet. Zeitbasis ist `performance.now()`.
- Roter Fensterknopf, Hintergrund-Button und Pillen-X verstecken nur das Fenster.
  Wirkliches Beenden bleibt im Menü. Öffnen stellt ein minimiertes Fenster wieder her.
- Optionale Pille wird ausdrücklich gezeigt/entminimiert. Ungültige gespeicherte
  Monitorpositionen werden zentriert, fehlgeschlagene Übergänge setzen CSS zurück.
- Der native Logger prüft erfolgreiche Erkennungsdurchläufe. Nach 12 Sekunden
  ohne Durchlauf bei aktiver Session zeigt das Menü „Erkennung unterbrochen“.
  Ein zurückkehrender Callback hebt den Fehler auf; Pause/Snooze bleibt führend.
- Rückkehr in den Vordergrund öffnet bei bewusster Pause keine Kamera mehr.
- Regression: tatsächlicher erzeugter Timerloop ohne jedes rAF, versteckte
  Kamera-Reparatur, begrenzte Neustarts, Pause/Fortsetzen und Framefehler.
- Hardwaretest: je mindestens zwei Minuten Hintergrund-Button, Minimieren,
  Schließen und Cmd-H; jeweils Hand-zum-Mund und Callback-CSV prüfen. Danach
  Pause/Fortsetzen, Snooze, Schlaf/Aufwachen sowie optionale Pille testen.
- Lokale Tests beweisen weder fortlaufende WKWebView-Kameraframes noch
  die visuelle Wirkung auf macOS. Falls diese weiterhin einfrieren, ist eine
  native Kamera-/Erkennungslösung nötig; diese ist nicht Teil von 0.1.3.


## 2026-09-05 – Diagnosebuild 0.1.4

**Beleg:** Pauls `tawel-alpha-log-20260905-105039.csv`, 2.546 Zeilen,
10:50:41–11:33:24 (+02:00). Alle sechs `hidden`-Phasen verlieren nach dem
Übergang die erfolgreichen Durchläufe. Sichtbar ohne Fokus bleibt die Auswertung
aktiv. Das alte Log enthält keine Build-ID und keinen Pausenstatus; der Bezug
zu 0.1.3 stammt aus dem laufenden Testablauf, nicht aus dem CSV selbst.

Die ersten fünf CSV-Spalten bleiben erhalten. Neue Diagnose-Spalten:

| Felder | Aussage |
| --- | --- |
| `app_version`, `build_sha` | Kompilierte Version und Workflow-Commit; lokaler Build: `local` |
| `native_visible`, `native_minimized` | Direkt vom nativen Fenster gelesener Zustand; Fehler: `unknown` |
| `js_received_age_ms`, `js_sequence` | Alter des zuletzt nativ empfangenen Snapshots; -1 vor erstem Empfang |
| `timer_total` | Tatsächliche Eintritte in den Erkennungsloop, auch ohne neue Videoframes |
| `heartbeat_total` | Separater JavaScript-Intervall-Timer, unabhängig vom Erkennungsloop |
| `video_changes_total`, `video_time`, `decoded_frames` | Fortschritt der Videozeit und optionale Playback-Framezahl (-1: nicht unterstützt) |
| `attempts_total`, `errors_total` | Begonnene Auswertungen und im Loop gefangene Fehler |
| `running`, `paused` | Letzter aus der App-Zustandsmaschine gemeldeter Zustand |
| `video_ready_state`, `video_paused`, `track_live`, `track_muted` | Zustand des HTML-Videos und Kameratracks |
| `watchdog_total`, `restarts_total`, `ipc_failures` | Watchdog-Aufrufe, angeforderte Neustarts, gescheiterte Diagnoseübertragung |
| `last_error_kind`, `last_error_stage`, `last_error_at_ms` | Fehlerklasse, Phase (frame/face/hand/postprocess), Zeitpunkt; kein Fehlertext/Stack |

Zähler sind kumulativ pro App-Start. Differenzen aufeinanderfolgender frischer
Snapshots zeigen den Fortschritt; sie sind keine garantierten Ein-Sekunden-Raten.
Die bisherigen `callbacks_letzte_sekunde` zählen weiterhin erfolgreiche Abschlüsse.

Der native Logger schreibt auch bei fehlenden JS-Meldungen jede Sekunde weiter.
Snapshots werden vor einer möglichen synchronen Auswertung verschickt; höchstens
einer ist gleichzeitig unterwegs. Sequenzprüfung verhindert veraltete Übernahmen.
Diese Diagnose fügt geringe IPC-Last hinzu und ist kein Performance-Benchmark.

**Interpretation:**
- Frische Snapshots + Timerfortschritt + stehende Videozeit: Video-/Stream-Pfad prüfen.
- Heartbeat fortlaufend + Erkennungstimer stehend: Erkennungsscheduler prüfen.
- Steigende Fehlerzahl: gemeldete Phase der Auswertung prüfen.
- Empfangsalter steigt und alle JS-Werte stehen: JS/IPC antwortet nicht; das allein
  beweist noch keine Kameraursache. Kumulative Werte beim Wiederanzeigen helfen,
  verzögerte IPC-Zustellung von ausgebliebenen JS-Ticks zu unterscheiden.
- Fortschritt der Videozeit/Playback-Zähler ist ein Indikator, kein Beweis für
  unterschiedliche Bildinhalte. Es werden keine Bilder oder Landmarks exportiert.

**Kurzer Hardwarelauf:** 20 s sichtbar, 60 s Hintergrund-Button, 20 s wieder
sichtbar, 60 s minimiert, wieder öffnen und über Menü beenden. Danach die neueste
CSV vom Schreibtisch senden. Währenddessen nicht pausieren/snoozen.

Automatisierte Tests prüfen stehendes Video bei laufendem Timer, unabhängigen
Heartbeat, Fehlerklasse ohne sensible Meldungstexte, IPC-Rückstau ohne wachsende
Warteschlange und den JS/Rust-Snapshot-Vertrag. Die Auswertungslogik bleibt gleich.
