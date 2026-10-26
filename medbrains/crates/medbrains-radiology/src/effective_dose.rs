//! Estimated effective dose from CT, by body region and age.
//!
//! Effective dose (mSv) ≈ DLP (mGy·cm) × k, where k depends on the region
//! scanned and the patient's size. The k-factors are AAPM Report 96 (2008),
//! Table 3, which most CT dose software still uses; adult values agree with
//! the ICRP 103-based updates to within the uncertainty of the method. A
//! head CT and an abdominal CT with the same DLP differ about sevenfold, and
//! a child's chest about threefold from an adult's — so a single factor is
//! wrong for most exams.
//!
//! What cannot be estimated is said so, never counted as zero:
//! - a region the order does not name (an extremity, or free text that
//!   matches nothing) — `Region` is `None`;
//! - a patient whose age is unknown, since children's factors differ;
//! - fluoroscopy and radiograph dose-area product, which needs per-projection
//!   coefficients this module does not hold.
//!
//! An estimate for comparing exposures, not a measured dose to this patient.

use chrono::{Datelike, NaiveDate};

/// Shown with every estimate, on the screen and in the API.
pub const METHOD: &str = "Estimated effective dose = DLP × k, AAPM Report 96 conversion \
     coefficients by body region and age. An estimate for comparing exposures, not a \
     measured dose to this patient. Fluoroscopy and radiograph dose-area product is not \
     converted.";

/// The CT body regions AAPM Report 96 gives k-factors for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Region {
    Head,
    HeadNeck,
    Neck,
    Chest,
    AbdomenPelvis,
    /// Chest, abdomen and pelvis in one acquisition.
    Trunk,
}

impl Region {
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Head => "head",
            Self::HeadNeck => "head and neck",
            Self::Neck => "neck",
            Self::Chest => "chest",
            Self::AbdomenPelvis => "abdomen and pelvis",
            Self::Trunk => "chest, abdomen and pelvis",
        }
    }

    /// k (mSv per mGy·cm) for ages 0, 1, 5 and 10 years, then adult.
    const fn k_factors(self) -> [f64; 5] {
        match self {
            Self::Head => [0.011, 0.0067, 0.0040, 0.0032, 0.0021],
            Self::HeadNeck => [0.013, 0.0085, 0.0057, 0.0042, 0.0031],
            Self::Neck => [0.017, 0.012, 0.011, 0.0079, 0.0059],
            Self::Chest => [0.039, 0.026, 0.018, 0.013, 0.014],
            Self::AbdomenPelvis => [0.049, 0.030, 0.020, 0.015, 0.015],
            Self::Trunk => [0.044, 0.028, 0.019, 0.014, 0.015],
        }
    }
}

/// Phrases checked first, so "head and neck" is not read as "head".
const PHRASES: [(&str, Region); 5] = [
    ("whole body", Region::Trunk),
    ("head neck", Region::HeadNeck),
    ("cervical spine", Region::Neck),
    ("thoracic spine", Region::Chest),
    ("lumbar spine", Region::AbdomenPelvis),
];

const WORDS: [(&str, Region); 33] = [
    ("cap", Region::Trunk),
    ("trunk", Region::Trunk),
    ("brain", Region::Head),
    ("head", Region::Head),
    ("skull", Region::Head),
    ("sinus", Region::Head),
    ("sinuses", Region::Head),
    ("pns", Region::Head),
    ("orbit", Region::Head),
    ("orbits", Region::Head),
    ("mastoid", Region::Head),
    ("facial", Region::Head),
    ("neck", Region::Neck),
    ("thyroid", Region::Neck),
    ("larynx", Region::Neck),
    ("chest", Region::Chest),
    ("thorax", Region::Chest),
    ("lung", Region::Chest),
    ("lungs", Region::Chest),
    ("hrct", Region::Chest),
    ("ctpa", Region::Chest),
    ("pulmonary", Region::Chest),
    ("cardiac", Region::Chest),
    ("coronary", Region::Chest),
    ("abdomen", Region::AbdomenPelvis),
    ("abdominal", Region::AbdomenPelvis),
    ("pelvis", Region::AbdomenPelvis),
    ("kub", Region::AbdomenPelvis),
    ("liver", Region::AbdomenPelvis),
    ("renal", Region::AbdomenPelvis),
    ("kidney", Region::AbdomenPelvis),
    ("urography", Region::AbdomenPelvis),
    ("enterography", Region::AbdomenPelvis),
];

/// The region an exam covers, from its body part and exam name; `None` when
/// they name no region with a k-factor.
#[must_use]
pub fn region_of(texts: &[Option<&str>]) -> Option<Region> {
    let text = texts
        .iter()
        .flatten()
        .copied()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    // "and", "with" and "ct" carry no region; dropping them lets
    // "Head and Neck" and "Chest, Abdomen & Pelvis" match as phrases.
    let words: Vec<&str> = text
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| !w.is_empty() && !matches!(*w, "and" | "with" | "ct"))
        .collect();
    let has = |w: &str| words.contains(&w);
    if (has("chest") || has("thorax")) && (has("abdomen") || has("pelvis")) {
        return Some(Region::Trunk);
    }
    let joined = words.join(" ");
    PHRASES
        .iter()
        .find(|(phrase, _)| joined.contains(phrase))
        .or_else(|| WORDS.iter().find(|(word, _)| has(word)))
        .map(|(_, region)| *region)
}

/// Which AAPM age column a patient falls in on the day of the exam:
/// 0 (under 6 months), 1 (to 3 years), 5 (to 7½), 10 (to 15), adult.
#[must_use]
pub fn age_column(date_of_birth: NaiveDate, on: NaiveDate) -> Option<usize> {
    let whole_months = (on.year() - date_of_birth.year()) * 12 + i32::try_from(on.month()).ok()?
        - i32::try_from(date_of_birth.month()).ok()?
        - i32::from(on.day() < date_of_birth.day());
    match whole_months {
        m if m < 0 => None,
        0..6 => Some(0),
        6..36 => Some(1),
        36..90 => Some(2),
        90..180 => Some(3),
        _ => Some(4),
    }
}

/// Why an exam's DLP was not turned into an effective dose.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotEstimated {
    RegionUnknown,
    AgeUnknown,
}

/// The estimated effective dose for one CT exam's DLP.
///
/// # Errors
/// Why it cannot be estimated: no region with a k-factor, or no age.
pub fn estimate_msv(
    dlp: f64,
    region: Option<Region>,
    date_of_birth: Option<NaiveDate>,
    on: NaiveDate,
) -> Result<f64, NotEstimated> {
    let region = region.ok_or(NotEstimated::RegionUnknown)?;
    let column = date_of_birth
        .and_then(|dob| age_column(dob, on))
        .ok_or(NotEstimated::AgeUnknown)?;
    Ok(dlp * region.k_factors()[column])
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    const EXAM: (i32, u32, u32) = (2026, 10, 26);

    fn adult(dlp: f64, region: Region) -> f64 {
        estimate_msv(
            dlp,
            Some(region),
            Some(date(1980, 3, 9)),
            date(EXAM.0, EXAM.1, EXAM.2),
        )
        .unwrap()
    }

    #[test]
    fn each_adult_region_has_its_own_factor() {
        let near = |a: f64, b: f64| (a - b).abs() < 1e-9;
        assert!(near(adult(1000.0, Region::Head), 2.1));
        assert!(near(adult(1000.0, Region::HeadNeck), 3.1));
        assert!(near(adult(1000.0, Region::Neck), 5.9));
        assert!(near(adult(1000.0, Region::Chest), 14.0));
        assert!(near(adult(1000.0, Region::AbdomenPelvis), 15.0));
        assert!(near(adult(1000.0, Region::Trunk), 15.0));
    }

    #[test]
    fn a_child_gets_the_childs_factor() {
        let on = date(EXAM.0, EXAM.1, EXAM.2);
        let infant = estimate_msv(100.0, Some(Region::Head), Some(date(2026, 8, 1)), on).unwrap();
        assert!((infant - 1.1).abs() < 1e-9, "under six months: 0.011");
        let five = estimate_msv(100.0, Some(Region::Chest), Some(date(2021, 6, 1)), on).unwrap();
        assert!((five - 1.8).abs() < 1e-9, "five years: 0.018");
        let twelve = estimate_msv(
            100.0,
            Some(Region::AbdomenPelvis),
            Some(date(2014, 1, 1)),
            on,
        )
        .unwrap();
        assert!((twelve - 1.5).abs() < 1e-9, "ten-year column: 0.015");
    }

    #[test]
    fn what_cannot_be_estimated_says_why_instead_of_zero() {
        let on = date(EXAM.0, EXAM.1, EXAM.2);
        assert_eq!(
            estimate_msv(500.0, None, Some(date(1980, 1, 1)), on),
            Err(NotEstimated::RegionUnknown)
        );
        assert_eq!(
            estimate_msv(500.0, Some(Region::Chest), None, on),
            Err(NotEstimated::AgeUnknown)
        );
    }

    #[test]
    fn regions_are_read_from_body_part_and_exam_name() {
        let r = |s: &str| region_of(&[Some(s)]);
        assert_eq!(r("CT Brain Plain"), Some(Region::Head));
        assert_eq!(r("Head"), Some(Region::Head));
        assert_eq!(r("CT Head and Neck angiography"), Some(Region::HeadNeck));
        assert_eq!(r("Soft tissue neck"), Some(Region::Neck));
        assert_eq!(r("HRCT Thorax"), Some(Region::Chest));
        assert_eq!(r("CT Chest, Abdomen & Pelvis"), Some(Region::Trunk));
        assert_eq!(r("CECT Abdomen"), Some(Region::AbdomenPelvis));
        assert_eq!(r("CT KUB"), Some(Region::AbdomenPelvis));
        assert_eq!(r("Lumbar spine"), Some(Region::AbdomenPelvis));
        assert_eq!(r("Left knee joint"), None);
        assert_eq!(
            region_of(&[None, Some("Computed tomography — Head")]),
            Some(Region::Head)
        );
        assert_eq!(region_of(&[None, None]), None);
    }
}
