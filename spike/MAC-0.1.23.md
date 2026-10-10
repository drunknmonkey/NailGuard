# 0.1.23 · Produktpfad bestätigt, Testgerüst entfernt

## Ergebnis des 0.1.22-Hardwaretests (10.10.2026, 09:50–09:53)

| Pfad | Renderer beim Lösen | Fenster | Ergebnis |
|---|---|---|---|
| Echte Treffer (6×) | unverändert | Window-Server-Fade → geparkt → versteckt | **sauber** |
| Vorschau (3×) | unverändert | wie oben | **sauber** |
| Test A | Deckkraft → 0 | bleibt offen | zweiter Ausblendeffekt |
| Test B | Deckkraft → 0 | alt, auf dem Bildschirm versteckt | zweiter Ausblendeffekt |
| Test C | Deckkraft → 0,02 | geparkt → versteckt | zweiter Ausblendeffekt |

Das Log zeigt pro Treffer genau ein `show`, `complete`, `hide`; die CSV 6 Treffer
= 6 Darstellungen = 6 Tonstarts. Schluss: **Jede Deckkraftänderung, die WebKit
selbst am Backdrop-Layer fährt, lässt den Compositor danach eine eigene
Ausblendung nachspielen** – unabhängig davon, ob das Fenster offen bleibt, auf
dem Bildschirm oder abseits versteckt wird. Blendet dagegen der Window Server
das ganze Fenster über `NSWindow.alphaValue` aus, während WebKit nichts
verändert, gibt es keinen Nacheffekt. Das Parken bleibt als zweite Sicherung:
Der Layer wird nie auf dem Bildschirm abgebaut.

Zweiter Befund: Beim zweiten Treffer (09:50:38) lieferte WebKit nach dem
Wiederanzeigen rund 400 ms keine Frames (`renderer stall` ×3). Der Timer-
Fallback hat die Einblendung getragen; der Hinweis war sichtbar. Gleiches Muster
wie am 09.10. (dort ohne Fallback: Hinweis unsichtbar).

## Änderungen

- **Testgerüst entfernt:** Knöpfe A/B/C und „Test beenden", die Testmodi
  (`FinishMode`), `hold_ms`/`finish_mode`-Parameter, `hide_visual_hint`,
  `can_test_hint`. Es gibt nur noch den bestätigten Produktpfad; er ist
  unverändert: Renderer bestätigt, Fenster-Alpha → 0,02 über die eingestellte
  Ausblendzeit, danach 80 ms, Parken 20 000 px abseits, Verstecken,
  `tawel:hint-reset`.
- **Renderer:** Lösen stoppt nur noch die Einblendung und bestätigt; keine
  Ausblend-Animation mehr im WebView. Der Timer-Fallback greift schon nach
  50 ms statt 120 ms (ruhigere Einblendung, falls WebKit stockt).
- **Bewegung reduzieren:** Der Renderer meldet die Systemeinstellung mit der
  Bestätigung; der native Fade dauert dann höchstens 150 ms (wie zuvor im
  WebView).
- Einstellungen → Animation zeigt wieder den regulären Hinweistext.

## Verifikation

Rust: Fade-Dauer (normal/reduziert), Verzögerung bis zum Verstecken, Parkabstand,
veraltete Revisionen. Overlay-Vertrag: Lösen friert die Einblendung ein und
bestätigt sofort mit Reduced-Motion-Flag, nichts läuft während des Fensterfades,
Reset nur für die aktuelle Revision, Vorschau nutzt denselben Pfad, Timer-
Fallback vollendet die Einblendung ohne rAF und meldet Stillstände, gesunder rAF
meldet keinen. Chromium: fünf Varianten mit festem Filter, Lösen ohne Änderung
an Filter oder Deckkraft, Reset auf null. UI-Vertrag: keine Testmodi mehr im
Aufruf, kein Testgerüst im Markup. Erkennung, Tonlogik und Web-App unverändert.

## Hardwaretest (kurzer Gegencheck)

Dreimal Vorschau, dreimal Hand annähern/halten/wegnehmen. Erwartung: wie 0.1.22
im Produktpfad – kein zweiter Effekt. Log mitschicken; `renderer stall`-Zeilen
sind dort nur informativ.
