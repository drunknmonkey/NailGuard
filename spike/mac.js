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
  let activeTab = 'focus', reviewData = null, selectedDay = '', lastReview = 0;
  let sound = {enabled:false,preset:0,volume:0.35};
  function invoke(command, args) {
    if (!window.__TAURI__?.core) return Promise.reject(new Error('offline'));
    return window.__TAURI__.core.invoke(command, args);
  }
  function showError(key) { $('error').textContent = copy[key]; $('error').hidden = false; }
  function tab(name) {
    activeTab = name;
    for (const view of ['focus','review','settings']) $(view+'View').hidden = name !== view;
    $('reviewTab').setAttribute('aria-pressed', String(name === 'review'));
    if (name === 'review') refreshReview();
    $('focusTab').setAttribute('aria-pressed', String(name === 'focus'));
    $('settingsTab').setAttribute('aria-pressed', String(name === 'settings'));
  }
  function render() {
    let title = 'readyTitle', description = 'readyText', chip = 'ready', action = 'start';
    const status = state.status;
    if (status === 2) {
      title = state.hintActive ? 'cueTitle' : 'activeTitle';
      description = state.hintActive ? 'cueText' : 'activeText'; chip = 'active'; action = 'pause';
    } else if (status === 12) { title = 'trackingTitle'; description = 'trackingText'; chip = 'attention'; action = 'pause'; } else if (status === 3) { title = 'pausedTitle'; description = 'pausedText'; chip = 'paused'; action = 'resume'; }
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
    $('snoozeSelect').disabled = busy || ![2,9,12].includes(status);
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
    $('soundPreset').replaceChildren(...copy.sounds.map((text,value) => {
      const option = document.createElement('option'); option.value = String(value); option.textContent = text; return option;
    }));
    renderSound();
    $('language').textContent = locale === 'de' ? 'EN' : 'DE'; render(); renderReview();
  }
  async function refresh() {
    if (polling) return;
    polling = true;
    try {
      const value = await invoke('native_snapshot');
      if (value && typeof value.status === 'number') { state = value; failures = 0; render(); if (activeTab === 'review' && Date.now()-lastReview > 3000) await refreshReview(); }
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
  function renderSound() {
    $('soundToggle').checked = sound.enabled; $('soundPreset').value = String(sound.preset);
    $('soundVolume').value = sound.volume; $('soundVolumeValue').textContent = Math.round(sound.volume*100)+'%';
  }
  function soundFromUI(preview) {
    const value = {enabled:$('soundToggle').checked,preset:Number($('soundPreset').value),volume:Number($('soundVolume').value),preview};
    return perform(async () => { await invoke('native_sound', value); if (!preview) sound = value; renderSound(); });
  }
  for (const id of ['soundToggle','soundPreset','soundVolume']) $(id).addEventListener('change', () => soundFromUI(false));
  $('soundVolume').addEventListener('input', () => { $('soundVolumeValue').textContent = Math.round(Number($('soundVolume').value)*100)+'%'; });
  $('testSound').addEventListener('click', () => soundFromUI(true));
  async function refreshReview() {
    lastReview = Date.now();
    try { reviewData = JSON.parse(await invoke('native_review')); renderReview(); }
    catch (_) { showError('connectionError'); }
  }
  const duration = seconds => Math.floor(seconds/3600) > 0 ? Math.floor(seconds/3600)+' h '+Math.floor(seconds%3600/60)+' min' : Math.floor(seconds/60)+' min';
  function renderReview() {
    if (!reviewData?.days || !reviewData.today) return;
    const keys = [...new Set([reviewData.today,...Object.keys(reviewData.days)])].sort().reverse();
    if (!keys.includes(selectedDay)) selectedDay = reviewData.today;
    $('reviewDate').replaceChildren(...keys.map(day => {
      const option = document.createElement('option'); option.value = day;
      option.textContent = new Date(day+'T12:00:00').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'}); return option;
    }));
    $('reviewDate').value = selectedDay;
    const day = reviewData.days[selectedDay] || {moments:0,observedSeconds:0,longestQuietSeconds:0,hourly:Array(24).fill(0)};
    $('reviewSummary').textContent = day.observedSeconds > 0 || day.moments > 0 ? day.moments+' '+copy.momentsText+' · '+duration(day.observedSeconds)+' '+copy.observed.toLowerCase() : copy.noReview;
    $('observedTime').textContent = duration(day.observedSeconds); $('quietTime').textContent = duration(day.longestQuietSeconds);
    const maximum = Math.max(1,...day.hourly);
    $('hourBars').replaceChildren(...day.hourly.map((count,hour) => {
      const bar = document.createElement('span'); bar.className='hour-bar'; bar.setAttribute('style','--bar:'+Math.round(count/maximum*100)+'%');
      bar.setAttribute('title',hour+':00 · '+count); return bar;
    }));
    $('hourBars').setAttribute('aria-label',day.hourly.map((count,hour)=>hour+':00: '+count).join(', '));
    let streak = 0, cursor = reviewData.today;
    if (!reviewData.days[cursor] || reviewData.days[cursor].observedSeconds < 600) cursor = reviewData.yesterday;
    while (reviewData.days[cursor]?.observedSeconds >= 600 && reviewData.days[cursor].moments < 5) {
      streak++; const date = new Date(cursor+'T12:00:00'); date.setDate(date.getDate()-1);
      cursor = date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
    }
    $('reviewStreak').textContent = streak+' '+copy.streakText;
  }
  $('reviewDate').addEventListener('change', () => { selectedDay = $('reviewDate').value; renderReview(); });
  $('focusTab').addEventListener('click', () => tab('focus'));
  $('reviewTab').addEventListener('click', () => tab('review'));
  $('settingsTab').addEventListener('click', () => tab('settings'));
  $('hintSettings').addEventListener('click', () => { tab('settings'); $('hintStyle').focus(); });
  $('primaryAction').addEventListener('click', () => {
    if ([2,3,12].includes(state.status)) perform(() => invoke('native_control', {action:'pause'}));
    else chooseCamera();
  });
  for (const id of ['chooseCamera','settingsChooseCamera']) $(id).addEventListener('click', chooseCamera);
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
      const savedSound = JSON.parse(await invoke('native_sound_settings'));
      if (typeof savedSound.enabled === 'boolean') sound = savedSound;
      renderSound();
      await syncHint(); await invoke('native_control', {action:sensitivity}); await refresh(); reportVisibility();
    } catch (_) { showError('connectionError'); }
  })();
  setInterval(refresh, 600);
})();
