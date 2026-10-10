/* The renderer prepares the cue and maps a native level onto the filter. Camera
   detection is native, and so is the clock: the native stepper streams a 0..1
   level (tawel:hint-level); this layer never changes its opacity, only the
   filter strength – the one thing the compositor actually renders for a
   backdrop filter. Opacity fades make the compositor replay a fade of the
   full-strength filter afterwards (hardware result, MAC-0.1.22/27). */
(function () {
  "use strict";
  var overlay = document.getElementById("hintOverlay");
  var styles = ["lavender-vignette", "soft-focus", "desaturate", "ambient-glow", "wash-focus"];
  var RADIUS_FLOOR = 0.3;
  var revision = 0, expiry = null, level = 0;
  var combo = false, blurMax = 2.7, saturationMin = 0.56;
  var state = "idle";
  function bounded(value, min, max, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }
  function reduced() { return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function invoke(name, args) {
    var core = window.__TAURI__ && window.__TAURI__.core;
    return core ? core.invoke(name, args).catch(function () {}) : Promise.resolve();
  }
  function trace(stage) { invoke('trace_visual_hint', {revision: revision, stage: stage}); }
  function cancel() {
    if (expiry !== null) clearTimeout(expiry);
    expiry = null;
  }
  // Level 0..1 → filter strength. Blur keeps a floor so the filter is never
  // structurally removed; washes (no backdrop) may use opacity.
  function paint(value) {
    level = Math.max(0, Math.min(1, Number(value) || 0));
    var focus = combo ? Math.max(0, level * 2 - 1) : level;
    overlay.style.setProperty('--cue-level', String(level));
    overlay.style.setProperty('--cue-color', String(combo ? Math.min(1, level * 2) : level));
    overlay.style.setProperty('--cue-blur-max', (RADIUS_FLOOR + (Math.max(RADIUS_FLOOR, blurMax) - RADIUS_FLOOR) * focus).toFixed(3) + 'px');
    overlay.style.setProperty('--cue-saturation-min', (1 - (1 - saturationMin) * level).toFixed(4));
    overlay.dataset.phase = state;
  }
  function setLevel(payload) {
    if (!payload || payload.revision !== revision) return;
    if (state !== 'entering' && state !== 'held' && state !== 'releasing') return;
    paint(payload.level);
  }
  function release(payload) {
    var token = payload && typeof payload === 'object' ? payload.revision : payload;
    if (!Number.isSafeInteger(token) || token < revision) return;
    if (state === 'idle') { revision = token; return; }
    if (token === revision && state === 'releasing') return;
    revision = token;
    state = 'releasing';
    cancel(); overlay.dataset.phase = state;
    trace('release');
    invoke('complete_visual_hint', {revision: token, reducedMotion: reduced()});
  }
  function reset(token) {
    if (!Number.isSafeInteger(token) || token !== revision) return;
    if (state === 'entering' || state === 'held') return;
    cancel(); state = 'idle'; paint(0);
  }
  function show(value) {
    if (!value || !Number.isSafeInteger(value.revision) || value.revision <= revision) return;
    cancel(); revision = value.revision;
    var style = styles.indexOf(value.style) >= 0 ? value.style : styles[0];
    var intensity = Math.round(bounded(value.intensity, 1, 3, 2));
    var tuning = value.animation || {};
    combo = style === 'wash-focus';
    blurMax = bounded(tuning.blur, 0.5, 10, [1.4, 2.7, 4.4][intensity - 1]);
    saturationMin = [0.76, 0.56, 0.34][intensity - 1];
    var fadeIn = reduced() ? 150 : bounded(tuning.fadeIn, 150, 3000, 650);
    overlay.dataset.style = style; overlay.dataset.intensity = String(intensity);
    // Start at the current level: a cue arriving mid-exhale breathes on from
    // there; a hidden window sits at the invisible floor anyway.
    state = 'entering'; paint(level);
    invoke('ready_visual_hint', {revision: revision, reducedMotion: reduced()}).then(function () {
      if (revision !== value.revision || state !== 'entering') return;
      state = 'held'; overlay.dataset.phase = state; trace('held');
      if (!value.held) expiry = setTimeout(function () { release(value.revision); }, fadeIn + (value.preview_hold_ms || 1200));
    });
  }
  function install(attempt) {
    var api = window.__TAURI__ && window.__TAURI__.event;
    if (api && typeof api.listen === 'function') {
      api.listen('tawel:hint-level', function (event) { setLevel(event.payload); });
      api.listen('tawel:hint-clear', function (event) { release(event.payload); });
      api.listen('tawel:hint-reset', function (event) { reset(event.payload); });
      api.listen('tawel:visual-hint', function (event) { show(event.payload); });
    } else if (attempt < 40) setTimeout(function () { install(attempt + 1); }, 50);
  }
  paint(0); install(0);
  window.__tawelHintOverlay = {show: show, styles: styles.slice()};
})();
