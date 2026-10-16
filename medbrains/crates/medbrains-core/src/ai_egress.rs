//! What leaves for an outside AI model, and what is kept back (DPDP Act s.8,
//! s.16). The clinical assistant reasons about allergies, drugs, results and
//! diagnoses; it does not need to know who the patient is. Before text goes
//! to a provider outside the hospital this removes the identifiers: the
//! identity fields of any record (name, phone, date of birth, address, UHID,
//! ABHA, Aadhaar, …) whether the JSON is whole or cut short, and phone,
//! Aadhaar, ABHA and email patterns typed into free text.
//!
//! Generic `name` keys are kept on purpose — they name drugs, tests and
//! departments, which the answer needs. A local model (no egress) is not
//! filtered; the caller decides by provider.

use std::sync::LazyLock;

use regex::Regex;

/// Record fields that say who a person is.
const IDENTITY_KEYS: &str = "first_name|middle_name|last_name|full_name|patient_name|\
    preferred_name|maiden_name|father_name|mother_name|spouse_name|guardian_name|\
    next_of_kin_name|next_of_kin_phone|emergency_contact_name|emergency_contact_phone|\
    attendant_name|phone|mobile|alternate_phone|whatsapp_number|email|\
    address|address_line_1|address_line_2|line1|line2|landmark|pincode|postal_code|\
    date_of_birth|dob|uhid|mrn|abha_number|abha_address|abha_id|aadhaar|aadhaar_number|\
    aadhaar_last4|pan_number|passport_number|voter_id|driving_license|photo_url";

static KEY_VALUE: LazyLock<Regex> = LazyLock::new(|| {
    // "key": "value" | number | null — inside whole or truncated JSON.
    pattern(&format!(
        r#""({IDENTITY_KEYS})"\s*:\s*("(?:[^"\\]|\\.)*"?|-?\d[\d.]*|null)"#
    ))
});

/// The patterns that identify a person wherever they are typed.
static FREE_TEXT: LazyLock<[(Regex, &'static str); 4]> = LazyLock::new(|| {
    [
        // ABHA number: 14 digits, often 2-4-4-4.
        (pattern(r"\b\d{2}-?\d{4}-?\d{4}-?\d{4}\b"), "[ABHA number]"),
        // Aadhaar: 12 digits, often 4-4-4.
        (pattern(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b"), "[Aadhaar]"),
        // Indian mobile, with or without +91.
        (pattern(r"(?:\+?91[ -]?)?\b[6-9]\d{9}\b"), "[phone]"),
        (pattern(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), "[email]"),
    ]
});

fn pattern(p: &str) -> Regex {
    Regex::new(p).unwrap_or_else(|_| unreachable_regex())
}

/// A regex that matches nothing — the fallback for a pattern that, being a
/// literal above, cannot fail to compile.
fn unreachable_regex() -> Regex {
    #[allow(clippy::unwrap_used)]
    Regex::new(r"[^\s\S]").unwrap()
}

/// Text as it may leave the hospital: identity fields blanked, identifying
/// numbers and addresses replaced by what they were.
#[must_use]
pub fn scrub(text: &str) -> String {
    let mut out = KEY_VALUE
        .replace_all(text, |c: &regex::Captures<'_>| {
            format!(r#""{}":"[withheld]""#, &c[1])
        })
        .into_owned();
    for (re, label) in FREE_TEXT.iter() {
        out = re.replace_all(&out, *label).into_owned();
    }
    out
}

/// Whether text for this provider leaves the hospital.
#[must_use]
pub fn leaves_the_hospital(provider: &str) -> bool {
    provider != "ollama"
}

#[cfg(test)]
mod tests {
    use super::scrub;

    #[test]
    fn identity_fields_go_clinical_facts_stay() {
        let record = r#"{"first_name":"Meena","phone":"9876543210","date_of_birth":"1990-03-12",
            "uhid":"AMH-000123","allergies":[{"name":"Penicillin","severity":"severe"}],"hb":9.1}"#;
        let out = scrub(record);
        assert!(
            !out.contains("Meena") && !out.contains("9876543210") && !out.contains("AMH-000123")
        );
        assert!(!out.contains("1990-03-12"));
        assert!(out.contains("Penicillin") && out.contains("severe") && out.contains("9.1"));
        assert!(out.contains(r#""first_name":"[withheld]""#));
    }

    #[test]
    fn a_record_cut_short_is_still_scrubbed() {
        let cut = r#"[{"id":"1","full_name":"Ravi Kum"#;
        assert!(!scrub(cut).contains("Ravi"));
    }

    #[test]
    fn numbers_typed_in_a_question_are_replaced() {
        let q = "Patient on 98765 43210? no, +91 9876543210, Aadhaar 1234 5678 9012, ABHA 12-3456-7890-1234, mail a@b.in";
        let out = scrub(q);
        assert!(
            out.contains("[phone]") && out.contains("[Aadhaar]") && out.contains("[ABHA number]")
        );
        assert!(
            out.contains("[email]")
                && !out.contains("9876543210")
                && !out.contains("1234 5678 9012")
        );
    }

    #[test]
    fn clinical_numbers_survive() {
        let q = "BP 120/80, potassium 5.6, dose 500 mg every 8 hours, creatinine 1.2 on 2026-10-16";
        assert_eq!(scrub(q), q);
    }
}
