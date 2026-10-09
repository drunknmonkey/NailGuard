/* One animation clock owns both entrance and release. Camera detection is native. */
(function () {
  "use strict";
  var overlay = document.getElementById("hintOverlay");
  var styles = ["lavender-vignette", "soft-focus", "desaturate", "ambient-glow", "wash-focus"];
  var revision = 0, frame = null, expiry = null, level = 0;
  var fadeOut = 450, blur = 2.7, saturation = 0.56, combo = false;
  var state = "idle";
  function bounded(value, min, max, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function invoke(name, args) {
    var core = window.__TAURI__ && window.__TAURI__.core;
    return core ? core.invoke(name, args).catch(function () {}) : Promise.resolve();
  }
  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (expiry !== null) clearTimeout(expiry);
    frame = null; expiry = null;
  }
  function paint(value) {
    level = value;
    var focus = combo ? Math.max(0, value * 2 - 1) : value;
    overlay.style.setProperty('--cue-level', String(value));
    overlay.style.setProperty('--cue-color', String(combo ? Math.min(1, value * 2) : value));
    overlay.style.setProperty('--cue-focus', String(focus));
    overlay.style.setProperty('--cue-blur', (blur * focus) + 'px');
    overlay.style.setProperty('--cue-saturation', String(1 - (1 - saturation) * value));
    overlay.dataset.phase = state;
  }
  function animate(target, duration, done) {
    cancel();
    var from = level, start = performance.now(), token = revision;
    function tick(now) {
      if (token !== revision) return;
      var progress = Math.min(1, Math.max(0, (now - start) / duration));
      var ease = progress * progress * (3 - 2 * progress);
      paint(from + (target - from) * ease);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { frame = null; done(); }
    }
    frame = requestAnimationFrame(tick);
  }
  function release(token) {
    if (!Number.isSafeInteger(token) || token < revision) return;
    if (state === 'idle') { revision = token; return; }
    if (token === revision && state === 'releasing') return;
    revision = token;
    state = 'releasing';
    // Cancel the entrance, including the delayed focus stage. Never restart it.
    animate(0, reduced() ? 150 : fadeOut, function () {
      state = 'idle'; paint(0);
      invoke('complete_visual_hint', {revision: token});
    });
  }
  function show(value) {
    if (!value || !Number.isSafeInteger(value.revision) || value.revision <= revision) return;
    cancel(); revision = value.revision;
    var style = styles.indexOf(value.style) >= 0 ? value.style : styles[0];
    var intensity = Math.round(bounded(value.intensity, 1, 3, 2));
    var tuning = value.animation || {};
    combo = style === 'wash-focus';
    blur = bounded(tuning.blur, 0.5, 10, [1.4, 2.7, 4.4][intensity - 1]);
    saturation = [0.76, 0.56, 0.34][intensity - 1];
    var fadeIn = bounded(tuning.fadeIn, 150, 3000, 650);
    fadeOut = bounded(tuning.fadeOut, 150, 3000, 450);
    overlay.dataset.style = style; overlay.dataset.intensity = String(intensity);
    state = 'entering'; paint(0);
    invoke('ready_visual_hint', {revision: revision}).then(function () {
      if (revision !== value.revision || state !== 'entering') return;
      animate(1, reduced() ? 150 : fadeIn * (combo ? 2 : 1), function () {
        state = 'held'; paint(1);
        if (!value.held) expiry = setTimeout(function () { release(value.revision); }, value.preview_hold_ms || 1200);
      });
    });
  }
  function install(attempt) {
    var api = window.__TAURI__ && window.__TAURI__.event;
    if (api && typeof api.listen === 'function') {
      api.listen('tawel:hint-clear', function (event) { release(event.payload); });
      api.listen('tawel:visual-hint', function (event) { show(event.payload); });
    } else if (attempt < 40) setTimeout(function () { install(attempt + 1); }, 50);
  }
  paint(0); install(0);
  window.__tawelHintOverlay = {show: show, styles: styles.slice()};
})();
