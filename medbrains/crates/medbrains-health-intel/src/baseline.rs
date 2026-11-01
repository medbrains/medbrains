//! This week against the hospital's own usual, for one condition.
//!
//! Counts come in 7-day blocks counted back from now: block 0 is the last 7
//! days, block `k` the 7 days that ended `k` weeks ago.
//!
//! **The usual.** With at least two years of history, the CDC "historical
//! limits" method (Stroup et al., 1989): the same week and the weeks either
//! side of it in each previous year (up to three years, so 6–9 blocks).
//! Otherwise the 8 weeks before this one. Under 4 weeks of history there is
//! no usual and nothing is flagged.
//!
//! **The rule.** Spread is the larger of the past weeks' standard deviation,
//! the square root of the usual (the Poisson spread of a count) and 1.
//! - *higher than usual*: at least 5 cases **and** more than usual + 2 × spread;
//! - *much higher than usual*: at least 5 cases **and** more than usual + 3 × spread.
//!
//! The floor of 5 keeps a single family cluster in a quiet week from reading
//! as an outbreak, and matches the small-count suppression below.

use serde::Serialize;

/// Fewer cases than this are never flagged and never shown as a number
/// outside the infection-control team (RFC-OSINT §4, privacy).
pub const MIN_COUNT: i64 = 5;
/// Weeks of trend kept per condition.
pub const SERIES_WEEKS: usize = 12;
/// Blocks read back from now: three years plus one week either side.
pub const HISTORY_BLOCKS: usize = 3 * 52 + 2;
const ROLLING_WEEKS: usize = 8;
const MIN_ROLLING_WEEKS: usize = 4;
const WEEKS_PER_YEAR: usize = 52;
const MAX_YEARS: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Method {
    SameWeeksPreviousYears,
    Rolling8Weeks,
    NotEnoughHistory,
}

impl Method {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::SameWeeksPreviousYears => "same_weeks_previous_years",
            Self::Rolling8Weeks => "rolling_8_weeks",
            Self::NotEnoughHistory => "not_enough_history",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Level {
    Usual,
    Higher,
    MuchHigher,
}

impl Level {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Usual => "usual",
            Self::Higher => "higher",
            Self::MuchHigher => "much_higher",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Assessment {
    pub this_week: i64,
    pub usual: Option<f64>,
    pub spread: Option<f64>,
    pub method: Method,
    pub level: Level,
}

/// Which past blocks make up the usual, given how many weeks of history exist.
fn baseline_blocks(history_weeks: usize) -> (Method, Vec<usize>) {
    let years = (history_weeks.saturating_sub(1) / WEEKS_PER_YEAR).min(MAX_YEARS);
    if years >= 2 {
        let blocks = (1..=years)
            .flat_map(|y| {
                let centre = y * WEEKS_PER_YEAR;
                [centre - 1, centre, centre + 1]
            })
            .filter(|&b| b < HISTORY_BLOCKS)
            .collect();
        return (Method::SameWeeksPreviousYears, blocks);
    }
    let weeks = history_weeks.min(ROLLING_WEEKS);
    if weeks < MIN_ROLLING_WEEKS {
        return (Method::NotEnoughHistory, Vec::new());
    }
    (Method::Rolling8Weeks, (1..=weeks).collect())
}

fn mean_and_sd(values: &[f64]) -> (f64, f64) {
    #[allow(clippy::cast_precision_loss)] // at most nine blocks
    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;
    if values.len() < 2 {
        return (mean, 0.0);
    }
    let var = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
    (mean, var.sqrt())
}

/// Assess block 0 of `blocks` against the usual. `blocks[k]` is the count
/// `k` weeks back (missing blocks count as 0); `history_weeks` is how many
/// whole weeks the hospital has recorded at all.
pub fn assess(blocks: &[i64], history_weeks: usize) -> Assessment {
    let at = |k: usize| blocks.get(k).copied().unwrap_or(0);
    let this_week = at(0);
    let (method, picks) = baseline_blocks(history_weeks);
    if picks.is_empty() {
        return Assessment {
            this_week,
            usual: None,
            spread: None,
            method,
            level: Level::Usual,
        };
    }
    #[allow(clippy::cast_precision_loss)] // weekly counts
    let values: Vec<f64> = picks.iter().map(|&k| at(k) as f64).collect();
    let (usual, sd) = mean_and_sd(&values);
    let spread = sd.max(usual.sqrt()).max(1.0);
    #[allow(clippy::cast_precision_loss)]
    let count = this_week as f64;
    let level = if this_week < MIN_COUNT {
        Level::Usual
    } else if count > 3.0f64.mul_add(spread, usual) {
        Level::MuchHigher
    } else if count > 2.0f64.mul_add(spread, usual) {
        Level::Higher
    } else {
        Level::Usual
    };
    Assessment {
        this_week,
        usual: Some(usual),
        spread: Some(spread),
        method,
        level,
    }
}

/// The trend for the chart, oldest week first.
pub fn series(blocks: &[i64]) -> Vec<i64> {
    (0..SERIES_WEEKS)
        .rev()
        .map(|k| blocks.get(k).copied().unwrap_or(0))
        .collect()
}

/// A count as shown to someone outside the infection-control team: 1–4
/// becomes `None` ("fewer than 5"); 0 and 5 or more are shown.
pub const fn suppress(count: i64) -> Option<i64> {
    if count > 0 && count < MIN_COUNT {
        None
    } else {
        Some(count)
    }
}

#[cfg(test)]
mod tests {
    use super::{Level, Method, assess, series, suppress};

    #[test]
    fn a_spike_over_a_steady_rolling_baseline_is_higher_than_usual() {
        let a = assess(&[14, 4, 3, 5, 4, 4, 3, 5, 4], 20);
        assert_eq!(a.method, Method::Rolling8Weeks);
        assert!(a.level >= Level::Higher, "{a:?}");
    }

    #[test]
    fn a_flat_series_is_usual() {
        let a = assess(&[6, 6, 6, 6, 6, 6, 6, 6, 6], 30);
        assert_eq!(a.level, Level::Usual);
        assert_eq!(a.usual, Some(6.0));
    }

    #[test]
    fn three_cases_never_flag_even_from_nothing() {
        let a = assess(&[3, 0, 0, 0, 0, 0, 0, 0, 0], 30);
        assert_eq!(a.level, Level::Usual);
    }

    #[test]
    fn a_moderate_rise_is_higher_but_not_much_higher() {
        // usual 4, spread 2: higher above 8, much higher above 10.
        let a = assess(&[9, 4, 4, 4, 4, 4, 4, 4, 4], 30);
        assert_eq!(a.level, Level::Higher);
    }

    #[test]
    fn two_years_of_history_compares_the_same_weeks_in_earlier_years() {
        let mut blocks = vec![0_i64; 160];
        blocks[0] = 12;
        // Every monsoon brings about 10: this week is usual for the season,
        // although the last 8 weeks were quiet.
        for k in [51, 52, 53, 103, 104, 105] {
            blocks[k] = 10;
        }
        let a = assess(&blocks, 120);
        assert_eq!(a.method, Method::SameWeeksPreviousYears);
        assert_eq!(a.level, Level::Usual);
        // The same 12 against the rolling 8 weeks would be much higher.
        let rolling = assess(&blocks, 60);
        assert_eq!(rolling.level, Level::MuchHigher);
    }

    #[test]
    fn under_four_weeks_of_history_there_is_no_usual() {
        let a = assess(&[40, 0, 0], 3);
        assert_eq!(a.method, Method::NotEnoughHistory);
        assert_eq!(a.level, Level::Usual);
        assert_eq!(a.usual, None);
    }

    #[test]
    fn small_counts_are_suppressed_zero_and_five_are_not() {
        assert_eq!(suppress(0), Some(0));
        for n in 1..5 {
            assert_eq!(suppress(n), None);
        }
        assert_eq!(suppress(5), Some(5));
    }

    #[test]
    fn the_series_runs_oldest_first() {
        let s = series(&[9, 8, 7]);
        assert_eq!(s.len(), 12);
        assert_eq!(&s[9..], &[7, 8, 9]);
    }
}
