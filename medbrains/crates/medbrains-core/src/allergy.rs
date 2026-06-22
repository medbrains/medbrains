//! Drug–allergy matching, including clinically-recognised cross-reactivity
//! classes (e.g. a penicillin allergy flags cephalosporins). Pure and
//! dependency-free so the prescribe / dispense / counter-sale guards all share
//! one source of truth. Conservative substring matching — it errs toward
//! flagging (advisory, never a hard block).

/// How a drug matched a documented allergen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AllergyMatchKind {
    /// The drug name and the allergen name refer to the same agent.
    Direct,
    /// Different agents in the same cross-reactive class.
    CrossReactive,
}

/// One drug ↔ allergen conflict for a prescription/sale line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DrugAllergyConflict {
    pub drug_name: String,
    pub allergen: String,
    pub kind: AllergyMatchKind,
    /// Cross-reactivity class label, when the match is class-based.
    pub class: Option<String>,
}

/// Cross-reactivity classes: label → lowercased name fragments. A name belongs
/// to a class if any fragment is a substring of it. Kept deliberately small and
/// well-established; expand with pharmacist review.
const CLASSES: &[(&str, &[&str])] = &[
    (
        "beta-lactam",
        &[
            "penicillin",
            "amoxicillin",
            "amoxycillin",
            "ampicillin",
            "augmentin",
            "cloxacillin",
            "dicloxacillin",
            "piperacillin",
            "carbenicillin",
            "cef",
            "cephalexin",
            "cephalosporin",
            "ceftriaxone",
            "cefuroxime",
            "cefixime",
            "cefpodoxime",
            "cefotaxime",
        ],
    ),
    (
        "sulfonamide",
        &[
            "sulfa",
            "sulpha",
            "sulfamethoxazole",
            "sulphamethoxazole",
            "sulfadiazine",
            "cotrimoxazole",
            "co-trimoxazole",
            "septran",
            "bactrim",
        ],
    ),
    (
        "nsaid",
        &[
            "aspirin",
            "acetylsalicylic",
            "ibuprofen",
            "diclofenac",
            "aceclofenac",
            "naproxen",
            "ketorolac",
            "indomethacin",
            "piroxicam",
            "mefenamic",
        ],
    ),
];

fn class_of(name: &str) -> Option<&'static str> {
    for (label, fragments) in CLASSES {
        if fragments.iter().any(|frag| name.contains(frag)) {
            return Some(label);
        }
    }
    None
}

/// Match a single drug name against a single allergen name. Direct substring
/// match (either direction) wins; otherwise a shared cross-reactivity class.
#[must_use]
pub fn match_drug_allergy(drug: &str, allergen: &str) -> Option<(AllergyMatchKind, Option<String>)> {
    let d = drug.trim().to_lowercase();
    let a = allergen.trim().to_lowercase();
    if d.is_empty() || a.is_empty() {
        return None;
    }
    if d.contains(&a) || a.contains(&d) {
        return Some((AllergyMatchKind::Direct, None));
    }
    match (class_of(&d), class_of(&a)) {
        (Some(dc), Some(ac)) if dc == ac => {
            Some((AllergyMatchKind::CrossReactive, Some(dc.to_owned())))
        }
        _ => None,
    }
}

/// Find conflicts between prescribed/sold drug names and a patient's active
/// allergen names. At most one conflict per drug (the first allergen hit).
#[must_use]
pub fn find_conflicts(drug_names: &[String], allergens: &[String]) -> Vec<DrugAllergyConflict> {
    let mut conflicts = Vec::new();
    for drug in drug_names {
        for allergen in allergens {
            if let Some((kind, class)) = match_drug_allergy(drug, allergen) {
                conflicts.push(DrugAllergyConflict {
                    drug_name: drug.clone(),
                    allergen: allergen.clone(),
                    kind,
                    class,
                });
                break;
            }
        }
    }
    conflicts
}

#[cfg(test)]
mod tests {
    use super::{AllergyMatchKind, find_conflicts, match_drug_allergy};

    #[test]
    fn direct_name_match() {
        let (kind, _) = match_drug_allergy("Amoxicillin 500mg", "amoxicillin").expect("match");
        assert_eq!(kind, AllergyMatchKind::Direct);
    }

    #[test]
    fn penicillin_allergy_flags_cephalosporin() {
        let (kind, class) = match_drug_allergy("Cefixime 200mg", "Penicillin").expect("match");
        assert_eq!(kind, AllergyMatchKind::CrossReactive);
        assert_eq!(class.as_deref(), Some("beta-lactam"));
    }

    #[test]
    fn sulfa_allergy_flags_cotrimoxazole() {
        let (kind, _) = match_drug_allergy("Cotrimoxazole DS", "Sulfa").expect("match");
        assert_eq!(kind, AllergyMatchKind::CrossReactive);
    }

    #[test]
    fn unrelated_drug_is_silent() {
        assert!(match_drug_allergy("Paracetamol", "Penicillin").is_none());
        assert!(match_drug_allergy("", "Penicillin").is_none());
    }

    #[test]
    fn find_conflicts_one_per_drug() {
        let drugs = vec!["Cefixime".to_owned(), "Paracetamol".to_owned()];
        let allergens = vec!["penicillin".to_owned()];
        let hits = find_conflicts(&drugs, &allergens);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].drug_name, "Cefixime");
        assert_eq!(hits[0].kind, AllergyMatchKind::CrossReactive);
    }
}
