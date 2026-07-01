/*
 * Wegwerf-Spike: On-Screen-Overlay + Brücke zum nativen Rust-Logger.
 *
 * Wird ausschließlich im Tauri-Spike-Build geladen (per build-frontend.sh in die
 * kopierte index.html injiziert). In der echten PWA existiert diese Datei nicht.
 *
 * - Zählt abgeschlossene Detection-Callbacks (app.js ruft window.__nailguardSpike.onDetection()).
 * - Meldet jeden Callback an Rust (spike_tick) und Sichtbarkeit/Fokus (spike_state).
 * - Zeigt Live-Werte an. Das eigentliche, lückenlose Logging macht Rust (1x/s),
 *   damit auch im minimierten Zustand weitergeschrieben wird.
 */
(function () {
  "use strict";

  function invoke(cmd, args) {
    var t = window.__TAURI__;
    if (t && t.core && typeof t.core.invoke === "function") {
      return t.core.invoke(cmd, args);
    }
    return Promise.resolve(null);
  }

  var count = 0; // kumulativ
  var lastCount = 0; // für Rate-Anzeige im Overlay

  // Wird von app.js bei jedem abgeschlossenen Detection-Callback aufgerufen.
  window.__nailguardSpike = {
    onDetection: function () {
      count++;
      invoke("spike_tick");
    },
  };

  function pushState() {
    invoke("spike_state", {
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
    });
  }

  document.addEventListener("visibilitychange", pushState);
  window.addEventListener("focus", pushState);
  window.addEventListener("blur", pushState);

  // Overlay aufbauen.
  function buildOverlay() {
    var box = document.createElement("div");
    box.id = "spike-overlay";
    box.style.cssText = [
      "position:fixed",
      "top:8px",
      "right:8px",
      "z-index:2147483647",
      "background:rgba(15,30,28,0.92)",
      "color:#eafdf6",
      "font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
      "padding:10px 12px",
      "border-radius:8px",
      "min-width:230px",
      "pointer-events:none",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
    ].join(";");
    box.innerHTML =
      '<b>TAURI-SPIKE</b><br>' +
      'Rate: <span id="sp-rate">0</span> /s<br>' +
      'Zeit: <span id="sp-time">0</span> s<br>' +
      'visibility: <span id="sp-vis">?</span><br>' +
      'hasFocus: <span id="sp-foc">?</span><br>' +
      'Log: <span id="sp-log" style="word-break:break-all;font-size:10px">…</span>';
    document.body.appendChild(box);

    invoke("spike_log_path").then(function (p) {
      if (p) {
        var el = document.getElementById("sp-log");
        if (el) el.textContent = p;
      }
    });
  }

  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    buildOverlay();
    pushState();

    var startMs = Date.now();
    // Anzeige + State-Push (best effort; im Vordergrund jede Sekunde).
    setInterval(function () {
      var rate = count - lastCount;
      lastCount = count;
      var elapsed = Math.round((Date.now() - startMs) / 1000);
      var set = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(val);
      };
      set("sp-rate", rate);
      set("sp-time", elapsed);
      set("sp-vis", document.visibilityState);
      set("sp-foc", document.hasFocus());
      pushState();
    }, 1000);
  });
})();
