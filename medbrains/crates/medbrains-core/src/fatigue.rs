//! Duty-hours fatigue guard — a pure evaluator that turns worked-hours
//! numbers into advisory fatigue flags. Long continuous hours, too little
//! rest between shifts, and a heavy rolling week are known patient-safety
//! and burnout drivers (NABH HRM duty-hours).
//!
//! Advisory only: the caller surfaces flags for the staff to acknowledge —
//! it never blocks. Pure + unit-tested; the route layer feeds it the three
//! numbers it computes from `attendance_records`.

use serde::Serialize;

/// Thresholds beyond which work becomes a fatigue concern.
#[derive(Debug, Clone, Copy)]
pub struct FatigueThresholds {
    /// Max continuous hours on the current shift before flagging.
    pub continuous_h: f64,
    /// Min rest hours since the previous shift ended before flagging.
    pub rest_h: f64,
    /// Max hours worked in the rolling 7-day window before flagging.
    pub week_h: f64,
}

impl Default for FatigueThresholds {
    fn default() -> Self {
        Self {
            continuous_h: 12.0,
            rest_h: 8.0,
            week_h: 60.0,
        }
    }
}

/// A single fatigue concern, with the measured value and its limit.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FatigueFlag {
    LongContinuous { hours: f64, limit: f64 },
    ShortRest { hours: f64, limit: f64 },
    HeavyWeek { hours: f64, limit: f64 },
}

impl FatigueFlag {
    /// A short, human-facing message for the staff member.
    #[must_use]
    pub fn message(&self) -> String {
        match self {
            Self::LongContinuous { hours, .. } => {
                format!("You've worked {hours:.1}h continuously — fatigue raises error risk.")
            }
            Self::ShortRest { hours, .. } => {
                format!("Only {hours:.1}h rest since your last shift.")
            }
            Self::HeavyWeek { hours, .. } => {
                format!("You've worked {hours:.0}h in the last 7 days.")
            }
        }
    }

    /// A stable code stored in `attendance_records.fatigue_flags`.
    #[must_use]
    pub const fn code(&self) -> &'static str {
        match self {
            Self::LongContinuous { .. } => "long_continuous",
            Self::ShortRest { .. } => "short_rest",
            Self::HeavyWeek { .. } => "heavy_week",
        }
    }
}

/// Evaluate the three duty-hours numbers against the thresholds.
///
/// `rest_h` is `None` when there is no prior shift to rest from (e.g. first
/// shift on record) — in that case no rest flag is raised.
#[must_use]
pub fn evaluate(
    continuous_h: f64,
    rest_h: Option<f64>,
    week_h: f64,
    t: FatigueThresholds,
) -> Vec<FatigueFlag> {
    let mut flags = Vec::new();
    if continuous_h > t.continuous_h {
        flags.push(FatigueFlag::LongContinuous {
            hours: continuous_h,
            limit: t.continuous_h,
        });
    }
    if let Some(rest) = rest_h {
        if rest < t.rest_h {
            flags.push(FatigueFlag::ShortRest {
                hours: rest,
                limit: t.rest_h,
            });
        }
    }
    if week_h > t.week_h {
        flags.push(FatigueFlag::HeavyWeek {
            hours: week_h,
            limit: t.week_h,
        });
    }
    flags
}

#[cfg(test)]
mod tests {
    use super::*;

    fn th() -> FatigueThresholds {
        FatigueThresholds::default()
    }

    #[test]
    fn fresh_shift_no_flags() {
        assert!(evaluate(4.0, Some(12.0), 30.0, th()).is_empty());
    }

    #[test]
    fn long_continuous_flagged() {
        let flags = evaluate(13.0, Some(12.0), 30.0, th());
        assert_eq!(flags.len(), 1);
        assert_eq!(flags[0].code(), "long_continuous");
    }

    #[test]
    fn short_rest_flagged() {
        let flags = evaluate(2.0, Some(6.0), 30.0, th());
        assert_eq!(
            flags,
            vec![FatigueFlag::ShortRest {
                hours: 6.0,
                limit: 8.0
            }]
        );
    }

    #[test]
    fn no_prior_shift_no_rest_flag() {
        assert!(evaluate(2.0, None, 30.0, th()).is_empty());
    }

    #[test]
    fn heavy_week_flagged() {
        let flags = evaluate(4.0, Some(12.0), 65.0, th());
        assert_eq!(flags[0].code(), "heavy_week");
    }

    #[test]
    fn double_shift_trips_multiple() {
        let flags = evaluate(14.0, Some(5.0), 70.0, th());
        assert_eq!(flags.len(), 3);
    }

    #[test]
    fn boundary_is_not_flagged() {
        // exactly at the limit is OK; strictly beyond trips.
        assert!(evaluate(12.0, Some(8.0), 60.0, th()).is_empty());
    }
}
