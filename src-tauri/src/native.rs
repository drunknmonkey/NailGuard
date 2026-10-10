//! Nativer, ausdrücklich wählbarer Testpfad; benötigt kein laufendes WebView.
use super::*;
use std::sync::{OnceLock, atomic::AtomicI32};

static APP: OnceLock<AppHandle> = OnceLock::new();
#[cfg(target_os = "macos")]
extern "C" {
    fn tawel_native_preview(enabled: i32) -> *mut std::ffi::c_char;
    fn tawel_native_review() -> *mut std::ffi::c_char;
    fn tawel_native_sound_settings() -> *mut std::ffi::c_char;
    fn tawel_native_sound(enabled: i32, preset: i32, volume: f64, preview: i32);
    fn tawel_native_flush();
    fn tawel_background_notice();
    fn tawel_native_register(callback: extern "C" fn(i32, f64, f64));
    fn tawel_native_start();
    fn tawel_native_quality(detail: i32, fallback: i32);
    fn tawel_native_choose_camera();
    fn tawel_native_camera_name() -> *mut std::ffi::c_char;
    fn tawel_native_free_string(pointer: *mut std::ffi::c_char);
    fn tawel_native_pause();
    fn tawel_native_stop();
    fn tawel_native_snooze(seconds: f64);
    fn tawel_native_sensitivity(radius: f64);
    fn tawel_native_cue_register(callback: extern "C" fn(i32, f64, f64));
    fn tawel_native_cue_show(style: i32, intensity: i32, blur: f64, fade_in_ms: f64, hold_ms: f64, fade_out_ms: f64, revision: f64);
    fn tawel_native_cue_cancel();
    fn tawel_native_cue_available() -> i32;
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Performance {
    cpu_percent: f64, peak_rss_mb: f64, thermal: i32, profile: i32,
    width: u32, height: u32, face_ms: f64, hand_ms: f64,
    sound_requests: u64, sound_started: u64, sound_failed: u64, sound_start_ms: f64,
    visual_presentations: u64, visual_dispatch_ms: f64,
    source_width: u32, source_height: u32, prepare_ms: f64,
    reason: i32, phase: i32, valid_points: u32, fallback_points: u32,
    reason_counts: [u64; 8],
    frames: u64, inference_ms: u64, sound_enabled: bool, sound_volume: f64,
}
impl Performance {
    fn csv(&self) -> Vec<String> {
        vec![format!("{:.1}",self.cpu_percent),format!("{:.1}",self.peak_rss_mb),self.thermal.to_string(),self.profile.to_string(),
            self.width.to_string(),self.height.to_string(),format!("{:.1}",self.face_ms),format!("{:.1}",self.hand_ms),
            self.sound_requests.to_string(),self.sound_started.to_string(),self.sound_failed.to_string(),format!("{:.1}",self.sound_start_ms),
            self.visual_presentations.to_string(),format!("{:.1}",self.visual_dispatch_ms),self.sound_enabled.to_string(),format!("{:.2}",self.sound_volume),self.source_width.to_string(),self.source_height.to_string(),format!("{:.1}",self.prepare_ms),
            self.reason.to_string(),self.phase.to_string(),self.valid_points.to_string(),self.fallback_points.to_string()]
            .into_iter().chain(self.reason_counts[1..].iter().map(|v| v.to_string())).collect()
    }
}
pub struct NativeState {
    performance: Mutex<Performance>,
    enabled: AtomicBool,
    hint_active: AtomicBool,
    tracking_uncertain: AtomicBool,
    tracking_problem: AtomicI32,
    snooze_until: Mutex<Option<i64>>,
    status: AtomicI32,
    raw_frames: AtomicU64,
    vision_started: AtomicU64,
    face_finished: AtomicU64,
    hands_finished: AtomicU64,
    queue_ticks: AtomicU64,
    restarts: AtomicU64,
    stage: AtomicI32,
    connection: AtomicI32, device_source: AtomicI32, interrupted: AtomicI32,
    runtime_error: AtomicI32, device_flags: AtomicI32, dropped: AtomicU64,
    last_raw: Mutex<Option<Instant>>,
    faces: AtomicU64, hands: AtomicU64, distance_milli: AtomicI32,
    frames: AtomicU64,
    inference_ms: AtomicU64, inference_max_ms: AtomicU64,
    preview_ms: AtomicU64, preview_max_ms: AtomicU64,
    errors: AtomicU64,
    hints: AtomicU64,
    last_frame: Mutex<Option<Instant>>,
    hint: Mutex<(String, u8)>,
}

pub fn install(app: &AppHandle) {
    app.manage(NativeState {
        performance: Mutex::new(Performance { profile: 3, ..Performance::default() }),
        tracking_problem: AtomicI32::new(0), tracking_uncertain: AtomicBool::new(false), hint_active: AtomicBool::new(false), snooze_until: Mutex::new(None),
        enabled: AtomicBool::new(false), status: AtomicI32::new(0),
        raw_frames: AtomicU64::new(0), vision_started: AtomicU64::new(0),
        face_finished: AtomicU64::new(0), hands_finished: AtomicU64::new(0),
        queue_ticks: AtomicU64::new(0), restarts: AtomicU64::new(0),
        connection: AtomicI32::new(-1), device_source: AtomicI32::new(0),
        interrupted: AtomicI32::new(0), runtime_error: AtomicI32::new(0),
        device_flags: AtomicI32::new(0), dropped: AtomicU64::new(0),
        stage: AtomicI32::new(0), last_raw: Mutex::new(None),
        faces: AtomicU64::new(0), hands: AtomicU64::new(0), distance_milli: AtomicI32::new(-1),
        frames: AtomicU64::new(0), errors: AtomicU64::new(0), hints: AtomicU64::new(0),
        inference_ms: AtomicU64::new(0), inference_max_ms: AtomicU64::new(0),
        preview_ms: AtomicU64::new(0), preview_max_ms: AtomicU64::new(0),
        last_frame: Mutex::new(None), hint: Mutex::new(("lavender-vignette".into(), 2)),
    });
    let _ = APP.set(app.clone());
    #[cfg(target_os = "macos")]
    unsafe { tawel_native_register(receive); tawel_native_cue_register(receive_cue); }
}

/// Stufen des nativen Hinweises (NativeCue.swift) landen im Hinweis-Log.
extern "C" fn receive_cue(stage: i32, revision: f64, auxiliary: f64) {
    let Some(app) = APP.get() else { return };
    let revision = if revision.is_finite() && revision >= 0.0 { revision as u64 } else { 0 };
    let detail = match stage {
        1 => format!("native-cue show backdrop={}", auxiliary > 0.5),
        2 => format!("native-cue committed total_ms={auxiliary:.0}"),
        3 => format!("native-cue complete elapsed_ms={auxiliary:.0}"),
        4 => "native-cue hidden".to_string(),
        5 => "native-cue superseded".to_string(),
        6 => "native-cue unavailable".to_string(),
        7 => format!("native-cue safety-net elapsed_ms={auxiliary:.0}"),
        _ => format!("native-cue stage={stage} value={auxiliary}"),
    };
    hint_log(app, revision, &detail);
}

/// Spielt den Hinweis nativ (Core Animation) ab – einmal übergeben, dann läuft er
/// unabhängig von App und WebView. Rückgabe: ob die Backdrop-Unschärfe verfügbar ist.
pub fn cue_show(style: &str, intensity: u8, blur: f64, fade_in_ms: u64, hold_ms: u64, fade_out_ms: u64, revision: u64) -> bool {
    let style_code = match style { "soft-focus" => 1, "desaturate" => 2, "ambient-glow" => 3, "wash-focus" => 4, _ => 0 };
    #[cfg(target_os = "macos")]
    unsafe {
        tawel_native_cue_show(style_code, intensity as i32, blur, fade_in_ms as f64, hold_ms as f64, fade_out_ms as f64, revision as f64);
        tawel_native_cue_available() != 0
    }
    #[cfg(not(target_os = "macos"))]
    { let _ = (style_code, intensity, blur, fade_in_ms, hold_ms, fade_out_ms, revision); false }
}
pub fn cue_cancel() { #[cfg(target_os = "macos")] unsafe { tawel_native_cue_cancel(); } }
pub fn enabled(app: &AppHandle) -> bool { app.state::<NativeState>().enabled.load(Ordering::Relaxed) }
/// Variante und Stufe für den nächsten Treffer merken. Ein laufender Hinweis
/// wird nicht umgeschaltet: Er ist ein einmaliger Impuls und klingt von selbst ab.
pub fn set_hint(app: &AppHandle, style: &str, intensity: u8) {
    if let Ok(mut hint) = app.state::<NativeState>().hint.lock() { *hint = (style.to_string(), intensity.clamp(1, 3)); }
}
pub fn hint_active(app: &AppHandle) -> bool { app.state::<NativeState>().hint_active.load(Ordering::SeqCst) }
/// Der sichtbare Hinweis verhält sich wie der Ton: Er wird beim Beginn eines
/// Treffers einmal ausgelöst (weich ein, kurz halten, weich aus) und endet von
/// selbst – unabhängig davon, wie lange die Hand im Bereich bleibt. Das Ende des
/// Treffers löst daher nichts aus; der nächste Treffer spielt ihn erneut.
fn update_hint(app: &AppHandle, active: bool) {
    if app.state::<NativeState>().hint_active.swap(active, Ordering::SeqCst) == active { return; }
    if !active { return; }
    let ui_app = app.clone();
    let requested = Instant::now();
    let _ = app.run_on_main_thread(move || {
        // Ignore an obsolete queued transition after pause/camera loss.
        if !hint_active(&ui_app) { return; }
        let hint = ui_app.state::<NativeState>().hint.lock().ok().map(|h| h.clone());
        if let Some((style, intensity)) = hint {
            if display_visual_hint(style, intensity, false, CUE_HOLD_MS, ui_app.clone()).is_ok() {
                if let Ok(mut p) = ui_app.state::<NativeState>().performance.lock() {
                    p.visual_presentations += 1; p.visual_dispatch_ms = requested.elapsed().as_secs_f64()*1000.;
                }
            }
        }
    });
}
pub fn check_hint_health(app: &AppHandle) {
    let stale = app.state::<NativeState>().last_frame.lock().ok().and_then(|t| *t)
        .map(|t| t.elapsed() > Duration::from_secs(8)).unwrap_or(true);
    if stale { update_hint(app, false); app.state::<NativeState>().tracking_uncertain.store(true, Ordering::Relaxed); }
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSnapshot {
    enabled: bool, status: i32, camera: String, hint_active: bool, snooze_until: Option<i64>,
    performance: Performance,
}
#[tauri::command]
pub fn native_snapshot(app: AppHandle) -> NativeSnapshot {
    let (enabled, status, camera) = native_info(app.clone());
    let until = app.state::<NativeState>().snooze_until.lock().ok().and_then(|u| *u);
    let age = app.state::<NativeState>().last_frame.lock().ok().and_then(|t| *t).map(|t| t.elapsed().as_millis() as i64).unwrap_or(-1);
    let status = native_health::view_status(status, age, app.state::<NativeState>().tracking_problem.load(Ordering::Relaxed));
    let state = app.state::<NativeState>();
    let mut performance = state.performance.lock().map(|p| p.clone()).unwrap_or_default();
    performance.frames = state.frames.load(Ordering::Relaxed);
    performance.inference_ms = state.inference_ms.load(Ordering::Relaxed);
    NativeSnapshot { enabled, status, camera, hint_active: hint_active(&app), snooze_until: until, performance }
}
#[tauri::command]
pub fn native_quality(app: AppHandle, detail: bool, fallback: bool) {
    #[cfg(target_os = "macos")] unsafe { tawel_native_quality(detail as i32, fallback as i32); }
    let _ = (app, detail, fallback);
}
#[tauri::command]
pub fn native_control(app: AppHandle, action: String) -> Result<(), String> {
    if !matches!(action.as_str(), "start" | "pause" | "snooze_15" | "snooze_30" | "snooze_60" | "native_stop" | "native_less" | "native_medium" | "native_more") {
        return Err("Unbekannte Aktion".into());
    }
    if handle_menu(&app, &action) { Ok(()) } else { Err("Bitte zuerst eine Kamera starten".into()) }
}
fn start_engine() { #[cfg(target_os = "macos")] unsafe { tawel_native_start(); } }

#[tauri::command]
pub fn native_start(app: AppHandle, style: String, intensity: u8) -> Result<(), String> {
    if !cfg!(target_os = "macos") { return Err("Native Erkennung benötigt macOS".into()); }
    update_hint(&app, false);
    if let Ok(mut until) = app.state::<NativeState>().snooze_until.lock() { *until = None; }
    set_hint(&app, &style, intensity);
    app.state::<NativeState>().enabled.store(true, Ordering::Relaxed);
    #[cfg(target_os = "macos")]
    unsafe { tawel_native_choose_camera(); }
    Ok(())
}

#[tauri::command]
pub fn native_info(app: AppHandle) -> (bool, i32, String) {
    let state = app.state::<NativeState>();
    let mut name = String::new();
    #[cfg(target_os = "macos")]
    unsafe {
        let pointer = tawel_native_camera_name();
        if !pointer.is_null() {
            name = std::ffi::CStr::from_ptr(pointer).to_string_lossy().into_owned();
            tawel_native_free_string(pointer);
        }
    }
    let mut status = state.status.load(Ordering::Relaxed);
    if matches!(status, 2 | 9) {
        let flags = state.device_flags.load(Ordering::Relaxed);
        let fresh = |time: &Mutex<Option<Instant>>| time.lock().ok().and_then(|t| *t)
            .map(|t| t.elapsed().as_millis() <= 3000).unwrap_or(false);
        if flags & 1 == 0 || flags & 2 != 0 { status = 5; }
        else if !fresh(&state.last_raw) || !fresh(&state.last_frame) { status = 9; }
    }
    (enabled(&app), status, name)
}

fn stop(app: &AppHandle) {
    update_hint(app, false);
    if let Ok(mut until) = app.state::<NativeState>().snooze_until.lock() { *until = None; }
    app.state::<NativeState>().enabled.store(false, Ordering::Relaxed);
    app.state::<NativeState>().status.store(0, Ordering::Relaxed);
    #[cfg(target_os = "macos")] unsafe { tawel_native_stop(); }
    let _ = app.emit_to("main", "tawel:control", "native_stop");
    let ui = app.state::<AlphaUiState>();
    let _ = ui.status_item.set_text("Status: bereit");
    let _ = ui.pause_item.set_enabled(false);
}

extern "C" fn receive(event: i32, value: f64, auxiliary: f64) {
    let Some(app) = APP.get() else { return };
    let state = app.state::<NativeState>();
    if !state.enabled.load(Ordering::Relaxed) && event < 24 { return; }
    match event {
        24..=34 => {
            if !value.is_finite() || !auxiliary.is_finite() { return; }
            if let Ok(mut p) = state.performance.lock() {
                match event {
                    24 => { p.cpu_percent = value; p.peak_rss_mb = auxiliary; }
                    25 => { p.thermal = value as i32; p.profile = auxiliary as i32; }
                    26 => { p.width = value as u32; p.height = auxiliary as u32; }
                    27 => { p.face_ms = value; p.hand_ms = auxiliary; }
                    28 => { p.sound_enabled = value > 0.; p.sound_volume = auxiliary; }
                    29 => { p.sound_requests += 1; }
                    30 => { p.sound_start_ms = value; if auxiliary > 0. { p.sound_started += 1; } else { p.sound_failed += 1; } }
                    31 => { p.source_width = value as u32; p.source_height = auxiliary as u32; }
                    32 => { p.prepare_ms = value; }
                    33 => { p.reason = value as i32; p.phase = auxiliary as i32; if (1..=7).contains(&p.reason) { let index = p.reason as usize; p.reason_counts[index] += 1; } }
                    34 => { p.valid_points = value as u32; p.fallback_points = auxiliary as u32; }
                    _ => {}
                }
            }
        }
        1 => {
            state.frames.fetch_add(1, Ordering::Relaxed);
            state.distance_milli.store(if value.is_finite() && value >= 0. { (value * 1000.).round() as i32 } else { -1 }, Ordering::Relaxed);
            if let Ok(mut last) = state.last_frame.lock() { *last = Some(Instant::now()); }
        }
        2 => { state.hints.fetch_add(1, Ordering::Relaxed); }
        20 => { update_hint(app, value > 0.); }
        21 => { state.tracking_uncertain.store(value > 0., Ordering::Relaxed); state.tracking_problem.store(auxiliary as i32, Ordering::Relaxed); }
        22 | 23 => {
            if value.is_finite() && value >= 0. {
                let millis = value.round() as u64;
                let (latest, maximum) = if event == 22 { (&state.inference_ms, &state.inference_max_ms) } else { (&state.preview_ms, &state.preview_max_ms) };
                latest.store(millis, Ordering::Relaxed); maximum.fetch_max(millis, Ordering::Relaxed);
            }
        }
        3 => {
            let status = value as i32;
            if status != 2 { update_hint(app, false); state.tracking_uncertain.store(false, Ordering::Relaxed); }
            if status != 3 { if let Ok(mut until) = state.snooze_until.lock() { *until = None; } }
            state.status.store(status, Ordering::Relaxed);
            if status == 0 { state.enabled.store(false, Ordering::Relaxed); }
            if status == 9 {
                if let Ok(mut last) = state.last_frame.lock() { *last = None; }
                if let Ok(mut last) = state.last_raw.lock() { *last = None; }
            }
            let label = match status {
                1 => "Erkennung: startet",
                2 => "Erkennung: aktiv",
                3 => "Erkennung: pausiert / Snooze",
                4 => "Erkennung: Kamerafreigabe fehlt",
                5 => "Erkennung: Kamera nicht verfügbar",
                6 => "Erkennung: Kamerastart fehlgeschlagen",
                8 => "Erkennung: Systemschlaf",
                9 => "Erkennung: wartet auf Kamerabilder",
                10 => "Erkennung: Kameraverbindung fehlt",
                11 => "Kamera auswählen …",
                _ => "Erkennung: beendet",
            };
            let ui_app = app.clone();
            let _ = app.run_on_main_thread(move || {
                if !enabled(&ui_app) && status != 0 { return; }
                let ui = ui_app.state::<AlphaUiState>();
                let _ = ui.status_item.set_text(label);
                let _ = ui.pause_item.set_text(if status == 3 { "Fortsetzen" } else { "Pausieren" });
                let _ = ui.pause_item.set_enabled(status == 2 || status == 3 || status == 9);
                for item in &ui.snooze_items { let _ = item.set_enabled(status == 2 || status == 9); }
            });
        }
        4 => { state.errors.fetch_add(1, Ordering::Relaxed); }
        5 => {
            state.raw_frames.fetch_add(1, Ordering::Relaxed);
            if let Ok(mut last) = state.last_raw.lock() { *last = Some(Instant::now()); }
        }
        6 => { state.vision_started.fetch_add(1, Ordering::Relaxed); }
        7 => { state.face_finished.fetch_add(1, Ordering::Relaxed); }
        8 => { state.hands_finished.fetch_add(1, Ordering::Relaxed); }
        9 => { state.queue_ticks.fetch_add(1, Ordering::Relaxed); }
        10 => { state.restarts.fetch_add(1, Ordering::Relaxed); }
        12 => { state.stage.store(value as i32, Ordering::Relaxed); }
        13 => { state.connection.store(value as i32, Ordering::Relaxed); }
        14 => { state.device_source.store(value as i32, Ordering::Relaxed); }
        15 => { state.interrupted.store(value as i32, Ordering::Relaxed); }
        16 => { state.runtime_error.store(value as i32, Ordering::Relaxed); }
        17 => { state.device_flags.store(value as i32, Ordering::Relaxed); }
        18 => { state.dropped.fetch_add(1, Ordering::Relaxed); }
        19 => {
            if value > 0. { state.faces.fetch_add(1, Ordering::Relaxed); }
            if auxiliary > 0. { state.hands.fetch_add(1, Ordering::Relaxed); }
        }
        _ => {}
    }
}

pub fn handle_menu(app: &AppHandle, action: &str) -> bool {
    let radius = match action { "native_less" => Some(0.20), "native_medium" => Some(0.30), "native_more" => Some(0.40), _ => None };
    if let Some(radius) = radius {
        #[cfg(target_os = "macos")] unsafe { tawel_native_sensitivity(radius); }
        return true;
    }
    if action == "native_stop" { stop(app); return true; }
    if !enabled(app) { return false; }
    match action {
        "start" => {
            if let Ok(mut until) = app.state::<NativeState>().snooze_until.lock() { *until = None; }
            start_engine();
        },
        "pause" => {
            update_hint(app, false);
            if let Ok(mut until) = app.state::<NativeState>().snooze_until.lock() { *until = None; }
            if app.state::<NativeState>().status.load(Ordering::Relaxed) == 3 { start_engine(); }
            else { #[cfg(target_os = "macos")] unsafe { tawel_native_pause(); } }
        }
        "snooze_15" | "snooze_30" | "snooze_60" => {
            let minutes = match action { "snooze_15" => 15., "snooze_30" => 30., _ => 60. };
            update_hint(app, false);
            if let Ok(mut until) = app.state::<NativeState>().snooze_until.lock() { *until = Some(chrono::Utc::now().timestamp_millis() + (minutes * 60_000.) as i64); }
            #[cfg(target_os = "macos")] unsafe { tawel_native_snooze(minutes * 60.); }
        }
        _ => return false,
    }
    true
}

pub fn csv_fields(app: &AppHandle) -> Vec<String> {
    let state = app.state::<NativeState>();
    let age = state.last_frame.lock().ok().and_then(|t| *t).map(|t| t.elapsed().as_millis() as i64).unwrap_or(-1);
    let raw_age = state.last_raw.lock().ok().and_then(|t| *t).map(|t| t.elapsed().as_millis() as i64).unwrap_or(-1);
    if enabled(app) && matches!(state.status.load(Ordering::Relaxed), 2 | 9) {
        let problem = state.tracking_problem.load(Ordering::Relaxed);
        let label = if age >= 0 && age <= 3000 && raw_age >= 0 && raw_age <= 3000 {
            match problem { 1 => "Erkennung: Gesicht ausrichten", 2 => "Erkennung: Handpunkte unsicher", 3 => "Erkennung: Analyse wird wiederholt", _ => native_health::device_label(state.device_flags.load(Ordering::Relaxed),raw_age,age) }
        } else { native_health::device_label(state.device_flags.load(Ordering::Relaxed), raw_age, age) };
        let _ = app.state::<AlphaUiState>().status_item.set_text(label);
    }
    vec![enabled(app).to_string(), state.status.load(Ordering::Relaxed).to_string(),
        state.frames.load(Ordering::Relaxed).to_string(), state.errors.load(Ordering::Relaxed).to_string(),
        state.hints.load(Ordering::Relaxed).to_string(), age.to_string(),
        state.raw_frames.load(Ordering::Relaxed).to_string(),
        state.vision_started.load(Ordering::Relaxed).to_string(),
        state.face_finished.load(Ordering::Relaxed).to_string(),
        state.hands_finished.load(Ordering::Relaxed).to_string(),
        state.queue_ticks.load(Ordering::Relaxed).to_string(),
        state.restarts.load(Ordering::Relaxed).to_string(),
        state.stage.load(Ordering::Relaxed).to_string(), raw_age.to_string(),
        state.connection.load(Ordering::Relaxed).to_string(),
        state.device_source.load(Ordering::Relaxed).to_string(),
        state.interrupted.load(Ordering::Relaxed).to_string(),
        state.runtime_error.load(Ordering::Relaxed).to_string(),
        state.device_flags.load(Ordering::Relaxed).to_string(),
        state.dropped.load(Ordering::Relaxed).to_string(),
        state.faces.load(Ordering::Relaxed).to_string(), state.hands.load(Ordering::Relaxed).to_string(),
        state.distance_milli.load(Ordering::Relaxed).to_string(),
        hint_active(app).to_string(), state.tracking_uncertain.load(Ordering::Relaxed).to_string(),
        state.inference_ms.load(Ordering::Relaxed).to_string(), state.inference_max_ms.load(Ordering::Relaxed).to_string(),
        state.preview_ms.load(Ordering::Relaxed).to_string(), state.preview_max_ms.load(Ordering::Relaxed).to_string()]
        .into_iter().chain(state.performance.lock().map(|p| p.csv()).unwrap_or_else(|_| Performance::default().csv())).collect()
}

pub fn flush() { #[cfg(target_os = "macos")] unsafe { tawel_native_flush(); } }
pub fn background_notice() { #[cfg(target_os = "macos")] unsafe { tawel_background_notice(); } }
#[cfg(target_os = "macos")]
unsafe fn take_string(pointer: *mut std::ffi::c_char) -> String {
    if pointer.is_null() { return "{}".into(); }
    let value = std::ffi::CStr::from_ptr(pointer).to_string_lossy().into_owned();
    tawel_native_free_string(pointer); value
}
#[tauri::command]
pub fn native_review() -> String {
    #[cfg(target_os = "macos")] unsafe { return take_string(tawel_native_review()); }
    #[cfg(not(target_os = "macos"))] { "{}".into() }
}
#[tauri::command]
pub fn native_sound_settings() -> String {
    #[cfg(target_os = "macos")] unsafe { return take_string(tawel_native_sound_settings()); }
    #[cfg(not(target_os = "macos"))] { "{}".into() }
}
#[tauri::command]
pub fn native_sound(enabled: bool, preset: i32, volume: f64, preview: bool) -> Result<(), String> {
    if !(0..=4).contains(&preset) || !volume.is_finite() || !(0.0..=1.0).contains(&volume) { return Err("Ungültige Klangeinstellung".into()); }
    #[cfg(target_os = "macos")] unsafe { tawel_native_sound(enabled as i32, preset, volume, preview as i32); }
    Ok(())
}

#[tauri::command]
pub fn native_preview(window: tauri::WebviewWindow, app: AppHandle, enabled: bool) -> String {
    let state = app.state::<NativeState>();
    let running = state.enabled.load(Ordering::Relaxed) && matches!(state.status.load(Ordering::Relaxed), 2 | 9);
    let visible = enabled && running && window.label() == "main" && window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(true);
    #[cfg(target_os = "macos")] unsafe { return take_string(tawel_native_preview(visible as i32)); }
    #[cfg(not(target_os = "macos"))] { let _ = visible; "{}".into() }
}
