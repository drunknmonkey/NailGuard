# 0.1.24 · Richtigstellung: kein Parken, Fallback blendet aus

## Korrektur zu 0.1.22/0.1.23

Die Notizen zu 0.1.22 und 0.1.23 beschreiben, das Fenster werde vor dem
Verstecken 20 000 px außerhalb des Displays geparkt. Das traf im laufenden Code
nicht zu – Hinweis aus dem PR-Review (cursor[bot], 10.10.2026 09:54): Tauris
`set_position` stellt `setFrameTopLeftPoint:` in tao **asynchron** in die
Main-Queue (`exec_async`), während `hide()` → `orderOut:` auf dem Main-Thread
**sofort** läuft. Das Fenster wurde also auf dem Bildschirm versteckt und erst
einen Queue-Durchlauf später (bereits unsichtbar) verschoben.

Damit ist der Hardwarebefund aus 0.1.22 sogar klarer: Der Produktpfad war ohne
wirksames Parken sauber. **Ausreichend ist allein, dass der Window Server das
Fenster auf Alpha 0,02 blendet, während WebKit die Schicht nicht anfasst; das
anschließende `orderOut` bei 0,02 erzeugt keinen sichtbaren Nacheffekt.** Die
Testwege A/B/C flackerten, weil dort WebKit die Deckkraft der Backdrop-Schicht
selbst animierte.

## Änderungen

- Parken entfernt (`park_hint_overlay`, `PARK_OFFSET`). Der sichtbare Ablauf
  ist exakt der aus dem 0.1.22-Lauf; nur die wirkungslose Verschiebung nach
  dem Verstecken entfällt. Nebeneffekt weg: `fit_hint_overlay_to_main` muss
  das Fenster vor dem nächsten Anzeigen nicht mehr zurückholen (auch das lief
  asynchron).
- **Ausfallpfad:** Meldet der Renderer keine Bestätigung, blendet der Timer das
  Fenster jetzt zuerst 150 ms auf Alpha 0,02 und versteckt es erst danach –
  statt bei vollem Alpha, was den Backdrop-Layer sichtbar abgebaut hätte. Der
  zweite Schritt bleibt übersprungen, sobald der Renderer doch bestätigt.
- Hinweis-Log: `hide reason=… after_ms=…` ohne `parked`-Feld; der Ausfallpfad
  schreibt zusätzlich `fallback window_fade=150ms->0.02`.

## Bewertung des Review-Vorschlags

Der Bot schlug für 0.1.22 zunächst denselben Irrweg vor wie 0.1.21 (Deckkraft
der Schicht per rAF auf 0, dann Alpha 0 und `orderOut` in einem Block); das
hätte laut A/B/C weiter geflackert. Sein zweiter Vorschlag (Renderer unverändert,
Fenster-Fade, synchrones `setFrame` + `orderOut` in einer Transaktion mit
`NSDisableScreenUpdates`) entspricht dem bestätigten Pfad plus einem
synchronen Parken. Da der Pfad ohne Parken sauber war, bleibt es beim kleineren
Diff; sollte der Nacheffekt auf einer anderen macOS-Version beim `orderOut`
wieder auftauchen, wäre genau dieses synchrone `setFrameOrigin:` vor dem
`orderOut:` der nächste Schritt (nicht `set_position`).

## Verifikation

Rust-Policy, Overlay-Vertrag (keine Parkroutine mehr, Ausfallpfad mit Fade),
Chromium-Prüfung unverändert. Hardwaretest wie für 0.1.23: dreimal Vorschau,
dreimal Hand annähern/halten/wegnehmen, Log mitschicken.
