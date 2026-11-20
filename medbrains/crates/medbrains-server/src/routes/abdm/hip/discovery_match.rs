//! Picking the patient a discovery request describes: a verified ABHA first,
//! then the mobile.
//!
//! NHA `USER_INIT_LINK_603`/`606`: among the patients registered on the
//! requester's mobile with the same gender, the one whose name agrees by the
//! registration desk's matcher (`patient_match::names`: spellings, typos,
//! initials, word order) and whose age is within five years.

use medbrains_server_services::patient_match::names::{NameAgreement, compare};
use serde_json::Value;
use uuid::Uuid;

use crate::error::AppError;

/// Patients on one mobile looked at: a family shares a phone, rarely more.
const MOBILE_CANDIDATES: i64 = 20;

/// NHA `USER_INIT_LINK_606`: age agrees within five years either way.
const AGE_TOLERANCE_YEARS: i32 = 5;

/// A patient on the requester's mobile, already of their gender.
#[derive(Debug)]
pub(super) struct Candidate {
    pub(super) id: Uuid,
    pub(super) name: String,
    /// Year of birth; `None` when the record has no date of birth.
    pub(super) year: Option<i32>,
}

/// The one candidate whose name agrees (any agreement short of different)
/// and whose age is within [`AGE_TOLERANCE_YEARS`] of `year`. Two or none
/// is no match: guessing between relatives would link one person's records
/// to another's ABHA.
pub(super) fn pick_by_demographics(
    name: &str,
    year: i32,
    candidates: &[Candidate],
) -> Option<Uuid> {
    let mut agreeing = candidates.iter().filter(|c| {
        c.year
            .is_some_and(|y| (y - year).abs() <= AGE_TOLERANCE_YEARS)
            && compare(name, &c.name) != NameAgreement::Different
    });
    match (agreeing.next(), agreeing.next()) {
        (Some(one), None) => Some(one.id),
        _ => None,
    }
}

/// The value of the verified identifier of `kind` the request carries.
fn identifier(patient: &Value, kind: &str) -> Option<String> {
    patient["verifiedIdentifiers"]
        .as_array()?
        .iter()
        .find(|i| i["type"] == kind)
        .and_then(|i| i["value"].as_str())
        .map(str::to_owned)
}

/// Only the digits of `s`: ABHA numbers and mobiles arrive formatted.
fn digits(s: &str) -> String {
    s.chars().filter(char::is_ascii_digit).collect()
}

/// The one patient the discovery request names, and how it was matched.
///
/// # Errors
/// A database fault.
pub(super) async fn match_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient: &Value,
) -> Result<Option<(Uuid, &'static str)>, AppError> {
    let address = patient["id"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    let number = identifier(patient, "ABHA_NUMBER").map(|n| digits(&n));
    let by_abha = sqlx::query_scalar::<_, Uuid>(
        "SELECT DISTINCT patient_id FROM patient_abha_links \
          WHERE tenant_id = $1 AND verified_at IS NOT NULL AND deleted_at IS NULL \
            AND unlinked_at IS NULL \
            AND ((abha_address IS NOT NULL AND lower(abha_address) = $2) \
              OR ($3::text IS NOT NULL AND regexp_replace(abha_number, '\\D', '', 'g') = $3)) \
          LIMIT 2",
    )
    .bind(tenant_id)
    .bind(&address)
    .bind(number.as_deref())
    .fetch_all(&mut **tx)
    .await?;
    if let [one] = by_abha.as_slice() {
        return Ok(Some((*one, "ABHA_ADDRESS")));
    }
    let Some(mobile) = identifier(patient, "MOBILE").map(|m| digits(&m)) else {
        return Ok(None);
    };
    let gender = match patient["gender"].as_str() {
        Some("M") => "male",
        Some("F") => "female",
        Some("O") => "other",
        _ => return Ok(None),
    };
    let year = patient["yearOfBirth"]
        .as_i64()
        .or_else(|| patient["yearOfBirth"].as_str()?.trim().parse().ok());
    let Some(year) = year.and_then(|y| i32::try_from(y).ok()) else {
        return Ok(None);
    };
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let on_mobile = sqlx::query!(
        r#"SELECT id, concat_ws(' ', first_name, last_name) AS "name!",
                  date_part('year', date_of_birth)::int AS year
             FROM patients
            WHERE tenant_id = $1 AND deleted_at IS NULL AND length($2) >= 10
              AND right(regexp_replace(phone, '\D', '', 'g'), 10) = right($2, 10)
              AND gender::text = $3
            ORDER BY created_at LIMIT $4"#,
        tenant_id,
        mobile,
        gender,
        MOBILE_CANDIDATES,
    )
    .fetch_all(&mut **tx)
    .await?;
    let candidates: Vec<Candidate> = on_mobile
        .into_iter()
        .map(|r| Candidate {
            id: r.id,
            name: r.name,
            year: r.year,
        })
        .collect();
    let name = patient["name"].as_str().unwrap_or_default();
    Ok(pick_by_demographics(name, year, &candidates).map(|id| (id, "MOBILE")))
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{Candidate, pick_by_demographics};

    fn person(name: &str, year: Option<i32>) -> Candidate {
        Candidate {
            id: Uuid::new_v4(),
            name: name.to_owned(),
            year,
        }
    }

    /// Near-miss spellings of the same person are found: a romanisation
    /// variant, a typo, an initial, words in another order.
    #[test]
    fn near_miss_names_of_the_same_person_match() {
        for (typed, registered) in [
            ("Laxmi Devi", "Lakshmi Devi"),
            ("Mohammed Rafi", "Muhammad Rafi"),
            ("Kumar Vijay", "Vijay Kumar"),
            ("K Ravindran", "Kumar Ravindran"),
            ("Sureshh Babu", "Suresh Babu"),
        ] {
            let one = person(registered, Some(1990));
            assert_eq!(
                pick_by_demographics(typed, 1990, std::slice::from_ref(&one)),
                Some(one.id),
                "{typed} / {registered}"
            );
        }
    }

    /// A different person on the same phone is never matched, however close
    /// the surname: "Ram Prasad" is not "Shyam Prasad".
    #[test]
    fn a_different_name_on_the_same_mobile_is_not_matched() {
        let brother = person("Shyam Prasad", Some(1990));
        assert_eq!(pick_by_demographics("Ram Prasad", 1990, &[brother]), None);
        let other = person("Anita Sharma", Some(1990));
        assert_eq!(pick_by_demographics("Sunita Verma", 1990, &[other]), None);
    }

    /// Age agrees within five years either way, and not at six (USER_INIT_LINK_606).
    #[test]
    fn age_within_five_years_either_way() {
        let p = person("Lakshmi Devi", Some(1990));
        let one = std::slice::from_ref(&p);
        for year in [1985, 1990, 1995] {
            assert_eq!(
                pick_by_demographics("Lakshmi Devi", year, one),
                Some(p.id),
                "{year}"
            );
        }
        for year in [1984, 1996] {
            assert_eq!(
                pick_by_demographics("Lakshmi Devi", year, one),
                None,
                "{year}"
            );
        }
        let undated = person("Lakshmi Devi", None);
        assert_eq!(pick_by_demographics("Lakshmi Devi", 1990, &[undated]), None);
    }

    /// Two people on one phone who both fit (twins, a namesake relative):
    /// no guess, not found.
    #[test]
    fn two_who_both_fit_is_no_match() {
        let a = person("Lakshmi Devi", Some(1990));
        let b = person("Laxmi Devi", Some(1993));
        assert_eq!(pick_by_demographics("Lakshmi Devi", 1991, &[a, b]), None);
        // A relative with the same name but outside the age window is no rival.
        let c = person("Lakshmi Devi", Some(1990));
        let d = person("Lakshmi Devi", Some(1970));
        let id = c.id;
        assert_eq!(
            pick_by_demographics("Lakshmi Devi", 1991, &[c, d]),
            Some(id)
        );
    }
}
