//! Radiation dose: what each exam gave the patient, and what it adds up to.
//!
//! Ionising radiation is cumulative and stochastic — repeated CT, especially
//! in younger patients, raises lifetime cancer risk — so each new study is
//! justified against the patient's exposure so far (AERB/ICRP). The
//! radiographer records the figures on the order, or the PACS sync reads them
//! from the scanner ([`crate::dose_capture`]); the cumulative CT dose is
//! shown on every new imaging order and in the patient's chart.
//!
//! A figure entered in error is marked so, with a reason, and drops out of
//! the cumulative total; it is never removed.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::radiology::RadiationDoseRecord;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::dose_capture::CapturedDose;

/// Effective-dose conversion factor for body CT: mSv per (mGy·cm) of DLP.
/// 0.015 is the representative adult chest/abdomen/pelvis k-factor; the
/// result is an ESTIMATE, not a measured dose.
const DLP_TO_MSV_K: f64 = 0.015;
/// Cumulative effective dose (mSv) at which further imaging needs explicit
/// justification.
const CUMULATIVE_DOSE_REVIEW_MSV: f64 = 100.0;
const PATIENT_HISTORY_LIMIT: i64 = 200;

fn estimate_effective_msv(total_dlp: f64) -> f64 {
    total_dlp * DLP_TO_MSV_K
}

// ponytail: ceilings catch a slipped decimal point, they are not clinical
// limits — a perfusion CT or a long embolisation legitimately runs high.
const MAX_CTDI_VOL: i64 = 1_000;
const MAX_DLP: i64 = 50_000;
const MAX_DAP: i64 = 10_000;
const MAX_FLUORO_SECONDS: i32 = 6 * 3600;
const MAX_EXPOSURES: i32 = 1_000;
const MAX_KVP: i64 = 150;
const MIN_KVP: i64 = 20;
const MAX_MAS: i64 = 2_000;

#[derive(Debug, Deserialize)]
pub struct RecordDoseRequest {
    /// Defaults to the order's modality.
    pub modality_code: Option<String>,
    pub body_part: Option<String>,
    pub dose_value: Option<Decimal>,
    pub dose_unit: Option<String>,
    /// mGy·cm.
    pub dlp: Option<Decimal>,
    /// mGy.
    pub ctdi_vol: Option<Decimal>,
    /// Gy·cm².
    pub dap: Option<Decimal>,
    pub fluoroscopy_time_seconds: Option<i32>,
    pub exposure_count: Option<i32>,
    pub kvp: Option<Decimal>,
    pub mas: Option<Decimal>,
}

fn check_decimal(value: Option<Decimal>, ceiling: i64, what: &str) -> Result<(), String> {
    match value {
        Some(v) if v.is_sign_negative() => Err(format!("{what} cannot be negative")),
        Some(v) if v > Decimal::from(ceiling) => Err(format!(
            "{what} of {v} is above {ceiling} — check the decimal point"
        )),
        _ => Ok(()),
    }
}

fn check_count(value: Option<i32>, ceiling: i32, what: &str) -> Result<(), String> {
    match value {
        Some(v) if v < 0 => Err(format!("{what} cannot be negative")),
        Some(v) if v > ceiling => Err(format!("{what} of {v} is above {ceiling}")),
        _ => Ok(()),
    }
}

impl RecordDoseRequest {
    /// Why these figures cannot be a dose, if they cannot.
    ///
    /// # Errors
    /// A message for the form.
    pub fn validate(&self) -> Result<(), String> {
        if self.dlp.is_none()
            && self.ctdi_vol.is_none()
            && self.dap.is_none()
            && self.fluoroscopy_time_seconds.is_none()
            && self.dose_value.is_none()
            && self.exposure_count.is_none()
        {
            return Err("Enter at least one dose figure".to_owned());
        }
        check_decimal(self.ctdi_vol, MAX_CTDI_VOL, "CTDIvol (mGy)")?;
        check_decimal(self.dlp, MAX_DLP, "DLP (mGy·cm)")?;
        check_decimal(self.dap, MAX_DAP, "Dose-area product (Gy·cm²)")?;
        check_decimal(self.dose_value, MAX_DLP, "Dose")?;
        check_decimal(self.mas, MAX_MAS, "mAs")?;
        check_decimal(self.kvp, MAX_KVP, "kVp")?;
        if self.kvp.is_some_and(|k| k < Decimal::from(MIN_KVP)) {
            return Err(format!("kVp below {MIN_KVP} is not a diagnostic exposure"));
        }
        check_count(
            self.fluoroscopy_time_seconds,
            MAX_FLUORO_SECONDS,
            "Screening time (s)",
        )?;
        check_count(self.exposure_count, MAX_EXPOSURES, "Number of exposures")
    }
}

#[derive(Debug, Deserialize)]
pub struct CumulativeDoseQuery {
    pub patient_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct CumulativeDoseResult {
    pub study_count: i64,
    pub cumulative_dlp: f64,
    pub estimated_effective_msv: f64,
    pub review_threshold_msv: f64,
    /// True once the estimated cumulative effective dose reaches the review threshold.
    pub over_threshold: bool,
    /// True from 75% of the threshold — approaching, justify carefully.
    pub near_threshold: bool,
}

/// `GET /api/radiology/cumulative-dose?patient_id=` — the patient's recorded
/// CT dose (DLP) and estimated cumulative effective dose against the review
/// threshold.
pub async fn cumulative_dose(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<CumulativeDoseQuery>,
) -> Result<Json<CumulativeDoseResult>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    // A dose history says how often a patient has been imaged and for what.
    medbrains_authz_gate::require_patient_access(&state, &claims, params.patient_id).await?;
    let mut tx = open_tx(&state, &claims).await?;
    let (study_count, total_dlp): (i64, Option<f64>) = sqlx::query_as(
        "SELECT COUNT(DISTINCT order_id), COALESCE(SUM(dlp), 0)::float8 \
           FROM radiation_dose_records \
          WHERE tenant_id = $1 AND patient_id = $2 AND dlp IS NOT NULL AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    let cumulative_dlp = total_dlp.unwrap_or(0.0);
    let estimated_effective_msv = estimate_effective_msv(cumulative_dlp);
    Ok(Json(CumulativeDoseResult {
        study_count,
        cumulative_dlp,
        estimated_effective_msv,
        review_threshold_msv: CUMULATIVE_DOSE_REVIEW_MSV,
        over_threshold: estimated_effective_msv >= CUMULATIVE_DOSE_REVIEW_MSV,
        near_threshold: estimated_effective_msv >= 0.75 * CUMULATIVE_DOSE_REVIEW_MSV,
    }))
}

async fn open_tx<'a>(
    state: &'a AppState,
    claims: &Claims,
) -> Result<Transaction<'a, Postgres>, AppError> {
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    action: &str,
    record: &RadiationDoseRecord,
    reason: Option<&str>,
) -> Result<(), AppError> {
    let values = json!({
        "order_id": record.order_id, "patient_id": record.patient_id,
        "dlp": record.dlp, "ctdi_vol": record.ctdi_vol, "dap": record.dap,
        "fluoroscopy_time_seconds": record.fluoroscopy_time_seconds,
        "exposure_count": record.exposure_count, "reason": reason,
    });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "radiation_dose_record",
            entity_id: Some(record.id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// `POST /api/radiology/orders/{id}/dose` — the radiographer records the dose
/// an exam gave.
pub async fn record_dose(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<RecordDoseRequest>,
) -> Result<Json<RadiationDoseRecord>, AppError> {
    require_permission(&claims, permissions::radiology::dose::RECORD)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        order_id,
    )
    .await?;
    body.validate().map_err(AppError::BadRequest)?;
    let mut tx = open_tx(&state, &claims).await?;
    let (patient_id, order_modality): (Uuid, String) = sqlx::query_as(
        "SELECT o.patient_id, m.code FROM radiology_orders o \
           JOIN radiology_modalities m ON m.id = o.modality_id \
          WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let modality = body
        .modality_code
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
        .unwrap_or(&order_modality);

    let record = sqlx::query_as::<_, RadiationDoseRecord>(
        "INSERT INTO radiation_dose_records \
         (tenant_id, order_id, patient_id, modality_code, body_part, dose_value, dose_unit, \
          dlp, ctdi_vol, dap, fluoroscopy_time_seconds, exposure_count, kvp, mas, \
          source, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'manual', $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .bind(patient_id)
    .bind(modality)
    .bind(&body.body_part)
    .bind(body.dose_value)
    .bind(body.dose_unit.as_deref().unwrap_or("mGy"))
    .bind(body.dlp)
    .bind(body.ctdi_vol)
    .bind(body.dap)
    .bind(body.fluoroscopy_time_seconds)
    .bind(body.exposure_count)
    .bind(body.kvp)
    .bind(body.mas)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    audit(&mut tx, &claims, "radiology.dose.record", &record, None).await?;
    tx.commit().await?;
    Ok(Json(record))
}

#[derive(Debug, Deserialize)]
pub struct EnteredInErrorRequest {
    pub reason: String,
}

/// `POST /api/radiology/dose-records/{id}/entered-in-error` — the figure was
/// wrong. It leaves the cumulative total; the row and the reason are kept.
pub async fn mark_dose_entered_in_error(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EnteredInErrorRequest>,
) -> Result<Json<RadiationDoseRecord>, AppError> {
    require_permission(&claims, permissions::radiology::dose::RECORD)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIATION_DOSE_RECORD,
        id,
    )
    .await?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Say why the dose was entered in error".to_owned(),
        ));
    }
    let mut tx = open_tx(&state, &claims).await?;
    let record = sqlx::query_as::<_, RadiationDoseRecord>(
        "UPDATE radiation_dose_records \
            SET deleted_at = now(), deleted_by = $3, delete_reason = $4 \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(reason)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    audit(
        &mut tx,
        &claims,
        "radiology.dose.entered_in_error",
        &record,
        Some(reason),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(record))
}

/// One exam's dose in the patient's history.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientDoseRow {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub record: RadiationDoseRecord,
    pub accession_number: Option<String>,
    pub exam: Option<String>,
}

/// `GET /api/radiology/patients/{patient_id}/dose-records` — every recorded
/// dose for the patient's chart, newest first.
pub async fn list_patient_dose_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientDoseRow>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = open_tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, PatientDoseRow>(
        "SELECT d.*, o.accession_number, \
                COALESCE(e.name, m.name || COALESCE(' — ' || o.body_part, '')) AS exam \
           FROM radiation_dose_records d \
           JOIN radiology_orders o ON o.id = d.order_id AND o.tenant_id = d.tenant_id \
           JOIN radiology_modalities m ON m.id = o.modality_id \
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
    Ok(Json(rows))
}

/// Store a dose the PACS sync read for a study. A study is captured once per
/// source; nothing is stored when the scanner sent no figures. Returns
/// whether a record was written.
///
/// # Errors
/// Database errors.
pub async fn store_captured(
    tx: &mut Transaction<'_, Postgres>,
    study: &CapturedStudy<'_>,
    dose: &CapturedDose,
    source: &str,
) -> Result<bool, sqlx::Error> {
    if dose.is_empty() {
        return Ok(false);
    }
    let [dlp, ctdi_vol, dap, kvp, mas] = dose.decimals();
    #[allow(clippy::cast_possible_truncation)]
    let fluoro = dose.fluoroscopy_time_seconds.map(|s| s.round() as i32);
    let written = sqlx::query(
        "INSERT INTO radiation_dose_records \
         (tenant_id, order_id, patient_id, modality_code, dlp, ctdi_vol, dap, \
          fluoroscopy_time_seconds, exposure_count, kvp, mas, source, dicom_study_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         ON CONFLICT (tenant_id, dicom_study_id, source) \
           WHERE dicom_study_id IS NOT NULL AND deleted_at IS NULL DO NOTHING",
    )
    .bind(study.tenant_id)
    .bind(study.order_id)
    .bind(study.patient_id)
    .bind(study.modality)
    .bind(dlp)
    .bind(ctdi_vol)
    .bind(dap)
    .bind(fluoro)
    .bind(dose.exposure_count)
    .bind(kvp)
    .bind(mas)
    .bind(source)
    .bind(study.dicom_study_id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    Ok(written > 0)
}

/// Which order, patient and study an automatic dose belongs to.
#[derive(Debug)]
pub struct CapturedStudy<'a> {
    pub tenant_id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub dicom_study_id: Uuid,
    pub modality: &'a str,
}

#[cfg(test)]
mod tests {
    use super::{RecordDoseRequest, estimate_effective_msv};
    use rust_decimal::Decimal;

    fn empty() -> RecordDoseRequest {
        RecordDoseRequest {
            modality_code: None,
            body_part: None,
            dose_value: None,
            dose_unit: None,
            dlp: None,
            ctdi_vol: None,
            dap: None,
            fluoroscopy_time_seconds: None,
            exposure_count: None,
            kvp: None,
            mas: None,
        }
    }

    #[test]
    fn dlp_converts_to_msv() {
        // 1000 mGy·cm * 0.015 = 15 mSv (a couple of abdominal CTs).
        assert!((estimate_effective_msv(1000.0) - 15.0).abs() < 1e-9);
        assert!(estimate_effective_msv(7000.0) >= 100.0);
        assert!(estimate_effective_msv(5000.0) < 100.0);
    }

    #[test]
    fn a_dose_needs_a_figure_and_a_plausible_one() {
        assert!(empty().validate().is_err());
        let ct = RecordDoseRequest {
            dlp: Some(Decimal::from(812)),
            ctdi_vol: Some(Decimal::new(149, 1)),
            ..empty()
        };
        assert!(ct.validate().is_ok());
        let slipped = RecordDoseRequest {
            dlp: Some(Decimal::from(81_200)),
            ..empty()
        };
        assert!(slipped.validate().unwrap_err().contains("decimal point"));
        let negative = RecordDoseRequest {
            dap: Some(Decimal::from(-1)),
            ..empty()
        };
        assert!(negative.validate().is_err());
        let xray = RecordDoseRequest {
            exposure_count: Some(2),
            kvp: Some(Decimal::from(8)),
            ..empty()
        };
        assert!(xray.validate().is_err(), "8 kVp is not an exposure");
    }
}
