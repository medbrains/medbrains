//! The pure parts of the trial sponsor export: the subject key, the arm
//! concealment and the redaction of free text that names its participant.
//!
//! Kept apart from the database code so each can be tested without one.
//!
//! Limits, on purpose: a name part shorter than three letters is not matched
//! (it would redact half of all free text), and Unicode look-alike characters
//! (a Cyrillic `а` for a Latin `a`, full-width digits) are not normalised, so a
//! value spelt with them on purpose gets through. Words split on whitespace and
//! ASCII punctuation only, so a Tamil or Devanagari name keeps its pulli or
//! virama and stays one word.

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
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub phone: Option<String>,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,
    pub abha_number: Option<String>,
    pub abha_id: Option<String>,
    pub abha_address: Option<String>,
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
/// It does when it holds their UHID, ABHA id or address, email or its local
/// part (letters and digits only, any case or separator), a first, middle or
/// last name as a whole word (case-insensitive, at least three letters), either
/// phone, their ABHA number or Aadhaar last four. A participant that could not
/// be read counts as named: nothing is known to check against, so nothing free
/// goes out.
#[must_use]
pub fn names_person(value: &str, person: &Person) -> bool {
    if person.uhid.is_none() {
        return true;
    }
    has_compact_id(value, person)
        || has_name(&value.to_lowercase(), person)
        || has_number(value, person)
}

/// Lowercase letters and digits only, so `UHID-00042`, `uhid 00042` and
/// `UHID00042` compare equal. Same rule as the SQL in the randomisation-code
/// refusal: `regexp_replace(lower(x), '[^a-z0-9]', '', 'g')`.
fn compact(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// The UHID, ABHA id or address or email appears in `value` once separators
/// are dropped from both.
fn has_compact_id(value: &str, person: &Person) -> bool {
    let value = compact(value);
    [
        &person.uhid,
        &person.abha_id,
        &person.abha_address,
        &person.email,
    ]
    .into_iter()
    .flatten()
    .map(|id| compact(id))
    .any(|id| id.chars().count() >= MIN_NAME_LEN && value.contains(&id))
}

/// Word boundaries: whitespace and ASCII punctuation, never a combining mark,
/// so `கண்ணன்` and `लक्ष्मी` stay whole.
const fn is_word_break(c: char) -> bool {
    c.is_whitespace() || c.is_ascii_punctuation()
}

/// The non-empty words of `s`, split at [`is_word_break`].
fn words(s: &str) -> Vec<&str> {
    s.split(is_word_break).filter(|w| !w.is_empty()).collect()
}

/// A name part of `person` appears as a whole word of `lower`, or the local
/// part of their email or ABHA address (`kavitha.r` of `kavitha.r@…`) as a run
/// of whole words, so `Kavithalaya` is not taken for `kavitha@…`.
fn has_name(lower: &str, person: &Person) -> bool {
    let value = words(lower);
    let has_run = |run: &str| {
        let run = words(run);
        !run.is_empty() && value.windows(run.len()).any(|w| w == run.as_slice())
    };
    let parts = [&person.first_name, &person.middle_name, &person.last_name]
        .into_iter()
        .flatten()
        .flat_map(|n| {
            words(&n.to_lowercase())
                .into_iter()
                .map(str::to_owned)
                .collect::<Vec<_>>()
        });
    let locals = [&person.email, &person.abha_address]
        .into_iter()
        .flatten()
        .filter_map(|e| e.split_once('@').map(|(l, _)| l.to_lowercase()));
    parts
        .chain(locals)
        .filter(|p| compact(p).chars().count() >= MIN_NAME_LEN)
        .any(|p| has_run(&p))
}

/// Either phone, the ABHA number or an Aadhaar last four appears in `value`'s digits.
fn has_number(value: &str, person: &Person) -> bool {
    let all: String = value.chars().filter(char::is_ascii_digit).collect();
    let tail = |n: &str, keep: usize| {
        let d: String = n.chars().filter(char::is_ascii_digit).collect();
        d[d.len().saturating_sub(keep)..].to_owned()
    };
    let phones = [&person.phone, &person.phone_secondary]
        .into_iter()
        .flatten()
        .map(|p| tail(p, PHONE_DIGITS));
    let abha = person.abha_number.as_deref().map(|a| tail(a, usize::MAX));
    let number = phones
        .chain(abha)
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
            middle_name: Some("Devi".to_owned()),
            last_name: Some("Ramanathan".to_owned()),
            phone: Some("+91 98450 11201".to_owned()),
            phone_secondary: Some("044 2615 3377".to_owned()),
            email: Some("kavi.r@example.in".to_owned()),
            abha_number: Some("91-2345-6789-0123".to_owned()),
            abha_id: Some("KR-7781-2290".to_owned()),
            abha_address: Some("kavitha.r@sbx".to_owned()),
            aadhaar_last4: vec!["4567".to_owned()],
        }
    }

    /// A participant with only a UHID and a first name.
    fn named(uhid: &str, first_name: &str) -> Person {
        Person {
            uhid: Some(uhid.to_owned()),
            first_name: Some(first_name.to_owned()),
            ..Person::default()
        }
    }

    fn is_redacted(v: &str, p: &Person) -> bool {
        let mut s = v.to_owned();
        redact(&mut s, p);
        s == REDACTED
    }

    #[test]
    fn a_uhid_is_found_whatever_its_separators_or_case() {
        let p = named("UHID-00042", "Meena");
        for v in [
            "UHID00042",
            "code UHID 00042",
            "uhid_00042",
            "R/Uhid.00042/2",
        ] {
            assert!(is_redacted(v, &p), "{v}");
        }
        assert!(
            !is_redacted("R-00042", &p),
            "the bare number alone is not the UHID"
        );
    }

    #[test]
    fn each_further_identifier_is_redacted() {
        let p = kavitha();
        for v in [
            "Week 4 Devi",            // middle name
            "call 044-26153377",      // second phone
            "mail kavi.r@example.in", // email
            "from kavi.r",            // email local part
            "abha kr77812290",        // ABHA id
            "linked KAVITHA.R@SBX",   // ABHA address
        ] {
            assert!(is_redacted(v, &p), "{v}");
        }
    }

    #[test]
    fn a_short_email_local_part_is_not_matched_alone() {
        let p = Person {
            email: Some("kr@example.in".to_owned()),
            ..named("UHID-1", "Zed")
        };
        assert!(!is_redacted("kr follow-up", &p));
        assert!(is_redacted("kr@example.in", &p));
    }

    #[test]
    fn a_name_in_an_indic_script_stays_one_word() {
        for (name, visit) in [("கண்ணன்", "வாரம் 4 கண்ணன்"), ("लक्ष्मी", "सप्ताह 4 लक्ष्मी")]
        {
            let p = named("UHID-1", name);
            assert!(is_redacted(visit, &p), "{visit}");
            assert!(!is_redacted("Week 4", &p));
        }
    }

    #[test]
    fn a_name_of_three_letters_is_matched_and_of_two_is_not() {
        assert!(is_redacted("Ali came alone", &named("UHID-1", "Ali")));
        assert!(!is_redacted("Al came alone", &named("UHID-1", "Al")));
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
            "Devika",
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
