#!/usr/bin/env python3
"""Generiert das Tauri-Desktop-Frontend in desktop/ aus der unveränderten Web-App.

Die Web-App (index.html, app.js, style.css, i18n.js, icons/) bleibt unangetastet.
Dieses Skript kopiert sie nach desktop/ und wendet minimale, hier explizit
aufgelistete Patches an (lokale MediaPipe-Pfade, kein Service Worker, keine
externen Fonts, instrumentierte Erkennungsschleife für den Throttling-Test).

Schlägt ein Patch nicht exakt an (z.B. weil sich die Web-App geändert hat),
bricht das Skript mit Fehler ab, statt stillschweigend zu driften.

Aufruf:  python3 tools/sync-desktop-frontend.py
"""

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
DESKTOP = ROOT / "desktop"

# Dateien, die unverändert übernommen werden.
PLAIN_COPIES = ["style.css", "i18n.js"]

INDEX_PATCHES = [
    # CSP: nur noch 'self' – jeder CDN-Request würde hart geblockt. Das ist
    # gleichzeitig der strukturelle Nachweis für "kein CDN-Request" im Spike.
    (
        """      content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com; worker-src 'self' blob:;\"""",
        """      content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost; worker-src 'self' blob:;\"""",
        1,
    ),
    # PWA-Manifest ist im Desktop-Build ohne Funktion.
    (
        '    <link rel="manifest" href="./manifest.webmanifest" />\n',
        "",
        1,
    ),
    # Externe Google-Fonts entfernen: Desktop-Build soll vollständig offline
    # laufen; style.css definiert System-Fallbacks.
    (
        """    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Atkinson+Hyperlegible:wght@400;700&family=Spline+Sans+Mono:wght@300;400;500&display=swap"
      rel="stylesheet"
    />
""",
        "",
        1,
    ),
    # Warteliste-Link zeigt auf desktop.html, das nicht Teil des Desktop-Builds ist.
    (
        '          <a class="text-action desktop-link" href="./desktop.html" data-i18n="start.desktopLink">Desktop-App kommt bald – zur Warteliste</a>\n',
        "",
        1,
    ),
    # FPS-Logger für den Throttling-Test vor der App laden.
    (
        '    <script type="module" src="./app.js"></script>',
        '    <script src="./fps-logger.js" defer></script>\n    <script type="module" src="./app.js"></script>',
        1,
    ),
]

APP_PATCHES = [
    # MediaPipe-Bibliothek lokal statt von jsDelivr laden.
    (
        '} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/+esm";',
        '} from "./models/tasks-vision/vision_bundle.mjs";',
        1,
    ),
    # WASM und Modelle lokal statt von CDN/Google Storage laden.
    (
        """const MEDIAPIPE = {
  wasmBaseUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm",
  faceModelUrl:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  handModelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};""",
        """const MEDIAPIPE = {
  wasmBaseUrl: "./models/wasm",
  faceModelUrl: "./models/face_landmarker.task",
  handModelUrl: "./models/hand_landmarker.task",
};""",
        1,
    ),
    # Service Worker: cached nur CDN-Hosts und ist auf dem Tauri-Protokoll
    # ohnehin nicht verfügbar – im Desktop-Build deaktiviert.
    (
        'function registerServiceWorker() {\n  if (!("serviceWorker" in navigator)) return;',
        "function registerServiceWorker() {\n  return; // Desktop-Build: kein Service Worker (Assets liegen lokal im Bundle).",
        1,
    ),
    # Erkennungsschleife über umschaltbaren Treiber statt direktem rAF,
    # damit sich WKWebView-Throttling messen und umgehen lässt.
    (
        "requestAnimationFrame(detection.loop);",
        "scheduleDetectionTick(detection.loop);",
        2,
    ),
]

# Wird an desktop/app.js angehängt.
INSTRUMENTATION = """
// ============================================================
// Tauri-Spike-Instrumentierung (generiert von tools/sync-desktop-frontend.py)
//
// Treibt die Erkennungsschleife wahlweise über requestAnimationFrame,
// setTimeout oder einen Web Worker. WKWebView pausiert rAF bei
// verstecktem/minimiertem Fenster und drosselt DOM-Timer auf ~1 Hz;
// Worker-Timer laufen weiter. Über die Modi lässt sich messen, welche
// Variante die Erkennung im Hintergrund am Leben hält.
//
// Umschalten zur Laufzeit (DevTools-Konsole):
//   __nailguardSetLoopMode("raf" | "interval" | "worker")
// Der Modus wird in localStorage persistiert.
// ============================================================
const LOOP_MODE_KEY = "nail-guard.desktop.loop-mode.v1";
const LOOP_MODES = ["raf", "interval", "worker"];
const INTERVAL_TICK_MS = 33;

const loopStats = { ticks: 0 };
window.__nailguardLoopStats = loopStats;
window.__nailguardLoopMode = LOOP_MODES.includes(localStorage.getItem(LOOP_MODE_KEY))
  ? localStorage.getItem(LOOP_MODE_KEY)
  : "raf";
window.__nailguardSetLoopMode = (mode) => {
  if (!LOOP_MODES.includes(mode)) {
    console.warn(`[nailguard] unbekannter Loop-Modus: ${mode} (erlaubt: ${LOOP_MODES.join(", ")})`);
    return;
  }
  window.__nailguardLoopMode = mode;
  localStorage.setItem(LOOP_MODE_KEY, mode);
  console.log(`[nailguard] Loop-Modus -> ${mode}`);
};

let tickWorker = null;
let workerCallback = null;

function ensureTickWorker() {
  if (tickWorker) return;
  const source = `setInterval(() => postMessage(0), ${INTERVAL_TICK_MS});`;
  tickWorker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
  tickWorker.onmessage = () => {
    const callback = workerCallback;
    workerCallback = null;
    if (callback) callback(performance.now());
  };
}

function scheduleDetectionTick(callback) {
  const run = (now) => {
    loopStats.ticks += 1;
    callback(now ?? performance.now());
  };

  switch (window.__nailguardLoopMode) {
    case "interval":
      setTimeout(run, INTERVAL_TICK_MS);
      break;
    case "worker":
      ensureTickWorker();
      workerCallback = run;
      break;
    default:
      requestAnimationFrame(run);
  }
}
"""


def patch(source_name, text, patches):
    for old, new, expected in patches:
        count = text.count(old)
        if count != expected:
            sys.exit(
                f"FEHLER: Patch für {source_name} erwartet {expected}x, gefunden {count}x:\n---\n{old}\n---\n"
                "Die Web-App hat sich geändert – Patch in tools/sync-desktop-frontend.py anpassen."
            )
        text = text.replace(old, new)
    return text


def main():
    DESKTOP.mkdir(exist_ok=True)

    for name in PLAIN_COPIES:
        shutil.copy2(ROOT / name, DESKTOP / name)

    shutil.copytree(ROOT / "icons", DESKTOP / "icons", dirs_exist_ok=True)

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    (DESKTOP / "index.html").write_text(patch("index.html", index, INDEX_PATCHES), encoding="utf-8")

    app = (ROOT / "app.js").read_text(encoding="utf-8")
    (DESKTOP / "app.js").write_text(patch("app.js", app, APP_PATCHES) + INSTRUMENTATION, encoding="utf-8")

    print("desktop/ aktualisiert (index.html, app.js, style.css, i18n.js, icons/).")
    print("Hinweis: desktop/models/ wird von tools/fetch-mediapipe-assets.sh befüllt.")


if __name__ == "__main__":
    main()
