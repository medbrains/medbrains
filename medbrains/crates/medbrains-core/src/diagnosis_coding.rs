//! Which classification a hospital codes its diagnoses in: ICD-11, ICD-10,
//! or both (`tenant_settings` clinical / `diagnosis_coding`, default ICD-11
//! for every tenant via migration 1196).
//!
//! There is deliberately no ICD-11 ↔ ICD-10 mapping here: WHO's ICD-11
//! licence (§1.2.4) leaves crosswalks to a separate agreement, so a code is
//! always recorded and sent in the system it was chosen from.

use serde::{Deserialize, Serialize};

/// `tenant_settings.category` of the switch.
pub const SETTING_CATEGORY: &str = "clinical";
/// `tenant_settings.key` of the switch.
pub const SETTING_KEY: &str = "diagnosis_coding";

/// The hospital's diagnosis coding system.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosisCoding {
    #[default]
    Icd11,
    Icd10,
    Both,
}

impl DiagnosisCoding {
    /// Whether a new diagnosis may be coded in `system` (`icd10` | `icd11` |
    /// `snomed`). SNOMED CT is a clinical concept beside the ICD code, so the
    /// switch does not govern it.
    #[must_use]
    pub fn allows(self, system: &str) -> bool {
        matches!(
            (self, system),
            (_, "snomed")
                | (Self::Icd11 | Self::Both, "icd11")
                | (Self::Icd10 | Self::Both, "icd10")
        )
    }

    /// The label a person reads.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Icd11 => "ICD-11",
            Self::Icd10 => "ICD-10",
            Self::Both => "ICD-11 and ICD-10",
        }
    }
}

/// The ICD revision a bare code belongs to, from its shape alone — used where
/// a code arrives typed, with no system (a pre-authorisation's code list).
///
/// ICD-10 (and ICD-10-CM) codes are a letter then a digit (`A90`, `E11.9`);
/// every ICD-11 MMS code has a letter in the second place (`1D2Z`, `BA00`),
/// a rule WHO chose so the two can never be confused. `None` = neither.
#[must_use]
pub fn icd_system_of_code(code: &str) -> Option<&'static str> {
    let mut chars = code.trim().chars();
    let first = chars.next()?;
    let second = chars.next()?;
    if !first.is_ascii_alphanumeric() || chars.next().is_none() {
        return None;
    }
    if first.is_ascii_alphabetic() && second.is_ascii_digit() {
        Some("icd10")
    } else if second.is_ascii_alphabetic() {
        Some("icd11")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn switch_allows_only_its_systems() {
        assert!(DiagnosisCoding::Icd11.allows("icd11"));
        assert!(!DiagnosisCoding::Icd11.allows("icd10"));
        assert!(DiagnosisCoding::Icd10.allows("icd10"));
        assert!(!DiagnosisCoding::Icd10.allows("icd11"));
        assert!(DiagnosisCoding::Both.allows("icd10") && DiagnosisCoding::Both.allows("icd11"));
        assert!(DiagnosisCoding::Icd10.allows("snomed"));
        assert!(!DiagnosisCoding::Both.allows("loinc"));
    }

    #[test]
    fn setting_value_round_trips_and_defaults_to_icd11() {
        assert_eq!(DiagnosisCoding::default(), DiagnosisCoding::Icd11);
        let v: DiagnosisCoding = serde_json::from_str("\"both\"").unwrap_or_default();
        assert_eq!(v, DiagnosisCoding::Both);
        assert!(serde_json::from_str::<DiagnosisCoding>("\"icd9\"").is_err());
    }

    #[test]
    fn code_shape_names_its_revision() {
        // Fixtures, not a catalogue.
        assert_eq!(icd_system_of_code("A90"), Some("icd10"));
        assert_eq!(icd_system_of_code("E11.9"), Some("icd10"));
        assert_eq!(icd_system_of_code("1D2Z"), Some("icd11"));
        assert_eq!(icd_system_of_code("BA00.0"), Some("icd11"));
        assert_eq!(icd_system_of_code("X"), None);
        assert_eq!(icd_system_of_code("12"), None);
        assert_eq!(icd_system_of_code(""), None);
    }
}
