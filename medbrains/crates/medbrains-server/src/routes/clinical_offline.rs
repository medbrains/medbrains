//! REST adapters for the four CRDT-backed offline domains:
//!   - shift handoff entries  (T2 append-only)
//!   - ED triage entries      (T2 append-only)
//!   - patient clinical notes (T3 free-form text)
//!   - nursing shift notes    (T3 free-form text, shift-keyed)
//!
//! When a tenant has `tenant_settings.clinical.offline_mode = false`
//! the frontend hooks (useHandoffSource etc.) hit these endpoints
//! directly. When offline_mode flips on, writes go through the edge
//! node and reach these tables via the outbox reconciliation path.
//!
//! Schema: migrations/0056_clinical_offline_logs.sql.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

// ── Shared helpers ──────────────────────────────────────────────────

async fn author_display_name(
    pool: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<String, AppError> {
    let row: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT email, display_name FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?;
    let (email, display) = row.ok_or(AppError::NotFound)?;
    Ok(display.unwrap_or(email))
}

// ── Nurse shift handoff entries ─────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HandoffEntry {
    pub id: Uuid,
    pub shift_id: String,
    pub author_user_id: Uuid,
    pub author_name: String,
    pub category: String,
    pub note: String,
    pub authored_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHandoffEntry {
    pub category: String,
    pub note: String,
    pub department_id: Option<Uuid>,
}

pub async fn list_handoff_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(shift_id): Path<String>,
) -> Result<Json<Vec<HandoffEntry>>, AppError> {
    require_permission(&claims, permissions::nurse::handoff_entries::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let rows = sqlx::query_as::<_, HandoffEntry>(
        "SELECT id, shift_id, author_user_id, author_name, category, note, authored_at \
         FROM nurse_shift_handoff_entries \
         WHERE shift_id = $1 \
         ORDER BY authored_at DESC \
         LIMIT 500",
    )
    .bind(&shift_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_handoff_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(shift_id): Path<String>,
    Json(body): Json<CreateHandoffEntry>,
) -> Result<Json<HandoffEntry>, AppError> {
    require_permission(&claims, permissions::nurse::handoff_entries::RECORD)?;
    if !matches!(body.category.as_str(), "alert" | "info" | "task") {
        return Err(AppError::BadRequest(format!(
            "category must be alert | info | task, got {}",
            body.category
        )));
    }
    if body.note.trim().is_empty() {
        return Err(AppError::BadRequest("note must not be empty".into()));
    }

    let author = author_display_name(&state.db, claims.sub).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let row = sqlx::query_as::<_, HandoffEntry>(
        "INSERT INTO nurse_shift_handoff_entries \
            (tenant_id, department_id, shift_id, author_user_id, author_name, category, note) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, shift_id, author_user_id, author_name, category, note, authored_at",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(&shift_id)
    .bind(claims.sub)
    .bind(&author)
    .bind(&body.category)
    .bind(body.note.trim())
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── ED triage entries ───────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TriageEntry {
    pub id: Uuid,
    pub er_visit_id: Uuid,
    pub author_user_id: Uuid,
    pub author_name: String,
    pub esi_level: i16,
    pub chief_complaint: String,
    pub observation: String,
    pub authored_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTriageEntry {
    pub esi_level: i16,
    pub chief_complaint: String,
    pub observation: Option<String>,
}

pub async fn list_triage_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
) -> Result<Json<Vec<TriageEntry>>, AppError> {
    require_permission(&claims, permissions::emergency::triage::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let rows = sqlx::query_as::<_, TriageEntry>(
        "SELECT id, er_visit_id, author_user_id, author_name, esi_level, chief_complaint, \
                observation, authored_at \
         FROM ed_triage_entries \
         WHERE er_visit_id = $1 \
         ORDER BY authored_at DESC \
         LIMIT 500",
    )
    .bind(visit_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_triage_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<CreateTriageEntry>,
) -> Result<Json<TriageEntry>, AppError> {
    require_permission(&claims, permissions::emergency::triage::CREATE)?;
    if !(1..=5).contains(&body.esi_level) {
        return Err(AppError::BadRequest("esi_level must be 1..5".into()));
    }
    if body.chief_complaint.trim().is_empty() {
        return Err(AppError::BadRequest("chief_complaint required".into()));
    }

    let author = author_display_name(&state.db, claims.sub).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let row = sqlx::query_as::<_, TriageEntry>(
        "INSERT INTO ed_triage_entries \
            (tenant_id, er_visit_id, author_user_id, author_name, esi_level, chief_complaint, observation) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, er_visit_id, author_user_id, author_name, esi_level, chief_complaint, \
                   observation, authored_at",
    )
    .bind(claims.tenant_id)
    .bind(visit_id)
    .bind(claims.sub)
    .bind(&author)
    .bind(body.esi_level)
    .bind(body.chief_complaint.trim())
    .bind(body.observation.unwrap_or_default().trim())
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Patient clinical notes ──────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientNotes {
    pub patient_id: Uuid,
    pub text: String,
    pub last_author_id: Option<Uuid>,
    pub last_author_name: Option<String>,
    pub last_edited_at: Option<DateTime<Utc>>,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePatientNotes {
    pub text: String,
    /// Optional optimistic-concurrency guard. If supplied and the
    /// current row's version is higher, returns 409.
    pub if_version: Option<i64>,
}

pub async fn get_patient_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<PatientNotes>, AppError> {
    require_permission(&claims, permissions::patients::notes::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let row = sqlx::query_as::<_, PatientNotes>(
        "SELECT patient_id, text, last_author_id, last_author_name, last_edited_at, version \
         FROM patient_clinical_notes WHERE patient_id = $1",
    )
    .bind(patient_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(row.unwrap_or(PatientNotes {
        patient_id,
        text: String::new(),
        last_author_id: None,
        last_author_name: None,
        last_edited_at: None,
        version: 0,
    })))
}

pub async fn update_patient_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<UpdatePatientNotes>,
) -> Result<Json<PatientNotes>, AppError> {
    require_permission(&claims, permissions::patients::notes::EDIT)?;
    let author = author_display_name(&state.db, claims.sub).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    if let Some(expected) = body.if_version {
        let current: Option<(i64,)> = sqlx::query_as(
            "SELECT version FROM patient_clinical_notes WHERE patient_id = $1",
        )
        .bind(patient_id)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some((cur,)) = current {
            if cur > expected {
                return Err(AppError::Conflict(format!(
                    "stale write: server version {cur} > if_version {expected}"
                )));
            }
        }
    }

    let row = sqlx::query_as::<_, PatientNotes>(
        "INSERT INTO patient_clinical_notes \
            (tenant_id, patient_id, text, last_author_id, last_author_name, last_edited_at, version) \
         VALUES ($1, $2, $3, $4, $5, now(), 1) \
         ON CONFLICT (tenant_id, patient_id) DO UPDATE \
            SET text = EXCLUDED.text, \
                last_author_id = EXCLUDED.last_author_id, \
                last_author_name = EXCLUDED.last_author_name, \
                last_edited_at = now(), \
                version = patient_clinical_notes.version + 1 \
         RETURNING patient_id, text, last_author_id, last_author_name, last_edited_at, version",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(&body.text)
    .bind(claims.sub)
    .bind(&author)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Nursing shift notes ─────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NursingShiftNotes {
    pub shift_id: String,
    pub text: String,
    pub last_author_id: Option<Uuid>,
    pub last_author_name: Option<String>,
    pub last_edited_at: Option<DateTime<Utc>>,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNursingShiftNotes {
    pub text: String,
    pub department_id: Option<Uuid>,
    pub if_version: Option<i64>,
}

pub async fn get_nursing_shift_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(shift_id): Path<String>,
) -> Result<Json<NursingShiftNotes>, AppError> {
    require_permission(&claims, permissions::nurse::shift_notes::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;
    let row = sqlx::query_as::<_, NursingShiftNotes>(
        "SELECT shift_id, text, last_author_id, last_author_name, last_edited_at, version \
         FROM nursing_shift_notes WHERE shift_id = $1",
    )
    .bind(&shift_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(row.unwrap_or(NursingShiftNotes {
        shift_id,
        text: String::new(),
        last_author_id: None,
        last_author_name: None,
        last_edited_at: None,
        version: 0,
    })))
}

pub async fn update_nursing_shift_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(shift_id): Path<String>,
    Json(body): Json<UpdateNursingShiftNotes>,
) -> Result<Json<NursingShiftNotes>, AppError> {
    require_permission(&claims, permissions::nurse::shift_notes::EDIT)?;
    let author = author_display_name(&state.db, claims.sub).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    if let Some(expected) = body.if_version {
        let current: Option<(i64,)> = sqlx::query_as(
            "SELECT version FROM nursing_shift_notes WHERE shift_id = $1",
        )
        .bind(&shift_id)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some((cur,)) = current {
            if cur > expected {
                return Err(AppError::Conflict(format!(
                    "stale write: server version {cur} > if_version {expected}"
                )));
            }
        }
    }

    let row = sqlx::query_as::<_, NursingShiftNotes>(
        "INSERT INTO nursing_shift_notes \
            (tenant_id, shift_id, department_id, text, last_author_id, last_author_name, last_edited_at, version) \
         VALUES ($1, $2, $3, $4, $5, $6, now(), 1) \
         ON CONFLICT (tenant_id, shift_id) DO UPDATE \
            SET text = EXCLUDED.text, \
                department_id = COALESCE(EXCLUDED.department_id, nursing_shift_notes.department_id), \
                last_author_id = EXCLUDED.last_author_id, \
                last_author_name = EXCLUDED.last_author_name, \
                last_edited_at = now(), \
                version = nursing_shift_notes.version + 1 \
         RETURNING shift_id, text, last_author_id, last_author_name, last_edited_at, version",
    )
    .bind(claims.tenant_id)
    .bind(&shift_id)
    .bind(body.department_id)
    .bind(&body.text)
    .bind(claims.sub)
    .bind(&author)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
