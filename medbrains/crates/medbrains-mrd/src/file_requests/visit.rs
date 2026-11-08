//! The doctor does not wait for the paper.
//!
//! The consultation screen shows where the visit's file is (requested, on
//! the way, arrived, not found) and, beside it, a summary built from the
//! digital record: recent diagnoses, current medicines, allergies and
//! abnormal results. Both are reads of one visit the caller must be able to
//! open; the summary is a patient-data read and is written to the audit chain.
//!
//! The status is cheap and polled; the summary is read once per screen, so a
//! poll does not write an audit row a minute.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::field_access, state::AppState,
};
use serde::Serialize;
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

/// The OPD diagnosis field class (`medbrains-authz` `field_class`: Sensitive).
const OPD_DIAGNOSIS_FIELD: &str = "opd.diagnosis";
/// How far back the summary looks for medicines and results.
const RECENT_DAYS: i32 = 90;

/// The visit's file request, as the chip shows it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VisitFileRequest {
    pub id: Uuid,
    pub status: String,
    pub record_number: String,
    pub requested_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
    pub picked_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
}

/// Whether the patient has a paper file, and the visit's request for it.
/// A file with no request reads "not requested", never "no file".
#[derive(Debug, Serialize)]
pub struct VisitFileStatus {
    pub has_physical_file: bool,
    pub request: Option<VisitFileRequest>,
}

/// `GET /api/mrd/file-requests/by-encounter/{encounter_id}` — the chip.
pub async fn visit_file_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<VisitFileStatus>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::STATUS)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let patient = encounter_patient(&mut tx, claims.tenant_id, encounter_id).await?;
    let has_physical_file: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM public.mrd_current_file($1, $2))")
            .bind(claims.tenant_id)
            .bind(patient)
            .fetch_one(&mut *tx)
            .await?;
    let request = sqlx::query_as::<_, VisitFileRequest>(
        "SELECT f.id, f.status, r.record_number, f.requested_at, f.due_at, f.picked_at, \
                f.delivered_at \
           FROM mrd_file_requests f \
           JOIN mrd_medical_records r ON r.id = f.medical_record_id AND r.tenant_id = f.tenant_id \
          WHERE f.tenant_id = $1 AND f.encounter_id = $2 AND f.deleted_at IS NULL \
          ORDER BY f.status = 'cancelled', f.created_at DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(VisitFileStatus {
        has_physical_file,
        request,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryAllergy {
    pub allergen_name: String,
    pub reaction: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryDiagnosis {
    pub description: String,
    pub icd_code: Option<String>,
    pub encounter_date: NaiveDate,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryMedicine {
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub prescribed_on: NaiveDate,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryResult {
    pub test_name: String,
    pub parameter_name: String,
    pub value: String,
    pub unit: Option<String>,
    pub flag: Option<String>,
    pub is_critical: bool,
    pub resulted_on: NaiveDate,
}

/// What the doctor can read before the file comes.
#[derive(Debug, Serialize)]
pub struct DigitalSummary {
    pub allergies: Vec<SummaryAllergy>,
    pub diagnoses: Vec<SummaryDiagnosis>,
    /// The caller's role may not read OPD diagnoses: they exist (the count)
    /// but are withheld, as on every other screen.
    pub diagnoses_withheld: Option<i64>,
    pub medicines: Vec<SummaryMedicine>,
    pub abnormal_results: Vec<SummaryResult>,
}

/// Whether the caller's role may read OPD diagnoses in full.
fn diagnoses_readable(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    !matches!(
        restricted.get(OPD_DIAGNOSIS_FIELD),
        Some(FieldAccessLevel::Hidden | FieldAccessLevel::Mask)
    )
}

/// `GET /api/mrd/file-requests/by-encounter/{encounter_id}/summary` — the
/// digital summary card. Audited.
pub async fn visit_digital_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<DigitalSummary>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::STATUS)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let patient = encounter_patient(&mut tx, claims.tenant_id, encounter_id).await?;
    let (diagnoses, diagnoses_withheld) = if diagnoses_readable(&restricted) {
        (
            recent_diagnoses(&mut tx, claims.tenant_id, patient, encounter_id).await?,
            None,
        )
    } else {
        let n = count_diagnoses(&mut tx, claims.tenant_id, patient, encounter_id).await?;
        (Vec::new(), Some(n))
    };
    let summary = DigitalSummary {
        allergies: allergies(&mut tx, claims.tenant_id, patient).await?,
        diagnoses,
        diagnoses_withheld,
        medicines: current_medicines(&mut tx, claims.tenant_id, patient).await?,
        abnormal_results: abnormal_results(&mut tx, claims.tenant_id, patient).await?,
    };
    let values = json!({ "encounter_id": encounter_id });
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "view_digital_file_summary",
            entity_type: "patients",
            entity_id: Some(patient),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(summary))
}

/// The visit's patient; another tenant's or a missing visit is 404.
async fn encounter_patient(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<Uuid, AppError> {
    sqlx::query_scalar(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(encounter_id)
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// Active allergies, most severe first.
async fn allergies(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
) -> Result<Vec<SummaryAllergy>, AppError> {
    Ok(sqlx::query_as::<_, SummaryAllergy>(
        "SELECT allergen_name, reaction, severity::text AS severity FROM patient_allergies \
          WHERE tenant_id = $1 AND patient_id = $2 AND is_active AND deleted_at IS NULL \
          ORDER BY severity DESC NULLS LAST, allergen_name LIMIT 20",
    )
    .bind(tenant_id)
    .bind(patient)
    .fetch_all(conn)
    .await?)
}

/// Diagnoses from the patient's earlier visits, newest first.
async fn recent_diagnoses(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
    encounter_id: Uuid,
) -> Result<Vec<SummaryDiagnosis>, AppError> {
    Ok(sqlx::query_as::<_, SummaryDiagnosis>(
        "SELECT d.description, d.icd_code, e.encounter_date FROM diagnoses d \
           JOIN encounters e ON e.id = d.encounter_id AND e.tenant_id = d.tenant_id \
          WHERE d.tenant_id = $1 AND e.patient_id = $2 AND e.id <> $3 \
            AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
          ORDER BY e.encounter_date DESC, d.is_primary DESC LIMIT 8",
    )
    .bind(tenant_id)
    .bind(patient)
    .bind(encounter_id)
    .fetch_all(conn)
    .await?)
}

/// How many earlier diagnoses there are, for a role that may not read them.
async fn count_diagnoses(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
    encounter_id: Uuid,
) -> Result<i64, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT COUNT(*) FROM diagnoses d \
           JOIN encounters e ON e.id = d.encounter_id AND e.tenant_id = d.tenant_id \
          WHERE d.tenant_id = $1 AND e.patient_id = $2 AND e.id <> $3 \
            AND d.deleted_at IS NULL AND e.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient)
    .bind(encounter_id)
    .fetch_one(conn)
    .await?)
}

/// Active prescription items from the last [`RECENT_DAYS`] days.
// ponytail: "current" is active and recent; a course's duration is free text,
// so a finished five-day course still shows until it ages out.
async fn current_medicines(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
) -> Result<Vec<SummaryMedicine>, AppError> {
    Ok(sqlx::query_as::<_, SummaryMedicine>(
        "SELECT i.drug_name, i.dosage, i.frequency, i.duration, p.created_at::date AS prescribed_on \
           FROM prescription_items i \
           JOIN prescriptions p ON p.id = i.prescription_id AND p.tenant_id = i.tenant_id \
           JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
          WHERE i.tenant_id = $1 AND e.patient_id = $2 AND i.item_status = 'active' \
            AND i.deleted_at IS NULL AND p.deleted_at IS NULL \
            AND (i.end_date IS NULL OR i.end_date >= CURRENT_DATE) \
            AND p.created_at > now() - make_interval(days => $3) \
          ORDER BY p.created_at DESC LIMIT 15",
    )
    .bind(tenant_id)
    .bind(patient)
    .bind(RECENT_DAYS)
    .fetch_all(conn)
    .await?)
}

/// Abnormal or critical results from the last [`RECENT_DAYS`] days, on
/// reports that were completed or verified.
async fn abnormal_results(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
) -> Result<Vec<SummaryResult>, AppError> {
    Ok(sqlx::query_as::<_, SummaryResult>(
        "SELECT t.name AS test_name, r.parameter_name, r.value, r.unit, r.flag::text AS flag, \
                r.is_critical, r.created_at::date AS resulted_on \
           FROM lab_results r \
           JOIN lab_orders o ON o.id = r.order_id AND o.tenant_id = r.tenant_id \
           JOIN lab_test_catalog t ON t.id = o.test_id \
          WHERE r.tenant_id = $1 AND o.patient_id = $2 \
            AND o.status IN ('completed', 'verified') \
            AND r.deleted_at IS NULL AND o.deleted_at IS NULL \
            AND (r.is_abnormal OR r.is_critical OR r.flag::text <> 'normal') \
            AND r.created_at > now() - make_interval(days => $3) \
          ORDER BY r.is_critical DESC, r.created_at DESC LIMIT 10",
    )
    .bind(tenant_id)
    .bind(patient)
    .bind(RECENT_DAYS)
    .fetch_all(conn)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::{FieldAccessLevel, HashMap, OPD_DIAGNOSIS_FIELD, diagnoses_readable};

    #[test]
    fn a_masked_or_hidden_diagnosis_is_withheld_from_the_summary() {
        let mut restricted = HashMap::new();
        assert!(diagnoses_readable(&restricted));
        restricted.insert(OPD_DIAGNOSIS_FIELD.to_owned(), FieldAccessLevel::Mask);
        assert!(!diagnoses_readable(&restricted));
        restricted.insert(OPD_DIAGNOSIS_FIELD.to_owned(), FieldAccessLevel::Hidden);
        assert!(!diagnoses_readable(&restricted));
        restricted.insert(OPD_DIAGNOSIS_FIELD.to_owned(), FieldAccessLevel::View);
        assert!(diagnoses_readable(&restricted));
    }
}
