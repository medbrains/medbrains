//! The duplicate check: is this person already registered? Run by the
//! registration desk (`POST /api/patients/match`) and by the storefront
//! before it makes a pharmacy-customer record, so a returning patient is
//! matched, never registered twice.

use chrono::NaiveDate;
use medbrains_core::patient::Gender;
use medbrains_server_core::error::AppError;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// A score at or above this is a likely match; an exact phone always is.
pub const MATCH_THRESHOLD: f64 = 0.55;
/// Candidates scored, at most.
const CANDIDATE_LIMIT: i64 = 20;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MatchResult {
    pub id: Uuid,
    pub uhid: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: String,
    pub gender: Gender,
    pub score: f64,
    /// A light record from the online pharmacy: the desk completes it into a
    /// full registration rather than making a second one.
    pub pharmacy_customer: bool,
}

#[derive(Debug, Default)]
pub struct MatchQuery {
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: String,
}

/// Likely matches on name, date of birth and phone (pg_trgm similarity),
/// best first.
pub async fn fuzzy_matches(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    q: &MatchQuery,
) -> Result<Vec<MatchResult>, AppError> {
    let rows = sqlx::query_as::<_, MatchResult>(
        "SELECT id, uhid, first_name, last_name, date_of_birth, phone, gender, \
         ( \
           COALESCE(similarity(first_name, $2), 0) * 0.3 + \
           COALESCE(similarity(last_name, $3), 0) * 0.3 + \
           CASE WHEN date_of_birth = $4 THEN 0.25 ELSE 0.0 END + \
           CASE WHEN phone = $5 THEN 0.15 ELSE 0.0 END \
         )::float8 AS score, pharmacy_customer \
         FROM patients \
         WHERE tenant_id = $1 \
           AND is_merged = false \
           AND is_active = true \
           AND ( \
             similarity(first_name, $2) > 0.3 \
             OR similarity(last_name, $3) > 0.3 \
             OR date_of_birth = $4 \
             OR phone = $5 \
           ) \
         ORDER BY score DESC \
         LIMIT $6",
    )
    .bind(tenant_id)
    .bind(&q.first_name)
    .bind(&q.last_name)
    .bind(q.date_of_birth)
    .bind(&q.phone)
    .bind(CANDIDATE_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .filter(|m| m.score >= MATCH_THRESHOLD || (!q.phone.is_empty() && m.phone == q.phone))
        .collect())
}
