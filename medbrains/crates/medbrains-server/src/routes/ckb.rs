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
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{require_any_permission, require_permission},
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

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DrugReference {
    pub generic_name: String,
    pub inn_name: Option<String>,
    pub atc_code: Option<String>,
    pub max_dose_per_day: Option<String>,
    pub max_single_dose: Option<String>,
    pub dose_per_kg: Option<String>,
    pub renal_adjust_egfr_threshold: Option<f64>,
    pub renal_adjust_rule: Option<String>,
    pub hepatic_caution: Option<String>,
    pub pregnancy_category: Option<String>,
    pub brands: Option<String>,
    pub is_nlem: bool,
}

/// GET /api/ckb/formulary — search the global CDS drug reference.
pub async fn list_formulary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DiseaseSearchQuery>,
) -> Result<Json<Vec<DrugReference>>, AppError> {
    require_permission(&claims, "ckb.view")?;
    let pattern = format!("%{}%", q.q.unwrap_or_default().trim().to_lowercase());
    let rows = sqlx::query_as::<_, DrugReference>(
        "SELECT generic_name, inn_name, atc_code, max_dose_per_day, max_single_dose, \
                dose_per_kg, renal_adjust_egfr_threshold::float8, renal_adjust_rule, \
                hepatic_caution, pregnancy_category, brands, is_nlem \
         FROM cds_drug_reference \
         WHERE lower(generic_name) LIKE $1 OR lower(coalesce(brands, '')) LIKE $1 \
         ORDER BY generic_name LIMIT 500",
    )
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LabReference {
    pub test: Option<String>,
    pub analyte: String,
    pub unit: Option<String>,
    pub normal_low: Option<f64>,
    pub normal_high: Option<f64>,
    pub critical_low: Option<f64>,
    pub critical_high: Option<f64>,
    pub category: Option<String>,
    pub pregnancy_low: Option<f64>,
    pub pregnancy_high: Option<f64>,
    pub elderly_low: Option<f64>,
    pub elderly_high: Option<f64>,
}

/// GET /api/ckb/nlem-generics — lowercased NLEM (government-essential) generic
/// names, for prescribing / substitution suggestions.
pub async fn list_nlem_generics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<String>>, AppError> {
    require_any_permission(
        &claims,
        &["ckb.view", "pharmacy.dispensing.create", "pharmacy.prescriptions.list", "opd.visit.update"],
    )?;
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT lower(generic_name) FROM cds_drug_reference WHERE is_nlem ORDER BY generic_name",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// GET /api/ckb/lab-reference — search the global lab analyte reference.
pub async fn list_lab_reference(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DiseaseSearchQuery>,
) -> Result<Json<Vec<LabReference>>, AppError> {
    require_permission(&claims, "ckb.view")?;
    let pattern = format!("%{}%", q.q.unwrap_or_default().trim().to_lowercase());
    let rows = sqlx::query_as::<_, LabReference>(
        "SELECT test, analyte, unit, normal_low::float8, normal_high::float8, \
                critical_low::float8, critical_high::float8, category, \
                pregnancy_low::float8, pregnancy_high::float8, \
                elderly_low::float8, elderly_high::float8 \
         FROM cds_lab_reference \
         WHERE lower(analyte) LIKE $1 OR lower(coalesce(test, '')) LIKE $1 \
         ORDER BY analyte LIMIT 500",
    )
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StateScheme {
    pub state_code: String,
    pub state_name: String,
    pub scheme_name: String,
    pub coverage: String,
    pub drug_count: i64,
}

/// GET /api/ckb/state-schemes — the distinct government free/subsidised
/// medicine schemes, with the count of covered generics (for the selector).
pub async fn list_state_schemes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<StateScheme>>, AppError> {
    require_permission(&claims, "ckb.view")?;
    let rows = sqlx::query_as::<_, StateScheme>(
        "SELECT state_code, state_name, scheme_name, coverage, count(*)::int8 AS drug_count \
         FROM cds_state_formulary \
         GROUP BY state_code, state_name, scheme_name, coverage \
         ORDER BY state_name",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StateFormularyRow {
    pub generic_name: String,
    pub scheme_name: String,
    pub coverage: String,
}

#[derive(Debug, Deserialize)]
pub struct StateFormularyQuery {
    pub state: String,
}

/// GET /api/ckb/state-formulary?state=TN — generics free/subsidised under a
/// state's government scheme. Used for "free under <state> scheme" hints.
pub async fn list_state_formulary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StateFormularyQuery>,
) -> Result<Json<Vec<StateFormularyRow>>, AppError> {
    require_any_permission(
        &claims,
        &["ckb.view", "pharmacy.dispensing.create", "pharmacy.prescriptions.list", "opd.visit.update"],
    )?;
    let rows = sqlx::query_as::<_, StateFormularyRow>(
        "SELECT generic_name, scheme_name, coverage FROM cds_state_formulary \
         WHERE upper(state_code) = upper($1) ORDER BY generic_name",
    )
    .bind(q.state.trim())
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
