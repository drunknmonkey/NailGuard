// Gemeinsame Statuslogik für native Diagnose und Regressionstest.
pub fn label(raw_age: i64, analysis_age: i64) -> &'static str {
    if raw_age < 0 || raw_age > 3000 {
        "Erkennung: wartet auf Kamerabilder"
    } else if analysis_age < 0 || analysis_age > 3000 {
        "Erkennung: wartet auf Auswertung"
    } else {
        "Erkennung: aktiv"
    }
}

#[test]
fn session_start_without_frames_is_not_active() {
    assert_eq!(label(-1, -1), "Erkennung: wartet auf Kamerabilder");
}
#[test]
fn camera_only_and_stalled_vision_are_not_active() {
    assert_eq!(label(20, -1), "Erkennung: wartet auf Auswertung");
    assert_eq!(label(20, 3001), "Erkennung: wartet auf Auswertung");
}
#[test]
fn old_success_does_not_hide_camera_loss() {
    assert_eq!(label(3001, 100), "Erkennung: wartet auf Kamerabilder");
    assert_eq!(label(20, 100), "Erkennung: aktiv");
}

// Suspendierung ist kein Nachweis für einen geschlossenen Deckel.
pub fn device_label(flags: i32, raw_age: i64, analysis_age: i64) -> &'static str {
    if flags & 2 != 0 {
        "Kamera ruht – MacBook öffnen und warten"
    } else if flags & 1 == 0 {
        "Kamera nicht verbunden"
    } else { label(raw_age, analysis_age) }
}

#[test]
fn suspended_camera_never_claims_active_and_recovers() {
    assert_eq!(device_label(3, 10, 10), "Kamera ruht – MacBook öffnen und warten");
    assert_eq!(device_label(0, 10, 10), "Kamera nicht verbunden");
    assert_eq!(device_label(1, -1, -1), "Erkennung: wartet auf Kamerabilder");
    assert_eq!(device_label(1, 10, 10), "Erkennung: aktiv");
}

// Normal missing hands never imply a broken engine. Stale analysis is separate.
pub fn view_status(status: i32, analysis_age: i64, problem: i32) -> i32 {
    if status != 2 { return status; }
    if analysis_age < 0 || analysis_age > 3000 || problem == 3 { return 14; }
    match problem { 1 => 12, 2 => 13, _ => 2 }
}
#[test]
fn view_separates_absent_hands_from_tracking_and_engine_errors() {
    assert_eq!(view_status(2, 80, 0), 2);
    assert_eq!(view_status(2, 80, 1), 12);
    assert_eq!(view_status(2, 80, 2), 13);
    assert_eq!(view_status(2, 80, 3), 14);
    assert_eq!(view_status(2, 3001, 0), 14);
    assert_eq!(view_status(3, 9999, 1), 3);
    assert_eq!(view_status(9, -1, 0), 9);
}
