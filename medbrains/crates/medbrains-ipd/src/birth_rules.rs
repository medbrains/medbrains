//! What a birth record may say about a newborn.
//!
//! The record feeds the birth register and the civil registration return, so
//! a typo there becomes a fact on a certificate. APGAR is scored 0 to 10; a
//! weight, length or head circumference is positive; a birth is not dated in
//! the future, and the baby is not the mother.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

/// The measurements a birth record carries, as sent.
pub(crate) struct BirthMeasures {
    pub(crate) apgar_1min: Option<i32>,
    pub(crate) apgar_5min: Option<i32>,
    pub(crate) weight_grams: Option<Decimal>,
    pub(crate) length_cm: Option<Decimal>,
    pub(crate) head_circumference_cm: Option<Decimal>,
}

/// Why a birth record was refused, worded for the person keying it.
pub(crate) fn check_measures(m: &BirthMeasures) -> Result<(), String> {
    for (name, score) in [("1-minute", m.apgar_1min), ("5-minute", m.apgar_5min)] {
        if score.is_some_and(|s| !(0..=10).contains(&s)) {
            return Err(format!("The {name} APGAR score is between 0 and 10."));
        }
    }
    let sizes = [
        ("Weight", m.weight_grams),
        ("Length", m.length_cm),
        ("Head circumference", m.head_circumference_cm),
    ];
    for (name, value) in sizes {
        if value.is_some_and(|v| v <= Decimal::ZERO) {
            return Err(format!("{name} must be more than zero."));
        }
    }
    Ok(())
}

/// Refuse a birth dated after `today`, or a baby record that names the mother.
pub(crate) fn check_identity(
    born: Option<NaiveDate>,
    today: NaiveDate,
    baby: Option<Uuid>,
    mother: Uuid,
) -> Result<(), String> {
    if born.is_some_and(|d| d > today) {
        return Err("The date of birth cannot be in the future.".to_owned());
    }
    if baby == Some(mother) {
        return Err("The baby's record cannot be the mother's.".to_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{BirthMeasures, check_identity, check_measures};
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    fn measures() -> BirthMeasures {
        BirthMeasures {
            apgar_1min: Some(8),
            apgar_5min: Some(10),
            weight_grams: Some(Decimal::from(3100)),
            length_cm: Some(Decimal::from(50)),
            head_circumference_cm: None,
        }
    }

    #[test]
    fn a_normal_newborn_passes_and_bounds_hold() {
        assert_eq!(check_measures(&measures()), Ok(()));
        let zero = BirthMeasures {
            apgar_1min: Some(0),
            ..measures()
        };
        assert_eq!(check_measures(&zero), Ok(()), "0 is a real APGAR score");
        let eleven = BirthMeasures {
            apgar_5min: Some(11),
            ..measures()
        };
        assert!(check_measures(&eleven).is_err());
        let negative = BirthMeasures {
            apgar_1min: Some(-1),
            ..measures()
        };
        assert!(check_measures(&negative).is_err());
        let weightless = BirthMeasures {
            weight_grams: Some(Decimal::ZERO),
            ..measures()
        };
        assert!(check_measures(&weightless).is_err());
    }

    #[test]
    fn a_future_birth_or_the_mother_as_baby_is_refused() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 12).unwrap_or_default();
        let tomorrow = today.succ_opt();
        let mother = Uuid::new_v4();
        assert_eq!(
            check_identity(Some(today), today, Some(Uuid::new_v4()), mother),
            Ok(())
        );
        assert!(check_identity(tomorrow, today, None, mother).is_err());
        assert!(check_identity(None, today, Some(mother), mother).is_err());
    }
}
