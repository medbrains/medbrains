#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::emergency::{
    ErCodeActivation, ErResuscitationLog, ErTriageAssessment, ErVisit, MassCasualtyEvent, MlcCase,
    MlcDocument, MlcPoliceIntimation,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request types
// ══════════════════════════════════════════════════════════

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
    pub location: Option<String>,
    pub response_team: Option<serde_json::Value>,
    pub crash_cart_checklist: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeactivateCodeRequest {
    pub outcome: Option<String>,
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

// ══════════════════════════════════════════════════════════
//  ER Visits
// ══════════════════════════════════════════════════════════

pub async fn list_visits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ErVisit>>, AppError> {
    require_permission(&claims, permissions::emergency::visits::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErVisit>(
        "SELECT * FROM er_visits WHERE tenant_id = $1 ORDER BY arrival_time DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ErVisit>, AppError> {
    require_permission(&claims, permissions::emergency::visits::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row =
        sqlx::query_as::<_, ErVisit>("SELECT * FROM er_visits WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVisitRequest>,
) -> Result<Json<ErVisit>, AppError> {
    require_permission(&claims, permissions::emergency::visits::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let visit_number = format!("ER-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

    let row = sqlx::query_as::<_, ErVisit>(
        "INSERT INTO er_visits (tenant_id, patient_id, visit_number, arrival_mode, chief_complaint, is_mlc, is_brought_dead, bay_number, vitals, notes, mass_casualty_event_id, created_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, false), $8, $9, $10, $11, $12)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&visit_number)
    .bind(body.arrival_mode)
    .bind(body.chief_complaint)
    .bind(body.is_mlc)
    .bind(body.is_brought_dead)
    .bind(body.bay_number)
    .bind(body.vitals)
    .bind(body.notes)
    .bind(body.mass_casualty_event_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-bill ER consultation charge
    if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "emergency")
        .await
        .unwrap_or(false)
    {
        let _ = super::billing::create_service_charge(
            &mut tx,
            super::billing::ServiceChargeInput {
                tenant_id: claims.tenant_id,
                patient_id: row.patient_id,
                encounter_id: row.id,
                charge_code: "ER_CONSULTATION",
                quantity: 1,
                source_module: "emergency",
                source_entity_id: row.id,
                requested_by: claims.sub,
            },
        )
        .await;
    }

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVisitRequest>,
) -> Result<Json<ErVisit>, AppError> {
    require_permission(&claims, permissions::emergency::visits::UPDATE)?;
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
    require_permission(&claims, permissions::emergency::triage::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ErTriageAssessment>(
        "SELECT * FROM er_triage_assessments WHERE er_visit_id = $1 AND tenant_id = $2 ORDER BY assessed_at DESC",
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
    .bind(body.triage_system)
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
    .bind(body.chief_complaint)
    .bind(body.presenting_symptoms)
    .bind(body.allergies)
    .bind(body.is_pregnant)
    .bind(body.disability_assessment)
    .bind(body.notes)
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
    require_permission(&claims, permissions::emergency::resuscitation::LIST)?;
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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ErResuscitationLog>(
        "INSERT INTO er_resuscitation_logs (tenant_id, er_visit_id, log_type, medication_name, dose, route,
            fluid_name, fluid_volume_ml, procedure_name, procedure_notes, vitals_snapshot, notes, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(visit_id)
    .bind(&body.log_type)
    .bind(body.medication_name)
    .bind(body.dose)
    .bind(body.route)
    .bind(body.fluid_name)
    .bind(body.fluid_volume_ml)
    .bind(body.procedure_name)
    .bind(body.procedure_notes)
    .bind(body.vitals_snapshot)
    .bind(body.notes)
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
    require_permission(&claims, permissions::emergency::codes::LIST)?;
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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ErCodeActivation>(
        "INSERT INTO er_code_activations (tenant_id, er_visit_id, code_type, location, response_team, crash_cart_checklist, notes, activated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.er_visit_id)
    .bind(&body.code_type)
    .bind(body.location)
    .bind(body.response_team)
    .bind(body.crash_cart_checklist)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // ── Break-glass — auto-grant 4h `code_blue_team` group membership ─
    // Activator gets temporary clinical-override access. Membership
    // expires automatically; the SpiceDB Watch consumer (M5) bumps
    // perm_version when expiry fires so the JWT is re-issued without
    // the elevated grant.
    let break_glass_expiry = chrono::Utc::now() + chrono::Duration::hours(4);
    let group_id: Option<uuid::Uuid> = sqlx::query_scalar(
        "SELECT id FROM access_groups \
         WHERE tenant_id = $1 AND code = 'code_blue_team' AND is_active = true",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
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
                &crate::middleware::authorization::authz_context(&claims),
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
    require_permission(&claims, permissions::emergency::codes::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ErCodeActivation>(
        "UPDATE er_code_activations SET deactivated_at = now(), outcome = $3, notes = COALESCE($4, notes), deactivated_by = $5
         WHERE id = $1 AND tenant_id = $2
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.outcome)
    .bind(body.notes)
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
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcCase>(
        "SELECT * FROM mlc_cases WHERE tenant_id = $1 ORDER BY registered_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_mlc_case(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMlcCaseRequest>,
) -> Result<Json<MlcCase>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mlc_number = format!("MLC-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

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
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_mlc_case(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMlcCaseRequest>,
) -> Result<Json<MlcCase>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
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
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  MLC Documents
// ══════════════════════════════════════════════════════════

pub async fn list_mlc_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
) -> Result<Json<Vec<MlcDocument>>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcDocument>(
        "SELECT * FROM mlc_documents WHERE mlc_case_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
    )
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_mlc_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
    Json(body): Json<CreateMlcDocumentRequest>,
) -> Result<Json<MlcDocument>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
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
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  MLC Police Intimations
// ══════════════════════════════════════════════════════════

pub async fn list_police_intimations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
) -> Result<Json<Vec<MlcPoliceIntimation>>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcPoliceIntimation>(
        "SELECT * FROM mlc_police_intimations WHERE mlc_case_id = $1 AND tenant_id = $2 ORDER BY sent_at DESC",
    )
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_police_intimation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
    Json(body): Json<CreatePoliceIntimationRequest>,
) -> Result<Json<MlcPoliceIntimation>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let intimation_number = format!("PI-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

    let row = sqlx::query_as::<_, MlcPoliceIntimation>(
        "INSERT INTO mlc_police_intimations (tenant_id, mlc_case_id, intimation_number, police_station,
            officer_name, officer_designation, officer_contact, sent_via, notes, sent_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(mlc_id)
    .bind(&intimation_number)
    .bind(&body.police_station)
    .bind(body.officer_name)
    .bind(body.officer_designation)
    .bind(body.officer_contact)
    .bind(body.sent_via)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn confirm_police_receipt(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MlcPoliceIntimation>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MlcPoliceIntimation>(
        "UPDATE mlc_police_intimations SET receipt_confirmed = true, receipt_confirmed_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Mass Casualty Events
// ══════════════════════════════════════════════════════════

pub async fn list_mass_casualty_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MassCasualtyEvent>>, AppError> {
    require_permission(&claims, permissions::emergency::mass_casualty::LIST)?;
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
    require_permission(&claims, permissions::emergency::mass_casualty::UPDATE)?;
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
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::emergency::visits::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify the ER visit exists
    let visit_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM er_visits WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let ward_id = body
        .get("ward_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok());

    let bed_id = body
        .get("bed_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok());

    let admitting_doctor_id = body
        .get("admitting_doctor_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok());

    let reason = body
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("ER admission");

    // Create the IPD admission
    let admission_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO admissions \
         (tenant_id, patient_id, ward_id, bed_id, admitting_doctor_id, \
          admission_type, reason, status, admitted_by, er_visit_id) \
         VALUES ($1, $2, $3, $4, $5, 'emergency', $6, 'admitted', $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(visit_patient_id)
    .bind(ward_id)
    .bind(bed_id)
    .bind(admitting_doctor_id)
    .bind(reason)
    .bind(claims.sub)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    // Update ER visit disposition
    sqlx::query(
        "UPDATE er_visits SET disposition = 'admitted', \
         disposition_time = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "er_visit_id": id,
        "admission_id": admission_id,
        "patient_id": visit_patient_id,
        "status": "admitted"
    })))
}
