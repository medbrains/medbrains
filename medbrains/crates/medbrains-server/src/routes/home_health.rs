//! Home Healthcare / Hospital-at-Home — medication administration tracking (ticket #2979).
//! A home eMAR: a dose (IV antibiotics / infusions) is scheduled, then the visiting nurse records
//! it as administered / missed / held with the site + notes. Gated by `ipd.mar.{list,create}`.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HomeVisit>(&format!(
        "SELECT {VISIT_COLS} FROM home_visits hv \
         LEFT JOIN patients p ON p.id = hv.patient_id \
         LEFT JOIN employees e ON e.id = hv.nurse_id \
         WHERE hv.tenant_id = $1 AND ($2::date IS NULL OR hv.scheduled_date = $2) \
           AND ($3::uuid IS NULL OR hv.nurse_id = $3) \
         ORDER BY hv.scheduled_date, hv.visit_order NULLS LAST, hv.scheduled_time LIMIT 1000"
    ))
    .bind(claims.tenant_id)
    .bind(q.date)
    .bind(q.nurse_id)
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
