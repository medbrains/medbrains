//! The doctor does not wait for the paper: a summary from the digital record.
//!
//! Recent diagnoses, current medicines, allergies and abnormal results for
//! the patient of one visit the caller can open. It is a clinical read, so it
//! takes the permissions the patient's diagnosis list takes
//! (`opd.diagnoses.list` and `patients.view`), not the file chip's. It is
//! written to the audit chain. Mental-health diagnoses the viewer may not see
//! (MHCA 2017 s.23) are tombstoned exactly as on the diagnosis list, and a
//! role whose OPD diagnosis field is masked or hidden gets a count only.
//! Every list says how many it left out.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_authz_gate::mental_health::{self as mental_health, MentalHealthViewer};
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

use super::visit::{encounter_patient, open_encounter};

/// The OPD diagnosis field class (`medbrains-authz` `field_class`: Sensitive).
const OPD_DIAGNOSIS_FIELD: &str = "opd.diagnosis";
/// How far back the summary looks for medicines and results.
const RECENT_DAYS: i32 = 90;

/// A cut-off list: the rows shown and how many more there were.
#[derive(Debug, Serialize)]
pub struct Listed<T> {
    pub items: Vec<T>,
    pub more: i64,
}

/// Build a [`Listed`] from rows that each carry the uncut total.
fn listed<T>(items: Vec<T>, total: impl Fn(&T) -> i64) -> Listed<T> {
    let all = items.first().map_or(0, &total);
    let more = (all - i64::try_from(items.len()).unwrap_or(i64::MAX)).max(0);
    Listed { items, more }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryAllergy {
    pub allergen_name: String,
    pub reaction: Option<String>,
    pub severity: Option<String>,
    #[serde(skip)]
    pub total: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryDiagnosis {
    pub description: String,
    pub icd_code: Option<String>,
    pub encounter_date: NaiveDate,
    /// Mental-health content this viewer may not see: shown as a tombstone.
    pub withheld: bool,
    #[serde(skip)]
    pub total: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SummaryMedicine {
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub prescribed_on: NaiveDate,
    #[serde(skip)]
    pub total: i64,
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
    #[serde(skip)]
    pub total: i64,
}

/// What the doctor can read before the file comes.
#[derive(Debug, Serialize)]
pub struct DigitalSummary {
    pub allergies: Listed<SummaryAllergy>,
    pub diagnoses: Listed<SummaryDiagnosis>,
    /// The caller's role may not read OPD diagnoses: they exist (the count)
    /// but are withheld, as on every other screen.
    pub diagnoses_withheld: Option<i64>,
    pub medicines: Listed<SummaryMedicine>,
    pub abnormal_results: Listed<SummaryResult>,
}

/// Whether the caller's role may read OPD diagnoses in full.
fn diagnoses_readable(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    !matches!(
        restricted.get(OPD_DIAGNOSIS_FIELD),
        Some(FieldAccessLevel::Hidden | FieldAccessLevel::Mask)
    )
}

/// Replace a withheld mental-health diagnosis with the tombstone.
fn tombstone(row: &mut SummaryDiagnosis) {
    mental_health::TOMBSTONE_LABEL.clone_into(&mut row.description);
    row.icd_code = None;
}

/// `GET /api/mrd/file-requests/by-encounter/{encounter_id}/summary` — the
/// digital summary card. Audited.
pub async fn visit_digital_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<DigitalSummary>, AppError> {
    require_permission(&claims, permissions::opd::diagnoses::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    open_encounter(&state, &claims, encounter_id).await?;
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let viewer = MentalHealthViewer::of(&claims);
    let tenant = claims.tenant_id;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let patient = encounter_patient(&mut tx, tenant, encounter_id).await?;
    let (diagnoses, diagnoses_withheld) = if diagnoses_readable(&restricted) {
        let rows = recent_diagnoses(&mut tx, (tenant, patient, encounter_id), viewer).await?;
        let rows = mental_health::withhold(rows, |r| r.withheld, tombstone);
        (listed(rows, |r| r.total), None)
    } else {
        let n = count_diagnoses(&mut tx, tenant, patient, encounter_id).await?;
        (listed(Vec::new(), |r: &SummaryDiagnosis| r.total), Some(n))
    };
    let summary = DigitalSummary {
        allergies: listed(allergies(&mut tx, tenant, patient).await?, |r| r.total),
        diagnoses,
        diagnoses_withheld,
        medicines: listed(current_medicines(&mut tx, tenant, patient).await?, |r| {
            r.total
        }),
        abnormal_results: listed(abnormal_results(&mut tx, tenant, patient).await?, |r| {
            r.total
        }),
    };
    let values = json!({ "encounter_id": encounter_id });
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: tenant,
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

/// Active allergies, most severe first.
async fn allergies(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
) -> Result<Vec<SummaryAllergy>, AppError> {
    Ok(sqlx::query_as::<_, SummaryAllergy>(
        "SELECT allergen_name, reaction, severity::text AS severity, COUNT(*) OVER () AS total \
           FROM patient_allergies \
          WHERE tenant_id = $1 AND patient_id = $2 AND is_active AND deleted_at IS NULL \
          ORDER BY severity DESC NULLS LAST, allergen_name LIMIT 20",
    )
    .bind(tenant_id)
    .bind(patient)
    .fetch_all(conn)
    .await?)
}

/// Diagnoses from the patient's earlier visits, newest first, each marked
/// withheld where the mental-health rule (migration 1198) says so.
async fn recent_diagnoses(
    conn: &mut PgConnection,
    (tenant_id, patient, encounter_id): (Uuid, Uuid, Uuid),
    viewer: MentalHealthViewer,
) -> Result<Vec<SummaryDiagnosis>, AppError> {
    Ok(sqlx::query_as::<_, SummaryDiagnosis>(
        "SELECT d.description, d.icd_code, e.encounter_date, \
                public.mental_health_diagnosis_withheld(d.icd_system, d.icd_code, d.recorded_by, \
                    e.patient_id, $4, $5) AS withheld, \
                COUNT(*) OVER () AS total \
           FROM diagnoses d \
           JOIN encounters e ON e.id = d.encounter_id AND e.tenant_id = d.tenant_id \
          WHERE d.tenant_id = $1 AND e.patient_id = $2 AND e.id <> $3 \
            AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
          ORDER BY e.encounter_date DESC, d.is_primary DESC LIMIT 8",
    )
    .bind(tenant_id)
    .bind(patient)
    .bind(encounter_id)
    .bind(viewer.user_id)
    .bind(viewer.can_all)
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
///
/// ponytail: "current" is active and recent; a course's duration is free
/// text, so a finished five-day course still shows until it ages out.
async fn current_medicines(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient: Uuid,
) -> Result<Vec<SummaryMedicine>, AppError> {
    Ok(sqlx::query_as::<_, SummaryMedicine>(
        "SELECT i.drug_name, i.dosage, i.frequency, i.duration, \
                p.created_at::date AS prescribed_on, COUNT(*) OVER () AS total \
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
                r.is_critical, r.created_at::date AS resulted_on, COUNT(*) OVER () AS total \
           FROM lab_results r \
           JOIN lab_orders o ON o.id = r.order_id AND o.tenant_id = r.tenant_id \
           JOIN lab_test_catalog t ON t.id = o.test_id AND t.tenant_id = o.tenant_id \
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
    use super::{
        FieldAccessLevel, HashMap, OPD_DIAGNOSIS_FIELD, SummaryDiagnosis, diagnoses_readable,
        listed,
    };

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

    #[test]
    fn a_cut_off_list_says_how_many_more_there_were() {
        let row = |total| SummaryDiagnosis {
            description: String::new(),
            icd_code: None,
            encounter_date: chrono::NaiveDate::MIN,
            withheld: false,
            total,
        };
        assert_eq!(listed(vec![row(11), row(11)], |r| r.total).more, 9);
        assert_eq!(listed(Vec::new(), |r: &SummaryDiagnosis| r.total).more, 0);
    }
}
