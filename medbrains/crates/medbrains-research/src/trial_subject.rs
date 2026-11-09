//! The pure parts of the trial sponsor export: the subject key, the arm
//! concealment and the redaction of free text that names its participant.
//!
//! Kept apart from the database code so each can be tested without one.

use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use uuid::Uuid;

/// What a released value that named its participant is replaced with.
pub const REDACTED: &str = "[redacted: contained an identifier]";
/// Shortest name part matched as a word; shorter ones match too much.
const MIN_NAME_LEN: usize = 3;
/// A phone number is matched on its last ten digits (the national number).
const PHONE_DIGITS: usize = 10;
/// Fewer digits than this are not matched as a phone or ABHA number.
const MIN_NUMBER_DIGITS: usize = 7;
/// Domain label: keys derived here are never the same as any other HMAC of the server key.
const KEY_LABEL: &[u8] = b"medbrains/clinical-trial-subject-key/v1\0";

/// The identifiers of one participant, as read beside each released row.
/// Every field is `None` when the patient could not be read.
#[derive(Debug, Default, Clone, sqlx::FromRow)]
pub struct Person {
    pub uhid: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub phone: Option<String>,
    pub abha_number: Option<String>,
    pub aadhaar_last4: Vec<String>,
}

/// The HMAC key for one trial's subject keys:
/// `HMAC(server_key, label ‖ tenant ‖ trial ‖ salt)`.
///
/// Patient ids are not secret, so a key made from the stored salt alone would
/// let anyone with a database copy re-identify every subject. With the server
/// key, the database alone is not enough. Stable for the life of the trial.
#[must_use]
pub fn trial_key(server_key: &[u8], tenant: Uuid, trial: Uuid, salt: &[u8]) -> Vec<u8> {
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(server_key) else {
        return Vec::new(); // unreachable: HMAC takes a key of any length
    };
    mac.update(KEY_LABEL);
    mac.update(tenant.as_bytes());
    mac.update(trial.as_bytes());
    mac.update(salt);
    mac.finalize().into_bytes().to_vec()
}

/// The arm as released: only once the record was unblinded.
#[must_use]
pub fn released_arm(arm: Option<String>, is_unblinded: bool) -> Option<String> {
    arm.filter(|_| is_unblinded)
}

/// Replace `value` with [`REDACTED`] when it names `person`.
pub fn redact(value: &mut String, person: &Person) {
    if names_person(value, person) {
        REDACTED.clone_into(value);
    }
}

/// [`redact`] for an optional value.
pub fn redact_opt(value: &mut Option<String>, person: &Person) {
    if let Some(v) = value {
        redact(v, person);
    }
}

/// Whether `value` names `person`.
///
/// It does when it holds their UHID, a first or last name as a whole word
/// (case-insensitive, at least three letters), their phone, ABHA number or
/// Aadhaar last four. A participant that could not be read counts as named:
/// nothing is known to check against, so nothing free goes out.
#[must_use]
pub fn names_person(value: &str, person: &Person) -> bool {
    let Some(uhid) = person.uhid.as_deref() else {
        return true;
    };
    let lower = value.to_lowercase();
    let uhid = uhid.trim().to_lowercase();
    (!uhid.is_empty() && lower.contains(&uhid))
        || has_name(&lower, person)
        || has_number(value, person)
}

/// A name part of `person` appears as a whole word of `lower`.
fn has_name(lower: &str, person: &Person) -> bool {
    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).collect();
    [&person.first_name, &person.last_name]
        .into_iter()
        .flatten()
        .flat_map(|n| {
            n.to_lowercase()
                .split(|c: char| !c.is_alphanumeric())
                .filter(|p| p.chars().count() >= MIN_NAME_LEN)
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .any(|part| words.contains(&part.as_str()))
}

/// The phone, ABHA number or an Aadhaar last four appears in `value`'s digits.
fn has_number(value: &str, person: &Person) -> bool {
    let all: String = value.chars().filter(char::is_ascii_digit).collect();
    let tail = |n: &str, keep: usize| {
        let d: String = n.chars().filter(char::is_ascii_digit).collect();
        d[d.len().saturating_sub(keep)..].to_owned()
    };
    let phone = person.phone.as_deref().map(|p| tail(p, PHONE_DIGITS));
    let abha = person.abha_number.as_deref().map(|a| tail(a, usize::MAX));
    let number = [phone, abha]
        .into_iter()
        .flatten()
        .any(|d| d.len() >= MIN_NUMBER_DIGITS && all.contains(&d));
    let runs: Vec<&str> = value.split(|c: char| !c.is_ascii_digit()).collect();
    number
        || person
            .aadhaar_last4
            .iter()
            .filter(|l| l.len() == 4)
            .any(|l| runs.iter().any(|r| r.contains(l.as_str())))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kavitha() -> Person {
        Person {
            uhid: Some("UHID-TX-9".to_owned()),
            first_name: Some("Kavitha".to_owned()),
            last_name: Some("Ramanathan".to_owned()),
            phone: Some("+91 98450 11201".to_owned()),
            abha_number: Some("91-2345-6789-0123".to_owned()),
            aadhaar_last4: vec!["4567".to_owned()],
        }
    }

    #[test]
    fn a_value_naming_the_participant_is_redacted() {
        let p = kavitha();
        for v in [
            "R-uhid-tx-9",
            "Week 4 kavitha",
            "RAMANATHAN, visit",
            "call 9845011201",
            "ABHA 91234567890123",
            "id 1234 5678 4567",
        ] {
            let mut s = v.to_owned();
            redact(&mut s, &p);
            assert_eq!(s, REDACTED, "{v}");
        }
    }

    #[test]
    fn a_value_that_does_not_name_them_goes_out() {
        let p = kavitha();
        for v in [
            "R-001",
            "Week 4",
            "Myalgia",
            "Kavithalaya clinic",
            "Screening",
        ] {
            let mut s = v.to_owned();
            redact(&mut s, &p);
            assert_eq!(s, v);
        }
    }

    #[test]
    fn an_unreadable_participant_releases_no_free_text() {
        assert!(names_person("Week 4", &Person::default()));
    }

    #[test]
    fn the_trial_key_needs_the_server_key_and_is_stable_per_trial() {
        let (t, trial, salt) = (Uuid::new_v4(), Uuid::new_v4(), b"salt".as_slice());
        let k = trial_key(b"server", t, trial, salt);
        assert_eq!(k, trial_key(b"server", t, trial, salt));
        assert_ne!(k, salt, "the salt alone is never the key");
        assert_ne!(k, trial_key(b"other server", t, trial, salt));
        assert_ne!(k, trial_key(b"server", t, Uuid::new_v4(), salt));
        assert_ne!(k, trial_key(b"server", Uuid::new_v4(), trial, salt));
        assert_eq!(k.len(), 32);
    }

    #[test]
    fn a_blinded_arm_is_concealed() {
        assert_eq!(released_arm(Some("statin".to_owned()), false), None);
        assert_eq!(
            released_arm(Some("statin".to_owned()), true).as_deref(),
            Some("statin")
        );
    }
}
