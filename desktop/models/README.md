# Lokale MediaPipe-Assets (Desktop-Build)

Diese Dateien ersetzen im Tauri-Desktop-Build die CDN-Quellen der Web-App,
damit die App vollständig offline läuft und keine Requests an
`cdn.jsdelivr.net` oder `storage.googleapis.com` stellt.

| Datei | Quelle |
| --- | --- |
| `tasks-vision/vision_bundle.mjs` | npm `@mediapipe/tasks-vision@0.10.15` |
| `wasm/vision_wasm_*` | npm `@mediapipe/tasks-vision@0.10.15` (wasm/) |
| `face_landmarker.task` | `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/` |
| `hand_landmarker.task` | `storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/` |

Neu herunterladen / aktualisieren: `tools/fetch-mediapipe-assets.sh`

Lizenz: MediaPipe ist Apache-2.0 lizenziert (Google).
Gesamtgröße: ca. 30 MB — für den Spike direkt eingecheckt; falls das Repo
schlank bleiben soll, später auf Git LFS oder Download-beim-Build umstellen
(siehe docs/tauri-spike.md, offene Risiken).
