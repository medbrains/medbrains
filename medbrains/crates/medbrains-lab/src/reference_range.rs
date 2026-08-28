//! Judging a numeric result against the global `cds_lab_reference` bands.
//!
//! The judgement used to be `Option<String>`, and four unrelated situations
//! collapsed into its `None`:
//!
//!   1. the value is not a number -- "MRSA isolated", "Reactive", "Growth seen"
//!   2. the analyte is absent from the reference table
//!   3. the analyte is present but the band that applies has NULL limits
//!   4. the table judged the value and it is within range
//!
//! Only the fourth is evidence of normality. The caller read all four as such
//! and stamped the result `is_auto_validated`, so a culture growing a resistant
//! organism and a serology reading "Reactive" were both recorded as
//! machine-verified normal -- and that flag is carried into the signed report
//! payload, which puts a false assertion into a signed clinical record.
//!
//! NABL 112 and ISO 15189 both require autoverification to run against a
//! documented rule. "The reference table had nothing to say" is not a rule that
//! passed; it is a rule that never ran, and it has to leave the result for a
//! human. So the verdict is three-valued, the same shape the authorization
//! rules take for the same reason: a fault must not inherit the answer a pass
//! wears.

/// One row of `cds_lab_reference`, already cast to float by the query.
#[derive(sqlx::FromRow, Default)]
pub(crate) struct LabRefRow {
    /// The band-agnostic range. Used when the patient's own band has no
    /// limits, which is how most of the seed CSV is shaped.
    pub normal_low: Option<f64>,
    pub normal_high: Option<f64>,
    pub critical_low: Option<f64>,
    pub critical_high: Option<f64>,
    pub neonate_low: Option<f64>,
    pub neonate_high: Option<f64>,
    pub infant_low: Option<f64>,
    pub infant_high: Option<f64>,
    pub child_low: Option<f64>,
    pub child_high: Option<f64>,
    pub adult_m_low: Option<f64>,
    pub adult_m_high: Option<f64>,
    pub adult_f_low: Option<f64>,
    pub adult_f_high: Option<f64>,
    pub elderly_low: Option<f64>,
    pub elderly_high: Option<f64>,
}

/// What the reference table is able to say about a value.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum RefVerdict {
    /// The table judged the value and it falls outside a band. Carries the
    /// `lab_result_flag` to record.
    Flagged(&'static str),
    /// The table judged the value and it falls inside the band.
    InRange,
    /// The table cannot judge this value. Never treat as normal.
    Unknown,
}

/// Pick the band that applies to the patient.
///
/// Elderly falls back to the sex-specific adult range when no elderly band is
/// defined, which is how the reference data is actually populated.
fn band_limits(row: &LabRefRow, band: &str) -> (Option<f64>, Option<f64>) {
    let (low, high) = match band {
        "neonate" => (row.neonate_low, row.neonate_high),
        "infant" => (row.infant_low, row.infant_high),
        "child" => (row.child_low, row.child_high),
        "adult_f" => (row.adult_f_low, row.adult_f_high),
        "elderly_f" => (
            row.elderly_low.or(row.adult_f_low),
            row.elderly_high.or(row.adult_f_high),
        ),
        "elderly_m" => (
            row.elderly_low.or(row.adult_m_low),
            row.elderly_high.or(row.adult_m_high),
        ),
        _ => (row.adult_m_low, row.adult_m_high),
    };
    // Fall back to the band-agnostic range rather than giving up: 26 of the
    // 100 seeded analytes carry no per-band limits, and many carry only the
    // default. Falling back judges them; refusing would call them Unknown and
    // send every one to a human for no clinical reason.
    if low.is_none() && high.is_none() {
        return (row.normal_low, row.normal_high);
    }
    (low, high)
}

/// Judge a value. Critical thresholds are checked before the normal band, so a
/// critical value is never reported merely as high.
pub(crate) fn judge(row: &LabRefRow, value: f64, band: &str) -> RefVerdict {
    if row.critical_low.is_some_and(|low| value < low) {
        return RefVerdict::Flagged("critical_low");
    }
    if row.critical_high.is_some_and(|high| value > high) {
        return RefVerdict::Flagged("critical_high");
    }

    let (low, high) = band_limits(row, band);
    if low.is_none() && high.is_none() {
        // The analyte is in the table but this patient's band is not
        // populated. Nothing has been checked, so nothing is known.
        return RefVerdict::Unknown;
    }
    if low.is_some_and(|low| value < low) {
        return RefVerdict::Flagged("low");
    }
    if high.is_some_and(|high| value > high) {
        return RefVerdict::Flagged("high");
    }
    RefVerdict::InRange
}

#[cfg(test)]
mod tests {
    use super::{LabRefRow, RefVerdict, judge};

    fn adult_band(low: f64, high: f64) -> LabRefRow {
        LabRefRow {
            adult_m_low: Some(low),
            adult_m_high: Some(high),
            ..LabRefRow::default()
        }
    }

    #[test]
    fn a_value_inside_the_band_is_in_range() {
        assert_eq!(judge(&adult_band(13.0, 17.0), 15.0, "adult_m"), RefVerdict::InRange);
    }

    #[test]
    fn a_value_outside_the_band_is_flagged() {
        assert_eq!(
            judge(&adult_band(13.0, 17.0), 11.0, "adult_m"),
            RefVerdict::Flagged("low")
        );
        assert_eq!(
            judge(&adult_band(13.0, 17.0), 19.0, "adult_m"),
            RefVerdict::Flagged("high")
        );
    }

    #[test]
    fn critical_beats_the_normal_band() {
        // A haemoglobin of 4 is both low and critically low. Reporting it as
        // merely "low" would keep it out of the critical-alert path that pages
        // the ordering doctor.
        let row = LabRefRow {
            critical_low: Some(7.0),
            ..adult_band(13.0, 17.0)
        };
        assert_eq!(judge(&row, 4.0, "adult_m"), RefVerdict::Flagged("critical_low"));
    }

    #[test]
    fn an_unpopulated_band_with_no_default_is_unknown_not_normal() {
        // The regression that matters. The analyte exists, but this patient is
        // a neonate, no neonate range is defined, and there is no default
        // either. Nothing was checked, so the result must reach a human rather
        // than be auto-validated.
        let row = adult_band(13.0, 17.0);
        assert_eq!(judge(&row, 15.0, "neonate"), RefVerdict::Unknown);
    }

    #[test]
    fn an_unpopulated_band_falls_back_to_the_default_range() {
        // Most of the seed carries a default range and no per-band limits.
        let row = LabRefRow {
            normal_low: Some(12.0),
            normal_high: Some(16.0),
            ..adult_band(13.0, 17.0)
        };
        assert_eq!(judge(&row, 14.0, "neonate"), RefVerdict::InRange);
        assert_eq!(judge(&row, 20.0, "neonate"), RefVerdict::Flagged("high"));
        // The patient's own band still wins where it exists.
        assert_eq!(judge(&row, 12.5, "adult_m"), RefVerdict::Flagged("low"));
    }

    #[test]
    fn a_critical_threshold_still_applies_when_the_band_is_unpopulated() {
        // Unknown must not swallow a critical value: the critical thresholds
        // are analyte-wide, not per band.
        let row = LabRefRow {
            critical_high: Some(500.0),
            ..LabRefRow::default()
        };
        assert_eq!(judge(&row, 900.0, "neonate"), RefVerdict::Flagged("critical_high"));
        assert_eq!(judge(&row, 100.0, "neonate"), RefVerdict::Unknown);
    }

    #[test]
    fn a_half_open_band_still_judges_the_side_it_has() {
        // Only an upper limit defined: above it is high, below it is in range.
        let row = LabRefRow {
            adult_m_high: Some(5.0),
            ..LabRefRow::default()
        };
        assert_eq!(judge(&row, 6.0, "adult_m"), RefVerdict::Flagged("high"));
        assert_eq!(judge(&row, 1.0, "adult_m"), RefVerdict::InRange);
    }

    #[test]
    fn elderly_falls_back_to_the_adult_band_of_the_same_sex() {
        let row = LabRefRow {
            adult_f_low: Some(12.0),
            adult_f_high: Some(15.0),
            ..LabRefRow::default()
        };
        assert_eq!(judge(&row, 13.0, "elderly_f"), RefVerdict::InRange);
        assert_eq!(judge(&row, 16.0, "elderly_f"), RefVerdict::Flagged("high"));
    }

    #[test]
    fn the_boundary_itself_is_in_range() {
        // Reference ranges are inclusive; a haemoglobin of exactly 13.0 is not
        // low. Comparisons are strict for that reason.
        let row = adult_band(13.0, 17.0);
        assert_eq!(judge(&row, 13.0, "adult_m"), RefVerdict::InRange);
        assert_eq!(judge(&row, 17.0, "adult_m"), RefVerdict::InRange);
    }
}
