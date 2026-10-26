//! WHO Child Growth Standards (2006), 0-5 years, by the LMS method.
//!
//! Source: WHO Multicentre Growth Reference Study Group. WHO Child Growth
//! Standards. Acta Paediatr Suppl 2006;450:76-85, and the WHO expanded LMS
//! tables (<https://www.who.int/tools/child-growth-standards/standards>). The
//! tab-separated tables in `data/who_*.tsv` are WHO's daily (by age) and
//! 0.1 cm (by length/height) LMS values, as distributed in machine-readable
//! form with WHO's `anthro` package; the standards are published by WHO for
//! free use.
//!
//! The z-score follows WHO's own algorithm, including the restricted
//! calculation beyond +/-3 SD for the weight-based indicators, whose
//! distributions are right-skewed (WHO Child Growth Standards, Methods and
//! development, 2006, p. 302).

use std::sync::OnceLock;

use super::Sex;

/// One row of L, M, S.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) struct Lms {
    pub(super) l: f64,
    pub(super) m: f64,
    pub(super) s: f64,
}

impl Lms {
    /// The measurement at `z`.
    pub(super) fn value_at(self, z: f64) -> f64 {
        if self.l.abs() < 1e-12 {
            self.m * (self.s * z).exp()
        } else {
            self.m * (1.0 + self.l * self.s * z).powf(1.0 / self.l)
        }
    }

    fn raw_z(self, y: f64) -> f64 {
        if self.l.abs() < 1e-12 {
            (y / self.m).ln() / self.s
        } else {
            ((y / self.m).powf(self.l) - 1.0) / (self.l * self.s)
        }
    }

    /// WHO z-score. `restricted` applies WHO's linear extension beyond +/-3
    /// SD, used for weight-for-age, weight-for-length/height and BMI.
    pub(super) fn z(self, y: f64, restricted: bool) -> f64 {
        let z = self.raw_z(y);
        if !restricted || z.abs() <= 3.0 {
            return z;
        }
        if z > 3.0 {
            let sd3 = self.value_at(3.0);
            3.0 + (y - sd3) / (sd3 - self.value_at(2.0))
        } else {
            let sd3 = self.value_at(-3.0);
            -3.0 + (y - sd3) / (self.value_at(-2.0) - sd3)
        }
    }
}

/// The WHO tables this module serves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum WhoTable {
    WeightForAge,
    LengthHeightForAge,
    WeightForLength,
    WeightForHeight,
    BmiForAge,
    HeadForAge,
}

impl WhoTable {
    const fn source(self) -> &'static str {
        match self {
            Self::WeightForAge => include_str!("data/who_weianthro.tsv"),
            Self::LengthHeightForAge => include_str!("data/who_lenanthro.tsv"),
            Self::WeightForLength => include_str!("data/who_wflanthro.tsv"),
            Self::WeightForHeight => include_str!("data/who_wfhanthro.tsv"),
            Self::BmiForAge => include_str!("data/who_bmianthro.tsv"),
            Self::HeadForAge => include_str!("data/who_hcanthro.tsv"),
        }
    }

    /// Whether WHO restricts z beyond +/-3 SD for this indicator.
    pub(super) const fn restricted(self) -> bool {
        matches!(
            self,
            Self::WeightForAge | Self::WeightForLength | Self::WeightForHeight | Self::BmiForAge
        )
    }

    /// Age tables step by one day; length/height tables by 0.1 cm.
    const fn step(self) -> f64 {
        match self {
            Self::WeightForLength | Self::WeightForHeight => 0.1,
            _ => 1.0,
        }
    }
}

/// A parsed table: for each sex, the first x and its LMS rows at `step`.
#[derive(Debug)]
struct Table {
    start: [f64; 2],
    rows: [Vec<Lms>; 2],
}

fn parse(src: &str) -> Table {
    let mut start = [f64::NAN; 2];
    let mut rows: [Vec<Lms>; 2] = [Vec::new(), Vec::new()];
    for line in src.lines().skip(1) {
        let cols: Vec<&str> = line.trim_end().split('\t').collect();
        let num = |i: usize| cols.get(i).and_then(|c| c.trim().parse::<f64>().ok());
        let (Some(sex), Some(x), Some(l), Some(m), Some(s)) =
            (num(0), num(1), num(2), num(3), num(4))
        else {
            continue;
        };
        let i = usize::from(sex > 1.5);
        if rows[i].is_empty() {
            start[i] = x;
        }
        rows[i].push(Lms { l, m, s });
    }
    Table { start, rows }
}

fn table(t: WhoTable) -> &'static Table {
    static TABLES: [OnceLock<Table>; 6] = [const { OnceLock::new() }; 6];
    let i = t as usize;
    TABLES[i].get_or_init(|| parse(t.source()))
}

/// LMS for `sex` at `x` (age in days, or length/height in cm), linearly
/// interpolated between rows; `None` outside the table.
pub(super) fn lms(t: WhoTable, sex: Sex, x: f64) -> Option<Lms> {
    let tab = table(t);
    let i = usize::from(sex == Sex::Female);
    let rows = &tab.rows[i];
    let pos = (x - tab.start[i]) / t.step();
    if !pos.is_finite() || pos < -1e-9 || pos > (rows.len().saturating_sub(1)) as f64 + 1e-9 {
        return None;
    }
    let lo = pos.floor().max(0.0) as usize;
    let hi = (lo + 1).min(rows.len() - 1);
    let f = pos - lo as f64;
    let (a, b) = (rows[lo], rows[hi]);
    Some(Lms {
        l: a.l + (b.l - a.l) * f,
        m: a.m + (b.m - a.m) * f,
        s: a.s + (b.s - a.s) * f,
    })
}
