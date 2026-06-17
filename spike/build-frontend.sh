#!/usr/bin/env bash
# Wegwerf-Spike: kopiert die bestehende PWA nach spike-dist/ und injiziert das
# Mess-Overlay. So bleibt der echte PWA-Code unangetastet, und Tauri bündelt
# nur die nötigen Frontend-Dateien (kein .git, kein src-tauri/target).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/spike-dist"

rm -rf "$DIST"
mkdir -p "$DIST"

for item in index.html app.js style.css i18n.js landing.js sw.js manifest.webmanifest vendor models icons; do
  cp -R "$ROOT/$item" "$DIST/"
done

# Spike-Overlay-/Logger-Skript dazulegen ...
cp "$ROOT/spike/spike.js" "$DIST/spike.js"

# ... und als klassisches Skript vor </body> einbinden (nur im Spike-Build).
python3 - "$DIST/index.html" <<'PY'
import sys
path = sys.argv[1]
html = open(path, encoding="utf-8").read()
if "./spike.js" not in html:
    html = html.replace(
        "  </body>",
        '    <script src="./spike.js"></script>\n  </body>',
        1,
    )
open(path, "w", encoding="utf-8").write(html)
PY

echo "spike-dist gebaut: $DIST"
