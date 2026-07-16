# CLAUDE.md — Claude Code am Tawel-Projekt

> **[`AGENTS.md`](AGENTS.md) ist die führende Arbeitsanweisung** (Produkt,
> Quellen-Hierarchie, Pflicht-Lektüre, Arbeitsregeln, PR-Template,
> Notion-Schreibregeln, Kontext zu Paul). Diese Datei ergänzt **nur
> Claude-Code-Spezifisches** und wiederholt AGENTS.md nicht.

Zuerst lesen: `AGENTS.md` → `docs/decisions.md` → `docs/product-status.md` →
aufgabenrelevante Doku → aktueller `main`.

## Notion-Zugriff (MCP)

Claude Code hat in dieser Umgebung Zugriff auf Notion über den Notion-MCP-Server
— damit ist die **Produkt-Wahrheit direkt lesbar** (nicht nur der Snapshot).

- **Tawel-Hauptseite** (Master): Produktkern, Entscheidungen, Quellen-Hierarchie,
  Workflow-Regeln. Session-Start hier (bzw. via Snapshot, falls MCP fehlt).
- **Datenbanken:** „Tawel – Update Backlog" (Produkt-/Code-Bugs und -Features) ·
  „Tawel – Go-to-Market" (Launch: Recht, Zahlungen, Marketing). Jeder Eintrag ist
  self-contained (Entscheidung + Begründung + Status + offene Schritte).
- **Schreiben:** nach den Notion-Schreibregeln in [`AGENTS.md`](AGENTS.md) §6 —
  Original-Notizen erhalten, nur annotieren (`→ TYP (Datum, Agent): …`),
  Attribution + Datum, eine Entscheidung ein Ort. Task-Seiten nie destruktiv
  überschreiben.
- In cron-/headless-Läufen kann der interaktiv authentifizierte MCP-Zugriff
  fehlen — dann `docs/product-status.md` als Fallback nutzen und den Bedarf
  vermerken, statt zu raten.

## Sandbox-Grenzen (Verifikation)

- **Ausgehendes Netzwerk ist eingeschränkt.** `tawel.app` / `pages.dev` sind aus
  der Sandbox **nicht erreichbar** — Live-Verifikation nie behaupten; auf pages.dev
  prüft **Paul**.
- **MailerLite lädt nicht:** `assets.mailerlite.com` ist blockiert. Das
  Warteliste-Embed lässt sich lokal nicht rendern — CSS am dokumentierten
  ML-Markup ableiten, Sichtprüfung Paul überlassen.
- **Verifikations-Methode lokal:** `python3 -m http.server` + Playwright
  (Chromium unter `/opt/pw-browsers`), Kamera per
  `--use-fake-device-for-media-stream`. Screenshots bei ~390 px (mobil) und
  ~1280 px (Desktop). Debug-Hooks vor dem Commit entfernen.

## Session-/Umgebungshinweise

- Remote-Ausführungsumgebung: frisch geklontes Repo, ephemer — Arbeit committen
  und pushen, sonst geht sie verloren.
- GitHub nur über die GitHub-MCP-Tools (kein `gh`/`git`-Push-Ersatz für PRs);
  Repo-Scope auf `drunknmonkey/nailguard`.
- Kein PR ohne ausdrücklichen Wunsch; **niemals** selbständig in `main` mergen
  (siehe AGENTS.md §4).
