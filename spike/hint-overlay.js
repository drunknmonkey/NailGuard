/*
 * Rein visuelle, klickdurchlässige Mac-Hinweisschicht. Das native Fenster
 * schließt diese Schicht von Aufnahmen aus; hier wird nur eine kurze CSS-
 * Animation auf ein bereits erkanntes Tawel-Ereignis angewendet.
 */
(function () {
  "use strict";

  var overlay = document.getElementById("hintOverlay");
  var hideTimer = null;
  var styles = [
    "lavender-vignette",
    "soft-focus",
    "desaturate",
    "ambient-glow",
    "wash-focus",
  ];

  function eventApi() {
    return window.__TAURI__ && window.__TAURI__.event;
  }

  function hideWindow() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    overlay.classList.remove("is-active");
    var core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === "function") {
      core.invoke("hide_visual_hint").catch(function () {});
    }
  }

  function normalizeConfig(value, intensity) {
    var style = typeof value === "object" && value ? value.style : value;
    var requestedIntensity = typeof value === "object" && value ? value.intensity : intensity;
    var normalizedIntensity = Math.round(Number(requestedIntensity));
    if (styles.indexOf(style) < 0) style = "lavender-vignette";
    if (!Number.isFinite(normalizedIntensity)) normalizedIntensity = 2;
    normalizedIntensity = Math.max(1, Math.min(3, normalizedIntensity));
    return { style: style, intensity: normalizedIntensity };
  }

  function show(value, intensity) {
    var config = normalizeConfig(value, intensity);
    overlay.dataset.style = config.style;
    overlay.dataset.intensity = String(config.intensity);
    overlay.classList.remove("is-active");
    // Erlaubt einen vollständigen Neustart bei zwei raschen Treffern.
    void overlay.offsetWidth;
    overlay.classList.add("is-active");
    if (hideTimer) clearTimeout(hideTimer);
    // Fallback, falls WebKit bei einem Displaywechsel kein animationend meldet.
    hideTimer = setTimeout(hideWindow, 3400);
  }

  overlay.addEventListener("animationend", function (event) {
    if (event.target.classList.contains("hint-terminal")) {
      hideWindow();
    }
  });

  function install(attempt) {
    var api = eventApi();
    if (api && typeof api.listen === "function") {
      api.listen("tawel:visual-hint", function (event) {
        show(event.payload);
      });
      return;
    }
    if (attempt < 40) {
      setTimeout(function () { install(attempt + 1); }, 50);
    }
  }

  install(0);

  // Kleine Testoberfläche für den DOM-Vertragstest, nicht für Produktcode.
  window.__tawelHintOverlay = { show: show, styles: styles.slice() };
})();
