//! What the assistant's drug-safety tool hands the model, in one shape the
//! eval harness grades and production sends.
//!
//! The status is stated, never implied: an unchecked drug carries
//! `"checked": false` and no `safe` or `warnings` at all, because an empty
//! warning list read as "no warnings" to the weakest model (eval case 06).

use serde::Serialize;

/// One drug-safety result for the model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DrugCheck {
    pub drug: String,
    /// Whether the pharmacy safety engine ran for this patient.
    pub checked: bool,
    /// Only when checked: `true` when the engine returned no warning.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safe: Option<bool>,
    /// Only when checked: the engine's warnings, exactly.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
    pub notes: String,
}

impl DrugCheck {
    /// No patient chart is open, so the engine was not run.
    #[must_use]
    pub fn no_chart(drug: String) -> Self {
        let notes = format!(
            "{drug} was not checked: no patient chart is loaded. Open the patient's chart to run \
             the check."
        );
        Self::not_checked(drug, notes)
    }

    /// The engine failed; nothing is known about this drug.
    #[must_use]
    pub fn failed(drug: String) -> Self {
        let notes = format!(
            "{drug} was not checked: the safety engine failed. Do not rely on it being checked."
        );
        Self::not_checked(drug, notes)
    }

    /// The engine ran and returned nothing.
    #[must_use]
    pub fn clear(drug: String) -> Self {
        Self {
            drug,
            checked: true,
            safe: Some(true),
            warnings: Some(Vec::new()),
            notes: "No allergy or interaction warnings from the safety engine.".to_owned(),
        }
    }

    /// The engine ran and returned `warnings` (already formatted).
    #[must_use]
    pub fn flagged(drug: String, warnings: Vec<String>) -> Self {
        Self {
            drug,
            checked: true,
            safe: Some(false),
            notes: format!("Safety warnings from the pharmacy engine: {}", warnings.join("; ")),
            warnings: Some(warnings),
        }
    }

    /// `notes` is a whole sentence naming the drug: the model is told to
    /// quote it as its answer, which the weakest model does reliably.
    const fn not_checked(drug: String, notes: String) -> Self {
        Self {
            drug,
            checked: false,
            safe: None,
            warnings: None,
            notes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::DrugCheck;

    #[test]
    fn an_unchecked_drug_carries_no_verdict_or_warning_list() {
        let v = serde_json::to_value(DrugCheck::no_chart("X".to_owned())).unwrap_or_default();
        assert_eq!(v["checked"], false);
        assert!(v.get("safe").is_none() && v.get("warnings").is_none(), "{v}");
        let v = serde_json::to_value(DrugCheck::failed("X".to_owned())).unwrap_or_default();
        assert_eq!(v["checked"], false);
        assert!(v.get("safe").is_none(), "{v}");
    }

    #[test]
    fn a_checked_drug_states_its_verdict() {
        let v = serde_json::to_value(DrugCheck::clear("X".to_owned())).unwrap_or_default();
        assert_eq!((v["checked"].clone(), v["safe"].clone()), (true.into(), true.into()));
        let w = DrugCheck::flagged("X".to_owned(), vec!["[Critical] Allergy".to_owned()]);
        let v = serde_json::to_value(w).unwrap_or_default();
        assert_eq!(v["safe"], false);
        assert_eq!(v["warnings"][0], "[Critical] Allergy");
    }
}
