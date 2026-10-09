// The A/B test changes only the native window's completion policy.
#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub enum FinishMode {
    #[default]
    Immediate,
    KeepTransparent,
    Delayed,
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
    pub fn hide_delay(self) -> Option<u64> {
        match self {
            Self::Immediate => Some(0),
            Self::KeepTransparent => None,
            Self::Delayed => Some(600),
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
        assert_eq!(FinishMode::parse(None).unwrap().hide_delay(), Some(0));
        assert_eq!(FinishMode::parse(Some("keep_transparent")).unwrap().hide_delay(), None);
        assert_eq!(FinishMode::parse(Some("delayed")).unwrap().hide_delay(), Some(600));
        assert!(FinishMode::parse(Some("typo")).is_err());
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
