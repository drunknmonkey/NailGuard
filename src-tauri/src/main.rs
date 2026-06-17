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
}

/// Schreibziel: Desktop des Nutzers, damit Paul die Datei sofort findet.
/// Existiert kein Desktop, landet die Datei im Home-Verzeichnis.
fn log_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let mut p = PathBuf::from(home);
    p.push("Desktop");
    if !p.exists() {
        p.pop();
    }
    p.push("nailguard-spike-log.csv");
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
fn spike_log_path() -> String {
    log_path().to_string_lossy().into_owned()
}

fn main() {
    tauri::Builder::default()
        .manage(SpikeState {
            count: AtomicU64::new(0),
            start: Instant::now(),
            visibility: Mutex::new("visible".to_string()),
            focus: AtomicBool::new(true),
        })
        .invoke_handler(tauri::generate_handler![
            spike_tick,
            spike_state,
            spike_log_path
        ])
        .setup(|app| {
            // CSV anlegen + Header schreiben, falls noch nicht vorhanden.
            let path = log_path();
            if !path.exists() {
                if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
                    let _ = writeln!(
                        f,
                        "iso_timestamp,sekunden_seit_start,callbacks_letzte_sekunde,visibilityState,hasFocus"
                    );
                }
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
                if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path()) {
                    let _ = writeln!(f, "{},{},{},{},{}", ts, secs, count, vis, focus);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung");
}
