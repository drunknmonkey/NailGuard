// Native completion policy for a visual cue. The product path never tears the
// window down on screen: it fades the window itself, parks it far outside every
// display and hides it there. The test modes isolate single steps of that path.
#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub enum FinishMode {
    /// Product path: renderer keeps its layer, window alpha fades, hide off screen.
    #[default]
    NativeFade,
    /// Test A: renderer fades to opacity 0, window stays on screen.
    KeepTransparent,
    /// Test B (control): renderer fades to 0, old on-screen hide 600 ms later.
    Delayed,
    /// Test C: renderer fades to a small floor, then park + hide (no window alpha).
    ParkedHide,
}

/// Milliseconds between the last visible change and the off-screen hide.
pub const SETTLE_MS: u64 = 80;
/// Window alpha the native fade ends at: invisible, but the compositor keeps
/// the backdrop group alive instead of tearing it down on screen.
pub const ALPHA_FLOOR: f64 = 0.02;
/// Offset (physical px) that parks the window outside any realistic display layout.
pub const PARK_OFFSET: i32 = 20_000;

/// What the renderer does on release: `native` acknowledges at once and leaves
/// the layer alone; `opacity` fades to exactly 0; `floor` fades to a small floor.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FinishPlan {
    pub renderer: &'static str,
    /// Native window alpha animation (1 → ALPHA_FLOOR) over the configured fade-out.
    pub fade_window: bool,
    /// Move the window off screen before hiding it.
    pub park: bool,
    /// Hide after this many milliseconds past the fade-out; `None` keeps it on screen.
    pub hide_after_fade_ms: Option<u64>,
}

impl FinishMode {
    pub fn parse(value: Option<&str>) -> Result<Self, &'static str> {
        match value {
            None | Some("immediate") | Some("native") => Ok(Self::NativeFade),
            Some("keep_transparent") => Ok(Self::KeepTransparent),
            Some("delayed") => Ok(Self::Delayed),
            Some("parked") => Ok(Self::ParkedHide),
            _ => Err("Unbekannter Hinweis-Test"),
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::NativeFade => "native",
            Self::KeepTransparent => "keep_transparent",
            Self::Delayed => "delayed",
            Self::ParkedHide => "parked",
        }
    }
    pub fn plan(self) -> FinishPlan {
        match self {
            Self::NativeFade => FinishPlan { renderer: "native", fade_window: true, park: true, hide_after_fade_ms: Some(SETTLE_MS) },
            Self::KeepTransparent => FinishPlan { renderer: "opacity", fade_window: false, park: false, hide_after_fade_ms: None },
            Self::Delayed => FinishPlan { renderer: "opacity", fade_window: false, park: false, hide_after_fade_ms: Some(600) },
            Self::ParkedHide => FinishPlan { renderer: "floor", fade_window: false, park: true, hide_after_fade_ms: Some(SETTLE_MS) },
        }
    }
    /// Delay from the renderer's acknowledgement to the hide. With a window fade
    /// the renderer acknowledges before the fade, so the fade-out is added here.
    pub fn hide_delay(self, fade_out_ms: u64) -> Option<u64> {
        let plan = self.plan();
        plan.hide_after_fade_ms.map(|ms| if plan.fade_window { fade_out_ms + ms } else { ms })
    }
}
pub fn may_hide(current: u64, target: u64, completed: u64, fallback: bool) -> bool {
    current == target && (!fallback || completed != target)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn product_path_never_tears_down_on_screen() {
        let product = FinishMode::parse(None).unwrap();
        assert_eq!(product, FinishMode::NativeFade);
        assert_eq!(FinishMode::parse(Some("immediate")).unwrap(), FinishMode::NativeFade, "Old name keeps working");
        let plan = product.plan();
        assert_eq!(plan.renderer, "native", "Renderer leaves its layer untouched");
        assert!(plan.fade_window && plan.park, "Window fades itself and is parked before hiding");
        assert_eq!(product.hide_delay(500), Some(500 + SETTLE_MS));
        assert!(ALPHA_FLOOR > 0.0 && ALPHA_FLOOR <= 0.05, "Floor stays invisible but non-zero");
        assert!(PARK_OFFSET >= 10_000);
    }
    #[test]
    fn test_modes_isolate_single_steps() {
        let keep = FinishMode::parse(Some("keep_transparent")).unwrap();
        assert_eq!(keep.plan(), FinishPlan { renderer: "opacity", fade_window: false, park: false, hide_after_fade_ms: None });
        assert_eq!(keep.hide_delay(500), None);
        let delayed = FinishMode::parse(Some("delayed")).unwrap();
        assert_eq!(delayed.plan(), FinishPlan { renderer: "opacity", fade_window: false, park: false, hide_after_fade_ms: Some(600) }, "Control keeps the old on-screen hide");
        assert_eq!(delayed.hide_delay(500), Some(600));
        let parked = FinishMode::parse(Some("parked")).unwrap();
        assert_eq!(parked.plan(), FinishPlan { renderer: "floor", fade_window: false, park: true, hide_after_fade_ms: Some(SETTLE_MS) });
        assert!(FinishMode::parse(Some("typo")).is_err());
        assert_eq!(FinishMode::ParkedHide.label(), "parked");
    }
    #[test]
    fn successful_completion_cancels_fallback_but_allows_delayed_hide() {
        assert!(may_hide(7, 7, 6, true));
        assert!(!may_hide(7, 7, 7, true));
        assert!(may_hide(7, 7, 7, false));
        assert!(!may_hide(8, 7, 7, false));
        assert!(!may_hide(8, 7, 6, true));
    }
}
