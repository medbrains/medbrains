//! What a patient's recorded radiation adds up to: the cumulative CT
//! estimate shown on every new imaging order, and the per-exam history in the
//! chart. Conversion is in [`crate::effective_dose`].
//!
//! One exam can hold figures from more than one source — the scanner's RDSR,
//! a radiographer's entry, image headers. They describe the same exposure, so
//! per exam the best source counts (RDSR, then entered, then headers) and the
//! others are not added on top.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_core::radiology::RadiationDoseRecord;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dose::open_tx;
use crate::effective_dose::{METHOD, NotEstimated, Region, estimate_msv, region_of};

/// Estimated cumulative effective dose (mSv) at which further ionising
/// imaging needs explicit justification.
const REVIEW_MSV: f64 = 100.0;
const NEAR_FRACTION: f64 = 0.75;
const PATIENT_HISTORY_LIMIT: i64 = 200;
/// Exams read for one patient's total; far beyond any real history.
const MAX_EXAM_ROWS: i64 = 2_000;

/// One exam's figures from one source.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ExamSource {
    pub order_id: Uuid,
    pub source: String,
    pub dlp: Option<f64>,
    pub dap: Option<f64>,
    pub on_date: NaiveDate,
    pub dose_body_part: Option<String>,
    pub order_body_part: Option<String>,
    pub exam_name: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
}

fn rank(source: &str) -> u8 {
    match source {
        "rdsr" => 0,
        "manual" => 1,
        _ => 2,
    }
}

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct CumulativeDoseResult {
    /// CT exams with a DLP on record.
    pub ct_exam_count: usize,
    pub cumulative_dlp: f64,
    /// Sum over the CT exams that could be estimated.
    pub estimated_effective_msv: f64,
    pub estimated_exam_count: usize,
    /// CT exams whose region is not one with a conversion factor.
    pub not_estimated_region_unknown: usize,
    /// CT exams for a patient whose age is not on record.
    pub not_estimated_age_unknown: usize,
    /// Fluoroscopy and radiograph dose-area product, not converted.
    pub dap_total_gy_cm2: f64,
    pub dap_exam_count: usize,
    pub review_threshold_msv: f64,
    pub over_threshold: bool,
    pub near_threshold: bool,
    pub method: &'static str,
}

fn region(row: &ExamSource) -> Option<Region> {
    region_of(&[
        row.dose_body_part.as_deref(),
        row.order_body_part.as_deref(),
        row.exam_name.as_deref(),
    ])
}

/// Add up a patient's exams, one figure per exam from its best source.
#[must_use]
pub fn summarize(rows: &[ExamSource]) -> CumulativeDoseResult {
    let mut ct_exams: HashMap<Uuid, &ExamSource> = HashMap::new();
    let mut fluoro_exams: HashMap<Uuid, f64> = HashMap::new();
    let mut by_rank: Vec<&ExamSource> = rows.iter().collect();
    by_rank.sort_by_key(|r| rank(&r.source));
    for row in by_rank {
        if row.dlp.is_some() {
            ct_exams.entry(row.order_id).or_insert(row);
        }
        if let Some(dap) = row.dap {
            fluoro_exams.entry(row.order_id).or_insert(dap);
        }
    }
    let mut out = CumulativeDoseResult {
        review_threshold_msv: REVIEW_MSV,
        method: METHOD,
        ct_exam_count: ct_exams.len(),
        dap_exam_count: fluoro_exams.len(),
        dap_total_gy_cm2: fluoro_exams.values().sum(),
        ..CumulativeDoseResult::default()
    };
    for row in ct_exams.values() {
        let dlp = row.dlp.unwrap_or_default();
        out.cumulative_dlp += dlp;
        match estimate_msv(dlp, region(row), row.date_of_birth, row.on_date) {
            Ok(msv) => {
                out.estimated_effective_msv += msv;
                out.estimated_exam_count += 1;
            }
            Err(NotEstimated::RegionUnknown) => out.not_estimated_region_unknown += 1,
            Err(NotEstimated::AgeUnknown) => out.not_estimated_age_unknown += 1,
        }
    }
    out.over_threshold = out.estimated_effective_msv >= REVIEW_MSV;
    out.near_threshold = out.estimated_effective_msv >= NEAR_FRACTION * REVIEW_MSV;
    out
}

#[derive(Debug, Deserialize)]
pub struct CumulativeDoseQuery {
    pub patient_id: Uuid,
}

/// `GET /api/radiology/cumulative-dose?patient_id=` — the patient's
/// estimated cumulative effective dose from CT, what could not be estimated,
/// and fluoroscopy DAP, against the review threshold.
pub async fn cumulative_dose(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<CumulativeDoseQuery>,
) -> Result<Json<CumulativeDoseResult>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    // A dose history says how often a patient has been imaged and for what.
    medbrains_authz_gate::require_patient_access(&state, &claims, params.patient_id).await?;
    let mut tx = open_tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, ExamSource>(
        "SELECT d.order_id, d.source, SUM(d.dlp)::float8 AS dlp, SUM(d.dap)::float8 AS dap, \
                MIN(d.recorded_at)::date AS on_date, MAX(d.body_part) AS dose_body_part, \
                o.body_part AS order_body_part, e.name AS exam_name, p.date_of_birth \
           FROM radiation_dose_records d \
           JOIN radiology_orders o ON o.id = d.order_id AND o.tenant_id = d.tenant_id \
           JOIN patients p ON p.id = d.patient_id AND p.tenant_id = d.tenant_id \
           LEFT JOIN radiology_exams e ON e.id = o.exam_id \
          WHERE d.tenant_id = $1 AND d.patient_id = $2 AND d.deleted_at IS NULL \
          GROUP BY d.order_id, d.source, o.body_part, e.name, p.date_of_birth \
          LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .bind(MAX_EXAM_ROWS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(summarize(&rows)))
}

#[derive(Debug, sqlx::FromRow)]
struct HistoryRow {
    #[sqlx(flatten)]
    record: RadiationDoseRecord,
    accession_number: Option<String>,
    exam: Option<String>,
    exam_name: Option<String>,
    order_body_part: Option<String>,
    date_of_birth: Option<NaiveDate>,
}

/// One exam's dose in the patient's history, with its estimate.
#[derive(Debug, Serialize)]
pub struct PatientDoseRow {
    #[serde(flatten)]
    pub record: RadiationDoseRecord,
    pub accession_number: Option<String>,
    pub exam: Option<String>,
    /// The region the estimate used.
    pub region: Option<&'static str>,
    /// mSv; `None` when there is no DLP or it could not be estimated.
    pub estimated_msv: Option<f64>,
    /// `region_unknown` or `age_unknown` when a DLP could not be estimated.
    pub not_estimated: Option<&'static str>,
}

impl From<HistoryRow> for PatientDoseRow {
    fn from(row: HistoryRow) -> Self {
        let region = region_of(&[
            row.record.body_part.as_deref(),
            row.order_body_part.as_deref(),
            row.exam_name.as_deref(),
        ]);
        let estimate = row.record.dlp.map(|dlp| {
            let dlp = dlp.to_f64().unwrap_or_default();
            estimate_msv(
                dlp,
                region,
                row.date_of_birth,
                row.record.recorded_at.date_naive(),
            )
        });
        Self {
            region: region.map(Region::label),
            estimated_msv: estimate.and_then(Result::ok),
            not_estimated: match estimate {
                Some(Err(NotEstimated::RegionUnknown)) => Some("region_unknown"),
                Some(Err(NotEstimated::AgeUnknown)) => Some("age_unknown"),
                _ => None,
            },
            record: row.record,
            accession_number: row.accession_number,
            exam: row.exam,
        }
    }
}

/// `GET /api/radiology/patients/{patient_id}/dose-records` — every recorded
/// dose for the patient's chart, newest first, each with its estimate.
pub async fn list_patient_dose_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientDoseRow>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = open_tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, HistoryRow>(
        "SELECT d.*, o.accession_number, o.body_part AS order_body_part, \
                e.name AS exam_name, p.date_of_birth, \
                COALESCE(e.name, m.name || COALESCE(' — ' || o.body_part, '')) AS exam \
           FROM radiation_dose_records d \
           JOIN radiology_orders o ON o.id = d.order_id AND o.tenant_id = d.tenant_id \
           JOIN radiology_modalities m ON m.id = o.modality_id \
           JOIN patients p ON p.id = d.patient_id AND p.tenant_id = d.tenant_id \
           LEFT JOIN radiology_exams e ON e.id = o.exam_id \
          WHERE d.tenant_id = $1 AND d.patient_id = $2 AND d.deleted_at IS NULL \
          ORDER BY d.recorded_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(PATIENT_HISTORY_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows.into_iter().map(PatientDoseRow::from).collect()))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn row(order: u128, source: &str, dlp: Option<f64>, body: &str) -> ExamSource {
        ExamSource {
            order_id: Uuid::from_u128(order),
            source: source.to_owned(),
            dlp,
            dap: None,
            on_date: NaiveDate::from_ymd_opt(2026, 10, 26).unwrap(),
            dose_body_part: None,
            order_body_part: Some(body.to_owned()),
            exam_name: None,
            date_of_birth: NaiveDate::from_ymd_opt(1980, 3, 9),
        }
    }

    #[test]
    fn a_head_and_an_abdomen_with_the_same_dlp_are_not_the_same_dose() {
        let out = summarize(&[
            row(1, "manual", Some(1000.0), "Head"),
            row(2, "manual", Some(1000.0), "Abdomen"),
        ]);
        assert!(
            (out.estimated_effective_msv - 17.1).abs() < 1e-9,
            "2.1 + 15.0: {out:?}"
        );
        assert_eq!((out.ct_exam_count, out.estimated_exam_count), (2, 2));
        assert!((out.cumulative_dlp - 2000.0).abs() < 1e-9);
    }

    #[test]
    fn an_unknown_region_is_reported_not_counted_as_zero() {
        let out = summarize(&[
            row(1, "manual", Some(900.0), "Left knee"),
            row(2, "manual", Some(1000.0), "Chest"),
        ]);
        assert_eq!(out.not_estimated_region_unknown, 1);
        assert_eq!(out.estimated_exam_count, 1);
        assert!((out.estimated_effective_msv - 14.0).abs() < 1e-9);
        let mut no_age = row(3, "manual", Some(500.0), "Chest");
        no_age.date_of_birth = None;
        assert_eq!(summarize(&[no_age]).not_estimated_age_unknown, 1);
    }

    #[test]
    fn the_scanners_report_wins_over_an_entry_for_the_same_exam() {
        let out = summarize(&[
            row(1, "manual", Some(800.0), "Chest"),
            row(1, "rdsr", Some(812.4), "Chest"),
        ]);
        assert_eq!(out.ct_exam_count, 1, "one exam, not two");
        assert!((out.cumulative_dlp - 812.4).abs() < 1e-9);
    }

    #[test]
    fn the_review_level_applies_to_the_estimate() {
        let many: Vec<_> = (0..7)
            .map(|i| row(i, "rdsr", Some(1000.0), "Abdomen and pelvis"))
            .collect();
        let out = summarize(&many);
        assert!(out.over_threshold && out.near_threshold, "7 × 15 mSv = 105");
        let heads: Vec<_> = (0..7)
            .map(|i| row(i, "rdsr", Some(1000.0), "Brain"))
            .collect();
        assert!(!summarize(&heads).near_threshold, "7 head CTs ≈ 15 mSv");
    }

    #[test]
    fn dap_is_totalled_but_not_converted() {
        let mut fluoro = row(9, "rdsr", None, "Barium swallow");
        fluoro.dap = Some(25.3);
        let out = summarize(&[fluoro]);
        assert_eq!((out.dap_exam_count, out.ct_exam_count), (1, 0));
        assert!((out.dap_total_gy_cm2 - 25.3).abs() < 1e-9);
        assert!(out.estimated_effective_msv.abs() < f64::EPSILON);
    }
}
