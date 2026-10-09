// Native completion policy once the renderer reports opacity zero.
// Immediate is the product path. The two test modes isolate the renderer's end
// (A: window stays) and an unguarded window hide (B: old behaviour, as control).
#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub enum FinishMode {
    #[default]
    Immediate,
    KeepTransparent,
    Delayed,
}

/// Milliseconds the window server gets to composite alpha 0 before `orderOut`.
/// Two frames would do at 60 Hz; the margin costs nothing visible at alpha 0.
pub const ALPHA_SETTLE_MS: u64 = 80;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FinishPlan {
    /// Set the native window's alphaValue to 0 before it is hidden.
    pub gate_alpha: bool,
    /// Hide the window after this many milliseconds; `None` keeps it on screen.
    pub hide_after_ms: Option<u64>,
}

impl FinishMode {
    pub fn parse(value: Option<&str>) -> Result<Self, &'static str> {
        match value {
            None | Some("immediate") => Ok(Self::Immediate),
            Some("keep_transparent") => Ok(Self::KeepTransparent),
            Some("delayed") => Ok(Self::Delayed),
            _ => Err("Unbekannter Hinweis-Test"),
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::Immediate => "immediate",
            Self::KeepTransparent => "keep_transparent",
            Self::Delayed => "delayed",
        }
    }
    pub fn plan(self) -> FinishPlan {
        match self {
            Self::Immediate => FinishPlan { gate_alpha: true, hide_after_ms: Some(ALPHA_SETTLE_MS) },
            Self::KeepTransparent => FinishPlan { gate_alpha: false, hide_after_ms: None },
            Self::Delayed => FinishPlan { gate_alpha: false, hide_after_ms: Some(600) },
        }
    }
}
pub fn may_hide(current: u64, target: u64, completed: u64, fallback: bool) -> bool {
    current == target && (!fallback || completed != target)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn completion_policies_are_distinct() {
        let product = FinishMode::parse(None).unwrap().plan();
        assert!(product.gate_alpha, "Product path makes the window transparent before hiding it");
        assert_eq!(product.hide_after_ms, Some(ALPHA_SETTLE_MS));
        assert!(ALPHA_SETTLE_MS >= 34 && ALPHA_SETTLE_MS <= 200, "Settle covers two frames, stays imperceptible");
        let keep = FinishMode::parse(Some("keep_transparent")).unwrap().plan();
        assert_eq!(keep, FinishPlan { gate_alpha: false, hide_after_ms: None });
        let delayed = FinishMode::parse(Some("delayed")).unwrap().plan();
        assert_eq!(delayed, FinishPlan { gate_alpha: false, hide_after_ms: Some(600) }, "Control keeps the old unguarded hide");
        assert!(FinishMode::parse(Some("typo")).is_err());
        assert_eq!(FinishMode::Immediate.label(), "immediate");
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
