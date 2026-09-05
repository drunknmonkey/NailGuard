//! Nativer, ausdrücklich wählbarer Testpfad; benötigt kein laufendes WebView.
use super::*;
use std::sync::{OnceLock, atomic::AtomicI32};

static APP: OnceLock<AppHandle> = OnceLock::new();
#[cfg(target_os = "macos")]
extern "C" {
    fn tawel_native_register(callback: extern "C" fn(i32, f64, f64));
    fn tawel_native_start();
    fn tawel_native_pause();
    fn tawel_native_stop();
    fn tawel_native_snooze(seconds: f64);
    fn tawel_native_sensitivity(radius: f64);
}

pub struct NativeState {
    enabled: AtomicBool,
    status: AtomicI32,
    frames: AtomicU64,
    errors: AtomicU64,
    hints: AtomicU64,
    last_frame: Mutex<Option<Instant>>,
    hint: Mutex<(String, u8)>,
}

pub fn install(app: &AppHandle) {
    app.manage(NativeState {
        enabled: AtomicBool::new(false), status: AtomicI32::new(0),
        frames: AtomicU64::new(0), errors: AtomicU64::new(0), hints: AtomicU64::new(0),
        last_frame: Mutex::new(None), hint: Mutex::new(("lavender-vignette".into(), 2)),
    });
    let _ = APP.set(app.clone());
    #[cfg(target_os = "macos")]
    unsafe { tawel_native_register(receive); }
}
pub fn enabled(app: &AppHandle) -> bool { app.state::<NativeState>().enabled.load(Ordering::Relaxed) }
pub fn set_hint(app: &AppHandle, style: &str, intensity: u8) {
    if let Ok(mut hint) = app.state::<NativeState>().hint.lock() { *hint = (style.to_string(), intensity.clamp(1, 3)); }
}
fn start_engine() { #[cfg(target_os = "macos")] unsafe { tawel_native_start(); } }

#[tauri::command]
pub fn native_start(app: AppHandle, style: String, intensity: u8) -> Result<(), String> {
    if !cfg!(target_os = "macos") { return Err("Native Erkennung benötigt macOS".into()); }
    set_hint(&app, &style, intensity);
    app.state::<NativeState>().enabled.store(true, Ordering::Relaxed);
    start_engine();
    Ok(())
}

fn stop(app: &AppHandle) {
    app.state::<NativeState>().enabled.store(false, Ordering::Relaxed);
    #[cfg(target_os = "macos")] unsafe { tawel_native_stop(); }
    let _ = app.emit_to("main", "tawel:control", "native_stop");
    let ui = app.state::<AlphaUiState>();
    let _ = ui.status_item.set_text("Status: bereit");
    let _ = ui.pause_item.set_enabled(false);
}

extern "C" fn receive(event: i32, value: f64, _auxiliary: f64) {
    let Some(app) = APP.get() else { return };
    let state = app.state::<NativeState>();
    if !state.enabled.load(Ordering::Relaxed) { return; }
    match event {
        1 => {
            state.frames.fetch_add(1, Ordering::Relaxed);
            if let Ok(mut last) = state.last_frame.lock() { *last = Some(Instant::now()); }
        }
        2 => {
            state.hints.fetch_add(1, Ordering::Relaxed);
            if let Ok(hint) = state.hint.lock() {
                let _ = show_visual_hint(hint.0.clone(), hint.1, app.clone());
            }
        }
        3 => {
            let status = value as i32;
            state.status.store(status, Ordering::Relaxed);
            let label = match status {
                1 => "Native Erkennung: startet",
                2 => "Native Erkennung: aktiv",
                3 => "Native Erkennung: pausiert / Snooze",
                4 => "Native Erkennung: Kamerafreigabe fehlt",
                5 => "Native Erkennung: Kamera nicht verfügbar",
                6 => "Native Erkennung: Kamerastart fehlgeschlagen",
                8 => "Native Erkennung: Systemschlaf",
                _ => "Native Erkennung: beendet",
            };
            let ui = app.state::<AlphaUiState>();
            let _ = ui.status_item.set_text(label);
            let _ = ui.pause_item.set_text(if status == 3 { "Fortsetzen" } else { "Pausieren" });
            let _ = ui.pause_item.set_enabled(status == 2 || status == 3);
            for item in &ui.snooze_items { let _ = item.set_enabled(status == 2); }
        }
        4 => { state.errors.fetch_add(1, Ordering::Relaxed); }
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
        "start" => start_engine(),
        "pause" => {
            if app.state::<NativeState>().status.load(Ordering::Relaxed) == 3 { start_engine(); }
            else { #[cfg(target_os = "macos")] unsafe { tawel_native_pause(); } }
        }
        "snooze_15" | "snooze_30" | "snooze_60" => {
            let minutes = match action { "snooze_15" => 15., "snooze_30" => 30., _ => 60. };
            #[cfg(target_os = "macos")] unsafe { tawel_native_snooze(minutes * 60.); }
        }
        _ => return false,
    }
    true
}

pub fn csv_fields(app: &AppHandle) -> Vec<String> {
    let state = app.state::<NativeState>();
    let age = state.last_frame.lock().ok().and_then(|t| *t).map(|t| t.elapsed().as_millis() as i64).unwrap_or(-1);
    if enabled(app) && state.status.load(Ordering::Relaxed) == 2 {
        let _ = app.state::<AlphaUiState>().status_item.set_text(if age > 12000 || age < 0 {
            "Native Erkennung: wartet auf Auswertung"
        } else { "Native Erkennung: aktiv" });
    }
    vec![enabled(app).to_string(), state.status.load(Ordering::Relaxed).to_string(),
        state.frames.load(Ordering::Relaxed).to_string(), state.errors.load(Ordering::Relaxed).to_string(),
        state.hints.load(Ordering::Relaxed).to_string(), age.to_string()]
}
