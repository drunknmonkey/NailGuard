import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
} from "./vendor/mediapipe/tasks-vision/vision_bundle.mjs";
import { applyStaticTranslations, dateLocale, getLocale, setLocale, t } from "./i18n.js";

// MediaPipe wird vollständig self-hosted ausgeliefert (vendor/ + models/),
// es werden keine externen CDNs mehr angefragt.
const MEDIAPIPE = {
  wasmBaseUrl: "./vendor/mediapipe/tasks-vision/wasm",
  faceModelUrl: "./models/face_landmarker.task",
  handModelUrl: "./models/hand_landmarker.task",
};

const STORAGE_KEY = "nail-guard.daily-stats.v1";
const SETTINGS_KEY = "nail-guard.settings.v1";
const NEUTRAL_NOTES_KEY = "nail-guard.neutral-notes.v1";
const ONBOARDING_KEY = "nail-guard.onboarding.v1";
const OFFICE_HINT_KEY = "nail-guard.office-hint.v1";
const LOCALE_KEY = "nail-guard.locale.v1";

// Alle Keys, die Export/Import berücksichtigen. Fremde Keys in einer
// Backup-Datei werden beim Import ignoriert.
const BACKUP_KEYS = [STORAGE_KEY, SETTINGS_KEY, NEUTRAL_NOTES_KEY, ONBOARDING_KEY, LOCALE_KEY];
// Diese Keys müssen gültiges JSON enthalten; die übrigen sind Klartext.
const JSON_BACKUP_KEYS = new Set([STORAGE_KEY, SETTINGS_KEY]);

// Guided calibration: how close (normalized) counts as "at the mouth",
// how long signals must hold, and how the personal threshold is derived.
const ONBOARDING = {
  nearDistance: 0.12,
  signalStableMs: 800,
  touchHoldMs: 1000,
  thresholdFactor: 1.35,
  thresholdMin: 0.045,
  thresholdMax: 0.13,
};
const MOUTH_INDICES = [13, 14, 61, 291];
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];
// Sparse Abtastpunkte über das ganze Gesicht (Stirn, Wangen, Kinn,
// Gesichtsränder, Nase) für den Schalter „Gesichtsberührung melden".
const FACE_TOUCH_INDICES = [10, 67, 297, 50, 280, 205, 425, 152, 234, 454, 1, 168];
const SOUND_PRESETS = {
  bubblePop: { notes: [[420, 0, 0.08, "sine"], [760, 0.07, 0.12, "sine"]] },
  doubleTap: { notes: [[240, 0, 0.08, "sine"], [240, 0.14, 0.08, "sine"]] },
  breathBell: { notes: [[392, 0, 0.22, "triangle"], [494, 0.26, 0.28, "triangle"], [587, 0.56, 0.34, "triangle"]] },
  tinyRobot: { notes: [[660, 0, 0.07, "square"], [520, 0.09, 0.07, "square"], [780, 0.18, 0.09, "square"]] },
  boing: { notes: [[260, 0, 0.16, "sawtooth"], [180, 0.1, 0.22, "sine"]] },
};
const CALIBRATION_PRESETS = {
  soft: { distanceThreshold: 0.075, holdSeconds: 3, cooldownSeconds: 25 },
  normal: { distanceThreshold: 0.09, holdSeconds: 2, cooldownSeconds: 15 },
  precise: { distanceThreshold: 0.115, holdSeconds: 1.2, cooldownSeconds: 10 },
};

const els = {
  startPanel: document.querySelector("#startPanel"),
  workspace: document.querySelector("#workspace"),
  startButton: document.querySelector("#startButton"),
  appTitle: document.querySelector("#appTitle"),
  startTitle: document.querySelector("#startTitle"),
  startBody: document.querySelector("#startBody"),
  startPrivacyNote: document.querySelector("#startPrivacyNote"),
  stateWord: document.querySelector("#stateWord"),
  stateHint: document.querySelector("#stateHint"),
  errorMessage: document.querySelector("#errorMessage"),
  errorText: document.querySelector("#errorText"),
  errorHints: document.querySelector("#errorHints"),
  modeTabs: [...document.querySelectorAll(".mode-tab")],
  modeLinks: [...document.querySelectorAll("[data-mode-link]")],
  officeExits: [...document.querySelectorAll(".office-exit")],
  modeViews: [...document.querySelectorAll(".mode-view")],
  focusStreak: document.querySelector("#focusStreak"),
  focusConfirmed: document.querySelector("#focusConfirmed"),
  pauseButton: document.querySelector("#pauseButton"),
  video: document.querySelector("#video"),
  overlay: document.querySelector("#overlay"),
  warmOverlay: document.querySelector("#warmOverlay"),
  proximityBar: document.querySelector("#proximityBar"),
  faceSignal: document.querySelector("#faceSignal"),
  handSignal: document.querySelector("#handSignal"),
  nearSignal: document.querySelector("#nearSignal"),
  distanceSignal: document.querySelector("#distanceSignal"),
  distanceThreshold: document.querySelector("#distanceThreshold"),
  holdSeconds: document.querySelector("#holdSeconds"),
  cooldownSeconds: document.querySelector("#cooldownSeconds"),
  distanceValue: document.querySelector("#distanceValue"),
  holdValue: document.querySelector("#holdValue"),
  cooldownValue: document.querySelector("#cooldownValue"),
  overlayToggle: document.querySelector("#overlayToggle"),
  warmthToggle: document.querySelector("#warmthToggle"),
  soundToggle: document.querySelector("#soundToggle"),
  soundPreset: document.querySelector("#soundPreset"),
  soundVolume: document.querySelector("#soundVolume"),
  volumeValue: document.querySelector("#volumeValue"),
  testSoundButton: document.querySelector("#testSoundButton"),
  testWarningButton: document.querySelector("#testWarningButton"),
  presetButtons: [...document.querySelectorAll(".preset-button")],
  vibrationToggle: document.querySelector("#vibrationToggle"),
  faceTouchToggle: document.querySelector("#faceTouchToggle"),
  officeDotToggle: document.querySelector("#officeDotToggle"),
  alertPanel: document.querySelector("#alertPanel"),
  alertReplacement: document.querySelector("#alertReplacement"),
  resetStatsButton: document.querySelector("#resetStatsButton"),
  exportDataButton: document.querySelector("#exportDataButton"),
  importDataButton: document.querySelector("#importDataButton"),
  importDataInput: document.querySelector("#importDataInput"),
  reviewDate: document.querySelector("#reviewDate"),
  reviewSummary: document.querySelector("#reviewSummary"),
  statLongest: document.querySelector("#statLongest"),
  quietDelta: document.querySelector("#quietDelta"),
  hourBars: document.querySelector("#hourBars"),
  hourLabels: document.querySelector("#hourLabels"),
  streakDays: document.querySelector("#streakDays"),
  streakText: document.querySelector("#streakText"),
  neutralSubtleToggle: document.querySelector("#neutralSubtleToggle"),
  neutralNotes: document.querySelector("#neutralNotes"),
  editorWordCount: document.querySelector("#editorWordCount"),
  neutralIntervention: document.querySelector("#neutralIntervention"),
  neutralInterventionTitle: document.querySelector("#neutralInterventionTitle"),
  neutralInterventionText: document.querySelector("#neutralInterventionText"),
  langButtons: [...document.querySelectorAll(".lang-option")],
  onboardingPanel: document.querySelector("#onboardingPanel"),
  onboardingTitle: document.querySelector("#onboardingTitle"),
  onboardingBody: document.querySelector("#onboardingBody"),
  onboardingSignal: document.querySelector("#onboardingSignal"),
  onboardingDots: [...document.querySelectorAll("#onboardingProgress .dot")],
  onboardingSkipButton: document.querySelector("#onboardingSkipButton"),
  onboardingFinishButton: document.querySelector("#onboardingFinishButton"),
  recalibrateButton: document.querySelector("#recalibrateButton"),
  cameraSelect: document.querySelector("#cameraSelect"),
};

const state = {
  faceLandmarker: null,
  handLandmarker: null,
  stream: null,
  running: false,
  paused: false,
  lastVideoTime: -1,
  nearSince: null,
  lastAlertAt: 0,
  alertOpen: false,
  activeMode: "focus",
  mouthCenter: null,
  fingertips: [],
  minDistance: Number.POSITIVE_INFINITY,
  settings: loadSettings(),
  stats: loadStats(),
  neutralInterventionTimer: null,
  browserInterventionTimer: null,
  appState: "calm",
  handNear: false,
  onboarding: null,
};

// ═══ Ring-Atem: Tempo-Rampen über die Web Animations API ═══
// CSS kann animation-duration nicht interpolieren: beim Zustandswechsel
// (4.6s → 2.6s → 1.6s) springt der Ring hart ins neue Tempo. Deshalb führt
// app.js die Atem-Animation als WAAPI-Objekt und gleitet die Geschwindigkeit
// über playbackRate ans Ziel – die Atem-Phase bleibt dabei erhalten (kein
// Reset auf Phase 0). paused atmet aus in den Stillstand (Rate 0) statt
// einzufrieren und atmet beim Fortsetzen sanft wieder an.
// Ohne WAAPI oder bei „Bewegung reduzieren" bleibt der CSS-Pfad aktiv.
const RING_BREATH = {
  baseMs: 4600, // = --breath-dur im Ruhezustand
  rampMs: 2000, // Dauer des Tempo-Übergangs
  rates: { calm: 1, warm: 4.6 / 2.6, ember: 4.6 / 1.6, paused: 0 },
};

const ringBreath = {
  animations: [],
  rampId: null,
  rate: 1,

  init() {
    const stage = document.querySelector(".focus-view .stage");
    if (!stage || typeof stage.animate !== "function") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener?.("change", () => this.toggle(!media.matches));
    if (!media.matches) this.toggle(true);
  },

  toggle(enabled) {
    if (!enabled) {
      window.cancelAnimationFrame(this.rampId);
      for (const animation of this.animations) animation.cancel();
      this.animations = [];
      this.rate = 1;
      document.body.classList.remove("ring-waapi");
      return;
    }
    if (this.animations.length) return;

    const keyframes = [
      { transform: "scale(0.965)", easing: "cubic-bezier(0.37, 0, 0.63, 1)" },
      { transform: "scale(1.035)", easing: "cubic-bezier(0.37, 0, 0.63, 1)" },
      { transform: "scale(0.965)" },
    ];
    for (const el of document.querySelectorAll(".focus-view .stage .halo, .focus-view .stage .ring")) {
      this.animations.push(
        el.animate(keyframes, {
          id: "ring-breath",
          duration: RING_BREATH.baseMs,
          iterations: Infinity,
          // Innerer Ring atmet leicht versetzt – wie in der CSS-Fassung.
          delay: el.classList.contains("inner") ? RING_BREATH.baseMs * -0.12 : 0,
        }),
      );
    }
    document.body.classList.add("ring-waapi");
    this.applyRate(RING_BREATH.rates[state.appState] ?? 1);
  },

  setState(appState) {
    if (!this.animations.length) return;
    const target = RING_BREATH.rates[appState] ?? 1;
    window.cancelAnimationFrame(this.rampId);
    if (Math.abs(target - this.rate) < 0.001) return;

    const from = this.rate;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / RING_BREATH.rampMs);
      const eased = 0.5 - Math.cos(Math.PI * progress) / 2; // sinusförmig, wie --ease-breath
      this.applyRate(from + (target - from) * eased);
      if (progress < 1) this.rampId = window.requestAnimationFrame(step);
    };
    this.rampId = window.requestAnimationFrame(step);
  },

  applyRate(rate) {
    this.rate = rate;
    for (const animation of this.animations) animation.playbackRate = rate;
  },
};

init();

function init() {
  document.documentElement.lang = getLocale();
  applyStaticTranslations();
  renderLangSwitch();
  state.activeMode = state.settings.activeMode;
  applySettingsToUi();
  bindEvents();
  switchMode(state.activeMode);
  renderAll();
  setInterval(renderStats, 15_000);
  setInterval(renderFocusTick, 1_000);
  ringBreath.init();
  registerServiceWorker();
}

function setAppLocale(locale) {
  if (locale === getLocale()) return;

  setLocale(locale);
  document.documentElement.lang = locale;
  applyStaticTranslations();
  renderLangSwitch();
  renderAll();
}

function renderLangSwitch() {
  for (const button of els.langButtons) {
    button.classList.toggle("active", button.dataset.locale === getLocale());
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is progressive enhancement; the app works without it.
    });
  });
}

function bindEvents() {
  els.startButton.addEventListener("click", startApp);
  els.pauseButton.addEventListener("click", togglePause);

  for (const button of els.langButtons) {
    button.addEventListener("click", () => setAppLocale(button.dataset.locale));
  }

  for (const button of els.modeTabs) {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  }

  for (const link of els.modeLinks) {
    link.addEventListener("click", () => switchMode(link.dataset.modeLink));
  }

  // Office Mode verlassen: Klick auf den Status-Punkt oder Esc-Taste
  for (const exit of els.officeExits) {
    exit.addEventListener("click", () => switchMode("focus"));
    exit.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        switchMode("focus");
      }
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.dataset.view === "office") {
      switchMode("focus");
    }
  });

  for (const input of [els.distanceThreshold, els.holdSeconds, els.cooldownSeconds, els.soundVolume]) {
    input.addEventListener("input", () => {
      settingsFromUi();
      state.settings.calibrationPreset = "custom";
      saveSettings();
      renderSettings();
    });
  }

  for (const button of els.presetButtons) {
    button.addEventListener("click", () => applyCalibrationPreset(button.dataset.preset));
  }

  els.cameraSelect.addEventListener("change", () => swapCamera(els.cameraSelect.value));
  els.soundPreset.addEventListener("change", settingsFromUi);
  els.neutralSubtleToggle.addEventListener("change", settingsFromUi);
  // Tarn-Editor: Notizen lokal persistieren und Wortzahl mitführen
  els.neutralNotes.addEventListener("input", () => {
    localStorage.setItem(NEUTRAL_NOTES_KEY, els.neutralNotes.value);
    renderWordCount();
  });
  els.testSoundButton.addEventListener("click", () => {
    settingsFromUi();
    playSoundPreset(state.settings.soundPreset, state.settings.soundVolume);
  });
  els.testWarningButton.addEventListener("click", () => {
    triggerIntervention("manual_test", 1, { countStats: false });
  });

  for (const input of [els.overlayToggle, els.warmthToggle, els.soundToggle, els.vibrationToggle, els.faceTouchToggle, els.officeDotToggle]) {
    input.addEventListener("change", () => {
      settingsFromUi();
      if (!state.settings.showOverlay) clearOverlay();
      if (!state.settings.warmthFeedback) setWarmth(0);
      renderOfficeDot();
    });
  }

  els.resetStatsButton.addEventListener("click", resetStats);
  els.exportDataButton.addEventListener("click", exportData);
  els.importDataButton.addEventListener("click", () => els.importDataInput.click());
  els.importDataInput.addEventListener("change", () => {
    importData(els.importDataInput.files[0]);
    els.importDataInput.value = "";
  });
  els.onboardingSkipButton.addEventListener("click", finishOnboarding);
  els.onboardingFinishButton.addEventListener("click", finishOnboarding);
  els.recalibrateButton.addEventListener("click", startOnboarding);
}

async function startApp() {
  hideError();
  els.startButton.disabled = true;

  try {
    els.startButton.textContent = t("status.loadingModel");
    await detection.loadModels();

    els.startButton.textContent = t("status.openingCamera");
    await detection.startCamera();
    await populateCameraSelect();

    els.startPanel.hidden = true;
    els.workspace.hidden = false;
    state.running = true;
    state.paused = false;

    // Persistenten Speicher anfragen, damit der Browser localStorage
    // (Statistiken, Streak, Einstellungen) nicht automatisch bereinigt.
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist();
    }

    switchMode(state.activeMode);
    refreshAppState(true);
    requestAnimationFrame(detection.loop);

    if (!localStorage.getItem(ONBOARDING_KEY)) {
      startOnboarding();
    }
  } catch (error) {
    els.startButton.disabled = false;
    els.startButton.textContent = t("start.retry");
    showError(readableError(error));
  }
}

async function populateCameraSelect() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  if (videoInputs.length === 0) return;

  const VIRTUAL_PATTERN = /virtual|obs|snap|camo|ndivideokit/i;
  const currentId = state.settings.cameraDeviceId;
  const currentStillValid = currentId && videoInputs.some((d) => d.deviceId === currentId);

  els.cameraSelect.innerHTML = "";
  for (const device of videoInputs) {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `${t("settings.cameraDevice")} ${videoInputs.indexOf(device) + 1}`;
    els.cameraSelect.appendChild(option);
  }

  if (currentStillValid) {
    els.cameraSelect.value = currentId;
    return;
  }

  const realCamera = videoInputs.find((d) => !VIRTUAL_PATTERN.test(d.label));
  const preferredId = (realCamera ?? videoInputs[0]).deviceId;
  els.cameraSelect.value = preferredId;
  state.settings.cameraDeviceId = preferredId;
  saveSettings();
}

async function swapCamera(deviceId) {
  if (!state.running) return;
  state.settings.cameraDeviceId = deviceId || null;
  saveSettings();

  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
    state.stream = null;
  }

  try {
    await detection.startCamera();
  } catch {
    state.settings.cameraDeviceId = null;
    saveSettings();
    await detection.startCamera();
    await populateCameraSelect();
  }
}

const detection = {
  async loadModels() {
    if (state.faceLandmarker && state.handLandmarker) return;

    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmBaseUrl);
    const [faceLandmarker, handLandmarker] = await Promise.all([
      createFaceLandmarker(vision),
      createHandLandmarker(vision),
    ]);

    state.faceLandmarker = faceLandmarker;
    state.handLandmarker = handLandmarker;
  },

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia-unavailable");
    }

    const deviceId = state.settings.cameraDeviceId;
    const videoConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };

    state.stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });

    els.video.srcObject = state.stream;
    await new Promise((resolve) => {
      els.video.onloadedmetadata = resolve;
    });
    await els.video.play();
    resizeOverlay();
  },

  loop(now) {
    if (!state.running) return;

    if (els.video.currentTime !== state.lastVideoTime && els.video.readyState >= 2) {
      state.lastVideoTime = els.video.currentTime;
      detection.detectFrame(now);
    }

    requestAnimationFrame(detection.loop);
  },

  detectFrame(now) {
    resizeOverlay();

    const faceResult = state.faceLandmarker.detectForVideo(els.video, now);
    const handResult = state.handLandmarker.detectForVideo(els.video, now);
    const faceLandmarks = faceResult.faceLandmarks?.[0] ?? null;
    const handLandmarks = handResult.landmarks ?? [];

    state.mouthCenter = faceLandmarks ? averageLandmarks(faceLandmarks, MOUTH_INDICES) : null;
    state.fingertips = handLandmarks.flatMap((hand) => FINGERTIP_INDICES.map((index) => hand[index]));
    state.minDistance = computeMinMouthDistance(state.mouthCenter, state.fingertips);

    // „Gesichtsberührung melden": ganzes Gesicht statt nur Mund.
    // Während der Kalibrierung zählt weiterhin nur der Mundabstand.
    if (state.settings.faceTouchAlert && !state.onboarding && faceLandmarks) {
      state.minDistance = Math.min(
        state.minDistance,
        computeMinFaceDistance(faceLandmarks, state.fingertips),
      );
    }

    renderLiveSignals(faceLandmarks, handLandmarks);

    if (state.onboarding) {
      updateOnboarding(now, faceLandmarks, handLandmarks);
    } else {
      detection.evaluateProximity(now);
    }

    if (state.settings.showOverlay) {
      drawOverlay();
    } else {
      clearOverlay();
    }

    // --- TAURI-SPIKE (Wegwerf, nach dem Spike wieder entfernen) -------------
    // Zählt jeden abgeschlossenen Detection-Callback für die Hintergrund-
    // Throttling-Messung. Ohne das Spike-Overlay (reine PWA) ist dies inert.
    if (window.__nailguardSpike) window.__nailguardSpike.onDetection();
    // ------------------------------------------------------------------------
  },

  evaluateProximity(now) {
    const threshold = state.settings.distanceThreshold;
    const holdMs = state.settings.holdSeconds * 1000;
    const cooldownMs = state.settings.cooldownSeconds * 1000;
    const isNear = state.minDistance <= threshold;
    const proximityRatio = isFinite(state.minDistance)
      ? Math.max(0, Math.min(1, 1 - state.minDistance / threshold))
      : 0;

    els.proximityBar.style.width = `${Math.round(proximityRatio * 100)}%`;
    els.proximityBar.style.background = proximityRatio > 0.85 ? "var(--warm)" : "var(--breath)";

    if (state.paused) {
      state.nearSince = null;
      state.handNear = false;
      setWarmth(0);
      refreshAppState();
      return;
    }

    state.handNear = isNear && !state.alertOpen;
    refreshAppState();

    if (isNear && !state.alertOpen) {
      state.nearSince ??= now;
      const holdProgress = Math.max(0, Math.min(1, (now - state.nearSince) / holdMs));
      setWarmth(holdProgress);
    } else {
      setWarmth(state.alertOpen ? 1 : 0);
    }

    if (!isNear || state.alertOpen) {
      if (!isNear) state.nearSince = null;
      return;
    }

    const heldLongEnough = now - state.nearSince >= holdMs;
    const cooledDown = Date.now() - state.lastAlertAt >= cooldownMs;

    if (heldLongEnough && cooledDown) {
      const confidence = Math.max(0, Math.min(1, 1 - state.minDistance / threshold));
      triggerIntervention("hand_near_mouth", confidence);
    }
  },
};

async function createFaceLandmarker(vision) {
  const options = {
    baseOptions: {
      modelAssetPath: MEDIAPIPE.faceModelUrl,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  };

  try {
    return await FaceLandmarker.createFromOptions(vision, options);
  } catch {
    return FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: MEDIAPIPE.faceModelUrl, delegate: "CPU" },
    });
  }
}

async function createHandLandmarker(vision) {
  const options = {
    baseOptions: {
      modelAssetPath: MEDIAPIPE.handModelUrl,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  };

  try {
    return await HandLandmarker.createFromOptions(vision, options);
  } catch {
    return HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: MEDIAPIPE.handModelUrl, delegate: "CPU" },
    });
  }
}

function triggerIntervention(reason, confidence, options = {}) {
  const { countStats = true } = options;
  const now = Date.now();
  const replacement = randomReplacement();

  ensureTodayStats();

  if (countStats) {
    const previousWarning = state.stats.lastWarningAt || state.stats.trackingStartedAt;
    state.stats.warnings += 1;
    state.stats.lastWarningAt = now;
    state.stats.longestWarningFreeMs = Math.max(
      state.stats.longestWarningFreeMs,
      now - previousWarning,
    );
    const hour = new Date().getHours();
    state.stats.hourly[hour] = (state.stats.hourly[hour] ?? 0) + 1;
    saveStats();
  }

  state.lastAlertAt = now;
  state.alertOpen = true;
  state.nearSince = null;
  state.currentIntervention = { reason, confidence, replacement, at: now, countStats };
  refreshAppState();

  renderReplacement(replacement);
  renderStats();
  if (state.activeMode === "neutral") {
    showNeutralIntervention();
  } else {
    showBrowserIntervention();
  }
  notifyUser();

  // Future Mac wrapper hook: replace or augment this browser UI with a native overlay.
  window.dispatchEvent(new CustomEvent("nailguard:intervention", {
    detail: { reason, confidence, replacement, at: now },
  }));
}

// Keine Abfrage mehr: dieselbe kleine, dezente Notiz wie im Office Mode
// (nur im Marken-Look statt im Tarn-Look) statt eines Vollbild-Dialogs.
// Verschwindet von selbst, Treffer werden dabei still mitgezählt statt
// erfragt (Entscheidung 2026-06-28, siehe decisions.md). 3200ms = dieselbe
// Dauer wie die Office-Einblendung im Standard-("dezent")-Zustand.
function showBrowserIntervention() {
  els.alertReplacement.textContent = t("alert.body");
  els.alertPanel.hidden = false;

  window.clearTimeout(state.browserInterventionTimer);
  state.browserInterventionTimer = window.setTimeout(resolveInterventionSilently, 3200);
}

function showNeutralIntervention() {
  const interventions = t("neutralInterventions");
  const [title, text] = interventions[Math.floor(Math.random() * interventions.length)];
  window.clearTimeout(state.neutralInterventionTimer);
  els.neutralInterventionTitle.textContent = title;
  els.neutralInterventionText.textContent = text;
  els.neutralIntervention.classList.toggle("prominent", !state.settings.neutralSubtleInterventions);
  els.neutralIntervention.hidden = false;

  state.neutralInterventionTimer = window.setTimeout(() => {
    els.neutralIntervention.hidden = true;
    state.alertOpen = false;
    state.currentIntervention = null;
    setWarmth(0);
    refreshAppState();
  }, state.settings.neutralSubtleInterventions ? 3200 : 4600);
}

// Ersetzt die frühere Treffer/Fehlalarm/Gesichtsberührung-Abfrage: jede
// erkannte Nähe gilt automatisch als Treffer, ohne Nachfrage. Kein
// Datenverlust im Tracking (Review-Zähler + „Ruhige Zeit" bleiben aktuell),
// nur die Klassifizierung per Klick entfällt. Das frühere Auto-Tune
// (Feinjustierung aus Treffer-/Fehlalarm-Rückmeldungen) wurde mitsamt
// Schalter entfernt: ohne Abfrage gibt es kein Gegensignal „Fehlalarm"
// mehr, eine Lernfunktion wäre ein leeres Versprechen.
function resolveInterventionSilently() {
  ensureTodayStats();

  if (state.currentIntervention?.countStats !== false) {
    state.stats.confirmed += 1;
    state.stats.lastConfirmedAt = Date.now();
  }

  state.alertOpen = false;
  state.currentIntervention = null;
  setWarmth(0);
  els.alertPanel.hidden = true;
  refreshAppState();
  saveStats();
  renderStats();
}

function quantize(value, step) {
  return Number((Math.round(value / step) * step).toFixed(4));
}

function notifyUser() {
  if (state.settings.vibration && "vibrate" in navigator) {
    navigator.vibrate([90, 50, 90]);
  }

  if (state.settings.sound) {
    playSoundPreset(state.settings.soundPreset, state.settings.soundVolume);
  }
}

function startOnboarding() {
  state.onboarding = {
    step: 1,
    stableSince: null,
    touchMin: Number.POSITIVE_INFINITY,
  };
  state.nearSince = null;
  setWarmth(0);
  els.onboardingPanel.hidden = false;
  renderOnboarding();
}

function updateOnboarding(now, faceLandmarks, handLandmarks) {
  const ob = state.onboarding;

  if (ob.step === 1) {
    setOnboardingSignal(faceLandmarks ? "onboarding.foundFace" : "onboarding.waitingFace");
    advanceOnboardingWhenStable(now, Boolean(faceLandmarks), 2);
    return;
  }

  if (ob.step === 2) {
    setOnboardingSignal(handLandmarks.length ? "onboarding.foundHand" : "onboarding.waitingHand");
    advanceOnboardingWhenStable(now, handLandmarks.length > 0, 3);
    return;
  }

  if (ob.step === 3) {
    if (isFinite(state.minDistance)) {
      ob.touchMin = Math.min(ob.touchMin, state.minDistance);
    }

    const isNear = state.minDistance <= ONBOARDING.nearDistance;
    setOnboardingSignal(isNear ? "onboarding.holdNearMouth" : "onboarding.moveCloser");

    if (isNear) {
      ob.stableSince ??= now;
      if (now - ob.stableSince >= ONBOARDING.touchHoldMs) {
        applyOnboardingCalibration();
        ob.step = 4;
        ob.stableSince = null;
        renderOnboarding();
      }
    } else {
      ob.stableSince = null;
    }
  }
}

function advanceOnboardingWhenStable(now, conditionMet, nextStep) {
  const ob = state.onboarding;

  if (!conditionMet) {
    ob.stableSince = null;
    return;
  }

  ob.stableSince ??= now;
  if (now - ob.stableSince >= ONBOARDING.signalStableMs) {
    ob.step = nextStep;
    ob.stableSince = null;
    renderOnboarding();
  }
}

function applyOnboardingCalibration() {
  const touch = state.onboarding.touchMin;
  if (!isFinite(touch)) return;

  const threshold = Math.min(
    ONBOARDING.thresholdMax,
    Math.max(ONBOARDING.thresholdMin, touch * ONBOARDING.thresholdFactor),
  );
  state.settings = {
    ...state.settings,
    // Quantize to the sensitivity slider's step so stored and displayed values match
    distanceThreshold: quantize(threshold, Number(els.distanceThreshold.step) || 0.001),
    calibrationPreset: "custom",
  };
  applySettingsToUi();
  saveSettings();
  renderSettings();
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, "done");
  state.onboarding = null;
  state.nearSince = null;
  els.onboardingPanel.hidden = true;
  // Nach der Kalibrierung landet der Nutzer im Focus Mode,
  // nicht in den Einstellungen.
  switchMode("focus");
}

function renderOnboarding() {
  if (!state.onboarding) return;
  const step = state.onboarding.step;

  els.onboardingTitle.textContent = t(`onboarding.step${step}Title`);
  els.onboardingBody.textContent = t(`onboarding.step${step}Body`);
  els.onboardingFinishButton.hidden = step !== 4;
  els.onboardingSkipButton.hidden = step === 4;
  if (step === 4) {
    setOnboardingSignal("onboarding.captured");
  } else {
    els.onboardingSignal.textContent = "";
  }

  for (const dot of els.onboardingDots) {
    const dotStep = Number(dot.dataset.step);
    dot.classList.toggle("done", dotStep < step || step === 4);
    dot.classList.toggle("current", dotStep === step && step !== 4);
  }
}

function setOnboardingSignal(key) {
  els.onboardingSignal.textContent = t(key);
}

function togglePause() {
  state.paused = !state.paused;
  state.nearSince = null;
  setWarmth(0);
  renderPauseState();
}

function switchMode(mode) {
  state.activeMode = ["focus", "calibration", "review", "neutral"].includes(mode) ? mode : "focus";
  state.settings.activeMode = state.activeMode;
  saveSettings();
  // body[data-view="office"] blendet Kopfzeile und Navigation aus (Tarnung)
  document.body.dataset.view = state.activeMode === "neutral" ? "office" : state.activeMode;
  renderAppChrome();

  for (const tab of els.modeTabs) {
    tab.classList.toggle("active", tab.dataset.mode === state.activeMode);
  }

  for (const view of els.modeViews) {
    view.classList.toggle("active", view.dataset.view === state.activeMode);
  }

  if (state.activeMode !== "calibration") {
    clearOverlay();
  }

  if (state.activeMode !== "neutral") {
    window.clearTimeout(state.neutralInterventionTimer);
    els.neutralIntervention.hidden = true;
  } else {
    maybeShowOfficeHint();
  }
}

// Erstnutzungs-Hinweis: Der Rückweg aus dem Office Mode ist absichtlich
// unsichtbar (Tarnung). Beim allerersten Wechsel deshalb einmalig eine
// dezente, von selbst verschwindende Notiz – über das bestehende neutrale
// Einblendungs-Element, damit die Tarnung optisch gewahrt bleibt.
function maybeShowOfficeHint() {
  if (localStorage.getItem(OFFICE_HINT_KEY)) return;
  localStorage.setItem(OFFICE_HINT_KEY, "seen");

  window.clearTimeout(state.neutralInterventionTimer);
  els.neutralInterventionTitle.textContent = t("office.escHintTitle");
  els.neutralInterventionText.textContent = t("office.escHintText");
  els.neutralIntervention.classList.remove("prominent");
  els.neutralIntervention.hidden = false;

  state.neutralInterventionTimer = window.setTimeout(() => {
    els.neutralIntervention.hidden = true;
  }, 4600);
}

function renderAll() {
  renderSettings();
  renderStats();
  renderPauseState();
  renderOfficeEditor();
  renderOnboarding();
  refreshAppState(true);
}

function computeAppState() {
  if (state.alertOpen) return "ember";
  if (state.paused) return "paused";
  if (state.handNear) return "warm";
  return "calm";
}

function refreshAppState(force = false) {
  const next = computeAppState();
  if (!force && next === state.appState) return;

  state.appState = next;
  document.body.dataset.state = next;
  ringBreath.setState(next);
  els.stateWord.textContent = t(`state.${next}`);
  els.stateHint.textContent = t(`state.${next}Hint`);
}

function renderLiveSignals(faceLandmarks, handLandmarks) {
  els.faceSignal.textContent = faceLandmarks ? t("signals.faceDetected") : t("signals.faceSearching");
  els.handSignal.textContent = handLandmarks.length
    ? t("signals.handDetected", { count: handLandmarks.length })
    : t("signals.handSearching");

  if (!isFinite(state.minDistance)) {
    els.nearSignal.textContent = t("signals.nearWaiting");
    els.distanceSignal.textContent = t("signals.distanceEmpty");
    return;
  }

  const isNear = state.minDistance <= state.settings.distanceThreshold;
  els.nearSignal.textContent = isNear ? t("signals.nearClose") : t("signals.nearCalm");
  els.distanceSignal.textContent = t("signals.distance", { value: state.minDistance.toFixed(3) });
}

function renderStats() {
  ensureTodayStats();
  const now = Date.now();
  const warningStart = state.stats.lastWarningAt || state.stats.trackingStartedAt;
  const longestQuiet = Math.max(state.stats.longestWarningFreeMs, now - warningStart);

  els.focusConfirmed.textContent = state.stats.warnings;
  els.statLongest.textContent = formatQuietHours(longestQuiet);

  els.reviewDate.textContent = t("review.today", {
    date: new Date().toLocaleDateString(dateLocale(), { day: "numeric", month: "long" }),
  });

  renderReviewSummary(longestQuiet);
  renderQuietDelta(longestQuiet);
  renderHourBars();
  renderStreak();
  renderFocusTick();
}

// Menschliche Tageszusammenfassung über den Detailwerten. Jeder Satz wird
// nur angezeigt, wenn er aus tatsächlich vorhandenen Daten berechenbar ist:
// kein Gestern-Vergleich ohne Gestern-Daten, kein Tageszeit-Schwerpunkt
// ohne klaren Schwerpunkt.
function renderReviewSummary(longestQuiet) {
  const sentences = [];
  const moments = state.stats.warnings;

  if (moments === 0) {
    sentences.push(t("review.summaryMomentsNone"));
  } else if (moments === 1) {
    sentences.push(t("review.summaryMomentsOne"));
  } else {
    sentences.push(t("review.summaryMoments", { count: moments }));
  }

  if (longestQuiet >= 60_000) {
    sentences.push(t("review.summaryQuiet", { duration: formatQuietHours(longestQuiet) }));
  }

  // Tageszeit-Schwerpunkt: erst ab 3 Momenten und nur bei eindeutigem Maximum
  const buckets = { Morning: 0, Afternoon: 0, Evening: 0 };
  for (const [hour, count] of Object.entries(state.stats.hourly ?? {})) {
    const h = Number(hour);
    const bucket = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
    buckets[bucket] += count;
  }
  const ranked = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  if (moments >= 3 && ranked[0][1] > ranked[1][1]) {
    sentences.push(t(`review.summaryPeak${ranked[0][0]}`));
  }

  const yesterday = loadAllStats()[dateKeyFor(addDays(new Date(), -1))];
  if (typeof yesterday?.warnings === "number") {
    if (moments < yesterday.warnings) {
      sentences.push(t("review.summaryCalmer"));
    } else if (moments > yesterday.warnings) {
      sentences.push(t("review.summaryBusier"));
    } else {
      sentences.push(t("review.summarySame"));
    }
  }

  els.reviewSummary.textContent = sentences.join(" ");
}

function renderFocusTick() {
  const start = state.stats.lastConfirmedAt || state.stats.trackingStartedAt;
  els.focusStreak.textContent = formatClock(Date.now() - start);
}

function renderQuietDelta(longestQuiet) {
  const yesterday = loadAllStats()[dateKeyFor(addDays(new Date(), -1))];

  if (!yesterday?.longestWarningFreeMs) {
    els.quietDelta.textContent = "";
    return;
  }

  const deltaMs = longestQuiet - yesterday.longestWarningFreeMs;
  const minutes = Math.round(Math.abs(deltaMs) / 60_000);
  const strong = document.createElement("b");
  strong.textContent = `${deltaMs >= 0 ? "+" : "−"}${formatDuration(minutes * 60_000)}`;
  els.quietDelta.replaceChildren(strong, ` ${t("review.vsYesterday")}`);
}

function renderHourBars() {
  const hourly = state.stats.hourly ?? {};
  const activeHours = Object.keys(hourly).map(Number);
  const start = Math.min(8, ...activeHours);
  const end = Math.max(18, ...activeHours.map((hour) => hour + 1));
  const max = Math.max(1, ...Object.values(hourly));

  const bars = [];
  for (let hour = start; hour < end; hour += 1) {
    const count = hourly[hour] ?? 0;
    const bar = document.createElement("div");
    bar.className = count > 0 && max >= 2 && count >= max * 0.66 ? "bar peak" : "bar";
    bar.style.height = count === 0 ? "4%" : `${Math.round((count / max) * 100)}%`;
    bars.push(bar);
  }
  els.hourBars.replaceChildren(...bars);

  const middle = Math.round((start + end) / 2);
  els.hourLabels.replaceChildren(
    ...[start, middle, end].map((hour) => {
      const label = document.createElement("span");
      label.textContent = `${hour}:00`;
      return label;
    }),
  );
}

function renderStreak() {
  const days = calcCalmStreak(loadAllStats());
  els.streakDays.textContent = days;

  if (days === 0) {
    els.streakText.textContent = t("review.streakZero");
    return;
  }

  const strong = document.createElement("b");
  strong.textContent = days === 1 ? t("review.streakStrongOne") : t("review.streakStrong", { days });
  els.streakText.replaceChildren(
    strong,
    ` ${t("review.streakRest")}`,
    document.createElement("br"),
    t("review.streakKeepGoing"),
  );
}

function calcCalmStreak(allStats) {
  if ((state.stats.warnings ?? 0) >= 5) return 0;

  let days = 1;
  const cursor = new Date();
  for (;;) {
    cursor.setDate(cursor.getDate() - 1);
    const dayStats = allStats[dateKeyFor(cursor)];
    if (!dayStats || (dayStats.warnings ?? 0) >= 5) break;
    days += 1;
  }
  return days;
}

function renderSettings() {
  els.distanceValue.textContent = Number(els.distanceThreshold.value).toFixed(3);
  els.holdValue.textContent = `${Number(els.holdSeconds.value).toFixed(1)} s`;
  els.cooldownValue.textContent = `${Math.round(Number(els.cooldownSeconds.value))} s`;
  els.volumeValue.textContent = `${Math.round(Number(els.soundVolume.value) * 100)}%`;
  renderPresetButtons();
}

function renderAppChrome() {
  const isNeutral = state.activeMode === "neutral";
  document.body.classList.toggle("office-mode", isNeutral);

  // Wortmarke wie auf der Landing: klein geschriebenes „tawel"
  els.appTitle.textContent = isNeutral ? t("neutral.title") : "tawel";

  els.startTitle.textContent = isNeutral ? t("start.titleNeutral") : t("start.title");
  els.startBody.textContent = isNeutral ? t("start.bodyNeutral") : t("start.body");
  els.startPrivacyNote.textContent = isNeutral ? t("start.privacyNeutral") : t("start.privacy");
}

function renderPauseState() {
  els.pauseButton.textContent = state.paused ? t("focus.resume") : t("focus.pause");
  els.pauseButton.classList.toggle("paused", state.paused);
  refreshAppState(true);
  renderAppChrome();
}

function renderReplacement(replacement) {
  if (els.replacementAction) {
    els.replacementAction.textContent = replacement;
  }
}

function applyCalibrationPreset(presetName) {
  const preset = CALIBRATION_PRESETS[presetName];
  if (!preset) return;

  state.settings = {
    ...state.settings,
    calibrationPreset: presetName,
    ...preset,
  };
  applySettingsToUi();
  saveSettings();
  renderSettings();
}

function renderPresetButtons() {
  for (const button of els.presetButtons) {
    button.classList.toggle("active", button.dataset.preset === state.settings.calibrationPreset);
  }
}

// Tarn-Editor (Office Mode): persistierte Notizen laden und Wortzahl
// anzeigen. Beim ersten Start steht ein unverfänglicher Beispieltext.
function renderOfficeEditor() {
  els.neutralSubtleToggle.checked = state.settings.neutralSubtleInterventions;
  const stored = localStorage.getItem(NEUTRAL_NOTES_KEY);
  els.neutralNotes.value = stored ?? t("office.sampleNotes");
  renderWordCount();
}

function renderWordCount() {
  const trimmed = els.neutralNotes.value.trim();
  const count = trimmed ? trimmed.split(/\s+/).length : 0;
  els.editorWordCount.textContent = count === 1 ? t("office.wordOne") : t("office.wordOther", { count });
}

function settingsFromUi() {
  state.settings = {
    ...state.settings,
    distanceThreshold: Number(els.distanceThreshold.value),
    holdSeconds: Number(els.holdSeconds.value),
    cooldownSeconds: Number(els.cooldownSeconds.value),
    showOverlay: els.overlayToggle.checked,
    warmthFeedback: els.warmthToggle.checked,
    sound: els.soundToggle.checked,
    soundPreset: els.soundPreset.value,
    soundVolume: Number(els.soundVolume.value),
    vibration: els.vibrationToggle.checked,
    faceTouchAlert: els.faceTouchToggle.checked,
    officeStatusDot: els.officeDotToggle.checked,
    neutralSubtleInterventions: els.neutralSubtleToggle.checked,
  };
  saveSettings();
}

function applySettingsToUi() {
  els.distanceThreshold.value = state.settings.distanceThreshold;
  els.holdSeconds.value = state.settings.holdSeconds;
  els.cooldownSeconds.value = state.settings.cooldownSeconds;
  els.overlayToggle.checked = state.settings.showOverlay;
  els.warmthToggle.checked = state.settings.warmthFeedback;
  els.soundToggle.checked = state.settings.sound;
  els.soundPreset.value = SOUND_PRESETS[state.settings.soundPreset]
    ? state.settings.soundPreset
    : "bubblePop";
  els.soundVolume.value = state.settings.soundVolume;
  els.vibrationToggle.checked = state.settings.vibration;
  els.faceTouchToggle.checked = state.settings.faceTouchAlert;
  els.officeDotToggle.checked = state.settings.officeStatusDot;
  els.neutralSubtleToggle.checked = state.settings.neutralSubtleInterventions;
  renderOfficeDot();
}

function renderOfficeDot() {
  document.body.dataset.officeDot = state.settings.officeStatusDot ? "on" : "off";
}

function exportData() {
  const data = {};
  for (const key of BACKUP_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }

  // "app"-Feld ist informativ; der Import prüft nur die bekannten Keys,
  // alte nail-guard-Backups bleiben deshalb weiterhin importierbar.
  const payload = { app: "tawel", exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tawel-backup-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    // Backups tragen die Keys unter "data"; pures Key/Wert-JSON wird
    // ebenfalls akzeptiert. Unbekannte Keys werden ignoriert.
    const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
    if (!data || typeof data !== "object") throw new Error("invalid-backup");

    const entries = [];
    for (const key of BACKUP_KEYS) {
      if (!(key in data)) continue;
      const raw = data[key];
      const value = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (JSON_BACKUP_KEYS.has(key)) JSON.parse(value);
      entries.push([key, value]);
    }
    if (entries.length === 0) throw new Error("invalid-backup");

    for (const [key, value] of entries) {
      localStorage.setItem(key, value);
    }

    // App mit den importierten Daten neu initialisieren
    window.location.reload();
  } catch {
    showError({ message: t("errors.importFailed"), hints: [t("errors.importFailedHint1")] });
  }
}

function loadSettings() {
  const defaults = {
    activeMode: "focus",
    distanceThreshold: 0.09,
    holdSeconds: 2,
    cooldownSeconds: 15,
    calibrationPreset: "normal",
    showOverlay: true,
    warmthFeedback: true,
    sound: false,
    soundPreset: "bubblePop",
    soundVolume: 0.35,
    cameraDeviceId: null,
    vibration: true,
    // Hinweis: ein evtl. gespeichertes "autoTune"-Feld aus früheren
    // Versionen wird beim Laden mitgeschleppt, aber nirgends mehr gelesen.
    faceTouchAlert: false,
    officeStatusDot: true,
    neutralSubtleInterventions: true,
  };

  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadStats() {
  const today = todayKey();

  try {
    const allStats = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    return normalizeStats(allStats[today], today);
  } catch {
    return normalizeStats(null, today);
  }
}

function saveStats() {
  const today = todayKey();
  const allStats = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  allStats[today] = state.stats;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allStats));
}

function resetStats() {
  state.stats = normalizeStats(null, todayKey());
  saveStats();
  renderStats();
}

function normalizeStats(stats, date) {
  const now = Date.now();
  const trackingStartedAt = stats?.trackingStartedAt ?? stats?.lastWarningAt ?? now;
  const longestWarningFreeMs = Math.min(
    stats?.longestWarningFreeMs ?? 0,
    Math.max(0, now - trackingStartedAt),
  );

  return {
    date,
    trackingStartedAt,
    warnings: stats?.warnings ?? 0,
    confirmed: stats?.confirmed ?? 0,
    falseAlarms: stats?.falseAlarms ?? 0,
    faceTouches: stats?.faceTouches ?? 0,
    lastWarningAt: stats?.lastWarningAt ?? null,
    lastConfirmedAt: stats?.lastConfirmedAt ?? null,
    longestWarningFreeMs,
    hourly: stats?.hourly ?? {},
  };
}

function ensureTodayStats() {
  const today = todayKey();
  if (state.stats.date === today) return;

  state.stats = loadStats();
}

function todayKey() {
  return dateKeyFor(new Date());
}

function dateKeyFor(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function loadAllStats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function averageLandmarks(landmarks, indices) {
  const total = indices.reduce(
    (sum, index) => ({
      x: sum.x + landmarks[index].x,
      y: sum.y + landmarks[index].y,
      z: sum.z + (landmarks[index].z ?? 0),
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / indices.length,
    y: total.y / indices.length,
    z: total.z / indices.length,
  };
}

function computeMinMouthDistance(mouthCenter, fingertips) {
  if (!mouthCenter || fingertips.length === 0) return Number.POSITIVE_INFINITY;

  return fingertips.reduce((min, fingertip) => {
    const dx = mouthCenter.x - fingertip.x;
    const dy = mouthCenter.y - fingertip.y;
    return Math.min(min, Math.hypot(dx, dy));
  }, Number.POSITIVE_INFINITY);
}

function computeMinFaceDistance(faceLandmarks, fingertips) {
  if (fingertips.length === 0) return Number.POSITIVE_INFINITY;

  let min = Number.POSITIVE_INFINITY;
  for (const index of FACE_TOUCH_INDICES) {
    const point = faceLandmarks[index];
    for (const fingertip of fingertips) {
      min = Math.min(min, Math.hypot(point.x - fingertip.x, point.y - fingertip.y));
    }
  }
  return min;
}

// Canvas kennt keine CSS-Variablen: Design-Tokens einmalig auflösen und cachen.
const tokenCache = {};
function tokenColor(name) {
  tokenCache[name] ??= getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return tokenCache[name];
}

function drawOverlay() {
  const ctx = els.overlay.getContext("2d");
  clearOverlay();

  if (state.mouthCenter) {
    drawPoint(ctx, state.mouthCenter, 8, tokenColor("--warm"));
  }

  for (const fingertip of state.fingertips) {
    drawPoint(ctx, fingertip, 6, tokenColor("--breath"));
    if (state.mouthCenter) drawLine(ctx, state.mouthCenter, fingertip);
  }
}

function drawPoint(ctx, landmark, radius, color) {
  ctx.beginPath();
  ctx.arc(landmark.x * els.overlay.width, landmark.y * els.overlay.height, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.86)";
  ctx.stroke();
}

function drawLine(ctx, from, to) {
  ctx.beginPath();
  ctx.moveTo(from.x * els.overlay.width, from.y * els.overlay.height);
  ctx.lineTo(to.x * els.overlay.width, to.y * els.overlay.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.stroke();
}

function clearOverlay() {
  const ctx = els.overlay.getContext("2d");
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
}

function resizeOverlay() {
  const rect = els.video.getBoundingClientRect();
  const width = Math.round(rect.width * window.devicePixelRatio);
  const height = Math.round(rect.height * window.devicePixelRatio);

  if (els.overlay.width !== width || els.overlay.height !== height) {
    els.overlay.width = width;
    els.overlay.height = height;
  }
}

function setWarmth(value) {
  const clamped = Math.max(0, Math.min(1, value));
  const eased = state.settings.warmthFeedback ? Math.pow(clamped, 0.85) : 0;
  els.warmOverlay.style.setProperty("--warmth", eased.toFixed(3));
}

function randomReplacement() {
  const replacements = t("replacements");
  return replacements[Math.floor(Math.random() * replacements.length)];
}

function playSoundPreset(presetKey, volume) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const preset = SOUND_PRESETS[presetKey] ?? SOUND_PRESETS.bubblePop;
  const masterGain = context.createGain();
  const safeVolume = Math.max(0, Math.min(1, volume));

  masterGain.gain.value = safeVolume * 0.22;
  masterGain.connect(context.destination);

  for (const [frequency, delay, duration, type] of preset.notes) {
    playTone(context, masterGain, frequency, delay, duration, type);
  }

  const endTime = Math.max(...preset.notes.map(([, delay, duration]) => delay + duration)) + 0.08;
  window.setTimeout(() => context.close(), endTime * 1000);
}

function playTone(context, destination, frequency, delay, duration, type) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (type === "sawtooth") {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.58), end);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.8, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatQuietHours(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")} h`;
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function showError(errorInfo) {
  els.errorText.textContent = errorInfo.message;
  els.errorHints.replaceChildren(
    ...errorInfo.hints.map((hint) => {
      const item = document.createElement("li");
      item.textContent = hint;
      return item;
    }),
  );
  els.errorMessage.hidden = false;
}

function hideError() {
  els.errorMessage.hidden = true;
}

function readableError(error) {
  if (error?.name === "NotAllowedError") {
    return {
      message: t("errors.cameraBlocked"),
      hints: [
        t("errors.cameraBlockedHint1"),
        t("errors.cameraBlockedHint2", { origin: window.location.origin }),
        t("errors.cameraBlockedHint3"),
      ],
    };
  }

  if (error?.name === "NotFoundError") {
    return {
      message: t("errors.noCamera"),
      hints: [t("errors.noCameraHint1"), t("errors.noCameraHint2"), t("errors.noCameraHint3")],
    };
  }

  if (error?.message === "getUserMedia-unavailable") {
    return {
      message: t("errors.noGetUserMedia"),
      hints: [t("errors.noGetUserMediaHint1"), t("errors.noGetUserMediaHint2")],
    };
  }

  return {
    message: t("errors.generic"),
    hints: [t("errors.genericHint1"), t("errors.genericHint2"), t("errors.genericHint3")],
  };
}
