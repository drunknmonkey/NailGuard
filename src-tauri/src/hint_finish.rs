// Native pacing of a visual cue (MAC-0.1.22/27). The native stepper owns the
// clock and sends a 0..1 level; the renderer maps it onto the filter radius and
// never touches the layer's opacity (opacity fades make the compositor replay a
// fade of the full-strength filter afterwards). The radius keeps a small floor;
// the window is then set to a low alpha and hidden – the teardown confirmed
// clean on hardware.

/// Milliseconds between the end of the window fade and the off-screen hide.
pub const SETTLE_MS: u64 = 80;
/// Window alpha the native fade ends at: invisible, but the compositor keeps
/// the backdrop group alive instead of tearing it down on screen.
pub const ALPHA_FLOOR: f64 = 0.02;
/// Fade-out used when the renderer reports `prefers-reduced-motion`, and for the
/// native fallback when the renderer never acknowledged.
pub const REDUCED_FADE_MS: u64 = 150;

/// Interval of the native level stepper: one event per display frame at 60 Hz.
pub const STEP_MS: u64 = 16;

/// Breathing curves for the cue level (filter strength). Both start and end
/// with zero slope, so neither direction snaps; the exhale holds the strong
/// part a little longer.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Curve { Inhale, Exhale }
impl Curve {
    pub fn label(self) -> &'static str { match self { Self::Inhale => "inhale", Self::Exhale => "exhale" } }
    /// Progress 0..1 → eased 0..1 in perceived space.
    pub fn ease(self, t: f64) -> f64 {
        let sine = 0.5 - 0.5 * (std::f64::consts::PI * t.clamp(0.0, 1.0)).cos();
        match self {
            // Soft start, soft arrival – like drawing a breath.
            Self::Inhale => sine,
            // Same shape, held back slightly: the cue lets go with a sigh.
            Self::Exhale => sine.powf(1.15),
        }
    }
}

/// Smallest blur radius (px) the cue ever renders. Below about half a pixel a
/// gaussian blur is invisible, yet the backdrop filter stays structurally intact:
/// the compositor never gets a `blur(0)` or a full-strength filter to tear down.
pub const RADIUS_FLOOR_PX: f64 = 0.3;

/// Window alpha does not reach an in-place backdrop filter on this macOS – the
/// 0.1.25/26 runs had exact alpha ramps and no visible change. What the
/// compositor does render is the filter strength itself, so the fade drives a
/// 0..1 level that the renderer maps onto radius (or saturation / wash opacity).
pub fn level_for(from: f64, to: f64, progress: f64, curve: Curve) -> f64 {
    let (from, to) = (from.clamp(0.0, 1.0), to.clamp(0.0, 1.0));
    (from + (to - from) * curve.ease(progress)).clamp(0.0, 1.0)
}

/// Blur radius for a level, never below the floor while the cue exists.
pub fn radius_for(level: f64, max_px: f64) -> f64 {
    RADIUS_FLOOR_PX + (max_px.max(RADIUS_FLOOR_PX) - RADIUS_FLOOR_PX) * level.clamp(0.0, 1.0)
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
        assert!(Curve::Exhale.ease(0.5) < Curve::Inhale.ease(0.5), "Exhale holds the strong part longer");
        assert!(STEP_MS >= 4 && STEP_MS <= 17);
    }
    #[test]
    fn level_drives_the_filter_and_keeps_a_floor() {
        for curve in [Curve::Inhale, Curve::Exhale] {
            assert_eq!(level_for(0.0, 1.0, 0.0, curve), 0.0);
            assert!((level_for(0.0, 1.0, 1.0, curve) - 1.0).abs() < 1e-9);
            assert!((level_for(1.0, 0.0, 1.0, curve)).abs() < 1e-9);
            let mut previous = 0.0;
            for i in 0..=200 {
                let value = level_for(0.0, 1.0, i as f64 / 200.0, curve);
                assert!(value >= previous - 1e-12, "{curve:?} must not reverse");
                previous = value;
            }
            // A cue interrupted mid-exhale breathes on from where it is.
            assert!((level_for(0.4, 1.0, 0.0, curve) - 0.4).abs() < 1e-9);
        }
        assert!((radius_for(0.0, 7.0) - RADIUS_FLOOR_PX).abs() < 1e-9, "Idle cue keeps the filter alive at an invisible radius");
        assert!((radius_for(1.0, 7.0) - 7.0).abs() < 1e-9);
        assert!((radius_for(0.5, 1.3) - (RADIUS_FLOOR_PX + 0.5 * (1.3 - RADIUS_FLOOR_PX))).abs() < 1e-9);
        assert!(radius_for(1.0, 0.1) >= RADIUS_FLOOR_PX, "Max below the floor never produces blur(0)");
        assert!(RADIUS_FLOOR_PX > 0.0 && RADIUS_FLOOR_PX <= 0.5);
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
