#!/usr/bin/env bash
# Private Mac-Alpha: kopiert die bestehende PWA nach spike-dist/ und injiziert
# nur die native Steuerbrücke. So bleibt der echte PWA-Code unangetastet, und Tauri bündelt
# nur die nötigen Frontend-Dateien (kein .git, kein src-tauri/target).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/spike-dist"

rm -rf "$DIST"
mkdir -p "$DIST"

# Die Web-App liegt seit der tawel.app-Umstrukturierung unter app/ (Root = Landing).
# Tauri bündelt weiterhin nur die App: aus app/ nach spike-dist/ (Bundle-Wurzel).
for item in index.html app.js style.css i18n.js sw.js manifest.webmanifest fonts vendor models icons; do
  cp -R "$ROOT/app/$item" "$DIST/"
done

# Alpha-/Pill-Assets dazulegen ...
cp "$ROOT/spike/alpha.js" "$DIST/alpha.js"
cp "$ROOT/spike/pill.js" "$DIST/pill.js"
cp "$ROOT/spike/pill.css" "$DIST/pill.css"

# ... und in die kopierte index.html einbinden (nur im Tauri-Build).
python3 - "$DIST/index.html" <<'PY'
import sys
path = sys.argv[1]
html = open(path, encoding="utf-8").read()
if "./pill.css" not in html:
    html = html.replace("  </head>", '    <link rel="stylesheet" href="./pill.css" />\n  </head>', 1)
if "./alpha.js" not in html:
    html = html.replace(
        "  </body>",
        '    <script src="./alpha.js"></script>\n'
        '    <script src="./pill.js"></script>\n  </body>',
        1,
    )
open(path, "w", encoding="utf-8").write(html)
PY

echo "Tawel-Alpha-Frontend gebaut: $DIST"
