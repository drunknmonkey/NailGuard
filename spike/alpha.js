/*
 * Mac-Alpha-Brücke. Diese Datei wird nur in den Tauri-Build kopiert und hält
 * die Produktions-Web-App unangetastet.
 *
 * Aufgaben:
 * - Menüleisten-Aktionen an die vorhandenen UI-Flüsse weiterreichen.
 * - Pause/Snooze so ergänzen, dass die Kamera dabei tatsächlich ruht.
 * - Snooze-Ende lokal speichern und automatisch fortsetzen.
 * - Einen nach Sleep/Wake stehen gebliebenen Kamerastream neu öffnen.
 * - Drei rein visuelle Mac-Hinweise auswählen, speichern und auslösen.
 * - Den bestehenden nativen Callback-Logger ohne sichtbares Debug-Overlay speisen.
 */
(function () {
  "use strict";

  var SNOOZE_KEY = "tawel.alpha.snooze-until.v1";
  var HINT_STYLE_KEY = "tawel.alpha.hint-style.v1";
  var HINT_STYLES = ["ring", "vignette", "wash"];
  var RING_HINT_MS = 2400;
  var WATCHDOG_STALL_MS = 12000;
  var WATCHDOG_COOLDOWN_MS = 15000;

  var startPanel = document.querySelector("#startPanel");
  var workspace = document.querySelector("#workspace");
  var startButton = document.querySelector("#startButton");
  var pauseButton = document.querySelector("#pauseButton");
  var cameraSelect = document.querySelector("#cameraSelect");
  var video = document.querySelector("#video");
  var settingsTab = document.querySelector('.mode-tab[data-mode="calibration"]');
  var focusTab = document.querySelector('.mode-tab[data-mode="focus"]');

  var previousRunning = false;
  var previousPaused = false;
  var prestartSettings = false;
  var snoozeUntil = readSnooze();
  var hintStyle = readHintStyle();
  var ringHintTimer = null;
  var lastVideoTime = -1;
  var lastProgressAt = Date.now();
  var restartBlockedUntil = 0;
  var syncQueued = false;

  function invoke(cmd, args) {
    var t = window.__TAURI__;
    if (t && t.core && typeof t.core.invoke === "function") {
      return t.core.invoke(cmd, args);
    }
    return Promise.resolve(null);
  }

  function isRunning() {
    return Boolean(
      startPanel && startPanel.hidden &&
      workspace && !workspace.hidden &&
      !prestartSettings
    );
  }

  function isPaused() {
    return Boolean(pauseButton && pauseButton.classList.contains("paused"));
  }

  function readSnooze() {
    var value = Number(localStorage.getItem(SNOOZE_KEY));
    if (Number.isFinite(value) && value > Date.now()) return value;
    localStorage.removeItem(SNOOZE_KEY);
    return null;
  }

  function readHintStyle() {
    var value = localStorage.getItem(HINT_STYLE_KEY);
    return HINT_STYLES.indexOf(value) >= 0 ? value : "ring";
  }

  function syncHintStyle() {
    invoke("alpha_hint_style", { style: hintStyle }).catch(function () {});
  }

  function pulseRing() {
    if (ringHintTimer) clearTimeout(ringHintTimer);
    document.body.classList.remove("alpha-ring-hint");
    // Neustart der CSS-Animation auch bei zwei rasch aufeinanderfolgenden
    // Hinweisen. Das Layout wird nur für die kleine Pill-Schicht gelesen.
    void document.body.offsetWidth;
    document.body.classList.add("alpha-ring-hint");
    ringHintTimer = setTimeout(function () {
      document.body.classList.remove("alpha-ring-hint");
      ringHintTimer = null;
    }, RING_HINT_MS);
  }

  function showVisualHint() {
    if (hintStyle === "ring") {
      pulseRing();
      return;
    }
    invoke("show_visual_hint", { style: hintStyle }).catch(function () {});
  }

  function setHintStyle(style, preview) {
    if (HINT_STYLES.indexOf(style) < 0) return;
    hintStyle = style;
    localStorage.setItem(HINT_STYLE_KEY, style);
    syncHintStyle();
    if (preview) showVisualHint();
  }

  function saveSnooze(until) {
    snoozeUntil = until;
    if (until) localStorage.setItem(SNOOZE_KEY, String(until));
    else localStorage.removeItem(SNOOZE_KEY);
  }

  function activeSnooze() {
    return snoozeUntil && snoozeUntil > Date.now() ? snoozeUntil : null;
  }

  function stopCameraForPause() {
    var stream = video && video.srcObject;
    if (!stream || typeof stream.getTracks !== "function") return;
    stream.getTracks().forEach(function (track) {
      track.stop();
    });
    if (typeof video.pause === "function") video.pause();
  }

  function cameraHasLiveTrack() {
    var stream = video && video.srcObject;
    return Boolean(
      stream &&
      typeof stream.getVideoTracks === "function" &&
      stream.getVideoTracks().some(function (track) {
        return track.readyState === "live";
      })
    );
  }

  function requestCameraRestart() {
    var now = Date.now();
    if (!cameraSelect || now < restartBlockedUntil || !isRunning() || isPaused()) return;
    restartBlockedUntil = now + WATCHDOG_COOLDOWN_MS;
    lastProgressAt = now;
    cameraSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncNativeState() {
    syncQueued = false;
    var running = isRunning();
    var paused = isPaused();
    var until = activeSnooze();

    // Ein aktiver Snooze gewinnt auch nach Sleep oder App-Neustart. Sobald der
    // reguläre Startfluss fertig ist, wird über dessen bestehenden Pause-Knopf
    // pausiert; dadurch bleibt die Zustandsmaschine der Web-App die Wahrheit.
    if (running && until && !paused && pauseButton) {
      pauseButton.click();
      return;
    }

    if (running && !previousRunning) {
      lastVideoTime = video.currentTime;
      lastProgressAt = Date.now();
    }
    if (running && paused && (!previousRunning || !previousPaused)) {
      stopCameraForPause();
    }
    if (running && !paused && previousRunning && previousPaused && !cameraHasLiveTrack()) {
      requestCameraRestart();
    }

    previousRunning = running;
    previousPaused = paused;
    invoke("alpha_status", {
      running: running,
      paused: paused,
      snoozeUntil: until,
    }).catch(function () {});
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    setTimeout(syncNativeState, 0);
  }

  function clearSnooze(resume) {
    var hadSnooze = Boolean(activeSnooze());
    saveSnooze(null);
    if (resume && hadSnooze && isRunning() && isPaused() && pauseButton) {
      pauseButton.click();
    }
    queueSync();
  }

  function setSnooze(minutes) {
    if (!isRunning()) return;
    saveSnooze(Date.now() + minutes * 60 * 1000);
    if (!isPaused() && pauseButton) pauseButton.click();
    queueSync();
  }

  function finishExpiredSnooze() {
    if (!snoozeUntil || snoozeUntil > Date.now()) return;
    var shouldResume = isRunning() && isPaused();
    saveSnooze(null);
    if (shouldResume && pauseButton) pauseButton.click();
    queueSync();
  }

  function leavePill() {
    var pill = window.__tawelPill;
    if (pill && typeof pill.exit === "function") return Promise.resolve(pill.exit());
    return Promise.resolve();
  }

  function showStart() {
    if (!prestartSettings) return;
    prestartSettings = false;
    document.body.classList.remove("alpha-settings-before-start");
    if (workspace) workspace.hidden = true;
    if (startPanel) startPanel.hidden = false;
    if (focusTab) focusTab.click();
    queueSync();
  }

  function openSettings() {
    leavePill().then(function () {
      if (!isRunning()) {
        prestartSettings = true;
        document.body.classList.add("alpha-settings-before-start");
        if (startPanel) startPanel.hidden = true;
        if (workspace) workspace.hidden = false;
      }
      if (settingsTab) settingsTab.click();
      queueSync();
    });
  }

  function startOrResume() {
    clearSnooze(false);
    if (prestartSettings) showStart();
    if (isRunning()) {
      if (isPaused() && pauseButton) pauseButton.click();
    } else if (startButton) {
      startButton.click();
    }
  }

  function togglePause() {
    if (!isRunning() || !pauseButton) return;
    clearSnooze(false);
    pauseButton.click();
  }

  function handleControl(action) {
    switch (action) {
      case "open":
        leavePill();
        break;
      case "start":
        leavePill().then(startOrResume);
        break;
      case "toggle_pause":
        togglePause();
        break;
      case "snooze_15":
        setSnooze(15);
        break;
      case "snooze_30":
        setSnooze(30);
        break;
      case "snooze_60":
        setSnooze(60);
        break;
      case "settings":
        openSettings();
        break;
      case "hint_ring":
        setHintStyle("ring", true);
        break;
      case "hint_vignette":
        setHintStyle("vignette", true);
        break;
      case "hint_wash":
        setHintStyle("wash", true);
        break;
      case "hint_preview":
        showVisualHint();
        break;
      case "dock":
        if (isRunning() && window.__tawelPill) window.__tawelPill.enter();
        break;
      default:
        break;
    }
  }

  function installControlListener(attempt) {
    var eventApi = window.__TAURI__ && window.__TAURI__.event;
    if (eventApi && typeof eventApi.listen === "function") {
      eventApi.listen("tawel:control", function (event) {
        handleControl(event.payload);
      });
    } else if (attempt < 20) {
      setTimeout(function () { installControlListener(attempt + 1); }, 100);
    }
  }

  function watchdogTick() {
    finishExpiredSnooze();
    syncNativeState();

    if (!isRunning() || isPaused() || document.visibilityState !== "visible") return;
    var now = Date.now();
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      lastProgressAt = now;
      return;
    }
    if (!cameraHasLiveTrack() || now - lastProgressAt >= WATCHDOG_STALL_MS) {
      requestCameraRestart();
    }
  }

  function buildPrestartBackButton() {
    var button = document.createElement("button");
    button.className = "alpha-prestart-back";
    button.type = "button";
    button.textContent = "Zurück zum Start";
    button.addEventListener("click", showStart);
    document.body.appendChild(button);
  }

  // Bestehender, bewusst unsichtbarer Diagnose-Hook.
  window.__nailguardSpike = {
    onDetection: function () {
      invoke("spike_tick");
    },
  };

  function pushDiagnosticState() {
    invoke("spike_state", {
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
    });
  }

  document.body.classList.add("tawel-alpha");
  buildPrestartBackButton();
  installControlListener(0);

  // Ein bewusster Klick während eines Snooze beendet dessen Auto-Fortsetzen.
  if (pauseButton) {
    pauseButton.addEventListener("click", function (event) {
      if (event.isTrusted && activeSnooze()) clearSnooze(false);
    }, true);
  }

  var observer = new MutationObserver(queueSync);
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "data-state", "data-view"],
  });

  document.addEventListener("visibilitychange", function () {
    pushDiagnosticState();
    queueSync();
  });
  window.addEventListener("focus", pushDiagnosticState);
  window.addEventListener("blur", pushDiagnosticState);
  window.addEventListener("nailguard:intervention", showVisualHint);

  // Office Mode gehört laut Produktentscheidung nur in den Browser. Falls ein
  // importierter/synchroner Einstellungswert ihn aktiviert, zurück zu Fokus.
  setTimeout(function () {
    if (document.body.dataset.view === "office" && focusTab) focusTab.click();
    queueSync();
  }, 0);

  setInterval(watchdogTick, 1000);
  pushDiagnosticState();
  syncHintStyle();
  queueSync();

  // Kleine Test-/Diagnoseoberfläche ohne Zugriff auf interne Web-App-Variablen.
  window.__tawelAlpha = {
    handleControl: handleControl,
    isRunning: isRunning,
    isPaused: isPaused,
    hintStyle: function () { return hintStyle; },
  };
})();
