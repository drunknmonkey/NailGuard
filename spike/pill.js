/*
 * Pill-Modus, Variante A „Reiner Ring".
 *
 * EIN Fenster, ein WebView: Kamera-Stream + rAF-Erkennung laufen über den
 * Moduswechsel hinweg unverändert weiter. Der Wechsel ändert nur die CSS-Klasse
 * body.pill-mode und – über kleine Rust-Commands – die Fenster-Eigenschaften.
 *
 * Bedienung im Pill-Modus:
 *  - Ziehen am Ring verschiebt das Fenster (startDragging beim ersten Move).
 *  - Klick auf den Ring (ohne Ziehen) öffnet den Voll-Modus.
 *  - Beim Drüberfahren erscheinen zwei kleine Symbole: vergrößern / schließen.
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
  function currentWindow() {
    var w = window.__TAURI__ && window.__TAURI__.window;
    return w && w.getCurrentWindow ? w.getCurrentWindow() : null;
  }

  var POS_KEY = "nailguard.pill.pos.v1";
  var saveTimer = null;

  function savedPos() {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY) || "null");
    } catch (_) {
      return null;
    }
  }
  function storePos(arr) {
    if (arr && arr.length === 2) {
      localStorage.setItem(POS_KEY, JSON.stringify({ x: arr[0], y: arr[1] }));
    }
  }

  async function enterPill() {
    var p = savedPos();
    document.body.classList.add("pill-mode");
    await invoke("enter_pill", { x: p ? p.x : null, y: p ? p.y : null });
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(function () {
      invoke("pill_position").then(storePos).catch(function () {});
    }, 2000);
  }

  async function exitPill() {
    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = null;
    }
    try {
      storePos(await invoke("exit_pill"));
    } catch (_) {
      /* trotzdem zurückschalten */
    }
    document.body.classList.remove("pill-mode");
  }

  function wireDrag(wrap) {
    var down = false,
      moved = false,
      sx = 0,
      sy = 0;
    wrap.addEventListener("mousedown", function (e) {
      if (e.button !== 0 || e.target.closest(".pill-btn")) return;
      down = true;
      moved = false;
      sx = e.screenX;
      sy = e.screenY;
    });
    wrap.addEventListener("mousemove", function (e) {
      if (!down || moved) return;
      if (Math.abs(e.screenX - sx) > 3 || Math.abs(e.screenY - sy) > 3) {
        moved = true;
        var w = currentWindow();
        if (w && w.startDragging) w.startDragging().catch(function () {});
      }
    });
    window.addEventListener("mouseup", function () {
      if (down && !moved) exitPill();
      down = false;
    });
  }

  function build() {
    var stage = document.createElement("div");
    stage.className = "pill-stage";
    stage.innerHTML =
      '<div class="pill-ring-wrap" title="Ziehen zum Verschieben · Klick öffnet">' +
      '<div class="pill-ring"></div>' +
      '<div class="pill-core"></div>' +
      '<div class="pill-controls">' +
      '<button class="pill-btn pill-expand" type="button" title="Vergrößern" aria-label="Vergrößern">⤢</button>' +
      '<button class="pill-btn pill-close" type="button" title="NailGuard schließen" aria-label="Schließen">✕</button>' +
      "</div></div>";
    document.body.appendChild(stage);

    var wrap = stage.querySelector(".pill-ring-wrap");
    wireDrag(wrap);
    stage.querySelector(".pill-expand").addEventListener("click", exitPill);
    stage.querySelector(".pill-close").addEventListener("click", function () {
      invoke("close_app");
    });

    var enter = document.createElement("button");
    enter.className = "pill-enter-btn";
    enter.type = "button";
    enter.textContent = "Als Pille andocken";
    enter.addEventListener("click", enterPill);
    document.body.appendChild(enter);
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
