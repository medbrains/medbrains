//! Diagnostic reference levels (DRLs) and the audit against them.
//!
//! A DRL is not a limit for any one patient. ICRP practice is that a
//! facility compares the MEDIAN dose of a standard exam over a period with
//! the DRL; a median above it means the protocol should be reviewed. India
//! has no national DRL set, so each hospital keeps its own table — seeded
//! from a published regional survey and labelled as such — and the audit
//! reads the doses recorded on orders (by hand, or from the scanner).
//!
//! Only adult CT exams whose region is recognised are compared: DRLs are
//! defined per region for a standard-sized adult.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dose::open_tx;
use crate::effective_dose::{Region, age_column, region_of};

/// Adult column of [`age_column`].
const ADULT: usize = 4;
const MAX_ROWS: i64 = 20_000;
const MAX_LEVELS: i64 = 200;
const MAX_PERIOD_DAYS: i64 = 400;

pub const REGIONS: [(&str, Region); 6] = [
    ("head", Region::Head),
    ("head_neck", Region::HeadNeck),
    ("neck", Region::Neck),
    ("chest", Region::Chest),
    ("abdomen_pelvis", Region::AbdomenPelvis),
    ("trunk", Region::Trunk),
];

fn region_key(region: Region) -> &'static str {
    REGIONS
        .iter()
        .find(|(_, r)| *r == region)
        .map_or("", |(k, _)| k)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Level {
    pub id: Uuid,
    pub region: String,
    pub metric: String,
    pub value: Decimal,
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct LevelRequest {
    pub region: String,
    /// `ctdi_vol` (mGy) or `dlp` (mGy·cm).
    pub metric: String,
    pub value: Decimal,
    pub source: String,
}

/// Median and 75th percentile of a sorted sample (linear interpolation).
#[must_use]
pub fn percentile(sorted: &[f64], p: f64) -> Option<f64> {
    if sorted.is_empty() {
        return None;
    }
    #[allow(clippy::cast_precision_loss)]
    let rank = p * (sorted.len() - 1) as f64;
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let (lo, hi) = (rank.floor() as usize, rank.ceil() as usize);
    let (a, b) = (sorted[lo], sorted[hi]);
    #[allow(clippy::cast_precision_loss)]
    Some((b - a).mul_add(rank - lo as f64, a))
}

/// One adult CT exam's figures, as the audit reads them.
#[derive(Debug, sqlx::FromRow)]
pub struct ExamDose {
    pub ctdi_vol: Option<Decimal>,
    pub dlp: Option<Decimal>,
    pub dose_body_part: Option<String>,
    pub order_body_part: Option<String>,
    pub exam_name: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub on_date: NaiveDate,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct AuditRow {
    pub level_id: Uuid,
    pub region: String,
    pub metric: String,
    pub drl: f64,
    pub source: String,
    pub exams: usize,
    pub median: Option<f64>,
    pub p75: Option<f64>,
    /// `above` (review the protocol), `within`, or `too_few` (under 10 exams).
    pub verdict: &'static str,
}

/// Fewer exams than this make a median worth little.
pub const MIN_EXAMS: usize = 10;

/// Compare each level with the median of the matching adult exams.
#[must_use]
pub fn audit(levels: &[Level], exams: &[ExamDose]) -> Vec<AuditRow> {
    levels
        .iter()
        .map(|level| {
            let mut values: Vec<f64> = exams
                .iter()
                .filter(|e| e.date_of_birth.and_then(|d| age_column(d, e.on_date)) == Some(ADULT))
                .filter(|e| {
                    region_of(&[
                        e.dose_body_part.as_deref(),
                        e.order_body_part.as_deref(),
                        e.exam_name.as_deref(),
                    ])
                    .map(region_key)
                        == Some(level.region.as_str())
                })
                .filter_map(|e| match level.metric.as_str() {
                    "ctdi_vol" => e.ctdi_vol,
                    _ => e.dlp,
                })
                .filter_map(|d| d.to_f64())
                .collect();
            values.sort_by(f64::total_cmp);
            let drl = level.value.to_f64().unwrap_or_default();
            let median = percentile(&values, 0.5);
            let verdict = match median {
                _ if values.len() < MIN_EXAMS => "too_few",
                Some(m) if m > drl => "above",
                _ => "within",
            };
            AuditRow {
                level_id: level.id,
                region: level.region.clone(),
                metric: level.metric.clone(),
                drl,
                source: level.source.clone(),
                exams: values.len(),
                median,
                p75: percentile(&values, 0.75),
                verdict,
            }
        })
        .collect()
}

fn check_level(body: &LevelRequest) -> Result<(), AppError> {
    if !REGIONS.iter().any(|(k, _)| *k == body.region) {
        return Err(AppError::BadRequest("Pick a CT region".to_owned()));
    }
    if !matches!(body.metric.as_str(), "ctdi_vol" | "dlp") {
        return Err(AppError::BadRequest(
            "A level is for CTDIvol or DLP".to_owned(),
        ));
    }
    if body.value <= Decimal::ZERO {
        return Err(AppError::BadRequest("A level is above zero".to_owned()));
    }
    if body.source.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Say where the level comes from (survey, regulator, physicist)".to_owned(),
        ));
    }
    Ok(())
}

/// `GET /api/radiology/drls` — the hospital's reference levels.
pub async fn list_levels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Level>>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    let mut tx = open_tx(&state, &claims).await?;
    let levels = sqlx::query_as::<_, Level>(
        "SELECT id, region, metric, value, source FROM radiology_drls \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY region, metric LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(MAX_LEVELS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(levels))
}

/// `PUT /api/radiology/drls` — set a region's level for one metric.
pub async fn save_level(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<LevelRequest>,
) -> Result<Json<Level>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    check_level(&body)?;
    let mut tx = open_tx(&state, &claims).await?;
    let level = sqlx::query_as::<_, Level>(
        "INSERT INTO radiology_drls (tenant_id, region, metric, value, source, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (tenant_id, region, metric) WHERE deleted_at IS NULL DO UPDATE SET \
           value = EXCLUDED.value, source = EXCLUDED.source, updated_at = now() \
         RETURNING id, region, metric, value, source",
    )
    .bind(claims.tenant_id)
    .bind(&body.region)
    .bind(&body.metric)
    .bind(body.value)
    .bind(body.source.trim())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(level))
}

/// `DELETE /api/radiology/drls/{id}` — stop auditing against a level.
pub async fn remove_level(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    let mut tx = open_tx(&state, &claims).await?;
    let removed = sqlx::query(
        "UPDATE radiology_drls SET deleted_at = now(), deleted_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if removed == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "removed": true })))
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct AuditReport {
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub min_exams: usize,
    pub rows: Vec<AuditRow>,
}

/// `GET /api/radiology/drl-audit?from=&to=` — each level against the median
/// of the period's adult CT exams of that region.
pub async fn drl_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<AuditReport>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    if q.to < q.from || (q.to - q.from).num_days() > MAX_PERIOD_DAYS {
        return Err(AppError::BadRequest(
            "Pick a period of up to about a year".to_owned(),
        ));
    }
    let mut tx = open_tx(&state, &claims).await?;
    let levels = sqlx::query_as::<_, Level>(
        "SELECT id, region, metric, value, source FROM radiology_drls \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY region, metric LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(MAX_LEVELS)
    .fetch_all(&mut *tx)
    .await?;
    // One figure per exam, from its best source (the scanner's report first).
    let exams = sqlx::query_as::<_, ExamDose>(
        "SELECT DISTINCT ON (d.order_id) d.ctdi_vol, d.dlp, d.body_part AS dose_body_part, \
                o.body_part AS order_body_part, e.name AS exam_name, p.date_of_birth, \
                d.recorded_at::date AS on_date \
           FROM radiation_dose_records d \
           JOIN radiology_orders o ON o.id = d.order_id AND o.tenant_id = d.tenant_id \
           JOIN patients p ON p.id = d.patient_id AND p.tenant_id = d.tenant_id \
           LEFT JOIN radiology_exams e ON e.id = o.exam_id \
          WHERE d.tenant_id = $1 AND d.deleted_at IS NULL \
            AND (d.ctdi_vol IS NOT NULL OR d.dlp IS NOT NULL) \
            AND d.recorded_at::date BETWEEN $2 AND $3 \
          ORDER BY d.order_id, \
                   CASE d.source WHEN 'rdsr' THEN 0 WHEN 'manual' THEN 1 ELSE 2 END \
          LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.from)
    .bind(q.to)
    .bind(MAX_ROWS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(AuditReport {
        from: q.from,
        to: q.to,
        min_exams: MIN_EXAMS,
        rows: audit(&levels, &exams),
    }))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn exam(body: &str, dlp: i64) -> ExamDose {
        ExamDose {
            ctdi_vol: None,
            dlp: Some(Decimal::from(dlp)),
            dose_body_part: None,
            order_body_part: Some(body.to_owned()),
            exam_name: None,
            date_of_birth: NaiveDate::from_ymd_opt(1980, 1, 1),
            on_date: NaiveDate::from_ymd_opt(2026, 10, 1).unwrap(),
        }
    }

    fn level(region: &str, value: i64) -> Level {
        Level {
            id: Uuid::nil(),
            region: region.to_owned(),
            metric: "dlp".to_owned(),
            value: Decimal::from(value),
            source: "test".to_owned(),
        }
    }

    #[test]
    fn the_median_is_interpolated() {
        assert_eq!(percentile(&[1.0, 2.0, 3.0, 4.0], 0.5), Some(2.5));
        assert_eq!(percentile(&[5.0], 0.75), Some(5.0));
        assert_eq!(percentile(&[], 0.5), None);
    }

    #[test]
    fn a_median_above_the_level_flags_the_protocol_not_the_patient() {
        // Ten head CTs, median 1100 against a level of 1041: review.
        let mut exams: Vec<_> = (0..10).map(|i| exam("Brain", 1050 + i * 10)).collect();
        // A chest CT and a child's head do not count against the adult head level.
        exams.push(exam("Chest", 5000));
        let mut child = exam("Brain", 9000);
        child.date_of_birth = NaiveDate::from_ymd_opt(2020, 1, 1);
        exams.push(child);
        let rows = audit(&[level("head", 1041)], &exams);
        assert_eq!(rows[0].exams, 10);
        assert_eq!(rows[0].verdict, "above");
        assert!((rows[0].median.unwrap() - 1095.0).abs() < 1e-9);
    }

    #[test]
    fn too_few_exams_make_no_verdict() {
        let rows = audit(&[level("chest", 445)], &[exam("Chest", 900)]);
        assert_eq!((rows[0].exams, rows[0].verdict), (1, "too_few"));
    }
}
