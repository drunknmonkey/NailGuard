#!/usr/bin/env bash
# Lädt MediaPipe-Bibliothek, WASM-Dateien und Modelle nach desktop/models/,
# damit der Tauri-Desktop-Build vollständig ohne CDN-Zugriffe läuft.
# Quellen und Version entsprechen exakt dem, was die Web-App von CDN lädt.
set -euo pipefail

VERSION="0.10.15"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="$ROOT/desktop/models"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$MODELS/tasks-vision" "$MODELS/wasm"

echo "Lade @mediapipe/tasks-vision@$VERSION von npm ..."
(cd "$TMP" && npm pack "@mediapipe/tasks-vision@$VERSION" --silent && tar xzf "mediapipe-tasks-vision-$VERSION.tgz")
cp "$TMP/package/vision_bundle.mjs" "$MODELS/tasks-vision/"
cp "$TMP/package/wasm/vision_wasm_internal.js" \
   "$TMP/package/wasm/vision_wasm_internal.wasm" \
   "$TMP/package/wasm/vision_wasm_nosimd_internal.js" \
   "$TMP/package/wasm/vision_wasm_nosimd_internal.wasm" \
   "$MODELS/wasm/"

echo "Lade Landmarker-Modelle von storage.googleapis.com ..."
curl -fsSL -o "$MODELS/face_landmarker.task" \
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
curl -fsSL -o "$MODELS/hand_landmarker.task" \
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

echo "Fertig:"
du -sh "$MODELS"/* "$MODELS"/wasm/*
