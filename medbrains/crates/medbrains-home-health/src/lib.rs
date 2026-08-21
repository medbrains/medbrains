//! Home Healthcare / Hospital-at-Home — medication administration tracking (ticket #2979).
//! A home eMAR: a dose (IV antibiotics / infusions) is scheduled, then the visiting nurse records
//! it as administered / missed / held with the site + notes. Gated by `ipd.mar.{list,create}`.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{get,post,put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const COLS: &str = "id, tenant_id, patient_id, drug_name, dose, route, is_infusion, \
     infusion_rate, scheduled_at, administered_at, administered_by, administration_site, \
     status, notes, created_at, updated_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeMedAdministration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub drug_name: String,
    pub dose: String,
    pub route: Option<String>,
    pub is_infusion: bool,
    pub infusion_rate: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub administered_at: Option<DateTime<Utc>>,
    pub administered_by: Option<Uuid>,
    pub administration_site: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct HomeMedQuery {
    pub patient_id: Uuid,
}

/// `GET /api/home-health/medications?patient_id=` — a patient's home medication schedule.
pub async fn list_home_meds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<HomeMedAdministration>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeMedAdministration>(&format!(
        "SELECT {COLS} FROM home_med_administrations \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY scheduled_at DESC LIMIT 1000"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ScheduleHomeMedRequest {
    pub patient_id: Uuid,
    pub drug_name: String,
    pub dose: String,
    pub route: Option<String>,
    pub is_infusion: Option<bool>,
    pub infusion_rate: Option<String>,
    pub scheduled_at: DateTime<Utc>,
}

/// `POST /api/home-health/medications` — schedule a home dose.
pub async fn schedule_home_med(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScheduleHomeMedRequest>,
) -> Result<Json<HomeMedAdministration>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if body.drug_name.trim().is_empty() || body.dose.trim().is_empty() {
        return Err(AppError::BadRequest("Drug name and dose are required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeMedAdministration>(&format!(
        "INSERT INTO home_med_administrations \
         (tenant_id, patient_id, drug_name, dose, route, is_infusion, infusion_rate, scheduled_at) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), $7, $8) RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.drug_name.trim())
    .bind(body.dose.trim())
    .bind(&body.route)
    .bind(body.is_infusion)
    .bind(&body.infusion_rate)
    .bind(body.scheduled_at)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct RecordHomeMedRequest {
    /// administered | missed | held (defaults to administered).
    pub status: Option<String>,
    pub administration_site: Option<String>,
    pub notes: Option<String>,
}

/// `PUT /api/home-health/medications/{id}` — the visiting nurse records the dose outcome.
pub async fn record_home_med(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RecordHomeMedRequest>,
) -> Result<Json<HomeMedAdministration>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOME_MED_ADMINISTRATION,
        id,
    )
    .await?;
    let status = body.status.as_deref().unwrap_or("administered");
    if !["administered", "missed", "held"].contains(&status) {
        return Err(AppError::BadRequest("Invalid administration status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeMedAdministration>(&format!(
        "UPDATE home_med_administrations SET status = $3, \
            administered_at = CASE WHEN $3 = 'administered' THEN now() ELSE administered_at END, \
            administered_by = CASE WHEN $3 = 'administered' THEN $4 ELSE administered_by END, \
            administration_site = COALESCE($5, administration_site), \
            notes = COALESCE($6, notes), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(status)
    .bind(claims.sub)
    .bind(&body.administration_site)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Emergency escalation protocol (#2980) ──────────────────────────────────

const ESC_COLS: &str = "id, tenant_id, patient_id, reason, vital_details, severity, status, \
     raised_by, resolved_by, resolved_at, notes, created_at, updated_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeEscalation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub reason: String,
    pub vital_details: serde_json::Value,
    pub severity: String,
    pub status: String,
    pub raised_by: Option<Uuid>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `GET /api/home-health/escalations?patient_id=` — a patient's escalation history.
pub async fn list_escalations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<HomeEscalation>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeEscalation>(&format!(
        "SELECT {ESC_COLS} FROM home_escalations \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RaiseEscalationRequest {
    pub patient_id: Uuid,
    pub reason: String,
    pub severity: Option<String>,
    pub vital_details: Option<serde_json::Value>,
}

/// `POST /api/home-health/escalations` — raise an escalation (vitals breach / nurse judgement).
pub async fn raise_escalation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RaiseEscalationRequest>,
) -> Result<Json<HomeEscalation>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("A reason is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeEscalation>(&format!(
        "INSERT INTO home_escalations \
         (tenant_id, patient_id, reason, vital_details, severity, raised_by) \
         VALUES ($1, $2, $3, COALESCE($4, '{{}}'::jsonb), COALESCE($5, 'high'), $6) \
         RETURNING {ESC_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.reason.trim())
    .bind(&body.vital_details)
    .bind(&body.severity)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateEscalationRequest {
    /// ambulance_requested | resolved | cancelled.
    pub status: String,
    pub notes: Option<String>,
}

/// `PUT /api/home-health/escalations/{id}` — advance an escalation (request ambulance / resolve).
pub async fn update_escalation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEscalationRequest>,
) -> Result<Json<HomeEscalation>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOME_ESCALATION,
        id,
    )
    .await?;
    if !["ambulance_requested", "resolved", "cancelled"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Invalid escalation status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeEscalation>(&format!(
        "UPDATE home_escalations SET status = $3, notes = COALESCE($4, notes), \
            resolved_by = CASE WHEN $3 IN ('resolved', 'cancelled') THEN $5 ELSE resolved_by END, \
            resolved_at = CASE WHEN $3 IN ('resolved', 'cancelled') THEN now() ELSE resolved_at END, \
            updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {ESC_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Daily clinical progress notes (#2981) ──────────────────────────────────

const NOTE_COLS: &str = "id, tenant_id, patient_id, note_date, author_id, author_role, \
     note_text, vitals, created_at, updated_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeProgressNote {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub note_date: chrono::NaiveDate,
    pub author_id: Option<Uuid>,
    pub author_role: String,
    pub note_text: String,
    pub vitals: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `GET /api/home-health/progress-notes?patient_id=` — a patient's home progress notes.
pub async fn list_progress_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<HomeProgressNote>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeProgressNote>(&format!(
        "SELECT {NOTE_COLS} FROM home_progress_notes \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY note_date DESC, created_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AddProgressNoteRequest {
    pub patient_id: Uuid,
    pub author_role: Option<String>,
    pub note_text: String,
    pub vitals: Option<serde_json::Value>,
}

/// `POST /api/home-health/progress-notes` — the visiting nurse / remote physician writes a note.
pub async fn add_progress_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddProgressNoteRequest>,
) -> Result<Json<HomeProgressNote>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if body.note_text.trim().is_empty() {
        return Err(AppError::BadRequest("Note text is required".to_owned()));
    }
    let role = body.author_role.as_deref().unwrap_or("nurse");
    if !["nurse", "physician"].contains(&role) {
        return Err(AppError::BadRequest("Invalid author role".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeProgressNote>(&format!(
        "INSERT INTO home_progress_notes \
         (tenant_id, patient_id, author_id, author_role, note_text, vitals) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, '{{}}'::jsonb)) RETURNING {NOTE_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(role)
    .bind(body.note_text.trim())
    .bind(&body.vitals)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Training materials + discharge criteria (#2982) ────────────────────────

const DP_COLS: &str = "id, tenant_id, patient_id, item_type, title, description, is_complete, \
     completed_at, completed_by, notes, created_at, updated_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeDischargeItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub item_type: String,
    pub title: String,
    pub description: Option<String>,
    pub is_complete: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub completed_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `GET /api/home-health/discharge-program?patient_id=` — training materials + discharge criteria.
pub async fn list_discharge_program(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<HomeDischargeItem>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeDischargeItem>(&format!(
        "SELECT {DP_COLS} FROM home_discharge_program \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY item_type, created_at LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AddDischargeItemRequest {
    pub patient_id: Uuid,
    pub item_type: String,
    pub title: String,
    pub description: Option<String>,
}

/// `POST /api/home-health/discharge-program` — add a training material or discharge criterion.
pub async fn add_discharge_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddDischargeItemRequest>,
) -> Result<Json<HomeDischargeItem>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if !["training", "criterion"].contains(&body.item_type.as_str()) {
        return Err(AppError::BadRequest("Invalid item type".to_owned()));
    }
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("A title is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeDischargeItem>(&format!(
        "INSERT INTO home_discharge_program (tenant_id, patient_id, item_type, title, description) \
         VALUES ($1, $2, $3, $4, $5) RETURNING {DP_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.item_type)
    .bind(body.title.trim())
    .bind(&body.description)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ToggleDischargeItemRequest {
    pub is_complete: bool,
}

/// `PUT /api/home-health/discharge-program/{id}` — mark an item provided / criterion met (or not).
pub async fn toggle_discharge_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ToggleDischargeItemRequest>,
) -> Result<Json<HomeDischargeItem>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOME_DISCHARGE_ITEM,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeDischargeItem>(&format!(
        "UPDATE home_discharge_program SET is_complete = $3, \
            completed_at = CASE WHEN $3 THEN now() ELSE NULL END, \
            completed_by = CASE WHEN $3 THEN $4 ELSE NULL END, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {DP_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.is_complete)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Home visit scheduling + nurse assignment (#2967) ───────────────────────

const VISIT_COLS: &str = "hv.id, hv.patient_id, p.first_name, p.last_name, hv.nurse_id, \
     NULLIF(TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))), '') AS nurse_name, \
     hv.scheduled_date, hv.scheduled_time, hv.address, hv.purpose, \
     hv.status, hv.visit_order, hv.notes, hv.vitals, hv.wound_photo_url, \
     hv.medication_compliance, hv.documented_at, hv.completed_at, hv.created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeVisit {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub nurse_id: Option<Uuid>,
    pub nurse_name: Option<String>,
    pub scheduled_date: chrono::NaiveDate,
    pub scheduled_time: Option<chrono::NaiveTime>,
    pub address: Option<String>,
    pub purpose: Option<String>,
    pub status: String,
    pub visit_order: Option<i32>,
    pub notes: Option<String>,
    pub vitals: serde_json::Value,
    pub wound_photo_url: Option<String>,
    pub medication_compliance: Option<String>,
    pub documented_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct HomeVisitQuery {
    pub patient_id: Option<Uuid>,
    pub date: Option<chrono::NaiveDate>,
    pub nurse_id: Option<Uuid>,
}

/// `GET /api/home-health/visits?date=&nurse_id=` — the home-visit round for a day (optionally by nurse).
pub async fn list_home_visits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeVisitQuery>,
) -> Result<Json<Vec<HomeVisit>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;
    // Unscoped this listed every home visit in the tenant — who is being
    // visited at home, and when somebody is alone in their house. Dual-mode
    // via ?patient_id.
    let permitted_patients =
        medbrains_authz_gate::patient_filter(&state, &claims, q.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeVisit>(&format!(
        "SELECT {VISIT_COLS} FROM home_visits hv \
         LEFT JOIN patients p ON p.id = hv.patient_id \
         LEFT JOIN employees e ON e.id = hv.nurse_id \
         WHERE hv.tenant_id = $1 AND ($2::date IS NULL OR hv.scheduled_date = $2) \
           AND ($3::uuid IS NULL OR hv.nurse_id = $3) \
           AND ($4::uuid[] IS NULL OR hv.patient_id = ANY($4)) \
         ORDER BY hv.scheduled_date, hv.visit_order NULLS LAST, hv.scheduled_time LIMIT 1000"
    ))
    .bind(claims.tenant_id)
    .bind(q.date)
    .bind(q.nurse_id)
    .bind(permitted_patients.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ScheduleHomeVisitRequest {
    pub patient_id: Uuid,
    pub nurse_id: Option<Uuid>,
    pub scheduled_date: chrono::NaiveDate,
    pub scheduled_time: Option<chrono::NaiveTime>,
    pub address: Option<String>,
    pub purpose: Option<String>,
    pub visit_order: Option<i32>,
}

/// `POST /api/home-health/visits` — schedule a home visit + assign a nurse.
pub async fn schedule_home_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScheduleHomeVisitRequest>,
) -> Result<Json<HomeVisit>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let new_id: Uuid = sqlx::query_scalar(
        "INSERT INTO home_visits \
         (tenant_id, patient_id, nurse_id, scheduled_date, scheduled_time, address, purpose, visit_order) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.nurse_id)
    .bind(body.scheduled_date)
    .bind(body.scheduled_time)
    .bind(&body.address)
    .bind(&body.purpose)
    .bind(body.visit_order)
    .fetch_one(&mut *tx)
    .await?;
    let row = sqlx::query_as::<_, HomeVisit>(&format!(
        "SELECT {VISIT_COLS} FROM home_visits hv \
         LEFT JOIN patients p ON p.id = hv.patient_id \
         LEFT JOIN employees e ON e.id = hv.nurse_id WHERE hv.id = $1"
    ))
    .bind(new_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateHomeVisitRequest {
    pub status: Option<String>,
    pub nurse_id: Option<Uuid>,
    pub visit_order: Option<i32>,
}

/// `PUT /api/home-visits/{id}` — reassign nurse / reorder the round / advance status.
pub async fn update_home_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateHomeVisitRequest>,
) -> Result<Json<HomeVisit>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOME_VISIT,
        id,
    )
    .await?;
    if let Some(s) = &body.status {
        if !["scheduled", "en_route", "completed", "cancelled", "missed"].contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid visit status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeVisit>(&format!(
        "WITH upd AS ( \
           UPDATE home_visits SET status = COALESCE($3, status), \
             nurse_id = COALESCE($4, nurse_id), visit_order = COALESCE($5, visit_order), \
             completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END, \
             updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id) \
         SELECT {VISIT_COLS} FROM home_visits hv \
         LEFT JOIN patients p ON p.id = hv.patient_id \
         LEFT JOIN employees e ON e.id = hv.nurse_id WHERE hv.id = (SELECT id FROM upd)"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(body.nurse_id)
    .bind(body.visit_order)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct DocumentVisitRequest {
    pub vitals: Option<serde_json::Value>,
    pub wound_photo_url: Option<String>,
    pub medication_compliance: Option<String>,
}

/// `PUT /api/home-visits/{id}/document` — the nurse records the visit findings (#2968).
pub async fn document_home_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DocumentVisitRequest>,
) -> Result<Json<HomeVisit>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOME_VISIT,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeVisit>(&format!(
        "WITH upd AS ( \
           UPDATE home_visits SET vitals = COALESCE($3, vitals), \
             wound_photo_url = COALESCE($4, wound_photo_url), \
             medication_compliance = COALESCE($5, medication_compliance), \
             documented_at = now(), documented_by = $6, updated_at = now() \
           WHERE id = $1 AND tenant_id = $2 RETURNING id) \
         SELECT {VISIT_COLS} FROM home_visits hv \
         LEFT JOIN patients p ON p.id = hv.patient_id \
         LEFT JOIN employees e ON e.id = hv.nurse_id WHERE hv.id = (SELECT id FROM upd)"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.vitals)
    .bind(&body.wound_photo_url)
    .bind(&body.medication_compliance)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Remote vital monitoring (#2969) ────────────────────────────────────────

const RV_COLS: &str = "id, patient_id, device_type, reading, is_flagged, measured_at, source, \
     created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RemoteVitalReading {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub device_type: String,
    pub reading: serde_json::Value,
    pub is_flagged: bool,
    pub measured_at: DateTime<Utc>,
    pub source: String,
    pub created_at: DateTime<Utc>,
}

/// A remote reading is flagged when it breaches a safe range for its device type.
fn reading_is_abnormal(device_type: &str, reading: &serde_json::Value) -> bool {
    let num = |k: &str| reading.get(k).and_then(serde_json::Value::as_f64);
    match device_type {
        "pulse_ox" => num("spo2").is_some_and(|v| v < 92.0),
        "glucometer" => num("glucose").is_some_and(|v| !(70.0..=250.0).contains(&v)),
        "bp" => {
            num("systolic").is_some_and(|v| !(90.0..=180.0).contains(&v))
                || num("diastolic").is_some_and(|v| v > 120.0)
        }
        "thermometer" => num("temp").is_some_and(|v| !(35.0..38.0).contains(&v)),
        _ => false,
    }
}

/// `GET /api/home-health/remote-vitals?patient_id=` — a patient's remote device readings.
pub async fn list_remote_vitals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<RemoteVitalReading>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, RemoteVitalReading>(&format!(
        "SELECT {RV_COLS} FROM remote_vital_readings \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY measured_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct IngestVitalRequest {
    pub patient_id: Uuid,
    pub device_type: String,
    pub reading: serde_json::Value,
    pub measured_at: Option<DateTime<Utc>>,
    pub source: Option<String>,
}

/// `POST /api/home-health/remote-vitals` — ingest a device reading; auto-flags abnormal values.
pub async fn ingest_remote_vital(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IngestVitalRequest>,
) -> Result<Json<RemoteVitalReading>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if !["bp", "glucometer", "pulse_ox", "thermometer", "weight"].contains(&body.device_type.as_str())
    {
        return Err(AppError::BadRequest("Invalid device type".to_owned()));
    }
    let flagged = reading_is_abnormal(&body.device_type, &body.reading);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, RemoteVitalReading>(&format!(
        "INSERT INTO remote_vital_readings \
         (tenant_id, patient_id, device_type, reading, is_flagged, measured_at, source, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), COALESCE($7, 'device'), $8) \
         RETURNING {RV_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.device_type)
    .bind(&body.reading)
    .bind(flagged)
    .bind(body.measured_at)
    .bind(&body.source)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Home care billing — packages + per-visit (#2970) ───────────────────────

const PKG_COLS: &str = "id, patient_id, name, total_visits, used_visits, price, status, \
     invoice_id, purchased_at, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeCarePackage {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub name: String,
    pub total_visits: i32,
    pub used_visits: i32,
    pub price: Decimal,
    pub status: String,
    pub invoice_id: Option<Uuid>,
    pub purchased_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/home-health/packages?patient_id=` — a patient's home-care packages.
pub async fn list_home_care_packages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<HomeCarePackage>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeCarePackage>(&format!(
        "SELECT {PKG_COLS} FROM home_care_packages \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY purchased_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateHomeCarePackageRequest {
    pub patient_id: Uuid,
    pub name: String,
    pub total_visits: i32,
    pub price: Decimal,
}

/// `POST /api/home-health/packages` — sell a package; auto-charges the price to the patient.
pub async fn create_home_care_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHomeCarePackageRequest>,
) -> Result<Json<HomeCarePackage>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if body.name.trim().is_empty() || body.total_visits <= 0 {
        return Err(AppError::BadRequest(
            "Package name and a positive visit count are required".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let pkg_id: Uuid = sqlx::query_scalar(
        "INSERT INTO home_care_packages (tenant_id, patient_id, name, total_visits, price) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.name.trim())
    .bind(body.total_visits)
    .bind(body.price)
    .fetch_one(&mut *tx)
    .await?;

    let charge = medbrains_server_services::billing::auto_charge(
        &mut tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id: body.patient_id,
            encounter_id: None,
            charge_code: "HOME_CARE_PKG".to_owned(),
            source: "procedure".to_owned(),
            source_id: pkg_id,
            quantity: 1,
            description_override: Some(body.name.trim().to_owned()),
            unit_price_override: Some(body.price),
            tax_percent_override: None,
        },
    )
    .await?;

    let row = sqlx::query_as::<_, HomeCarePackage>(&format!(
        "UPDATE home_care_packages SET invoice_id = $2 WHERE id = $1 RETURNING {PKG_COLS}"
    ))
    .bind(pkg_id)
    .bind(charge.invoice_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/home-health/packages/{id}/consume` — deduct one visit from a package.
pub async fn consume_package_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<HomeCarePackage>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HomeCarePackage>(&format!(
        "UPDATE home_care_packages \
         SET used_visits = used_visits + 1, \
             status = CASE WHEN used_visits + 1 >= total_visits THEN 'completed' ELSE status END, \
             updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND used_visits < total_visits \
         RETURNING {PKG_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Package is exhausted or not active".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/home-visits/{id}/bill` — visit-based billing: auto-charge a home-care visit.
pub async fn bill_home_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOME_VISIT,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient_id: Uuid =
        sqlx::query_scalar("SELECT patient_id FROM home_visits WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let charge = medbrains_server_services::billing::auto_charge(
        &mut tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id,
            encounter_id: None,
            charge_code: "HOME_VISIT".to_owned(),
            source: "procedure".to_owned(),
            source_id: id,
            quantity: 1,
            description_override: Some("Home care visit".to_owned()),
            unit_price_override: None,
            tax_percent_override: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "invoice_id": charge.invoice_id })))
}

// ── Caregiver education documentation (#2971) ──────────────────────────────

const CE_COLS: &str = "id, patient_id, caregiver_name, relationship, topic, materials_provided, \
     understanding_confirmed, session_date, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CaregiverEducation {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub caregiver_name: String,
    pub relationship: Option<String>,
    pub topic: String,
    pub materials_provided: Option<String>,
    pub understanding_confirmed: bool,
    pub session_date: chrono::NaiveDate,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/home-health/caregiver-education?patient_id=` — a patient's caregiver teaching log.
pub async fn list_caregiver_education(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<CaregiverEducation>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, CaregiverEducation>(&format!(
        "SELECT {CE_COLS} FROM caregiver_education \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY session_date DESC, created_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RecordEducationRequest {
    pub patient_id: Uuid,
    pub caregiver_name: String,
    pub relationship: Option<String>,
    pub topic: String,
    pub materials_provided: Option<String>,
    pub understanding_confirmed: Option<bool>,
    pub notes: Option<String>,
}

/// `POST /api/home-health/caregiver-education` — record a caregiver teaching session.
pub async fn record_caregiver_education(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RecordEducationRequest>,
) -> Result<Json<CaregiverEducation>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if body.caregiver_name.trim().is_empty() || body.topic.trim().is_empty() {
        return Err(AppError::BadRequest("Caregiver name and topic are required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, CaregiverEducation>(&format!(
        "INSERT INTO caregiver_education \
         (tenant_id, patient_id, caregiver_name, relationship, topic, materials_provided, \
          understanding_confirmed, educated_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false), $8, $9) RETURNING {CE_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.caregiver_name.trim())
    .bind(&body.relationship)
    .bind(body.topic.trim())
    .bind(&body.materials_provided)
    .bind(body.understanding_confirmed)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Hospice enrollment (#2972) ─────────────────────────────────────────────

const HOSPICE_COLS: &str = "id, patient_id, enrolled_date, terminal_diagnosis, prognosis, \
     comfort_care_plan, dnr_confirmed, primary_caregiver, status, discharge_date, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HospiceEnrollment {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub enrolled_date: chrono::NaiveDate,
    pub terminal_diagnosis: Option<String>,
    pub prognosis: Option<String>,
    pub comfort_care_plan: Option<String>,
    pub dnr_confirmed: bool,
    pub primary_caregiver: Option<String>,
    pub status: String,
    pub discharge_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/home-health/hospice?patient_id=` — a patient's hospice enrollments.
pub async fn list_hospice_enrollments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<HospiceEnrollment>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HospiceEnrollment>(&format!(
        "SELECT {HOSPICE_COLS} FROM hospice_enrollments \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY enrolled_date DESC LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct EnrollHospiceRequest {
    pub patient_id: Uuid,
    pub terminal_diagnosis: Option<String>,
    pub prognosis: Option<String>,
    pub comfort_care_plan: Option<String>,
    pub dnr_confirmed: Option<bool>,
    pub primary_caregiver: Option<String>,
    pub notes: Option<String>,
}

/// `POST /api/home-health/hospice` — enroll a patient in the hospice program.
pub async fn enroll_hospice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<EnrollHospiceRequest>,
) -> Result<Json<HospiceEnrollment>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // A DNR may only be confirmed against an active, documented DNR order — not a bare flag.
    if body.dnr_confirmed == Some(true) {
        let has_dnr = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM dnr_orders \
             WHERE tenant_id = $1 AND patient_id = $2 AND revoked_at IS NULL)",
        )
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .fetch_one(&mut *tx)
        .await?;
        if !has_dnr {
            return Err(AppError::BadRequest(
                "Cannot confirm DNR — no active DNR order is on file for this patient. Record the \
                 DNR order first."
                    .to_owned(),
            ));
        }
    }

    let row = sqlx::query_as::<_, HospiceEnrollment>(&format!(
        "INSERT INTO hospice_enrollments \
         (tenant_id, patient_id, terminal_diagnosis, prognosis, comfort_care_plan, dnr_confirmed, \
          primary_caregiver, enrolled_by, notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), $7, $8, $9) RETURNING {HOSPICE_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.terminal_diagnosis)
    .bind(&body.prognosis)
    .bind(&body.comfort_care_plan)
    .bind(body.dnr_confirmed)
    .bind(&body.primary_caregiver)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateHospiceRequest {
    pub status: Option<String>,
    pub comfort_care_plan: Option<String>,
    pub prognosis: Option<String>,
    pub notes: Option<String>,
}

/// `PUT /api/hospice/{id}` — update the care plan / prognosis or close the enrollment.
pub async fn update_hospice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateHospiceRequest>,
) -> Result<Json<HospiceEnrollment>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::HOSPICE_ENROLLMENT,
        id,
    )
    .await?;
    if let Some(s) = &body.status {
        if !["active", "discharged", "deceased"].contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid hospice status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HospiceEnrollment>(&format!(
        "UPDATE hospice_enrollments SET status = COALESCE($3, status), \
            comfort_care_plan = COALESCE($4, comfort_care_plan), \
            prognosis = COALESCE($5, prognosis), notes = COALESCE($6, notes), \
            discharge_date = CASE WHEN $3 IN ('discharged', 'deceased') THEN CURRENT_DATE \
                                  ELSE discharge_date END, \
            updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {HOSPICE_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.comfort_care_plan)
    .bind(&body.prognosis)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Advance directive / DNR management (#2973) ─────────────────────────────

const AD_COLS: &str = "id, patient_id, directive_type, content, effective_date, status, \
     family_consent_obtained, family_member_name, family_relationship, witnessed_by, \
     document_url, revoked_at, revoke_reason, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AdvanceDirective {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub directive_type: String,
    pub content: Option<String>,
    pub effective_date: chrono::NaiveDate,
    pub status: String,
    pub family_consent_obtained: bool,
    pub family_member_name: Option<String>,
    pub family_relationship: Option<String>,
    pub witnessed_by: Option<String>,
    pub document_url: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoke_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/home-health/advance-directives?patient_id=` — a patient's advance directives.
pub async fn list_advance_directives(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<AdvanceDirective>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, AdvanceDirective>(&format!(
        "SELECT {AD_COLS} FROM advance_directives \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateDirectiveRequest {
    pub patient_id: Uuid,
    pub directive_type: String,
    pub content: Option<String>,
    pub family_consent_obtained: Option<bool>,
    pub family_member_name: Option<String>,
    pub family_relationship: Option<String>,
    pub witnessed_by: Option<String>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
}

/// `POST /api/home-health/advance-directives` — record an advance directive.
pub async fn create_advance_directive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDirectiveRequest>,
) -> Result<Json<AdvanceDirective>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if !["living_will", "dnr", "dpoa", "molst", "organ_donation"]
        .contains(&body.directive_type.as_str())
    {
        return Err(AppError::BadRequest("Invalid directive type".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AdvanceDirective>(&format!(
        "INSERT INTO advance_directives \
         (tenant_id, patient_id, directive_type, content, family_consent_obtained, \
          family_member_name, family_relationship, witnessed_by, document_url, recorded_by, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), $6, $7, $8, $9, $10, $11) RETURNING {AD_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.directive_type)
    .bind(&body.content)
    .bind(body.family_consent_obtained)
    .bind(&body.family_member_name)
    .bind(&body.family_relationship)
    .bind(&body.witnessed_by)
    .bind(&body.document_url)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct RevokeDirectiveRequest {
    pub reason: String,
}

/// `POST /api/advance-directives/{id}/revoke` — revoke a directive with a reason.
pub async fn revoke_advance_directive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeDirectiveRequest>,
) -> Result<Json<AdvanceDirective>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::ADVANCE_DIRECTIVE,
        id,
    )
    .await?;
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("A revoke reason is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AdvanceDirective>(&format!(
        "UPDATE advance_directives SET status = 'revoked', revoked_at = now(), \
            revoke_reason = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active' RETURNING {AD_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.reason.trim())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Directive not found or not active".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Bereavement support coordination (#2974) ───────────────────────────────

const BER_COLS: &str = "id, patient_id, family_contact_name, relationship, contact_type, \
     scheduled_date, status, completed_at, notes, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BereavementFollowup {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub family_contact_name: String,
    pub relationship: Option<String>,
    pub contact_type: String,
    pub scheduled_date: chrono::NaiveDate,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/home-health/bereavement?patient_id=` — the bereavement follow-up plan for a family.
pub async fn list_bereavement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<HomeMedQuery>,
) -> Result<Json<Vec<BereavementFollowup>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The patient id arrives on the query string rather than the path, which is
    // why the route map read as "no path parameter". It is still a per-patient
    // read, so it needs a per-patient check — not list filtering.
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, BereavementFollowup>(&format!(
        "SELECT {BER_COLS} FROM bereavement_followups \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY scheduled_date LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ScheduleBereavementRequest {
    pub patient_id: Uuid,
    pub family_contact_name: String,
    pub relationship: Option<String>,
    pub contact_type: Option<String>,
    pub scheduled_date: chrono::NaiveDate,
    pub notes: Option<String>,
}

/// `POST /api/home-health/bereavement` — schedule a bereavement follow-up contact.
pub async fn schedule_bereavement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScheduleBereavementRequest>,
) -> Result<Json<BereavementFollowup>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    // No route-derived id: the caller names the patient. Weaker than a path
    // id, but it refuses a record filed against somebody out of reach.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    if body.family_contact_name.trim().is_empty() {
        return Err(AppError::BadRequest("Family contact name is required".to_owned()));
    }
    let ctype = body.contact_type.as_deref().unwrap_or("call");
    if !["call", "visit", "support_group", "letter", "other"].contains(&ctype) {
        return Err(AppError::BadRequest("Invalid contact type".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, BereavementFollowup>(&format!(
        "INSERT INTO bereavement_followups \
         (tenant_id, patient_id, family_contact_name, relationship, contact_type, scheduled_date, \
          coordinator, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING {BER_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.family_contact_name.trim())
    .bind(&body.relationship)
    .bind(ctype)
    .bind(body.scheduled_date)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateBereavementRequest {
    pub status: String,
    pub notes: Option<String>,
}

/// `PUT /api/bereavement/{id}` — mark a follow-up completed / declined.
pub async fn update_bereavement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBereavementRequest>,
) -> Result<Json<BereavementFollowup>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;
    if !["scheduled", "completed", "declined"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Invalid status".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, BereavementFollowup>(&format!(
        "UPDATE bereavement_followups SET status = $3, notes = COALESCE($4, notes), \
            completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END, \
            updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING {BER_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Home health care routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/home-health/medications",
            get(list_home_meds).post(schedule_home_med),
        )
        .route(
            "/api/home-health/medications/{id}",
            put(record_home_med),
        )
        .route(
            "/api/home-health/escalations",
            get(list_escalations).post(raise_escalation),
        )
        .route(
            "/api/home-health/escalations/{id}",
            put(update_escalation),
        )
        .route(
            "/api/home-health/progress-notes",
            get(list_progress_notes).post(add_progress_note),
        )
        .route(
            "/api/home-health/discharge-program",
            get(list_discharge_program).post(add_discharge_item),
        )
        .route(
            "/api/home-health/discharge-program/{id}",
            put(toggle_discharge_item),
        )
        .route(
            "/api/home-health/visits",
            get(list_home_visits).post(schedule_home_visit),
        )
        .route(
            "/api/home-visits/{id}",
            put(update_home_visit),
        )
        .route(
            "/api/home-visits/{id}/document",
            put(document_home_visit),
        )
        .route(
            "/api/home-health/remote-vitals",
            get(list_remote_vitals).post(ingest_remote_vital),
        )
        .route(
            "/api/home-health/packages",
            get(list_home_care_packages).post(create_home_care_package),
        )
        .route(
            "/api/home-health/packages/{id}/consume",
            post(consume_package_visit),
        )
        .route(
            "/api/home-visits/{id}/bill",
            post(bill_home_visit),
        )
        .route(
            "/api/home-health/caregiver-education",
            get(list_caregiver_education)
                .post(record_caregiver_education),
        )
        .route(
            "/api/home-health/hospice",
            get(list_hospice_enrollments).post(enroll_hospice),
        )
        .route("/api/hospice/{id}", put(update_hospice))
        .route(
            "/api/home-health/advance-directives",
            get(list_advance_directives)
                .post(create_advance_directive),
        )
        .route(
            "/api/advance-directives/{id}/revoke",
            post(revoke_advance_directive),
        )
        .route(
            "/api/home-health/bereavement",
            get(list_bereavement).post(schedule_bereavement),
        )
        .route("/api/bereavement/{id}", put(update_bereavement))
}
