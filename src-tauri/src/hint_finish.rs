// Native completion of a visual cue, as confirmed on hardware (MAC-0.1.22/23):
// the renderer only acknowledges the release and leaves its backdrop layer
// untouched; the window server fades the whole window, then the window is parked
// far outside every display and hidden there. Any opacity change WebKit itself
// drives on the backdrop layer makes the compositor replay a fade afterwards.

/// Milliseconds between the end of the window fade and the off-screen hide.
pub const SETTLE_MS: u64 = 80;
/// Window alpha the native fade ends at: invisible, but the compositor keeps
/// the backdrop group alive instead of tearing it down on screen.
pub const ALPHA_FLOOR: f64 = 0.02;
/// Offset (physical px) that parks the window outside any realistic display layout.
pub const PARK_OFFSET: i32 = 20_000;
/// Fade-out used when the renderer reports `prefers-reduced-motion`.
pub const REDUCED_FADE_MS: u64 = 150;

/// Duration of the native window fade for this release.
pub fn fade_duration(fade_out_ms: u64, reduced_motion: bool) -> u64 {
    if reduced_motion { REDUCED_FADE_MS.min(fade_out_ms) } else { fade_out_ms }
}
/// Delay from the renderer's acknowledgement to the off-screen hide.
pub fn hide_delay(fade_out_ms: u64, reduced_motion: bool) -> u64 {
    fade_duration(fade_out_ms, reduced_motion) + SETTLE_MS
}
pub fn may_hide(current: u64, target: u64, completed: u64, fallback: bool) -> bool {
    current == target && (!fallback || completed != target)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn window_fade_then_settle_then_hide() {
        assert_eq!(fade_duration(500, false), 500);
        assert_eq!(fade_duration(500, true), REDUCED_FADE_MS, "Reduce Motion shortens the native fade");
        assert_eq!(fade_duration(100, true), 100, "Reduce Motion never lengthens it");
        assert_eq!(hide_delay(500, false), 500 + SETTLE_MS);
        assert_eq!(hide_delay(3000, true), REDUCED_FADE_MS + SETTLE_MS);
        assert!(ALPHA_FLOOR > 0.0 && ALPHA_FLOOR <= 0.05, "Floor stays invisible but non-zero");
        assert!(PARK_OFFSET >= 10_000);
        assert!(SETTLE_MS >= 34 && SETTLE_MS <= 200, "Settle covers two frames, stays imperceptible");
    }
    #[test]
    fn successful_completion_cancels_fallback_but_allows_scheduled_hide() {
        assert!(may_hide(7, 7, 6, true));
        assert!(!may_hide(7, 7, 7, true));
        assert!(may_hide(7, 7, 7, false));
        assert!(!may_hide(8, 7, 7, false));
        assert!(!may_hide(8, 7, 6, true));
    }
}
