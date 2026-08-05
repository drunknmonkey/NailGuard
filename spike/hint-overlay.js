/*
 * Rein visuelle, klickdurchlässige Mac-Hinweisschicht. Das native Fenster
 * schließt diese Schicht von Aufnahmen aus; hier wird nur eine kurze CSS-
 * Animation auf ein bereits erkanntes Tawel-Ereignis angewendet.
 */
(function () {
  "use strict";

  var overlay = document.getElementById("hintOverlay");
  var hideTimer = null;

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

  function show(style) {
    overlay.dataset.style = style === "wash" ? "wash" : "vignette";
    overlay.classList.remove("is-active");
    // Erlaubt einen vollständigen Neustart bei zwei raschen Treffern.
    void overlay.offsetWidth;
    overlay.classList.add("is-active");
    if (hideTimer) clearTimeout(hideTimer);
    // Fallback, falls WebKit bei einem Displaywechsel kein animationend meldet.
    hideTimer = setTimeout(hideWindow, 3200);
  }

  overlay.addEventListener("animationend", function (event) {
    if (event.target.classList.contains("hint-layer")) {
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
  window.__tawelHintOverlay = { show: show };
})();
