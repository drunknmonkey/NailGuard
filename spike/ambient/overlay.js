/*
 * Overlay-Fenster: lauscht auf den Zustand des Steuerfensters und übersetzt
 * ihn in CSS-Custom-Properties. Keine eigene Logik, kein requestAnimationFrame –
 * Easing (Signal) und Atmen (Glow) laufen rein über CSS und bleiben damit auch
 * dann flüssig, wenn macOS Hintergrund-Timer drosselt.
 */
(function () {
  "use strict";

  var root = document.getElementById("overlay");

  function ev() {
    return window.__TAURI__ && window.__TAURI__.event;
  }

  // Atemtempo folgt der Zustands-Maschine: ruhig → warm → ember.
  function breathDur(signal) {
    if (signal >= 0.67) return "1.6s";
    if (signal >= 0.34) return "2.6s";
    return "4.6s";
  }

  function apply(s) {
    if (!s) return;
    root.dataset.style = s.style === "wash" ? "wash" : "vignette";
    root.style.setProperty("--max-op", String(s.maxOpacity));
    root.style.setProperty("--breath-dur", breathDur(Number(s.signal)));
    // --signal zuletzt setzen: die CSS-Transition glättet den Übergang.
    root.style.setProperty("--signal", String(s.signal));
  }

  function whenTauri(cb) {
    if (ev()) return cb();
    var n = 0;
    var t = setInterval(function () {
      if (ev() || n++ > 100) {
        clearInterval(t);
        cb();
      }
    }, 50);
  }

  whenTauri(function () {
    var e = ev();
    if (!e) return;
    e.listen("ambient:state", function (msg) {
      apply(msg.payload);
    });
    // Handshake: meldet dem Steuerfenster, dass das Overlay bereit ist,
    // damit es seinen aktuellen Zustand (erneut) sendet.
    e.emit("ambient:hello", {});
  });
})();
