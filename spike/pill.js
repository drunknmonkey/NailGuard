/*
 * Pill-Modus (immer sichtbares Mini-Fenster).
 *
 * EIN Fenster, ein WebView: Kamera-Stream + rAF-Erkennung laufen über den
 * Moduswechsel hinweg unverändert weiter (wir bauen den Stream NICHT ab und
 * tauschen das WebView NICHT). Der Wechsel ändert nur CSS-Klasse + Fenster-
 * Eigenschaften (Größe, rahmenlos, immer oben) über kleine Rust-Commands.
 *
 * Der Ring spiegelt die bestehende Zustandsmaschine (body[data-state]); es wird
 * keine neue Erkennung gebaut.
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
    // Position regelmäßig sichern, solange die Pille aktiv ist (auch falls die
    // App im Pill-Modus geschlossen wird).
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

  function build() {
    var stage = document.createElement("div");
    stage.className = "pill-stage";
    stage.innerHTML =
      '<div class="pill-grip" data-tauri-drag-region title="Ziehen zum Verschieben">···</div>' +
      '<button class="pill-ring-btn" type="button" title="Zur vollen Ansicht" aria-label="Zur vollen Ansicht">' +
      '<span class="pill-halo"></span>' +
      '<span class="pill-ring"></span>' +
      '<span class="pill-ring inner"></span>' +
      "</button>";
    document.body.appendChild(stage);
    stage.querySelector(".pill-ring-btn").addEventListener("click", exitPill);

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
