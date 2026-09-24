//! Bedside medication administration: the 5-rights decisions the phone makes
//! before it asks the server (`crates/medbrains-ipd`).

/// A nurse on the ward today, as `GET /api/ipd/wards/{id}/on-duty` lists them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WitnessCandidate {
    pub nurse_user_id: String,
    pub nurse_name: String,
    pub is_charge: bool,
}

/// Who may witness this dose: never the nurse giving it.
///
/// The server rejects `witnessed_by == actor`, so offering their own name
/// would only produce a refusal after the nurse has already decided — and a
/// second check by the same pair of eyes is not a second check.
#[must_use]
pub fn eligible_witnesses(on_duty: Vec<WitnessCandidate>, actor_id: &str) -> Vec<WitnessCandidate> {
    on_duty.into_iter().filter(|n| n.nurse_user_id != actor_id).collect()
}

/// Whether "Give now" may be pressed.
///
/// A high-alert drug without a named witness is the case this exists for;
/// the server refuses the same write, but a disabled button explains itself
/// and a 400 does not.
#[must_use]
pub fn can_record_given(is_high_alert: bool, witness_id: Option<&str>) -> bool {
    !is_high_alert || witness_id.is_some_and(|w| !w.is_empty())
}

/// The one-line summary under the server's reason.
///
/// Both rights are named every time, including the one that passed:
/// "Wristband matched, drug did not" tells a nurse to put the pack down and
/// keep the patient.
#[must_use]
pub fn scan_rights_summary(right_patient: bool, right_drug: bool) -> String {
    let patient = if right_patient { "Wristband matched." } else { "Wristband did not match." };
    let drug = if right_drug { "Drug matched." } else { "Drug did not match." };
    format!("{patient} {drug}")
}

#[cfg(test)]
mod tests {
    use super::{WitnessCandidate, can_record_given, eligible_witnesses, scan_rights_summary};

    fn nurse(id: &str, name: &str) -> WitnessCandidate {
        WitnessCandidate { nurse_user_id: id.into(), nurse_name: name.into(), is_charge: false }
    }

    #[test]
    fn never_offers_the_nurse_giving_it() {
        let ids: Vec<String> = eligible_witnesses(vec![nurse("me", "Asha"), nurse("other", "Bilal")], "me")
            .into_iter()
            .map(|n| n.nurse_user_id)
            .collect();
        assert_eq!(ids, vec!["other".to_owned()]);
    }

    #[test]
    fn nobody_rather_than_everybody_when_the_ward_is_one_nurse() {
        assert!(eligible_witnesses(vec![nurse("me", "Asha")], "me").is_empty());
    }

    #[test]
    fn high_alert_needs_a_witness() {
        assert!(!can_record_given(true, None));
        assert!(!can_record_given(true, Some("")));
        assert!(can_record_given(true, Some("other")));
    }

    #[test]
    fn ordinary_dose_needs_none() {
        // Requiring one everywhere would teach nurses to name whoever is
        // nearest, which is how the high-alert witness stops meaning anything.
        assert!(can_record_given(false, None));
    }

    #[test]
    fn names_both_rights_including_the_one_that_passed() {
        assert_eq!(scan_rights_summary(true, false), "Wristband matched. Drug did not match.");
        assert_eq!(scan_rights_summary(false, true), "Wristband did not match. Drug matched.");
    }
}
