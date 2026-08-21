//! What kind of data each redactable field is.
//!
//! The machinery to redact a field per role has existed for some time: a
//! middleware resolves `roles.field_access_defaults`, thirteen crates honour
//! the result, and 49 fields are wired to be redactable. **Not one of 33 roles
//! had a rule configured**, so in practice nothing was ever redacted.
//!
//! Leaving it as pure configuration is why. An administrator asked to pick
//! `edit | view | mask | hidden` for 49 fields across 33 roles is being asked
//! 1,617 questions, most of which have one defensible answer — and the
//! defensible answer comes from what the field *is*, not from who is asking.
//!
//! So the class is declared here, once, and the presentation follows from it.
//! A role can still be granted more than the default, but the floor is a
//! property of the data.
//!
//! ## The distinction that matters most
//!
//! `Identifying` is masked — a date of birth shown as `19**` is useful and the
//! field's existence is not a secret. `Sensitive` is tombstoned and
//! `Restricted` is withheld entirely, because for those the *existence of the
//! record* is often the disclosure. "Test: HIV — result restricted" tells you
//! the test was ordered, which is usually the thing worth hiding.

use crate::classification::DataClass;

/// A field and the class it belongs to.
#[derive(Debug)]
pub struct FieldClass {
    /// The dotted key a handler looks up, matching a `*_FIELD` constant.
    pub key: &'static str,
    pub class: DataClass,
    /// Why this class and not a neighbouring one, where it is not obvious.
    pub note: Option<&'static str>,
}

/// The 49 redactable fields, classified.
///
/// Anything absent from this table has no declared class and is treated as
/// `Routine` — which is the safe direction for presentation but means a new
/// sensitive field must be added here, not merely marked redactable.
pub const FIELD_CLASSES: &[FieldClass] = &[
    // ── Patient identity ───────────────────────────────────────────────
    // Identifiers, not clinical facts. Masking is right: partial display is
    // useful at a desk, and nobody is surprised that a patient has a name.
    FieldClass {
        key: "patients.first_name",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.middle_name",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.last_name",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.full_name_local",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.date_of_birth",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.address",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.phone",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.phone_secondary",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.email",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "patients.uhid",
        class: DataClass::Routine,
        note: Some(
            "hiding it breaks patient lookup — the identifier is how staff find the record at all",
        ),
    },
    FieldClass {
        key: "patients.abha_id",
        class: DataClass::Restricted,
        note: Some(
            "ABDM health identifier — a national ID, and it links records across facilities",
        ),
    },
    FieldClass {
        key: "patients.identifiers.id_number",
        class: DataClass::Restricted,
        note: Some(
            "government ID; masking still leaks the last digits, which are enough to correlate",
        ),
    },
    FieldClass {
        key: "patients.mlc_number",
        class: DataClass::Confidential,
        note: Some("its existence says the patient is in a police case"),
    },
    // ── Medico-legal (MLC) ─────────────────────────────────────────────
    // The existence of an MLC record is itself the disclosure, so these are
    // confidential or sealed rather than masked.
    FieldClass {
        key: "emergency.mlc.pocso_report",
        class: DataClass::Sealed,
        note: Some(
            "POCSO — statutory confidentiality; the record must not appear in any list or count",
        ),
    },
    FieldClass {
        key: "emergency.mlc.fir_number",
        class: DataClass::Confidential,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.police_station",
        class: DataClass::Confidential,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.cause_of_death",
        class: DataClass::Restricted,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.medical_opinion",
        class: DataClass::Restricted,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.examination_findings",
        class: DataClass::Restricted,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.history_of_incident",
        class: DataClass::Restricted,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.informant_name",
        class: DataClass::Confidential,
        note: Some("naming the informant can endanger them"),
    },
    FieldClass {
        key: "emergency.mlc.informant_contact",
        class: DataClass::Confidential,
        note: None,
    },
    FieldClass {
        key: "emergency.mlc.informant_relation",
        class: DataClass::Confidential,
        note: None,
    },
    // ── Clinical content ───────────────────────────────────────────────
    // Tombstoned, not masked: "diagnosis: ****" still says a diagnosis exists,
    // and a partial clinical string is worse than none.
    FieldClass {
        key: "opd.diagnosis",
        class: DataClass::Sensitive,
        note: None,
    },
    FieldClass {
        key: "opd.soap_note",
        class: DataClass::Sensitive,
        note: None,
    },
    FieldClass {
        key: "ipd.admissions.provisional_diagnosis",
        class: DataClass::Sensitive,
        note: None,
    },
    FieldClass {
        key: "ipd.discharge_summary.final_diagnosis",
        class: DataClass::Sensitive,
        note: None,
    },
    // ── Attenders (the people at the bedside) ──────────────────────────
    FieldClass {
        key: "ipd.attenders.name",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "ipd.attenders.phone",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "ipd.attenders.alt_phone",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "ipd.attenders.address",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "ipd.attenders.relationship",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "ipd.attenders.id_proof_number",
        class: DataClass::Restricted,
        note: Some("government ID of a third party who is not the patient"),
    },
    // ── Camp registration ──────────────────────────────────────────────
    FieldClass {
        key: "camp.registrations.person_name",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "camp.registrations.phone",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "camp.registrations.id_proof_number",
        class: DataClass::Restricted,
        note: Some("government ID collected in the field, often on shared devices"),
    },
    // ── Pharmacy: narcotics register ───────────────────────────────────
    // A statutory register under the NDPS Act 1985. Who witnessed a
    // controlled-substance transaction is the audit trail, and altering or
    // exposing it selectively defeats the register.
    FieldClass {
        key: "pharmacy.ndps.witnessed_by",
        class: DataClass::Restricted,
        note: Some("NDPS witness record — statutory"),
    },
    FieldClass {
        key: "pharmacy.ndps.user_ids",
        class: DataClass::Restricted,
        note: None,
    },
    FieldClass {
        key: "pharmacy.ndps.balance_after",
        class: DataClass::Restricted,
        note: None,
    },
    // ── Pharmacy: commercial ───────────────────────────────────────────
    // Not patient data. Restricted because margin is commercially sensitive
    // between a hospital and its suppliers, not because of privacy law.
    FieldClass {
        key: "pharmacy.batches.purchase_rate",
        class: DataClass::Restricted,
        note: Some("supplier margin"),
    },
    FieldClass {
        key: "pharmacy.batches.source",
        class: DataClass::Restricted,
        note: Some("supplier identity"),
    },
    FieldClass {
        key: "pharmacy.batches.selling_rate",
        class: DataClass::Routine,
        note: None,
    },
    FieldClass {
        key: "pharmacy.batches.batch_number",
        class: DataClass::Routine,
        note: Some("needed for recalls and FEFO — hiding it is a safety cost"),
    },
    FieldClass {
        key: "pharmacy.catalog.base_price",
        class: DataClass::Routine,
        note: None,
    },
    FieldClass {
        key: "pharmacy.pricing.unit_price",
        class: DataClass::Routine,
        note: None,
    },
    FieldClass {
        key: "pharmacy.analytics.value",
        class: DataClass::Routine,
        note: None,
    },
    // ── Pharmacy point of sale ─────────────────────────────────────────
    FieldClass {
        key: "pharmacy.pos.patient_name",
        class: DataClass::Identifying,
        note: None,
    },
    FieldClass {
        key: "pharmacy.pos.patient_phone",
        class: DataClass::Identifying,
        note: None,
    },
    // ── Billing ────────────────────────────────────────────────────────
    FieldClass {
        key: "billing.amount",
        class: DataClass::Routine,
        note: None,
    },
];

/// The declared class for a field, or `Routine` when it has none.
///
/// Defaulting to `Routine` is deliberate: an unclassified field renders
/// normally rather than disappearing, so forgetting to classify shows up as a
/// visible field somebody questions — not as data silently vanishing from a
/// screen, which nobody reports.
pub fn class_of(key: &str) -> DataClass {
    FIELD_CLASSES
        .iter()
        .find(|entry| entry.key == key)
        .map_or(DataClass::Routine, |entry| entry.class)
}

#[cfg(test)]
mod tests {
    use super::{FIELD_CLASSES, class_of};
    use crate::classification::DataClass;

    #[test]
    fn every_key_is_declared_once() {
        let mut seen = std::collections::HashSet::new();
        for entry in FIELD_CLASSES {
            assert!(seen.insert(entry.key), "{} is classified twice", entry.key);
        }
    }

    /// A clinical value must never be masked. "Diagnosis: ****" still tells the
    /// reader a diagnosis exists, and a partially revealed clinical string is
    /// worse than a withheld one.
    #[test]
    fn clinical_content_is_never_merely_masked() {
        for key in [
            "opd.diagnosis",
            "opd.soap_note",
            "ipd.admissions.provisional_diagnosis",
            "ipd.discharge_summary.final_diagnosis",
            "emergency.mlc.medical_opinion",
        ] {
            let class = class_of(key);
            assert_ne!(
                class,
                DataClass::Identifying,
                "{key} is clinical content and must not be masked",
            );
        }
    }

    /// Government identifiers must not be masked either — the visible portion
    /// of an ID is usually enough to correlate against another source.
    #[test]
    fn government_identifiers_are_withheld_not_masked() {
        for key in [
            "patients.identifiers.id_number",
            "patients.abha_id",
            "ipd.attenders.id_proof_number",
            "camp.registrations.id_proof_number",
        ] {
            assert_eq!(class_of(key), DataClass::Restricted, "{key}");
        }
    }

    /// POCSO carries statutory confidentiality — the record must not surface in
    /// a list, a count or an export, which is what `Sealed` obliges.
    #[test]
    fn pocso_is_sealed_not_merely_hidden() {
        assert_eq!(class_of("emergency.mlc.pocso_report"), DataClass::Sealed);
        assert!(class_of("emergency.mlc.pocso_report").requires_cloaking());
    }

    /// Two fields are deliberately left routine because hiding them costs more
    /// than it protects: the UHID is how staff find a record at all, and the
    /// batch number is what a recall depends on.
    #[test]
    fn safety_critical_identifiers_stay_visible() {
        assert_eq!(class_of("patients.uhid"), DataClass::Routine);
        assert_eq!(
            class_of("pharmacy.batches.batch_number"),
            DataClass::Routine
        );
    }

    /// An unclassified field renders normally. Silence must not hide data —
    /// nobody reports a field that quietly vanished.
    #[test]
    fn an_unknown_field_defaults_to_routine() {
        assert_eq!(class_of("something.not.declared"), DataClass::Routine);
    }
}
