# AGENTS.md — Arbeitsanweisung für Coding-Agents

Diese Datei ist die **allgemeine, werkzeug­unabhängige Arbeitsanweisung** für
alle Coding-Agents am Tawel-Projekt (Claude Code, OpenAI Codex, ggf. weitere).
Sie gilt für jede Session. Werkzeug-Spezifisches steht daneben:
[`CLAUDE.md`](CLAUDE.md) (Claude Code). Der datierte Produkt-Snapshot liegt in
[`docs/product-status.md`](docs/product-status.md).

---

## 1. Was ist Tawel?

Ruhige, private Unterstützung gegen unbewusstes Hand-zum-Mund-Verhalten /
Nägelkauen. Eine Kamera erkennt lokal, wenn eine Hand zum Mund wandert, und
zeigt einen ruhigen visuellen Hinweis statt eines Alarms.

- **Positionierung: „calm over alarm" + Meeting-Diskretion.** Kein Blitz, kein
  Piepton, keine Scham — das unterscheidet Tawel von den direkten Wettbewerbern
  (Nailed, Nail Snitch: beide Alarm-/Scham-Produkte). Das Signal soll in
  Bildschirmaufnahmen und geteilten Bildschirmen unsichtbar bleiben. Privacy ist
  Baseline, kein Differenzierer (die Konkurrenz wirbt ebenfalls mit „100 % lokal").
- **Architektur:** Erkennung über **MediaPipe** (FaceLandmarker + HandLandmarker),
  vollständig **self-hosted** (kein CDN, offline-fähig nach erstem Load). Die
  **Mac-App** ist ein **Tauri-2.x-Wrapper um die PWA**; die **Web-Version** ist
  dieselbe PWA im Browser.
- **Design-System „Atem & Ruhe":** vollständig tokenbasiert (Farben, Typo,
  Abstände, Motion), Signatur-Element ist der atmende Ring. Schrift durchgängig
  **Instrument Sans**. Referenz: `docs/design-audit.md`.
- **Struktur unter tawel.app:** Root (`/`) = Landingpage · `/app` = kostenlose
  **Web-Version** · **Mac-App** = Kernprodukt (in Entwicklung, läuft zuverlässig
  im Hintergrund). Ein Repo, ein Cloudflare-Pages-Deploy liefert Landing + Web-App;
  Ordnerstruktur = URL-Struktur (kein Build-Schritt).

Produktdetails, offene Entscheidungen und Prioritäten:
[`docs/product-status.md`](docs/product-status.md) (Snapshot) bzw. Notion (Master).

---

## 2. Quellen-Hierarchie

Drei Quellen, klare Rollen. **Bei Widerspruch gilt die zuständige Quelle — und
der Widerspruch wird benannt, nie still eine Version gewählt.**

| Quelle | Zuständig für | Rolle |
|--------|---------------|-------|
| **Notion** | Produkt: Entscheidungen, Status, Prioritäten, Launch | **Produkt-Wahrheit (Master)** |
| **GitHub** | Technik: Code, PRs, Merge-Status, `docs/decisions.md` | **technische Wahrheit** |
| **`docs/product-status.md`** | datierter Abzug des Notion-Stands | **Snapshot** für Sessions ohne Notion-Zugriff; Master bleibt Notion |

- Widerspricht der Snapshot dem aktuellen Notion-Stand → **Notion gewinnt**, der
  Snapshot ist veraltet (Datum in der Kopfzeile prüfen).
- Widerspricht Notion dem Code (z. B. „noch offen", obwohl längst gemergt) →
  **GitHub ist für den Merge-Status maßgeblich**; die Produkt­aussage bleibt
  Notions Sache. Den Konflikt im PR/der Session benennen.

---

## 3. Pflicht-Lektüre zu Session-Beginn

In dieser Reihenfolge, bevor du Code oder Doku anfasst:

1. **`AGENTS.md`** (diese Datei)
2. **`docs/decisions.md`** — chronologische technische Entscheidungen
3. **`docs/product-status.md`** — datierter Produkt-Snapshot
4. **aufgabenrelevante Doku** — z. B. `docs/design-audit.md`, `docs/ux-audit.md`,
   `docs/tauri-spike.md`, `docs/pill-mode.md`, `docs/DEPLOYMENT.md`, `README.md`
5. **aktueller `main` + überlappende offene PRs** — dein Ausgangspunkt

**Sessions mit Notion-Zugriff** beginnen zusätzlich bei der **Tawel-Hauptseite**
und den relevanten **Backlog-Einträgen** (Notion = Produkt-Wahrheit), bevor sie
den Snapshot heranziehen.

> **Nur der aktuelle `main` zählt.** Alter Chat-Kontext, Session-Erinnerungen und
> historische/verwaiste Branches sind **kein** verlässlicher Stand — lies den
> echten Zustand aus Repo und Notion, statt ihn zu erraten.

---

## 4. Arbeitsregeln

- **Ein Branch pro Aufgabe**, klar benannt nach dem Schema
  `bereich/kurzbeschreibung` (z. B. `landing/hero-copy`, `app/snooze-button`,
  `docs/multi-agent-basis`).
- **Ein Thema pro Branch** — keine unzusammenhängenden Änderungen bündeln.
- **Erkennungslogik** (MediaPipe-Auswertung: Distanz-/Nähe-Berechnung,
  Landmark-Verarbeitung, Schwellen-/Haltezeit-Auswertung) **nur anfassen, wenn
  die Aufgabe es ausdrücklich verlangt.** Sonst unberührt lassen.
- **Hardware-abhängige Änderungen** (Bluetooth/Audio, native Fenster/Overlay,
  Kamera-Berechtigungen im Wrapper) **NIE ohne Pauls Geräte-Test mergen** — sie
  lassen sich in der Sandbox nicht verifizieren.
- **Web-testbare Änderungen auf pages.dev verifizierbar halten** (Landing + Web-App
  laufen dort). Was nur mit echter Kamera/Hardware testbar ist, klar als solches
  kennzeichnen.
- **Bestehende Tests erhalten und ausführen.** Keine Tests still brechen oder
  löschen. (Aktuell keine automatisierte Suite im Repo — Verifikation daher per
  lokalem Server + Screenshots/Playwright, siehe PRs der Vergangenheit.)
- **Dauerhafte technische Entscheidungen** nach `docs/decisions.md` (chronologisch
  anhängen, mit Datum). **Produkt-Entscheidungen** gehören nach Notion.
- **NIEMALS selbständig in `main` mergen.** PRs warten auf Pauls Go.

### Repo-Konventionen (Code)

- Kein externer API-Aufruf aus `app.js`. Alle Daten in `localStorage`.
- Keine externen Dependencies außer den self-hosted MediaPipe-Dateien und
  self-hosted Schriften (kein CDN).
- Nutzer-sichtbare Strings **nur** über i18n (`t(key)` / `t(key, { count })`) —
  nie Rohstring in JS oder HTML. Klassen und IDs auf Englisch.
- Settings sofort mit `saveSettings()` persistieren; Stats mit `saveStats()` im
  tagesgruppierten Objekt.
- Keine `console.log`-Aufrufe im Produktiv-Code.
- Commits auf Deutsch (Betreff + Body), PR-Beschreibungen auf Deutsch.

---

## 5. PR-Template (verbindlich)

Jeder PR-Text enthält diese Abschnitte, auf Deutsch:

```markdown
## Problem
Was war der Anlass / das Symptom?

## Entscheidung
Welcher Ansatz wurde gewählt und warum (Alternativen kurz)?

## Änderungen
Was wurde konkret geändert (Dateien/Verhalten)?

## Bewusst NICHT enthaltener Scope
Was gehört bewusst nicht in diesen PR?

## Tests
Was wurde wie verifiziert? Was war NICHT verifizierbar (z. B. Hardware,
Drittanbieter-Embed in der Sandbox)?

## Manuelle Testanleitung für Paul
Schritt-für-Schritt, für einen Nicht-Entwickler: testbar im Browser / auf
pages.dev oder als .dmg — KEIN Terminal, keine Build-Befehle.
```

---

## 6. Notion-Schreibregeln

Gilt nur, wenn die Session Notion-Zugriff hat (z. B. Claude Code, ChatGPT). Ohne
Zugriff: den Bedarf im PR/der Antwort vermerken, damit Paul es nachträgt.

- **Original-Notizen erhalten** — nie destruktiv überschreiben. Ergänzungen als
  **Annotation** anhängen: `→ TYP (Datum, Agent): …` (z. B.
  `→ UMSETZUNG (2026-07-15, Claude Code): …`).
- **Attribution + Datum immer** — jeder Schreibzugriff wird zugeordnet und datiert.
- **Eine Entscheidung, ein Ort** — Entscheidungen leben an genau einer Stelle
  (Entscheidungs-Sektion oder zugehöriger Task); andere Stellen **verweisen
  darauf**, statt sie neu zu formulieren.
- **Widersprüche benennen** — bei Konflikt zwischen Code, Doku und Notion den
  Konflikt aufzeigen, nie still eine Version wählen.

---

## 7. Kontext zu Paul

- **Solo-Gründer, Nicht-Entwickler.** Arbeitet **nicht im Terminal** — Code läuft
  über Coding-Agents, Notion-Pflege über Claude/ChatGPT.
- **Kommunikation auf Deutsch** (Antworten, Commits, PR-Beschreibungen). **Code-
  Identifier bleiben englisch** (Klassen, IDs, Funktionsnamen); nutzer-sichtbare
  Strings laufen über i18n (DE/EN).
- **Testet im Browser / auf pages.dev oder als `.dmg`.** Manuelle Testanleitungen
  entsprechend zuschneiden (klickbar, kein Kommandozeilen-Schritt).
- **Async-freundlich zuschneiden:** kleine, klar abgegrenzte Aufgaben, jeder PR
  self-contained und ohne Rückfrage nachvollziehbar.
