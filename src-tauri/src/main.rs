// Private Tawel-Mac-Alpha auf Basis der bestehenden Tauri-2-Hülle.
// Aufgabe der Rust-Seite: jede Sekunde ein Sample in eine CSV schreiben – auch
// dann, wenn der WebView (rAF/Timer) von macOS gedrosselt oder eingefroren ist.
// Genau das ist der Kern des Experiments, deshalb tickt der Logger nativ.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod native;
mod native_health;

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Nur skalare Diagnosewerte; niemals Kamerabilder, Landmarks oder Fehlertexte.
#[derive(Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticSample {
    sequence: u64,
    timer_total: u64,
    heartbeat_total: u64,
    video_changes_total: u64,
    attempts_total: u64,
    errors_total: u64,
    ipc_failures: u64,
    watchdog_total: u64,
    restarts_total: u64,
    running: bool,
    paused: bool,
    video_time: f64,
    ready_state: u32,
    video_paused: bool,
    track_live: bool,
    track_muted: bool,
    decoded_frames: i64,
    last_error_kind: String,
    last_error_stage: String,
    last_error_at_ms: i64,
}

#[derive(Default)]
struct DiagnosticState {
    latest: DiagnosticSample,
    received: Option<Instant>,
}

// CSV bleibt einzeilig. Freitexte/Stacks werden bereits in JS nicht übernommen.
fn diagnostic_label(value: &str) -> String {
    value.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(32).collect()
}

#[tauri::command]
fn alpha_diagnostic(sample: DiagnosticSample, state: tauri::State<Mutex<DiagnosticState>>) {
    if let Ok(mut diagnostic) = state.lock() {
        if sample.sequence > diagnostic.latest.sequence {
            diagnostic.latest = sample;
            diagnostic.received = Some(Instant::now());
        }
    }
}

/// Gemeinsamer Zustand zwischen WebView-Befehlen und nativem Ticker.
struct SpikeState {
    /// Vom WebView gemeldete Detection-Callbacks seit dem letzten Tick.
    count: AtomicU64,
    /// Startzeitpunkt für `sekunden_seit_start`.
    start: Instant,
    /// Letzter vom WebView gemeldeter `document.visibilityState`.
    visibility: Mutex<String>,
    /// Fensterfokus – wird sowohl nativ (Window-Event) als auch vom WebView gesetzt.
    focus: AtomicBool,
    /// Pro App-Start eine eigene, mit Zeitstempel benannte CSV (keine Session-Vermischung).
    log_path: PathBuf,
}

/// Vom WebView gemeldeter Produktzustand und veränderbare Menüeinträge.
/// Die native Erkennung läuft unabhängig von den beiden WebViews.
struct AlphaUiState {
    running: AtomicBool,
    paused: AtomicBool,
    stalled: AtomicBool,
    status_item: MenuItem<tauri::Wry>,
    pause_item: MenuItem<tauri::Wry>,
    snooze_items: Vec<MenuItem<tauri::Wry>>,
    hint_status_item: MenuItem<tauri::Wry>,
}

/// Desktop des Nutzers (Fallback: Home), damit Paul die Datei sofort findet.
fn log_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let mut p = PathBuf::from(home);
    p.push("Desktop");
    if !p.exists() {
        p.pop();
    }
    p
}

/// Pro Start eindeutiger Dateiname: tawel-alpha-log-YYYYMMDD-HHMMSS.csv
fn new_log_path() -> PathBuf {
    let mut p = log_dir();
    p.push(format!(
        "tawel-alpha-log-{}.csv",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));
    p
}

/// Wird vom WebView bei jedem abgeschlossenen Detection-Callback aufgerufen.
#[tauri::command]
fn spike_tick(state: tauri::State<SpikeState>) {
    state.count.fetch_add(1, Ordering::Relaxed);
}

/// Wird vom WebView gemeldet, wenn sich Sichtbarkeit oder Fokus ändern.
#[tauri::command]
fn spike_state(visibility: String, has_focus: bool, state: tauri::State<SpikeState>) {
    if let Ok(mut v) = state.visibility.lock() {
        *v = visibility;
    }
    state.focus.store(has_focus, Ordering::Relaxed);
}

/// Erlaubt dem WebView, den Speicherort im Overlay anzuzeigen.
#[tauri::command]
fn spike_log_path(state: tauri::State<SpikeState>) -> String {
    state.log_path.to_string_lossy().into_owned()
}

/// Hält die native Menüleiste mit dem tatsächlichen WebView-Zustand synchron.
#[tauri::command]
fn alpha_status(
    running: bool,
    paused: bool,
    snooze_until: Option<i64>,
    state: tauri::State<AlphaUiState>,
    app: AppHandle,
) -> Result<(), String> {
    if native::enabled(&app) { return Ok(()); }
    state.running.store(running, Ordering::Relaxed);
    state.paused.store(paused, Ordering::Relaxed);

    let status = if !running {
        "Status: bereit".to_string()
    } else if let Some(until) = snooze_until.filter(|until| *until > chrono::Utc::now().timestamp_millis()) {
        let remaining_ms = until - chrono::Utc::now().timestamp_millis();
        let minutes = (remaining_ms + 59_999) / 60_000;
        format!("Status: Snooze · {minutes} Min.")
    } else if paused {
        "Status: pausiert".to_string()
    } else if state.stalled.load(Ordering::Relaxed) {
        "Status: Erkennung unterbrochen".to_string()
    } else {
        "Status: aktiv".to_string()
    };

    state.status_item.set_text(status).map_err(cmd_err)?;
    state
        .pause_item
        .set_text(if paused { "Fortsetzen" } else { "Pausieren" })
        .map_err(cmd_err)?;
    state.pause_item.set_enabled(running).map_err(cmd_err)?;
    for item in &state.snooze_items {
        item.set_enabled(running).map_err(cmd_err)?;
    }
    Ok(())
}

/// Spiegelt die lokal gespeicherte Hinweisvariante samt grober Intensität in
/// der Menüleiste. Die eigentliche Auswahl bleibt im WebView/localStorage,
/// damit sie ohne zusätzliche native Persistenz über Neustarts erhalten bleibt.
#[tauri::command]
fn alpha_hint_style(
    style: String,
    intensity: u8,
    animation: Option<BlurAnimation>,
    state: tauri::State<AlphaUiState>,
    app: AppHandle,
) -> Result<(), String> {
    store_blur_animation(&app, animation)?;
    native::set_hint(&app, &style, intensity);
    let label = match style.as_str() {
        "soft-focus" => "Fokusverlust",
        "desaturate" => "Entsättigung",
        "ambient-glow" => "Ambient Glow",
        "wash-focus" => "Farbhauch → Fokus",
        _ => "Lavendel-Vignette",
    };
    let intensity_label = match intensity {
        1 => "leicht",
        3 => "deutlich",
        _ => "mittel",
    };
    state
        .hint_status_item
        .set_text(format!("Hinweis: {label} · {intensity_label}"))
        .map_err(cmd_err)
}

fn cmd_err<E: std::fmt::Display>(err: E) -> String {
    err.to_string()
}


/// Explizites Beenden. Fenster-X verstecken nur die Oberfläche.
#[tauri::command]
fn close_app(app: AppHandle) {
    app.exit(0);
}

/// Versteckt nur die Oberfläche. Session, Kamera und Timer bleiben bestehen.
#[tauri::command]
fn background_app(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(cmd_err)
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn emit_control(app: &AppHandle, action: &str, show_window: bool) {
    if show_window {
        show_main_window(app);
    }
    let _ = app.emit_to("main", "tawel:control", action);
}

/// Ruhige Menüleistensteuerung für die private Alpha. Alle Aktionen werden als
/// kleine Ereignisse an denselben WebView geschickt; Kamera/MediaPipe werden
/// weder dupliziert noch in einen zweiten Prozess verschoben.
fn tray_icon_pixels() -> Vec<u8> {
    let mut pixels = vec![0u8; 36 * 36 * 4];
    for y in 0..36 { for x in 0..36 {
        let distance = (((x as f64 + 0.5) - 18.).powi(2) + ((y as f64 + 0.5) - 18.).powi(2)).sqrt();
        let coverage = (1. - ((distance - 11.).abs() - 1.2).max(0.)).clamp(0., 1.);
        pixels[(y * 36 + x) * 4 + 3] = (coverage * 255.) as u8;
    }}
    pixels
}

fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "status", "Status: bereit", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Tawel öffnen", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pausieren", false, None::<&str>)?;
    let snooze_15 = MenuItem::with_id(app, "snooze_15", "Snooze · 15 Minuten", false, None::<&str>)?;
    let snooze_30 = MenuItem::with_id(app, "snooze_30", "Snooze · 30 Minuten", false, None::<&str>)?;
    let snooze_60 = MenuItem::with_id(app, "snooze_60", "Snooze · 60 Minuten", false, None::<&str>)?;
    let hint_status = MenuItem::with_id(app, "hint_status", "Hinweis: Lavendel-Vignette · mittel", false, None::<&str>)?;
    let hint_preview = MenuItem::with_id(app, "hint_preview", "Probe-Hinweis anzeigen", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Einstellungen öffnen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Tawel beenden", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&status)
        .separator()
        .item(&open)
        .item(&pause)
        .separator()
        .item(&snooze_15)
        .item(&snooze_30)
        .item(&snooze_60)
        .separator()
        .item(&hint_preview)
        .separator()
        .item(&settings)
        .separator()
        .item(&quit)
        .build()?;

    app.manage(AlphaUiState {
        running: AtomicBool::new(false),
        paused: AtomicBool::new(false),
        stalled: AtomicBool::new(false),
        status_item: status,
        pause_item: pause,
        snooze_items: vec![snooze_15, snooze_30, snooze_60],
        hint_status_item: hint_status,
    });

    let tray = TrayIconBuilder::with_id("tawel-tray")
        .tooltip("Tawel")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if native::handle_menu(app, event.id().as_ref()) { return; }
            match event.id().as_ref() {
            "open" => emit_control(app, "open", true),
            "hint_preview" => emit_control(app, "hint_preview", false),
            "settings" => emit_control(app, "settings", true),
            "quit" => app.exit(0),
            _ => {}
            }
        });
    // Separate alpha silhouette: the opaque app icon becomes a solid rectangle
    // when macOS treats it as a template image.
    let icon = tauri::image::Image::new_owned(tray_icon_pixels(), 36, 36);
    let tray = tray.icon(icon).icon_as_template(true);
    tray.build(app)?;
    Ok(())
}


/// macOS bittet, dieses Fenster nicht in Window-Capture/Sharing aufzunehmen.
/// Der Mechanismus wurde bereits auf echter Hardware mit Bildschirmaufnahme
/// und Zoom positiv geprüft; für eine öffentliche Garantie bleibt ein Test des
/// jeweils ausgelieferten Alpha-Builds erforderlich.
#[cfg(target_os = "macos")]
fn set_capture_excluded(window: &tauri::WebviewWindow) {
    let ns_addr = match window.ns_window() {
        Ok(p) => p as usize,
        Err(_) => return,
    };
    let _ = window.run_on_main_thread(move || {
        if ns_addr == 0 {
            return;
        }
        unsafe {
            use objc2::msg_send;
            use objc2::runtime::AnyObject;
            let ns = ns_addr as *mut AnyObject;
            // NSWindowSharingNone == 0
            let _: () = msg_send![&*ns, setSharingType: 0usize];
        }
    });
}

/// Das visuelle Overlay liegt transparent über genau dem Display, auf dem sich
/// das Tawel-Hauptfenster befindet.
fn fit_hint_overlay_to_main(
    overlay: &tauri::WebviewWindow,
    main: &tauri::WebviewWindow,
) {
    if let Ok(Some(monitor)) = main.current_monitor() {
        let _ = overlay.set_position(*monitor.position());
        let _ = overlay.set_size(*monitor.size());
    }
}

/// Native Fenstereigenschaften der reinen Hinweisschicht: auf allen Spaces,
/// über normalen Fenstern, klickdurchlässig und aus Aufnahmen ausgeschlossen.
#[cfg(target_os = "macos")]
fn configure_hint_overlay_macos(window: &tauri::WebviewWindow) {
    let ns_addr = match window.ns_window() {
        Ok(p) => p as usize,
        Err(_) => return,
    };
    let _ = window.run_on_main_thread(move || {
        if ns_addr == 0 {
            return;
        }
        unsafe {
            use objc2::msg_send;
            use objc2::runtime::AnyObject;
            let ns = ns_addr as *mut AnyObject;
            // NSWindowSharingNone, CanJoinAllSpaces | Stationary | FullScreenAuxiliary,
            // Screen-Saver-Level und vollständige Klickdurchlässigkeit.
            let _: () = msg_send![&*ns, setSharingType: 0usize];
            let behavior: usize = (1usize << 0) | (1usize << 4) | (1usize << 8);
            let _: () = msg_send![&*ns, setCollectionBehavior: behavior];
            let _: () = msg_send![&*ns, setLevel: 1000isize];
            let _: () = msg_send![&*ns, setIgnoresMouseEvents: true];
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn configure_hint_overlay_macos(_window: &tauri::WebviewWindow) {}

fn spawn_hint_overlay(app: &AppHandle) -> tauri::Result<()> {
    let overlay = WebviewWindowBuilder::new(
        app,
        "hint-overlay",
        WebviewUrl::App("hint-overlay.html".into()),
    )
    .title("Tawel Hinweis")
    .transparent(true)
    .decorations(false)
    .shadow(false)
    .always_on_top(true)
    .resizable(false)
    .focused(false)
    .skip_taskbar(true)
    .visible(false)
    .build()?;

    let _ = overlay.set_ignore_cursor_events(true);
    if let Some(main) = app.get_webview_window("main") {
        fit_hint_overlay_to_main(&overlay, &main);
    }
    configure_hint_overlay_macos(&overlay);
    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct VisualHintPayload {
    style: String,
    intensity: u8,
    held: bool,
    animation: BlurAnimation,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlurAnimation { blur: f64, fade_in: u64, fade_out: u64 }
impl Default for BlurAnimation {
    fn default() -> Self { Self { blur: 2.7, fade_in: 650, fade_out: 450 } }
}
fn store_blur_animation(app: &AppHandle, value: Option<BlurAnimation>) -> Result<(), String> {
    if let Some(mut value) = value {
        if !value.blur.is_finite() { return Err("Ungültige Unschärfe".into()); }
        value.blur = value.blur.clamp(0.5, 10.0);
        value.fade_in = value.fade_in.clamp(150, 3000);
        value.fade_out = value.fade_out.clamp(150, 3000);
        *app.state::<HintWindowState>().animation.lock().map_err(cmd_err)? = value;
    }
    Ok(())
}

/// Zeigt eine der fünf ganzflächigen Testvarianten mit einer von drei groben
/// Intensitäten. Das Overlay nimmt keine Bildschirmbilder auf; WebKit filtert
/// den Inhalt hinter dem transparenten Fenster direkt im Compositor.
#[tauri::command]
fn show_visual_hint(style: String, intensity: u8, animation: Option<BlurAnimation>, app: AppHandle) -> Result<(), String> {
    store_blur_animation(&app, animation)?;
    if native::hint_active(&app) { return Ok(()); }
    display_visual_hint(style, intensity, false, app)
}

#[derive(Default)]
struct HintWindowState { revision: AtomicU64, animation: Mutex<BlurAnimation> }

fn display_visual_hint(style: String, intensity: u8, held: bool, app: AppHandle) -> Result<(), String> {
    let style = match style.as_str() {
        "lavender-vignette" => "lavender-vignette",
        "soft-focus" => "soft-focus",
        "desaturate" => "desaturate",
        "ambient-glow" => "ambient-glow",
        "wash-focus" => "wash-focus",
        _ => return Err("Unbekannte Hinweisvariante".to_string()),
    };
    let intensity = intensity.clamp(1, 3);
    let overlay = app
        .get_webview_window("hint-overlay")
        .ok_or_else(|| "Hinweisfenster nicht verfügbar".to_string())?;
    if let Some(main) = app.get_webview_window("main") {
        fit_hint_overlay_to_main(&overlay, &main);
    }
    let revision = app.state::<HintWindowState>().revision.fetch_add(1, Ordering::SeqCst) + 1;
    overlay.show().map_err(cmd_err)?;
    let animation = app.state::<HintWindowState>().animation.lock().map_err(cmd_err)?.clone();
    if !held {
        let duration = if style == "soft-focus" || style == "wash-focus" { animation.fade_in * if style == "wash-focus" { 2 } else { 1 } + 1200 + animation.fade_out + 150 } else { 3400 };
        schedule_hint_hide(&app, revision, duration);
    }
    app.emit_to(
        "hint-overlay",
        "tawel:visual-hint",
        VisualHintPayload {
            style: style.to_string(),
            intensity,
            held,
            animation,
        },
    )
    .map_err(cmd_err)
}

// Native Frist: funktioniert auch bei gedrosseltem Overlay-WebView.
fn schedule_hint_hide(app: &AppHandle, revision: u64, millis: u64) {
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(millis));
        let ui_app = app.clone();
        let _ = app.run_on_main_thread(move || {
            if ui_app.state::<HintWindowState>().revision.load(Ordering::SeqCst) == revision {
                if let Some(overlay) = ui_app.get_webview_window("hint-overlay") { let _ = overlay.hide(); }
            }
        });
    });
}
fn release_visual_hint(app: &AppHandle) {
    let revision = app.state::<HintWindowState>().revision.fetch_add(1, Ordering::SeqCst) + 1;
    let _ = app.emit_to("hint-overlay", "tawel:hint-clear", ());
    let fade_out = app.state::<HintWindowState>().animation.lock().map(|a| a.fade_out).unwrap_or(450);
    schedule_hint_hide(app, revision, fade_out + 50);
}
#[tauri::command]
fn hide_visual_hint(app: AppHandle) -> Result<(), String> {
    if !native::hint_active(&app) { release_visual_hint(&app); }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .menu(|app| {
            let quit = MenuItem::with_id(app, "app_quit", "Tawel beenden", true, Some("CmdOrCtrl+Q"))?;
            let settings = MenuItem::with_id(app, "app_settings", "Einstellungen …", true, Some("CmdOrCtrl+,"))?;
            let submenu = SubmenuBuilder::new(app, "Tawel").item(&settings).separator().item(&quit).build()?;
            MenuBuilder::new(app).item(&submenu).build()
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "app_quit" => app.exit(0),
            "app_settings" => emit_control(app, "settings", true),
            _ => {}
        })
        .manage(Mutex::new(DiagnosticState::default()))
        .manage(HintWindowState::default())
        .manage(SpikeState {
            count: AtomicU64::new(0),
            start: Instant::now(),
            visibility: Mutex::new("visible".to_string()),
            focus: AtomicBool::new(true),
            log_path: new_log_path(),
        })
        .invoke_handler(tauri::generate_handler![
            spike_tick,
            alpha_diagnostic,
            native::native_start,
            native::native_info,
            native::native_control,
            native::native_snapshot,
            native::native_review,
            native::native_quality,
            native::native_preview,
            native::native_sound_settings,
            native::native_sound,
            spike_state,
            spike_log_path,
            alpha_status,
            alpha_hint_style,
            show_visual_hint,
            hide_visual_hint,
            close_app,
            background_app
        ])
        .setup(|app| {
            install_tray(app)?;
            native::install(app.handle());
            spawn_hint_overlay(app.handle())?;

            // Frische CSV pro Start + Header (Datei ist immer neu).
            let path = app.state::<SpikeState>().log_path.clone();
            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
                let _ = writeln!(
                    f,
                    "{},native_inference_last_ms,native_inference_max_ms,native_preview_last_ms,native_preview_max_ms,native_cpu_percent,native_peak_rss_mb,native_thermal_state,native_quality_profile,native_width,native_height,native_face_ms,native_hand_ms,native_sound_requests,native_sound_started,native_sound_failed,native_sound_start_ms,native_visual_presentations,native_visual_dispatch_ms,native_sound_enabled,native_sound_volume,native_source_width,native_source_height,native_prepare_ms,native_detection_reason,native_gate_phase,native_valid_fingers,native_fallback_fingers,native_no_mouth_total,native_no_hand_total,native_no_points_total,native_outside_total,native_waiting_total,native_held_total,native_analysis_error_total",
                    "iso_timestamp,sekunden_seit_start,callbacks_letzte_sekunde,visibilityState,hasFocus,app_version,build_sha,native_visible,native_minimized,js_received_age_ms,js_sequence,timer_total,heartbeat_total,video_changes_total,attempts_total,errors_total,ipc_failures,watchdog_total,restarts_total,running,paused,video_time,video_ready_state,video_paused,track_live,track_muted,decoded_frames,last_error_kind,last_error_stage,last_error_at_ms,native_enabled,native_status,native_frames_total,native_errors_total,native_hints_total,native_frame_age_ms,native_raw_frames_total,native_vision_started_total,native_face_finished_total,native_hands_finished_total,native_queue_ticks_total,native_restarts_total,native_stage,native_raw_frame_age_ms,native_connection_flags,native_device_source,native_interrupted,native_runtime_error_code,native_device_flags,native_dropped_total,native_face_frames_total,native_hand_frames_total,native_distance_milli,native_hint_active,native_tracking_uncertain"
                );
            }

            // Fokus zusätzlich nativ verfolgen – das funktioniert auch dann,
            // wenn der WebView keine Events mehr feuert.
            if let Some(win) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                let event_window = win.clone();
                win.on_window_event(move |event| {
                    match event {
                        WindowEvent::Focused(focused) => {
                            handle.state::<SpikeState>().focus.store(*focused, Ordering::Relaxed);
                        }
                        WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = event_window.hide();
                            native::background_notice();
                        }
                        _ => {}
                    }
                });

                #[cfg(target_os = "macos")]
                set_capture_excluded(&win);

                // Das unsichtbare Overlay darf beim Aufbau keinen Tastaturfokus
                // behalten; die Bedienung bleibt im normalen Tawel-Fenster.
                let _ = win.set_focus();
            }

            // Nativer 1-Sekunden-Ticker. Läuft unabhängig vom WebView-Throttling.
            let handle = app.handle().clone();
            thread::spawn(move || {
                let mut empty_seconds = 0u32;
                loop {
                    thread::sleep(Duration::from_secs(1));
                    let state = handle.state::<SpikeState>();
                    let count = state.count.swap(0, Ordering::Relaxed);
                    let ui = handle.state::<AlphaUiState>();
                    let active = !native::enabled(&handle) && ui.running.load(Ordering::Relaxed) && !ui.paused.load(Ordering::Relaxed);
                    empty_seconds = if active && count == 0 { empty_seconds.saturating_add(1) } else { 0 };
                    let stalled = empty_seconds >= 12;
                    let was_stalled = ui.stalled.swap(stalled, Ordering::Relaxed);
                    if stalled {
                        let _ = ui.status_item.set_text("Status: Erkennung unterbrochen");
                    } else if was_stalled && active {
                        let _ = ui.status_item.set_text("Status: aktiv");
                    }
                    native::check_hint_health(&handle);
                    let secs = state.start.elapsed().as_secs();
                    let vis = state
                        .visibility
                        .lock()
                        .map(|v| v.clone())
                        .unwrap_or_else(|_| "?".to_string());
                    let focus = state.focus.load(Ordering::Relaxed);
                    let ts = chrono::Local::now().to_rfc3339();
                    let diagnostic = handle.state::<Mutex<DiagnosticState>>();
                    let (d, age_ms) = diagnostic.lock().map(|v| {
                        (v.latest.clone(), v.received.map(|t| t.elapsed().as_millis() as i64).unwrap_or(-1))
                    }).unwrap_or_else(|_| (DiagnosticSample::default(), -1));
                    let window = handle.get_webview_window("main");
                    let native_visible = window.as_ref().and_then(|w| w.is_visible().ok());
                    let native_minimized = window.as_ref().and_then(|w| w.is_minimized().ok());
                    let mut fields = vec![
                        ts, secs.to_string(), count.to_string(), vis, focus.to_string(),
                        env!("CARGO_PKG_VERSION").to_string(),
                        option_env!("TAWEL_BUILD_SHA").unwrap_or("local").to_string(),
                        native_visible.map(|v| v.to_string()).unwrap_or_else(|| "unknown".into()),
                        native_minimized.map(|v| v.to_string()).unwrap_or_else(|| "unknown".into()),
                        age_ms.to_string(), d.sequence.to_string(),
                        d.timer_total.to_string(), d.heartbeat_total.to_string(),
                        d.video_changes_total.to_string(), d.attempts_total.to_string(),
                        d.errors_total.to_string(), d.ipc_failures.to_string(),
                        d.watchdog_total.to_string(), d.restarts_total.to_string(),
                        d.running.to_string(), d.paused.to_string(), d.video_time.to_string(),
                        d.ready_state.to_string(), d.video_paused.to_string(),
                        d.track_live.to_string(), d.track_muted.to_string(), d.decoded_frames.to_string(),
                        diagnostic_label(&d.last_error_kind), diagnostic_label(&d.last_error_stage),
                        d.last_error_at_ms.to_string(),
                    ];
                    fields.extend(native::csv_fields(&handle));
                    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&state.log_path) {
                        let _ = writeln!(f, "{}", fields.join(","));
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung")
        .run(|app, event| match event {
            // Closing the last window must not end the native camera process.
            tauri::RunEvent::ExitRequested { code: None, api, .. } => api.prevent_exit(),
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => show_main_window(app),
            tauri::RunEvent::Exit => native::flush(),
            _ => {}
        });
}
