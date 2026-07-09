#![allow(clippy::too_many_lines)]

use std::{
    collections::HashMap,
    sync::{LazyLock, RwLock},
    time::{Duration, Instant},
};

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::DateTime;
use chrono::{NaiveDate, NaiveTime, Utc};
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::consultation::{
    ChiefComplaintMaster, Consultation, ConsultationTemplate, Diagnosis, DoctorDocket, Icd10Code,
    MedicalCertificate, PatientFeedback, PatientReminder, Prescription, PrescriptionItem,
    PrescriptionTemplate, ProcedureCatalog, ProcedureConsent, ProcedureOrder, Referral, SnomedCode,
    Vital,
};
use medbrains_core::encounter::{Encounter, EncounterStatus, EncounterType, OpdQueue};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::ipd::Admission;
use medbrains_core::permissions;
use medbrains_core::privacy::mask_free_text;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{require_any_permission, require_permission},
        field_access,
    },
    routes::notifications::{NewNotification, create_notification},
    state::AppState,
};

const OPD_ENCOUNTER_WORKSPACE_PERMISSIONS: &[&str] = &[
    permissions::opd::queue::VIEW,
    permissions::opd::visit::UPDATE,
    permissions::opd::vitals::LIST,
    permissions::opd::vitals::CREATE,
    permissions::opd::diagnoses::LIST,
    permissions::opd::diagnoses::CREATE,
    permissions::opd::diagnoses::UPDATE,
    permissions::opd::diagnoses::DELETE,
    permissions::opd::procedures::LIST,
    permissions::opd::procedures::CREATE,
    permissions::opd::procedures::CANCEL,
    permissions::opd::referrals::LIST,
    permissions::opd::referrals::CREATE,
    permissions::opd::certificates::LIST,
    permissions::opd::certificates::CREATE,
    permissions::opd::certificates::PRINT,
    permissions::opd::certificates::REPRINT,
    permissions::opd::certificates::VOID,
    permissions::opd::reminders::LIST,
    permissions::opd::reminders::CREATE,
    permissions::opd::reminders::UPDATE,
    permissions::opd::feedback::LIST,
    permissions::opd::feedback::CREATE,
    permissions::opd::consents::LIST,
    permissions::opd::consents::CREATE,
    permissions::opd::consents::SIGN,
    permissions::opd::consents::PRINT,
    permissions::opd::consents::REPRINT,
    permissions::opd::consents::REVOKE,
    permissions::opd::schedule::LIST,
    permissions::opd::schedule::MANAGE,
    permissions::pharmacy::prescriptions::LIST,
    permissions::pharmacy::dispensing::CREATE,
    permissions::lab::orders::LIST,
    permissions::lab::orders::VIEW,
    permissions::lab::reports::VIEW,
    permissions::lab::orders::CREATE,
    permissions::radiology::orders::LIST,
    permissions::radiology::orders::VIEW,
    permissions::radiology::orders::CREATE,
    permissions::insurance::prior_auth::LIST,
    permissions::insurance::prior_auth::CREATE,
    permissions::mrd::case_sheets::GENERATE,
];

fn claims_have_permission(claims: &Claims, permission: &str) -> bool {
    crate::middleware::authorization::is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|granted| granted == permission)
}

// ══════════════════════════════════════════════════════════
//  Query / Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListEncountersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub date: Option<NaiveDate>,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EncounterListResponse {
    pub encounters: Vec<Encounter>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateEncounterRequest {
    pub patient_id: Uuid,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub appointment_id: Option<Uuid>,
    pub notes: Option<String>,
    pub visit_type: Option<String>,
    pub camp_id: Option<Uuid>,
    /// Internal training / simulator flag. Only honoured for bypass roles
    /// (super_admin, hospital_admin); silently coerced to false otherwise.
    /// Tagged rows must be excluded from regulator-facing reports.
    #[serde(default)]
    pub is_dummy: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CreateEncounterResponse {
    pub encounter: Encounter,
    pub queue: OpdQueue,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEncounterRequest {
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub notes: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListQueueQuery {
    pub date: Option<NaiveDate>,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub visit_type: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
    /// When true, restrict the result to entries where `doctor_id`
    /// equals the calling user's id. Lets a doctor's UI ask for
    /// "my queue today" without having to know the user's own
    /// staff record. Combined with `doctor_id` it acts as an AND
    /// (typical use is `mine=true` alone).
    pub mine: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QueueEntry {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub token_number: i32,
    pub status: String,
    pub queue_date: NaiveDate,
    pub called_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub visit_type: Option<String>,
    pub camp_id: Option<Uuid>,
    pub camp_name: Option<String>,
    pub appointment_id: Option<Uuid>,
    pub appointment_type: Option<String>,
    pub appointment_status: Option<String>,
    pub appointment_date: Option<NaiveDate>,
    pub appointment_slot_start: Option<NaiveTime>,
    pub appointment_slot_end: Option<NaiveTime>,
    pub appointment_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVitalRequest {
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConsultationRequest {
    pub chief_complaint: Option<String>,
    pub history: Option<String>,
    pub examination: Option<String>,
    pub plan: Option<String>,
    pub notes: Option<String>,
    pub hpi: Option<String>,
    pub past_medical_history: Option<serde_json::Value>,
    pub past_surgical_history: Option<serde_json::Value>,
    pub family_history: Option<serde_json::Value>,
    pub social_history: Option<serde_json::Value>,
    pub review_of_systems: Option<serde_json::Value>,
    pub physical_examination: Option<serde_json::Value>,
    pub general_appearance: Option<String>,
    /// Inline lab orders attached to this consultation. Each row is
    /// inserted in the same transaction so a partial failure rolls
    /// back the consultation as well. Saves the doctor a hop to the
    /// Lab module.
    #[serde(default)]
    pub lab_orders: Vec<InlineLabOrder>,
    /// Same as `lab_orders`, for radiology.
    #[serde(default)]
    pub radiology_orders: Vec<InlineRadiologyOrder>,
}

#[derive(Debug, Deserialize)]
pub struct InlineLabOrder {
    pub test_id: Uuid,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InlineRadiologyOrder {
    pub modality_id: Uuid,
    #[serde(default)]
    pub body_part: Option<String>,
    #[serde(default)]
    pub clinical_indication: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConsultationRequest {
    pub chief_complaint: Option<String>,
    pub history: Option<String>,
    pub examination: Option<String>,
    pub plan: Option<String>,
    pub notes: Option<String>,
    pub hpi: Option<String>,
    pub past_medical_history: Option<serde_json::Value>,
    pub past_surgical_history: Option<serde_json::Value>,
    pub family_history: Option<serde_json::Value>,
    pub social_history: Option<serde_json::Value>,
    pub review_of_systems: Option<serde_json::Value>,
    pub physical_examination: Option<serde_json::Value>,
    pub general_appearance: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDiagnosisRequest {
    pub icd_code: Option<String>,
    pub icd_system: Option<String>,
    pub icd_display: Option<String>,
    pub icd_source_url: Option<String>,
    pub icd_source_version: Option<String>,
    pub icd_provider_mode: Option<String>,
    pub description: String,
    pub is_primary: Option<bool>,
    pub notes: Option<String>,
    pub severity: Option<String>,
    pub certainty: Option<String>,
    pub onset_date: Option<NaiveDate>,
    pub resolved_date: Option<NaiveDate>,
    pub snomed_code: Option<String>,
    pub snomed_display: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDiagnosisRequest {
    pub icd_code: Option<String>,
    pub icd_system: Option<String>,
    pub icd_display: Option<String>,
    pub icd_source_url: Option<String>,
    pub icd_source_version: Option<String>,
    pub icd_provider_mode: Option<String>,
    pub description: Option<String>,
    pub is_primary: Option<bool>,
    pub notes: Option<String>,
    pub severity: Option<String>,
    pub certainty: Option<String>,
    pub onset_date: Option<Option<NaiveDate>>,
    pub resolved_date: Option<Option<NaiveDate>>,
    pub snomed_code: Option<String>,
    pub snomed_display: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrescriptionRequest {
    pub notes: Option<String>,
    pub items: Vec<PrescriptionItemInput>,
    /// "written" (default), "verbal", or "telephone". Verbal/telephone orders
    /// are transcribed by a nurse and routed to the doctor for countersignature.
    pub order_mode: Option<String>,
    /// The prescribing doctor for a verbal/telephone order taken by a nurse.
    pub ordering_doctor_id: Option<Uuid>,
    /// Read-back confirmation — mandatory for verbal/telephone orders.
    pub read_back_confirmed: Option<bool>,
    /// Clinician's reason for prescribing over the catalogue max dose. Required
    /// (non-blank) when any line exceeds `max_dose_per_day`; logged to audit.
    pub dose_override_reason: Option<String>,
    /// Clinician's reason for prescribing despite a documented drug allergy.
    /// Required (non-blank) when a line conflicts with the patient's allergies.
    pub allergy_override_reason: Option<String>,
    /// Clinician's reason for prescribing despite a major/contraindicated
    /// drug-drug interaction. Required (non-blank) when the order pairs two
    /// drugs flagged in `drug_interactions` at major/contraindicated severity.
    pub interaction_override_reason: Option<String>,
    /// Clinician's reason for prescribing two drugs with the same active
    /// ingredient (therapeutic duplication). Required (non-blank) when two
    /// catalogued lines share a generic / INN.
    pub duplicate_override_reason: Option<String>,
    /// Clinician's reason for prescribing when the prescriber's medical registration
    /// has expired (`doctor_profiles.registration_valid_until` in the past). Required
    /// (non-blank) in that case; logged. Without it the prescription is blocked.
    pub credential_override_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrescriptionRequest {
    pub notes: Option<String>,
    pub items: Vec<PrescriptionItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct PrescriptionItemInput {
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub route: Option<String>,
    pub instructions: Option<String>,
    pub catalog_item_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct PrescriptionWithItems {
    pub prescription: Prescription,
    pub items: Vec<PrescriptionItem>,
    pub pharmacy_status: Option<String>,
    pub pharmacy_rx_queue_id: Option<Uuid>,
    pub pharmacy_order_id: Option<Uuid>,
}

// ══════════════════════════════════════════════════════════
//  Token generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SequenceResult {
    current_val: i64,
}

pub(crate) async fn generate_opd_token(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<i32, AppError> {
    let seq = sqlx::query_as::<_, SequenceResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'OPD_TOKEN' \
         RETURNING current_val",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let seq = seq.ok_or_else(|| {
        AppError::Internal("OPD_TOKEN sequence not configured for this tenant".to_owned())
    })?;

    i32::try_from(seq.current_val).map_err(|e| AppError::Internal(format!("token overflow: {e}")))
}

// ══════════════════════════════════════════════════════════
//  Doctor auto-assignment
// ══════════════════════════════════════════════════════════

/// Pick the doctor a walk-in should go to when a department is chosen but no specific doctor is:
/// the least-loaded active doctor who is a member of the department and (if a duty roster exists for
/// the department today) is on that roster. Load = today's active OPD queue count. Deterministic
/// tie-break so repeated calls fill evenly. Returns `None` if the department has no eligible doctor.
// ponytail: correlated count subquery is O(doctors-in-dept) — fine (a handful per dept); revisit
// only if a single department ever has hundreds of doctors.
pub(crate) async fn assign_department_doctor(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    department_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let doctor_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT u.id FROM users u \
         WHERE u.tenant_id = $1 AND u.is_active AND u.role = 'doctor' \
           AND ($2 = u.department_id OR $2 = ANY(u.department_ids)) \
           AND (NOT EXISTS (SELECT 1 FROM duty_rosters dr \
                    WHERE dr.tenant_id = $1 AND dr.department_id = $2 \
                      AND dr.roster_date = CURRENT_DATE) \
                OR EXISTS (SELECT 1 FROM duty_rosters dr \
                    JOIN employees e ON e.id = dr.employee_id \
                    WHERE dr.tenant_id = $1 AND dr.department_id = $2 \
                      AND dr.roster_date = CURRENT_DATE AND e.user_id = u.id)) \
         ORDER BY (SELECT count(*) FROM opd_queues q \
                    WHERE q.tenant_id = $1 AND q.doctor_id = u.id \
                      AND q.queue_date = CURRENT_DATE \
                      AND q.status IN ('waiting', 'called')) ASC, \
                  u.full_name, u.id \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(department_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(doctor_id)
}

// ══════════════════════════════════════════════════════════
//  MRD register-lock (opt-in, tenant-global)
// ══════════════════════════════════════════════════════════

const MRD_LOCK_MSG: &str = "Register the OPD visit before opening the medical record";

/// True when this tenant requires an OPD registration before medical records may be opened.
pub(crate) async fn mrd_lock_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<bool, AppError> {
    let value = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'mrd' AND key = 'require_opd_registration'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value.and_then(|v| v.as_bool()).unwrap_or(false))
}

/// When the lock is on, require the encounter to carry an OPD registration (a queue token).
pub(crate) async fn assert_encounter_registered(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    if !mrd_lock_enabled(tx, tenant_id).await? {
        return Ok(());
    }
    let registered = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM opd_queues WHERE tenant_id = $1 AND encounter_id = $2)",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut **tx)
    .await?;
    if registered {
        Ok(())
    } else {
        Err(AppError::Conflict(MRD_LOCK_MSG.to_owned()))
    }
}

/// When the lock is on, require the patient to have an open OPD encounter / a registration today.
pub(crate) async fn assert_patient_opd_registered(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    if !mrd_lock_enabled(tx, tenant_id).await? {
        return Ok(());
    }
    let registered = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM encounters \
            WHERE tenant_id = $1 AND patient_id = $2 \
              AND encounter_type = 'opd' AND status = 'open') \
         OR EXISTS (SELECT 1 FROM opd_queues q \
            JOIN encounters e ON e.id = q.encounter_id \
            WHERE q.tenant_id = $1 AND q.queue_date = CURRENT_DATE AND e.patient_id = $2)",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if registered {
        Ok(())
    } else {
        Err(AppError::Conflict(MRD_LOCK_MSG.to_owned()))
    }
}

/// Whether the tenant requires OPD registration before medical records may be opened.
#[derive(Debug, serde::Serialize)]
pub struct OpdRegistrationPolicy {
    pub require_opd_registration: bool,
}

/// `GET /api/opd/registration-policy`
pub async fn get_registration_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OpdRegistrationPolicy>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let require_opd_registration = mrd_lock_enabled(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(OpdRegistrationPolicy { require_opd_registration }))
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateRegistrationPolicyRequest {
    pub require_opd_registration: bool,
}

/// `PUT /api/opd/registration-policy`
pub async fn update_registration_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateRegistrationPolicyRequest>,
) -> Result<Json<OpdRegistrationPolicy>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'mrd', 'require_opd_registration', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(serde_json::Value::Bool(body.require_opd_registration))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(OpdRegistrationPolicy {
        require_opd_registration: body.require_opd_registration,
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/opd/encounters
// ══════════════════════════════════════════════════════════

pub async fn list_encounters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEncountersQuery>,
) -> Result<Json<EncounterListResponse>, AppError> {
    require_permission(&claims, permissions::opd::queue::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // ── ReBAC scope — only encounters caller has `view` on ─────
    let authz_ctx = crate::middleware::authorization::authz_context(&claims);
    let visible_ids: Option<Vec<Uuid>> = if authz_ctx.is_bypass {
        None
    } else {
        Some(
            state
                .authz
                .list_accessible(&authz_ctx, "encounter", medbrains_authz::Relation::Viewer)
                .await
                .unwrap_or_default(),
        )
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec![
        "tenant_id = $1".to_owned(),
        "encounter_type = 'opd'".to_owned(),
    ];
    let mut bind_idx: usize = 2;
    if let Some(ref ids) = visible_ids {
        if ids.is_empty() {
            return Ok(Json(EncounterListResponse {
                encounters: Vec::new(),
                total: 0,
                page,
                per_page,
            }));
        }
        conditions.push(format!("id = ANY(${bind_idx}::uuid[])"));
        bind_idx += 1;
    }

    #[allow(clippy::items_after_statements, clippy::struct_field_names)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
        date_val: Option<NaiveDate>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(date) = params.date {
        conditions.push(format!("encounter_date = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: None,
            date_val: Some(date),
        });
        bind_idx += 1;
    }
    if let Some(dept) = params.department_id {
        conditions.push(format!("department_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(dept),
            string_val: None,
            date_val: None,
        });
        bind_idx += 1;
    }
    if let Some(doc) = params.doctor_id {
        conditions.push(format!("doctor_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(doc),
            string_val: None,
            date_val: None,
        });
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("patient_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(pid),
            string_val: None,
            date_val: None,
        });
        bind_idx += 1;
    }
    if let Some(ref status) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
            date_val: None,
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM encounters WHERE {where_clause}");
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            count_q = count_q.bind(u);
        }
        if let Some(ref s) = b.string_val {
            count_q = count_q.bind(s.clone());
        }
        if let Some(d) = b.date_val {
            count_q = count_q.bind(d);
        }
    }
    if let Some(ref ids) = visible_ids {
        count_q = count_q.bind(ids.clone());
    }
    let total = count_q.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM encounters WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut data_q = sqlx::query_as::<_, Encounter>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            data_q = data_q.bind(u);
        }
        if let Some(ref s) = b.string_val {
            data_q = data_q.bind(s.clone());
        }
        if let Some(d) = b.date_val {
            data_q = data_q.bind(d);
        }
    }
    if let Some(ref ids) = visible_ids {
        data_q = data_q.bind(ids.clone());
    }
    let encounters = data_q
        .bind(per_page)
        .bind(offset)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(EncounterListResponse {
        encounters,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/opd/encounters
// ══════════════════════════════════════════════════════════

pub async fn create_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEncounterRequest>,
) -> Result<Json<CreateEncounterResponse>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;
    if body.appointment_id.is_some() {
        require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Validate the patient belongs to the caller's tenant before creating an
    // encounter — encounters.patient_id FKs the GLOBAL patients table and RLS only
    // gates the new row's own tenant_id, so a foreign-tenant patient UUID would
    // otherwise be accepted (tenant-isolation break + existence oracle). Mirrors
    // create_certificate / create_referral / create_consent.
    ensure_opd_patient_context_in_tx(&mut tx, &claims.tenant_id, body.patient_id, None).await?;

    // An admitted (active IPD) patient cannot start a fresh OPD visit. Admitting
    // FROM an OPD encounter is a different endpoint (`admit_from_opd`) and stays allowed.
    let active_admission: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM admissions \
         WHERE tenant_id = $1 AND patient_id = $2 AND status = 'admitted' LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .fetch_optional(&mut *tx)
    .await?;
    if active_admission.is_some() {
        return Err(AppError::Conflict(
            "Patient has an active IPD admission — a new OPD visit cannot be created while admitted."
                .to_owned(),
        ));
    }

    let today = crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct AppointmentLink {
        patient_id: Uuid,
        doctor_id: Uuid,
        department_id: Uuid,
        appointment_date: NaiveDate,
        slot_start: NaiveTime,
        slot_end: NaiveTime,
        appointment_type: String,
        status: String,
        reason: Option<String>,
        encounter_id: Option<Uuid>,
    }

    let linked_appointment = if let Some(appointment_id) = body.appointment_id {
        let appointment = sqlx::query_as::<_, AppointmentLink>(
            "SELECT patient_id, doctor_id, department_id, appointment_date, slot_start, slot_end, \
                    appointment_type::text AS appointment_type, status::text AS status, reason, \
                    encounter_id \
             FROM appointments \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(appointment_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

        if appointment.patient_id != body.patient_id {
            return Err(AppError::BadRequest(
                "Appointment patient does not match the OPD visit patient".to_owned(),
            ));
        }
        if appointment.department_id != body.department_id {
            return Err(AppError::BadRequest(
                "Appointment department does not match the OPD visit department".to_owned(),
            ));
        }
        if let Some(requested_doctor_id) = body.doctor_id
            && requested_doctor_id != appointment.doctor_id
        {
            return Err(AppError::BadRequest(
                "Appointment doctor does not match the OPD visit doctor".to_owned(),
            ));
        }
        if matches!(
            appointment.status.as_str(),
            "completed" | "cancelled" | "no_show"
        ) {
            return Err(AppError::Conflict(
                "Appointment is already closed and cannot be moved to OPD".to_owned(),
            ));
        }
        if appointment.encounter_id.is_some() {
            return Err(AppError::Conflict(
                "Appointment is already linked to an OPD visit".to_owned(),
            ));
        }

        Some(appointment)
    } else {
        None
    };

    let department_id = linked_appointment
        .as_ref()
        .map_or(body.department_id, |appointment| appointment.department_id);
    let doctor_id = linked_appointment
        .as_ref()
        .map_or(body.doctor_id, |appointment| Some(appointment.doctor_id));
    // No specific doctor chosen → auto-assign the least-loaded on-duty doctor in the department.
    let doctor_id = if doctor_id.is_none() {
        assign_department_doctor(&mut tx, &claims.tenant_id, department_id).await?
    } else {
        doctor_id
    };
    let default_visit_type = linked_appointment
        .as_ref()
        .map_or("walk_in", |appointment| {
            if appointment.appointment_type == "follow_up" {
                "follow_up"
            } else {
                "booked"
            }
        });
    let visit_type = match body.visit_type.as_deref() {
        Some("walk_in") if linked_appointment.is_some() => default_visit_type.to_owned(),
        Some(value) => value.to_owned(),
        None => default_visit_type.to_owned(),
    };
    if !matches!(
        visit_type.as_str(),
        "walk_in" | "booked" | "follow_up" | "referral" | "emergency" | "camp"
    ) {
        return Err(AppError::BadRequest(format!(
            "Unsupported OPD visit type: {visit_type}"
        )));
    }
    if visit_type == "camp" && body.camp_id.is_none() {
        return Err(AppError::BadRequest(
            "camp OPD visit requires camp_id".to_owned(),
        ));
    }
    if visit_type != "camp" && body.camp_id.is_some() {
        return Err(AppError::BadRequest(
            "camp_id can only be used with camp OPD visit type".to_owned(),
        ));
    }
    #[derive(sqlx::FromRow)]
    struct CampVisitContext {
        camp_code: String,
        name: String,
    }

    let camp_context = if let Some(camp_id) = body.camp_id {
        Some(
            sqlx::query_as::<_, CampVisitContext>(
                "SELECT camp_code, name FROM camps WHERE tenant_id = $1 AND id = $2",
            )
            .bind(claims.tenant_id)
            .bind(camp_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?,
        )
    } else {
        None
    };
    let notes = body.notes.clone().or_else(|| {
        linked_appointment
            .as_ref()
            .and_then(|appointment| appointment.reason.clone())
    });
    let mut attributes = linked_appointment.as_ref().map_or_else(
        || serde_json::json!({}),
        |appointment| {
            serde_json::json!({
                "appointment_id": body.appointment_id,
                "appointment_type": appointment.appointment_type,
                "appointment_date": appointment.appointment_date,
                "appointment_slot_start": appointment.slot_start,
                "appointment_slot_end": appointment.slot_end,
            })
        },
    );
    if let Some(camp) = camp_context {
        attributes["camp_id"] = serde_json::json!(body.camp_id);
        attributes["source"] = serde_json::json!("camp");
        attributes["mode"] = serde_json::json!("camp");
        attributes["camp_code"] = serde_json::json!(camp.camp_code);
        attributes["camp_name"] = serde_json::json!(camp.name);
    }

    let is_dummy =
        body.is_dummy.unwrap_or(false) && crate::middleware::authorization::is_bypass_role(&claims);

    let encounter = sqlx::query_as::<_, Encounter>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes, visit_type, is_dummy) \
         VALUES ($1, $2, 'opd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(department_id)
    .bind(doctor_id)
    .bind(today)
    .bind(&notes)
    .bind(attributes)
    .bind(visit_type)
    .bind(is_dummy)
    .fetch_one(&mut *tx)
    .await?;

    let token = generate_opd_token(&mut tx, &claims.tenant_id).await?;

    let queue = sqlx::query_as::<_, OpdQueue>(
        "INSERT INTO opd_queues \
         (tenant_id, encounter_id, department_id, doctor_id, token_number, \
          status, queue_date) \
         VALUES ($1, $2, $3, $4, $5, 'waiting'::queue_status, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter.id)
    .bind(department_id)
    .bind(doctor_id)
    .bind(token)
    .bind(today)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(appointment_id) = body.appointment_id {
        sqlx::query(
            "UPDATE appointments \
             SET status = 'checked_in'::appointment_status, \
                 token_number = $1, checked_in_at = COALESCE(checked_in_at, now()), \
                 encounter_id = $2, updated_at = now() \
             WHERE id = $3 AND tenant_id = $4",
        )
        .bind(queue.token_number)
        .bind(encounter.id)
        .bind(appointment_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::OpdEncounterCreated,
        encounter.id,
        claims.sub,
        serde_json::json!({
            "encounter_id": encounter.id,
            "patient_id": encounter.patient_id,
            "queue_id": queue.id,
            "token_number": queue.token_number,
            "visit_type": &encounter.visit_type,
            "appointment_id": body.appointment_id,
        }),
    )
    .with_patient(encounter.patient_id)
    .with_encounter(encounter.id);
    if let Some(department_id) = encounter.department_id {
        event = event.with_department(department_id);
    }
    crate::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    let doctor_name = if let Some(did) = encounter.doctor_id {
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(did)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned())
    } else {
        "N/A".to_owned()
    };

    let department_name = if let Some(did) = encounter.department_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
            .bind(did)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned())
    } else {
        "N/A".to_owned()
    };

    // Emit integration event
    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "opd.encounter.created",
        serde_json::json!({
            "encounter_id": encounter.id,
            "patient_id": encounter.patient_id,
            "doctor_id": encounter.doctor_id,
            "doctor_name": doctor_name,
            "department_id": encounter.department_id,
            "department_name": department_name,
            "visit_type": encounter.visit_type,
            "encounter_date": encounter.encounter_date.to_string(),
            "token_number": queue.token_number,
        }),
    )
    .await;

    Ok(Json(CreateEncounterResponse { encounter, queue }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/opd/encounters/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Encounter>, AppError> {
    require_any_permission(&claims, OPD_ENCOUNTER_WORKSPACE_PERMISSIONS)?;

    if claims_have_permission(&claims, permissions::opd::queue::VIEW)
        && !crate::middleware::authorization::is_bypass_role(&claims)
    {
        let authz_ctx = crate::middleware::authorization::authz_context(&claims);
        let allowed = state
            .authz
            .check(
                &authz_ctx,
                medbrains_authz::Relation::Viewer,
                "encounter",
                id,
            )
            .await
            .unwrap_or(false);
        if !allowed {
            return Err(AppError::NotFound);
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enc =
        sqlx::query_as::<_, Encounter>("SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;

    tx.commit().await?;
    enc.map_or_else(|| Err(AppError::NotFound), |e| Ok(Json(e)))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/opd/encounters/{id}
// ══════════════════════════════════════════════════════════

pub async fn update_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEncounterRequest>,
) -> Result<Json<Encounter>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enc = sqlx::query_as::<_, Encounter>(
        "UPDATE encounters SET \
         department_id = COALESCE($1, department_id), \
         doctor_id = COALESCE($2, doctor_id), \
         notes = COALESCE($3, notes), \
         status = COALESCE($4::encounter_status, status), \
         updated_at = now() \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(body.department_id)
    .bind(body.doctor_id)
    .bind(&body.notes)
    .bind(&body.status)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    enc.map_or_else(|| Err(AppError::NotFound), |e| Ok(Json(e)))
}

// ══════════════════════════════════════════════════════════
//  GET /api/opd/queue
// ══════════════════════════════════════════════════════════

pub async fn list_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListQueueQuery>,
) -> Result<Json<Vec<QueueEntry>>, AppError> {
    require_permission(&claims, permissions::opd::queue::LIST)?;
    let can_view_patient_identity = crate::middleware::authorization::is_bypass_role(&claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let queue_date = if let Some(date) = params.date {
        date
    } else {
        crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?
    };

    let mut conditions = vec![
        "q.tenant_id = $1".to_owned(),
        "q.queue_date = $2".to_owned(),
    ];
    let mut bind_idx: usize = 4;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(dept) = params.department_id {
        conditions.push(format!("q.department_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(dept),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(doc) = params.doctor_id {
        conditions.push(format!("q.doctor_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(doc),
            string_val: None,
        });
        bind_idx += 1;
    }
    if params.mine.unwrap_or(false) {
        conditions.push(format!("q.doctor_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(claims.sub),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(visit_type) = params
        .visit_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        conditions.push(format!("e.visit_type::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(visit_type.to_owned()),
        });
        bind_idx += 1;
    }
    if let Some(search) = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let search_condition = if can_view_patient_identity {
            format!(
                "(q.token_number::text ILIKE ${bind_idx} \
                  OR p.uhid ILIKE ${bind_idx} \
                  OR p.phone ILIKE ${bind_idx} \
                  OR CONCAT(p.first_name, ' ', p.last_name) ILIKE ${bind_idx})"
            )
        } else {
            format!(
                "(q.token_number::text ILIKE ${bind_idx} \
                  OR q.status::text ILIKE ${bind_idx} \
                  OR e.visit_type::text ILIKE ${bind_idx} \
                  OR COALESCE(e.attributes->>'camp_name', '') ILIKE ${bind_idx})"
            )
        };
        conditions.push(search_condition);
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(format!("%{search}%")),
        });
        bind_idx += 1;
    }
    if let Some(ref status) = params.status {
        conditions.push(format!("q.status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
    }

    let where_clause = conditions.join(" AND ");

    let sql = format!(
        "SELECT q.id, q.encounter_id, q.department_id, q.doctor_id, q.token_number, \
                q.status::text AS status, q.queue_date, q.called_at, q.completed_at, \
                e.patient_id, \
                CASE WHEN $3::bool THEN CONCAT(p.first_name, ' ', p.last_name) ELSE NULL END AS patient_name, \
                CASE WHEN $3::bool THEN p.uhid ELSE NULL END AS uhid, \
                e.visit_type::text AS visit_type, \
                NULLIF(e.attributes->>'camp_id', '')::uuid AS camp_id, \
                e.attributes->>'camp_name' AS camp_name, \
                a.id AS appointment_id, \
                a.appointment_type::text AS appointment_type, \
                a.status::text AS appointment_status, \
                a.appointment_date, \
                a.slot_start AS appointment_slot_start, \
                a.slot_end AS appointment_slot_end, \
                a.reason AS appointment_reason \
         FROM opd_queues q \
         JOIN encounters e ON e.id = q.encounter_id \
         JOIN patients p ON p.id = e.patient_id \
         LEFT JOIN appointments a ON a.tenant_id = q.tenant_id AND a.encounter_id = e.id \
         WHERE {where_clause} \
         ORDER BY q.token_number ASC LIMIT 5000"
    );

    let mut query = sqlx::query_as::<_, QueueEntry>(&sql)
        .bind(claims.tenant_id)
        .bind(queue_date)
        .bind(can_view_patient_identity);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            query = query.bind(u);
        }
        if let Some(ref s) = b.string_val {
            query = query.bind(s.clone());
        }
    }

    let rows = query.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Queue transitions
// ══════════════════════════════════════════════════════════

pub async fn call_queue_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OpdQueue>, AppError> {
    require_permission(&claims, permissions::opd::TOKEN_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = sqlx::query_as::<_, OpdQueue>(
        "UPDATE opd_queues SET status = 'called'::queue_status, called_at = now(), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'waiting'::queue_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    q.map_or_else(|| Err(AppError::NotFound), |e| Ok(Json(e)))
}

pub async fn start_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OpdQueue>, AppError> {
    require_permission(&claims, permissions::opd::TOKEN_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = sqlx::query_as::<_, OpdQueue>(
        "UPDATE opd_queues SET status = 'in_consultation'::queue_status, \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('waiting'::queue_status, 'called'::queue_status) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let q = q.ok_or(AppError::NotFound)?;

    // Update encounter status to in_progress
    sqlx::query(
        "UPDATE encounters SET status = 'in_progress'::encounter_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(q.encounter_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE appointments \
         SET status = 'in_consultation'::appointment_status, updated_at = now() \
         WHERE tenant_id = $1 AND encounter_id = $2 \
           AND status IN ( \
             'scheduled'::appointment_status, \
             'confirmed'::appointment_status, \
             'checked_in'::appointment_status \
           )",
    )
    .bind(claims.tenant_id)
    .bind(q.encounter_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(q))
}

pub async fn complete_queue_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OpdQueue>, AppError> {
    require_permission(&claims, permissions::opd::TOKEN_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = sqlx::query_as::<_, OpdQueue>(
        "UPDATE opd_queues SET status = 'completed'::queue_status, completed_at = now(), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('in_consultation'::queue_status, 'called'::queue_status) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let q = q.ok_or(AppError::NotFound)?;

    sqlx::query(
        "UPDATE encounters SET status = 'completed'::encounter_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(q.encounter_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE appointments \
         SET status = 'completed'::appointment_status, \
             completed_at = COALESCE(completed_at, now()), updated_at = now() \
         WHERE tenant_id = $1 AND encounter_id = $2 \
           AND status NOT IN ( \
             'completed'::appointment_status, \
             'cancelled'::appointment_status, \
             'no_show'::appointment_status \
           )",
    )
    .bind(claims.tenant_id)
    .bind(q.encounter_id)
    .execute(&mut *tx)
    .await?;

    // Auto-billing: charge for OPD consultation
    if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "opd").await? {
        let enc_patient = sqlx::query_scalar::<_, Uuid>(
            "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        )
        .bind(q.encounter_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(patient_id) = enc_patient {
            let dept_code = sqlx::query_scalar::<_, String>(
                "SELECT code FROM departments WHERE id = $1 AND tenant_id = $2",
            )
            .bind(q.department_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;

            let charge_code =
                dept_code.map_or_else(|| "OPD-CONSULT".to_owned(), |c| format!("OPD-CONSULT-{c}"));

            let _ = super::billing::auto_charge(
                &mut tx,
                &claims.tenant_id,
                super::billing::AutoChargeInput {
                    patient_id,
                    encounter_id: Some(q.encounter_id),
                    charge_code,
                    source: "opd".to_owned(),
                    source_id: q.id,
                    quantity: 1,
                    description_override: Some("OPD Consultation".to_owned()),
                    unit_price_override: None,
                    tax_percent_override: None,
                },
            )
            .await;
        }
    }

    // Finalize billing: turn this visit's draft invoice(s) into 'issued' (or 'paid'
    // when zero-amount — free/scheme patients) so the OPD visit ends with a collectable
    // bill the cashier sees, not a draft nobody revisits (the OPD revenue leak).
    // Parity with IPD discharge. Opt-out: billing.auto_charge_opd_close_finalize = false.
    if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "opd_close_finalize")
        .await?
    {
        sqlx::query(
            "UPDATE invoices SET \
             status = CASE WHEN total_amount = 0 THEN 'paid'::invoice_status \
                           ELSE 'issued'::invoice_status END, \
             issued_at = COALESCE(issued_at, now()), updated_at = now() \
             WHERE tenant_id = $1 AND encounter_id = $2 AND status = 'draft'::invoice_status",
        )
        .bind(claims.tenant_id)
        .bind(q.encounter_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let department_name =
        sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
            .bind(q.department_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned());

    let doctor_name = if let Some(did) = q.doctor_id {
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(did)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned())
    } else {
        "N/A".to_owned()
    };

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "opd.consultation.completed",
        serde_json::json!({
            "queue_id": q.id,
            "encounter_id": q.encounter_id,
            "department_id": q.department_id,
            "department_name": department_name,
            "doctor_id": q.doctor_id,
            "doctor_name": doctor_name,
            "token_number": q.token_number,
        }),
    )
    .await;

    Ok(Json(q))
}

pub async fn mark_no_show(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OpdQueue>, AppError> {
    require_permission(&claims, permissions::opd::TOKEN_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = sqlx::query_as::<_, OpdQueue>(
        "UPDATE opd_queues SET status = 'no_show'::queue_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('waiting'::queue_status, 'called'::queue_status) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let q = q.ok_or(AppError::NotFound)?;

    sqlx::query(
        "UPDATE encounters SET status = 'cancelled'::encounter_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(q.encounter_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE appointments \
         SET status = 'no_show'::appointment_status, updated_at = now() \
         WHERE tenant_id = $1 AND encounter_id = $2 \
           AND status NOT IN ( \
             'completed'::appointment_status, \
             'cancelled'::appointment_status, \
             'no_show'::appointment_status \
           )",
    )
    .bind(claims.tenant_id)
    .bind(q.encounter_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(q))
}

// ══════════════════════════════════════════════════════════
//  Vitals
// ══════════════════════════════════════════════════════════

pub async fn list_vitals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<Vital>>, AppError> {
    require_permission(&claims, permissions::opd::vitals::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Vital>(
        "SELECT * FROM vitals WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC LIMIT 5000",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_vital(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreateVitalRequest>,
) -> Result<Json<Vital>, AppError> {
    require_permission(&claims, permissions::opd::vitals::CREATE)?;

    // Auto-calculate BMI
    let bmi = match (body.weight_kg, body.height_cm) {
        (Some(w), Some(h)) if h > Decimal::ZERO => {
            let height_m = h / Decimal::from(100);
            Some(w / (height_m * height_m))
        }
        _ => None,
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vital = sqlx::query_as::<_, Vital>(
        "INSERT INTO vitals \
         (tenant_id, encounter_id, recorded_by, temperature, pulse, \
          systolic_bp, diastolic_bp, respiratory_rate, spo2, \
          weight_kg, height_cm, bmi, notes, recorded_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(claims.sub)
    .bind(body.temperature)
    .bind(body.pulse)
    .bind(body.systolic_bp)
    .bind(body.diastolic_bp)
    .bind(body.respiratory_rate)
    .bind(body.spo2)
    .bind(body.weight_kg)
    .bind(body.height_cm)
    .bind(bmi)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(vital))
}

// ══════════════════════════════════════════════════════════
//  Consultation
// ══════════════════════════════════════════════════════════

const OPD_SOAP_NOTE_FIELD: &str = "opd.soap_note";

fn opd_soap_note_access(restricted: &HashMap<String, FieldAccessLevel>) -> FieldAccessLevel {
    restricted
        .get(OPD_SOAP_NOTE_FIELD)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn can_write_opd_soap_note(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    opd_soap_note_access(restricted) == FieldAccessLevel::Edit
}

fn should_hide_opd_soap_note(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    opd_soap_note_access(restricted) == FieldAccessLevel::Hidden
}

fn should_mask_opd_soap_note(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    opd_soap_note_access(restricted) == FieldAccessLevel::Mask
}

fn validate_opd_soap_note_write_access(
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if can_write_opd_soap_note(restricted) {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted OPD SOAP note fields".to_owned(),
    ))
}

fn filter_consultation_response(
    mut row: Consultation,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Consultation {
    if should_hide_opd_soap_note(restricted) {
        row.chief_complaint = None;
        row.history = None;
        row.examination = None;
        row.plan = None;
        row.notes = None;
        row.hpi = None;
        row.past_medical_history = None;
        row.past_surgical_history = None;
        row.family_history = None;
        row.social_history = None;
        row.review_of_systems = None;
        row.physical_examination = None;
        row.general_appearance = None;
        row.snomed_codes = None;
    } else if should_mask_opd_soap_note(restricted) {
        row.chief_complaint = row.chief_complaint.map(|value| mask_free_text(&value));
        row.history = row.history.map(|value| mask_free_text(&value));
        row.examination = row.examination.map(|value| mask_free_text(&value));
        row.plan = row.plan.map(|value| mask_free_text(&value));
        row.notes = row.notes.map(|value| mask_free_text(&value));
        row.hpi = row.hpi.map(|value| mask_free_text(&value));
        row.past_medical_history = None;
        row.past_surgical_history = None;
        row.family_history = None;
        row.social_history = None;
        row.review_of_systems = None;
        row.physical_examination = None;
        row.general_appearance = row.general_appearance.map(|value| mask_free_text(&value));
        row.snomed_codes = None;
    }
    row
}

pub async fn get_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Option<Consultation>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::UPDATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Consultation>(
        "SELECT * FROM consultations WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    Ok(Json(row.map(|consultation| {
        filter_consultation_response(consultation, &restricted_fields)
    })))
}

pub async fn create_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreateConsultationRequest>,
) -> Result<Json<Consultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    validate_opd_soap_note_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Register-first lock (opt-in): no case sheet until the OPD visit is registered.
    assert_encounter_registered(&mut tx, &claims.tenant_id, encounter_id).await?;

    // Resolve patient_id from the encounter so inline lab/radiology
    // orders carry the right FK without a second client round-trip.
    let patient_id: Uuid =
        sqlx::query_scalar("SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2")
            .bind(encounter_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let row = sqlx::query_as::<_, Consultation>(
        "INSERT INTO consultations \
         (tenant_id, encounter_id, doctor_id, chief_complaint, history, \
          examination, plan, notes, hpi, past_medical_history, past_surgical_history, \
          family_history, social_history, review_of_systems, physical_examination, \
          general_appearance) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(claims.sub)
    .bind(&body.chief_complaint)
    .bind(&body.history)
    .bind(&body.examination)
    .bind(&body.plan)
    .bind(&body.notes)
    .bind(&body.hpi)
    .bind(&body.past_medical_history)
    .bind(&body.past_surgical_history)
    .bind(&body.family_history)
    .bind(&body.social_history)
    .bind(&body.review_of_systems)
    .bind(&body.physical_examination)
    .bind(&body.general_appearance)
    .fetch_one(&mut *tx)
    .await?;

    let mut created_lab_order_ids = Vec::with_capacity(body.lab_orders.len());
    for lab in &body.lab_orders {
        let req = super::lab::CreateOrderRequest {
            encounter_id,
            patient_id,
            test_id: lab.test_id,
            priority: lab.priority.clone(),
            notes: lab.notes.clone(),
            is_dummy: None,
        };
        let lab_order = super::lab::create_order_in_tx(&mut tx, &claims, &req).await?;
        created_lab_order_ids.push(lab_order.id);
    }

    for rad in &body.radiology_orders {
        let req = super::radiology::CreateOrderRequest {
            patient_id,
            encounter_id: Some(encounter_id),
            modality_id: rad.modality_id,
            body_part: rad.body_part.clone(),
            clinical_indication: rad.clinical_indication.clone(),
            priority: rad.priority.clone(),
            scheduled_at: None,
            notes: rad.notes.clone(),
            contrast_required: Some(false),
            pregnancy_checked: Some(false),
            allergy_flagged: Some(false),
            is_dummy: None,
        };
        super::radiology::create_order_in_tx(&mut tx, &claims, &req).await?;
    }

    tx.commit().await?;

    for lab_order_id in created_lab_order_ids {
        super::lab::grant_lab_order_creator_viewer(
            &state,
            &claims,
            lab_order_id,
            "opd_consultation_lab_order_created",
        )
        .await?;
    }

    tracing::info!(
        encounter_id = %encounter_id,
        consultation_id = %row.id,
        labs = body.lab_orders.len(),
        radiology = body.radiology_orders.len(),
        "consultation: created with inline orders"
    );

    Ok(Json(filter_consultation_response(row, &restricted_fields)))
}

pub async fn update_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_encounter_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateConsultationRequest>,
) -> Result<Json<Consultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    validate_opd_soap_note_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Consultation>(
        "UPDATE consultations SET \
         chief_complaint = COALESCE($1, chief_complaint), \
         history = COALESCE($2, history), \
         examination = COALESCE($3, examination), \
         plan = COALESCE($4, plan), \
         notes = COALESCE($5, notes), \
         hpi = COALESCE($8, hpi), \
         past_medical_history = COALESCE($9, past_medical_history), \
         past_surgical_history = COALESCE($10, past_surgical_history), \
         family_history = COALESCE($11, family_history), \
         social_history = COALESCE($12, social_history), \
         review_of_systems = COALESCE($13, review_of_systems), \
         physical_examination = COALESCE($14, physical_examination), \
         general_appearance = COALESCE($15, general_appearance), \
         updated_at = now() \
         WHERE id = $6 AND tenant_id = $7 \
         RETURNING *",
    )
    .bind(&body.chief_complaint)
    .bind(&body.history)
    .bind(&body.examination)
    .bind(&body.plan)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.hpi)
    .bind(&body.past_medical_history)
    .bind(&body.past_surgical_history)
    .bind(&body.family_history)
    .bind(&body.social_history)
    .bind(&body.review_of_systems)
    .bind(&body.physical_examination)
    .bind(&body.general_appearance)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(
        || Err(AppError::NotFound),
        |r| Ok(Json(filter_consultation_response(r, &restricted_fields))),
    )
}

// ══════════════════════════════════════════════════════════
//  Diagnoses
// ══════════════════════════════════════════════════════════

const OPD_DIAGNOSIS_FIELD: &str = "opd.diagnosis";

async fn resolve_opd_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn opd_diagnosis_access(restricted: &HashMap<String, FieldAccessLevel>) -> FieldAccessLevel {
    restricted
        .get(OPD_DIAGNOSIS_FIELD)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn can_write_opd_diagnosis(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    opd_diagnosis_access(restricted) == FieldAccessLevel::Edit
}

fn should_hide_opd_diagnosis(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    opd_diagnosis_access(restricted) == FieldAccessLevel::Hidden
}

fn should_mask_opd_diagnosis(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    opd_diagnosis_access(restricted) == FieldAccessLevel::Mask
}

fn validate_opd_diagnosis_write_access(
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if can_write_opd_diagnosis(restricted) {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted OPD diagnosis fields".to_owned(),
    ))
}

fn filter_diagnosis_response(
    mut row: Diagnosis,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Diagnosis {
    if should_hide_opd_diagnosis(restricted) {
        row.icd_code = None;
        row.icd_display = None;
        row.icd_source_url = None;
        row.icd_source_version = None;
        row.icd_provider_mode = None;
        row.description = "Restricted diagnosis".to_owned();
        row.notes = None;
        row.severity = None;
        row.certainty = None;
        row.onset_date = None;
        row.resolved_date = None;
        row.snomed_code = None;
        row.snomed_display = None;
    } else if should_mask_opd_diagnosis(restricted) {
        row.icd_code = None;
        row.icd_display = row.icd_display.map(|value| mask_free_text(&value));
        row.icd_source_url = None;
        row.icd_source_version = None;
        row.icd_provider_mode = None;
        row.description = mask_free_text(&row.description);
        row.notes = row.notes.map(|value| mask_free_text(&value));
        row.severity = None;
        row.certainty = None;
        row.onset_date = None;
        row.resolved_date = None;
        row.snomed_code = None;
        row.snomed_display = row.snomed_display.map(|value| mask_free_text(&value));
    }
    row
}

fn filter_patient_diagnosis_response(
    mut row: PatientDiagnosisRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PatientDiagnosisRow {
    if should_hide_opd_diagnosis(restricted) {
        row.icd_code = None;
        row.icd_display = None;
        row.icd_source_url = None;
        row.icd_source_version = None;
        row.icd_provider_mode = None;
        row.description = "Restricted diagnosis".to_owned();
        row.notes = None;
        row.severity = None;
        row.certainty = None;
        row.onset_date = None;
        row.resolved_date = None;
        row.snomed_code = None;
        row.snomed_display = None;
    } else if should_mask_opd_diagnosis(restricted) {
        row.icd_code = None;
        row.icd_display = row.icd_display.map(|value| mask_free_text(&value));
        row.icd_source_url = None;
        row.icd_source_version = None;
        row.icd_provider_mode = None;
        row.description = mask_free_text(&row.description);
        row.notes = row.notes.map(|value| mask_free_text(&value));
        row.severity = None;
        row.certainty = None;
        row.onset_date = None;
        row.resolved_date = None;
        row.snomed_code = None;
        row.snomed_display = row.snomed_display.map(|value| mask_free_text(&value));
    }
    row
}

pub async fn list_diagnoses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<Diagnosis>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::diagnoses::LIST,
            permissions::opd::diagnoses::CREATE,
            permissions::opd::diagnoses::UPDATE,
            permissions::opd::diagnoses::DELETE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Diagnosis>(
        "SELECT * FROM diagnoses WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY is_primary DESC, created_at LIMIT 5000",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_diagnosis_response(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn create_diagnosis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreateDiagnosisRequest>,
) -> Result<Json<Diagnosis>, AppError> {
    require_permission(&claims, permissions::opd::diagnoses::CREATE)?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    validate_opd_diagnosis_write_access(&restricted_fields)?;

    let is_primary = body.is_primary.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let severity = body.severity.as_deref().unwrap_or("moderate");
    let certainty = body.certainty.as_deref().unwrap_or("confirmed");
    let icd_system = body.icd_system.as_deref().unwrap_or("icd11");
    if !matches!(icd_system, "icd10" | "icd11" | "snomed") {
        return Err(AppError::BadRequest("invalid icd_system".to_owned()));
    }

    let row = sqlx::query_as::<_, Diagnosis>(
        "INSERT INTO diagnoses \
         (tenant_id, encounter_id, icd_code, icd_system, icd_display, icd_source_url, \
          icd_source_version, icd_provider_mode, description, is_primary, notes, \
          severity, certainty, onset_date, resolved_date, snomed_code, snomed_display) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(&body.icd_code)
    .bind(icd_system)
    .bind(&body.icd_display)
    .bind(&body.icd_source_url)
    .bind(&body.icd_source_version)
    .bind(&body.icd_provider_mode)
    .bind(&body.description)
    .bind(is_primary)
    .bind(&body.notes)
    .bind(severity)
    .bind(certainty)
    .bind(body.onset_date)
    .bind(body.resolved_date)
    .bind(&body.snomed_code)
    .bind(&body.snomed_display)
    .fetch_one(&mut *tx)
    .await?;

    // CKB statutory hook: if this diagnosis is a notifiable disease, file a
    // pending report and alert the reporter. The conclusion lives in one place
    // (`ckb::flag_notifiable_diagnosis`) so it can later be AI-driven.
    let patient_id = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    let icd_code = body.icd_code.as_deref().unwrap_or_default();
    if let Some((disease_name, reporting_body)) = super::ckb::flag_notifiable_diagnosis(
        &mut tx,
        claims.tenant_id,
        patient_id,
        Some(encounter_id),
        Some(claims.sub),
        icd_code,
    )
    .await?
    {
        let body_text = format!(
            "{disease_name} ({icd_code}) requires {} reporting.",
            reporting_body.as_deref().unwrap_or("IDSP")
        );
        create_notification(
            &mut tx,
            claims.tenant_id,
            NewNotification {
                user_id: claims.sub,
                kind: "warning",
                title: "Notifiable disease — statutory report due",
                body: Some(&body_text),
                category: Some("Notifiable Disease"),
                entity_type: Some("notifiable_disease_reports"),
                entity_id: None,
                action_url: Some("/clinical-kb#reports"),
            },
        )
        .await?;
    }

    tx.commit().await?;
    Ok(Json(filter_diagnosis_response(row, &restricted_fields)))
}

pub async fn update_diagnosis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((encounter_id, did)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateDiagnosisRequest>,
) -> Result<Json<Diagnosis>, AppError> {
    require_permission(&claims, permissions::opd::diagnoses::UPDATE)?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    validate_opd_diagnosis_write_access(&restricted_fields)?;

    if let Some(value) = body.icd_system.as_deref() {
        if !matches!(value, "icd10" | "icd11" | "snomed") {
            return Err(AppError::BadRequest("invalid icd_system".to_owned()));
        }
    }
    if let Some(value) = body.severity.as_deref() {
        if !matches!(value, "mild" | "moderate" | "severe" | "critical") {
            return Err(AppError::BadRequest("invalid severity".to_owned()));
        }
    }
    if let Some(value) = body.certainty.as_deref() {
        if !matches!(value, "suspected" | "probable" | "confirmed" | "ruled_out") {
            return Err(AppError::BadRequest("invalid certainty".to_owned()));
        }
    }

    let should_update_onset = body.onset_date.is_some();
    let onset_date = body.onset_date.flatten();
    let should_update_resolved = body.resolved_date.is_some();
    let resolved_date = body.resolved_date.flatten();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Diagnosis>(
        "UPDATE diagnoses SET \
            icd_code = COALESCE($1, icd_code), \
            icd_system = COALESCE($2, icd_system), \
            icd_display = COALESCE($3, icd_display), \
            icd_source_url = COALESCE($4, icd_source_url), \
            icd_source_version = COALESCE($5, icd_source_version), \
            icd_provider_mode = COALESCE($6, icd_provider_mode), \
            description = COALESCE(NULLIF($7, ''), description), \
            is_primary = COALESCE($8, is_primary), \
            notes = COALESCE($9, notes), \
            severity = COALESCE($10, severity), \
            certainty = COALESCE($11, certainty), \
            onset_date = CASE WHEN $12 THEN $13 ELSE onset_date END, \
            resolved_date = CASE WHEN $14 THEN $15 ELSE resolved_date END, \
            snomed_code = COALESCE($16, snomed_code), \
            snomed_display = COALESCE($17, snomed_display) \
         WHERE id = $18 AND tenant_id = $19 AND encounter_id = $20 \
         RETURNING *",
    )
    .bind(body.icd_code.as_deref())
    .bind(body.icd_system.as_deref())
    .bind(body.icd_display.as_deref())
    .bind(body.icd_source_url.as_deref())
    .bind(body.icd_source_version.as_deref())
    .bind(body.icd_provider_mode.as_deref())
    .bind(body.description.as_deref())
    .bind(body.is_primary)
    .bind(body.notes.as_deref())
    .bind(body.severity.as_deref())
    .bind(body.certainty.as_deref())
    .bind(should_update_onset)
    .bind(onset_date)
    .bind(should_update_resolved)
    .bind(resolved_date)
    .bind(body.snomed_code.as_deref())
    .bind(body.snomed_display.as_deref())
    .bind(did)
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(filter_diagnosis_response(row, &restricted_fields)))
}

pub async fn delete_diagnosis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_encounter_id, did)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::diagnoses::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM diagnoses WHERE id = $1 AND tenant_id = $2")
        .bind(did)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Prescriptions
// ══════════════════════════════════════════════════════════

async fn prescription_pharmacy_statuses(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    prescription_ids: &[Uuid],
) -> Result<HashMap<Uuid, (Uuid, Option<String>, Option<Uuid>)>, AppError> {
    if prescription_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query_as::<_, (Uuid, Uuid, String, Option<Uuid>)>(
        "SELECT prescription_id, id, status::text, pharmacy_order_id \
         FROM pharmacy_prescriptions \
         WHERE prescription_id = ANY($1) AND tenant_id = $2",
    )
    .bind(prescription_ids)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(prescription_id, queue_id, status, pharmacy_order_id)| {
            (prescription_id, (queue_id, Some(status), pharmacy_order_id))
        })
        .collect())
}

pub async fn list_prescriptions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<PrescriptionWithItems>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::UPDATE,
            permissions::pharmacy::prescriptions::LIST,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let prescriptions = sqlx::query_as::<_, Prescription>(
        "SELECT * FROM prescriptions WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let prescription_ids: Vec<Uuid> = prescriptions.iter().map(|rx| rx.id).collect();
    let pharmacy_statuses =
        prescription_pharmacy_statuses(&mut tx, claims.tenant_id, &prescription_ids).await?;
    let items = if prescription_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, PrescriptionItem>(
            "SELECT * FROM prescription_items \
             WHERE prescription_id = ANY($1) AND tenant_id = $2 \
               AND item_status = 'active' \
             ORDER BY prescription_id, created_at LIMIT 5000",
        )
        .bind(&prescription_ids)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    let mut items_by_prescription: HashMap<Uuid, Vec<PrescriptionItem>> = HashMap::new();
    for item in items {
        items_by_prescription
            .entry(item.prescription_id)
            .or_default()
            .push(item);
    }

    let mut result = Vec::with_capacity(prescriptions.len());
    for rx in prescriptions {
        let items = items_by_prescription.remove(&rx.id).unwrap_or_default();
        let (pharmacy_rx_queue_id, pharmacy_status, pharmacy_order_id) = pharmacy_statuses
            .get(&rx.id)
            .cloned()
            .map_or((None, None, None), |(queue_id, status, order_id)| {
                (Some(queue_id), status, order_id)
            });
        result.push(PrescriptionWithItems {
            prescription: rx,
            items,
            pharmacy_status,
            pharmacy_rx_queue_id,
            pharmacy_order_id,
        });
    }

    tx.commit().await?;
    Ok(Json(result))
}

pub async fn get_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PrescriptionWithItems>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::UPDATE,
            permissions::pharmacy::prescriptions::VIEW,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rx = sqlx::query_as::<_, Prescription>(
        "SELECT * FROM prescriptions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, PrescriptionItem>(
        "SELECT * FROM prescription_items \
         WHERE prescription_id = $1 AND tenant_id = $2 AND item_status = 'active' \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(rx.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let statuses = prescription_pharmacy_statuses(&mut tx, claims.tenant_id, &[rx.id]).await?;
    let (pharmacy_rx_queue_id, pharmacy_status, pharmacy_order_id) = statuses
        .get(&rx.id)
        .cloned()
        .map_or((None, None, None), |(queue_id, status, order_id)| {
            (Some(queue_id), status, order_id)
        });

    tx.commit().await?;
    Ok(Json(PrescriptionWithItems {
        prescription: rx,
        items,
        pharmacy_status,
        pharmacy_rx_queue_id,
        pharmacy_order_id,
    }))
}

pub async fn create_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    jar: axum_extra::extract::CookieJar,
    Json(body): Json<CreatePrescriptionRequest>,
) -> Result<Json<PrescriptionWithItems>, AppError> {
    // Doctors prescribe directly; nurses may draft (Rx routes to MD countersign).
    require_any_permission(
        &claims,
        &[
            permissions::opd::visit::UPDATE,
            permissions::nurse::prescriptions::DRAFT,
        ],
    )?;
    // Prescribing — require fresh re-auth (the 5-min window keeps it light).
    crate::routes::step_up::require_step_up(&state, &jar, &claims)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one prescription item is required".to_owned(),
        ));
    }

    let order_mode = body.order_mode.as_deref().unwrap_or("written");
    if !["written", "verbal", "telephone"].contains(&order_mode) {
        return Err(AppError::BadRequest(format!("Invalid order mode '{order_mode}'.")));
    }
    let is_verbal = order_mode != "written";

    // For a verbal/telephone order the prescriber is the ordering doctor (the
    // nurse only transcribes); read-back is mandatory and the doctor must
    // countersign within policy (24h).
    let (doctor_id, transcribed_by, countersign_due) = if is_verbal {
        let ordering = body.ordering_doctor_id.ok_or_else(|| {
            AppError::BadRequest("A verbal/telephone order needs the ordering doctor.".to_owned())
        })?;
        if body.read_back_confirmed != Some(true) {
            return Err(AppError::BadRequest(
                "Read-back must be confirmed for a verbal/telephone order.".to_owned(),
            ));
        }
        (ordering, Some(claims.sub), Some(Utc::now() + chrono::Duration::hours(24)))
    } else {
        (claims.sub, None, None)
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Credential gate — a prescriber whose medical registration is REVOKED can't prescribe
    // (hard block); an EXPIRED one is a soft gate (override reason, logged). Shared with OT.
    crate::clinical_credential::enforce_prescriber_credential(
        &mut tx,
        claims.tenant_id,
        doctor_id,
        body.credential_override_reason.as_deref(),
        "prescribe",
    )
    .await?;

    // Dose-safety backstop: flag any line whose daily total exceeds the
    // catalogue max. Advisory — overridable with a reason (logged), never a
    // hard block. The CDS rail surfaces the same alerts before save.
    let dose_check_items: Vec<super::cds::DoseCheckItem> = body
        .items
        .iter()
        .map(|i| super::cds::DoseCheckItem {
            drug_name: i.drug_name.clone(),
            dosage: i.dosage.clone(),
            frequency: i.frequency.clone(),
            catalog_item_id: i.catalog_item_id,
        })
        .collect();
    let dose_alerts =
        super::cds::dose_alerts_for_items(&mut tx, claims.tenant_id, &dose_check_items).await?;
    let override_reason = body
        .dose_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if !dose_alerts.is_empty() && override_reason.is_none() {
        let summary = dose_alerts
            .iter()
            .map(|a| {
                format!("{} {}/day exceeds max {}", a.drug_name, a.total_per_day_label, a.max_per_day_label)
            })
            .collect::<Vec<_>>()
            .join("; ");
        return Err(AppError::BadRequest(format!(
            "Dose exceeds the catalogue maximum ({summary}). Provide an override reason to proceed."
        )));
    }

    // Allergy backstop: prescribing a drug the patient is documented allergic
    // to is a sentinel event (NABH IPSG). Warn & require an acknowledged reason
    // (logged) — never a silent pass, never a hard block.
    let rx_patient_id = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    let mut allergy_conflicts: Vec<String> = Vec::new();
    if let Some(pid) = rx_patient_id {
        let allergens = sqlx::query_scalar::<_, String>(
            "SELECT allergen_name FROM patient_allergies \
             WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true \
               AND allergy_type = 'drug'",
        )
        .bind(claims.tenant_id)
        .bind(pid)
        .fetch_all(&mut *tx)
        .await?;
        let drug_names: Vec<String> = body.items.iter().map(|i| i.drug_name.clone()).collect();
        for c in medbrains_core::allergy::find_conflicts(&drug_names, &allergens) {
            let cross = if c.kind == medbrains_core::allergy::AllergyMatchKind::CrossReactive {
                format!(", cross-reactive {}", c.class.as_deref().unwrap_or("class"))
            } else {
                String::new()
            };
            allergy_conflicts.push(format!("{} (allergy: {}{cross})", c.drug_name, c.allergen));
        }
    }
    let allergy_reason = body
        .allergy_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if !allergy_conflicts.is_empty() && allergy_reason.is_none() {
        return Err(AppError::BadRequest(format!(
            "Patient has a documented drug allergy conflicting with: {}. Provide an override reason to proceed.",
            allergy_conflicts.join("; ")
        )));
    }

    // Drug-drug interaction backstop: a major or contraindicated pair on the
    // same order is a medication-safety risk (NABH IPSG). Warn & require an
    // acknowledged reason (logged) — minor/moderate pairs stay advisory and the
    // pharmacist re-checks at review.
    let rx_drug_names: Vec<String> = body.items.iter().map(|i| i.drug_name.clone()).collect();
    let interaction_alerts =
        super::cds::interaction_alerts_for_drugs(&mut tx, claims.tenant_id, &rx_drug_names).await?;
    let serious_interactions: Vec<&super::cds::DrugInteractionAlert> = interaction_alerts
        .iter()
        .filter(|i| matches!(i.severity.as_str(), "major" | "contraindicated"))
        .collect();
    let interaction_reason = body
        .interaction_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if !serious_interactions.is_empty() && interaction_reason.is_none() {
        let summary = serious_interactions
            .iter()
            .map(|i| format!("{} × {} ({})", i.drug_a, i.drug_b, i.severity))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(AppError::BadRequest(format!(
            "Order has a serious drug-drug interaction: {summary}. Provide an override reason to proceed."
        )));
    }

    // Therapeutic-duplication backstop: two catalogued lines that share an
    // active ingredient (generic / INN) are a common prescribing error. Warn &
    // require an acknowledged reason (logged). Free-text lines without a
    // catalogue id are skipped — we can't resolve their ingredient.
    let dup_catalog_ids: Vec<Uuid> = body.items.iter().filter_map(|i| i.catalog_item_id).collect();
    let mut duplicate_groups: Vec<String> = Vec::new();
    if dup_catalog_ids.len() > 1 {
        let ingredients = sqlx::query_as::<_, (Uuid, String)>(
            "SELECT id, lower(COALESCE(NULLIF(generic_name, ''), NULLIF(inn_name, ''), name)) \
             FROM pharmacy_catalog WHERE tenant_id = $1 AND id = ANY($2)",
        )
        .bind(claims.tenant_id)
        .bind(&dup_catalog_ids)
        .fetch_all(&mut *tx)
        .await?;
        let id_to_ingredient: HashMap<Uuid, String> =
            ingredients.into_iter().collect();

        let mut by_ingredient: HashMap<String, Vec<String>> =
            HashMap::new();
        for item in &body.items {
            if let Some(cid) = item.catalog_item_id {
                if let Some(ingredient) = id_to_ingredient.get(&cid) {
                    by_ingredient
                        .entry(ingredient.clone())
                        .or_default()
                        .push(item.drug_name.clone());
                }
            }
        }
        for (ingredient, drugs) in by_ingredient {
            if drugs.len() > 1 {
                duplicate_groups.push(format!("{} ({})", ingredient, drugs.join(", ")));
            }
        }
    }
    let duplicate_reason = body
        .duplicate_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if !duplicate_groups.is_empty() && duplicate_reason.is_none() {
        return Err(AppError::BadRequest(format!(
            "Therapeutic duplication — same active ingredient on multiple lines: {}. Provide an override reason to proceed.",
            duplicate_groups.join("; ")
        )));
    }

    let rx = sqlx::query_as::<_, Prescription>(
        "INSERT INTO prescriptions \
           (tenant_id, encounter_id, doctor_id, notes, order_mode, transcribed_by, \
            read_back_confirmed, countersign_due_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(doctor_id)
    .bind(&body.notes)
    .bind(order_mode)
    .bind(transcribed_by)
    .bind(is_verbal)
    .bind(countersign_due)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(reason) = override_reason {
        let audit_values = serde_json::json!({
            "prescription_id": rx.id,
            "encounter_id": encounter_id,
            "override_reason": reason,
            "exceedances": dose_alerts
                .iter()
                .map(|a| serde_json::json!({
                    "drug_name": a.drug_name,
                    "per_dose": a.per_dose,
                    "doses_per_day": a.doses_per_day,
                    "total_per_day": a.total_per_day_label,
                    "max_per_day": a.max_per_day_label,
                }))
                .collect::<Vec<_>>(),
        });
        medbrains_db::audit::AuditLogger::log(
            &mut tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id: claims.tenant_id,
                user_id: Some(claims.sub),
                action: "prescription.dose_override",
                entity_type: "prescription",
                entity_id: Some(rx.id),
                old_values: None,
                new_values: Some(&audit_values),
                ip_address: None,
            },
        )
        .await?;
    }

    if let Some(reason) = allergy_reason {
        if !allergy_conflicts.is_empty() {
            let audit_values = serde_json::json!({
                "prescription_id": rx.id,
                "encounter_id": encounter_id,
                "override_reason": reason,
                "conflicts": allergy_conflicts,
            });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: claims.tenant_id,
                    user_id: Some(claims.sub),
                    action: "prescription.allergy_override",
                    entity_type: "prescription",
                    entity_id: Some(rx.id),
                    old_values: None,
                    new_values: Some(&audit_values),
                    ip_address: None,
                },
            )
            .await?;
        }
    }

    if let Some(reason) = interaction_reason {
        if !serious_interactions.is_empty() {
            let audit_values = serde_json::json!({
                "prescription_id": rx.id,
                "encounter_id": encounter_id,
                "override_reason": reason,
                "interactions": serious_interactions
                    .iter()
                    .map(|i| serde_json::json!({
                        "drug_a": i.drug_a,
                        "drug_b": i.drug_b,
                        "severity": i.severity,
                        "description": i.description,
                    }))
                    .collect::<Vec<_>>(),
            });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: claims.tenant_id,
                    user_id: Some(claims.sub),
                    action: "prescription.interaction_override",
                    entity_type: "prescription",
                    entity_id: Some(rx.id),
                    old_values: None,
                    new_values: Some(&audit_values),
                    ip_address: None,
                },
            )
            .await?;
        }
    }

    if let Some(reason) = duplicate_reason {
        if !duplicate_groups.is_empty() {
            let audit_values = serde_json::json!({
                "prescription_id": rx.id,
                "encounter_id": encounter_id,
                "override_reason": reason,
                "duplicates": duplicate_groups,
            });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: claims.tenant_id,
                    user_id: Some(claims.sub),
                    action: "prescription.duplicate_override",
                    entity_type: "prescription",
                    entity_id: Some(rx.id),
                    old_values: None,
                    new_values: Some(&audit_values),
                    ip_address: None,
                },
            )
            .await?;
        }
    }

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let pi = sqlx::query_as::<_, PrescriptionItem>(
            "INSERT INTO prescription_items \
             (tenant_id, prescription_id, drug_name, dosage, frequency, duration, \
              route, instructions, catalog_item_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(rx.id)
        .bind(&item.drug_name)
        .bind(&item.dosage)
        .bind(&item.frequency)
        .bind(&item.duration)
        .bind(&item.route)
        .bind(&item.instructions)
        .bind(item.catalog_item_id)
        .fetch_one(&mut *tx)
        .await?;
        items.push(pi);
    }

    // Auto-forward to pharmacy Rx queue
    let patient_id = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    let mut pharmacy_rx_queue_id = None;

    if let Some(pid) = patient_id {
        let encounter_type = sqlx::query_scalar::<_, Option<String>>(
            "SELECT encounter_type::text FROM encounters WHERE id = $1",
        )
        .bind(encounter_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten()
        .unwrap_or_else(|| "opd".to_owned());

        let source = match encounter_type.as_str() {
            "ipd" => "ipd",
            "emergency" => "emergency",
            _ => "opd",
        };

        pharmacy_rx_queue_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO pharmacy_prescriptions \
             (tenant_id, prescription_id, patient_id, encounter_id, doctor_id, source, status, priority) \
             VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', 'normal') \
             ON CONFLICT DO NOTHING \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(rx.id)
        .bind(pid)
        .bind(encounter_id)
        .bind(doctor_id)
        .bind(source)
        .fetch_optional(&mut *tx)
        .await?;

        if pharmacy_rx_queue_id.is_none() {
            pharmacy_rx_queue_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM pharmacy_prescriptions \
                 WHERE prescription_id = $1 AND tenant_id = $2",
            )
            .bind(rx.id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
        }
    }

    // Route a verbal/telephone order to the prescribing doctor to countersign.
    if is_verbal && doctor_id != claims.sub {
        create_notification(
            &mut tx,
            claims.tenant_id,
            NewNotification {
                user_id: doctor_id,
                kind: "verbal_order_countersign",
                title: "Verbal order awaiting countersignature",
                body: Some("A nurse transcribed a verbal/telephone order on your behalf."),
                category: Some("clinical"),
                entity_type: Some("prescriptions"),
                entity_id: Some(rx.id),
                action_url: None,
            },
        )
        .await?;
    }

    tx.commit().await?;

    let rx_doctor_name =
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(rx.doctor_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned());

    // Emit integration event (non-blocking — failures logged, not propagated)
    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "opd.prescription.created",
        serde_json::json!({
            "prescription_id": rx.id,
            "encounter_id": encounter_id,
            "doctor_id": rx.doctor_id,
            "doctor_name": rx_doctor_name,
            "patient_id": patient_id,
            "items_count": items.len(),
        }),
    )
    .await;

    Ok(Json(PrescriptionWithItems {
        prescription: rx,
        items,
        pharmacy_status: patient_id.map(|_| "pending_review".to_owned()),
        pharmacy_rx_queue_id,
        pharmacy_order_id: None,
    }))
}

pub async fn update_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    jar: axum_extra::extract::CookieJar,
    Json(body): Json<UpdatePrescriptionRequest>,
) -> Result<Json<PrescriptionWithItems>, AppError> {
    // Doctors prescribe directly; nurses may draft (Rx routes to MD countersign).
    require_any_permission(
        &claims,
        &[
            permissions::opd::visit::UPDATE,
            permissions::nurse::prescriptions::DRAFT,
        ],
    )?;
    // Prescribing — require fresh re-auth (the 5-min window keeps it light).
    crate::routes::step_up::require_step_up(&state, &jar, &claims)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one prescription item is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("SELECT id FROM prescriptions WHERE id = $1 AND tenant_id = $2 FOR UPDATE")
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let pharmacy_state = sqlx::query_as::<_, (Uuid, String, Option<Uuid>)>(
        "SELECT id, status::text, pharmacy_order_id \
         FROM pharmacy_prescriptions \
         WHERE prescription_id = $1 AND tenant_id = $2 \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some((_, status, pharmacy_order_id)) = &pharmacy_state {
        if pharmacy_order_id.is_some()
            || !matches!(status.as_str(), "pending_review" | "on_hold" | "rejected")
        {
            return Err(AppError::Conflict(
                "Prescription can be edited only before pharmacy approval and billing calculation"
                    .to_owned(),
            ));
        }
    }

    let rx = sqlx::query_as::<_, Prescription>(
        "UPDATE prescriptions SET notes = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE prescription_items SET \
            item_status = 'changed', \
            discontinued_at = now(), \
            discontinued_by = $3, \
            discontinue_reason = 'Prescription edited before pharmacy approval' \
         WHERE prescription_id = $1 AND tenant_id = $2 AND item_status = 'active'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let pi = sqlx::query_as::<_, PrescriptionItem>(
            "INSERT INTO prescription_items \
             (tenant_id, prescription_id, drug_name, dosage, frequency, duration, \
              route, instructions, catalog_item_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(&item.drug_name)
        .bind(&item.dosage)
        .bind(&item.frequency)
        .bind(&item.duration)
        .bind(&item.route)
        .bind(&item.instructions)
        .bind(item.catalog_item_id)
        .fetch_one(&mut *tx)
        .await?;
        items.push(pi);
    }

    let (pharmacy_rx_queue_id, pharmacy_status, pharmacy_order_id) =
        if let Some((queue_id, _, _)) = pharmacy_state {
            sqlx::query(
                "UPDATE pharmacy_prescriptions SET \
                status = 'pending_review'::pharmacy_rx_status, \
                reviewed_by = NULL, \
                reviewed_at = NULL, \
                review_notes = NULL, \
                rejection_reason = NULL, \
                allergy_check_done = false, \
                interaction_check_done = false, \
                interaction_check_result = NULL \
             WHERE id = $1 AND tenant_id = $2",
            )
            .bind(queue_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
            (Some(queue_id), Some("pending_review".to_owned()), None)
        } else {
            (None, None, None)
        };

    tx.commit().await?;

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "opd.prescription.updated_before_pharmacy_approval",
        serde_json::json!({
            "prescription_id": id,
            "encounter_id": rx.encounter_id,
            "doctor_id": rx.doctor_id,
            "items_count": items.len(),
        }),
    )
    .await;

    Ok(Json(PrescriptionWithItems {
        prescription: rx,
        items,
        pharmacy_status,
        pharmacy_rx_queue_id,
        pharmacy_order_id,
    }))
}

// ══════════════════════════════════════════════════════════
//  Prescription Templates (Favourites)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub department_id: Option<Uuid>,
    pub is_shared: Option<bool>,
    pub items: serde_json::Value,
}

pub async fn list_prescription_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PrescriptionTemplate>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::UPDATE,
            permissions::pharmacy::dispensing::CREATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PrescriptionTemplate>(
        "SELECT * FROM prescription_templates \
         WHERE tenant_id = $1 AND (created_by = $2 OR is_shared = true) \
         ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_prescription_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<PrescriptionTemplate>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let shared = body.is_shared.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PrescriptionTemplate>(
        "INSERT INTO prescription_templates \
         (tenant_id, created_by, name, description, department_id, is_shared, items) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.department_id)
    .bind(shared)
    .bind(&body.items)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_prescription_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "DELETE FROM prescription_templates \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ══════════════════════════════════════════════════════════
//  Patient Prescription History (cross-encounter)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct PrescriptionHistoryItem {
    pub prescription: Prescription,
    pub items: Vec<PrescriptionItem>,
    pub encounter_date: NaiveDate,
    pub doctor_name: Option<String>,
    pub pharmacy_status: Option<String>,
    pub pharmacy_rx_queue_id: Option<Uuid>,
    pub pharmacy_order_id: Option<Uuid>,
}

pub async fn list_patient_prescriptions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PrescriptionHistoryItem>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::UPDATE,
            permissions::pharmacy::prescriptions::LIST,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get all prescriptions for this patient via encounters
    let prescriptions = sqlx::query_as::<_, Prescription>(
        "SELECT p.* FROM prescriptions p \
         JOIN encounters e ON p.encounter_id = e.id \
         WHERE e.patient_id = $1 AND p.tenant_id = $2 \
         ORDER BY p.created_at DESC \
         LIMIT 50",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let prescription_ids: Vec<Uuid> = prescriptions.iter().map(|rx| rx.id).collect();
    let pharmacy_statuses =
        prescription_pharmacy_statuses(&mut tx, claims.tenant_id, &prescription_ids).await?;

    let mut result = Vec::with_capacity(prescriptions.len());
    for rx in &prescriptions {
        let items = sqlx::query_as::<_, PrescriptionItem>(
            "SELECT * FROM prescription_items \
             WHERE prescription_id = $1 AND tenant_id = $2 AND item_status = 'active' \
             ORDER BY created_at LIMIT 5000",
        )
        .bind(rx.id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

        // Get encounter date and doctor name
        let row: Option<(NaiveDate, Option<String>)> = sqlx::query_as(
            "SELECT e.encounter_date, \
             CASE WHEN u.id IS NOT NULL THEN u.full_name ELSE NULL END \
             FROM encounters e \
             LEFT JOIN users u ON e.doctor_id = u.id \
             WHERE e.id = $1",
        )
        .bind(rx.encounter_id)
        .fetch_optional(&mut *tx)
        .await?;

        let (encounter_date, doctor_name) =
            row.unwrap_or_else(|| (rx.created_at.date_naive(), None));
        let (pharmacy_rx_queue_id, pharmacy_status, pharmacy_order_id) = pharmacy_statuses
            .get(&rx.id)
            .cloned()
            .map_or((None, None, None), |(queue_id, status, order_id)| {
                (Some(queue_id), status, order_id)
            });

        result.push(PrescriptionHistoryItem {
            prescription: rx.clone(),
            items,
            encounter_date,
            doctor_name,
            pharmacy_status,
            pharmacy_rx_queue_id,
            pharmacy_order_id,
        });
    }

    tx.commit().await?;
    Ok(Json(result))
}

// ══════════════════════════════════════════════════════════
//  Patient Diagnoses (cross-encounter)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientDiagnosisRow {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub icd_code: Option<String>,
    pub icd_system: String,
    pub icd_display: Option<String>,
    pub icd_source_url: Option<String>,
    pub icd_source_version: Option<String>,
    pub icd_provider_mode: Option<String>,
    pub description: String,
    pub is_primary: bool,
    pub notes: Option<String>,
    pub severity: Option<String>,
    pub certainty: Option<String>,
    pub onset_date: Option<NaiveDate>,
    pub resolved_date: Option<NaiveDate>,
    pub snomed_code: Option<String>,
    pub snomed_display: Option<String>,
    pub encounter_date: NaiveDate,
    pub doctor_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn list_patient_diagnoses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientDiagnosisRow>>, AppError> {
    require_permission(&claims, permissions::opd::diagnoses::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientDiagnosisRow>(
        "SELECT d.id, d.encounter_id, d.icd_code, d.icd_system, d.icd_display, \
         d.icd_source_url, d.icd_source_version, d.icd_provider_mode, \
         d.description, d.is_primary, d.notes, d.severity, d.certainty, \
         d.onset_date, d.resolved_date, d.snomed_code, d.snomed_display, \
         e.encounter_date, \
         u.full_name AS doctor_name, \
         d.created_at \
         FROM diagnoses d \
         JOIN encounters e ON d.encounter_id = e.id \
         LEFT JOIN users u ON e.doctor_id = u.id \
         WHERE e.patient_id = $1 AND d.tenant_id = $2 \
         ORDER BY d.created_at DESC \
         LIMIT 100",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_opd_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_patient_diagnosis_response(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Medical Certificates
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateCertificateRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub certificate_type: String,
    pub issued_date: Option<NaiveDate>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub diagnosis: Option<String>,
    pub remarks: Option<String>,
    pub body: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct VoidCertificateRequest {
    pub void_reason: String,
}

async fn ensure_opd_patient_context_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
) -> Result<(), AppError> {
    let patient_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if !patient_exists {
        return Err(AppError::NotFound);
    }

    let Some(encounter_id) = encounter_id else {
        return Ok(());
    };

    let encounter_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if encounter_patient_id != patient_id {
        return Err(AppError::BadRequest(
            "encounter does not belong to patient".to_owned(),
        ));
    }

    Ok(())
}

pub async fn list_certificates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<MedicalCertificate>>, AppError> {
    require_permission(&claims, permissions::opd::certificates::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MedicalCertificate>(
        "SELECT * FROM medical_certificates \
         WHERE patient_id = $1 AND tenant_id = $2 AND is_void = false \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCertificateRequest>,
) -> Result<Json<MedicalCertificate>, AppError> {
    require_permission(&claims, permissions::opd::certificates::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_opd_patient_context_in_tx(
        &mut tx,
        &claims.tenant_id,
        body.patient_id,
        body.encounter_id,
    )
    .await?;
    let issued = if let Some(date) = body.issued_date {
        date
    } else {
        crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?
    };

    // Generate certificate number from sequence
    let seq: (i64,) = sqlx::query_as(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'CERT' \
         RETURNING current_val",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let cert_number = format!("CERT-{:06}", seq.0);

    let row = sqlx::query_as::<_, MedicalCertificate>(
        "INSERT INTO medical_certificates \
         (tenant_id, patient_id, encounter_id, doctor_id, certificate_type, \
          certificate_number, issued_date, valid_from, valid_to, \
          diagnosis, remarks, body) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(&body.certificate_type)
    .bind(&cert_number)
    .bind(issued)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .bind(&body.diagnosis)
    .bind(&body.remarks)
    .bind(&body.body)
    .fetch_one(&mut *tx)
    .await?;

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::OpdCertificateCreated,
        row.id,
        claims.sub,
        serde_json::json!({
            "certificate_id": row.id,
            "patient_id": row.patient_id,
            "certificate_number": &row.certificate_number,
            "certificate_type": &row.certificate_type,
            "encounter_id": row.encounter_id,
            "issued_date": row.issued_date,
        }),
    )
    .with_patient(row.patient_id);
    if let Some(encounter_id) = row.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    crate::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn void_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VoidCertificateRequest>,
) -> Result<Json<MedicalCertificate>, AppError> {
    require_permission(&claims, permissions::opd::certificates::VOID)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let reason = body.void_reason.trim();
    if reason.len() < 5 {
        return Err(AppError::BadRequest(
            "void reason must be at least 5 characters".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MedicalCertificate>(
        "UPDATE medical_certificates \
         SET is_void = true, voided_by = $3, voided_at = now(), void_reason = $4, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND is_void = false \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(reason)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(row) = row else {
        return Err(AppError::BadRequest(
            "certificate is already voided or was not found".to_owned(),
        ));
    };

    let audit_values = serde_json::json!({
        "certificate_id": row.id,
        "certificate_number": row.certificate_number,
        "patient_id": row.patient_id,
        "encounter_id": row.encounter_id,
        "void_reason": reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "opd.certificate.void",
            entity_type: "medical_certificate",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Patient vitals history (cross-encounter, for trend charts)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VitalHistoryPoint {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub encounter_date: NaiveDate,
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub bmi: Option<Decimal>,
    pub recorded_at: DateTime<Utc>,
}

/// GET /api/opd/patients/{id}/vitals-history
pub async fn list_patient_vitals_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<VitalHistoryPoint>>, AppError> {
    require_permission(&claims, permissions::opd::vitals::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VitalHistoryPoint>(
        "SELECT v.id, v.encounter_id, e.encounter_date, \
         v.temperature, v.pulse, v.systolic_bp, v.diastolic_bp, \
         v.respiratory_rate, v.spo2, v.weight_kg, v.height_cm, v.bmi, \
         v.recorded_at \
         FROM vitals v \
         JOIN encounters e ON e.id = v.encounter_id \
         WHERE e.patient_id = $1 \
         ORDER BY v.recorded_at ASC \
         LIMIT 200",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Referrals
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateReferralRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub to_department_id: Uuid,
    pub to_doctor_id: Option<Uuid>,
    pub urgency: Option<String>,
    pub reason: String,
    pub clinical_notes: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReferralWithNames {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub from_department_id: Uuid,
    pub from_department_name: Option<String>,
    pub to_department_id: Uuid,
    pub to_department_name: Option<String>,
    pub from_doctor_id: Option<Uuid>,
    pub from_doctor_name: Option<String>,
    pub to_doctor_id: Option<Uuid>,
    pub to_doctor_name: Option<String>,
    pub urgency: String,
    pub status: String,
    pub reason: String,
    pub clinical_notes: Option<String>,
    pub response_notes: Option<String>,
    pub responded_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// GET /api/opd/patients/{id}/referrals
pub async fn list_patient_referrals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<ReferralWithNames>>, AppError> {
    require_permission(&claims, permissions::opd::referrals::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ReferralWithNames>(
        "SELECT r.id, r.patient_id, r.encounter_id, \
         r.from_department_id, fd.name AS from_department_name, \
         r.to_department_id, td.name AS to_department_name, \
         r.from_doctor_id, fu.full_name AS from_doctor_name, \
         r.to_doctor_id, tu.full_name AS to_doctor_name, \
         r.urgency, r.status, r.reason, r.clinical_notes, \
         r.response_notes, r.responded_at, r.created_at \
         FROM referrals r \
         LEFT JOIN departments fd ON fd.id = r.from_department_id \
         LEFT JOIN departments td ON td.id = r.to_department_id \
         LEFT JOIN users fu ON fu.id = r.from_doctor_id \
         LEFT JOIN users tu ON tu.id = r.to_doctor_id \
         WHERE r.patient_id = $1 AND r.tenant_id = $2 \
         ORDER BY r.created_at DESC LIMIT 5000",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/opd/referrals
pub async fn create_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReferralRequest>,
) -> Result<Json<Referral>, AppError> {
    require_permission(&claims, permissions::opd::referrals::CREATE)?;

    let urgency = body.urgency.as_deref().unwrap_or("routine");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let referral_context_exists = match body.encounter_id {
        Some(encounter_id) => {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(\
                 SELECT 1 FROM encounters \
                 WHERE id = $1 AND patient_id = $2 AND tenant_id = $3\
                 )",
            )
            .bind(encounter_id)
            .bind(body.patient_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?
        }
        None => {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(\
                 SELECT 1 FROM patients \
                 WHERE id = $1 AND tenant_id = $2\
                 )",
            )
            .bind(body.patient_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?
        }
    };

    if !referral_context_exists {
        return Err(AppError::BadRequest(
            "referral patient or encounter context is invalid".to_owned(),
        ));
    }

    // Get current user's department (fallback to to_department if not assigned)
    let from_dept: (Uuid,) = sqlx::query_as(
        "SELECT department_id FROM users WHERE id = $1 AND department_id IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((body.to_department_id,));

    let row = sqlx::query_as::<_, Referral>(
        "INSERT INTO referrals \
         (tenant_id, patient_id, encounter_id, from_department_id, to_department_id, \
          from_doctor_id, to_doctor_id, urgency, reason, clinical_notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(from_dept.0)
    .bind(body.to_department_id)
    .bind(Some(claims.sub))
    .bind(body.to_doctor_id)
    .bind(urgency)
    .bind(&body.reason)
    .bind(&body.clinical_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Procedure Catalog & Orders
// ══════════════════════════════════════════════════════════

/// GET /api/opd/procedure-catalog
pub async fn list_procedure_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ProcedureCatalog>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::procedures::LIST,
            permissions::opd::procedures::CREATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProcedureCatalog>(
        "SELECT * FROM procedure_catalog WHERE is_active = true ORDER BY category, name LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateProcedureOrderRequest {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub procedure_id: Uuid,
    pub priority: Option<String>,
    pub scheduled_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProcedureOrderWithName {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub procedure_id: Uuid,
    pub procedure_name: Option<String>,
    pub procedure_code: Option<String>,
    pub ordered_by: Uuid,
    pub priority: String,
    pub status: String,
    pub scheduled_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub findings: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// GET /api/opd/encounters/{id}/procedure-orders
pub async fn list_procedure_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<ProcedureOrderWithName>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::procedures::LIST,
            permissions::opd::procedures::CANCEL,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProcedureOrderWithName>(
        "SELECT po.id, po.patient_id, po.encounter_id, po.procedure_id, \
         pc.name AS procedure_name, pc.code AS procedure_code, \
         po.ordered_by, po.priority, po.status, po.scheduled_date, \
         po.notes, po.findings, po.created_at \
         FROM procedure_orders po \
         JOIN procedure_catalog pc ON pc.id = po.procedure_id \
         WHERE po.encounter_id = $1 AND po.tenant_id = $2 \
         ORDER BY po.created_at DESC LIMIT 5000",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/opd/procedure-orders
pub async fn create_procedure_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateProcedureOrderRequest>,
) -> Result<Json<ProcedureOrder>, AppError> {
    require_permission(&claims, permissions::opd::procedures::CREATE)?;

    let priority = body.priority.as_deref().unwrap_or("routine");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ProcedureOrder>(
        "INSERT INTO procedure_orders \
         (tenant_id, patient_id, encounter_id, procedure_id, ordered_by, \
          priority, scheduled_date, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.procedure_id)
    .bind(claims.sub)
    .bind(priority)
    .bind(body.scheduled_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-charge the procedure (was a silent revenue leak). Priced from procedure_catalog
    // (base_price) or master-priced by the procedure code; source=procedure, idempotent by
    // the order id, and reversed if the order is cancelled.
    let proc: Option<(String, String, Option<Decimal>)> = sqlx::query_as(
        "SELECT code, name, base_price FROM procedure_catalog WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.procedure_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some((code, name, base_price)) = proc {
        super::billing::auto_charge(
            &mut tx,
            &claims.tenant_id,
            super::billing::AutoChargeInput {
                patient_id: body.patient_id,
                encounter_id: Some(body.encounter_id),
                charge_code: code,
                source: "procedure".to_owned(),
                source_id: row.id,
                quantity: 1,
                description_override: Some(name),
                unit_price_override: base_price,
                tax_percent_override: None,
            },
        )
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/opd/procedure-orders/{id}
pub async fn cancel_procedure_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::procedures::CANCEL)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "UPDATE procedure_orders SET status = 'cancelled', \
         cancelled_at = now(), cancel_reason = 'Cancelled by doctor' \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('ordered', 'scheduled')",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "procedure order not found or not cancellable".to_owned(),
        ));
    }

    // Reverse the charge posted at order time so a cancelled procedure isn't billed.
    super::billing::reverse_auto_charge_for_source(
        &mut tx,
        &claims.tenant_id,
        "procedure",
        order_id,
        claims.sub,
        "Procedure order cancelled",
    )
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "cancelled" })))
}

// ══════════════════════════════════════════════════════════
//  Duplicate order detection
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct DuplicateCheckQuery {
    pub patient_id: Uuid,
    pub test_id: Option<Uuid>,
    pub procedure_id: Option<Uuid>,
    pub hours: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DuplicateOrderInfo {
    pub id: Uuid,
    pub order_type: String,
    pub name: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// GET /api/opd/duplicate-check?patient_id=...&test_id=...&procedure_id=...&hours=24
pub async fn check_duplicate_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DuplicateCheckQuery>,
) -> Result<Json<Vec<DuplicateOrderInfo>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::lab::orders::CREATE,
            permissions::opd::procedures::CREATE,
        ],
    )?;

    let hours = q.hours.unwrap_or(24);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut results: Vec<DuplicateOrderInfo> = Vec::new();

    // Check lab orders
    if let Some(test_id) = q.test_id {
        let lab_dupes = sqlx::query_as::<_, DuplicateOrderInfo>(
            "SELECT lo.id, 'lab' AS order_type, lt.name, lo.status, lo.created_at \
             FROM lab_orders lo \
             JOIN lab_test_catalog lt ON lt.id = lo.test_id \
             WHERE lo.patient_id = $1 AND lo.test_id = $2 \
               AND lo.status NOT IN ('cancelled') \
               AND lo.created_at > now() - make_interval(hours => $3) \
             ORDER BY lo.created_at DESC LIMIT 5000",
        )
        .bind(q.patient_id)
        .bind(test_id)
        .bind(hours)
        .fetch_all(&mut *tx)
        .await?;
        results.extend(lab_dupes);
    }

    // Check procedure orders
    if let Some(proc_id) = q.procedure_id {
        let proc_dupes = sqlx::query_as::<_, DuplicateOrderInfo>(
            "SELECT po.id, 'procedure' AS order_type, pc.name, po.status, po.created_at \
             FROM procedure_orders po \
             JOIN procedure_catalog pc ON pc.id = po.procedure_id \
             WHERE po.patient_id = $1 AND po.procedure_id = $2 \
               AND po.status NOT IN ('cancelled') \
               AND po.created_at > now() - make_interval(hours => $3) \
             ORDER BY po.created_at DESC LIMIT 5000",
        )
        .bind(q.patient_id)
        .bind(proc_id)
        .bind(hours)
        .fetch_all(&mut *tx)
        .await?;
        results.extend(proc_dupes);
    }

    tx.commit().await?;
    Ok(Json(results))
}

// ══════════════════════════════════════════════════════════
//  ICD-10 Search (global — no tenant context needed)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct Icd10SearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

pub async fn search_icd10(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<Icd10SearchQuery>,
) -> Result<Json<Vec<Icd10Code>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::diagnoses::LIST,
            permissions::opd::diagnoses::CREATE,
            permissions::opd::diagnoses::UPDATE,
        ],
    )?;

    let limit = q.limit.unwrap_or(20).min(50);
    let search_term = format!("%{}%", q.q.trim());

    let rows = sqlx::query_as::<_, Icd10Code>(
        "SELECT * FROM icd10_codes \
         WHERE is_active = true AND \
           (code ILIKE $1 OR short_desc ILIKE $1) \
         ORDER BY \
           CASE WHEN code ILIKE $2 THEN 0 ELSE 1 END, \
           code \
         LIMIT $3",
    )
    .bind(&search_term)
    .bind(format!("{}%", q.q.trim()))
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Clinical corpus search and editable tenant entries
// ══════════════════════════════════════════════════════════

const CLINICAL_CORPUS_CACHE_TTL: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, Eq, Hash, PartialEq)]
struct ClinicalCorpusCacheKey {
    tenant_id: Uuid,
    term: String,
    section: Option<String>,
    corpus_type: Option<String>,
    limit: i64,
}

#[derive(Debug, Clone)]
struct ClinicalCorpusCacheEntry {
    fetched_at: Instant,
    rows: Vec<ClinicalCorpusEntry>,
}

static CLINICAL_CORPUS_SEARCH_CACHE: LazyLock<
    RwLock<HashMap<ClinicalCorpusCacheKey, ClinicalCorpusCacheEntry>>,
> = LazyLock::new(|| RwLock::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ClinicalCorpusEntry {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub entry_key: String,
    pub corpus_type: String,
    pub section: Option<String>,
    pub term: String,
    pub aliases: Vec<String>,
    pub short_text: Option<String>,
    pub insert_text: Option<String>,
    pub source_name: String,
    pub source_url: Option<String>,
    pub license_name: Option<String>,
    pub license_status: String,
    pub source_version: Option<String>,
    pub language: String,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ClinicalCorpusSearchQuery {
    pub q: String,
    pub section: Option<String>,
    pub corpus_type: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct Icd11SearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClinicalCorpusEntryRequest {
    pub corpus_type: String,
    pub section: Option<String>,
    pub term: String,
    pub aliases: Option<Vec<String>>,
    pub short_text: Option<String>,
    pub insert_text: Option<String>,
    pub source_name: Option<String>,
    pub source_url: Option<String>,
    pub license_name: Option<String>,
    pub license_status: Option<String>,
    pub source_version: Option<String>,
    pub language: Option<String>,
    pub priority: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClinicalCorpusEntryRequest {
    pub section: Option<String>,
    pub term: Option<String>,
    pub aliases: Option<Vec<String>>,
    pub short_text: Option<String>,
    pub insert_text: Option<String>,
    pub source_name: Option<String>,
    pub source_url: Option<String>,
    pub license_name: Option<String>,
    pub license_status: Option<String>,
    pub source_version: Option<String>,
    pub language: Option<String>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

fn normalized_corpus_key(corpus_type: &str, section: Option<&str>, term: &str) -> String {
    let corpus_type_part = corpus_type.trim().to_lowercase();
    let section_part = section.unwrap_or("general").trim().to_lowercase();
    let term_part: String = term
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect();
    format!("tenant:{corpus_type_part}:{section_part}:{term_part}")
}

fn cleaned_aliases(aliases: Option<Vec<String>>) -> Vec<String> {
    aliases
        .unwrap_or_default()
        .into_iter()
        .map(|alias| alias.trim().to_lowercase())
        .filter(|alias| !alias.is_empty())
        .collect()
}

fn normalized_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase)
}

fn is_valid_corpus_type(value: &str) -> bool {
    matches!(
        value,
        "soap_phrase"
            | "medical_term"
            | "lay_term"
            | "icd10"
            | "icd11"
            | "snomed"
            | "loinc"
            | "rxnorm"
    )
}

fn is_valid_license_status(value: &str) -> bool {
    matches!(
        value,
        "owned" | "open" | "licensed" | "restricted" | "reference_only"
    )
}

fn read_clinical_corpus_cache(key: &ClinicalCorpusCacheKey) -> Option<Vec<ClinicalCorpusEntry>> {
    let cache = CLINICAL_CORPUS_SEARCH_CACHE.read().ok()?;
    let entry = cache.get(key)?;
    if entry.fetched_at.elapsed() > CLINICAL_CORPUS_CACHE_TTL {
        return None;
    }
    Some(entry.rows.clone())
}

fn write_clinical_corpus_cache(key: ClinicalCorpusCacheKey, rows: Vec<ClinicalCorpusEntry>) {
    if let Ok(mut cache) = CLINICAL_CORPUS_SEARCH_CACHE.write() {
        cache.insert(
            key,
            ClinicalCorpusCacheEntry {
                fetched_at: Instant::now(),
                rows,
            },
        );
    }
}

fn clear_clinical_corpus_cache() {
    if let Ok(mut cache) = CLINICAL_CORPUS_SEARCH_CACHE.write() {
        cache.clear();
    }
}

async fn search_clinical_corpus_rows(
    state: &AppState,
    tenant_id: Uuid,
    term: &str,
    section_filter: Option<&str>,
    corpus_type_filter: Option<&str>,
    limit_filter: Option<i64>,
) -> Result<Vec<ClinicalCorpusEntry>, AppError> {
    let term = term.trim();
    if term.len() < 2 {
        return Ok(Vec::new());
    }

    let limit = limit_filter.unwrap_or(12).clamp(1, 50);
    let normalized_term = term.to_lowercase();
    let section = normalized_optional_text(section_filter);
    let corpus_type = normalized_optional_text(corpus_type_filter);
    if let Some(value) = corpus_type.as_deref() {
        if !is_valid_corpus_type(value) {
            return Err(AppError::BadRequest("invalid corpus_type".to_owned()));
        }
    }

    let cache_key = ClinicalCorpusCacheKey {
        tenant_id,
        term: normalized_term.clone(),
        section: section.clone(),
        corpus_type: corpus_type.clone(),
        limit,
    };
    if let Some(rows) = read_clinical_corpus_cache(&cache_key) {
        return Ok(rows);
    }

    let contains = format!("%{normalized_term}%");
    let starts = format!("{normalized_term}%");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let rows = sqlx::query_as::<_, ClinicalCorpusEntry>(
        "SELECT id, tenant_id, entry_key, corpus_type, section, term, aliases, short_text, \
                insert_text, source_name, source_url, license_name, license_status, \
                source_version, language, priority, is_active, created_at, updated_at \
         FROM clinical_corpus_entries \
         WHERE is_active = true \
           AND (tenant_id IS NULL OR tenant_id = $1) \
           AND ($2::text IS NULL OR section = $2) \
           AND ($3::text IS NULL OR corpus_type = $3) \
           AND ( \
                term ILIKE $4 \
                OR COALESCE(short_text, '') ILIKE $4 \
                OR COALESCE(insert_text, '') ILIKE $4 \
                OR EXISTS (SELECT 1 FROM unnest(aliases) alias WHERE alias ILIKE $4) \
           ) \
         ORDER BY \
           CASE \
             WHEN term ILIKE $5 THEN 0 \
             WHEN EXISTS (SELECT 1 FROM unnest(aliases) alias WHERE alias ILIKE $5) THEN 1 \
             ELSE 2 \
           END, \
           priority ASC, \
           CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END, \
           term ASC \
         LIMIT $6",
    )
    .bind(tenant_id)
    .bind(section.as_deref())
    .bind(corpus_type.as_deref())
    .bind(&contains)
    .bind(&starts)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    write_clinical_corpus_cache(cache_key, rows.clone());
    Ok(rows)
}

pub async fn search_clinical_corpus(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ClinicalCorpusSearchQuery>,
) -> Result<Json<Vec<ClinicalCorpusEntry>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let rows = search_clinical_corpus_rows(
        &state,
        claims.tenant_id,
        &q.q,
        q.section.as_deref(),
        q.corpus_type.as_deref(),
        q.limit,
    )
    .await?;
    Ok(Json(rows))
}

pub async fn search_icd11(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<Icd11SearchQuery>,
) -> Result<Json<Vec<ClinicalCorpusEntry>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let rows =
        search_clinical_corpus_rows(&state, claims.tenant_id, &q.q, None, Some("icd11"), q.limit)
            .await?;
    Ok(Json(rows))
}

pub async fn create_clinical_corpus_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateClinicalCorpusEntryRequest>,
) -> Result<Json<ClinicalCorpusEntry>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::CREATE,
    )?;

    let corpus_type = body.corpus_type.trim().to_lowercase();
    let term = body.term.trim();
    if corpus_type.is_empty() || term.is_empty() {
        return Err(AppError::BadRequest(
            "corpus_type and term are required".to_owned(),
        ));
    }
    if !is_valid_corpus_type(&corpus_type) {
        return Err(AppError::BadRequest("invalid corpus_type".to_owned()));
    }
    if let Some(value) = body.license_status.as_deref() {
        if !is_valid_license_status(value) {
            return Err(AppError::BadRequest("invalid license_status".to_owned()));
        }
    }

    let section = normalized_optional_text(body.section.as_deref());
    let entry_key = normalized_corpus_key(&corpus_type, section.as_deref(), term);
    let aliases = cleaned_aliases(body.aliases);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ClinicalCorpusEntry>(
        "INSERT INTO clinical_corpus_entries \
          (tenant_id, entry_key, corpus_type, section, term, aliases, short_text, insert_text, \
           source_name, source_url, license_name, license_status, source_version, language, \
           priority, created_by, updated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'MedBrains'), $10, $11, \
                 COALESCE($12, 'owned'), $13, COALESCE($14, 'en'), COALESCE($15, 100), $16, $16) \
         RETURNING id, tenant_id, entry_key, corpus_type, section, term, aliases, short_text, \
                   insert_text, source_name, source_url, license_name, license_status, \
                   source_version, language, priority, is_active, created_at, updated_at",
    )
    .bind(claims.tenant_id)
    .bind(entry_key)
    .bind(corpus_type)
    .bind(section.as_deref())
    .bind(term)
    .bind(aliases)
    .bind(body.short_text.as_deref())
    .bind(body.insert_text.as_deref())
    .bind(body.source_name.as_deref())
    .bind(body.source_url.as_deref())
    .bind(body.license_name.as_deref())
    .bind(body.license_status.as_deref())
    .bind(body.source_version.as_deref())
    .bind(body.language.as_deref())
    .bind(body.priority)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    clear_clinical_corpus_cache();
    Ok(Json(row))
}

pub async fn update_clinical_corpus_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateClinicalCorpusEntryRequest>,
) -> Result<Json<ClinicalCorpusEntry>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::UPDATE,
    )?;

    if let Some(value) = body.license_status.as_deref() {
        if !is_valid_license_status(value) {
            return Err(AppError::BadRequest("invalid license_status".to_owned()));
        }
    }

    let section = normalized_optional_text(body.section.as_deref());
    let aliases = body.aliases.map(|values| cleaned_aliases(Some(values)));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ClinicalCorpusEntry>(
        "UPDATE clinical_corpus_entries SET \
            section = COALESCE($1::text, section), \
            term = COALESCE(NULLIF($2, ''), term), \
            aliases = COALESCE($3::text[], aliases), \
            short_text = COALESCE($4::text, short_text), \
            insert_text = COALESCE($5::text, insert_text), \
            source_name = COALESCE($6::text, source_name), \
            source_url = COALESCE($7::text, source_url), \
            license_name = COALESCE($8::text, license_name), \
            license_status = COALESCE($9::text, license_status), \
            source_version = COALESCE($10::text, source_version), \
            language = COALESCE($11::text, language), \
            priority = COALESCE($12::integer, priority), \
            is_active = COALESCE($13::boolean, is_active), \
            updated_by = $14 \
         WHERE id = $15 AND tenant_id = $16 \
         RETURNING id, tenant_id, entry_key, corpus_type, section, term, aliases, short_text, \
                   insert_text, source_name, source_url, license_name, license_status, \
                   source_version, language, priority, is_active, created_at, updated_at",
    )
    .bind(section.as_deref())
    .bind(body.term.as_deref())
    .bind(aliases)
    .bind(body.short_text.as_deref())
    .bind(body.insert_text.as_deref())
    .bind(body.source_name.as_deref())
    .bind(body.source_url.as_deref())
    .bind(body.license_name.as_deref())
    .bind(body.license_status.as_deref())
    .bind(body.source_version.as_deref())
    .bind(body.language.as_deref())
    .bind(body.priority)
    .bind(body.is_active)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    clear_clinical_corpus_cache();
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Chief Complaint Masters
// ══════════════════════════════════════════════════════════

pub async fn list_chief_complaints(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ChiefComplaintMaster>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChiefComplaintMaster>(
        "SELECT * FROM chief_complaint_masters \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY category, name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Doctor Dockets — daily case summary
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct DocketQuery {
    pub date: Option<NaiveDate>,
}

pub async fn get_doctor_docket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DocketQuery>,
) -> Result<Json<Option<DoctorDocket>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::schedule::LIST,
            permissions::opd::schedule::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let docket_date = if let Some(date) = q.date {
        date
    } else {
        crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?
    };

    let row = sqlx::query_as::<_, DoctorDocket>(
        "SELECT * FROM doctor_dockets \
         WHERE tenant_id = $1 AND doctor_id = $2 AND docket_date = $3",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(docket_date)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn generate_doctor_docket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DocketQuery>,
) -> Result<Json<DoctorDocket>, AppError> {
    require_permission(&claims, permissions::opd::schedule::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let docket_date = if let Some(date) = q.date {
        date
    } else {
        crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?
    };

    let row = sqlx::query_as::<_, DoctorDocket>(
        "INSERT INTO doctor_dockets \
         (tenant_id, doctor_id, docket_date, total_patients, new_patients, follow_ups, \
          referrals_made, procedures_done) \
         SELECT $1, $2, $3, \
           COUNT(*), \
           COUNT(*) FILTER (WHERE e.notes IS NULL OR e.notes = ''), \
           COUNT(*) FILTER (WHERE e.notes IS NOT NULL AND e.notes <> ''), \
           (SELECT COUNT(*) FROM referrals r WHERE r.tenant_id = $1 AND r.from_doctor_id = $2 \
            AND (timezone(COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC'), r.created_at))::date = $3), \
           (SELECT COUNT(*) FROM procedure_orders po WHERE po.tenant_id = $1 AND po.ordered_by = $2 \
            AND (timezone(COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC'), po.created_at))::date = $3 AND po.status = 'completed') \
         FROM encounters e \
         WHERE e.tenant_id = $1 AND e.doctor_id = $2 AND e.encounter_date = $3 \
         ON CONFLICT (tenant_id, doctor_id, docket_date) DO UPDATE SET \
           total_patients = EXCLUDED.total_patients, \
           new_patients = EXCLUDED.new_patients, \
           follow_ups = EXCLUDED.follow_ups, \
           referrals_made = EXCLUDED.referrals_made, \
           procedures_done = EXCLUDED.procedures_done, \
           generated_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(docket_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Patient Reminders
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateReminderRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub reminder_type: String,
    pub reminder_date: NaiveDate,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRemindersQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

pub async fn list_reminders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRemindersQuery>,
) -> Result<Json<Vec<PatientReminder>>, AppError> {
    require_permission(&claims, permissions::opd::reminders::LIST)?;
    if q.patient_id.is_some() {
        require_permission(&claims, permissions::patients::VIEW)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientReminder>(
        "SELECT * FROM patient_reminders \
         WHERE tenant_id = $1 AND doctor_id = $2 \
           AND ($3::uuid IS NULL OR patient_id = $3) \
           AND ($4::text IS NULL OR status = $4) \
           AND ($5::date IS NULL OR reminder_date >= $5) \
           AND ($6::date IS NULL OR reminder_date <= $6) \
         ORDER BY reminder_date, priority DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(q.patient_id)
    .bind(&q.status)
    .bind(q.from_date)
    .bind(q.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_reminder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReminderRequest>,
) -> Result<Json<PatientReminder>, AppError> {
    require_permission(&claims, permissions::opd::reminders::CREATE)?;

    let priority = body.priority.as_deref().unwrap_or("normal");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_opd_patient_context_in_tx(
        &mut tx,
        &claims.tenant_id,
        body.patient_id,
        body.encounter_id,
    )
    .await?;

    let row = sqlx::query_as::<_, PatientReminder>(
        "INSERT INTO patient_reminders \
         (tenant_id, patient_id, encounter_id, doctor_id, reminder_type, \
          reminder_date, title, description, priority) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(&body.reminder_type)
    .bind(body.reminder_date)
    .bind(&body.title)
    .bind(&body.description)
    .bind(priority)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_reminder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PatientReminder>, AppError> {
    require_permission(&claims, permissions::opd::reminders::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PatientReminder>(
        "UPDATE patient_reminders SET status = 'completed', completed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn cancel_reminder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PatientReminder>, AppError> {
    require_permission(&claims, permissions::opd::reminders::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PatientReminder>(
        "UPDATE patient_reminders SET status = 'cancelled', cancelled_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Patient Feedback
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateFeedbackRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub rating: Option<i32>,
    pub wait_time_rating: Option<i32>,
    pub staff_rating: Option<i32>,
    pub cleanliness_rating: Option<i32>,
    pub overall_experience: Option<String>,
    pub suggestions: Option<String>,
    pub would_recommend: Option<bool>,
    pub is_anonymous: Option<bool>,
}

pub async fn list_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientFeedback>>, AppError> {
    require_permission(&claims, permissions::opd::feedback::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientFeedback>(
        "SELECT * FROM patient_feedback WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY submitted_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFeedbackRequest>,
) -> Result<Json<PatientFeedback>, AppError> {
    require_permission(&claims, permissions::opd::feedback::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_opd_patient_context_in_tx(
        &mut tx,
        &claims.tenant_id,
        body.patient_id,
        body.encounter_id,
    )
    .await?;

    let row = sqlx::query_as::<_, PatientFeedback>(
        "INSERT INTO patient_feedback \
         (tenant_id, patient_id, encounter_id, doctor_id, department_id, \
          rating, wait_time_rating, staff_rating, cleanliness_rating, \
          overall_experience, suggestions, would_recommend, is_anonymous) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(body.rating)
    .bind(body.wait_time_rating)
    .bind(body.staff_rating)
    .bind(body.cleanliness_rating)
    .bind(&body.overall_experience)
    .bind(&body.suggestions)
    .bind(body.would_recommend)
    .bind(body.is_anonymous.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Procedure Consents
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateConsentRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub procedure_order_id: Option<Uuid>,
    pub procedure_name: String,
    pub consent_type: Option<String>,
    pub risks_explained: Option<String>,
    pub alternatives_explained: Option<String>,
    pub benefits_explained: Option<String>,
    pub patient_questions: Option<String>,
    pub consented_by_name: Option<String>,
    pub consented_by_relation: Option<String>,
    pub witness_name: Option<String>,
    pub witness_designation: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RevokeProcedureConsentRequest {
    pub withdrawal_reason: String,
}

pub async fn list_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<ProcedureConsent>>, AppError> {
    require_permission(&claims, permissions::opd::consents::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProcedureConsent>(
        "SELECT * FROM procedure_consents WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConsentRequest>,
) -> Result<Json<ProcedureConsent>, AppError> {
    require_permission(&claims, permissions::opd::consents::CREATE)?;

    let consent_type = body.consent_type.as_deref().unwrap_or("procedure");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_opd_patient_context_in_tx(
        &mut tx,
        &claims.tenant_id,
        body.patient_id,
        body.encounter_id,
    )
    .await?;

    let row = sqlx::query_as::<_, ProcedureConsent>(
        "INSERT INTO procedure_consents \
         (tenant_id, patient_id, encounter_id, procedure_order_id, procedure_name, \
          consent_type, risks_explained, alternatives_explained, benefits_explained, \
          patient_questions, consented_by_name, consented_by_relation, \
          witness_name, witness_designation, doctor_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.procedure_order_id)
    .bind(&body.procedure_name)
    .bind(consent_type)
    .bind(&body.risks_explained)
    .bind(&body.alternatives_explained)
    .bind(&body.benefits_explained)
    .bind(&body.patient_questions)
    .bind(&body.consented_by_name)
    .bind(&body.consented_by_relation)
    .bind(&body.witness_name)
    .bind(&body.witness_designation)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn sign_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProcedureConsent>, AppError> {
    require_permission(&claims, permissions::opd::consents::SIGN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ProcedureConsent>(
        "UPDATE procedure_consents SET status = 'signed', signed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let row = row.ok_or(AppError::NotFound)?;
    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::OpdConsentSigned,
        row.id,
        claims.sub,
        serde_json::json!({
            "consent_id": row.id,
            "patient_id": row.patient_id,
            "encounter_id": row.encounter_id,
            "procedure_order_id": row.procedure_order_id,
            "consent_type": &row.consent_type,
            "signed_at": row.signed_at,
            "status": &row.status,
        }),
    )
    .with_patient(row.patient_id);
    if let Some(encounter_id) = row.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    crate::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn revoke_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeProcedureConsentRequest>,
) -> Result<Json<ProcedureConsent>, AppError> {
    require_permission(&claims, permissions::opd::consents::REVOKE)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let reason = body.withdrawal_reason.trim();
    if reason.len() < 5 {
        return Err(AppError::BadRequest(
            "withdrawal reason must be at least 5 characters".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ProcedureConsent>(
        "UPDATE procedure_consents \
         SET status = 'withdrawn', withdrawn_at = now(), withdrawal_reason = $3, updated_at = now() \
         WHERE id = $1 \
           AND tenant_id = $2 \
           AND status IN ('pending', 'signed') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(row) = row else {
        return Err(AppError::BadRequest(
            "consent is not revocable or was not found".to_owned(),
        ));
    };

    let audit_values = serde_json::json!({
        "consent_id": row.id,
        "patient_id": row.patient_id,
        "encounter_id": row.encounter_id,
        "procedure_name": row.procedure_name,
        "withdrawal_reason": reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "opd.consent.revoke",
            entity_type: "procedure_consent",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ═══════════════════════════════════════════════════════════
//  Consultation Templates
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateConsultationTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub specialty: Option<String>,
    pub department_id: Option<Uuid>,
    pub is_shared: bool,
    pub chief_complaints: Option<Vec<String>>,
    pub default_history: Option<serde_json::Value>,
    pub default_examination: Option<serde_json::Value>,
    pub default_ros: Option<serde_json::Value>,
    pub default_plan: Option<String>,
    pub common_diagnoses: Option<Vec<String>>,
    pub common_medications: Option<serde_json::Value>,
}

pub async fn list_consultation_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ConsultationTemplate>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::CREATE,
            permissions::opd::visit::UPDATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsultationTemplate>(
        "SELECT * FROM consultation_templates \
         WHERE tenant_id = $1 AND is_active = true \
         AND (is_shared = true OR created_by = $2) \
         ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_consultation_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConsultationTemplateRequest>,
) -> Result<Json<ConsultationTemplate>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsultationTemplate>(
        "INSERT INTO consultation_templates \
         (tenant_id, created_by, name, description, specialty, department_id, \
          is_shared, chief_complaints, default_history, default_examination, \
          default_ros, default_plan, common_diagnoses, common_medications) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.specialty)
    .bind(body.department_id)
    .bind(body.is_shared)
    .bind(body.chief_complaints.as_deref().unwrap_or(&[]))
    .bind(
        body.default_history
            .as_ref()
            .unwrap_or(&serde_json::json!({})),
    )
    .bind(
        body.default_examination
            .as_ref()
            .unwrap_or(&serde_json::json!({})),
    )
    .bind(body.default_ros.as_ref().unwrap_or(&serde_json::json!({})))
    .bind(&body.default_plan)
    .bind(body.common_diagnoses.as_deref().unwrap_or(&[]))
    .bind(
        body.common_medications
            .as_ref()
            .unwrap_or(&serde_json::json!([])),
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_consultation_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConsultationTemplate>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsultationTemplate>(
        "UPDATE consultation_templates SET is_active = false, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  SNOMED CT Search (global — no tenant context needed)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SnomedSearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

pub async fn search_snomed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SnomedSearchQuery>,
) -> Result<Json<Vec<SnomedCode>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let limit = q.limit.unwrap_or(20).min(50);
    let search_term = format!("%{}%", q.q.trim());

    let rows = sqlx::query_as::<_, SnomedCode>(
        "SELECT * FROM snomed_codes \
         WHERE is_active = true AND \
           (code ILIKE $1 OR display_name ILIKE $1) \
         ORDER BY \
           CASE WHEN code ILIKE $2 THEN 0 ELSE 1 END, \
           display_name \
         LIMIT $3",
    )
    .bind(&search_term)
    .bind(format!("{}%", q.q.trim()))
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Multi-Doctor Appointment Groups
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SlotRequest {
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: String,
    pub slot_end: String,
    pub appointment_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BookAppointmentGroupRequest {
    pub patient_id: Uuid,
    pub slot_requests: Vec<SlotRequest>,
}

use medbrains_core::appointment::Appointment;

pub async fn book_appointment_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BookAppointmentGroupRequest>,
) -> Result<Json<Vec<Appointment>>, AppError> {
    require_permission(&claims, permissions::opd::appointment::CREATE)?;

    if body.slot_requests.is_empty() {
        return Err(AppError::BadRequest(
            "slot_requests must not be empty".into(),
        ));
    }

    let group_id = Uuid::new_v4();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // appointments.patient_id FKs the GLOBAL patients table; RLS only gates the
    // new row's tenant_id. Validate the patient belongs to the caller's tenant so
    // a foreign-tenant patient UUID can't be booked (tenant-isolation break).
    ensure_opd_patient_context_in_tx(&mut tx, &claims.tenant_id, body.patient_id, None).await?;

    let mut appointments = Vec::with_capacity(body.slot_requests.len());

    for slot in &body.slot_requests {
        let start: NaiveTime = slot
            .slot_start
            .parse()
            .map_err(|_| AppError::BadRequest("Invalid slot_start time format".into()))?;
        let end: NaiveTime = slot
            .slot_end
            .parse()
            .map_err(|_| AppError::BadRequest("Invalid slot_end time format".into()))?;
        let appt_type = slot.appointment_type.as_deref().unwrap_or("new_visit");

        let appt = sqlx::query_as::<_, Appointment>(
            "INSERT INTO appointments \
             (tenant_id, patient_id, doctor_id, department_id, appointment_date, \
              slot_start, slot_end, appointment_type, status, appointment_group_id, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::appointment_type, \
                     'scheduled'::appointment_status, $9, $10) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .bind(slot.doctor_id)
        .bind(slot.department_id)
        .bind(slot.appointment_date)
        .bind(start)
        .bind(end)
        .bind(appt_type)
        .bind(group_id)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        appointments.push(appt);
    }

    tx.commit().await?;
    Ok(Json(appointments))
}

pub async fn list_appointment_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<Appointment>>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointments \
         WHERE tenant_id = $1 AND appointment_group_id = $2 \
         ORDER BY slot_start LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(group_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Wait Time Estimation
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct WaitEstimateQuery {
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct WaitEstimate {
    pub estimated_minutes: i64,
    pub queue_position: i64,
    pub avg_consultation_minutes: f64,
}

pub async fn get_wait_estimate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<WaitEstimateQuery>,
) -> Result<Json<WaitEstimate>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let today = crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;

    // Count waiting patients in queue
    let waiting: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM opd_queues \
         WHERE tenant_id = $1 AND status = 'waiting' \
           AND ($2::uuid IS NULL OR department_id = $2) \
           AND ($3::uuid IS NULL OR doctor_id = $3) \
           AND queue_date = $4",
    )
    .bind(claims.tenant_id)
    .bind(q.department_id)
    .bind(q.doctor_id)
    .bind(today)
    .fetch_one(&mut *tx)
    .await?;

    // Average consultation duration from completed consultations in last 7 days
    let avg: (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(EXTRACT(EPOCH FROM (q.completed_at - q.called_at)) / 60.0)::float8 \
         FROM opd_queues q \
         WHERE q.tenant_id = $1 AND q.status = 'completed' \
           AND q.called_at IS NOT NULL AND q.completed_at IS NOT NULL \
           AND ($2::uuid IS NULL OR q.department_id = $2) \
           AND ($3::uuid IS NULL OR q.doctor_id = $3) \
           AND q.queue_date >= $4::date - INTERVAL '7 days'",
    )
    .bind(claims.tenant_id)
    .bind(q.department_id)
    .bind(q.doctor_id)
    .bind(today)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let avg_minutes = avg.0.unwrap_or(10.0);
    let queue_position = waiting.0;
    #[allow(clippy::cast_possible_truncation)]
    let estimated_minutes = (queue_position as f64 * avg_minutes) as i64;

    Ok(Json(WaitEstimate {
        estimated_minutes,
        queue_position,
        avg_consultation_minutes: avg_minutes,
    }))
}

// ══════════════════════════════════════════════════════════
//  OPD → IPD Admission (admit from encounter)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct AdmitFromOpdRequest {
    pub department_id: Uuid,
    pub ward_id: Option<Uuid>,
    pub bed_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AdmitFromOpdResponse {
    pub ipd_encounter: Encounter,
    pub admission: Admission,
    pub vitals_copied: i64,
    pub diagnoses_copied: i64,
    pub prescriptions_copied: i64,
}

pub async fn admit_from_opd(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<AdmitFromOpdRequest>,
) -> Result<Json<AdmitFromOpdResponse>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // 1. Validate OPD encounter exists
    let opd_encounter =
        sqlx::query_as::<_, Encounter>("SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2")
            .bind(encounter_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::NotFound)?;

    if opd_encounter.encounter_type != EncounterType::Opd {
        return Err(AppError::BadRequest(
            "Only OPD encounters can be admitted to IPD".to_owned(),
        ));
    }
    if matches!(
        opd_encounter.status,
        EncounterStatus::Completed | EncounterStatus::Cancelled
    ) {
        return Err(AppError::Conflict(
            "OPD encounter is already closed".to_owned(),
        ));
    }

    let doctor_id = body.doctor_id.unwrap_or(claims.sub);
    let today = crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;
    let ipd_attributes = serde_json::json!({
        "source": "opd",
        "opd_encounter_id": encounter_id,
    });

    // 2. Create IPD encounter
    let ipd_encounter = sqlx::query_as::<_, Encounter>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes) \
         VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(opd_encounter.patient_id)
    .bind(body.department_id)
    .bind(doctor_id)
    .bind(today)
    .bind(&body.notes)
    .bind(ipd_attributes)
    .fetch_one(&mut *tx)
    .await?;

    // 3. Create admission record
    let admission = sqlx::query_as::<_, Admission>(
        "INSERT INTO admissions \
         (tenant_id, encounter_id, patient_id, bed_id, admitting_doctor, status, admitted_at, \
          admission_source, ward_id) \
         VALUES ($1, $2, $3, $4, $5, 'admitted'::admission_status, NOW(), \
                 'opd'::admission_source, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(ipd_encounter.id)
    .bind(opd_encounter.patient_id)
    .bind(body.bed_id)
    .bind(doctor_id)
    .bind(body.ward_id)
    .fetch_one(&mut *tx)
    .await?;

    // 4. Update bed_states if bed assigned
    if let Some(bid) = body.bed_id {
        sqlx::query(
            "UPDATE bed_states SET ward_id = $3, admission_id = $4 \
             WHERE location_id = $1 AND tenant_id = $2",
        )
        .bind(bid)
        .bind(claims.tenant_id)
        .bind(body.ward_id)
        .bind(admission.id)
        .execute(&mut *tx)
        .await?;
    }

    // 5. Copy vitals from OPD encounter to IPD encounter
    let vitals_result = sqlx::query(
        "INSERT INTO vitals \
         (tenant_id, encounter_id, recorded_by, temperature, pulse, systolic_bp, diastolic_bp, \
          respiratory_rate, spo2, weight_kg, height_cm, bmi, notes, recorded_at) \
         SELECT tenant_id, $2, recorded_by, temperature, pulse, systolic_bp, diastolic_bp, \
                respiratory_rate, spo2, weight_kg, height_cm, bmi, notes, recorded_at \
         FROM vitals WHERE encounter_id = $1 AND tenant_id = $3",
    )
    .bind(encounter_id)
    .bind(ipd_encounter.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // 6. Copy active diagnoses from OPD encounter to IPD encounter
    let diagnoses_result = sqlx::query(
        "INSERT INTO diagnoses \
         (tenant_id, encounter_id, icd_code, icd_system, icd_display, icd_source_url, \
          icd_source_version, icd_provider_mode, description, is_primary, notes, \
          severity, certainty, onset_date, resolved_date, snomed_code, snomed_display) \
         SELECT tenant_id, $2, icd_code, icd_system, icd_display, icd_source_url, \
                icd_source_version, icd_provider_mode, description, is_primary, notes, \
                severity, certainty, onset_date, resolved_date, snomed_code, snomed_display \
         FROM diagnoses WHERE encounter_id = $1 AND tenant_id = $3 AND resolved_date IS NULL",
    )
    .bind(encounter_id)
    .bind(ipd_encounter.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // 7. Copy prescriptions from OPD to IPD (prescriptions + items)
    let prescriptions_result = sqlx::query(
        "WITH src AS ( \
           SELECT id AS old_id FROM prescriptions \
           WHERE encounter_id = $1 AND tenant_id = $3 \
         ), new_rx AS ( \
           INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, notes) \
           SELECT p.tenant_id, $2, p.doctor_id, p.notes \
           FROM prescriptions p JOIN src ON p.id = src.old_id \
           RETURNING id \
         ) \
         SELECT COUNT(*) FROM new_rx",
    )
    .bind(encounter_id)
    .bind(ipd_encounter.id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let admission_event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::IpdAdmissionCreated,
        admission.id,
        claims.sub,
        serde_json::json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "opd_encounter_id": encounter_id,
            "encounter_id": ipd_encounter.id,
            "department_id": body.department_id,
            "ward_id": admission.ward_id,
            "bed_id": admission.bed_id,
            "admission_source": "opd",
        }),
    )
    .with_patient(admission.patient_id)
    .with_admission(admission.id)
    .with_encounter(ipd_encounter.id)
    .with_department(body.department_id);
    crate::events::queue_clinical_event_in_tx(&mut tx, &admission_event).await?;

    if let Some(bed_id) = body.bed_id {
        let bed_event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::BedAssigned,
            admission.id,
            claims.sub,
            serde_json::json!({
                "bed_id": bed_id,
                "admission_id": admission.id,
                "patient_id": admission.patient_id,
                "encounter_id": ipd_encounter.id,
                "ward_id": admission.ward_id,
                "source": "opd",
            }),
        )
        .with_patient(admission.patient_id)
        .with_admission(admission.id)
        .with_encounter(ipd_encounter.id)
        .with_department(body.department_id);
        crate::events::queue_clinical_event_in_tx(&mut tx, &bed_event).await?;
    }

    // 8. Mark OPD encounter as completed
    sqlx::query(
        "UPDATE encounters SET status = 'completed'::encounter_status, updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let admit_doctor_name =
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(doctor_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned());

    let admit_dept_name =
        sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
            .bind(body.department_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned());

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "ipd.admission.created",
        serde_json::json!({
            "admission_id": admission.id,
            "opd_encounter_id": encounter_id,
            "ipd_encounter_id": ipd_encounter.id,
            "patient_id": opd_encounter.patient_id,
            "doctor_name": admit_doctor_name,
            "department_name": admit_dept_name,
            "source": "opd",
        }),
    )
    .await;

    Ok(Json(AdmitFromOpdResponse {
        ipd_encounter,
        admission,
        vitals_copied: vitals_result.rows_affected().try_into().unwrap_or(0),
        diagnoses_copied: diagnoses_result.rows_affected().try_into().unwrap_or(0),
        prescriptions_copied: prescriptions_result.rows_affected().try_into().unwrap_or(0),
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/opd/visits/{id}/pharmacy-status
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PharmacyDispatchStatusRow {
    pub drug_name: String,
    pub quantity_ordered: i32,
    pub quantity_dispensed: i32,
    pub status: String,
}

pub async fn pharmacy_dispatch_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<PharmacyDispatchStatusRow>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::opd::visit::UPDATE,
            permissions::pharmacy::prescriptions::LIST,
            permissions::pharmacy::dispensing::CREATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyDispatchStatusRow>(
        "SELECT oi.drug_name, \
         oi.quantity AS quantity_ordered, \
         COALESCE(oi.quantity - COALESCE(oi.quantity_returned, 0), oi.quantity) AS quantity_dispensed, \
         o.status::text \
         FROM pharmacy_orders o \
         JOIN pharmacy_order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id \
         WHERE o.encounter_id = $1 AND o.tenant_id = $2 \
         ORDER BY oi.drug_name LIMIT 5000",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/opd/referrals/tracking
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ReferralTrackingQuery {
    pub status: Option<String>,
    pub from_department_id: Option<Uuid>,
    pub to_department_id: Option<Uuid>,
}

pub async fn referral_tracking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReferralTrackingQuery>,
) -> Result<Json<Vec<ReferralWithNames>>, AppError> {
    require_permission(&claims, permissions::opd::referrals::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ReferralWithNames>(
        "SELECT r.id, r.patient_id, r.encounter_id, \
         r.from_department_id, fd.name AS from_department_name, \
         r.to_department_id, td.name AS to_department_name, \
         r.from_doctor_id, fu.full_name AS from_doctor_name, \
         r.to_doctor_id, tu.full_name AS to_doctor_name, \
         r.urgency, r.status, r.reason, r.clinical_notes, \
         r.response_notes, r.responded_at, r.created_at \
         FROM referrals r \
         LEFT JOIN departments fd ON fd.id = r.from_department_id \
         LEFT JOIN departments td ON td.id = r.to_department_id \
         LEFT JOIN users fu ON fu.id = r.from_doctor_id \
         LEFT JOIN users tu ON tu.id = r.to_doctor_id \
         WHERE r.tenant_id = $1 \
           AND ($2::text IS NULL OR r.status::text = $2) \
           AND ($3::uuid IS NULL OR r.from_department_id = $3) \
           AND ($4::uuid IS NULL OR r.to_department_id = $4) \
         ORDER BY r.created_at DESC \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(&params.status)
    .bind(params.from_department_id)
    .bind(params.to_department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/opd/analytics/followup
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FollowupComplianceRow {
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub encounter_id: Uuid,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub department: Option<String>,
    pub follow_up_date: NaiveDate,
    pub last_visit_date: NaiveDate,
    pub days_overdue: i32,
}

pub async fn followup_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FollowupComplianceRow>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let can_view_patient_identity = crate::middleware::authorization::is_bypass_role(&claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let today = crate::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FollowupComplianceRow>(
        "SELECT e.patient_id, \
         CASE WHEN $3::bool THEN (p.first_name || ' ' || p.last_name) ELSE NULL END AS patient_name, \
         CASE WHEN $3::bool THEN p.uhid ELSE NULL END AS uhid, \
         e.id AS encounter_id, e.department_id, e.doctor_id, d.name AS department, \
         a.appointment_date AS follow_up_date, e.encounter_date::date AS last_visit_date, \
         ($2::date - a.appointment_date)::int AS days_overdue \
         FROM appointments a \
         JOIN encounters e ON e.id = a.encounter_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         WHERE a.tenant_id = $1 \
           AND a.appointment_type = 'follow_up' \
           AND a.status = 'no_show' \
           AND a.appointment_date < $2 \
         ORDER BY a.appointment_date ASC \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(today)
    .bind(can_view_patient_identity)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Verbal / telephone order countersign register (NABH audit) ──────────

#[derive(Debug, Deserialize)]
pub struct VerbalOrderQuery {
    /// Optional filter: awaiting | overdue | countersigned_on_time |
    /// countersigned_late. Omitted = all.
    pub status: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VerbalOrderEntry {
    pub id: Uuid,
    pub order_mode: String,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub ordering_doctor_id: Option<Uuid>,
    pub ordering_doctor_name: Option<String>,
    pub transcribed_by: Option<Uuid>,
    pub transcribed_by_name: Option<String>,
    pub read_back_confirmed: bool,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub countersign_due_at: Option<DateTime<Utc>>,
    pub is_signed: bool,
    pub countersigned_at: Option<DateTime<Utc>>,
    pub countersigned_by: Option<Uuid>,
    pub countersigned_by_name: Option<String>,
    pub compliance_status: String,
}

/// Ward/compliance-wide register of verbal & telephone medication orders and
/// their countersignature status (NABH/JCI medication-safety evidence). The
/// closing signature lives in `signed_records` (joined via `signed_record_id`);
/// `compliance_status` is derived from the deadline vs the signing time.
pub async fn list_verbal_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<VerbalOrderQuery>,
) -> Result<Json<Vec<VerbalOrderEntry>>, AppError> {
    require_permission(&claims, permissions::doctor::signoffs::VERBAL_REGISTER)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut rows = sqlx::query_as::<_, VerbalOrderEntry>(
        "SELECT p.id, p.order_mode, p.read_back_confirmed, p.created_at, \
                p.countersign_due_at, p.is_signed, \
                COALESCE(p.patient_id, e.patient_id) AS patient_id, \
                CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name) AS patient_name, \
                pat.uhid, \
                p.doctor_id AS ordering_doctor_id, \
                od.full_name AS ordering_doctor_name, \
                p.transcribed_by, \
                tn.full_name AS transcribed_by_name, \
                COALESCE(NULLIF(p.notes, ''), CONCAT(( \
                    SELECT COUNT(*) FROM prescription_items pi \
                    WHERE pi.tenant_id = p.tenant_id AND pi.prescription_id = p.id \
                ), ' medication(s)')) AS summary, \
                sr.signed_at AS countersigned_at, \
                sr.signer_user_id AS countersigned_by, \
                cs.full_name AS countersigned_by_name, \
                CASE \
                    WHEN p.is_signed AND sr.signed_at IS NOT NULL AND p.countersign_due_at IS NOT NULL AND sr.signed_at <= p.countersign_due_at THEN 'countersigned_on_time' \
                    WHEN p.is_signed THEN 'countersigned_late' \
                    WHEN p.countersign_due_at IS NOT NULL AND now() > p.countersign_due_at THEN 'overdue' \
                    ELSE 'awaiting' \
                END AS compliance_status \
         FROM prescriptions p \
         LEFT JOIN encounters e ON e.tenant_id = p.tenant_id AND e.id = p.encounter_id \
         LEFT JOIN patients pat ON pat.tenant_id = p.tenant_id AND pat.id = COALESCE(p.patient_id, e.patient_id) \
         LEFT JOIN users od ON od.id = p.doctor_id \
         LEFT JOIN users tn ON tn.id = p.transcribed_by \
         LEFT JOIN signed_records sr ON sr.id = p.signed_record_id \
         LEFT JOIN users cs ON cs.id = sr.signer_user_id \
         WHERE p.tenant_id = $1 AND p.order_mode <> 'written' \
         ORDER BY p.is_signed ASC, p.countersign_due_at ASC NULLS LAST \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    if let Some(status) = query.status.as_deref().filter(|s| !s.is_empty()) {
        rows.retain(|r| r.compliance_status == status);
    }

    Ok(Json(rows))
}
