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
  const animationDefaults = {blur:2.7, fadeIn:650, fadeOut:450};
  let animation = {...animationDefaults};
  try {
    const stored = JSON.parse(read('tawel.alpha.blur-animation.v1', '{}'));
    for (const [key,min,max] of [['blur',0.5,10],['fadeIn',150,3000],['fadeOut',150,3000]]) {
      if (Number.isFinite(stored[key])) animation[key] = Math.max(min,Math.min(max,stored[key]));
    }
  } catch (_) {}
  // Native cue renderer (Core Animation) versus the WebView overlay – comparable on hardware (0.1.32).
  let nativeCue = read('tawel.alpha.hint-renderer.v1', 'web') === 'native';
  let sensitivity = read('tawel.native.sensitivity.v1', 'native_medium');
  if (!['native_less','native_medium','native_more'].includes(sensitivity)) sensitivity = 'native_medium';
  let state = {enabled:false, status:0, camera:'', hintActive:false, snoozeUntil:null};
  let busy = false, polling = false, failures = 0;
  let settingsPanel = 'detection';
  let rateSample = null, analysisRate = 0, pendingQuality = null;
  let activeTab = 'focus', reviewData = null, selectedDay = '', lastReview = 0;
  let sound = {enabled:false,preset:0,volume:0.35};
  function invoke(command, args) {
    if (!window.__TAURI__?.core) return Promise.reject(new Error('offline'));
    return window.__TAURI__.core.invoke(command, args);
  }
  function showError(key) { $('error').textContent = copy[key]; $('error').hidden = false; }
  function tab(name) {
    activeTab = name;
    clearCameraPreview();
    for (const view of ['focus','review','settings']) $(view+'View').hidden = name !== view;
    $('reviewTab').setAttribute('aria-pressed', String(name === 'review'));
    if (name === 'review') refreshReview();
    $('focusTab').setAttribute('aria-pressed', String(name === 'focus'));
    $('settingsTab').setAttribute('aria-pressed', String(name === 'settings'));
  }
  // Preview polls at camera pace; a momentary empty answer keeps the last image
  // for a short grace period instead of flashing the waiting message.
  const PREVIEW_POLL_MS = 40, PREVIEW_GRACE_MS = 1000;
  let previewGeneration = 0, previewPolling = false, lastPreviewTimestamp = null, lastPreviewShownAt = -Infinity;
  function clearCameraPreview() {
    previewGeneration++;
    lastPreviewTimestamp = null; lastPreviewShownAt = -Infinity;
    $('cameraFrame').hidden = true; $('cameraImage').removeAttribute('src');
    $('cameraLandmarks').replaceChildren();
    $('cameraPreviewMessage').hidden = false;
    $('cameraPreviewMessage').textContent = copy[$('cameraPreviewToggle').checked ? 'previewWaiting' : 'previewOff'];
    invoke('native_preview', {enabled:false}).catch(() => {});
  }
  for (const name of ['detection','hints','animation','performance','camera']) $(name+'Section').addEventListener('click', () => {
    settingsPanel = name;
    for (const panel of ['detection','hints','animation','performance','camera']) {
      $(panel+'Panel').hidden = panel !== name;
      $(panel+'Section').setAttribute('aria-pressed', String(panel === name));
    }
    clearCameraPreview();
  });
  $('cameraPreviewToggle').addEventListener('change', clearCameraPreview);
  async function refreshCameraPreview() {
    if (previewPolling || activeTab !== 'settings' || settingsPanel !== 'camera' || !$('cameraPreviewToggle').checked || document.visibilityState !== 'visible') return;
    previewPolling = true;
    const generation = previewGeneration;
    try {
      const frame = JSON.parse(await invoke('native_preview', {enabled:true}));
      if (generation !== previewGeneration) return;
      if (!frame.image) {
        if (performance.now() - lastPreviewShownAt < PREVIEW_GRACE_MS) return;
        $('cameraFrame').hidden=true; $('cameraImage').removeAttribute('src'); $('cameraLandmarks').replaceChildren(); $('cameraPreviewMessage').hidden=false; return;
      }
      if (frame.timestamp != null && frame.timestamp === lastPreviewTimestamp) return;
      const img = new Image();
      await new Promise(resolve => {
      const timeout = setTimeout(() => { img.onload = null; img.onerror = null; resolve(); }, 750);
      const finish = () => { clearTimeout(timeout); resolve(); };
      img.onerror = finish;
      img.onload = () => {
        if (generation !== previewGeneration) { finish(); return; }
        lastPreviewTimestamp = frame.timestamp;
        $('cameraImage').src = img.src;
        const box = $('cameraFrame').parentElement;
        const scale = Math.min(box.clientWidth/frame.width, box.clientHeight/frame.height);
        $('cameraFrame').style.width = Math.floor(frame.width*scale)+'px';
        $('cameraFrame').style.height = Math.floor(frame.height*scale)+'px';
        const svg = $('cameraLandmarks'); svg.replaceChildren();
        const point = p => [p[0]*1000,(1-p[1])*1000];
        const add = (tag, attrs) => { const el = document.createElementNS('http://www.w3.org/2000/svg',tag); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,String(v)); svg.appendChild(el); };
        for (const chain of frame.chains || []) {
          add('polyline',{points:chain.map(p=>point(p).join(',')).join(' ')});
          for (const p of chain) { const [cx,cy]=point(p); add('circle',{cx,cy,r:5}); }
        }
        if (frame.mouth?.length) {
          add('polyline',{points:[...frame.mouth,frame.mouth[0]].map(p=>point(p).join(',')).join(' ')});
          const [cx,cy]=point(frame.center); add('circle',{cx,cy,r:7});
          for (const p of frame.tips || []) { const [x1,y1]=point(p); add('line',{x1,y1,x2:cx,y2:cy,class:'distance'}); }
        }
        $('cameraFrame').hidden=false; $('cameraPreviewMessage').hidden=true;
        lastPreviewShownAt = performance.now();
        finish();
      };
      img.src = 'data:image/jpeg;base64,'+frame.image;
      });
    } catch (_) { if (generation === previewGeneration) clearCameraPreview(); }
    finally { previewPolling=false; }
  }
  function render() {
    let title = 'readyTitle', description = 'readyText', chip = 'ready', action = 'start';
    const status = state.status;
    if (status === 2) {
      title = state.hintActive ? 'cueTitle' : 'activeTitle';
      description = state.hintActive ? 'cueText' : 'activeText'; chip = 'active'; action = 'pause';
    } else if (status === 12) { title = 'trackingTitle'; description = 'trackingText'; chip = 'attention'; action = 'pause'; } else if (status === 13 || status === 14) { title = status === 13 ? 'handTrackingTitle' : 'analysisWaitingTitle'; description = status === 13 ? 'handTrackingText' : 'analysisWaitingText'; chip = 'attention'; action = 'pause'; } else if (status === 3) { title = 'pausedTitle'; description = 'pausedText'; chip = 'paused'; action = 'resume'; }
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
    for (const id of ['settingsChooseCamera']) $(id).disabled = busy || [1,11].includes(status);
    $('snoozeSelect').disabled = busy || ![2,9,12,13,14].includes(status);
    const camera = !state.camera || state.camera === 'Noch keine Kamera gewählt' ? copy.noCamera : state.camera;
    $('settingsCamera').textContent = camera;
    const p = state.performance || {}, profile = pendingQuality ?? p.profile ?? 3;
    $('cameraQuality').value = String(profile & 1);
    $('fingerFallback').checked = Boolean(profile & 2);
    $('cameraQuality').disabled = busy || [1,9,11,8].includes(status);
    $('fingerFallback').disabled = busy;
    const now = Date.now();
    if (Number.isFinite(p.frames)) {
      if (rateSample && now-rateSample.time >= 2000) {
        analysisRate = Math.max(0,p.frames-rateSample.frames)/((now-rateSample.time)/1000);
        rateSample = {time:now,frames:p.frames};
      } else if (!rateSample) rateSample = {time:now,frames:p.frames};
    }
    $('actualResolution').textContent = p.width ? p.width+' × '+p.height : '—';
    $('analysisRate').textContent = [2,12,13].includes(status) ? analysisRate.toLocaleString(locale,{maximumFractionDigits:1}) : '—';
    $('analysisTime').textContent = [2,12,13].includes(status) && p.inferenceMs != null ? p.inferenceMs+' ms' : '—';
    $('cpuLoad').textContent = p.cpuPercent == null ? '—' : p.cpuPercent.toLocaleString(locale,{maximumFractionDigits:1})+' %';
    $('thermal').textContent = copy.thermalStates[p.thermal] || '—';
    $('intensityValue').textContent = copy[['light','medium','strong'][intensity-1]];
    for (const key of ['blur','fadeIn','fadeOut']) {
      $(key).value = animation[key];
      $(key+'Value').textContent = key === 'blur' ? animation[key].toLocaleString(locale)+' px' : (animation[key]/1000).toLocaleString(locale,{maximumFractionDigits:2})+' s';
    }
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
    $('cameraPreviewMessage').textContent = copy[$('cameraPreviewToggle').checked ? 'previewWaiting' : 'previewOff'];
    $('language').textContent = locale === 'de' ? 'EN' : 'DE'; render(); renderReview();
  }
  async function refresh() {
    if (polling) return;
    polling = true;
    try {
      const value = await invoke('native_snapshot');
      if (value && typeof value.status === 'number') { state = value; if (state.performance?.profile === pendingQuality) pendingQuality = null; failures = 0; render(); if (activeTab === 'review' && Date.now()-lastReview > 3000) await refreshReview(); }
    } catch (_) { if (++failures >= 3) { showError('connectionError'); $('statusChip').textContent = '—'; } }
    finally { polling = false; }
  }
  async function perform(fn) {
    if (busy) return;
    busy = true; $('error').hidden = true; render();
    try { await fn(); await refresh(); } catch (_) { showError('actionError'); }
    finally { busy = false; render(); }
  }
  const config = () => ({style, intensity, animation});
  function chooseCamera() { return perform(() => invoke('native_start', config())); }
  function preview() { return invoke('show_visual_hint', config()); }
  async function syncHint() {
    save('tawel.alpha.blur-animation.v1', JSON.stringify(animation));
    save('tawel.alpha.hint-style.v1', style); save('tawel.alpha.hint-intensity.v1', String(intensity));
    save('tawel.alpha.hint-renderer.v1', nativeCue ? 'native' : 'web');
    $('nativeCueToggle').checked = nativeCue;
    render(); await invoke('alpha_hint_renderer', {native: nativeCue}); await invoke('alpha_hint_style', config());
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
  const duration = seconds => Math.floor(seconds/3600) > 0 ? Math.floor(seconds/3600)+' h'+(Math.floor(seconds%3600/60) ? ' '+Math.floor(seconds%3600/60)+' min' : '') : Math.floor(seconds/60)+' min';
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
    $('reviewSummary').textContent = day.observedSeconds > 0 || day.moments > 0 ? day.moments+' '+copy.momentsText+' · '+duration(day.observedSeconds)+' '+copy.observed : copy.noReview;
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
    $('reviewStreak').textContent = streak+' '+(streak === 1 ? copy.streakOne : copy.streakText);
  }
  $('reviewDate').addEventListener('change', () => { selectedDay = $('reviewDate').value; renderReview(); });
  $('focusTab').addEventListener('click', () => tab('focus'));
  $('reviewTab').addEventListener('click', () => tab('review'));
  $('settingsTab').addEventListener('click', () => tab('settings'));
  $('primaryAction').addEventListener('click', () => {
    if ([2,3,12,13,14].includes(state.status)) perform(() => invoke('native_control', {action:'pause'}));
    else chooseCamera();
  });
  for (const id of ['settingsChooseCamera']) $(id).addEventListener('click', chooseCamera);
  $('snoozeSelect').addEventListener('change', () => {
    const minutes = $('snoozeSelect').value; $('snoozeSelect').value = '';
    if (['15','30','60'].includes(minutes)) perform(() => invoke('native_control', {action:'snooze_' + minutes}));
  });
  function changeQuality() {
    const detail = $('cameraQuality').value === '1', fallback = $('fingerFallback').checked;
    pendingQuality = (detail ? 1 : 0) + (fallback ? 2 : 0);
    return perform(async () => {
      try { await invoke('native_quality', {detail,fallback}); }
      catch (error) { pendingQuality = null; throw error; }
    });
  }
  $('cameraQuality').addEventListener('change', changeQuality);
  $('fingerFallback').addEventListener('change', changeQuality);
  $('preview').addEventListener('click', () => perform(preview));
  const animationPreview = () => invoke('show_visual_hint', {...config(),style:['soft-focus','wash-focus'].includes(style) ? style : 'soft-focus'});
  $('animationPreview').addEventListener('click', () => perform(animationPreview));
  for (const key of ['blur','fadeIn','fadeOut']) {
    $(key).addEventListener('input', () => { animation[key] = Number($(key).value); render(); });
    $(key).addEventListener('change', () => perform(async () => { await syncHint(); await animationPreview(); }));
  }
  $('animationReset').addEventListener('click', () => perform(async () => { animation = {...animationDefaults}; await syncHint(); await animationPreview(); }));
  $('hintStyle').addEventListener('change', () => { style = $('hintStyle').value; perform(async () => { await syncHint(); await preview(); }); });
  $('hintIntensity').addEventListener('input', () => { intensity = Number($('hintIntensity').value); render(); });
  $('hintIntensity').addEventListener('change', () => perform(async () => { await syncHint(); await preview(); }));
  $('nativeCueToggle').addEventListener('change', () => { nativeCue = $('nativeCueToggle').checked; perform(async () => { await syncHint(); await preview(); }); });
  $('sensitivity').addEventListener('change', () => perform(async () => {
    const value = $('sensitivity').value; await invoke('native_control', {action:value});
    sensitivity = value; save('tawel.native.sensitivity.v1', value);
  }));
  $('language').addEventListener('click', () => { locale = locale === 'de' ? 'en' : 'de'; save('nail-guard.locale.v1', locale); translate(); });
  document.addEventListener('keydown', event => {
    if (event.metaKey && event.key === ',') { event.preventDefault(); tab('settings'); }
  });
  const reportVisibility = () => invoke('spike_state', {visibility:document.visibilityState, hasFocus:document.hasFocus()}).catch(() => {});
  document.addEventListener('visibilitychange', () => { clearCameraPreview(); reportVisibility(); refresh(); });
  window.addEventListener('focus', () => { clearCameraPreview(); reportVisibility(); refresh(); });
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
  setInterval(refreshCameraPreview, PREVIEW_POLL_MS);
})();
