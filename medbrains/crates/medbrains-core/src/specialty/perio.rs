//! Periodontal charting, six sites per tooth.
//!
//! FDI numbering, as the dental chart, with probing depth, recession,
//! bleeding on probing, mobility and furcation, and how one chart compares
//! with an earlier one.
//!
//! Sites, as charted: distobuccal, buccal, mesiobuccal on the buccal/labial
//! side, then distolingual, lingual, mesiolingual on the lingual/palatal side.
//! Clinical attachment level is probing depth plus recession (recession is
//! negative where the gingival margin sits above the cementoenamel junction).
//! A change of 2 mm or more at a site is reported as clinically significant.

use serde::{Deserialize, Serialize};

use super::dental::is_fdi_tooth;

/// The six sites of a tooth, in charting order.
pub const SITES: [&str; 6] = ["DB", "B", "MB", "DL", "L", "ML"];
/// Deepest probing depth accepted, in mm.
const MAX_DEPTH_MM: i16 = 15;
/// Recession accepted, in mm (negative: margin above the CEJ).
const RECESSION_MM: std::ops::RangeInclusive<i16> = -5..=15;
/// A change at a site this large or larger is clinically significant.
pub const SIGNIFICANT_CHANGE_MM: i16 = 2;

/// One tooth on a periodontal chart.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PerioTooth {
    pub tooth: String,
    #[serde(default)]
    pub missing: bool,
    /// Probing depth per site, mm.
    #[serde(default)]
    pub probing: [Option<i16>; 6],
    /// Recession per site, mm.
    #[serde(default)]
    pub recession: [Option<i16>; 6],
    /// Bleeding on probing per site.
    #[serde(default)]
    pub bleeding: [bool; 6],
    /// Miller mobility grade, 0 to 3.
    pub mobility: Option<i16>,
    /// Furcation involvement grade, 0 to 3 (multi-rooted teeth only).
    pub furcation: Option<i16>,
}

/// Whether `tooth` (FDI) has more than one root, so furcation applies:
/// permanent molars, upper first premolars, deciduous molars.
#[must_use]
pub fn is_multi_rooted(tooth: &str) -> bool {
    let b = tooth.as_bytes();
    let (Some(&q), Some(&t)) = (b.first(), b.get(1)) else {
        return false;
    };
    matches!(
        (q, t),
        (b'1'..=b'4', b'6'..=b'8') | (b'1' | b'2', b'4') | (b'5'..=b'8', b'4' | b'5')
    )
}

/// What is wrong with a tooth's entry, if anything.
#[must_use]
pub fn invalid(t: &PerioTooth) -> Option<String> {
    if !is_fdi_tooth(&t.tooth) {
        return Some(format!("{} is not an FDI tooth number", t.tooth));
    }
    if t.missing {
        return None;
    }
    if t.probing
        .iter()
        .flatten()
        .any(|d| !(0..=MAX_DEPTH_MM).contains(d))
    {
        return Some(format!(
            "tooth {}: probing depth must be 0–{MAX_DEPTH_MM} mm",
            t.tooth
        ));
    }
    if t.recession
        .iter()
        .flatten()
        .any(|r| !RECESSION_MM.contains(r))
    {
        return Some(format!("tooth {}: recession must be −5 to 15 mm", t.tooth));
    }
    if t.mobility.is_some_and(|m| !(0..=3).contains(&m)) {
        return Some(format!("tooth {}: mobility is graded 0–3", t.tooth));
    }
    match t.furcation {
        Some(f) if !(0..=3).contains(&f) => {
            Some(format!("tooth {}: furcation is graded 0–3", t.tooth))
        }
        Some(f) if f > 0 && !is_multi_rooted(&t.tooth) => {
            Some(format!("tooth {} has a single root: no furcation", t.tooth))
        }
        _ => None,
    }
}

/// The whole-mouth figures a periodontist reads first.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PerioSummary {
    pub teeth_present: usize,
    pub sites_probed: usize,
    pub bleeding_percent: Option<f64>,
    pub sites_4mm_or_more: usize,
    pub sites_6mm_or_more: usize,
    pub mean_probing_mm: Option<f64>,
    pub mean_attachment_level_mm: Option<f64>,
}

#[allow(clippy::cast_precision_loss)]
fn mean(sum: i64, n: usize) -> Option<f64> {
    (n > 0).then(|| ((sum as f64 / n as f64) * 10.0).round() / 10.0)
}

/// Summarise a chart.
#[must_use]
pub fn summary(teeth: &[PerioTooth]) -> PerioSummary {
    let present: Vec<&PerioTooth> = teeth.iter().filter(|t| !t.missing).collect();
    let (mut probed, mut bleeding, mut ge4, mut ge6, mut pd_sum) = (0usize, 0usize, 0, 0, 0i64);
    let (mut cal_n, mut cal_sum) = (0usize, 0i64);
    for t in &present {
        for i in 0..6 {
            if let Some(pd) = t.probing[i] {
                probed += 1;
                pd_sum += i64::from(pd);
                ge4 += usize::from(pd >= 4);
                ge6 += usize::from(pd >= 6);
                bleeding += usize::from(t.bleeding[i]);
                if let Some(rec) = t.recession[i] {
                    cal_n += 1;
                    cal_sum += i64::from(pd + rec);
                }
            }
        }
    }
    #[allow(clippy::cast_precision_loss)]
    let bleeding_percent =
        (probed > 0).then(|| ((bleeding as f64 * 1000.0 / probed as f64).round()) / 10.0);
    PerioSummary {
        teeth_present: present.len(),
        sites_probed: probed,
        bleeding_percent,
        sites_4mm_or_more: ge4,
        sites_6mm_or_more: ge6,
        mean_probing_mm: mean(pd_sum, probed),
        mean_attachment_level_mm: mean(cal_sum, cal_n),
    }
}

/// A site whose probing depth moved by [`SIGNIFICANT_CHANGE_MM`] or more.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SiteChange {
    pub tooth: String,
    pub site: &'static str,
    pub before_mm: i16,
    pub after_mm: i16,
}

/// Sites that deepened or improved by 2 mm or more between two charts.
#[must_use]
pub fn significant_changes(before: &[PerioTooth], after: &[PerioTooth]) -> Vec<SiteChange> {
    let mut out = Vec::new();
    for a in after.iter().filter(|t| !t.missing) {
        let Some(b) = before.iter().find(|b| b.tooth == a.tooth && !b.missing) else {
            continue;
        };
        for (i, site) in SITES.iter().enumerate() {
            if let (Some(x), Some(y)) = (b.probing[i], a.probing[i])
                && (y - x).abs() >= SIGNIFICANT_CHANGE_MM
            {
                out.push(SiteChange {
                    tooth: a.tooth.clone(),
                    site,
                    before_mm: x,
                    after_mm: y,
                });
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{PerioTooth, invalid, is_multi_rooted, significant_changes, summary};

    fn tooth(t: &str, probing: [i16; 6], bleeding: [bool; 6]) -> PerioTooth {
        PerioTooth {
            tooth: t.to_owned(),
            missing: false,
            probing: probing.map(Some),
            recession: [Some(1); 6],
            bleeding,
            mobility: Some(0),
            furcation: None,
        }
    }

    #[test]
    fn furcation_only_on_teeth_with_more_than_one_root() {
        for multi in ["16", "26", "36", "47", "14", "24", "54", "85"] {
            assert!(is_multi_rooted(multi), "{multi}");
        }
        for single in ["11", "13", "15", "34", "44", "51", "53"] {
            assert!(!is_multi_rooted(single), "{single}");
        }
        let mut t = tooth("11", [3; 6], [false; 6]);
        t.furcation = Some(1);
        assert!(invalid(&t).is_some_and(|e| e.contains("single root")));
        t.tooth = "36".into();
        assert_eq!(invalid(&t), None);
    }

    #[test]
    fn readings_out_of_range_or_off_the_chart_are_refused() {
        assert!(invalid(&tooth("19", [3; 6], [false; 6])).is_some());
        assert!(invalid(&tooth("16", [3, 3, 16, 3, 3, 3], [false; 6])).is_some());
        let mut t = tooth("16", [3; 6], [false; 6]);
        t.mobility = Some(4);
        assert!(invalid(&t).is_some());
    }

    #[test]
    fn the_summary_counts_sites_bleeding_and_attachment() {
        let teeth = vec![
            tooth(
                "16",
                [3, 2, 5, 3, 2, 6],
                [true, false, true, false, false, true],
            ),
            tooth("11", [2; 6], [false; 6]),
            PerioTooth {
                missing: true,
                ..tooth("18", [0; 6], [false; 6])
            },
        ];
        let s = summary(&teeth);
        assert_eq!(s.teeth_present, 2);
        assert_eq!(s.sites_probed, 12);
        assert_eq!(s.bleeding_percent, Some(25.0));
        assert_eq!((s.sites_4mm_or_more, s.sites_6mm_or_more), (2, 1));
        assert_eq!(s.mean_probing_mm, Some(2.8));
        assert_eq!(s.mean_attachment_level_mm, Some(3.8));
    }

    #[test]
    fn a_two_millimetre_change_at_a_site_is_reported() {
        let before = vec![tooth("36", [3, 3, 3, 3, 3, 3], [false; 6])];
        let after = vec![tooth("36", [3, 5, 4, 1, 3, 3], [false; 6])];
        let changes = significant_changes(&before, &after);
        assert_eq!(changes.len(), 2);
        assert_eq!((changes[0].site, changes[0].after_mm), ("B", 5));
        assert_eq!((changes[1].site, changes[1].after_mm), ("DL", 1));
    }
}
