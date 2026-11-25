//! Drug-allergy screening for the CDS rail (`cds::check_drug_safety`).
//!
//! Matches each drug on the order against the patient's active drug allergies
//! through `medbrains_core::allergy`, the matcher the prescribe, dispense and
//! counter-sale backstops already use, so the rail warns about what save will
//! refuse: the same agent by name, or a shared cross-reactivity class (a
//! penicillin allergy flags amoxicillin and cephalosporins).
//!
//! The class table there is three classes (beta-lactam, sulfonamide, NSAID),
//! written in the code without a cited source. Drugs outside it are matched
//! by name only. ATC codes are on the catalogue (`pharmacy_catalog.atc_code`)
//! but allergens are free text, so class matching by ATC needs the allergen
//! coded first.

use medbrains_core::allergy::{AllergyMatchKind, match_drug_allergy};

use serde::Serialize;

/// One drug on the order that conflicts with a documented allergy.
#[derive(Debug, Serialize)]
pub struct AllergyConflict {
    pub drug_name: String,
    pub allergen_name: String,
    pub allergy_type: String,
    pub severity: Option<String>,
    pub reaction: Option<String>,
    /// The shared class when the drug is not the allergen itself but
    /// cross-reacts with it (e.g. "beta-lactam"); `None` for a direct match.
    pub cross_reactive_class: Option<String>,
}

/// One active drug allergy on the patient's record.
#[derive(sqlx::FromRow)]
pub(crate) struct AllergyRow {
    allergen_name: String,
    allergy_type: String,
    severity: Option<String>,
    reaction: Option<String>,
}

/// Every (drug, allergy) pair on the order that conflicts, by name or class.
pub(crate) fn allergy_conflicts_for(
    drug_names: &[String],
    allergies: &[AllergyRow],
) -> Vec<AllergyConflict> {
    let mut conflicts = Vec::new();
    for allergy in allergies {
        for drug in drug_names {
            let Some((kind, class)) = match_drug_allergy(drug, &allergy.allergen_name) else {
                continue;
            };
            conflicts.push(AllergyConflict {
                drug_name: drug.clone(),
                allergen_name: allergy.allergen_name.clone(),
                allergy_type: allergy.allergy_type.clone(),
                severity: allergy.severity.clone(),
                reaction: allergy.reaction.clone(),
                cross_reactive_class: class.filter(|_| kind == AllergyMatchKind::CrossReactive),
            });
        }
    }
    conflicts
}

#[cfg(test)]
mod allergy_tests {
    use super::{AllergyRow, allergy_conflicts_for};

    /// An active drug allergy named `allergen`.
    fn allergy(allergen: &str) -> AllergyRow {
        AllergyRow {
            allergen_name: allergen.to_owned(),
            allergy_type: "drug".to_owned(),
            severity: Some("severe".to_owned()),
            reaction: Some("anaphylaxis".to_owned()),
        }
    }

    #[test]
    fn a_penicillin_allergy_flags_amoxicillin() {
        let hits =
            allergy_conflicts_for(&["Amoxicillin 500 mg".to_owned()], &[allergy("Penicillin")]);
        assert_eq!(hits.len(), 1, "penicillin allergy did not flag amoxicillin");
        assert_eq!(hits[0].cross_reactive_class.as_deref(), Some("beta-lactam"));
    }

    #[test]
    fn a_direct_match_is_not_called_cross_reactive() {
        let hits = allergy_conflicts_for(&["Amoxicillin".to_owned()], &[allergy("amoxicillin")]);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].cross_reactive_class, None);
    }

    #[test]
    fn an_unrelated_drug_is_silent() {
        assert!(
            allergy_conflicts_for(&["Paracetamol".to_owned()], &[allergy("Penicillin")]).is_empty()
        );
    }
}
