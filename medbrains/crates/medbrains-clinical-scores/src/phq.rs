//! PHQ-9 and GAD-7 — the depression and anxiety screening questionnaires.
//!
//! Each item is answered 0-3 ("not at all" .. "nearly every day") over the
//! last two weeks. Severity bands are the instrument authors' (Kroenke,
//! Spitzer et al.):
//!
//! - PHQ-9, 0-27: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately
//!   severe, 20-27 severe.
//! - GAD-7, 0-21: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe.
//!
//! PHQ-9 item 9 asks about thoughts of being better off dead or of
//! self-harm. Any answer above 0 is positive whatever the total, and calls
//! for a same-day clinician suicide-risk assessment.
//!
//! Pure scoring, shared by whatever persists the result, so every screen
//! bands the same total the same way.

/// Which questionnaire.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instrument {
    Phq9,
    Gad7,
}

impl Instrument {
    /// The stored code.
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Phq9 => "phq9",
            Self::Gad7 => "gad7",
        }
    }

    #[must_use]
    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "phq9" => Some(Self::Phq9),
            "gad7" => Some(Self::Gad7),
            _ => None,
        }
    }

    #[must_use]
    pub const fn items(self) -> usize {
        match self {
            Self::Phq9 => 9,
            Self::Gad7 => 7,
        }
    }
}

/// The highest answer to any item.
pub const MAX_ITEM_SCORE: i16 = 3;

/// A scored questionnaire.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Scored {
    pub total: i32,
    pub severity: &'static str,
    /// PHQ-9 item 9 above zero. Always false for GAD-7.
    pub item9_positive: bool,
}

/// Why a set of answers cannot be scored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScoreError {
    WrongItemCount { expected: usize, got: usize },
    OutOfRange { item: usize, value: i16 },
}

impl std::fmt::Display for ScoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::WrongItemCount { expected, got } => {
                write!(f, "expected {expected} answers, got {got}")
            }
            Self::OutOfRange { item, value } => {
                write!(f, "item {item} must be 0-{MAX_ITEM_SCORE}, got {value}")
            }
        }
    }
}

/// Score `answers` (in item order) for `instrument`.
///
/// # Errors
/// The wrong number of answers, or an answer outside 0-3.
pub fn score(instrument: Instrument, answers: &[i16]) -> Result<Scored, ScoreError> {
    if answers.len() != instrument.items() {
        return Err(ScoreError::WrongItemCount {
            expected: instrument.items(),
            got: answers.len(),
        });
    }
    if let Some((i, &v)) = answers
        .iter()
        .enumerate()
        .find(|(_, v)| !(0..=MAX_ITEM_SCORE).contains(*v))
    {
        return Err(ScoreError::OutOfRange {
            item: i + 1,
            value: v,
        });
    }
    let total: i32 = answers.iter().map(|&v| i32::from(v)).sum();
    let severity = match (instrument, total) {
        (_, 0..=4) => "minimal",
        (_, 5..=9) => "mild",
        (_, 10..=14) => "moderate",
        (Instrument::Phq9, 15..=19) => "moderately_severe",
        _ => "severe",
    };
    let item9_positive = instrument == Instrument::Phq9 && answers[8] > 0;
    Ok(Scored {
        total,
        severity,
        item9_positive,
    })
}

#[cfg(test)]
mod tests {
    use super::{Instrument, ScoreError, score};

    #[test]
    fn phq9_bands_at_the_published_cut_offs() {
        let band = |t: i16| {
            // Spread `t` over the first eight items, item 9 left at 0.
            let mut a = [0_i16; 9];
            let mut left = t;
            for v in a.iter_mut().take(8) {
                *v = left.min(3);
                left -= *v;
            }
            score(Instrument::Phq9, &a).map(|s| s.severity)
        };
        assert_eq!(band(4), Ok("minimal"));
        assert_eq!(band(5), Ok("mild"));
        assert_eq!(band(10), Ok("moderate"));
        assert_eq!(band(15), Ok("moderately_severe"));
        assert_eq!(band(20), Ok("severe"));
    }

    #[test]
    fn gad7_has_no_moderately_severe_band() {
        let s = score(Instrument::Gad7, &[3, 3, 3, 3, 3, 0, 0]);
        assert_eq!(s.map(|s| (s.total, s.severity)), Ok((15, "severe")));
    }

    /// Item 9 is a safety signal on its own: a total of 1 with item 9 at 1
    /// is "minimal" depression and still a positive suicide screen.
    #[test]
    fn item9_positive_regardless_of_total() {
        let s = score(Instrument::Phq9, &[0, 0, 0, 0, 0, 0, 0, 0, 1]);
        assert!(
            s.as_ref()
                .is_ok_and(|s| s.item9_positive && s.severity == "minimal")
        );
        let s = score(Instrument::Phq9, &[3, 3, 3, 3, 3, 3, 3, 3, 0]);
        assert!(s.is_ok_and(|s| !s.item9_positive));
    }

    #[test]
    fn rejects_missing_or_out_of_range_answers() {
        assert_eq!(
            score(Instrument::Gad7, &[0; 9]),
            Err(ScoreError::WrongItemCount {
                expected: 7,
                got: 9
            })
        );
        assert_eq!(
            score(Instrument::Phq9, &[0, 0, 4, 0, 0, 0, 0, 0, 0]),
            Err(ScoreError::OutOfRange { item: 3, value: 4 })
        );
    }
}
