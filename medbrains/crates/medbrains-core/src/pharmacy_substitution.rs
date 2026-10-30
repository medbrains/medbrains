//! When one medicine may stand in for another on an online order.
//!
//! India has no pharmacist substitution law: the Pharmacy Practice
//! Regulations 2015, reg. 13(c), make substituting a prescription without the
//! prescriber's consent misconduct `[verify]` (research brief §4). So a
//! substitute needs the prescriber — through their sign-off queue, or by
//! phone with their confirmation inside 24 hours — and the patient's
//! consent, and it must be the same medicine: the same salt(s), strength,
//! dosage form and release type. Narrow-therapeutic-index drugs and
//! biologicals are never swapped: small differences between brands matter
//! clinically there.

/// Hours a prescriber has to confirm a substitute agreed by phone; after
/// that the line goes back to what was prescribed.
pub const PHONE_CONFIRM_HOURS: i64 = 24;

/// Narrow-therapeutic-index INNs never substituted, whatever the catalogue
/// says (research brief §4; FDA/EMA NTI lists). A hospital marks more with
/// `pharmacy_catalog.narrow_therapeutic_index`.
pub const NTI_INNS: [&str; 12] = [
    "levothyroxine",
    "warfarin",
    "phenytoin",
    "tacrolimus",
    "cyclosporine",
    "ciclosporin",
    "lithium",
    "digoxin",
    "carbamazepine",
    "valproate",
    "sodium valproate",
    "theophylline",
];

/// What substitution needs to know about an item.
#[derive(Debug, Clone, Default)]
pub struct SubstituteFacts {
    pub inn: Option<String>,
    pub strength: Option<String>,
    pub dosage_form: Option<String>,
    /// `immediate` or `modified`.
    pub release_type: String,
    pub narrow_therapeutic_index: bool,
    pub biological: bool,
}

/// The salts of an INN, normalised: lower-case, split on `+`, `/` and `,`,
/// sorted — so "Amlodipine + Atenolol" matches "atenolol/amlodipine".
#[must_use]
pub fn salts(inn: &str) -> Vec<String> {
    let mut parts: Vec<String> = inn
        .split(['+', '/', ','])
        .map(|s| {
            s.split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .to_lowercase()
        })
        .filter(|s| !s.is_empty())
        .collect();
    parts.sort();
    parts.dedup();
    parts
}

fn norm(s: Option<&str>) -> String {
    s.unwrap_or_default()
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_lowercase()
}

/// Why an item can never be substituted, or `None`.
#[must_use]
pub fn never_substituted(f: &SubstituteFacts) -> Option<&'static str> {
    let nti_by_inn = f
        .inn
        .as_deref()
        .is_some_and(|inn| salts(inn).iter().any(|s| NTI_INNS.contains(&s.as_str())));
    if f.narrow_therapeutic_index || nti_by_inn {
        Some("a narrow-therapeutic-index drug is never substituted")
    } else if f.biological {
        Some("a biological is never substituted")
    } else {
        None
    }
}

/// Why `candidate` can't stand in for `prescribed`, or `None` when it can.
#[must_use]
pub fn substitution_problem(
    prescribed: &SubstituteFacts,
    candidate: &SubstituteFacts,
) -> Option<String> {
    if let Some(why) = never_substituted(prescribed).or_else(|| never_substituted(candidate)) {
        return Some(format!("Not allowed: {why}"));
    }
    let salt = |f: &SubstituteFacts| f.inn.as_deref().map(salts).unwrap_or_default();
    if salt(prescribed).is_empty() || salt(prescribed) != salt(candidate) {
        return Some("Not the same salt".to_owned());
    }
    if norm(prescribed.strength.as_deref()) != norm(candidate.strength.as_deref()) {
        return Some("Not the same strength".to_owned());
    }
    if norm(prescribed.dosage_form.as_deref()) != norm(candidate.dosage_form.as_deref()) {
        return Some("Not the same dosage form".to_owned());
    }
    if prescribed.release_type != candidate.release_type {
        return Some("Not the same release type (immediate vs modified)".to_owned());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn facts(inn: &str, strength: &str, form: &str, release: &str) -> SubstituteFacts {
        SubstituteFacts {
            inn: Some(inn.to_owned()),
            strength: Some(strength.to_owned()),
            dosage_form: Some(form.to_owned()),
            release_type: release.to_owned(),
            ..SubstituteFacts::default()
        }
    }

    #[test]
    fn same_salt_strength_form_and_release() {
        let a = facts("Amlodipine + Atenolol", "5 mg/50 mg", "tablet", "immediate");
        let b = facts("atenolol/amlodipine", "5mg/50mg", "Tablet", "immediate");
        assert_eq!(substitution_problem(&a, &b), None);
        let stronger = facts(
            "Amlodipine + Atenolol",
            "5 mg/100 mg",
            "tablet",
            "immediate",
        );
        assert!(substitution_problem(&a, &stronger).is_some());
        let syrup = facts("Amlodipine + Atenolol", "5 mg/50 mg", "syrup", "immediate");
        assert!(substitution_problem(&a, &syrup).is_some());
        let sr = facts("Amlodipine + Atenolol", "5 mg/50 mg", "tablet", "modified");
        assert!(substitution_problem(&a, &sr).is_some());
    }

    #[test]
    fn nti_and_biologicals_are_never_swapped() {
        let a = facts("Levothyroxine", "50 mcg", "tablet", "immediate");
        let b = a.clone();
        assert!(substitution_problem(&a, &b).is_some_and(|w| w.contains("narrow")));
        let mut insulin = facts("Insulin glargine", "100 IU/ml", "injection", "immediate");
        insulin.biological = true;
        assert!(substitution_problem(&insulin, &insulin.clone()).is_some());
        let mut marked = facts("Mycophenolate", "500 mg", "tablet", "immediate");
        marked.narrow_therapeutic_index = true;
        assert!(never_substituted(&marked).is_some());
    }
}
