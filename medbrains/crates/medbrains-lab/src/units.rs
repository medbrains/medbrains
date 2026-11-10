//! Bringing a result into the unit its reference range is written in.
//!
//! The reference table writes a platelet count in lakh/cumm (1.5-4.5) and an
//! analyser reports it in 10^3/uL (150-400). Comparing the bare numbers made
//! every normal platelet count of 250 "critical high" against a limit of 10,
//! and a true critical low of 16 (0.16 lakh) was reported high. The same
//! mismatch hit the WBC count (cells/cumm vs 10^3/uL), the other way round.
//!
//! So a value is judged only once it is in the reference's unit. Where the two
//! units are known to be the same quantity it is converted; where they are not
//! it cannot be judged, and the caller must treat that as unknown -- never as
//! normal, and never by comparing numbers that mean different things.

/// What a unit string measures, and its size relative to that kind's base.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Scale {
    kind: Kind,
    factor: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    /// Cells per microlitre.
    CellCount,
    /// Grams per litre.
    MassConc,
    /// Millimoles per litre.
    MolarConc,
    /// Milliequivalents per litre.
    EquivConc,
    /// Units (enzyme or international) per litre.
    ActivityConc,
}

/// Lower-case, strip spaces and the common spellings of micro, cube and the
/// multiplication sign, so "x 10³/µL", "10^3/uL" and "10^3/cumm" compare equal.
fn normalise(unit: &str) -> String {
    let mut s: String = unit
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    for (from, to) in [
        ("µ", "u"),
        ("μ", "u"),
        ("³", "^3"),
        ("⁶", "^6"),
        ("⁹", "^9"),
        ("¹²", "^12"),
        ("×", "x"),
        ("cells", ""),
        ("lakhs", "lakh"),
        ("cumm", "ul"),
        ("mm^3", "ul"),
        ("mm3", "ul"),
        ("cmm", "ul"),
    ] {
        s = s.replace(from, to);
    }
    s.trim_start_matches('x').to_owned()
}

fn scale_of(unit: &str) -> Option<Scale> {
    let (kind, factor) = match normalise(unit).as_str() {
        "/ul" => (Kind::CellCount, 1.0),
        "10^3/ul" | "thou/ul" | "k/ul" | "10^9/l" | "/nl" => (Kind::CellCount, 1e3),
        "lakh/ul" => (Kind::CellCount, 1e5),
        "10^6/ul" | "million/ul" | "mill/ul" | "10^12/l" => (Kind::CellCount, 1e6),
        "g/l" => (Kind::MassConc, 1.0),
        "g/dl" => (Kind::MassConc, 10.0),
        "mg/dl" => (Kind::MassConc, 1e-2),
        "mg/l" | "ug/ml" => (Kind::MassConc, 1e-3),
        "ug/dl" => (Kind::MassConc, 1e-5),
        "ng/ml" | "ug/l" => (Kind::MassConc, 1e-6),
        "ng/dl" => (Kind::MassConc, 1e-8),
        "pg/ml" | "ng/l" => (Kind::MassConc, 1e-9),
        "mmol/l" => (Kind::MolarConc, 1.0),
        "umol/l" => (Kind::MolarConc, 1e-3),
        "meq/l" => (Kind::EquivConc, 1.0),
        "u/l" | "iu/l" => (Kind::ActivityConc, 1.0),
        "u/ml" | "iu/ml" => (Kind::ActivityConc, 1e3),
        "miu/ml" | "mu/ml" => (Kind::ActivityConc, 1.0),
        "uiu/ml" | "uu/ml" | "miu/l" => (Kind::ActivityConc, 1e-3),
        _ => return None,
    };
    Some(Scale { kind, factor })
}

/// Ions whose charge is one, for which an mmol/L and an mEq/L are the same
/// number. Calcium and magnesium are divalent and are deliberately absent.
const MONOVALENT: [&str; 4] = ["sodium", "potassium", "chloride", "bicarbonate"];

/// The outcome of bringing a value into the reference's unit.
#[derive(Debug, PartialEq)]
pub(crate) enum Converted {
    /// The value, expressed in the reference unit.
    Value(f64),
    /// The units measure different things, or one is not recognised. The value
    /// cannot be judged against this reference.
    Incomparable,
}

/// Express `value`, reported in `from`, in the unit `to`.
///
/// Either side missing means the value is taken as written in the reference's
/// unit, which is how a technologist entering a bare number has always been
/// read.
pub(crate) fn to_reference_unit(
    value: f64,
    from: Option<&str>,
    to: Option<&str>,
    analyte: &str,
) -> Converted {
    let (Some(from), Some(to)) = (
        from.filter(|u| !u.trim().is_empty()),
        to.filter(|u| !u.trim().is_empty()),
    ) else {
        return Converted::Value(value);
    };
    if normalise(from) == normalise(to) {
        return Converted::Value(value);
    }
    let (Some(src), Some(dst)) = (scale_of(from), scale_of(to)) else {
        return Converted::Incomparable;
    };
    let charge_one = MONOVALENT.iter().any(|ion| analyte.to_lowercase().contains(ion));
    let same_kind = src.kind == dst.kind
        || (charge_one
            && matches!(
                (src.kind, dst.kind),
                (Kind::MolarConc, Kind::EquivConc) | (Kind::EquivConc, Kind::MolarConc)
            ));
    if !same_kind {
        return Converted::Incomparable;
    }
    Converted::Value(value * src.factor / dst.factor)
}

#[cfg(test)]
mod tests {
    use super::{Converted, to_reference_unit};

    fn conv(value: f64, from: &str, to: &str, analyte: &str) -> f64 {
        match to_reference_unit(value, Some(from), Some(to), analyte) {
            Converted::Value(v) => v,
            Converted::Incomparable => f64::NAN,
        }
    }

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9 * b.abs().max(1.0)
    }

    #[test]
    fn a_platelet_count_in_thousands_becomes_lakhs() {
        // The defect: 250 x10^3/uL is 2.5 lakh, not 250 lakh.
        assert!(close(conv(250.0, "10^3/uL", "lakh/cumm", "platelet count"), 2.5));
        assert!(close(conv(16.0, "10³/µL", "lakh/cumm", "platelet count"), 0.16));
        assert!(close(conv(250.0, "x10^9/L", "lakh/cumm", "platelet count"), 2.5));
    }

    #[test]
    fn a_wbc_count_in_thousands_becomes_cells_per_cumm() {
        assert!(close(conv(7.5, "10^3/uL", "cells/cumm", "total wbc"), 7500.0));
    }

    #[test]
    fn mass_concentrations_scale() {
        assert!(close(conv(130.0, "g/L", "g/dL", "haemoglobin"), 13.0));
        assert!(close(conv(10.0, "mg/dL", "mg/L", "crp"), 100.0));
        assert!(close(conv(40.0, "ng/L", "pg/mL", "bnp"), 40.0));
    }

    #[test]
    fn mmol_and_meq_are_the_same_only_for_monovalent_ions() {
        assert!(close(conv(6.8, "mmol/L", "mEq/L", "potassium"), 6.8));
        // Calcium is divalent: 2.5 mmol/L is 5 mEq/L, so no silent equality.
        assert_eq!(
            to_reference_unit(2.5, Some("mmol/L"), Some("mEq/L"), "serum calcium"),
            Converted::Incomparable
        );
    }

    #[test]
    fn units_of_different_quantities_cannot_be_compared() {
        // Glucose in mmol/L against a mg/dL range needs a molar mass; guessing
        // would mislabel a hypoglycaemia.
        assert_eq!(
            to_reference_unit(3.0, Some("mmol/L"), Some("mg/dL"), "fbs"),
            Converted::Incomparable
        );
        assert_eq!(
            to_reference_unit(3.0, Some("furlongs"), Some("mg/dL"), "fbs"),
            Converted::Incomparable
        );
    }

    #[test]
    fn a_missing_unit_is_read_as_the_reference_unit() {
        assert_eq!(to_reference_unit(4.0, None, Some("g/dL"), "albumin"), Converted::Value(4.0));
        assert_eq!(to_reference_unit(4.0, Some(" "), Some("g/dL"), "albumin"), Converted::Value(4.0));
        assert_eq!(to_reference_unit(4.0, Some("g/dL"), None, "albumin"), Converted::Value(4.0));
    }
}
