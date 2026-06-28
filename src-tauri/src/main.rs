// Ambient-Glow-Spike: Tauri-2-Hülle mit ZWEI Fenstern.
//   main     – Steuerfenster (Control Panel), erzeugt das 0–1-Test-Signal.
//   overlay  – ganzflächiges, transparentes, klick-durchlässiges Glow-Fenster,
//              das von der Bildschirmaufnahme ausgeschlossen wird.
//
// Der Kern des Spikes ist Punkt 2 der Aufgabe: das Overlay-NSWindow auf
// NSWindowSharingNone setzen, damit es in Screen-Recording / Screenshare NICHT
// auftaucht. Tauri exponiert das nicht als stabile High-Level-API, deshalb gehen
// wir – wie schon beim Pill-Spike (collectionBehavior) – direkt über objc2 ans
// zugrundeliegende NSWindow.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// macOS: das Overlay-NSWindow ambient-tauglich konfigurieren.
///
/// 1. setSharingType: NSWindowSharingNone (0) → aus Bildschirmaufnahme ausschließen.
/// 2. setCollectionBehavior → über alle Spaces und neben Vollbild-Apps sichtbar.
/// 3. setLevel: screen-saver (1000) → über Menüleiste/Dock legen.
/// 4. setIgnoresMouseEvents: YES → klick-durchlässig (zusätzlich zur Tauri-API).
///
/// Hinweis: NSWindowSharingType gilt seit macOS 13 als deprecated, schließt das
/// Fenster aber weiterhin zuverlässig von der Aufnahme aus. Die tatsächliche
/// Wirkung kann nur auf echter macOS-Hardware verifiziert werden (→ Paul).
#[cfg(target_os = "macos")]
fn configure_overlay_macos(window: &tauri::WebviewWindow) {
    let ns_addr = match window.ns_window() {
        Ok(ptr) => ptr as usize,
        Err(_) => return,
    };
    let _ = window.run_on_main_thread(move || unsafe {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;

        if ns_addr == 0 {
            return;
        }
        let ns = ns_addr as *mut AnyObject;

        // 1) Von der Bildschirmaufnahme ausschließen.
        // NSWindowSharingNone == 0
        let _: () = msg_send![&*ns, setSharingType: 0usize];

        // 2) Über alle Spaces + neben Vollbild-Apps schweben.
        // CanJoinAllSpaces (1<<0) | Stationary (1<<4) | FullScreenAuxiliary (1<<8)
        let behavior: usize = (1 << 0) | (1 << 4) | (1 << 8);
        let _: () = msg_send![&*ns, setCollectionBehavior: behavior];

        // 3) Über Menüleiste/Dock legen (kCGScreenSaverWindowLevel == 1000).
        let _: () = msg_send![&*ns, setLevel: 1000isize];

        // 4) Mausereignisse ignorieren (klick-durchlässig).
        let _: () = msg_send![&*ns, setIgnoresMouseEvents: true];
    });
}

#[cfg(not(target_os = "macos"))]
fn configure_overlay_macos(_window: &tauri::WebviewWindow) {}

/// Erzeugt das Overlay-Fenster und legt es passgenau über den Hauptmonitor.
fn spawn_overlay(app: &tauri::AppHandle) -> tauri::Result<()> {
    let overlay = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("NailGuard Ambient Overlay")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .resizable(false)
        .focused(false)
        .skip_taskbar(true)
        .visible(false)
        .build()?;

    // Klick-durchlässig (Cursor-Events ignorieren) – plattformübergreifende API.
    let _ = overlay.set_ignore_cursor_events(true);

    // Passgenau über den ganzen (Haupt-)Bildschirm legen.
    if let Some(monitor) = overlay
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| overlay.primary_monitor().ok().flatten())
    {
        let _ = overlay.set_position(*monitor.position());
        let _ = overlay.set_size(*monitor.size());
    }

    configure_overlay_macos(&overlay);
    overlay.show()?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            spawn_overlay(&handle)?;
            // Tastatur-/Bedienfokus zurück aufs Steuerfenster.
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung");
}
