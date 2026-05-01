#![allow(clippy::too_many_lines)]

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::DateTime;
use chrono::{NaiveDate, Utc};
use medbrains_core::consultation::{
    ChiefComplaintMaster, Consultation, ConsultationTemplate, Diagnosis, DoctorDocket, Icd10Code,
    MedicalCertificate, PatientFeedback, PatientReminder, Prescription, PrescriptionItem,
    PrescriptionTemplate, ProcedureCatalog, ProcedureConsent, ProcedureOrder, Referral, SnomedCode,
    Vital,
};
use medbrains_core::encounter::{Encounter, OpdQueue};
use medbrains_core::ipd::Admission;
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

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
    pub notes: Option<String>,
    pub visit_type: Option<String>,
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
    pub status: Option<String>,
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
    pub patient_name: String,
    pub uhid: String,
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
pub struct CreatePrescriptionRequest {
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
}

// ══════════════════════════════════════════════════════════
//  Token generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SequenceResult {
    current_val: i64,
}

async fn generate_opd_token(
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
    let visible_ids: Option<Vec<uuid::Uuid>> = if authz_ctx.is_bypass {
        None
    } else {
        Some(
            state
                .authz
                .list_accessible(
                    &authz_ctx,
                    "encounter",
                    medbrains_authz::Relation::Viewer,
                )
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let today = Utc::now().date_naive();

    let visit_type = body.visit_type.as_deref().unwrap_or("walk_in");

    let encounter = sqlx::query_as::<_, Encounter>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes, visit_type) \
         VALUES ($1, $2, 'opd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6, '{}', $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(body.doctor_id)
    .bind(today)
    .bind(&body.notes)
    .bind(visit_type)
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
    .bind(body.department_id)
    .bind(body.doctor_id)
    .bind(token)
    .bind(today)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let patient_name = sqlx::query_scalar::<_, String>(
        "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1",
    )
    .bind(encounter.patient_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

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
            "patient_name": patient_name,
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    // ── ReBAC pre-check — must hold `view` on the specific encounter ──
    let authz_ctx = crate::middleware::authorization::authz_context(&claims);
    let allowed = state
        .authz
        .check(&authz_ctx, medbrains_authz::Relation::Viewer, "encounter", id)
        .await
        .unwrap_or(false);
    if !allowed {
        return Err(AppError::NotFound);
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

    let today = Utc::now().date_naive();
    let queue_date = params.date.unwrap_or(today);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec![
        "q.tenant_id = $1".to_owned(),
        "q.queue_date = $2".to_owned(),
    ];
    let mut bind_idx: usize = 3;

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
    if let Some(ref status) = params.status {
        conditions.push(format!("q.status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
        let _ = bind_idx; // suppress unused warning
    }

    let where_clause = conditions.join(" AND ");

    let sql = format!(
        "SELECT q.id, q.encounter_id, q.department_id, q.doctor_id, q.token_number, \
                q.status::text AS status, q.queue_date, q.called_at, q.completed_at, \
                e.patient_id, \
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name, \
                p.uhid \
         FROM opd_queues q \
         JOIN encounters e ON e.id = q.encounter_id \
         JOIN patients p ON p.id = e.patient_id \
         WHERE {where_clause} \
         ORDER BY q.token_number ASC"
    );

    let mut query = sqlx::query_as::<_, QueueEntry>(&sql)
        .bind(claims.tenant_id)
        .bind(queue_date);
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
                    encounter_id: q.encounter_id,
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

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let department_name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM departments WHERE id = $1",
    )
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Vital>(
        "SELECT * FROM vitals WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC",
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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

pub async fn get_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Option<Consultation>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
    Ok(Json(row))
}

pub async fn create_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreateConsultationRequest>,
) -> Result<Json<Consultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Resolve patient_id from the encounter so inline lab/radiology
    // orders carry the right FK without a second client round-trip.
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
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

    // Inline lab orders — same transaction, atomic with consultation.
    for lab in &body.lab_orders {
        let priority = lab.priority.as_deref().unwrap_or("routine");
        sqlx::query(
            "INSERT INTO lab_orders \
             (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
              status, priority, notes) \
             VALUES ($1, $2, $3, $4, $5, 'ordered'::lab_order_status, \
                     $6::lab_priority, $7)",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .bind(patient_id)
        .bind(lab.test_id)
        .bind(claims.sub)
        .bind(priority)
        .bind(&lab.notes)
        .execute(&mut *tx)
        .await?;
    }

    // Inline radiology orders.
    for rad in &body.radiology_orders {
        let priority = rad.priority.as_deref().unwrap_or("routine");
        sqlx::query(
            "INSERT INTO radiology_orders \
             (tenant_id, encounter_id, patient_id, modality_id, ordered_by, \
              body_part, clinical_indication, priority, notes, \
              contrast_required, status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'requested')",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .bind(patient_id)
        .bind(rad.modality_id)
        .bind(claims.sub)
        .bind(&rad.body_part)
        .bind(&rad.clinical_indication)
        .bind(priority)
        .bind(&rad.notes)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    tracing::info!(
        encounter_id = %encounter_id,
        consultation_id = %row.id,
        labs = body.lab_orders.len(),
        radiology = body.radiology_orders.len(),
        "consultation: created with inline orders"
    );

    Ok(Json(row))
}

pub async fn update_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_encounter_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateConsultationRequest>,
) -> Result<Json<Consultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Diagnoses
// ══════════════════════════════════════════════════════════

pub async fn list_diagnoses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<Diagnosis>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Diagnosis>(
        "SELECT * FROM diagnoses WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY is_primary DESC, created_at",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_diagnosis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreateDiagnosisRequest>,
) -> Result<Json<Diagnosis>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let is_primary = body.is_primary.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let severity = body.severity.as_deref().unwrap_or("moderate");
    let certainty = body.certainty.as_deref().unwrap_or("confirmed");

    let row = sqlx::query_as::<_, Diagnosis>(
        "INSERT INTO diagnoses \
         (tenant_id, encounter_id, icd_code, description, is_primary, notes, \
          severity, certainty, onset_date, resolved_date, snomed_code, snomed_display) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(&body.icd_code)
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

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_diagnosis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_encounter_id, did)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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

pub async fn list_prescriptions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<PrescriptionWithItems>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let prescriptions = sqlx::query_as::<_, Prescription>(
        "SELECT * FROM prescriptions WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let prescription_ids: Vec<Uuid> = prescriptions.iter().map(|rx| rx.id).collect();
    let items = if prescription_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, PrescriptionItem>(
            "SELECT * FROM prescription_items \
             WHERE prescription_id = ANY($1) AND tenant_id = $2 \
             ORDER BY prescription_id, created_at",
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
        result.push(PrescriptionWithItems {
            prescription: rx,
            items,
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;
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
        "SELECT * FROM prescription_items WHERE prescription_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(rx.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PrescriptionWithItems {
        prescription: rx,
        items,
    }))
}

pub async fn create_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreatePrescriptionRequest>,
) -> Result<Json<PrescriptionWithItems>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one prescription item is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rx = sqlx::query_as::<_, Prescription>(
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, notes) \
         VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
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

        let _ = sqlx::query(
            "INSERT INTO pharmacy_prescriptions \
             (tenant_id, prescription_id, patient_id, encounter_id, doctor_id, source, status, priority) \
             VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', 'normal') \
             ON CONFLICT DO NOTHING",
        )
        .bind(claims.tenant_id)
        .bind(rx.id)
        .bind(pid)
        .bind(encounter_id)
        .bind(claims.sub)
        .bind(source)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let rx_patient_name = if let Some(pid) = patient_id {
        sqlx::query_scalar::<_, String>(
            "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1",
        )
        .bind(pid)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "Unknown".to_owned())
    } else {
        "Unknown".to_owned()
    };

    let rx_doctor_name = sqlx::query_scalar::<_, String>(
        "SELECT full_name FROM users WHERE id = $1",
    )
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
            "patient_name": rx_patient_name,
            "items_count": items.len(),
        }),
    )
    .await;

    Ok(Json(PrescriptionWithItems {
        prescription: rx,
        items,
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PrescriptionTemplate>(
        "SELECT * FROM prescription_templates \
         WHERE tenant_id = $1 AND (created_by = $2 OR is_shared = true) \
         ORDER BY name",
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
}

pub async fn list_patient_prescriptions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PrescriptionHistoryItem>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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

    let mut result = Vec::with_capacity(prescriptions.len());
    for rx in &prescriptions {
        let items = sqlx::query_as::<_, PrescriptionItem>(
            "SELECT * FROM prescription_items \
             WHERE prescription_id = $1 AND tenant_id = $2 ORDER BY created_at",
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

        result.push(PrescriptionHistoryItem {
            prescription: rx.clone(),
            items,
            encounter_date,
            doctor_name,
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
    pub description: String,
    pub is_primary: bool,
    pub severity: Option<String>,
    pub certainty: Option<String>,
    pub onset_date: Option<NaiveDate>,
    pub resolved_date: Option<NaiveDate>,
    pub encounter_date: NaiveDate,
    pub doctor_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn list_patient_diagnoses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientDiagnosisRow>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientDiagnosisRow>(
        "SELECT d.id, d.encounter_id, d.icd_code, d.description, d.is_primary, \
         d.severity, d.certainty, d.onset_date, d.resolved_date, \
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

pub async fn list_certificates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<MedicalCertificate>>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MedicalCertificate>(
        "SELECT * FROM medical_certificates \
         WHERE patient_id = $1 AND tenant_id = $2 AND is_void = false \
         ORDER BY created_at DESC",
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let issued = body.issued_date.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
         WHERE r.patient_id = $1 \
         ORDER BY r.created_at DESC",
    )
    .bind(patient_id)
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let urgency = body.urgency.as_deref().unwrap_or("routine");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProcedureCatalog>(
        "SELECT * FROM procedure_catalog WHERE is_active = true ORDER BY category, name",
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProcedureOrderWithName>(
        "SELECT po.id, po.patient_id, po.encounter_id, po.procedure_id, \
         pc.name AS procedure_name, pc.code AS procedure_code, \
         po.ordered_by, po.priority, po.status, po.scheduled_date, \
         po.notes, po.findings, po.created_at \
         FROM procedure_orders po \
         JOIN procedure_catalog pc ON pc.id = po.procedure_id \
         WHERE po.encounter_id = $1 \
         ORDER BY po.created_at DESC",
    )
    .bind(encounter_id)
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/opd/procedure-orders/{id}
pub async fn cancel_procedure_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE procedure_orders SET status = 'cancelled', \
         cancelled_at = now(), cancel_reason = 'Cancelled by doctor' \
         WHERE id = $1 AND status IN ('ordered', 'scheduled')",
    )
    .bind(order_id)
    .execute(&mut *tx)
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
             ORDER BY lo.created_at DESC",
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
             ORDER BY po.created_at DESC",
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
         ORDER BY category, name",
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let docket_date = q.date.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let docket_date = q.date.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorDocket>(
        "INSERT INTO doctor_dockets \
         (tenant_id, doctor_id, docket_date, total_patients, new_patients, follow_ups, \
          referrals_made, procedures_done) \
         SELECT $1, $2, $3, \
           COUNT(*), \
           COUNT(*) FILTER (WHERE e.notes IS NULL OR e.notes = ''), \
           COUNT(*) FILTER (WHERE e.notes IS NOT NULL AND e.notes <> ''), \
           (SELECT COUNT(*) FROM referrals r WHERE r.tenant_id = $1 AND r.from_doctor_id = $2 \
            AND r.created_at::date = $3), \
           (SELECT COUNT(*) FROM procedure_orders po WHERE po.tenant_id = $1 AND po.ordered_by = $2 \
            AND po.created_at::date = $3 AND po.status = 'completed') \
         FROM encounters e \
         WHERE e.tenant_id = $1 AND e.doctor_id = $2 AND e.created_at::date = $3 \
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientReminder>(
        "SELECT * FROM patient_reminders \
         WHERE tenant_id = $1 AND doctor_id = $2 \
           AND ($3::uuid IS NULL OR patient_id = $3) \
           AND ($4::text IS NULL OR status = $4) \
           AND ($5::date IS NULL OR reminder_date >= $5) \
           AND ($6::date IS NULL OR reminder_date <= $6) \
         ORDER BY reminder_date, priority DESC",
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let priority = body.priority.as_deref().unwrap_or("normal");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientFeedback>(
        "SELECT * FROM patient_feedback WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY submitted_at DESC",
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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

pub async fn list_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<ProcedureConsent>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProcedureConsent>(
        "SELECT * FROM procedure_consents WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY created_at DESC",
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let consent_type = body.consent_type.as_deref().unwrap_or("procedure");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

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

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsultationTemplate>(
        "SELECT * FROM consultation_templates \
         WHERE tenant_id = $1 AND is_active = true \
         AND (is_shared = true OR created_by = $2) \
         ORDER BY name",
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

    let mut appointments = Vec::with_capacity(body.slot_requests.len());

    for slot in &body.slot_requests {
        let start: chrono::NaiveTime = slot
            .slot_start
            .parse()
            .map_err(|_| AppError::BadRequest("Invalid slot_start time format".into()))?;
        let end: chrono::NaiveTime = slot
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
         ORDER BY slot_start",
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

    // Count waiting patients in queue
    let waiting: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM opd_queues \
         WHERE tenant_id = $1 AND status = 'waiting' \
           AND ($2::uuid IS NULL OR department_id = $2) \
           AND ($3::uuid IS NULL OR doctor_id = $3) \
           AND queue_date = CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .bind(q.department_id)
    .bind(q.doctor_id)
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
           AND q.queue_date >= CURRENT_DATE - INTERVAL '7 days'",
    )
    .bind(claims.tenant_id)
    .bind(q.department_id)
    .bind(q.doctor_id)
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

    let doctor_id = body.doctor_id.unwrap_or(claims.sub);
    let today = Utc::now().date_naive();

    // 2. Create IPD encounter
    let ipd_encounter = sqlx::query_as::<_, Encounter>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes) \
         VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6, '{}') \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(opd_encounter.patient_id)
    .bind(body.department_id)
    .bind(doctor_id)
    .bind(today)
    .bind(&body.notes)
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
             WHERE bed_id = $1 AND tenant_id = $2",
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
         (tenant_id, encounter_id, icd_code, description, is_primary, notes, \
          severity, certainty, onset_date, resolved_date, snomed_code, snomed_display) \
         SELECT tenant_id, $2, icd_code, description, is_primary, notes, \
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

    // Enrich payload with names for orchestration
    let admit_patient_name = sqlx::query_scalar::<_, String>(
        "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1",
    )
    .bind(opd_encounter.patient_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let admit_doctor_name = sqlx::query_scalar::<_, String>(
        "SELECT full_name FROM users WHERE id = $1",
    )
    .bind(doctor_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let admit_dept_name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM departments WHERE id = $1",
    )
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
            "patient_name": admit_patient_name,
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
         ORDER BY oi.drug_name",
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

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
    pub follow_up_date: NaiveDate,
    pub visit_date: NaiveDate,
    pub days_overdue: Option<i32>,
}

pub async fn followup_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FollowupComplianceRow>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FollowupComplianceRow>(
        "SELECT e.patient_id, (p.first_name || ' ' || p.last_name) AS patient_name, p.uhid, \
         e.id AS encounter_id, e.department_id, e.doctor_id, \
         a.appointment_date AS follow_up_date, e.encounter_date::date AS visit_date, \
         (CURRENT_DATE - a.appointment_date)::int AS days_overdue \
         FROM appointments a \
         JOIN encounters e ON e.id = a.encounter_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         WHERE a.tenant_id = $1 \
           AND a.appointment_type = 'follow_up' \
           AND a.status = 'no_show' \
           AND a.appointment_date < CURRENT_DATE \
         ORDER BY a.appointment_date ASC \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
