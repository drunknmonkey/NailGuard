# Tawel Mac-Alpha v0.1

Technischer Stand der privaten Alpha auf Branch `agent/mac-alpha-v0-1`.
Produktstatus und offene Entscheidungen bleiben im bestehenden Notion-Eintrag
„Mac-App – private Alpha“; dieses Dokument beschreibt nur Build, Architektur und
reproduzierbare Tests im Repository.

## Architektur

- Die Alpha bündelt die bestehende Web-App in einer Tauri-2-Hülle. `app/` bleibt
  unverändert; `spike/build-frontend.sh` kopiert die Dateien und ergänzt nur
  `alpha.js`, `pill.js` und `pill.css` im generierten `spike-dist/`.
- Kamera, MediaPipe und Erkennung leben weiterhin in genau einem WebView. Für
  zuverlässige `requestAnimationFrame`-Verarbeitung bleibt dieser WebView als
  kleine, always-on-top Pille sichtbar, wenn das Hauptfenster geschlossen wird.
- Die native Menüleiste sendet ausschließlich kleine `tawel:control`-Ereignisse
  an diesen WebView. Sie erzeugt keinen zweiten Stream und keine zweite
  Erkennungsinstanz.
- Kamerabilder und Video werden weder gespeichert noch übertragen. Die native
  CSV-Diagnose enthält nur Zeitstempel, Callback-Anzahl, Sichtbarkeit und Fokus.

## Menüleiste und Lifecycle

Die Menüleiste bietet:

- `Tawel öffnen`
- `Start`
- `Pausieren` / `Fortsetzen`
- `Snooze · 15/30/60 Minuten`
- `Einstellungen öffnen`
- `Tawel beenden`

Pause stoppt den aktiven Kameratrack. Fortsetzen öffnet über die bereits
vorhandene Kameraauswahl einen neuen Stream; die private Web-App-Zustandsmaschine
bleibt dabei führend. Snooze speichert eine absolute lokale Endzeit unter
`tawel.alpha.snooze-until.v1`. Nach Ablauf oder nach einem zwischenzeitlichen
Display-Sleep wird automatisch fortgesetzt. Eine bewusste manuelle Pause oder
ein neuer Start hebt den Snooze auf.

Ein Watchdog prüft einmal pro Sekunde, ob sich die Videozeit bewegt. Bei einem
sichtbaren, aktiven und länger als 12 Sekunden stehenden Stream wird die
gespeicherte Kamera neu geöffnet; zwischen Versuchen liegen mindestens 15
Sekunden. Während Pause/Snooze oder bei unsichtbarem Dokument greift der
Watchdog nicht ein.

`Einstellungen öffnen` funktioniert auch vor dem Kamerastart und fordert dabei
keine Kamerafreigabe an. Office Mode und der Browser-Wartelistenlink werden nur
im injizierten Mac-Frontend ausgeblendet.

## Capture Exclusion

Das Hauptfenster setzt auf macOS `NSWindowSharingNone`. Paul hat den Mechanismus
auf echter Mac-Hardware bereits mit Bildschirmaufnahme und Zoom positiv geprüft:
Der sichtbare Impuls wurde nicht aufgezeichnet. Exaktes Datum, macOS-Version und
Build dieses früheren Tests sind nicht dokumentiert. Der aktuelle integrierte
Alpha-Build muss deshalb vor jeder öffentlichen Aussage erneut mit
Bildschirmaufnahme und Screen-Sharing geprüft werden.

## Reproduzierbarer Build

Der Workflow `.github/workflows/spike-mac-build.yml` läuft auf `macos-14` und:

1. verwendet Node 20 und Rust stable,
2. führt `spike/alpha.test.js` sowie JavaScript-Syntaxprüfungen aus,
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
node spike/alpha.test.js
node --input-type=module --check < app/app.js
node --input-type=module --check < app/i18n.js
node --check app/sw.js
git diff --check
```

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
7. Bildschirmaufnahme und Zoom-/Screen-Sharing; der Tawel-Impuls erscheint nicht
   im geteilten beziehungsweise aufgezeichneten Bild.
8. App-Neustart; Einstellungen und Kameraauswahl bleiben erhalten.

Noch nicht Bestandteil dieses Alpha-Meilensteins: Autostart bei Anmeldung,
Signierung/Notarisierung, App Store, Lizenz-/Preislogik und öffentliche
Capture-Exclusion-Garantie.
