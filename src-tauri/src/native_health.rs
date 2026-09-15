// Gemeinsame Statuslogik für native Diagnose und Regressionstest.
pub fn label(raw_age: i64, analysis_age: i64) -> &'static str {
    if raw_age < 0 || raw_age > 3000 {
        "Native Erkennung: wartet auf Kamerabilder"
    } else if analysis_age < 0 || analysis_age > 3000 {
        "Native Erkennung: wartet auf Auswertung"
    } else {
        "Native Erkennung: aktiv"
    }
}

#[test]
fn session_start_without_frames_is_not_active() {
    assert_eq!(label(-1, -1), "Native Erkennung: wartet auf Kamerabilder");
}
#[test]
fn camera_only_and_stalled_vision_are_not_active() {
    assert_eq!(label(20, -1), "Native Erkennung: wartet auf Auswertung");
    assert_eq!(label(20, 3001), "Native Erkennung: wartet auf Auswertung");
}
#[test]
fn old_success_does_not_hide_camera_loss() {
    assert_eq!(label(3001, 100), "Native Erkennung: wartet auf Kamerabilder");
    assert_eq!(label(20, 100), "Native Erkennung: aktiv");
}

// Suspendierung ist kein Nachweis für einen geschlossenen Deckel.
pub fn device_label(flags: i32, raw_age: i64, analysis_age: i64) -> &'static str {
    if flags & 2 != 0 {
        "Native Kamera ruht – MacBook öffnen und warten"
    } else if flags & 1 == 0 {
        "Native Kamera nicht verbunden"
    } else { label(raw_age, analysis_age) }
}

#[test]
fn suspended_camera_never_claims_active_and_recovers() {
    assert_eq!(device_label(3, 10, 10), "Native Kamera ruht – MacBook öffnen und warten");
    assert_eq!(device_label(0, 10, 10), "Native Kamera nicht verbunden");
    assert_eq!(device_label(1, -1, -1), "Native Erkennung: wartet auf Kamerabilder");
    assert_eq!(device_label(1, 10, 10), "Native Erkennung: aktiv");
}
