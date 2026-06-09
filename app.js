import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/+esm";
import { applyStaticTranslations, dateLocale, getLocale, setLocale, t } from "./i18n.js";

const MEDIAPIPE = {
  wasmBaseUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm",
  faceModelUrl:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  handModelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

const STORAGE_KEY = "nail-guard.daily-stats.v1";
const SETTINGS_KEY = "nail-guard.settings.v1";
const NEUTRAL_NOTES_KEY = "nail-guard.neutral-notes.v1";
const ONBOARDING_KEY = "nail-guard.onboarding.v1";

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
const SOUND_PRESETS = {
  softChime: { notes: [[520, 0, 0.24, "sine"], [780, 0.08, 0.26, "sine"]] },
  breathBell: { notes: [[392, 0, 0.22, "triangle"], [494, 0.26, 0.28, "triangle"], [587, 0.56, 0.34, "triangle"]] },
  doubleTap: { notes: [[240, 0, 0.08, "sine"], [240, 0.14, 0.08, "sine"]] },
  bubblePop: { notes: [[420, 0, 0.08, "sine"], [760, 0.07, 0.12, "sine"]] },
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
  appEyebrow: document.querySelector("#appEyebrow"),
  appTitle: document.querySelector("#appTitle"),
  startTitle: document.querySelector("#startTitle"),
  startBody: document.querySelector("#startBody"),
  startPrivacyNote: document.querySelector("#startPrivacyNote"),
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusText"),
  errorMessage: document.querySelector("#errorMessage"),
  errorText: document.querySelector("#errorText"),
  errorHints: document.querySelector("#errorHints"),
  modeTabs: [...document.querySelectorAll(".mode-tab")],
  modeLinks: [...document.querySelectorAll("[data-mode-link]")],
  modeViews: [...document.querySelectorAll(".mode-view")],
  focusStatus: document.querySelector("#focusStatus"),
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
  alertPanel: document.querySelector("#alertPanel"),
  alertReplacement: document.querySelector("#alertReplacement"),
  confirmBitingButton: document.querySelector("#confirmBitingButton"),
  falseAlarmButton: document.querySelector("#falseAlarmButton"),
  faceTouchButton: document.querySelector("#faceTouchButton"),
  resetStatsButton: document.querySelector("#resetStatsButton"),
  dailySummary: document.querySelector("#dailySummary"),
  statWarnings: document.querySelector("#statWarnings"),
  statConfirmed: document.querySelector("#statConfirmed"),
  statFalse: document.querySelector("#statFalse"),
  statFace: document.querySelector("#statFace"),
  statLongest: document.querySelector("#statLongest"),
  statStreak: document.querySelector("#statStreak"),
  statLastWarning: document.querySelector("#statLastWarning"),
  neutralLayoutSelect: document.querySelector("#neutralLayoutSelect"),
  neutralSubtleToggle: document.querySelector("#neutralSubtleToggle"),
  neutralLayouts: [...document.querySelectorAll(".neutral-layout")],
  neutralClockTime: document.querySelector("#neutralClockTime"),
  neutralClockDate: document.querySelector("#neutralClockDate"),
  neutralTimerValue: document.querySelector("#neutralTimerValue"),
  neutralNotes: document.querySelector("#neutralNotes"),
  neutralBreathLabel: document.querySelector("#neutralBreathLabel"),
  neutralDashboardTime: document.querySelector("#neutralDashboardTime"),
  neutralFocusDuration: document.querySelector("#neutralFocusDuration"),
  neutralBlankTime: document.querySelector("#neutralBlankTime"),
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
  neutralTimerStartedAt: Date.now(),
  neutralInterventionTimer: null,
  statusKey: "status.ready",
  statusTone: "",
  onboarding: null,
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
  updateStatus("status.ready");
  setInterval(renderStats, 15_000);
  setInterval(renderNeutralInfo, 1_000);
  registerServiceWorker();
}

function setAppLocale(locale) {
  if (locale === getLocale()) return;

  setLocale(locale);
  document.documentElement.lang = locale;
  applyStaticTranslations();
  renderLangSwitch();

  const { statusKey, statusTone } = state;
  renderAll();
  updateStatus(statusKey, statusTone);
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

  els.soundPreset.addEventListener("change", settingsFromUi);
  els.neutralLayoutSelect.addEventListener("change", () => {
    settingsFromUi();
    renderNeutralLayout();
  });
  els.neutralSubtleToggle.addEventListener("change", settingsFromUi);
  els.neutralNotes.addEventListener("input", () => {
    localStorage.setItem(NEUTRAL_NOTES_KEY, els.neutralNotes.value);
  });
  els.testSoundButton.addEventListener("click", () => {
    settingsFromUi();
    playSoundPreset(state.settings.soundPreset, state.settings.soundVolume);
  });
  els.testWarningButton.addEventListener("click", () => {
    triggerIntervention("manual_test", 1, { countStats: false });
  });

  for (const input of [els.overlayToggle, els.warmthToggle, els.soundToggle, els.vibrationToggle]) {
    input.addEventListener("change", () => {
      settingsFromUi();
      if (!state.settings.showOverlay) clearOverlay();
      if (!state.settings.warmthFeedback) setWarmth(0);
    });
  }

  els.confirmBitingButton.addEventListener("click", () => resolveIntervention("confirmed"));
  els.falseAlarmButton.addEventListener("click", () => resolveIntervention("falseAlarm"));
  els.faceTouchButton.addEventListener("click", () => resolveIntervention("faceTouch"));
  els.resetStatsButton.addEventListener("click", resetStats);
  els.onboardingSkipButton.addEventListener("click", finishOnboarding);
  els.onboardingFinishButton.addEventListener("click", finishOnboarding);
  els.recalibrateButton.addEventListener("click", startOnboarding);
}

async function startApp() {
  hideError();
  els.startButton.disabled = true;
  els.startButton.textContent = t("start.button");

  try {
    updateStatus("status.loadingModel");
    await detection.loadModels();

    updateStatus("status.openingCamera");
    await detection.startCamera();

    els.startPanel.hidden = true;
    els.workspace.hidden = false;
    state.running = true;
    state.paused = false;
    switchMode(state.activeMode);
    updateStatus("status.active", "active");
    requestAnimationFrame(detection.loop);

    if (!localStorage.getItem(ONBOARDING_KEY)) {
      startOnboarding();
    }
  } catch (error) {
    els.startButton.disabled = false;
    els.startButton.textContent = t("start.retry");
    updateStatus("status.error", "warning");
    showError(readableError(error));
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

    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
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
    els.proximityBar.style.background = proximityRatio > 0.85 ? "#c97943" : "#57c7b7";

    if (state.paused) {
      state.nearSince = null;
      setWarmth(0);
      return;
    }

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
    saveStats();
  }

  state.lastAlertAt = now;
  state.alertOpen = true;
  state.nearSince = null;
  state.currentIntervention = { reason, confidence, replacement, at: now, countStats };

  renderReplacement(replacement);
  renderStats();
  if (state.activeMode === "neutral") {
    showNeutralIntervention();
  } else {
    showBrowserIntervention(replacement);
  }
  notifyUser();

  // Future Mac wrapper hook: replace or augment this browser UI with a native overlay.
  window.dispatchEvent(new CustomEvent("nailguard:intervention", {
    detail: { reason, confidence, replacement, at: now },
  }));
}

function showBrowserIntervention(replacement) {
  els.alertReplacement.textContent = t("alert.body");
  els.alertPanel.hidden = false;
  updateStatus("status.miniReset", "warning");
}

function showNeutralIntervention() {
  const interventions = t("neutralInterventions");
  const [title, text] = interventions[Math.floor(Math.random() * interventions.length)];
  window.clearTimeout(state.neutralInterventionTimer);
  els.neutralInterventionTitle.textContent = title;
  els.neutralInterventionText.textContent = text;
  els.neutralIntervention.classList.toggle("prominent", !state.settings.neutralSubtleInterventions);
  els.neutralIntervention.hidden = false;
  updateStatus("status.active", "warning");

  state.neutralInterventionTimer = window.setTimeout(() => {
    els.neutralIntervention.hidden = true;
    state.alertOpen = false;
    state.currentIntervention = null;
    setWarmth(0);
    updateStatus(state.paused ? "status.paused" : "status.active", state.paused ? "paused" : "active");
  }, state.settings.neutralSubtleInterventions ? 3200 : 4600);
}

function resolveIntervention(kind) {
  ensureTodayStats();

  if (state.currentIntervention?.countStats !== false) {
    if (kind === "confirmed") {
      state.stats.confirmed += 1;
      state.stats.lastConfirmedAt = Date.now();
    } else if (kind === "falseAlarm") {
      state.stats.falseAlarms += 1;
    } else if (kind === "faceTouch") {
      state.stats.faceTouches += 1;
    }
  }

  state.alertOpen = false;
  state.currentIntervention = null;
  setWarmth(0);
  els.alertPanel.hidden = true;
  updateStatus(state.paused ? "status.paused" : "status.active", state.paused ? "paused" : "active");
  saveStats();
  renderStats();
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
  // Quantize to the sensitivity slider's step so stored and displayed values match
  const sliderStep = Number(els.distanceThreshold.step) || 0.005;
  const quantized = Math.round(threshold / sliderStep) * sliderStep;

  state.settings = {
    ...state.settings,
    distanceThreshold: Number(quantized.toFixed(3)),
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
  renderAppChrome();
  updateStatus(state.statusKey, state.statusTone);

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
  }
}

function renderAll() {
  renderSettings();
  renderStats();
  renderPauseState();
  renderNeutralLayout();
  renderNeutralInfo();
  renderOnboarding();
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
  const confirmedStart = state.stats.lastConfirmedAt || state.stats.trackingStartedAt;
  const longestQuiet = Math.max(state.stats.longestWarningFreeMs, now - warningStart);
  const streak = now - confirmedStart;

  els.statWarnings.textContent = state.stats.warnings;
  els.statConfirmed.textContent = state.stats.confirmed;
  els.statFalse.textContent = state.stats.falseAlarms;
  els.statFace.textContent = state.stats.faceTouches;
  els.statLongest.textContent = formatDuration(longestQuiet);
  els.statStreak.textContent = formatDuration(streak);
  els.focusStreak.textContent = formatDuration(streak);
  els.focusConfirmed.textContent = state.stats.warnings;
  els.dailySummary.textContent = dailySummaryText(longestQuiet);
  els.statLastWarning.textContent = state.stats.lastWarningAt
    ? t("review.lastWarningAt", {
        time: new Date(state.stats.lastWarningAt).toLocaleTimeString(dateLocale(), {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })
    : t("review.lastWarningNone");
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
  els.appEyebrow.textContent = isNeutral ? t("neutral.eyebrow") : t("app.eyebrow");
  els.appTitle.textContent = isNeutral ? t("neutral.title") : t("app.title");
  els.startTitle.textContent = isNeutral ? t("start.titleNeutral") : t("start.title");
  els.startBody.textContent = isNeutral ? t("start.bodyNeutral") : t("start.body");
  els.startPrivacyNote.textContent = isNeutral ? t("start.privacyNeutral") : t("start.privacy");
}

function renderPauseState() {
  els.pauseButton.textContent = state.paused ? t("focus.resume") : t("focus.pause");
  els.pauseButton.classList.toggle("paused", state.paused);
  els.focusStatus.textContent = state.paused ? t("status.paused") : t("status.active");
  updateStatus(state.paused ? "status.paused" : "status.active", state.paused ? "paused" : "active");
  renderAppChrome();
}

function renderReplacement(replacement) {
  if (els.replacementAction) {
    els.replacementAction.textContent = replacement;
  }
}

function dailySummaryText(longestQuiet) {
  if (state.stats.confirmed === 0 && state.stats.warnings === 0) {
    return t("review.summaryQuiet");
  }

  if (state.stats.confirmed === 0) {
    return t("review.summaryNoConfirmed", { duration: formatDuration(longestQuiet) });
  }

  return t("review.summaryConfirmed", { count: state.stats.confirmed });
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

function renderNeutralLayout() {
  const selectedLayout = [...els.neutralLayoutSelect.options].some((option) => option.value === state.settings.neutralLayout)
    ? state.settings.neutralLayout
    : "clock";
  state.settings.neutralLayout = selectedLayout;
  els.neutralLayoutSelect.value = selectedLayout;
  els.neutralSubtleToggle.checked = state.settings.neutralSubtleInterventions;
  els.neutralNotes.value = localStorage.getItem(NEUTRAL_NOTES_KEY) ?? t("neutral.notesKicker");

  for (const layout of els.neutralLayouts) {
    layout.classList.toggle("active", layout.dataset.neutralLayout === selectedLayout);
  }
}

function renderNeutralInfo() {
  const now = new Date();
  const time = now.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString(dateLocale(), {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timerMs = Date.now() - state.neutralTimerStartedAt;
  const timerMinutes = Math.floor(timerMs / 60_000);
  const timerSeconds = Math.floor((timerMs % 60_000) / 1000);
  const timer = `${String(timerMinutes).padStart(2, "0")}:${String(timerSeconds).padStart(2, "0")}`;
  const breathPhase = Math.floor((Date.now() / 3500) % 2) === 0 ? t("neutral.breatheIn") : t("neutral.breatheOut");

  els.neutralClockTime.textContent = time;
  els.neutralClockDate.textContent = date;
  els.neutralTimerValue.textContent = timer;
  els.neutralBreathLabel.textContent = breathPhase;
  els.neutralDashboardTime.textContent = time;
  els.neutralFocusDuration.textContent = `${timerMinutes} min`;
  els.neutralBlankTime.textContent = time;
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
    neutralLayout: els.neutralLayoutSelect.value,
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
    : "softChime";
  els.soundVolume.value = state.settings.soundVolume;
  els.vibrationToggle.checked = state.settings.vibration;
  els.neutralLayoutSelect.value = state.settings.neutralLayout;
  els.neutralSubtleToggle.checked = state.settings.neutralSubtleInterventions;
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
    soundPreset: "softChime",
    soundVolume: 0.35,
    vibration: true,
    neutralLayout: "clock",
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
  };
}

function ensureTodayStats() {
  const today = todayKey();
  if (state.stats.date === today) return;

  state.stats = loadStats();
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function drawOverlay() {
  const ctx = els.overlay.getContext("2d");
  clearOverlay();

  if (state.mouthCenter) {
    drawPoint(ctx, state.mouthCenter, 8, "#f2a24f");
  }

  for (const fingertip of state.fingertips) {
    drawPoint(ctx, fingertip, 6, "#57c7b7");
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
  const preset = SOUND_PRESETS[presetKey] ?? SOUND_PRESETS.softChime;
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

function updateStatus(key, tone = "") {
  state.statusKey = key;
  state.statusTone = tone;
  const visibleKey = state.activeMode === "neutral" && key !== "status.ready" && key !== "status.error"
    ? (state.paused ? "status.paused" : "status.active")
    : key;
  els.statusText.textContent = t(visibleKey);
  els.statusPill.classList.toggle("active", tone === "active");
  els.statusPill.classList.toggle("warning", tone === "warning");
  els.statusPill.classList.toggle("paused", tone === "paused");
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
