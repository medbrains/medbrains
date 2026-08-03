#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::emergency::{
    ErBay, ErCodeActivation, ErDischargeSummary, ErObservationNote, ErResuscitationLog,
    ErTriageAssessment, ErVisit, MassCasualtyEvent, MlcCase, MlcDocument, MlcPoliceIntimation,
};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use medbrains_core::privacy::{mask_free_text, mask_identifier_keep_last, mask_name, mask_phone};
use serde::Deserialize;
use uuid::Uuid;

use axum::routing::{get,post,put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_any_permission, require_permission};
use medbrains_server_core::middleware::field_access;
use medbrains_server_core::state::AppState;

// ══════════════════════════════════════════════════════════
//  Request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListVisitsQuery {
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVisitRequest {
    pub patient_id: Uuid,
    pub arrival_mode: Option<String>,
    pub chief_complaint: Option<String>,
    pub is_mlc: Option<bool>,
    pub is_brought_dead: Option<bool>,
    pub bay_number: Option<String>,
    pub vitals: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub mass_casualty_event_id: Option<Uuid>,
    /// Internal training / simulator flag. See OPD CreateEncounterRequest.
    #[serde(default)]
    pub is_dummy: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVisitRequest {
    pub status: Option<String>,
    pub triage_level: Option<String>,
    pub attending_doctor_id: Option<Uuid>,
    pub bay_number: Option<String>,
    pub disposition: Option<String>,
    pub disposition_notes: Option<String>,
    pub admitted_to: Option<String>,
    pub admission_id: Option<Uuid>,
    pub door_to_doctor_mins: Option<i32>,
    pub door_to_disposition_mins: Option<i32>,
    pub vitals: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdmitFromErRequest {
    pub ward_id: Option<Uuid>,
    pub bed_id: Uuid,
    pub admitting_doctor_id: Uuid,
    pub admission_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTriageRequest {
    pub triage_level: String,
    pub triage_system: Option<String>,
    pub score: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub pulse_rate: Option<i32>,
    pub blood_pressure_systolic: Option<i32>,
    pub blood_pressure_diastolic: Option<i32>,
    pub spo2: Option<i32>,
    pub gcs_score: Option<i32>,
    pub gcs_eye: Option<i32>,
    pub gcs_verbal: Option<i32>,
    pub gcs_motor: Option<i32>,
    pub pain_score: Option<i32>,
    pub chief_complaint: Option<String>,
    pub presenting_symptoms: Option<serde_json::Value>,
    pub allergies: Option<serde_json::Value>,
    pub is_pregnant: Option<bool>,
    pub disability_assessment: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateResuscitationLogRequest {
    pub log_type: String,
    pub medication_name: Option<String>,
    pub dose: Option<String>,
    pub route: Option<String>,
    pub fluid_name: Option<String>,
    pub fluid_volume_ml: Option<i32>,
    pub procedure_name: Option<String>,
    pub procedure_notes: Option<String>,
    pub vitals_snapshot: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCodeActivationRequest {
    pub er_visit_id: Option<Uuid>,
    pub code_type: String,
    pub location: String,
    pub response_team: Option<serde_json::Value>,
    pub crash_cart_checklist: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeactivateCodeRequest {
    pub outcome: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMlcCaseRequest {
    pub er_visit_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub case_type: Option<String>,
    pub fir_number: Option<String>,
    pub police_station: Option<String>,
    pub brought_by: Option<String>,
    pub informant_name: Option<String>,
    pub informant_relation: Option<String>,
    pub informant_contact: Option<String>,
    pub history_of_incident: Option<String>,
    pub examination_findings: Option<String>,
    pub is_pocso: Option<bool>,
    pub is_death_case: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMlcCaseRequest {
    pub status: Option<String>,
    pub case_type: Option<String>,
    pub fir_number: Option<String>,
    pub police_station: Option<String>,
    pub examination_findings: Option<String>,
    pub medical_opinion: Option<String>,
    pub cause_of_death: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMlcDocumentRequest {
    pub document_type: String,
    pub title: String,
    pub body_diagram: Option<serde_json::Value>,
    pub content: serde_json::Value,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePoliceIntimationRequest {
    pub police_station: String,
    pub officer_name: Option<String>,
    pub officer_designation: Option<String>,
    pub officer_contact: Option<String>,
    pub sent_via: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmPoliceReceiptRequest {
    pub receipt_number: String,
    pub notes: Option<String>,
}

const MLC_FIR_NUMBER_FIELD: &str = "emergency.mlc.fir_number";
const MLC_POLICE_STATION_FIELD: &str = "emergency.mlc.police_station";
const MLC_INFORMANT_NAME_FIELD: &str = "emergency.mlc.informant_name";
const MLC_INFORMANT_RELATION_FIELD: &str = "emergency.mlc.informant_relation";
const MLC_INFORMANT_CONTACT_FIELD: &str = "emergency.mlc.informant_contact";
const MLC_HISTORY_FIELD: &str = "emergency.mlc.history_of_incident";
const MLC_EXAMINATION_FIELD: &str = "emergency.mlc.examination_findings";
const MLC_MEDICAL_OPINION_FIELD: &str = "emergency.mlc.medical_opinion";
const MLC_CAUSE_OF_DEATH_FIELD: &str = "emergency.mlc.cause_of_death";
const MLC_POCSO_REPORT_FIELD: &str = "emergency.mlc.pocso_report";

fn mlc_document_create_permission(document_type: &str) -> Result<&'static str, AppError> {
    match document_type {
        "sbar_handover" => Ok(permissions::emergency::mlc_documents::SBAR_CREATE),
        "age_estimation" => Ok(permissions::emergency::mlc_documents::AGE_ESTIMATION_CREATE),
        "pocso_report" => Ok(permissions::emergency::mlc_documents::POCSO_CREATE),
        "court_summons" => Ok(permissions::emergency::mlc_documents::COURT_SUMMONS_CREATE),
        _ => Err(AppError::BadRequest(
            "Unsupported MLC document type".to_owned(),
        )),
    }
}

fn trim_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn require_resuscitation_text(value: &Option<String>, label: &str) -> Result<(), AppError> {
    if value.is_some() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "{label} is required for this resuscitation log type"
    )))
}

fn claims_have_any_permission(claims: &Claims, permissions: &[&str]) -> bool {
    is_bypass_role(claims)
        || permissions.iter().any(|permission| {
            claims
                .permissions
                .iter()
                .any(|granted| granted == permission)
        })
}

fn can_view_full_er_visit(claims: &Claims) -> bool {
    claims_have_any_permission(
        claims,
        &[
            permissions::emergency::visits::LIST,
            permissions::emergency::visits::UPDATE,
        ],
    )
}

fn filter_er_visit_response(mut row: ErVisit, claims: &Claims) -> ErVisit {
    if can_view_full_er_visit(claims) {
        return row;
    }

    row.attending_doctor_id = None;
    row.disposition = None;
    row.disposition_time = None;
    row.disposition_notes = None;
    row.admitted_to = None;
    row.admission_id = None;
    row.door_to_doctor_mins = None;
    row.door_to_disposition_mins = None;
    row.vitals = None;
    row.notes = None;
    row.mass_casualty_event_id = None;
    row.created_by = None;
    row
}

fn mlc_field_access(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
    field: &str,
) -> FieldAccessLevel {
    restricted
        .get(field)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn mlc_field_is_hidden(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
    field: &str,
) -> bool {
    mlc_field_access(restricted, field) == FieldAccessLevel::Hidden
}

fn mlc_field_is_masked(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
    field: &str,
) -> bool {
    mlc_field_access(restricted, field) == FieldAccessLevel::Mask
}

fn mlc_field_is_writable(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
    field: &str,
) -> bool {
    mlc_field_access(restricted, field) == FieldAccessLevel::Edit
}

fn reject_restricted_mlc_field_writes(
    writes: &[(&str, &str, bool)],
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    let violations = writes
        .iter()
        .filter_map(|(field, label, was_written)| {
            (*was_written && !mlc_field_is_writable(restricted, field)).then_some(*label)
        })
        .collect::<Vec<_>>();

    if violations.is_empty() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "Cannot write restricted MLC fields: {}",
        violations.join(", ")
    )))
}

fn filter_mlc_case_response(
    mut row: MlcCase,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> MlcCase {
    if mlc_field_is_hidden(restricted, MLC_FIR_NUMBER_FIELD) {
        row.fir_number = None;
    } else if mlc_field_is_masked(restricted, MLC_FIR_NUMBER_FIELD) {
        row.fir_number = row
            .fir_number
            .map(|value| mask_identifier_keep_last(&value, 4));
    }
    if mlc_field_is_hidden(restricted, MLC_POLICE_STATION_FIELD) {
        row.police_station = None;
    } else if mlc_field_is_masked(restricted, MLC_POLICE_STATION_FIELD) {
        row.police_station = row.police_station.map(|value| mask_free_text(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_INFORMANT_NAME_FIELD) {
        row.informant_name = None;
    } else if mlc_field_is_masked(restricted, MLC_INFORMANT_NAME_FIELD) {
        row.informant_name = row.informant_name.map(|value| mask_name(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_INFORMANT_RELATION_FIELD) {
        row.informant_relation = None;
    } else if mlc_field_is_masked(restricted, MLC_INFORMANT_RELATION_FIELD) {
        row.informant_relation = row.informant_relation.map(|value| mask_free_text(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_INFORMANT_CONTACT_FIELD) {
        row.informant_contact = None;
    } else if mlc_field_is_masked(restricted, MLC_INFORMANT_CONTACT_FIELD) {
        row.informant_contact = row.informant_contact.map(|value| mask_phone(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_HISTORY_FIELD) {
        row.history_of_incident = None;
    } else if mlc_field_is_masked(restricted, MLC_HISTORY_FIELD) {
        row.history_of_incident = row.history_of_incident.map(|value| mask_free_text(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_EXAMINATION_FIELD) {
        row.examination_findings = None;
    } else if mlc_field_is_masked(restricted, MLC_EXAMINATION_FIELD) {
        row.examination_findings = row.examination_findings.map(|value| mask_free_text(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_MEDICAL_OPINION_FIELD) {
        row.medical_opinion = None;
    } else if mlc_field_is_masked(restricted, MLC_MEDICAL_OPINION_FIELD) {
        row.medical_opinion = row.medical_opinion.map(|value| mask_free_text(&value));
    }
    if mlc_field_is_hidden(restricted, MLC_CAUSE_OF_DEATH_FIELD) {
        row.cause_of_death = None;
    } else if mlc_field_is_masked(restricted, MLC_CAUSE_OF_DEATH_FIELD) {
        row.cause_of_death = row.cause_of_death.map(|value| mask_free_text(&value));
    }

    row
}

fn filter_mlc_document_response(
    mut row: MlcDocument,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> MlcDocument {
    if row.document_type == "pocso_report"
        && mlc_field_is_hidden(restricted, MLC_POCSO_REPORT_FIELD)
    {
        row.body_diagram = None;
        row.content = serde_json::json!({ "restricted": true });
        row.notes = None;
    } else if row.document_type == "pocso_report"
        && mlc_field_is_masked(restricted, MLC_POCSO_REPORT_FIELD)
    {
        row.body_diagram = None;
        row.content = serde_json::json!({ "masked": true });
        row.notes = row.notes.map(|value| mask_free_text(&value));
    }

    row
}

fn filter_mlc_police_intimation_response(
    mut row: MlcPoliceIntimation,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> MlcPoliceIntimation {
    if mlc_field_is_hidden(restricted, MLC_POLICE_STATION_FIELD) {
        row.police_station.clear();
    } else if mlc_field_is_masked(restricted, MLC_POLICE_STATION_FIELD) {
        row.police_station = mask_free_text(&row.police_station);
    }

    row
}

#[derive(Debug, Deserialize)]
pub struct CreateMassCasualtyEventRequest {
    pub event_name: String,
    pub event_type: Option<String>,
    pub location: Option<String>,
    pub estimated_casualties: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMassCasualtyEventRequest {
    pub status: Option<String>,
    pub actual_casualties: Option<i32>,
    pub triage_summary: Option<serde_json::Value>,
    pub resources_deployed: Option<serde_json::Value>,
    pub notifications_sent: Option<serde_json::Value>,
    pub notes: Option<String>,
}

fn infer_mlc_case_type(parts: &[Option<&str>]) -> Option<&'static str> {
    let haystack = parts
        .iter()
        .filter_map(|part| *part)
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();

    if haystack.is_empty() {
        return None;
    }

    let keyword_map = [
        ("rta", "road_traffic_accident"),
        ("road traffic", "road_traffic_accident"),
        ("accident", "accident"),
        ("assault", "assault"),
        ("stab", "assault"),
        ("gunshot", "assault"),
        ("burn", "burn"),
        ("poison", "poisoning"),
        ("suicide", "self_harm"),
        ("self harm", "self_harm"),
        ("hanging", "self_harm"),
        ("fall from height", "accident"),
    ];

    keyword_map
        .iter()
        .find_map(|(keyword, case_type)| haystack.contains(keyword).then_some(*case_type))
}

async fn ensure_patient_belongs_to_tenant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if !exists {
        return Err(AppError::BadRequest(
            "Emergency patient does not belong to this tenant".to_owned(),
        ));
    }

    Ok(())
}

async fn ensure_open_mass_casualty_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    event_id: Uuid,
) -> Result<(), AppError> {
    let status = sqlx::query_scalar::<_, String>(
        "SELECT status::text FROM mass_casualty_events WHERE id = $1 AND tenant_id = $2",
    )
    .bind(event_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if status == "deactivated" {
        return Err(AppError::BadRequest(
            "Cannot attach an ER visit to a deactivated mass-casualty event".to_owned(),
        ));
    }

    Ok(())
}

async fn ensure_er_visit_matches_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    er_visit_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let linked_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM er_visits WHERE id = $1 AND tenant_id = $2",
    )
    .bind(er_visit_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if linked_patient_id != patient_id {
        return Err(AppError::BadRequest(
            "Linked ER visit belongs to a different patient".to_owned(),
        ));
    }

    Ok(())
}

async fn ensure_er_visit_belongs_to_tenant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    er_visit_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM er_visits WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(er_visit_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if !exists {
        return Err(AppError::BadRequest(
            "ER visit does not belong to this tenant".to_owned(),
        ));
    }

    Ok(())
}

async fn auto_create_mlc_case_for_visit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    er_visit_id: Uuid,
    patient_id: Uuid,
    registered_by: Uuid,
    case_type: &str,
    history_of_incident: Option<&str>,
) -> Result<(), AppError> {
    let suffix = er_visit_id.to_string().chars().take(8).collect::<String>();
    let mlc_number = format!("MLC-{}-{suffix}", Utc::now().format("%Y%m%d%H%M%S"));

    let created_mlc_case = sqlx::query_as::<_, (Uuid, String)>(
        "INSERT INTO mlc_cases
         (tenant_id, er_visit_id, patient_id, mlc_number, case_type,
          history_of_incident, registered_by)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (
           SELECT 1 FROM mlc_cases WHERE tenant_id = $1 AND er_visit_id = $2
         )
         RETURNING id, mlc_number",
    )
    .bind(tenant_id)
    .bind(er_visit_id)
    .bind(patient_id)
    .bind(&mlc_number)
    .bind(case_type)
    .bind(history_of_incident)
    .bind(registered_by)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some((mlc_case_id, created_mlc_number)) = created_mlc_case {
        let event = ClinicalEventEnvelope::new(
            *tenant_id,
            ClinicalEventName::MlcCreated,
            mlc_case_id,
            registered_by,
            serde_json::json!({
                "mlc_case_id": mlc_case_id,
                "patient_id": patient_id,
                "er_visit_id": er_visit_id,
                "mlc_number": created_mlc_number,
                "registration_source": "er_visit_auto",
            }),
        )
        .with_patient(patient_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(tx, &event).await?;
    }

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  ER Visits
// ══════════════════════════════════════════════════════════

pub async fn list_visits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListVisitsQuery>,
) -> Result<Json<Vec<ErVisit>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::visits::LIST,
            permissions::emergency::visits::UPDATE,
            permissions::emergency::triage::LIST,
            permissions::emergency::triage::CREATE,
            permissions::emergency::resuscitation::LIST,
            permissions::emergency::resuscitation::CREATE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErVisit>(
        "SELECT * FROM er_visits
         WHERE tenant_id = $1
           AND ($2::uuid IS NULL OR patient_id = $2)
         ORDER BY arrival_time DESC
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(query.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_er_visit_response(row, &claims))
            .collect(),
    ))
}

pub async fn get_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ErVisit>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::visits::LIST,
            permissions::emergency::visits::UPDATE,
            permissions::emergency::triage::LIST,
            permissions::emergency::triage::CREATE,
            permissions::emergency::resuscitation::LIST,
            permissions::emergency::resuscitation::CREATE,
            permissions::emergency::mlc::LIST,
            permissions::emergency::mlc::PRINT,
            permissions::emergency::mlc::REPRINT,
            permissions::emergency::mlc_documents::SBAR_CREATE,
            permissions::emergency::mlc_documents::AGE_ESTIMATION_CREATE,
            permissions::emergency::mlc_documents::POCSO_CREATE,
            permissions::emergency::mlc_documents::COURT_SUMMONS_CREATE,
            permissions::emergency::mlc_police_intimations::LIST,
            permissions::emergency::mlc_police_intimations::CREATE,
            permissions::emergency::mlc_police_intimations::CONFIRM,
            permissions::emergency::mlc_police_intimations::PRINT,
            permissions::emergency::mlc_police_intimations::REPRINT,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row =
        sqlx::query_as::<_, ErVisit>("SELECT * FROM er_visits WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(filter_er_visit_response(row, &claims)))
}

pub async fn create_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVisitRequest>,
) -> Result<Json<ErVisit>, AppError> {
    require_permission(&claims, permissions::emergency::visits::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let inferred_mlc_case_type = infer_mlc_case_type(&[
        body.chief_complaint.as_deref(),
        body.notes.as_deref(),
        body.arrival_mode.as_deref(),
    ]);
    let is_mlc = body.is_mlc.unwrap_or(false) || inferred_mlc_case_type.is_some();
    if is_mlc {
        require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_patient_belongs_to_tenant(&mut tx, claims.tenant_id, body.patient_id).await?;
    if let Some(event_id) = body.mass_casualty_event_id {
        ensure_open_mass_casualty_event(&mut tx, claims.tenant_id, event_id).await?;
    }

    let visit_number = format!("ER-{}", Utc::now().format("%Y%m%d%H%M%S"));

    let is_dummy = body.is_dummy.unwrap_or(false) && is_bypass_role(&claims);

    let row = sqlx::query_as::<_, ErVisit>(
        "INSERT INTO er_visits (tenant_id, patient_id, visit_number, arrival_mode, chief_complaint, is_mlc, is_brought_dead, bay_number, vitals, notes, mass_casualty_event_id, created_by, is_dummy)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, false), $8, $9, $10, $11, $12, $13)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&visit_number)
    .bind(&body.arrival_mode)
    .bind(&body.chief_complaint)
    .bind(is_mlc)
    .bind(body.is_brought_dead)
    .bind(body.bay_number)
    .bind(body.vitals)
    .bind(&body.notes)
    .bind(body.mass_casualty_event_id)
    .bind(claims.sub)
    .bind(is_dummy)
    .fetch_one(&mut *tx)
    .await?;

    if is_mlc {
        auto_create_mlc_case_for_visit(
            &mut tx,
            &claims.tenant_id,
            row.id,
            row.patient_id,
            claims.sub,
            inferred_mlc_case_type.unwrap_or("medico_legal"),
            row.chief_complaint.as_deref().or(row.notes.as_deref()),
        )
        .await?;
    }

    // ER visits are encounter-backed so every charge for the visit
    // (consultation, consumables, orders) lands on one bill — mirrors the
    // encounter admit_from_er creates when the patient is admitted.
    let encounter_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, visit_type, notes, attributes) \
         VALUES ($1, $2, 'emergency'::encounter_type, 'emergency', $3, $4) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(row.patient_id)
    .bind(row.chief_complaint.as_deref())
    .bind(serde_json::json!({ "source": "er", "er_visit_id": row.id }))
    .fetch_one(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, ErVisit>(
        "UPDATE er_visits SET encounter_id = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 RETURNING *",
    )
    .bind(encounter_id)
    .bind(row.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-bill ER consultation charge
    if medbrains_server_services::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "emergency")
        .await
        .unwrap_or(false)
    {
        let _ = medbrains_server_services::billing::auto_charge(
            &mut tx,
            &claims.tenant_id,
            medbrains_server_services::billing::AutoChargeInput {
                patient_id: row.patient_id,
                encounter_id: Some(encounter_id),
                charge_code: "CON_EMERGENCY".to_owned(),
                source: "emergency".to_owned(),
                source_id: row.id,
                quantity: 1,
                description_override: Some(format!(
                    "Emergency consultation - {}",
                    row.visit_number
                )),
                unit_price_override: None,
                tax_percent_override: None,
            },
        )
        .await;
    }

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::EmergencyVisitCreated,
        row.id,
        claims.sub,
        serde_json::json!({
            "visit_id": row.id,
            "patient_id": row.patient_id,
            "visit_number": &row.visit_number,
            "arrival_mode": &row.arrival_mode,
            "is_mlc": row.is_mlc,
            "is_brought_dead": row.is_brought_dead,
            "mass_casualty_event_id": row.mass_casualty_event_id,
        }),
    )
    .with_patient(row.patient_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    signal_triage_board(&state, &claims, ClinicalEventName::EmergencyVisitCreated.as_str(), row.id);
    Ok(Json(row))
}

/// Nudge the triage board. Emergency is the one board where a poll interval is
/// a clinical delay rather than a cosmetic one: the display exists so staff can
/// see who is waiting and how sick they are, and a newly-arrived or re-triaged
/// patient must appear on it now.
fn signal_triage_board(state: &AppState, claims: &Claims, kind: &str, visit_id: Uuid) {
    medbrains_server_core::notifications::publish_surface_board_signal(
        state,
        claims.tenant_id,
        "emergency",
        kind,
        "er_visit",
        visit_id,
    );
}

pub async fn update_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVisitRequest>,
) -> Result<Json<ErVisit>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ErVisit>(
        "UPDATE er_visits SET
            status = COALESCE($3::er_visit_status, status),
            triage_level = COALESCE($4::triage_level, triage_level),
            attending_doctor_id = COALESCE($5, attending_doctor_id),
            bay_number = COALESCE($6, bay_number),
            disposition = COALESCE($7, disposition),
            disposition_notes = COALESCE($8, disposition_notes),
            disposition_time = CASE WHEN $7 IS NOT NULL THEN now() ELSE disposition_time END,
            admitted_to = COALESCE($9, admitted_to),
            admission_id = COALESCE($10, admission_id),
            door_to_doctor_mins = COALESCE($11, door_to_doctor_mins),
            door_to_disposition_mins = COALESCE($12, door_to_disposition_mins),
            vitals = COALESCE($13, vitals),
            notes = COALESCE($14, notes)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.status)
    .bind(body.triage_level)
    .bind(body.attending_doctor_id)
    .bind(body.bay_number)
    .bind(body.disposition)
    .bind(body.disposition_notes)
    .bind(body.admitted_to)
    .bind(body.admission_id)
    .bind(body.door_to_doctor_mins)
    .bind(body.door_to_disposition_mins)
    .bind(body.vitals)
    .bind(body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    // Status and triage level both live on this update, and both change what the
    // board should show.
    signal_triage_board(&state, &claims, "emergency.visit.updated", row.id);
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Triage
// ══════════════════════════════════════════════════════════

pub async fn list_triage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
) -> Result<Json<Vec<ErTriageAssessment>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::triage::LIST,
            permissions::emergency::triage::CREATE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErTriageAssessment>(
        "SELECT * FROM er_triage_assessments WHERE er_visit_id = $1 AND tenant_id = $2 ORDER BY assessed_at DESC LIMIT 5000",
    )
    .bind(visit_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_triage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<CreateTriageRequest>,
) -> Result<Json<ErTriageAssessment>, AppError> {
    require_permission(&claims, permissions::emergency::triage::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let inferred_mlc_case_type = infer_mlc_case_type(&[
        body.chief_complaint.as_deref(),
        body.disability_assessment.as_deref(),
        body.notes.as_deref(),
    ]);
    if inferred_mlc_case_type.is_some() {
        require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErTriageAssessment>(
        "INSERT INTO er_triage_assessments (tenant_id, er_visit_id, triage_level, triage_system, score,
            respiratory_rate, pulse_rate, blood_pressure_systolic, blood_pressure_diastolic, spo2,
            gcs_score, gcs_eye, gcs_verbal, gcs_motor, pain_score,
            chief_complaint, presenting_symptoms, allergies, is_pregnant, disability_assessment, notes, assessed_by)
         VALUES ($1, $2, $3::triage_level, COALESCE($4, 'ESI'), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(visit_id)
    .bind(&body.triage_level)
    .bind(&body.triage_system)
    .bind(body.score)
    .bind(body.respiratory_rate)
    .bind(body.pulse_rate)
    .bind(body.blood_pressure_systolic)
    .bind(body.blood_pressure_diastolic)
    .bind(body.spo2)
    .bind(body.gcs_score)
    .bind(body.gcs_eye)
    .bind(body.gcs_verbal)
    .bind(body.gcs_motor)
    .bind(body.pain_score)
    .bind(&body.chief_complaint)
    .bind(&body.presenting_symptoms)
    .bind(&body.allergies)
    .bind(body.is_pregnant)
    .bind(&body.disability_assessment)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Also update the visit's triage level
    sqlx::query("UPDATE er_visits SET triage_level = $3::triage_level, status = 'triaged' WHERE id = $1 AND tenant_id = $2")
        .bind(visit_id)
        .bind(claims.tenant_id)
        .bind(&body.triage_level)
        .execute(&mut *tx)
        .await?;

    if let Some(case_type) = inferred_mlc_case_type {
        let visit = sqlx::query!(
            "UPDATE er_visits
             SET is_mlc = true, updated_at = now()
             WHERE id = $1 AND tenant_id = $2
             RETURNING patient_id, chief_complaint, notes",
            visit_id,
            claims.tenant_id,
        )
        .fetch_one(&mut *tx)
        .await?;

        auto_create_mlc_case_for_visit(
            &mut tx,
            &claims.tenant_id,
            visit_id,
            visit.patient_id,
            claims.sub,
            case_type,
            body.chief_complaint
                .as_deref()
                .or(visit.chief_complaint.as_deref())
                .or(visit.notes.as_deref()),
        )
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Resuscitation Logs
// ══════════════════════════════════════════════════════════

pub async fn list_resuscitation_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
) -> Result<Json<Vec<ErResuscitationLog>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::resuscitation::LIST,
            permissions::emergency::resuscitation::CREATE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErResuscitationLog>(
        "SELECT * FROM er_resuscitation_logs WHERE er_visit_id = $1 AND tenant_id = $2 ORDER BY timestamp ASC",
    )
    .bind(visit_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_resuscitation_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<CreateResuscitationLogRequest>,
) -> Result<Json<ErResuscitationLog>, AppError> {
    require_permission(&claims, permissions::emergency::resuscitation::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let log_type = match body.log_type.trim() {
        "medication" | "fluid" | "procedure" | "airway" | "cpr" | "defibrillation" | "vitals"
        | "note" => body.log_type.trim().to_owned(),
        _ => {
            return Err(AppError::BadRequest(
                "Unsupported resuscitation log type".to_owned(),
            ));
        }
    };
    let mut medication_name = trim_optional_text(body.medication_name.as_deref());
    let mut dose = trim_optional_text(body.dose.as_deref());
    let mut route = trim_optional_text(body.route.as_deref());
    let mut fluid_name = trim_optional_text(body.fluid_name.as_deref());
    let mut fluid_volume_ml = body.fluid_volume_ml;
    let mut procedure_name = trim_optional_text(body.procedure_name.as_deref());
    let mut procedure_notes = trim_optional_text(body.procedure_notes.as_deref());
    let vitals_snapshot = body.vitals_snapshot;
    let notes = trim_optional_text(body.notes.as_deref());

    if fluid_volume_ml.is_some_and(|volume| volume < 0) {
        return Err(AppError::BadRequest(
            "Fluid volume cannot be negative".to_owned(),
        ));
    }

    match log_type.as_str() {
        "medication" => {
            require_resuscitation_text(&medication_name, "Medication")?;
            require_resuscitation_text(&dose, "Dose")?;
            require_resuscitation_text(&route, "Route")?;
            fluid_name = None;
            fluid_volume_ml = None;
            procedure_name = None;
            procedure_notes = None;
        }
        "fluid" => {
            require_resuscitation_text(&fluid_name, "Fluid")?;
            require_resuscitation_text(&route, "Route")?;
            if fluid_volume_ml.is_none_or(|volume| volume <= 0) {
                return Err(AppError::BadRequest(
                    "Fluid volume must be greater than 0 ml".to_owned(),
                ));
            }
            medication_name = None;
            dose = None;
            procedure_name = None;
            procedure_notes = None;
        }
        "procedure" | "airway" | "cpr" | "defibrillation" => {
            require_resuscitation_text(&procedure_name, "Procedure/action")?;
            medication_name = None;
            dose = None;
            route = None;
            fluid_name = None;
            fluid_volume_ml = None;
        }
        "vitals" | "note" => {
            if notes.is_none() && vitals_snapshot.is_none() {
                return Err(AppError::BadRequest(
                    "Clinical notes or vitals snapshot are required for this resuscitation log type"
                        .to_owned(),
                ));
            }
            medication_name = None;
            dose = None;
            route = None;
            fluid_name = None;
            fluid_volume_ml = None;
            procedure_name = None;
            procedure_notes = None;
        }
        _ => {
            return Err(AppError::BadRequest(
                "Unsupported resuscitation log type".to_owned(),
            ));
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_er_visit_belongs_to_tenant(&mut tx, claims.tenant_id, visit_id).await?;
    let row = sqlx::query_as::<_, ErResuscitationLog>(
        "INSERT INTO er_resuscitation_logs (tenant_id, er_visit_id, log_type, medication_name, dose, route,
            fluid_name, fluid_volume_ml, procedure_name, procedure_notes, vitals_snapshot, notes, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(visit_id)
    .bind(&log_type)
    .bind(medication_name)
    .bind(dose)
    .bind(route)
    .bind(fluid_name)
    .bind(fluid_volume_ml)
    .bind(procedure_name)
    .bind(procedure_notes)
    .bind(vitals_snapshot)
    .bind(notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Code Activations
// ══════════════════════════════════════════════════════════

pub async fn list_code_activations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ErCodeActivation>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::codes::LIST,
            permissions::emergency::codes::UPDATE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErCodeActivation>(
        "SELECT * FROM er_code_activations WHERE tenant_id = $1 ORDER BY activated_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_code_activation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCodeActivationRequest>,
) -> Result<Json<ErCodeActivation>, AppError> {
    require_permission(&claims, permissions::emergency::codes::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let code_type = match body.code_type.as_str() {
        "code_blue" | "code_yellow" | "code_pink" | "code_orange" | "code_red" | "code_silver"
        | "code_black" => body.code_type,
        _ => {
            return Err(AppError::BadRequest(
                "Invalid emergency code type".to_owned(),
            ));
        }
    };
    let location = body.location.trim();
    if location.len() < 2 {
        return Err(AppError::BadRequest(
            "Emergency code location is required".to_owned(),
        ));
    }
    let location = location.to_owned();
    let notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    if let Some(er_visit_id) = body.er_visit_id {
        let visit_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM er_visits WHERE id = $1 AND tenant_id = $2)",
        )
        .bind(er_visit_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !visit_exists {
            return Err(AppError::BadRequest(
                "Linked ER visit does not belong to this tenant".to_owned(),
            ));
        }
    }

    let row = sqlx::query_as::<_, ErCodeActivation>(
        "INSERT INTO er_code_activations (tenant_id, er_visit_id, code_type, location, response_team, crash_cart_checklist, notes, activated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.er_visit_id)
    .bind(&code_type)
    .bind(&location)
    .bind(body.response_team)
    .bind(body.crash_cart_checklist)
    .bind(&notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // ── Break-glass — auto-grant 4h `code_blue_team` group membership ─
    // Activator gets temporary clinical-override access. Membership
    // expires automatically; the SpiceDB Watch consumer (M5) bumps
    // perm_version when expiry fires so the JWT is re-issued without
    // the elevated grant.
    let break_glass_expiry = Utc::now() + chrono::Duration::hours(4);
    let group_id: Option<Uuid> = if code_type == "code_blue" {
        sqlx::query_scalar(
            "SELECT id FROM access_groups \
             WHERE tenant_id = $1 AND code = 'code_blue_team' AND is_active = true",
        )
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
    } else {
        None
    };
    if let Some(gid) = group_id {
        sqlx::query(
            "INSERT INTO access_group_members (group_id, user_id, tenant_id, added_by, expires_at) \
             VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (group_id, user_id) DO UPDATE SET \
               expires_at = GREATEST(access_group_members.expires_at, EXCLUDED.expires_at), \
               added_by = EXCLUDED.added_by",
        )
        .bind(gid)
        .bind(claims.sub)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .bind(break_glass_expiry)
        .execute(&mut *tx)
        .await?;

        // Bump perm_version so the JWT picks up the new group on next
        // request (existing middleware verifies).
        sqlx::query("UPDATE users SET perm_version = perm_version + 1 WHERE id = $1")
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    // Emit the SpiceDB tuple (best-effort — failures logged, backfill catches up).
    if let Some(gid) = group_id {
        if let Err(e) = state
            .authz
            .write_tuple(
                &medbrains_server_core::middleware::authorization::authz_context(&claims),
                "access_group",
                gid,
                medbrains_authz::Relation::Viewer, // mapped to "member" via relation_to_relname
                medbrains_authz::Subject::User(claims.sub),
                Some(break_glass_expiry),
                Some("break_glass_code_blue".to_owned()),
            )
            .await
        {
            tracing::warn!(error = %e, user = %claims.sub,
                "rebac: failed to write code_blue_team#member tuple — backfill will retry");
        }
    }

    Ok(Json(row))
}

pub async fn deactivate_code(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DeactivateCodeRequest>,
) -> Result<Json<ErCodeActivation>, AppError> {
    require_permission(&claims, permissions::emergency::codes::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let outcome = match body.outcome.trim() {
        "resolved" | "stable" | "rosc" | "transferred" | "expired" | "false_alarm"
        | "escalated" => body.outcome.trim().to_owned(),
        _ => {
            return Err(AppError::BadRequest(
                "Unsupported emergency code closure outcome".to_owned(),
            ));
        }
    };
    let notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current = sqlx::query_as::<_, ErCodeActivation>(
        "SELECT * FROM er_code_activations WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if current.deactivated_at.is_some() {
        return Err(AppError::Conflict(
            "Emergency code is already deactivated".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, ErCodeActivation>(
        "UPDATE er_code_activations SET deactivated_at = now(), outcome = $3, notes = COALESCE($4, notes), deactivated_by = $5
         WHERE id = $1 AND tenant_id = $2
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(outcome)
    .bind(notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  MLC Cases
// ══════════════════════════════════════════════════════════

pub async fn list_mlc_cases(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MlcCase>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::mlc::LIST,
            permissions::emergency::mlc::UPDATE,
            permissions::emergency::mlc::PRINT,
            permissions::emergency::mlc::REPRINT,
            permissions::emergency::mlc_documents::SBAR_CREATE,
            permissions::emergency::mlc_documents::AGE_ESTIMATION_CREATE,
            permissions::emergency::mlc_documents::POCSO_CREATE,
            permissions::emergency::mlc_documents::COURT_SUMMONS_CREATE,
            permissions::emergency::mlc_police_intimations::LIST,
            permissions::emergency::mlc_police_intimations::CREATE,
            permissions::emergency::mlc_police_intimations::CONFIRM,
            permissions::emergency::mlc_police_intimations::PRINT,
            permissions::emergency::mlc_police_intimations::REPRINT,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcCase>(
        "SELECT * FROM mlc_cases WHERE tenant_id = $1 ORDER BY registered_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_mlc_case_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_mlc_case(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMlcCaseRequest>,
) -> Result<Json<MlcCase>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    reject_restricted_mlc_field_writes(
        &[
            (
                MLC_FIR_NUMBER_FIELD,
                "fir_number",
                body.fir_number.is_some(),
            ),
            (
                MLC_POLICE_STATION_FIELD,
                "police_station",
                body.police_station.is_some(),
            ),
            (
                MLC_INFORMANT_NAME_FIELD,
                "informant_name",
                body.informant_name.is_some(),
            ),
            (
                MLC_INFORMANT_RELATION_FIELD,
                "informant_relation",
                body.informant_relation.is_some(),
            ),
            (
                MLC_INFORMANT_CONTACT_FIELD,
                "informant_contact",
                body.informant_contact.is_some(),
            ),
            (
                MLC_HISTORY_FIELD,
                "history_of_incident",
                body.history_of_incident.is_some(),
            ),
            (
                MLC_EXAMINATION_FIELD,
                "examination_findings",
                body.examination_findings.is_some(),
            ),
        ],
        &restricted_fields,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_patient_belongs_to_tenant(&mut tx, claims.tenant_id, body.patient_id).await?;

    if let Some(er_visit_id) = body.er_visit_id {
        ensure_er_visit_matches_patient(&mut tx, claims.tenant_id, er_visit_id, body.patient_id)
            .await?;
        let existing = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM mlc_cases WHERE er_visit_id = $1 AND tenant_id = $2)",
        )
        .bind(er_visit_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if existing {
            return Err(AppError::Conflict(
                "An MLC case is already linked to this ER visit".to_owned(),
            ));
        }
        sqlx::query("UPDATE er_visits SET is_mlc = true, updated_at = now() WHERE id = $1 AND tenant_id = $2")
            .bind(er_visit_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
    }

    let mlc_number = format!("MLC-{}", Utc::now().format("%Y%m%d%H%M%S"));

    let row = sqlx::query_as::<_, MlcCase>(
        "INSERT INTO mlc_cases (tenant_id, er_visit_id, patient_id, mlc_number, case_type, fir_number, police_station,
            brought_by, informant_name, informant_relation, informant_contact, history_of_incident,
            examination_findings, is_pocso, is_death_case, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, false), COALESCE($15, false), $16)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.er_visit_id)
    .bind(body.patient_id)
    .bind(&mlc_number)
    .bind(body.case_type)
    .bind(body.fir_number)
    .bind(body.police_station)
    .bind(body.brought_by)
    .bind(body.informant_name)
    .bind(body.informant_relation)
    .bind(body.informant_contact)
    .bind(body.history_of_incident)
    .bind(body.examination_findings)
    .bind(body.is_pocso)
    .bind(body.is_death_case)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::MlcCreated,
        row.id,
        claims.sub,
        serde_json::json!({
            "mlc_case_id": row.id,
            "patient_id": row.patient_id,
            "er_visit_id": row.er_visit_id,
            "mlc_number": &row.mlc_number,
            "registration_source": if row.er_visit_id.is_some() { "er_visit" } else { "manual" },
            "registered_at": row.registered_at,
        }),
    )
    .with_patient(row.patient_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    tx.commit().await?;
    Ok(Json(filter_mlc_case_response(row, &restricted_fields)))
}

pub async fn update_mlc_case(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMlcCaseRequest>,
) -> Result<Json<MlcCase>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    if let Some(status) = body.status.as_deref() {
        match status {
            "registered" | "under_investigation" | "opinion_given" | "court_pending" | "closed" => {
            }
            _ => {
                return Err(AppError::BadRequest(
                    "Unsupported MLC case status".to_owned(),
                ));
            }
        }
    }
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    reject_restricted_mlc_field_writes(
        &[
            (
                MLC_FIR_NUMBER_FIELD,
                "fir_number",
                body.fir_number.is_some(),
            ),
            (
                MLC_POLICE_STATION_FIELD,
                "police_station",
                body.police_station.is_some(),
            ),
            (
                MLC_EXAMINATION_FIELD,
                "examination_findings",
                body.examination_findings.is_some(),
            ),
            (
                MLC_MEDICAL_OPINION_FIELD,
                "medical_opinion",
                body.medical_opinion.is_some(),
            ),
            (
                MLC_CAUSE_OF_DEATH_FIELD,
                "cause_of_death",
                body.cause_of_death.is_some(),
            ),
        ],
        &restricted_fields,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Medico-legal safeguard: an MLC case must not be closed until the police have been informed.
    // Require a recorded police intimation (or an FIR number, set now or already on file) before the
    // status may move to 'closed' — closing a medico-legal case without police intimation is improper.
    if body.status.as_deref() == Some("closed") {
        let intimation_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM mlc_police_intimations WHERE mlc_case_id = $1)",
        )
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        let fir_now = body
            .fir_number
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty());
        let fir_on_file = sqlx::query_scalar::<_, Option<String>>(
            "SELECT fir_number FROM mlc_cases WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten()
        .is_some_and(|s| !s.trim().is_empty());
        if !intimation_exists && !fir_now && !fir_on_file {
            return Err(AppError::Conflict(
                "Cannot close this MLC case — record a police intimation or FIR number first. \
                 The police must be informed for every medico-legal case."
                    .to_owned(),
            ));
        }
    }

    let row = sqlx::query_as::<_, MlcCase>(
        "UPDATE mlc_cases SET
            status = COALESCE($3::mlc_status, status),
            case_type = COALESCE($4, case_type),
            fir_number = COALESCE($5, fir_number),
            police_station = COALESCE($6, police_station),
            examination_findings = COALESCE($7, examination_findings),
            medical_opinion = COALESCE($8, medical_opinion),
            cause_of_death = COALESCE($9, cause_of_death)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.status)
    .bind(body.case_type)
    .bind(body.fir_number)
    .bind(body.police_station)
    .bind(body.examination_findings)
    .bind(body.medical_opinion)
    .bind(body.cause_of_death)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(filter_mlc_case_response(row, &restricted_fields)))
}

// ══════════════════════════════════════════════════════════
//  MLC Documents
// ══════════════════════════════════════════════════════════

pub async fn list_mlc_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
) -> Result<Json<Vec<MlcDocument>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::mlc::LIST,
            permissions::emergency::mlc::PRINT,
            permissions::emergency::mlc::REPRINT,
            permissions::emergency::mlc_documents::SBAR_CREATE,
            permissions::emergency::mlc_documents::AGE_ESTIMATION_CREATE,
            permissions::emergency::mlc_documents::POCSO_CREATE,
            permissions::emergency::mlc_documents::COURT_SUMMONS_CREATE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcDocument>(
        "SELECT * FROM mlc_documents WHERE mlc_case_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_mlc_document_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_mlc_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
    Json(body): Json<CreateMlcDocumentRequest>,
) -> Result<Json<MlcDocument>, AppError> {
    let required_permission = mlc_document_create_permission(&body.document_type)?;
    require_permission(&claims, required_permission)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    if body.document_type == "pocso_report"
        && !mlc_field_is_writable(&restricted_fields, MLC_POCSO_REPORT_FIELD)
    {
        return Err(AppError::BadRequest(
            "Cannot write restricted MLC POCSO report content".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let is_pocso_case = sqlx::query_scalar::<_, bool>(
        "SELECT is_pocso FROM mlc_cases WHERE id = $1 AND tenant_id = $2",
    )
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if body.document_type == "pocso_report" && !is_pocso_case {
        return Err(AppError::BadRequest(
            "POCSO report can only be added to a POCSO-marked MLC case".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, MlcDocument>(
        "INSERT INTO mlc_documents (tenant_id, mlc_case_id, document_type, title, body_diagram, content, notes, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(mlc_id)
    .bind(&body.document_type)
    .bind(&body.title)
    .bind(body.body_diagram)
    .bind(&body.content)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(filter_mlc_document_response(row, &restricted_fields)))
}

// ══════════════════════════════════════════════════════════
//  MLC Police Intimations
// ══════════════════════════════════════════════════════════

pub async fn list_police_intimations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
) -> Result<Json<Vec<MlcPoliceIntimation>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::mlc_police_intimations::LIST,
            permissions::emergency::mlc_police_intimations::CREATE,
            permissions::emergency::mlc_police_intimations::CONFIRM,
            permissions::emergency::mlc_police_intimations::PRINT,
            permissions::emergency::mlc_police_intimations::REPRINT,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcPoliceIntimation>(
        "SELECT * FROM mlc_police_intimations WHERE mlc_case_id = $1 AND tenant_id = $2 ORDER BY sent_at DESC LIMIT 5000",
    )
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_mlc_police_intimation_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_police_intimation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
    Json(body): Json<CreatePoliceIntimationRequest>,
) -> Result<Json<MlcPoliceIntimation>, AppError> {
    require_permission(
        &claims,
        permissions::emergency::mlc_police_intimations::CREATE,
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    reject_restricted_mlc_field_writes(
        &[(MLC_POLICE_STATION_FIELD, "police_station", true)],
        &restricted_fields,
    )?;
    let police_station = body.police_station.trim();
    if police_station.is_empty() {
        return Err(AppError::BadRequest(
            "Police station is required".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM mlc_cases WHERE id = $1 AND tenant_id = $2",
    )
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let intimation_number = format!("PI-{}", Utc::now().format("%Y%m%d%H%M%S"));

    let row = sqlx::query_as::<_, MlcPoliceIntimation>(
        "INSERT INTO mlc_police_intimations (tenant_id, mlc_case_id, intimation_number, police_station,
            officer_name, officer_designation, officer_contact, sent_via, notes, sent_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(mlc_id)
    .bind(&intimation_number)
    .bind(police_station)
    .bind(body.officer_name)
    .bind(body.officer_designation)
    .bind(body.officer_contact)
    .bind(body.sent_via)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::EmergencyMlcPoliceIntimationCreated,
        row.id,
        claims.sub,
        serde_json::json!({
            "intimation_id": row.id,
            "mlc_case_id": row.mlc_case_id,
            "patient_id": patient_id,
            "intimation_number": &row.intimation_number,
            "sent_at": row.sent_at,
            "sent_via": &row.sent_via,
        }),
    )
    .with_patient(patient_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    tx.commit().await?;
    Ok(Json(filter_mlc_police_intimation_response(
        row,
        &restricted_fields,
    )))
}

pub async fn confirm_police_receipt(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ConfirmPoliceReceiptRequest>,
) -> Result<Json<MlcPoliceIntimation>, AppError> {
    require_permission(
        &claims,
        permissions::emergency::mlc_police_intimations::CONFIRM,
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let receipt_number = body.receipt_number.trim();
    if receipt_number.is_empty() {
        return Err(AppError::BadRequest(
            "Police receipt number is required".to_owned(),
        ));
    }
    let notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MlcPoliceIntimation>(
        "UPDATE mlc_police_intimations SET receipt_confirmed = true, receipt_confirmed_at = now()
            , receipt_number = $3, notes = COALESCE($4, notes)
         WHERE id = $1 AND tenant_id = $2 AND receipt_confirmed = false
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(receipt_number)
    .bind(notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Police receipt already confirmed or intimation not found".to_owned())
    })?;
    tx.commit().await?;
    Ok(Json(filter_mlc_police_intimation_response(
        row,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  Mass Casualty Events
// ══════════════════════════════════════════════════════════

pub async fn list_mass_casualty_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MassCasualtyEvent>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::emergency::mass_casualty::LIST,
            permissions::emergency::mass_casualty::UPDATE,
            permissions::emergency::mass_casualty::CLOSE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MassCasualtyEvent>(
        "SELECT * FROM mass_casualty_events WHERE tenant_id = $1 ORDER BY activated_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_mass_casualty_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMassCasualtyEventRequest>,
) -> Result<Json<MassCasualtyEvent>, AppError> {
    require_permission(&claims, permissions::emergency::mass_casualty::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MassCasualtyEvent>(
        "INSERT INTO mass_casualty_events (tenant_id, event_name, event_type, location, estimated_casualties, notes, activated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.event_name)
    .bind(body.event_type)
    .bind(body.location)
    .bind(body.estimated_casualties)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_mass_casualty_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMassCasualtyEventRequest>,
) -> Result<Json<MassCasualtyEvent>, AppError> {
    match body.status.as_deref() {
        Some("deactivated") => {
            require_permission(&claims, permissions::emergency::mass_casualty::CLOSE)?;
        }
        Some("activated" | "ongoing" | "scaling_down") | None => {
            require_permission(&claims, permissions::emergency::mass_casualty::UPDATE)?;
        }
        Some(_) => {
            return Err(AppError::BadRequest(
                "Unsupported mass casualty status".to_owned(),
            ));
        }
    }
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MassCasualtyEvent>(
        "UPDATE mass_casualty_events SET
            status = COALESCE($3::mass_casualty_status, status),
            deactivated_at = CASE WHEN $3 = 'deactivated' THEN now() ELSE deactivated_at END,
            deactivated_by = CASE WHEN $3 = 'deactivated' THEN $9 ELSE deactivated_by END,
            actual_casualties = COALESCE($4, actual_casualties),
            triage_summary = COALESCE($5, triage_summary),
            resources_deployed = COALESCE($6, resources_deployed),
            notifications_sent = COALESCE($7, notifications_sent),
            notes = COALESCE($8, notes)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.status)
    .bind(body.actual_casualties)
    .bind(body.triage_summary)
    .bind(body.resources_deployed)
    .bind(body.notifications_sent)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  ER-to-IPD Admission
// ══════════════════════════════════════════════════════════

/// POST /api/emergency/visits/{id}/admit
pub async fn admit_from_er(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdmitFromErRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ErAdmissionSource {
        patient_id: Uuid,
        chief_complaint: Option<String>,
        admission_id: Option<Uuid>,
        status: String,
    }

    let visit = sqlx::query_as::<_, ErAdmissionSource>(
        "SELECT patient_id, chief_complaint, admission_id, status::text AS status \
         FROM er_visits \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if visit.admission_id.is_some() || visit.status == "admitted" {
        return Err(AppError::Conflict(
            "ER visit is already linked to an IPD admission".to_owned(),
        ));
    }

    // ER admission is a second admission front door — apply the same patient-integrity
    // guards as the direct IPD create_admission path. A patient can occupy only one bed,
    // so block a second active admission (e.g. a stale ER visit after a direct admit).
    if let Some(existing) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM admissions \
         WHERE tenant_id = $1 AND patient_id = $2 \
           AND status IN ('admitted'::admission_status, 'transferred'::admission_status) \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(visit.patient_id)
    .fetch_optional(&mut *tx)
    .await?
    {
        return Err(AppError::Conflict(format!(
            "Patient already has an active admission ({existing}); discharge or transfer it \
             before admitting from the ER."
        )));
    }

    // A patient recorded as deceased must never be admitted.
    if sqlx::query_scalar::<_, bool>(
        "SELECT is_deceased FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(visit.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(false)
    {
        return Err(AppError::Conflict(
            "Patient is recorded as deceased and cannot be admitted.".to_owned(),
        ));
    }

    let doctor_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
           SELECT 1 FROM users \
           WHERE id = $1 AND tenant_id = $2 AND role = 'doctor' AND is_active = true \
         )",
    )
    .bind(body.admitting_doctor_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if !doctor_exists {
        return Err(AppError::BadRequest(
            "Admitting doctor must be an active doctor in this hospital".to_owned(),
        ));
    }

    let admission_notes = body
        .admission_notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    let reason = admission_notes
        .clone()
        .or_else(|| visit.chief_complaint.clone())
        .unwrap_or_else(|| "ER admission".to_owned());

    let (bed_ward_id, bed_status, current_admission_id) =
        sqlx::query_as::<_, (Option<Uuid>, String, Option<Uuid>)>(
            "SELECT ward_id, status::text AS status, admission_id \
             FROM bed_states \
             WHERE location_id = $1 AND tenant_id = $2 \
             FOR UPDATE",
        )
        .bind(body.bed_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::BadRequest("Selected bed is not configured".to_owned()))?;

    if bed_status != "vacant_clean" || current_admission_id.is_some() {
        return Err(AppError::BadRequest(
            "Selected bed is not vacant and clean".to_owned(),
        ));
    }

    let reserved_for_other_patient = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
           SELECT 1 FROM bed_reservations \
           WHERE tenant_id = $1 AND bed_id = $2 \
             AND status IN ('active', 'confirmed') \
             AND reserved_until > NOW() \
             AND patient_id <> $3 \
         )",
    )
    .bind(claims.tenant_id)
    .bind(body.bed_id)
    .bind(visit.patient_id)
    .fetch_one(&mut *tx)
    .await?;

    if reserved_for_other_patient {
        return Err(AppError::BadRequest(
            "Selected bed is reserved for another patient".to_owned(),
        ));
    }

    if let (Some(requested_ward_id), Some(selected_bed_ward_id)) = (body.ward_id, bed_ward_id) {
        if requested_ward_id != selected_bed_ward_id {
            return Err(AppError::BadRequest(
                "Selected bed does not belong to the requested ward".to_owned(),
            ));
        }
    }
    let admission_ward_id = bed_ward_id.or(body.ward_id);

    let encounter_date =
        medbrains_server_core::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;
    let encounter_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, doctor_id, encounter_date, notes, attributes) \
         VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(visit.patient_id)
    .bind(body.admitting_doctor_id)
    .bind(encounter_date)
    .bind(&reason)
    .bind(serde_json::json!({
        "source": "er",
        "er_visit_id": id,
    }))
    .fetch_one(&mut *tx)
    .await?;

    // Create the IPD admission
    let admission_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO admissions \
         (tenant_id, encounter_id, patient_id, bed_id, admitting_doctor, status, admitted_at, \
          admission_source, referral_notes, ward_id, er_visit_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, 'admitted'::admission_status, now(), \
                 'er'::admission_source, $6, $7, $8, $9) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(visit.patient_id)
    .bind(body.bed_id)
    .bind(body.admitting_doctor_id)
    .bind(&reason)
    .bind(admission_ward_id)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE bed_states \
         SET ward_id = COALESCE($3, ward_id), admission_id = $4, patient_id = $5, \
             status = 'occupied'::bed_status, changed_by = $6, changed_at = now(), \
             reason = $7, reserved_for_patient = NULL, reserved_until = NULL \
         WHERE location_id = $1 AND tenant_id = $2",
    )
    .bind(body.bed_id)
    .bind(claims.tenant_id)
    .bind(admission_ward_id)
    .bind(admission_id)
    .bind(visit.patient_id)
    .bind(claims.sub)
    .bind(&reason)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE bed_reservations SET status = 'fulfilled'::bed_reservation_status \
         WHERE tenant_id = $1 AND bed_id = $2 AND patient_id = $3 \
           AND status IN ('active', 'confirmed') \
           AND reserved_until > NOW()",
    )
    .bind(claims.tenant_id)
    .bind(body.bed_id)
    .bind(visit.patient_id)
    .execute(&mut *tx)
    .await?;

    // Update ER visit disposition
    sqlx::query(
        "UPDATE er_visits \
         SET status = 'admitted'::er_visit_status, disposition = 'admitted', \
             disposition_time = now(), disposition_notes = $3, admission_id = $4, \
             admitted_to = $5::text, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&reason)
    .bind(admission_id)
    .bind(admission_ward_id.map(|value| value.to_string()))
    .execute(&mut *tx)
    .await?;

    let admission_event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::IpdAdmissionCreated,
        admission_id,
        claims.sub,
        serde_json::json!({
            "admission_id": admission_id,
            "patient_id": visit.patient_id,
            "encounter_id": encounter_id,
            "er_visit_id": id,
            "ward_id": admission_ward_id,
            "bed_id": body.bed_id,
            "admission_source": "er",
        }),
    )
    .with_patient(visit.patient_id)
    .with_admission(admission_id)
    .with_encounter(encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &admission_event).await?;

    let bed_event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::BedAssigned,
        admission_id,
        claims.sub,
        serde_json::json!({
            "bed_id": body.bed_id,
            "admission_id": admission_id,
            "patient_id": visit.patient_id,
            "encounter_id": encounter_id,
            "er_visit_id": id,
            "ward_id": admission_ward_id,
            "reason": reason,
        }),
    )
    .with_patient(visit.patient_id)
    .with_admission(admission_id)
    .with_encounter(encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &bed_event).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "er_visit_id": id,
        "admission_id": admission_id,
        "encounter_id": encounter_id,
        "patient_id": visit.patient_id,
        "ward_id": admission_ward_id,
        "bed_id": body.bed_id,
        "status": "admitted"
    })))
}

// ══════════════════════════════════════════════════════════
//  ER Discharge Summary
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ErDischargeSummaryRequest {
    pub final_diagnosis: Option<String>,
    pub condition_at_discharge: Option<String>,
    pub clinical_course: Option<String>,
    pub treatment_given: Option<String>,
    pub medications_on_discharge: Option<String>,
    pub follow_up_instructions: Option<String>,
    pub follow_up_date: Option<chrono::NaiveDate>,
    pub warning_signs: Option<String>,
}

pub async fn get_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(er_visit_id): Path<Uuid>,
) -> Result<Json<Option<ErDischargeSummary>>, AppError> {
    require_permission(&claims, permissions::emergency::visits::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErDischargeSummary>(
        "SELECT * FROM er_discharge_summaries WHERE er_visit_id = $1 AND tenant_id = $2",
    )
    .bind(er_visit_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(er_visit_id): Path<Uuid>,
    Json(body): Json<ErDischargeSummaryRequest>,
) -> Result<Json<ErDischargeSummary>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErDischargeSummary>(
        "INSERT INTO er_discharge_summaries \
           (tenant_id, er_visit_id, final_diagnosis, condition_at_discharge, clinical_course, \
            treatment_given, medications_on_discharge, follow_up_instructions, follow_up_date, \
            warning_signs, prepared_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(er_visit_id)
    .bind(&body.final_diagnosis)
    .bind(&body.condition_at_discharge)
    .bind(&body.clinical_course)
    .bind(&body.treatment_given)
    .bind(&body.medications_on_discharge)
    .bind(&body.follow_up_instructions)
    .bind(body.follow_up_date)
    .bind(&body.warning_signs)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(er_visit_id): Path<Uuid>,
    Json(body): Json<ErDischargeSummaryRequest>,
) -> Result<Json<ErDischargeSummary>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErDischargeSummary>(
        "UPDATE er_discharge_summaries SET \
           final_diagnosis = $3, condition_at_discharge = $4, clinical_course = $5, \
           treatment_given = $6, medications_on_discharge = $7, follow_up_instructions = $8, \
           follow_up_date = $9, warning_signs = $10, updated_at = now() \
         WHERE er_visit_id = $1 AND tenant_id = $2 \
           AND status = 'draft'::discharge_summary_status RETURNING *",
    )
    .bind(er_visit_id)
    .bind(claims.tenant_id)
    .bind(&body.final_diagnosis)
    .bind(&body.condition_at_discharge)
    .bind(&body.clinical_course)
    .bind(&body.treatment_given)
    .bind(&body.medications_on_discharge)
    .bind(&body.follow_up_instructions)
    .bind(body.follow_up_date)
    .bind(&body.warning_signs)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Discharge summary not found or already finalized".to_owned())
    })?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn finalize_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(er_visit_id): Path<Uuid>,
) -> Result<Json<ErDischargeSummary>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErDischargeSummary>(
        "UPDATE er_discharge_summaries SET \
           status = 'finalized'::discharge_summary_status, verified_by = $3, finalized_at = now(), \
           updated_at = now() \
         WHERE er_visit_id = $1 AND tenant_id = $2 \
           AND status = 'draft'::discharge_summary_status RETURNING *",
    )
    .bind(er_visit_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Discharge summary not found or already finalized".to_owned())
    })?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  ER Observation chart
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateObservationNoteRequest {
    pub pulse: Option<i32>,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub resp_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature: Option<f64>,
    pub gcs: Option<i32>,
    pub pain_score: Option<i32>,
    pub note: Option<String>,
}

pub async fn list_observation_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
) -> Result<Json<Vec<ErObservationNote>>, AppError> {
    require_permission(&claims, permissions::emergency::visits::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErObservationNote>(
        "SELECT * FROM er_observation_notes \
         WHERE er_visit_id = $1 AND tenant_id = $2 ORDER BY observed_at ASC LIMIT 5000",
    )
    .bind(visit_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_observation_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<CreateObservationNoteRequest>,
) -> Result<Json<ErObservationNote>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;

    let note = trim_optional_text(body.note.as_deref());
    let has_vitals = body.pulse.is_some()
        || body.bp_systolic.is_some()
        || body.bp_diastolic.is_some()
        || body.resp_rate.is_some()
        || body.spo2.is_some()
        || body.temperature.is_some()
        || body.gcs.is_some()
        || body.pain_score.is_some();
    if note.is_none() && !has_vitals {
        return Err(AppError::BadRequest(
            "Record at least one vital or a note".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErObservationNote>(
        "INSERT INTO er_observation_notes \
           (tenant_id, er_visit_id, pulse, bp_systolic, bp_diastolic, resp_rate, spo2, \
            temperature, gcs, pain_score, note, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(visit_id)
    .bind(body.pulse)
    .bind(body.bp_systolic)
    .bind(body.bp_diastolic)
    .bind(body.resp_rate)
    .bind(body.spo2)
    .bind(body.temperature)
    .bind(body.gcs)
    .bind(body.pain_score)
    .bind(&note)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  ER Bays (master)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ErBayRequest {
    pub code: String,
    pub name: String,
    pub bay_type: Option<String>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
    pub notes: Option<String>,
}

pub async fn list_bays(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ErBay>>, AppError> {
    require_permission(&claims, permissions::emergency::visits::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErBay>(
        "SELECT * FROM er_bays WHERE tenant_id = $1 ORDER BY sort_order ASC, name ASC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_bay(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ErBayRequest>,
) -> Result<Json<ErBay>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let code = body.code.trim();
    let name = body.name.trim();
    if code.is_empty() || name.is_empty() {
        return Err(AppError::BadRequest(
            "Code and name are required".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ErBay>(
        "INSERT INTO er_bays (tenant_id, code, name, bay_type, is_active, sort_order, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, true), COALESCE($6, 0), $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .bind(name)
    .bind(trim_optional_text(body.bay_type.as_deref()))
    .bind(body.is_active)
    .bind(body.sort_order)
    .bind(trim_optional_text(body.notes.as_deref()))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_bay(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ErBayRequest>,
) -> Result<Json<ErBay>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ErBay>(
        "UPDATE er_bays SET \
           code = $3, name = $4, bay_type = $5, is_active = COALESCE($6, is_active), \
           sort_order = COALESCE($7, sort_order), notes = $8, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.code.trim())
    .bind(body.name.trim())
    .bind(trim_optional_text(body.bay_type.as_deref()))
    .bind(body.is_active)
    .bind(body.sort_order)
    .bind(trim_optional_text(body.notes.as_deref()))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Emergency department (triage, ER register, MLC, disaster) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/emergency/visits",
            get(list_visits).post(create_visit),
        )
        .route(
            "/api/emergency/visits/{id}",
            get(get_visit).put(update_visit),
        )
        .route(
            "/api/emergency/bays",
            get(list_bays).post(create_bay),
        )
        .route("/api/emergency/bays/{id}", put(update_bay))
        .route(
            "/api/emergency/visits/{id}/discharge-summary",
            get(get_discharge_summary)
                .post(create_discharge_summary)
                .put(update_discharge_summary),
        )
        .route(
            "/api/emergency/visits/{id}/discharge-summary/finalize",
            post(finalize_discharge_summary),
        )
        .route(
            "/api/emergency/visits/{visit_id}/triage",
            get(list_triage).post(create_triage),
        )
        .route(
            "/api/emergency/visits/{visit_id}/observation-notes",
            get(list_observation_notes).post(create_observation_note),
        )
        .route(
            "/api/emergency/visits/{visit_id}/resuscitation",
            get(list_resuscitation_logs).post(create_resuscitation_log),
        )
        .route(
            "/api/emergency/codes",
            get(list_code_activations).post(create_code_activation),
        )
        .route(
            "/api/emergency/codes/{id}/deactivate",
            put(deactivate_code),
        )
        .route(
            "/api/emergency/mlc",
            get(list_mlc_cases).post(create_mlc_case),
        )
        .route(
            "/api/emergency/mlc/{id}",
            put(update_mlc_case),
        )
        .route(
            "/api/emergency/mlc/{mlc_id}/documents",
            get(list_mlc_documents).post(create_mlc_document),
        )
        .route(
            "/api/emergency/mlc/{mlc_id}/police-intimations",
            get(list_police_intimations).post(create_police_intimation),
        )
        .route(
            "/api/emergency/mlc/police-intimations/{id}/confirm",
            put(confirm_police_receipt),
        )
        .route(
            "/api/emergency/mass-casualty",
            get(list_mass_casualty_events).post(create_mass_casualty_event),
        )
        .route(
            "/api/emergency/mass-casualty/{id}",
            put(update_mass_casualty_event),
        )
        .route(
            "/api/emergency/visits/{id}/admit",
            post(admit_from_er),
        )
}
