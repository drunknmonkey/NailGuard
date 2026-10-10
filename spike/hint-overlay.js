/* One animation clock owns the entrance. Camera detection is native.
   The filter is fixed per cue; only opacity moves, and only on the way in. On
   release this layer is left untouched: the window server fades the window, the
   native side parks and hides it and then sends tawel:hint-reset. Any opacity
   change WebKit drives on the backdrop layer makes the compositor replay a fade
   afterwards (hardware result, MAC-0.1.22/23). */
(function () {
  "use strict";
  var overlay = document.getElementById("hintOverlay");
  var styles = ["lavender-vignette", "soft-focus", "desaturate", "ambient-glow", "wash-focus"];
  var revision = 0, frame = null, timer = null, expiry = null, level = 0;
  var combo = false;
  var state = "idle";
  var STALL_MS = 50;
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
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    if (expiry !== null) clearTimeout(expiry);
    frame = null; timer = null; expiry = null;
  }
  function paint(value) {
    level = value;
    var focus = combo ? Math.max(0, value * 2 - 1) : value;
    overlay.style.setProperty('--cue-level', String(value));
    overlay.style.setProperty('--cue-color', String(combo ? Math.min(1, value * 2) : value));
    overlay.style.setProperty('--cue-focus', String(focus));
    overlay.dataset.phase = state;
  }
  // rAF drives the clock; a timer steps in when WebKit stops delivering frames
  // (seen on hardware right after the window reappears) so the cue still fades in.
  function animate(target, duration, done, started) {
    cancel();
    var from = level, start = performance.now(), token = revision, stalled = false;
    function schedule() {
      frame = requestAnimationFrame(tick);
      timer = setTimeout(function () { stalled = true; tick(performance.now()); }, STALL_MS);
    }
    function tick(now) {
      if (token !== revision) return;
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
      frame = null; timer = null;
      if (started) { started(); started = null; }
      if (stalled) { stalled = false; trace('stall'); }
      var progress = Math.min(1, Math.max(0, (now - start) / duration));
      var ease = progress * progress * (3 - 2 * progress);
      paint(from + (target - from) * ease);
      if (progress < 1) schedule();
      else done();
    }
    schedule();
  }
  function release(payload) {
    var token = payload && typeof payload === 'object' ? payload.revision : payload;
    if (!Number.isSafeInteger(token) || token < revision) return;
    if (state === 'idle') { revision = token; return; }
    if (token === revision && state === 'releasing') return;
    revision = token;
    state = 'releasing';
    // Stop the entrance where it is; the window fades from exactly this frame.
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
    var fadeIn = bounded(tuning.fadeIn, 150, 3000, 650);
    // Filter strength is set once, while the window is still neutral.
    overlay.style.setProperty('--cue-blur-max', blur + 'px');
    overlay.style.setProperty('--cue-saturation-min', String(saturation));
    overlay.dataset.style = style; overlay.dataset.intensity = String(intensity);
    state = 'entering'; paint(0);
    invoke('ready_visual_hint', {revision: revision}).then(function () {
      if (revision !== value.revision || state !== 'entering') return;
      animate(1, reduced() ? 150 : fadeIn * (combo ? 2 : 1), function () {
        state = 'held'; paint(1); trace('held');
        if (!value.held) expiry = setTimeout(function () { release(value.revision); }, value.preview_hold_ms || 1200);
      }, function () { trace('shown'); });
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
