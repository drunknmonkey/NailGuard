#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Schreibt FPS-Zeilen aus dem WebView ins `tauri dev`-Terminal, damit die
/// Throttling-Messung auch bei verstecktem/minimiertem Fenster ablesbar ist.
#[tauri::command]
fn log_fps(line: String) {
    println!("[{}] {}", unix_secs(), line);
}

/// Throttling-Test (c): Fenster per hide() verstecken und nach `secs`
/// Sekunden automatisch wieder anzeigen. Aufruf aus der DevTools-Konsole:
///   __TAURI__.core.invoke("hide_for_secs", { secs: 30 })
#[tauri::command]
fn hide_for_secs(window: tauri::WebviewWindow, secs: u64) {
    println!("[{}] [nailguard-test] hide() für {secs}s", unix_secs());
    let _ = window.hide();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(secs));
        let _ = window.show();
        let _ = window.set_focus();
        println!("[{}] [nailguard-test] show() – Fenster wieder sichtbar", unix_secs());
    });
}

/// Throttling-Test (a): Fenster minimieren und nach `secs` Sekunden
/// automatisch wiederherstellen.
///   __TAURI__.core.invoke("minimize_for_secs", { secs: 30 })
#[tauri::command]
fn minimize_for_secs(window: tauri::WebviewWindow, secs: u64) {
    println!("[{}] [nailguard-test] minimize() für {secs}s", unix_secs());
    let _ = window.minimize();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(secs));
        let _ = window.unminimize();
        let _ = window.set_focus();
        println!("[{}] [nailguard-test] unminimize() – Fenster wieder sichtbar", unix_secs());
    });
}

/// Gegenmaßnahmen-Test: Fenster off-screen schieben statt verstecken und
/// nach `secs` Sekunden zurückholen.
///   __TAURI__.core.invoke("offscreen_for_secs", { secs: 30 })
#[tauri::command]
fn offscreen_for_secs(window: tauri::WebviewWindow, secs: u64) {
    use tauri::{PhysicalPosition, Position};

    let original = window.outer_position().ok();
    println!("[{}] [nailguard-test] Fenster off-screen für {secs}s", unix_secs());
    let _ = window.set_position(Position::Physical(PhysicalPosition { x: -20000, y: -20000 }));
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(secs));
        match original {
            Some(pos) => {
                let _ = window.set_position(Position::Physical(pos));
            }
            None => {
                let _ = window.center();
            }
        }
        println!("[{}] [nailguard-test] Fenster wieder on-screen", unix_secs());
    });
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            log_fps,
            hide_for_secs,
            minimize_for_secs,
            offscreen_for_secs
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Start der Tauri-App");
}
