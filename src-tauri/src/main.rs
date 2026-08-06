// Private Tawel-Mac-Alpha auf Basis der bestehenden Tauri-2-Hülle.
// Aufgabe der Rust-Seite: jede Sekunde ein Sample in eine CSV schreiben – auch
// dann, wenn der WebView (rAF/Timer) von macOS gedrosselt oder eingefroren ist.
// Genau das ist der Kern des Experiments, deshalb tickt der Logger nativ.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

// --- macOS: getUserMedia im WKWebView erlauben ----------------------------------
// WKWebView verweigert Kamera/Mikrofon auf Web-Ebene, solange der WKUIDelegate die
// Methode `requestMediaCapturePermissionForOrigin:...` nicht beantwortet (WRY tut das
// fuer Screen-Sharing, aber nicht fuer die Kamera – tauri-apps/wry#1195). Wir setzen
// daher einen minimalen Delegate, der die Anfrage mit "grant" (=1) beantwortet. Das
// ist Apples offizieller Mechanismus, kein Workaround.
//
// Bewusst mit Roh-Typen (*mut AnyObject / isize / block2::Block), damit wir nur von
// objc2 + block2 abhaengen (Versionen wie wry) und nicht von den versionssensiblen
// objc2-web-kit-Typen. WebKit prueft `respondsToSelector:`, ein Minimal-Delegate genuegt.
#[cfg(target_os = "macos")]
mod macos_camera {
    use block2::Block;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, NSObject, NSObjectProtocol};
    use objc2::{define_class, msg_send, AllocAnyThread};

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "NailguardMediaUIDelegate"]
        pub struct MediaUIDelegate;

        unsafe impl NSObjectProtocol for MediaUIDelegate {}

        impl MediaUIDelegate {
            // - (void)webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:decisionHandler:
            // Signatur-Encoding: v@:@@@q@?  (void, self, _cmd, webview, origin, frame, NSInteger, block)
            #[unsafe(method(webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:decisionHandler:))]
            fn grant_media(
                &self,
                _web_view: *mut AnyObject,
                _origin: *mut AnyObject,
                _frame: *mut AnyObject,
                _capture_type: isize,
                decision_handler: &Block<dyn Fn(isize)>,
            ) {
                // WKPermissionDecisionGrant == 1
                decision_handler.call((1isize,));
            }
        }
    );

    impl MediaUIDelegate {
        fn new() -> Retained<Self> {
            unsafe { msg_send![Self::alloc(), init] }
        }
    }

    /// Haengt den Delegate an den WKWebView (Pointer aus `PlatformWebview::inner()`).
    pub unsafe fn install(webview_ptr: *mut std::ffi::c_void) {
        // Runtime-Diagnose: bestaetigt, dass with_webview/install lief und welche
        // ObjC-Klasse inner() liefert (sollte WKWebView sein). Liegt auf dem Desktop.
        let dbg_path = format!(
            "{}/Desktop/tawel-alpha-debug.txt",
            std::env::var("HOME").unwrap_or_default()
        );
        let wk = webview_ptr.cast::<AnyObject>();
        let class = if wk.is_null() {
            "<null>".to_string()
        } else {
            format!("{:?}", (&*wk).class())
        };
        let _ = std::fs::write(
            &dbg_path,
            format!("install() aufgerufen; ptr_null={}; inner_class={}\n", wk.is_null(), class),
        );
        if wk.is_null() {
            return;
        }
        let delegate = MediaUIDelegate::new();
        let _: () = msg_send![&*wk, setUIDelegate: &*delegate];
        // uiDelegate ist eine schwache Property -> Delegate fuer die App-Lebensdauer halten.
        std::mem::forget(delegate);
        let _ = std::fs::write(
            &dbg_path,
            format!("install() ok; inner_class={}; setUIDelegate gesetzt\n", class),
        );
    }
}
// --------------------------------------------------------------------------------


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
/// Die Erkennung selbst bleibt im bestehenden WebView; Rust hält nur genug
/// Zustand, um Schließen und Menüleisten-Bedienung verlässlich abzubilden.
struct AlphaUiState {
    running: AtomicBool,
    paused: AtomicBool,
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
) -> Result<(), String> {
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
    state: tauri::State<AlphaUiState>,
) -> Result<(), String> {
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

/// Pill-Modus: kompaktes, rahmenloses, immer sichtbares Mini-Fenster. Das WebView
/// (Kamera + rAF-Erkennung) bleibt dasselbe – nur die Fenster-Eigenschaften ändern sich.
#[tauri::command]
fn enter_pill(window: tauri::WebviewWindow, x: Option<i32>, y: Option<i32>) -> Result<(), String> {
    window.set_decorations(false).map_err(cmd_err)?;
    window.set_always_on_top(true).map_err(cmd_err)?;
    // Variante A „Reiner Ring": kleines, transparentes Fenster, nur der Ring.
    // 130px gibt dem 80px Ring auf jeder Seite 25px Puffer für den Glow (max 22px).
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(130.0, 130.0)))
        .map_err(cmd_err)?;
    // Auf allen Spaces/Workspaces sichtbar (Desktop-only, Fehler nicht fatal).
    let _ = window.set_visible_on_all_workspaces(true);
    if let (Some(x), Some(y)) = (x, y) {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
    }
    #[cfg(target_os = "macos")]
    set_collection_behavior(&window, true);
    Ok(())
}

/// Zurück in den Voll-Modus. Gibt die zuletzt genutzte Pill-Position zurück,
/// damit das WebView sie in localStorage sichern kann.
#[tauri::command]
fn exit_pill(window: tauri::WebviewWindow) -> Result<(i32, i32), String> {
    let pos = window.outer_position().map_err(cmd_err)?;
    #[cfg(target_os = "macos")]
    set_collection_behavior(&window, false);
    let _ = window.set_visible_on_all_workspaces(false);
    window.set_always_on_top(false).map_err(cmd_err)?;
    window.set_decorations(true).map_err(cmd_err)?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(960.0, 720.0)))
        .map_err(cmd_err)?;
    let _ = window.center();
    Ok((pos.x, pos.y))
}

/// Aktuelle Fensterposition (für die periodische Positions-Sicherung im Pill-Modus).
#[tauri::command]
fn pill_position(window: tauri::WebviewWindow) -> Result<(i32, i32), String> {
    let p = window.outer_position().map_err(cmd_err)?;
    Ok((p.x, p.y))
}

/// „Schließen"-Steuerung der Pille: App wirklich beenden. Das normale rote
/// Fenster-X wird separat abgefangen und lässt Tawel in der Pille weiterlaufen.
#[tauri::command]
fn close_app(app: AppHandle) {
    app.exit(0);
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
fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "status", "Status: bereit", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Tawel öffnen", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pausieren", false, None::<&str>)?;
    let snooze_15 = MenuItem::with_id(app, "snooze_15", "Snooze · 15 Minuten", false, None::<&str>)?;
    let snooze_30 = MenuItem::with_id(app, "snooze_30", "Snooze · 30 Minuten", false, None::<&str>)?;
    let snooze_60 = MenuItem::with_id(app, "snooze_60", "Snooze · 60 Minuten", false, None::<&str>)?;
    let hint_status = MenuItem::with_id(app, "hint_status", "Hinweis: Lavendel-Vignette · mittel", false, None::<&str>)?;
    let hint_lavender_vignette = MenuItem::with_id(app, "hint_lavender_vignette", "A · Lavendel-Vignette", true, None::<&str>)?;
    let hint_soft_focus = MenuItem::with_id(app, "hint_soft_focus", "B · Sanfter Fokusverlust", true, None::<&str>)?;
    let hint_desaturate = MenuItem::with_id(app, "hint_desaturate", "C · Kurze Entsättigung", true, None::<&str>)?;
    let hint_ambient_glow = MenuItem::with_id(app, "hint_ambient_glow", "D · Ambient Glow", true, None::<&str>)?;
    let hint_wash_focus = MenuItem::with_id(app, "hint_wash_focus", "E · Farbhauch → Fokusverlust", true, None::<&str>)?;
    let hint_preview = MenuItem::with_id(app, "hint_preview", "Probe-Hinweis anzeigen", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Einstellungen öffnen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Tawel beenden", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&status)
        .separator()
        .item(&open)
        .item(&start)
        .item(&pause)
        .separator()
        .item(&snooze_15)
        .item(&snooze_30)
        .item(&snooze_60)
        .separator()
        .item(&hint_status)
        .item(&hint_lavender_vignette)
        .item(&hint_soft_focus)
        .item(&hint_desaturate)
        .item(&hint_ambient_glow)
        .item(&hint_wash_focus)
        .item(&hint_preview)
        .separator()
        .item(&settings)
        .item(&quit)
        .build()?;

    app.manage(AlphaUiState {
        running: AtomicBool::new(false),
        paused: AtomicBool::new(false),
        status_item: status,
        pause_item: pause,
        snooze_items: vec![snooze_15, snooze_30, snooze_60],
        hint_status_item: hint_status,
    });

    let mut tray = TrayIconBuilder::with_id("tawel-tray")
        .tooltip("Tawel")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => emit_control(app, "open", true),
            "start" => emit_control(app, "start", true),
            "pause" => emit_control(app, "toggle_pause", false),
            "snooze_15" => emit_control(app, "snooze_15", false),
            "snooze_30" => emit_control(app, "snooze_30", false),
            "snooze_60" => emit_control(app, "snooze_60", false),
            "hint_lavender_vignette" => emit_control(app, "hint_lavender_vignette", false),
            "hint_soft_focus" => emit_control(app, "hint_soft_focus", false),
            "hint_desaturate" => emit_control(app, "hint_desaturate", false),
            "hint_ambient_glow" => emit_control(app, "hint_ambient_glow", false),
            "hint_wash_focus" => emit_control(app, "hint_wash_focus", false),
            "hint_preview" => emit_control(app, "hint_preview", false),
            "settings" => emit_control(app, "settings", true),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone()).icon_as_template(true);
    }
    tray.build(app)?;
    Ok(())
}

/// macOS: NSWindow so konfigurieren, dass die Pille auf allen Spaces und als
/// Auxiliary über Vollbild-Apps schweben kann. Caveat: über das Vollbild EINER
/// ANDEREN App ist das nicht garantiert (siehe docs/pill-mode.md).
#[cfg(target_os = "macos")]
fn set_collection_behavior(window: &tauri::WebviewWindow, pill: bool) {
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
            if pill {
                let cur: usize = msg_send![&*ns, collectionBehavior];
                // NSWindowCollectionBehaviorCanJoinAllSpaces (1<<0) | FullScreenAuxiliary (1<<8)
                let beh = cur | (1usize << 0) | (1usize << 8);
                let _: () = msg_send![&*ns, setCollectionBehavior: beh];
            } else {
                let _: () = msg_send![&*ns, setCollectionBehavior: 0usize];
            }
        }
    });
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
/// das Tawel-Hauptfenster beziehungsweise die Pille befindet.
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
}

/// Zeigt eine der fünf ganzflächigen Testvarianten mit einer von drei groben
/// Intensitäten. Das Overlay nimmt keine Bildschirmbilder auf; WebKit filtert
/// den Inhalt hinter dem transparenten Fenster direkt im Compositor.
#[tauri::command]
fn show_visual_hint(style: String, intensity: u8, app: AppHandle) -> Result<(), String> {
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
    overlay.show().map_err(cmd_err)?;
    app.emit_to(
        "hint-overlay",
        "tawel:visual-hint",
        VisualHintPayload {
            style: style.to_string(),
            intensity,
        },
    )
    .map_err(cmd_err)
}

/// Nach der kurzen CSS-Animation verschwindet das ganzflächige Fenster wieder
/// vollständig. So kann es das dauerhaft sichtbare Erkennungs-WebView nicht als
/// vermeintlich verdeckt markieren oder im Alltag Ressourcen binden.
#[tauri::command]
fn hide_visual_hint(app: AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("hint-overlay") {
        overlay.hide().map_err(cmd_err)?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(SpikeState {
            count: AtomicU64::new(0),
            start: Instant::now(),
            visibility: Mutex::new("visible".to_string()),
            focus: AtomicBool::new(true),
            log_path: new_log_path(),
        })
        .invoke_handler(tauri::generate_handler![
            spike_tick,
            spike_state,
            spike_log_path,
            alpha_status,
            alpha_hint_style,
            enter_pill,
            exit_pill,
            pill_position,
            show_visual_hint,
            hide_visual_hint,
            close_app
        ])
        .setup(|app| {
            install_tray(app)?;
            spawn_hint_overlay(app.handle())?;

            // Frische CSV pro Start + Header (Datei ist immer neu).
            let path = app.state::<SpikeState>().log_path.clone();
            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
                let _ = writeln!(
                    f,
                    "iso_timestamp,sekunden_seit_start,callbacks_letzte_sekunde,visibilityState,hasFocus"
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
                            let ui = handle.state::<AlphaUiState>();
                            if ui.running.load(Ordering::Relaxed) {
                                let _ = event_window.emit("tawel:control", "dock");
                            } else {
                                let _ = event_window.hide();
                            }
                        }
                        _ => {}
                    }
                });

                // macOS: Kamera-/Mikrofon-Anfragen im WKWebView erlauben.
                #[cfg(target_os = "macos")]
                {
                    set_capture_excluded(&win);
                    let _ = win.with_webview(|webview| unsafe {
                        macos_camera::install(webview.inner().cast());
                    });
                }

                // Das unsichtbare Overlay darf beim Aufbau keinen Tastaturfokus
                // behalten; die Bedienung bleibt im normalen Tawel-Fenster.
                let _ = win.set_focus();
            }

            // Nativer 1-Sekunden-Ticker. Läuft unabhängig vom WebView-Throttling.
            let handle = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(1));
                let state = handle.state::<SpikeState>();
                let count = state.count.swap(0, Ordering::Relaxed);
                let secs = state.start.elapsed().as_secs();
                let vis = state
                    .visibility
                    .lock()
                    .map(|v| v.clone())
                    .unwrap_or_else(|_| "?".to_string());
                let focus = state.focus.load(Ordering::Relaxed);
                let ts = chrono::Local::now().to_rfc3339();
                if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&state.log_path) {
                    let _ = writeln!(f, "{},{},{},{},{}", ts, secs, count, vis, focus);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung");
}
