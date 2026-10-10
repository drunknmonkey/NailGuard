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

/// Breathing curves, applied to the PERCEIVED strength of the cue – not to the
/// window alpha directly. Both start and end with zero slope, so neither
/// direction snaps; the exhale holds the strong part a little longer.
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

/// How compressed perception is for this cue, i.e. the exponent in
/// `perceived ≈ alpha^gamma`.
///
/// A blurred backdrop composited at alpha `a` over the sharp original leaves a
/// sharp residual of `1 - a`. Edges stay legible until that residual is small,
/// so a blur only reads as a blur in the top fraction of the alpha range – the
/// softer the blur, the later it shows. A plain colour wash has no such
/// residual and is already linear in alpha.
///
/// The numbers are a model, not a measurement; the log records the value used
/// so a hardware run can correct them.
pub fn perceptual_gamma(style: &str, blur_px: f64) -> f64 {
    match style {
        "soft-focus" | "wash-focus" => (5.5 - 0.35 * blur_px).clamp(2.0, 5.5),
        // Colours drain earlier than edges soften, but still not linearly.
        "desaturate" => 2.0,
        // Vignette and ambient glow are plain washes.
        _ => 1.0,
    }
}

/// Window alpha for this moment of a fade. The eased progress runs in perceived
/// space and is mapped back through `gamma`, so the cue strengthens and lets go
/// evenly instead of spending most of the time below the visible threshold.
pub fn alpha_for(from: f64, to: f64, progress: f64, curve: Curve, gamma: f64) -> f64 {
    let gamma = gamma.clamp(1.0, 8.0);
    let (from, to) = (from.clamp(0.0, 1.0), to.clamp(0.0, 1.0));
    let (seen_from, seen_to) = (from.powf(gamma), to.powf(gamma));
    let seen = seen_from + (seen_to - seen_from) * curve.ease(progress);
    seen.max(0.0).powf(1.0 / gamma)
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
    fn alpha_follows_perceived_strength_not_the_raw_mix() {
        for (style, blur) in [("soft-focus", 1.3), ("wash-focus", 7.0), ("desaturate", 2.7), ("lavender-vignette", 2.7)] {
            let gamma = perceptual_gamma(style, blur);
            assert!((1.0..=5.5).contains(&gamma));
            for curve in [Curve::Inhale, Curve::Exhale] {
                assert!((alpha_for(0.0, 1.0, 0.0, curve, gamma) - 0.0).abs() < 1e-9, "{style} starts at the source alpha");
                assert!((alpha_for(0.0, 1.0, 1.0, curve, gamma) - 1.0).abs() < 1e-9, "{style} arrives at the target alpha");
                assert!((alpha_for(1.0, ALPHA_FLOOR, 1.0, curve, gamma) - ALPHA_FLOOR).abs() < 1e-9);
                let mut previous = 0.0;
                for i in 0..=200 {
                    let value = alpha_for(0.0, 1.0, i as f64 / 200.0, curve, gamma);
                    assert!(value >= previous - 1e-12, "{style}/{curve:?} must not reverse");
                    previous = value;
                }
            }
        }
        // A blur spends most of its alpha range below the visible threshold, so the
        // compensated ramp must sit well above the raw eased value at mid-fade.
        let gamma = perceptual_gamma("soft-focus", 1.3);
        let middle = alpha_for(0.0, 1.0, 0.5, Curve::Inhale, gamma);
        assert!(middle > 0.8, "Half way in, the cue is already perceptibly there (was {middle:.2})");
        let late = alpha_for(1.0, ALPHA_FLOOR, 0.5, Curve::Exhale, gamma);
        assert!(late > 0.8, "Half way out, the cue is still clearly present (was {late:.2})");
        // A plain wash needs no compensation at all.
        let wash = perceptual_gamma("lavender-vignette", 2.7);
        assert_eq!(wash, 1.0);
        assert!((alpha_for(0.0, 1.0, 0.5, Curve::Inhale, wash) - Curve::Inhale.ease(0.5)).abs() < 1e-9);
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
