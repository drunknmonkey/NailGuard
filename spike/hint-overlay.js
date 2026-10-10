/* The renderer only prepares the cue. Camera detection is native, and so is the
   motion: filter and opacity of this layer are set once per cue and never
   animated; the native side breathes the whole window in and out through its
   alpha. Any opacity change WebKit drives on the backdrop layer makes the
   compositor replay a fade afterwards (hardware result, MAC-0.1.22/25). */
(function () {
  "use strict";
  var overlay = document.getElementById("hintOverlay");
  var styles = ["lavender-vignette", "soft-focus", "desaturate", "ambient-glow", "wash-focus"];
  var revision = 0, expiry = null, level = 0;
  var combo = false;
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
  function paint(value) {
    level = value;
    var focus = combo ? Math.max(0, value * 2 - 1) : value;
    overlay.style.setProperty('--cue-level', String(value));
    overlay.style.setProperty('--cue-color', String(combo ? Math.min(1, value * 2) : value));
    overlay.style.setProperty('--cue-focus', String(focus));
    overlay.dataset.phase = state;
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
    var blur = bounded(tuning.blur, 0.5, 10, [1.4, 2.7, 4.4][intensity - 1]);
    var saturation = [0.76, 0.56, 0.34][intensity - 1];
    var fadeIn = reduced() ? 150 : bounded(tuning.fadeIn, 150, 3000, 650);
    // Everything is set while the window is still hidden: fixed filter, full
    // opacity. The window itself then fades in from alpha 0.
    overlay.style.setProperty('--cue-blur-max', blur + 'px');
    overlay.style.setProperty('--cue-saturation-min', String(saturation));
    overlay.dataset.style = style; overlay.dataset.intensity = String(intensity);
    state = 'entering'; paint(1);
    invoke('ready_visual_hint', {revision: revision, reducedMotion: reduced()}).then(function () {
      if (revision !== value.revision || state !== 'entering') return;
      state = 'held'; paint(1); trace('held');
      if (!value.held) expiry = setTimeout(function () { release(value.revision); }, fadeIn + (value.preview_hold_ms || 1200));
    });
  }
  function install(attempt) {
    var api = window.__TAURI__ && window.__TAURI__.event;
    if (api && typeof api.listen === 'function') {
      api.listen('tawel:hint-clear', function (event) { release(event.payload); });
      api.listen('tawel:hint-reset', function (event) { reset(event.payload); });
      api.listen('tawel:visual-hint', function (event) { show(event.payload); });
    } else if (attempt < 40) setTimeout(function () { install(attempt + 1); }, 50);
  }
  paint(0); install(0);
  window.__tawelHintOverlay = {show: show, styles: styles.slice()};
})();
