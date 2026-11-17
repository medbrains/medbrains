//! Whether a quality indicator's value meets its target (#6021). Separate from
//! `quality` so the rule the NABH report prints has one home and its tests.

use serde::{Deserialize, Serialize};

/// Which way an indicator's value meets its target. Falls, infections, errors,
/// mortality and waiting times are lower-is-better under NABH; compliance and
/// satisfaction are higher-is-better.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IndicatorDirection {
    HigherBetter,
    LowerBetter,
}

/// Whether one indicator value meets its target, as printed on the NABH report.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetStatus {
    Met,
    NotMet,
    /// No target is set, so there is nothing to meet.
    NotApplicable,
    /// A target is set but nobody has said which way meets it; never guessed.
    DirectionNotSet,
}

impl TargetStatus {
    /// Compares `value` with `target` in the indicator's direction, so a fall
    /// rate above its target is not met.
    #[must_use]
    pub fn of(direction: Option<IndicatorDirection>, value: f64, target: Option<f64>) -> Self {
        let Some(target) = target else {
            return Self::NotApplicable;
        };
        let met = match direction {
            None => return Self::DirectionNotSet,
            Some(IndicatorDirection::HigherBetter) => value >= target,
            Some(IndicatorDirection::LowerBetter) => value <= target,
        };
        if met { Self::Met } else { Self::NotMet }
    }

    /// The status code the print payload carries.
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Met => "met",
            Self::NotMet => "not_met",
            Self::NotApplicable => "not_applicable",
            Self::DirectionNotSet => "direction_not_set",
        }
    }
}

#[cfg(test)]
mod target_status_tests {
    use super::{IndicatorDirection, TargetStatus};

    #[test]
    fn a_lower_is_better_value_above_target_is_not_met() {
        let status = TargetStatus::of(Some(IndicatorDirection::LowerBetter), 3.5, Some(2.0));
        assert_eq!(status, TargetStatus::NotMet);
        let status = TargetStatus::of(Some(IndicatorDirection::LowerBetter), 1.0, Some(2.0));
        assert_eq!(status, TargetStatus::Met);
    }

    #[test]
    fn a_higher_is_better_value_meets_at_or_above_target() {
        let dir = Some(IndicatorDirection::HigherBetter);
        assert_eq!(TargetStatus::of(dir, 90.0, Some(90.0)), TargetStatus::Met);
        assert_eq!(
            TargetStatus::of(dir, 80.0, Some(90.0)),
            TargetStatus::NotMet
        );
    }

    #[test]
    fn an_unknown_direction_is_never_reported_as_met() {
        assert_eq!(
            TargetStatus::of(None, 0.0, Some(2.0)),
            TargetStatus::DirectionNotSet
        );
        assert_eq!(
            TargetStatus::of(None, 5.0, None),
            TargetStatus::NotApplicable
        );
    }
}
