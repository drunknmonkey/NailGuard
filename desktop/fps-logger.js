// FPS-Protokollierung für den Tauri-Spike (Throttling-Test).
//
// Loggt alle 5 Sekunden die Tick-Rate der Erkennungsschleife, den
// Sichtbarkeitszustand und ob die Kamera noch neue Frames liefert –
// in die DevTools-Konsole UND (via Tauri-Command) ins Terminal von
// `tauri dev`, damit die Werte auch bei verstecktem Fenster ablesbar sind.
(() => {
  const INTERVAL_MS = 5000;
  let lastTicks = 0;
  let lastVideoTime = -1;
  let lastWallClock = performance.now();

  function emit(line) {
    console.log(line);
    // withGlobalTauri ist aktiv; außerhalb von Tauri (z.B. Browser-Test) no-op.
    window.__TAURI__?.core?.invoke("log_fps", { line }).catch(() => {});
  }

  setInterval(() => {
    const stats = window.__nailguardLoopStats;
    if (!stats) return;

    // Tatsächlich verstrichene Zeit verwenden: Wird der Logger selbst
    // gedrosselt, sind die 5 s nicht garantiert – die FPS blieben sonst falsch.
    const now = performance.now();
    const elapsedSec = (now - lastWallClock) / 1000;
    lastWallClock = now;

    const ticks = stats.ticks;
    const fps = elapsedSec > 0 ? ((ticks - lastTicks) / elapsedSec).toFixed(1) : "0.0";
    lastTicks = ticks;

    const video = document.querySelector("#video");
    const videoTime = video ? video.currentTime : -1;
    const cameraAlive = Boolean(video) && videoTime > 0 && videoTime !== lastVideoTime;
    lastVideoTime = videoTime;

    emit(
      `[nailguard-fps] mode=${window.__nailguardLoopMode ?? "?"} ` +
        `fps=${fps} intervalSec=${elapsedSec.toFixed(1)} ` +
        `visibility=${document.visibilityState} cameraFramesAdvancing=${cameraAlive}`
    );
  }, INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    emit(`[nailguard-fps] visibilitychange -> ${document.visibilityState}`);
  });
})();
