(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  let locale = read('nail-guard.locale.v1', 'de') === 'en' ? 'en' : 'de';
  let copy = window.TAWEL_MAC_COPY[locale];
  const aliases = {ring:'lavender-vignette', vignette:'lavender-vignette', wash:'ambient-glow'};
  let style = read('tawel.alpha.hint-style.v1', 'lavender-vignette');
  style = aliases[style] || style;
  if (!copy.styles[style]) style = 'lavender-vignette';
  let intensity = Number(read('tawel.alpha.hint-intensity.v1', '2'));
  if (![1,2,3].includes(intensity)) intensity = 2;
  let sensitivity = read('tawel.native.sensitivity.v1', 'native_medium');
  if (!['native_less','native_medium','native_more'].includes(sensitivity)) sensitivity = 'native_medium';
  let state = {enabled:false, status:0, camera:'', hintActive:false, snoozeUntil:null};
  let busy = false, polling = false, failures = 0;
  function invoke(command, args) {
    if (!window.__TAURI__?.core) return Promise.reject(new Error('offline'));
    return window.__TAURI__.core.invoke(command, args);
  }
  function showError(key) { $('error').textContent = copy[key]; $('error').hidden = false; }
  function tab(name) {
    $('focusView').hidden = name !== 'focus'; $('settingsView').hidden = name !== 'settings';
    $('focusTab').setAttribute('aria-pressed', String(name === 'focus'));
    $('settingsTab').setAttribute('aria-pressed', String(name === 'settings'));
  }
  function render() {
    let title = 'readyTitle', description = 'readyText', chip = 'ready', action = 'start';
    const status = state.status;
    if (status === 2) {
      title = state.hintActive ? 'cueTitle' : 'activeTitle';
      description = state.hintActive ? 'cueText' : 'activeText'; chip = 'active'; action = 'pause';
    } else if (status === 3) { title = 'pausedTitle'; description = 'pausedText'; chip = 'paused'; action = 'resume'; }
    else if ([1,9,11].includes(status)) { title = 'waitingTitle'; description = status === 11 ? 'chooseText' : 'waitingText'; chip = status === 11 ? 'choose' : 'waiting'; }
    else if (status === 4) { title = 'deniedTitle'; description = 'deniedText'; chip = 'attention'; action = 'retry'; }
    else if ([5,10].includes(status)) { title = 'unavailableTitle'; description = 'unavailableText'; chip = 'attention'; action = 'retry'; }
    else if (status === 6) { title = 'errorTitle'; description = 'errorText'; chip = 'attention'; action = 'retry'; }
    else if (status === 8) { title = 'sleepTitle'; description = 'sleepText'; chip = 'paused'; }
    document.body.dataset.status = chip;
    document.body.dataset.hint = String(state.hintActive);
    $('focusTitle').textContent = copy[title]; $('focusDescription').textContent = copy[description];
    if (status === 3 && state.snoozeUntil > Date.now()) $('focusDescription').textContent = copy.snoozeText + ' ' + new Date(state.snoozeUntil).toLocaleTimeString(locale, {hour:'2-digit',minute:'2-digit'}) + '.';
    $('statusChip').textContent = copy[chip];
    $('primaryAction').textContent = copy[action];
    $('primaryAction').disabled = busy || [1,9,11,8].includes(status);
    for (const id of ['chooseCamera','settingsChooseCamera']) $(id).disabled = busy || [1,11].includes(status);
    $('snoozeSelect').disabled = busy || ![2,9].includes(status);
    const camera = !state.camera || state.camera === 'Noch keine Kamera gewählt' ? copy.noCamera : state.camera;
    $('cameraName').textContent = camera; $('settingsCamera').textContent = camera;
    $('currentHint').textContent = copy.styles[style] + ' · ' + copy[['light','medium','strong'][intensity-1]];
    $('intensityValue').textContent = copy[['light','medium','strong'][intensity-1]];
  }
  function translate() {
    copy = window.TAWEL_MAC_COPY[locale]; document.documentElement.lang = locale;
    document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = copy[el.dataset.copy]; });
    $('hintStyle').replaceChildren(...Object.entries(copy.styles).map(([value,text]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; return option;
    }));
    $('hintStyle').value = style; $('hintIntensity').value = intensity; $('sensitivity').value = sensitivity;
    $('language').textContent = locale === 'de' ? 'EN' : 'DE'; render();
  }
  async function refresh() {
    if (polling) return;
    polling = true;
    try {
      const value = await invoke('native_snapshot');
      if (value && typeof value.status === 'number') { state = value; failures = 0; render(); }
    } catch (_) { if (++failures >= 3) { showError('connectionError'); $('statusChip').textContent = '—'; } }
    finally { polling = false; }
  }
  async function perform(fn) {
    if (busy) return;
    busy = true; $('error').hidden = true; render();
    try { await fn(); await refresh(); } catch (_) { showError('actionError'); }
    finally { busy = false; render(); }
  }
  const config = () => ({style, intensity});
  function chooseCamera() { return perform(() => invoke('native_start', config())); }
  function preview() { return invoke('show_visual_hint', config()); }
  async function syncHint() {
    save('tawel.alpha.hint-style.v1', style); save('tawel.alpha.hint-intensity.v1', String(intensity));
    render(); await invoke('alpha_hint_style', config());
  }
  $('focusTab').addEventListener('click', () => tab('focus'));
  $('settingsTab').addEventListener('click', () => tab('settings'));
  $('hintSettings').addEventListener('click', () => { tab('settings'); $('hintStyle').focus(); });
  $('primaryAction').addEventListener('click', () => {
    if (state.status === 2 || state.status === 3) perform(() => invoke('native_control', {action:'pause'}));
    else chooseCamera();
  });
  for (const id of ['chooseCamera','settingsChooseCamera']) $(id).addEventListener('click', chooseCamera);
  $('background').addEventListener('click', () => perform(() => invoke('background_app')));
  $('snoozeSelect').addEventListener('change', () => {
    const minutes = $('snoozeSelect').value; $('snoozeSelect').value = '';
    if (['15','30','60'].includes(minutes)) perform(() => invoke('native_control', {action:'snooze_' + minutes}));
  });
  $('preview').addEventListener('click', () => perform(preview));
  $('hintStyle').addEventListener('change', () => { style = $('hintStyle').value; perform(async () => { await syncHint(); await preview(); }); });
  $('hintIntensity').addEventListener('input', () => { intensity = Number($('hintIntensity').value); render(); });
  $('hintIntensity').addEventListener('change', () => perform(async () => { await syncHint(); await preview(); }));
  $('sensitivity').addEventListener('change', () => perform(async () => {
    const value = $('sensitivity').value; await invoke('native_control', {action:value});
    sensitivity = value; save('tawel.native.sensitivity.v1', value);
  }));
  $('language').addEventListener('click', () => { locale = locale === 'de' ? 'en' : 'de'; save('nail-guard.locale.v1', locale); translate(); });
  document.addEventListener('keydown', event => {
    if (event.metaKey && event.key === ',') { event.preventDefault(); tab('settings'); }
  });
  const reportVisibility = () => invoke('spike_state', {visibility:document.visibilityState, hasFocus:document.hasFocus()}).catch(() => {});
  document.addEventListener('visibilitychange', () => { reportVisibility(); refresh(); });
  window.addEventListener('focus', () => { reportVisibility(); refresh(); });
  window.addEventListener('blur', reportVisibility);
  translate();
  (async () => {
    try {
      await window.__TAURI__.event.listen('tawel:control', event => {
        if (event.payload === 'settings') tab('settings');
        if (event.payload === 'open') tab('focus');
        if (event.payload === 'hint_preview') perform(preview);
        refresh();
      });
      await syncHint(); await invoke('native_control', {action:sensitivity}); await refresh(); reportVisibility();
    } catch (_) { showError('connectionError'); }
  })();
  setInterval(refresh, 600);
})();
