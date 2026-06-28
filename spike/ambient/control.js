/*
 * Steuerfenster: erzeugt das 0–1-Test-Signal und sendet Stil, Max-Deckkraft
 * und Signal per Tauri-Event an das Overlay-Fenster. Bewusst ohne Kamera/
 * MediaPipe – der Spike soll beide Stile rein manuell fühlbar machen.
 */
(function () {
  "use strict";

  var STORE_KEY = "nailguard.ambient.spike.v1";

  var settings = loadSettings();
  var signal = 0;
  var pulseTimer = null;

  function loadSettings() {
    var def = { style: "vignette", maxOpacity: 0.18 };
    try {
      return Object.assign(def, JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
    } catch (_) {
      return def;
    }
  }
  function saveSettings() {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  }

  function ev() {
    return window.__TAURI__ && window.__TAURI__.event;
  }
  function emitState() {
    var e = ev();
    if (!e) return;
    e.emit("ambient:state", {
      style: settings.style,
      maxOpacity: settings.maxOpacity,
      signal: signal,
    });
  }

  var el = function (id) {
    return document.getElementById(id);
  };

  // --- Stil-Umschalter ----------------------------------------------------
  function setStyle(style) {
    settings.style = style === "wash" ? "wash" : "vignette";
    saveSettings();
    var buttons = el("styleSeg").querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute(
        "aria-pressed",
        buttons[i].dataset.style === settings.style ? "true" : "false",
      );
    }
    emitState();
  }

  // --- Signal / Puls ------------------------------------------------------
  function setSignal(value) {
    signal = Math.max(0, Math.min(1, value));
    el("signalVal").textContent = signal.toFixed(2);
    el("signal").value = String(signal);
    emitState();
  }

  function pulse() {
    if (pulseTimer) clearTimeout(pulseTimer);
    var resting = Number(el("signal").value);
    setSignal(1);
    el("signal").value = String(resting); // Regler zeigt weiter den Ruhewert
    pulseTimer = setTimeout(function () {
      setSignal(resting);
    }, 1400);
  }

  // --- Max-Deckkraft ------------------------------------------------------
  function setMaxOpacity(value) {
    settings.maxOpacity = Math.max(0, Math.min(0.6, value));
    saveSettings();
    el("maxopVal").textContent = Math.round(settings.maxOpacity * 100) + "%";
    el("maxop").value = String(settings.maxOpacity);
    emitState();
  }

  // --- „Bewegung reduzieren" spiegeln -------------------------------------
  function reflectReduceMotion() {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var update = function () {
      el("reduceDot").classList.toggle("on", mq.matches);
      el("reduceTxt").textContent =
        "Bewegung reduzieren: " + (mq.matches ? "aktiv (kein Easing/Atmen)" : "aus");
    };
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
  }

  function bind() {
    el("styleSeg").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-style]");
      if (btn) setStyle(btn.dataset.style);
    });
    el("signal").addEventListener("input", function (e) {
      setSignal(Number(e.target.value));
    });
    el("maxop").addEventListener("input", function (e) {
      setMaxOpacity(Number(e.target.value));
    });
    el("pulseBtn").addEventListener("click", pulse);

    window.addEventListener("keydown", function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        pulse();
      } else if (e.key === "1") {
        setStyle("vignette");
      } else if (e.key === "2") {
        setStyle("wash");
      }
    });
  }

  function init() {
    // UI aus gespeichertem Zustand herstellen.
    setStyle(settings.style);
    setMaxOpacity(settings.maxOpacity);
    setSignal(0);
    reflectReduceMotion();
    bind();

    // Overlay-Handshake: sobald es „hallo" sagt, Zustand (erneut) senden.
    var e = ev();
    if (e) e.listen("ambient:hello", emitState);
    emitState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
