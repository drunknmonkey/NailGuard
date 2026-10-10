// Native completion of a visual cue, as confirmed on hardware (MAC-0.1.22/24):
// the renderer only acknowledges the release and leaves its backdrop layer
// untouched; the window server fades the whole window to a small floor, then the
// window is hidden. Any opacity change WebKit itself drives on the backdrop
// layer makes the compositor replay a fade afterwards.

/// Milliseconds between the end of the window fade and the off-screen hide.
pub const SETTLE_MS: u64 = 80;
/// Window alpha the native fade ends at: invisible, but the compositor keeps
/// the backdrop group alive instead of tearing it down on screen.
pub const ALPHA_FLOOR: f64 = 0.02;
/// Fade-out used when the renderer reports `prefers-reduced-motion`, and for the
/// native fallback when the renderer never acknowledged.
pub const REDUCED_FADE_MS: u64 = 150;

/// Interval of the native alpha stepper (about 120 steps per second).
pub const STEP_MS: u64 = 8;

/// Breathing curves for the window alpha. Both start and end with zero slope,
/// so neither direction snaps; the exhale lingers longer in its tail.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Curve { Inhale, Exhale }
impl Curve {
    pub fn label(self) -> &'static str { match self { Self::Inhale => "inhale", Self::Exhale => "exhale" } }
    /// Progress 0..1 → eased 0..1.
    pub fn ease(self, t: f64) -> f64 {
        let t = t.clamp(0.0, 1.0);
        match self {
            // Sine in-out: soft start, soft arrival – like drawing a breath.
            Self::Inhale => 0.5 - 0.5 * (std::f64::consts::PI * t).cos(),
            // Sine in-out, lifted: lets go earlier and lingers in the tail.
            Self::Exhale => (0.5 - 0.5 * (std::f64::consts::PI * t).cos()).powf(0.7),
        }
    }
}

/// Duration of a native window fade (entrance or release).
pub fn fade_duration(fade_ms: u64, reduced_motion: bool) -> u64 {
    if reduced_motion { REDUCED_FADE_MS.min(fade_ms) } else { fade_ms }
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
        assert!(SETTLE_MS >= 34 && SETTLE_MS <= 200, "Settle covers two frames, stays imperceptible");
    }
    #[test]
    fn curves_are_monotonic_and_soft_at_both_ends() {
        for curve in [Curve::Inhale, Curve::Exhale] {
            assert_eq!(curve.ease(0.0), 0.0);
            assert!((curve.ease(1.0) - 1.0).abs() < 1e-9);
            let mut previous = 0.0;
            for i in 1..=200 {
                let value = curve.ease(i as f64 / 200.0);
                assert!(value >= previous - 1e-12, "{curve:?} must not reverse");
                assert!((0.0..=1.0 + 1e-9).contains(&value));
                previous = value;
            }
            assert!(curve.ease(0.02) < 0.01, "{curve:?} starts without a jump");
            assert!(curve.ease(0.98) > 0.97, "{curve:?} arrives without a jump");
        }
        assert!(Curve::Exhale.ease(0.5) > Curve::Inhale.ease(0.5), "Exhale moves early and lingers in the tail");
        assert!(STEP_MS >= 4 && STEP_MS <= 17);
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
