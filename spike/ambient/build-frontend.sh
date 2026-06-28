#!/usr/bin/env bash
# Ambient-Glow-Spike: legt das schlanke Frontend (Steuerfenster + Overlay) nach
# ambient-dist/ ab. Kein PWA-Code, keine Kamera, keine MediaPipe-Modelle – der
# Spike testet nur das Overlay. Dadurch ist der Bundle klein und der Build schnell.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/spike/ambient"
DIST="$ROOT/ambient-dist"

rm -rf "$DIST"
mkdir -p "$DIST"

# index.html = Steuerfenster (Hauptfenster), overlay.html = Glow-Fenster.
for item in index.html overlay.html control.js overlay.js ambient.css; do
  cp "$SRC/$item" "$DIST/"
done

echo "ambient-dist gebaut: $DIST"
