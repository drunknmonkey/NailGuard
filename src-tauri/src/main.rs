// Wegwerf-Spike: minimale Tauri-2-Hülle, die die bestehende NailGuard-PWA lädt.
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

use tauri::{Manager, WindowEvent};

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
            "{}/Desktop/nailguard-spike-debug.txt",
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

/// Pro Start eindeutiger Dateiname: nailguard-spike-log-YYYYMMDD-HHMMSS.csv
fn new_log_path() -> PathBuf {
    let mut p = log_dir();
    p.push(format!(
        "nailguard-spike-log-{}.csv",
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

/// „Schließen"-Steuerung der Pille: App beenden.
#[tauri::command]
fn close_app(window: tauri::WebviewWindow) {
    let _ = window.close();
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
            enter_pill,
            exit_pill,
            pill_position,
            close_app
        ])
        .setup(|app| {
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
                win.on_window_event(move |event| {
                    if let WindowEvent::Focused(focused) = event {
                        handle.state::<SpikeState>().focus.store(*focused, Ordering::Relaxed);
                    }
                });

                // macOS: Kamera-/Mikrofon-Anfragen im WKWebView erlauben.
                #[cfg(target_os = "macos")]
                {
                    let _ = win.with_webview(|webview| unsafe {
                        macos_camera::install(webview.inner().cast());
                    });
                }
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
