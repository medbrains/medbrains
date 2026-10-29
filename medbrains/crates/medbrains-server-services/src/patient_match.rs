//! The duplicate check: is this person already registered? Run by the
//! registration desk (`POST /api/patients/match`) and by the storefront
//! before it makes a pharmacy-customer record, so a returning patient is
//! matched, never registered twice.
//!
//! Two steps. A verified ABHA number the patient already has here is the
//! same person, full stop (`certain`). Otherwise candidates are fetched by
//! cheap blocking keys — a similar first or last name (pg_trgm), the same
//! date of birth, the same mobile — and each is scored by the
//! Fellegi-Sunter model in [`model`], which compares names the way Indian
//! spellings vary ([`names`]).

pub mod model;
pub mod names;

use chrono::NaiveDate;
use medbrains_core::patient::Gender;
use medbrains_server_core::error::AppError;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub use model::MatchBand;
use model::Person;

/// Candidates fetched by the blocking keys, at most, before scoring.
const CANDIDATE_LIMIT: i64 = 100;
/// Candidates shown, best first.
const SHOWN_LIMIT: usize = 20;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MatchResult {
    pub id: Uuid,
    pub uhid: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: String,
    pub gender: Gender,
    /// Probability this is the same person, 0..1.
    pub score: f64,
    /// A light record from the online pharmacy: the desk completes it into a
    /// full registration rather than making a second one.
    pub pharmacy_customer: bool,
    /// `certain` / `likely` / `review`; absent from plain lookups.
    #[sqlx(skip)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub band: Option<MatchBand>,
    /// Why, field by field ("Name matches in another spelling", …).
    #[sqlx(skip)]
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub reasons: Vec<&'static str>,
}

#[derive(Debug, Default)]
pub struct MatchQuery {
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: String,
    /// `male` / `female`, when the desk recorded it.
    pub sex: Option<String>,
}

const COLUMNS: &str = "p.id, p.uhid, p.first_name, p.last_name, p.date_of_birth, p.phone, \
     p.gender, 1.0::float8 AS score, p.pharmacy_customer";

/// The patient already holding this verified ABHA number here, if any.
/// Compared on digits, so `91-1111-2222-3333` and `91111122223333` agree.
///
/// # Errors
/// Database faults.
pub async fn abha_matches(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    abha_number: &str,
) -> Result<Vec<MatchResult>, AppError> {
    let digits: String = abha_number.chars().filter(char::is_ascii_digit).collect();
    if digits.len() != 14 {
        return Ok(Vec::new());
    }
    let mut rows = sqlx::query_as::<_, MatchResult>(&format!(
        "SELECT {COLUMNS} FROM patients p \
          WHERE p.tenant_id = $1 AND p.is_merged = false AND p.is_active = true \
            AND p.deleted_at IS NULL \
            AND EXISTS (SELECT 1 FROM patient_abha_links l \
                         WHERE l.tenant_id = p.tenant_id AND l.patient_id = p.id \
                           AND l.verified_at IS NOT NULL AND l.status = 'linked' \
                           AND l.deleted_at IS NULL AND l.unlinked_at IS NULL \
                           AND regexp_replace(l.abha_number, '[^0-9]', '', 'g') = $2) \
          LIMIT 5"
    ))
    .bind(tenant_id)
    .bind(&digits)
    .fetch_all(&mut **tx)
    .await?;
    for r in &mut rows {
        r.band = Some(MatchBand::Certain);
        r.reasons = vec!["Same verified ABHA number"];
    }
    Ok(rows)
}

fn sex_of(g: Gender) -> Option<&'static str> {
    match g {
        Gender::Male => Some("male"),
        Gender::Female => Some("female"),
        Gender::Other | Gender::Unknown => None,
    }
}

/// Likely and for-review matches on name, date of birth, sex and phone,
/// best first; candidates below the review threshold are dropped.
///
/// # Errors
/// Database faults.
pub async fn fuzzy_matches(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    q: &MatchQuery,
) -> Result<Vec<MatchResult>, AppError> {
    // ponytail: blocking is trigram/DOB/phone, so a spelling variant with no
    // DOB or phone entered ("Laxmi" for "Lakshmi", name only) can be missed
    // before scoring. A stored transliteration-key column with its own index
    // fixes that; add it when the review queue shows such misses.
    let phone10: String = {
        let d: String = q.phone.chars().filter(char::is_ascii_digit).collect();
        d[d.len().saturating_sub(10)..].to_owned()
    };
    let candidates = sqlx::query_as::<_, MatchResult>(&format!(
        "SELECT {COLUMNS} FROM patients p \
          WHERE p.tenant_id = $1 AND p.is_merged = false AND p.is_active = true \
            AND p.deleted_at IS NULL \
            AND ( \
              ($2 <> '' AND similarity(p.first_name, $2) > 0.3) \
              OR ($3 <> '' AND similarity(p.last_name, $3) > 0.3) \
              OR ($2 <> '' AND similarity(p.last_name, $2) > 0.3) \
              OR ($3 <> '' AND similarity(p.first_name, $3) > 0.3) \
              OR p.date_of_birth = $4 \
              OR (length($5) = 10 AND right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10) = $5) \
            ) \
          ORDER BY (COALESCE(similarity(p.first_name || ' ' || p.last_name, $2 || ' ' || $3), 0) \
                    + CASE WHEN p.date_of_birth = $4 THEN 1 ELSE 0 END) DESC \
          LIMIT $6"
    ))
    .bind(tenant_id)
    .bind(q.first_name.trim())
    .bind(q.last_name.trim())
    .bind(q.date_of_birth)
    .bind(&phone10)
    .bind(CANDIDATE_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rank(q, candidates))
}

/// Score, band and order the candidates (pure, so the model is tested
/// without a database).
#[must_use]
pub fn rank(q: &MatchQuery, candidates: Vec<MatchResult>) -> Vec<MatchResult> {
    let typed_name = format!("{} {}", q.first_name, q.last_name);
    let typed = Person {
        name: &typed_name,
        date_of_birth: q.date_of_birth,
        sex: q.sex.as_deref(),
        phone: &q.phone,
    };
    let mut out: Vec<MatchResult> = candidates
        .into_iter()
        .filter_map(|mut c| {
            let name = format!("{} {}", c.first_name, c.last_name);
            let verdict = model::compare(
                &typed,
                &Person {
                    name: &name,
                    date_of_birth: c.date_of_birth,
                    sex: sex_of(c.gender),
                    phone: &c.phone,
                },
            );
            c.band = Some(verdict.band()?);
            c.score = verdict.score();
            c.reasons = verdict.reasons;
            Some(c)
        })
        .collect();
    out.sort_by(|a, b| b.score.total_cmp(&a.score));
    out.truncate(SHOWN_LIMIT);
    out
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use medbrains_core::patient::Gender;
    use uuid::Uuid;

    use super::{MatchBand, MatchQuery, MatchResult, rank};

    fn row(first: &str, last: &str, dob: Option<NaiveDate>, gender: Gender) -> MatchResult {
        MatchResult {
            id: Uuid::new_v4(),
            uhid: "UH-1".to_owned(),
            first_name: first.to_owned(),
            last_name: last.to_owned(),
            date_of_birth: dob,
            phone: "9840012345".to_owned(),
            gender,
            score: 1.0,
            pharmacy_customer: false,
            band: None,
            reasons: Vec::new(),
        }
    }

    /// Given three registered people sharing the family's mobile, When the
    /// desk types "Vijai Kumar", male, born 5 Jan 1990, on that mobile, Then
    /// "Vijay Kumar" with that birth date comes first as likely; his twin
    /// sister Vijaya Kumari and his father, also Vijay Kumar but born 1961,
    /// are shown only for review, with the reasons that tell them apart.
    #[test]
    fn the_same_man_in_another_spelling_ranks_first_and_the_family_is_for_review() {
        let dob = NaiveDate::from_ymd_opt(1990, 1, 5);
        let q = MatchQuery {
            first_name: "Vijai".to_owned(),
            last_name: "Kumar".to_owned(),
            date_of_birth: dob,
            phone: "98400 12345".to_owned(),
            sex: Some("male".to_owned()),
        };
        let ranked = rank(
            &q,
            vec![
                row("Vijaya", "Kumari", dob, Gender::Female),
                row(
                    "Vijay",
                    "Kumar",
                    NaiveDate::from_ymd_opt(1961, 3, 9),
                    Gender::Male,
                ),
                row("Vijay", "Kumar", dob, Gender::Male),
            ],
        );
        assert_eq!(ranked[0].first_name, "Vijay");
        assert_eq!(ranked[0].date_of_birth, dob);
        assert_eq!(ranked[0].band, Some(MatchBand::Likely));
        let sister = ranked.iter().find(|r| r.first_name == "Vijaya");
        assert_eq!(sister.and_then(|r| r.band), Some(MatchBand::Review));
        let father = ranked.iter().find(|r| r.date_of_birth != dob);
        assert_eq!(father.and_then(|r| r.band), Some(MatchBand::Review));
        assert!(father.is_some_and(|f| f.reasons.contains(&"Date of birth differs")));
        assert!(ranked.windows(2).all(|w| w[0].score >= w[1].score));
    }
}
