//! IAP 2015 growth references, 5-18 years.
//!
//! Source: Khadilkar V, Yadav S, Agrawal KK, et al. Revised IAP Growth Charts
//! for Height, Weight and Body Mass Index for 5- to 18-year-old Indian
//! Children. Indian Pediatr 2015;52:47-55, Tables II-VII (`data/iap_2015.tsv`).
//!
//! The paper publishes centile values at half-year ages, not LMS parameters.
//! So a z-score here is read off the published centiles: the centile curves
//! are interpolated linearly in age, and the measurement's z linearly between
//! the z of the two centiles it falls between. Within the 3rd-97th band that
//! reproduces the published chart; outside it the value is extrapolated from
//! the outermost band and marked so.
//!
//! BMI publishes 3rd-50th centiles plus the adult-equivalent 23 and 27 cut-off
//! lines (overweight and obesity for Asian Indian children). The paper places
//! those at about the 71st and 90th centile for boys and the 75th and 95th for
//! girls; those positions are used as their z.

use std::sync::OnceLock;

use super::Sex;

/// Indicators IAP 2015 covers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum IapIndicator {
    Height,
    Weight,
    Bmi,
}

impl IapIndicator {
    const fn key(self) -> &'static str {
        match self {
            Self::Height => "height",
            Self::Weight => "weight",
            Self::Bmi => "bmi",
        }
    }
}

/// z of the 3rd, 10th, 25th, 50th, 75th, 90th, 97th centiles.
const HW_Z: [f64; 7] = [
    -1.880_794, -1.281_552, -0.674_490, 0.0, 0.674_490, 1.281_552, 1.880_794,
];

/// z of the BMI columns: 3rd, 5th, 10th, 25th, 50th, then the adult-equivalent
/// 23 and 27 lines at the centiles the paper gives for each sex.
fn bmi_z(sex: Sex) -> [f64; 7] {
    let (ov, ob) = match sex {
        Sex::Male => (0.553_385, 1.281_552),   // 71st, 90th
        Sex::Female => (0.674_490, 1.644_854), // 75th, 95th
    };
    [-1.880_794, -1.644_854, -1.281_552, -0.674_490, 0.0, ov, ob]
}

/// The z of each column of an indicator's table.
pub(super) fn column_z(ind: IapIndicator, sex: Sex) -> [f64; 7] {
    match ind {
        IapIndicator::Bmi => bmi_z(sex),
        _ => HW_Z,
    }
}

/// Column labels, for the chart's reference lines.
pub(super) const fn column_labels(ind: IapIndicator) -> [&'static str; 7] {
    match ind {
        IapIndicator::Bmi => [
            "3rd",
            "5th",
            "10th",
            "25th",
            "50th",
            "Adult-eq 23",
            "Adult-eq 27",
        ],
        _ => ["3rd", "10th", "25th", "50th", "75th", "90th", "97th"],
    }
}

/// (age in years, the seven column values) rows.
type Rows = Vec<(f64, [f64; 7])>;

fn rows(ind: IapIndicator, sex: Sex) -> &'static Rows {
    static ALL: OnceLock<Vec<(&'static str, u8, Rows)>> = OnceLock::new();
    let all = ALL.get_or_init(|| {
        let mut out: Vec<(&'static str, u8, Rows)> = Vec::new();
        for line in include_str!("data/iap_2015.tsv").lines() {
            if line.starts_with('#') || line.trim().is_empty() {
                continue;
            }
            let c: Vec<&str> = line.split('\t').collect();
            let nums: Vec<f64> = c
                .iter()
                .skip(2)
                .filter_map(|v| v.trim().parse().ok())
                .collect();
            let (Some(key), Some(sex)) = (
                ["height", "weight", "bmi"]
                    .into_iter()
                    .find(|k| c.first() == Some(k)),
                c.get(1).and_then(|s| s.trim().parse::<u8>().ok()),
            ) else {
                continue;
            };
            let Ok(values) = <[f64; 7]>::try_from(nums.get(1..8).unwrap_or_default()) else {
                continue;
            };
            let age = nums.first().copied().unwrap_or(f64::NAN);
            match out.iter_mut().find(|(k, s, _)| *k == key && *s == sex) {
                Some((_, _, r)) => r.push((age, values)),
                None => out.push((key, sex, vec![(age, values)])),
            }
        }
        out
    });
    let want = match sex {
        Sex::Male => 1,
        Sex::Female => 2,
    };
    static EMPTY: Rows = Vec::new();
    all.iter()
        .find(|(k, s, _)| *k == ind.key() && *s == want)
        .map_or(&EMPTY, |(_, _, r)| r)
}

/// The seven centile values at `age_years`; `None` outside 5-18 years.
pub(super) fn centiles_at(ind: IapIndicator, sex: Sex, age_years: f64) -> Option<[f64; 7]> {
    let r = rows(ind, sex);
    let first = r.first()?.0;
    let last = r.last()?.0;
    if !(first..=last).contains(&age_years) {
        return None;
    }
    let hi = r.iter().position(|(a, _)| *a >= age_years)?;
    let (a1, v1) = r[hi];
    if hi == 0 || (a1 - age_years).abs() < 1e-9 {
        return Some(v1);
    }
    let (a0, v0) = r[hi - 1];
    let f = (age_years - a0) / (a1 - a0);
    Some(std::array::from_fn(|i| v0[i] + (v1[i] - v0[i]) * f))
}

/// z for `y`, and whether it was extrapolated beyond the published band.
pub(super) fn z(ind: IapIndicator, sex: Sex, age_years: f64, y: f64) -> Option<(f64, bool)> {
    let v = centiles_at(ind, sex, age_years)?;
    let zs = column_z(ind, sex);
    let seg = |i: usize| {
        let (x0, x1, z0, z1) = (v[i], v[i + 1], zs[i], zs[i + 1]);
        z0 + (y - x0) * (z1 - z0) / (x1 - x0)
    };
    if y < v[0] {
        return Some((seg(0), true));
    }
    if y > v[6] {
        return Some((seg(5), true));
    }
    let i = (0..6).find(|&i| y <= v[i + 1]).unwrap_or(5);
    Some((seg(i), false))
}
