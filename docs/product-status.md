# Produkt-Status — Snapshot

> **Snapshot vom 2026-07-15 — Master ist Notion; bei Abweichung gilt Notion.**
> Datierter Abzug des Notion-Stands (Tawel-Hauptseite + Update Backlog +
> Go-to-Market) für Sessions ohne Notion-Zugriff. Merge-/Code-Status ist
> Sache von GitHub (`docs/decisions.md`, offene PRs). Keine Task-Kopien —
> nur der verdichtete Produktstand.

## Produktkern

Tawel: ruhige, private Unterstützung gegen Nägelkauen. Kamerabasierte
Handerkennung (MediaPipe, lokal/self-hosted), **Tauri-2.x-Wrapper um eine PWA**.
Design-System „Atem & Ruhe" (atmender Ring, tokenbasiert, Instrument Sans).

- **Positionierung:** „Ruhe statt Alarm" + meeting-taugliche Diskretion (Signal
  unsichtbar in Bildschirmaufnahmen). Durch Wettbewerbsanalyse belegt: Nailed &
  Nail Snitch sind Alarm-/Scham-Produkte (beide $4.99), keiner meeting-safe.
  Privacy ist Baseline, kein Differenzierer.
- **Produktebenen:** Web-Version (`/app`) dauerhaft kostenlos, aber mit klarer
  Grenze (Tab muss im Vordergrund bleiben, sonst drosselt der Browser). Mac-App
  ist das Kernprodukt (Hintergrundbetrieb) und wird voraussichtlich vor dem
  öffentlichen Launch fertiggestellt.
- **Ziel:** signierte, notarisierte, käuflich verfügbare Mac-App + validierte
  Warteliste.

## Getroffene Entscheidungen (Stand 2026-07-15)

- **Marke Tawel** sichtbar überall; historische interne Dateinamen dürfen bleiben.
- **Web-Version bleibt dauerhaft kostenlos**, Tab-Vordergrund-Grenze transparent
  auf Landing und in der App erklären.
- **Mac-App = Kernprodukt.** Launch-Reihenfolge: erst Mac-App fertig + getestet,
  dann Launch. Noch **keine** endgültige Launch-Freigabe, kein Launch-Termin.
- **Auto-Tune-Schalter entfernt** — die frühere Treffer-/Fehlalarm-Logik ist nicht
  mehr Teil des Nutzerflusses und darf nicht als aktive Lernfunktion erscheinen.
- **Erstkalibrierung bleibt** — persönliche Abstands­justierung beim ersten Start,
  **kein lernendes Modell**.
- **Office Mode bleibt Kernfeature**, auf der Landing deutlicher erklären.
- **Privacy-Copy vereinheitlicht:** Modelle/App-Assets können beim Start geladen
  werden; Kamerabilder/Videos bleiben lokal, werden weder gespeichert noch
  hochgeladen.
- **Mac-Overlay (Ambient-Glow):** Machbarkeit validiert (Capture-Ausschluss
  funktioniert); Produktversprechen „nicht sichtbar in Zoom-Calls, Screen-Sharing,
  Bildschirmaufnahmen". **Bau bewusst nach dem Launch.**

## Offene Entscheidungen

- **Preismodell — BEWUSST WIEDER OFFEN** (Paul mit ChatGPT, 2026-07-15). Zur Wahl:
  **Einmalkauf** vs. **jährliches Abo**. Die Einmalkauf-Entscheidung vom
  2026-06-28 ist **aufgehoben** und darf nirgends mehr als beschlossen dargestellt
  werden. Datenpunkt aus der Wettbewerbsanalyse: beide direkten Konkurrenten
  $4.99 Einmalkauf; finaler Preis/Modell über die Warteliste validieren.
- **Merchant of Record — vorläufig.** Frühere Wahl Lemon Squeezy basierte auf
  Einmalkauf + Lizenzschlüsseln. Fällt die Wahl aufs Abo, ist **Paddle** neu zu
  bewerten. Anbieter-Entscheidung hängt am Preismodell → Konto-Setup zurückstellen.
- **`/app` aktiv bewerben?** Ob die Web-Version von der Landing als „Probier's aus"
  beworben wird oder Testumgebung bleibt, ist offen (Warteliste ist der primäre
  Validierungs-Kanal).

## Aktuelle Prioritäten (Produkt / Web)

- **Hoch:** Snooze/Mute im Fokusmodus (Table-Stake ggü. Nail Snitch); Landingpage
  + Warteliste finalisieren.
- **Mittel:** Fehlalarm-Intelligenz (Essen/Kinn-Aufstützen vs. Beißen unterscheiden);
  praktische Politur (Pause bei Display-Sleep, CPU-Verbrauch messen/kommunizieren);
  Bluetooth-Audio (**nur mit Hardware-Test mergen**).
- **Niedrig / bewusst markenkonform:** sanfte Insights statt Gamification
  (Streaks/Score widersprechen „calm over alarm").

## Launch-Tore (Go-to-Market)

- **Signierung + Notarisierung** (Apple Developer Program) — *in Progress*, seit
  2026-07-02. **Tor zum Verkaufen:** ohne Signatur keine saubere Installation.
- **Datenschutzerklärung** (Kamera, DSGVO) — Entwurf existiert (außerhalb Notion,
  bei Paul); Platzhalter füllen + juristische Prüfung offen.
- **Impressum / AGB / Widerruf (EU)** — offen; in Österreich Pflicht (§5 ECG).
- **Preis + Merchant of Record + Kauf-/Lizenz-Flow** — blockiert durch die offene
  Preismodell-Entscheidung (siehe oben).
- **Erledigt:** Warteliste live (MailerLite, Double-Opt-in); Domain/Marke Tawel;
  adaptive Pille auf jedem Hintergrund.
