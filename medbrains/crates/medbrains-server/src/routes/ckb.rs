//! Clinical Knowledge Base (CKB) — the clinical-intelligence hub. PR1 ships the
//! statutory notifiable-disease surface: a global diagnosis reference and the
//! tenant report worklist, plus `flag_notifiable_diagnosis` — the single,
//! AI-pluggable hook the diagnosis-create path calls to reach a reporting
//! conclusion. Future detectors (dose, interaction, ingredient chemistry, lab
//! criticals) attach the same way.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DiagnosisReference {
    pub icd10_code: String,
    pub name: String,
    pub department: Option<String>,
    pub is_notifiable: bool,
    pub reporting_body: Option<String>,
    pub report_timeframe: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NotifiableReport {
    pub id: Uuid,
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub icd10_code: String,
    pub disease_name: String,
    pub reporting_body: Option<String>,
    pub detected_at: DateTime<Utc>,
    pub status: String,
    pub report_ref: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DiseaseSearchQuery {
    pub q: Option<String>,
    /// When true, only notifiable diagnoses are returned.
    pub notifiable_only: Option<bool>,
}

/// GET /api/ckb/diagnoses — search the global diagnosis reference.
pub async fn list_diagnoses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DiseaseSearchQuery>,
) -> Result<Json<Vec<DiagnosisReference>>, AppError> {
    require_permission(&claims, "ckb.view")?;
    let pattern = format!("%{}%", q.q.unwrap_or_default().trim().to_lowercase());
    let notifiable_only = q.notifiable_only.unwrap_or(false);
    // Global reference table (no RLS) — query the pool directly.
    let rows = sqlx::query_as::<_, DiagnosisReference>(
        "SELECT icd10_code, name, department, is_notifiable, reporting_body, report_timeframe \
         FROM cds_diagnosis_reference \
         WHERE (NOT $1 OR is_notifiable) \
           AND (lower(name) LIKE $2 OR lower(icd10_code) LIKE $2) \
         ORDER BY is_notifiable DESC, name LIMIT 500",
    )
    .bind(notifiable_only)
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReportListQuery {
    pub status: Option<String>,
}

/// GET /api/ckb/notifiable-reports — the tenant statutory report worklist.
pub async fn list_notifiable_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ReportListQuery>,
) -> Result<Json<Vec<NotifiableReport>>, AppError> {
    require_permission(&claims, "ckb.reports.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, NotifiableReport>(
        "SELECT id, patient_id, encounter_id, icd10_code, disease_name, reporting_body, \
                detected_at, status, report_ref, submitted_at, notes \
         FROM notifiable_disease_reports \
         WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) \
         ORDER BY detected_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateReportRequest {
    /// "submitted" or "exempted".
    pub status: String,
    pub report_ref: Option<String>,
    pub notes: Option<String>,
}

/// PUT /api/ckb/notifiable-reports/{id} — mark a report submitted/exempted.
pub async fn update_notifiable_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReportRequest>,
) -> Result<Json<NotifiableReport>, AppError> {
    require_permission(&claims, "ckb.reports.manage")?;
    if !["submitted", "exempted"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Status must be submitted or exempted.".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, NotifiableReport>(
        "UPDATE notifiable_disease_reports \
         SET status = $1, report_ref = $2, notes = COALESCE($3, notes), \
             submitted_by = $4, submitted_at = now(), updated_at = now() \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING id, patient_id, encounter_id, icd10_code, disease_name, reporting_body, \
                   detected_at, status, report_ref, submitted_at, notes",
    )
    .bind(&body.status)
    .bind(body.report_ref.as_deref())
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The clinical-conclusion hook. Looks up a diagnosis in the global reference;
/// if it is statutorily notifiable, files a pending report (idempotent per
/// encounter+code) and returns `(disease_name, reporting_body)` so the caller
/// raises the notification. Returns `None` when not reportable. This is the
/// single seam an AI clinical-reasoner can later own/augment.
pub async fn flag_notifiable_diagnosis(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Option<Uuid>,
    encounter_id: Option<Uuid>,
    detected_by: Option<Uuid>,
    icd_code: &str,
) -> Result<Option<(String, Option<String>)>, AppError> {
    let code = icd_code.trim();
    if code.is_empty() {
        return Ok(None);
    }
    // Match exact code or a parent prefix (e.g. "A90.1" → "A90"). Global table.
    let reference = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, reporting_body FROM cds_diagnosis_reference \
         WHERE is_notifiable AND ($1 = icd10_code OR $1 LIKE icd10_code || '%') \
         ORDER BY length(icd10_code) DESC LIMIT 1",
    )
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((disease_name, reporting_body)) = reference else {
        return Ok(None);
    };

    sqlx::query(
        "INSERT INTO notifiable_disease_reports \
           (tenant_id, patient_id, encounter_id, icd10_code, disease_name, reporting_body, \
            detected_by, status) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') \
         ON CONFLICT (tenant_id, encounter_id, icd10_code) WHERE encounter_id IS NOT NULL \
         DO NOTHING",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(encounter_id)
    .bind(code)
    .bind(&disease_name)
    .bind(reporting_body.as_deref())
    .bind(detected_by)
    .execute(&mut **tx)
    .await?;

    Ok(Some((disease_name, reporting_body)))
}
