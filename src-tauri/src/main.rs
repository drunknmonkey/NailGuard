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
