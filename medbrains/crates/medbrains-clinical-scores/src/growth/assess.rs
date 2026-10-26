//! Charted measurements to z-scores, centiles, flags and reference curves.

use chrono::NaiveDate;
use serde::Serialize;

use super::iap::{self, IapIndicator};
use super::who::{self, WhoTable};
use super::{Measurement, Sex};

/// Days in a month, as WHO uses (365.25 / 12).
pub(super) const DAYS_PER_MONTH: f64 = 30.4375;
/// WHO 0-5 years: up to and including 60 months.
const WHO_LAST_DAY: i64 = 1826;
/// WHO switches from length to height (and weight-for-length to -height) at 2 years.
const LENGTH_UNTIL_DAY: i64 = 731;
/// Correct for prematurity until this chronological age (24 months).
const CORRECT_UNTIL_DAY: i64 = 730;
/// A change of 1.34 SD crosses two of the major centile lines, which are 0.67
/// SD apart (2nd, 9th, 25th, 50th, 75th, 91st, 98th).
const CROSSING_Z: f64 = 1.34;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Flag {
    pub code: &'static str,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ChartPoint {
    pub measured_on: NaiveDate,
    /// Age in days the point was judged at (corrected when `corrected`).
    pub age_days: i64,
    pub corrected: bool,
    pub x: f64,
    pub value: f64,
    pub z: f64,
    pub percentile: f64,
    /// The value lies outside the published IAP centiles; z is extrapolated.
    pub extrapolated: bool,
    pub flags: Vec<Flag>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RefLine {
    pub label: String,
    pub points: Vec<[f64; 2]>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Chart {
    pub key: &'static str,
    pub title: &'static str,
    pub standard: &'static str,
    pub x_label: &'static str,
    pub unit: &'static str,
    pub lines: Vec<RefLine>,
    pub points: Vec<ChartPoint>,
}

/// One chart's definition.
#[derive(Clone, Copy)]
struct Spec {
    key: &'static str,
    title: &'static str,
    unit: &'static str,
    source: Source,
    value: fn(&Measurement) -> Option<f64>,
}

#[derive(Clone, Copy)]
enum Source {
    WhoAge(WhoTable),
    WhoSize(WhoTable),
    Iap(IapIndicator),
}

const SPECS: [Spec; 9] = [
    Spec {
        key: "who_wfa",
        title: "Weight-for-age",
        unit: "kg",
        source: Source::WhoAge(WhoTable::WeightForAge),
        value: |m| m.weight_kg,
    },
    Spec {
        key: "who_lhfa",
        title: "Length/height-for-age",
        unit: "cm",
        source: Source::WhoAge(WhoTable::LengthHeightForAge),
        value: |m| m.height_cm,
    },
    Spec {
        key: "who_wfl",
        title: "Weight-for-length (0-2 years)",
        unit: "kg",
        source: Source::WhoSize(WhoTable::WeightForLength),
        value: |m| m.weight_kg,
    },
    Spec {
        key: "who_wfh",
        title: "Weight-for-height (2-5 years)",
        unit: "kg",
        source: Source::WhoSize(WhoTable::WeightForHeight),
        value: |m| m.weight_kg,
    },
    Spec {
        key: "who_bmi",
        title: "BMI-for-age",
        unit: "kg/m²",
        source: Source::WhoAge(WhoTable::BmiForAge),
        value: Measurement::bmi,
    },
    Spec {
        key: "who_hcfa",
        title: "Head circumference-for-age",
        unit: "cm",
        source: Source::WhoAge(WhoTable::HeadForAge),
        value: |m| m.head_circumference_cm,
    },
    Spec {
        key: "iap_height",
        title: "Height-for-age",
        unit: "cm",
        source: Source::Iap(IapIndicator::Height),
        value: |m| m.height_cm,
    },
    Spec {
        key: "iap_weight",
        title: "Weight-for-age",
        unit: "kg",
        source: Source::Iap(IapIndicator::Weight),
        value: |m| m.weight_kg,
    },
    Spec {
        key: "iap_bmi",
        title: "BMI-for-age",
        unit: "kg/m²",
        source: Source::Iap(IapIndicator::Bmi),
        value: Measurement::bmi,
    },
];

/// The child the charts are for.
#[derive(Debug, Clone, Copy)]
pub struct Child {
    pub sex: Sex,
    pub date_of_birth: NaiveDate,
    /// Completed weeks of gestation at birth, when recorded.
    pub gestation_weeks: Option<f64>,
}

impl Child {
    /// (age in days to judge at, whether corrected). Below 37 weeks and under
    /// 24 months chronological, the weeks born early are taken off.
    fn age_for(&self, on: NaiveDate) -> (i64, bool) {
        let chrono = (on - self.date_of_birth).num_days();
        match self.gestation_weeks {
            Some(ga) if ga < 37.0 && chrono < CORRECT_UNTIL_DAY => {
                let early = ((40.0 - ga) * 7.0).round() as i64;
                (chrono - early, true)
            }
            _ => (chrono, false),
        }
    }
}

/// Every chart with at least one point, plus the chart for the child's
/// current age even when empty, so the screen can show the curves.
pub(super) fn charts(child: &Child, measurements: &[Measurement], today: NaiveDate) -> Vec<Chart> {
    let (now, _) = child.age_for(today);
    SPECS
        .iter()
        .filter_map(|spec| {
            let points = points(spec, child, measurements);
            let current = applies(spec, now);
            (current || !points.is_empty()).then(|| Chart {
                key: spec.key,
                title: spec.title,
                standard: standard(spec.source),
                x_label: x_label(spec.source),
                unit: spec.unit,
                lines: lines(spec.source, child.sex),
                points,
            })
        })
        .collect()
}

const fn standard(s: Source) -> &'static str {
    match s {
        Source::Iap(_) => "IAP 2015 (5-18 years)",
        _ => "WHO Child Growth Standards 2006 (0-5 years)",
    }
}

const fn x_label(s: Source) -> &'static str {
    match s {
        Source::WhoAge(_) => "Age (months)",
        Source::WhoSize(WhoTable::WeightForLength) => "Length (cm)",
        Source::WhoSize(_) => "Height (cm)",
        Source::Iap(_) => "Age (years)",
    }
}

/// Whether a measurement at `age` days belongs on this chart.
fn applies(spec: &Spec, age: i64) -> bool {
    match spec.source {
        Source::WhoAge(_) => (0..=WHO_LAST_DAY).contains(&age),
        Source::WhoSize(WhoTable::WeightForLength) => (0..LENGTH_UNTIL_DAY).contains(&age),
        Source::WhoSize(_) => (LENGTH_UNTIL_DAY..=WHO_LAST_DAY).contains(&age),
        Source::Iap(_) => (WHO_LAST_DAY + 1..=years_to_days(18.0)).contains(&age),
    }
}

fn years_to_days(y: f64) -> i64 {
    (y * 365.25).round() as i64
}

fn points(spec: &Spec, child: &Child, measurements: &[Measurement]) -> Vec<ChartPoint> {
    let mut out: Vec<ChartPoint> = Vec::new();
    for m in measurements {
        let (age, corrected) = child.age_for(m.measured_on);
        let Some(value) = (spec.value)(m).filter(|v| *v > 0.0) else {
            continue;
        };
        if !applies(spec, age) {
            continue;
        }
        let Some((x, z, extrapolated)) = judge(spec.source, child.sex, age, m, value) else {
            continue;
        };
        let mut flags = level_flags(spec, child.sex, z, extrapolated);
        if let Some(prev) = out.last()
            && (z - prev.z).abs() >= CROSSING_Z
        {
            let (code, way) = if z < prev.z {
                ("crossed_down", "downward")
            } else {
                ("crossed_up", "upward")
            };
            flags.push(Flag {
                code,
                label: format!("Crossed two centile lines {way} since {}", prev.measured_on),
            });
        }
        out.push(ChartPoint {
            measured_on: m.measured_on,
            age_days: age,
            corrected,
            x,
            value,
            z: round2(z),
            percentile: round1(normal_cdf(z) * 100.0),
            extrapolated,
            flags,
        });
    }
    out
}

/// (x to plot at, z, extrapolated).
fn judge(
    source: Source,
    sex: Sex,
    age: i64,
    m: &Measurement,
    value: f64,
) -> Option<(f64, f64, bool)> {
    match source {
        Source::WhoAge(t) => {
            let lms = who::lms(t, sex, age as f64)?;
            Some((
                round2(age as f64 / DAYS_PER_MONTH),
                lms.z(value, t.restricted()),
                false,
            ))
        }
        Source::WhoSize(t) => {
            let size = m.height_cm?;
            let lms = who::lms(t, sex, size)?;
            Some((size, lms.z(value, t.restricted()), false))
        }
        Source::Iap(ind) => {
            let years = age as f64 / 365.25;
            let (z, extrapolated) = iap::z(ind, sex, years, value)?;
            Some((round2(years), z, extrapolated))
        }
    }
}

fn level_flags(spec: &Spec, sex: Sex, z: f64, extrapolated: bool) -> Vec<Flag> {
    let flag = |code, label: &str| {
        vec![Flag {
            code,
            label: label.to_owned(),
        }]
    };
    match spec.source {
        Source::Iap(IapIndicator::Bmi) => {
            let zs = iap::column_z(IapIndicator::Bmi, sex);
            if z >= zs[6] {
                flag(
                    "obese",
                    "At or above the adult-equivalent 27 line (obesity)",
                )
            } else if z >= zs[5] {
                flag(
                    "overweight",
                    "At or above the adult-equivalent 23 line (overweight)",
                )
            } else if z < zs[0] {
                flag("thinness", "Below the 3rd centile (thinness)")
            } else {
                Vec::new()
            }
        }
        Source::Iap(_) if extrapolated && z < 0.0 => flag("below_3rd", "Below the 3rd centile"),
        Source::Iap(_) if extrapolated => flag("above_97th", "Above the 97th centile"),
        Source::Iap(_) => Vec::new(),
        _ => who_flags(spec.key, z),
    }
}

fn who_flags(key: &str, z: f64) -> Vec<Flag> {
    let (low, high) = match key {
        "who_wfa" => (
            "underweight",
            "weight above +2 SD — check weight-for-length/height",
        ),
        "who_lhfa" => ("stunted", "tall for age"),
        "who_wfl" | "who_wfh" | "who_bmi" => ("wasted", "overweight"),
        _ => ("small head (microcephaly)", "large head (macrocephaly)"),
    };
    let (code, label) = if z < -3.0 {
        ("below_minus3", format!("Below -3 SD: severely {low}"))
    } else if z < -2.0 {
        ("below_minus2", format!("Below -2 SD: {low}"))
    } else if z > 3.0 {
        (
            "above_plus3",
            format!(
                "Above +3 SD: {}",
                if high == "overweight" { "obese" } else { high }
            ),
        )
    } else if z > 2.0 {
        ("above_plus2", format!("Above +2 SD: {high}"))
    } else {
        return Vec::new();
    };
    vec![Flag { code, label }]
}

fn lines(source: Source, sex: Sex) -> Vec<RefLine> {
    match source {
        Source::WhoAge(t) => who_lines(
            t,
            sex,
            &(0..=60)
                .map(|mo| (f64::from(mo), f64::from(mo) * DAYS_PER_MONTH))
                .collect::<Vec<_>>(),
        ),
        Source::WhoSize(t) => {
            let (from, to) = if t == WhoTable::WeightForLength {
                (45, 110)
            } else {
                (65, 120)
            };
            let xs: Vec<(f64, f64)> = (from..=to)
                .map(|cm| (f64::from(cm), f64::from(cm)))
                .collect();
            who_lines(t, sex, &xs)
        }
        Source::Iap(ind) => {
            let ages: Vec<f64> = (10..=36).map(|h| f64::from(h) / 2.0).collect();
            iap::column_labels(ind)
                .iter()
                .enumerate()
                .map(|(i, label)| RefLine {
                    label: (*label).to_owned(),
                    points: ages
                        .iter()
                        .filter_map(|&a| Some([a, iap::centiles_at(ind, sex, a)?[i]]))
                        .collect(),
                })
                .collect()
        }
    }
}

fn who_lines(t: WhoTable, sex: Sex, xs: &[(f64, f64)]) -> Vec<RefLine> {
    [-3.0, -2.0, 0.0, 2.0, 3.0]
        .into_iter()
        .map(|z: f64| RefLine {
            label: if z == 0.0 {
                "Median".to_owned()
            } else {
                format!("{z:+} SD")
            },
            points: xs
                .iter()
                .filter_map(|&(x, at)| {
                    Some([
                        x,
                        round2(who::lms(t, sex, at.round().min(1856.0))?.value_at(z)),
                    ])
                })
                .collect(),
        })
        .collect()
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf; |error| < 1.5e-7).
pub(super) fn normal_cdf(z: f64) -> f64 {
    let x = z.abs() / std::f64::consts::SQRT_2;
    let t = 1.0 / (1.0 + 0.327_591_1 * x);
    let poly = t
        * (0.254_829_592
            + t * (-0.284_496_736
                + t * (1.421_413_741 + t * (-1.453_152_027 + t * 1.061_405_429))));
    let erf = 1.0 - poly * (-x * x).exp();
    if z >= 0.0 {
        0.5 * (1.0 + erf)
    } else {
        0.5 * (1.0 - erf)
    }
}
