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

/// How long a real cue stays at full strength between fade-in and fade-out.
/// The cue is a one-shot impulse like the sound (0.1.30): it fires once when a
/// hit begins and ends on its own, however long the hand stays. One second is
/// enough to be noticed without turning into a held state.
pub const CUE_HOLD_MS: u64 = 1000;

/// Easing of the cue level (filter strength). One shape for both directions,
/// so the fade-out is the exact mirror of the fade-in – two curves read as two
/// different effects (0.1.27 run). Since 0.1.31 a quintic smoothstep: zero
/// slope AND zero acceleration at both ends, so the cue starts and settles
/// without any perceptible onset (gentler than the earlier sine in-out).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Curve { Inhale, Exhale }
impl Curve {
    pub fn label(self) -> &'static str { match self { Self::Inhale => "inhale", Self::Exhale => "exhale" } }
    /// Progress 0..1 → eased 0..1 (quintic smoothstep, identical for both directions).
    pub fn ease(self, t: f64) -> f64 {
        let t = t.clamp(0.0, 1.0);
        t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
    }
}

/// Exponent of the level → radius mapping. With the 1 px floor the invisible
/// sub-pixel band is never entered, so the radius follows the eased level
/// linearly (0.1.31); the earlier 0.7 made the blur jump at the very start of
/// the fade-in and at the very end of the fade-out. The renderer uses the same value.
pub const RADIUS_EXPONENT: f64 = 1.0;

/// Smallest blur radius (px) the cue ever renders. Below a pixel the compositor
/// renders a gaussian in visible kernel steps (text shimmers, 0.1.28 run), and
/// the filter must stay structurally intact: never `blur(0)`, never a
/// full-strength filter at teardown. A 1 px blur is barely perceptible; the
/// separate veil layer carries the visible breath.
pub const RADIUS_FLOOR_PX: f64 = 1.0;

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
    RADIUS_FLOOR_PX + (max_px.max(RADIUS_FLOOR_PX) - RADIUS_FLOOR_PX) * level.clamp(0.0, 1.0).powf(RADIUS_EXPONENT)
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
        assert!(CUE_HOLD_MS >= 500 && CUE_HOLD_MS <= 2000, "A real cue holds about a second, like the sound, then ends on its own");
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
            assert!(curve.ease(0.02) < 0.001, "{curve:?} starts without any perceptible onset");
            assert!(curve.ease(0.98) > 0.999, "{curve:?} settles without any perceptible landing");
            assert!((curve.ease(0.5) - 0.5).abs() < 1e-9, "{curve:?} is symmetric around the middle");
        }
        for i in 0..=20 { let t = i as f64 / 20.0; assert!((Curve::Exhale.ease(t) - Curve::Inhale.ease(t)).abs() < 1e-12, "Exhale mirrors inhale exactly"); }
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
        assert!((radius_for(0.5, 1.3) - (RADIUS_FLOOR_PX + 0.5 * (1.3 - RADIUS_FLOOR_PX))).abs() < 1e-9, "Radius follows the eased level linearly above the floor");
        assert!((RADIUS_EXPONENT - 1.0).abs() < 1e-9);
        assert!(radius_for(1.0, 0.1) >= RADIUS_FLOOR_PX, "Max below the floor never produces blur(0)");
        assert!(RADIUS_FLOOR_PX >= 0.5 && RADIUS_FLOOR_PX <= 1.5);
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
