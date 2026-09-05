/*
 * Mac-Alpha-Brücke. Diese Datei wird nur in den Tauri-Build kopiert und hält
 * die Produktions-Web-App unangetastet.
 *
 * Aufgaben:
 * - Menüleisten-Aktionen an die vorhandenen UI-Flüsse weiterreichen.
 * - Pause/Snooze so ergänzen, dass die Kamera dabei tatsächlich ruht.
 * - Snooze-Ende lokal speichern und automatisch fortsetzen.
 * - Einen nach Sleep/Wake stehen gebliebenen Kamerastream neu öffnen.
 * - Fünf rein visuelle Mac-Hinweise samt grober Intensität auswählen,
 *   speichern, in den Einstellungen bearbeiten und auslösen.
 * - Den bestehenden nativen Callback-Logger ohne sichtbares Debug-Overlay speisen.
 */
(function () {
  "use strict";

  var SNOOZE_KEY = "tawel.alpha.snooze-until.v1";
  var HINT_STYLE_KEY = "tawel.alpha.hint-style.v1";
  var HINT_INTENSITY_KEY = "tawel.alpha.hint-intensity.v1";
  var HINT_STYLES = [
    "lavender-vignette",
    "soft-focus",
    "desaturate",
    "ambient-glow",
    "wash-focus",
  ];
  var HINT_STYLE_ALIASES = {
    ring: "lavender-vignette",
    vignette: "lavender-vignette",
    wash: "ambient-glow",
  };
  var HINT_COPY = {
    de: {
      group: "Visueller Hinweis",
      styleName: "Variante",
      styleDesc: "Fünf ruhige Wahrnehmungsimpulse für den Mac-Test",
      intensityName: "Intensität",
      intensityDesc: "Drei grobe Stufen zum schnellen Vergleichen",
      light: "Leicht",
      medium: "Mittel",
      strong: "Deutlich",
      preview: "Probe-Hinweis anzeigen",
      styles: {
        "lavender-vignette": "A · Lavendel-Vignette",
        "soft-focus": "B · Sanfter Fokusverlust",
        desaturate: "C · Kurze Entsättigung",
        "ambient-glow": "D · Ambient Glow",
        "wash-focus": "E · Farbhauch → Fokusverlust",
      },
    },
    en: {
      group: "Visual cue",
      styleName: "Variant",
      styleDesc: "Five calm perception cues for the Mac test",
      intensityName: "Intensity",
      intensityDesc: "Three broad levels for quick comparison",
      light: "Light",
      medium: "Medium",
      strong: "Noticeable",
      preview: "Show sample cue",
      styles: {
        "lavender-vignette": "A · Lavender vignette",
        "soft-focus": "B · Gentle focus shift",
        desaturate: "C · Brief desaturation",
        "ambient-glow": "D · Ambient glow",
        "wash-focus": "E · Color wash → focus shift",
      },
    },
  };
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
  var settingsCuesTitle = document.querySelector("#settings-cues-title");

  var previousRunning = false;
  var previousPaused = false;
  var prestartSettings = false;
  var snoozeUntil = readSnooze();
  var hintStyle = readHintStyle();
  var hintIntensity = readHintIntensity();
  var hintStyleSelect = null;
  var hintIntensityInput = null;
  var hintIntensityValue = null;
  var hintSettingsCopy = {};
  var lastVideoTime = -1;
  var lastWatchdogAt = Date.now();
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
    var migrated = HINT_STYLE_ALIASES[value] || value;
    if (HINT_STYLES.indexOf(migrated) < 0) migrated = "lavender-vignette";
    if (migrated !== value) localStorage.setItem(HINT_STYLE_KEY, migrated);
    return migrated;
  }

  function readHintIntensity() {
    var value = Math.round(Number(localStorage.getItem(HINT_INTENSITY_KEY)));
    return Number.isFinite(value) && value >= 1 && value <= 3 ? value : 2;
  }

  function currentHintCopy() {
    return document.documentElement.lang === "en" ? HINT_COPY.en : HINT_COPY.de;
  }

  function intensityLabel() {
    var copy = currentHintCopy();
    return hintIntensity === 1 ? copy.light : hintIntensity === 3 ? copy.strong : copy.medium;
  }

  function syncHintConfig() {
    invoke("alpha_hint_style", {
      style: hintStyle,
      intensity: hintIntensity,
    }).catch(function () {});
  }

  function updateHintControls() {
    if (hintStyleSelect) hintStyleSelect.value = hintStyle;
    if (hintIntensityInput) {
      hintIntensityInput.value = String(hintIntensity);
      hintIntensityInput.dataset.position = String(hintIntensity);
    }
    if (hintIntensityValue) hintIntensityValue.textContent = intensityLabel();
  }

  function showVisualHint() {
    invoke("show_visual_hint", {
      style: hintStyle,
      intensity: hintIntensity,
    }).catch(function () {});
  }

  function setHintStyle(style, preview) {
    if (HINT_STYLES.indexOf(style) < 0) return;
    hintStyle = style;
    localStorage.setItem(HINT_STYLE_KEY, style);
    updateHintControls();
    syncHintConfig();
    if (preview) showVisualHint();
  }

  function setHintIntensity(value, preview) {
    var next = Math.max(1, Math.min(3, Math.round(Number(value)) || 2));
    hintIntensity = next;
    localStorage.setItem(HINT_INTENSITY_KEY, String(next));
    updateHintControls();
    syncHintConfig();
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
    if (window.__tawelDiagnostic) window.__tawelDiagnostic.restart();
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
      case "hint_lavender_vignette":
      case "hint_vignette":
        setHintStyle("lavender-vignette", true);
        break;
      case "hint_soft_focus":
        setHintStyle("soft-focus", true);
        break;
      case "hint_desaturate":
        setHintStyle("desaturate", true);
        break;
      case "hint_ambient_glow":
      case "hint_wash":
        setHintStyle("ambient-glow", true);
        break;
      case "hint_wash_focus":
        setHintStyle("wash-focus", true);
        break;
      case "hint_preview":
        showVisualHint();
        break;
      case "background":
        invoke("background_app").catch(function () {});
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
    if (window.__tawelDiagnostic) window.__tawelDiagnostic.watchdog();
    finishExpiredSnooze();
    syncNativeState();

    var now = Date.now();
    // Nach echtem Systemschlaf erst neue Frames abwarten, nicht sofort neu öffnen.
    if (now - lastWatchdogAt > 5000) lastProgressAt = now;
    lastWatchdogAt = now;
    if (!isRunning() || isPaused()) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      lastProgressAt = now;
      return;
    }
    if (!cameraHasLiveTrack() || now - lastProgressAt >= WATCHDOG_STALL_MS) {
      requestCameraRestart();
    }
  }

  function appendText(parent, tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function buildHintSettings() {
    var cuesGroup = settingsCuesTitle && settingsCuesTitle.parentElement;
    if (!cuesGroup || !cuesGroup.insertAdjacentElement) return;

    var section = document.createElement("section");
    section.id = "alphaHintSettings";
    section.className = "settings-group alpha-hint-settings";
    section.setAttribute("aria-labelledby", "alpha-hint-settings-title");

    hintSettingsCopy.group = appendText(section, "h3", "settings-group-title", "");
    hintSettingsCopy.group.id = "alpha-hint-settings-title";

    var card = document.createElement("div");
    card.className = "settings-card";
    section.appendChild(card);

    var styleRow = document.createElement("div");
    styleRow.className = "set-row";
    card.appendChild(styleRow);
    var styleText = document.createElement("div");
    styleText.className = "txt";
    styleRow.appendChild(styleText);
    hintSettingsCopy.styleName = appendText(styleText, "div", "name", "");
    hintSettingsCopy.styleDesc = appendText(styleText, "div", "desc", "");

    var styleControl = document.createElement("div");
    styleControl.className = "set-control alpha-hint-style-control";
    styleRow.appendChild(styleControl);
    hintStyleSelect = document.createElement("select");
    hintStyleSelect.id = "alphaHintStyle";
    styleControl.appendChild(hintStyleSelect);
    hintSettingsCopy.options = {};
    HINT_STYLES.forEach(function (style) {
      var option = document.createElement("option");
      option.value = style;
      hintStyleSelect.appendChild(option);
      hintSettingsCopy.options[style] = option;
    });

    var intensityRow = document.createElement("div");
    intensityRow.className = "set-row alpha-hint-intensity-row";
    card.appendChild(intensityRow);
    var intensityText = document.createElement("div");
    intensityText.className = "txt";
    intensityRow.appendChild(intensityText);
    hintSettingsCopy.intensityName = appendText(intensityText, "div", "name", "");
    hintSettingsCopy.intensityDesc = appendText(intensityText, "div", "desc", "");

    var intensityControl = document.createElement("div");
    intensityControl.className = "alpha-hint-intensity-control";
    intensityRow.appendChild(intensityControl);
    hintIntensityInput = document.createElement("input");
    hintIntensityInput.id = "alphaHintIntensity";
    hintIntensityInput.type = "range";
    hintIntensityInput.min = "1";
    hintIntensityInput.max = "3";
    hintIntensityInput.step = "1";
    intensityControl.appendChild(hintIntensityInput);

    var scale = document.createElement("div");
    scale.className = "alpha-hint-intensity-scale";
    intensityControl.appendChild(scale);
    hintSettingsCopy.light = appendText(scale, "span", "", "");
    hintIntensityValue = appendText(scale, "output", "", "");
    hintSettingsCopy.strong = appendText(scale, "span", "", "");

    var actions = document.createElement("div");
    actions.className = "settings-actions alpha-hint-actions";
    card.appendChild(actions);
    hintSettingsCopy.preview = document.createElement("button");
    hintSettingsCopy.preview.className = "mini-action";
    hintSettingsCopy.preview.type = "button";
    hintSettingsCopy.preview.id = "alphaHintPreview";
    actions.appendChild(hintSettingsCopy.preview);

    cuesGroup.insertAdjacentElement("afterend", section);

    hintStyleSelect.addEventListener("change", function () {
      setHintStyle(hintStyleSelect.value, true);
    });
    hintIntensityInput.addEventListener("input", function () {
      setHintIntensity(hintIntensityInput.value, false);
    });
    hintIntensityInput.addEventListener("change", function () {
      setHintIntensity(hintIntensityInput.value, true);
    });
    hintSettingsCopy.preview.addEventListener("click", showVisualHint);

    Array.prototype.forEach.call(document.querySelectorAll(".lang-option"), function (button) {
      button.addEventListener("click", function () {
        setTimeout(renderHintSettingsCopy, 0);
      });
    });

    renderHintSettingsCopy();
    updateHintControls();
    // app.js läuft als ES-Modul nach dieser klassischen Injektion und setzt
    // erst dann eine eventuell gespeicherte Sprache. Ein zweiter Render im
    // nächsten Task übernimmt diesen Initialwert ohne die Web-App anzufassen.
    setTimeout(renderHintSettingsCopy, 0);
  }

  function renderHintSettingsCopy() {
    if (!hintSettingsCopy.group) return;
    var copy = currentHintCopy();
    hintSettingsCopy.group.textContent = copy.group;
    hintSettingsCopy.styleName.textContent = copy.styleName;
    hintSettingsCopy.styleDesc.textContent = copy.styleDesc;
    hintSettingsCopy.intensityName.textContent = copy.intensityName;
    hintSettingsCopy.intensityDesc.textContent = copy.intensityDesc;
    hintSettingsCopy.light.textContent = copy.light;
    hintSettingsCopy.strong.textContent = copy.strong;
    hintSettingsCopy.preview.textContent = copy.preview;
    hintStyleSelect.setAttribute("aria-label", copy.styleName);
    hintIntensityInput.setAttribute("aria-label", copy.intensityName);
    HINT_STYLES.forEach(function (style) {
      hintSettingsCopy.options[style].textContent = copy.styles[style];
    });
    updateHintControls();
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
  buildHintSettings();
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
  syncHintConfig();
  queueSync();

  // Kleine Test-/Diagnoseoberfläche ohne Zugriff auf interne Web-App-Variablen.
  window.__tawelAlpha = {
    handleControl: handleControl,
    isRunning: isRunning,
    isPaused: isPaused,
    hintStyle: function () { return hintStyle; },
    hintIntensity: function () { return hintIntensity; },
    showVisualHint: showVisualHint,
  };
})();
