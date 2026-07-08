//! Clinical Trials registry (ticket #2983). A hospital research department's trials with a
//! lifecycle status. Gated by the `specialty.clinical_trials.*` permission (research / admin).

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

const COLS: &str = "id, tenant_id, protocol_number, title, sponsor, phase, status, indication, \
     principal_investigator, target_enrollment, start_date, end_date, notes, is_active, \
     created_at, updated_at";

const VALID_STATUS: [&str; 6] = [
    "planned",
    "recruiting",
    "active",
    "completed",
    "terminated",
    "suspended",
];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ClinicalTrial {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub protocol_number: String,
    pub title: String,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub status: String,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct TrialQuery {
    pub status: Option<String>,
}

/// `GET /api/clinical-trials?status=` — the registry, optionally filtered by lifecycle status.
pub async fn list_trials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TrialQuery>,
) -> Result<Json<Vec<ClinicalTrial>>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "SELECT {COLS} FROM clinical_trials \
         WHERE tenant_id = $1 AND is_active = true AND ($2::text IS NULL OR status = $2) \
         ORDER BY created_at DESC LIMIT 2000"
    ))
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/clinical-trials/{id}` — one trial.
pub async fn get_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ClinicalTrial>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "SELECT {COLS} FROM clinical_trials WHERE id = $1 AND tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct CreateTrialRequest {
    pub protocol_number: String,
    pub title: String,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub status: Option<String>,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

/// `POST /api/clinical-trials` — register a trial.
pub async fn create_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTrialRequest>,
) -> Result<Json<ClinicalTrial>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    if body.protocol_number.trim().is_empty() || body.title.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Protocol number and title are required".to_owned(),
        ));
    }
    if let Some(s) = &body.status {
        if !VALID_STATUS.contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "INSERT INTO clinical_trials \
         (tenant_id, protocol_number, title, sponsor, phase, status, indication, \
          principal_investigator, target_enrollment, start_date, end_date, notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'planned'), $7, $8, $9, $10, $11, $12) \
         RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.protocol_number.trim())
    .bind(body.title.trim())
    .bind(&body.sponsor)
    .bind(&body.phase)
    .bind(&body.status)
    .bind(&body.indication)
    .bind(&body.principal_investigator)
    .bind(body.target_enrollment)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateTrialRequest {
    pub status: Option<String>,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

/// `PUT /api/clinical-trials/{id}` — update a trial (status change / detail edit).
pub async fn update_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTrialRequest>,
) -> Result<Json<ClinicalTrial>, AppError> {
    require_permission(&claims, "specialty.clinical_trials.create")?;
    if let Some(s) = &body.status {
        if !VALID_STATUS.contains(&s.as_str()) {
            return Err(AppError::BadRequest("Invalid status".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClinicalTrial>(&format!(
        "UPDATE clinical_trials SET status = COALESCE($3, status), sponsor = COALESCE($4, sponsor), \
            phase = COALESCE($5, phase), indication = COALESCE($6, indication), \
            principal_investigator = COALESCE($7, principal_investigator), \
            target_enrollment = COALESCE($8, target_enrollment), \
            end_date = COALESCE($9, end_date), notes = COALESCE($10, notes), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.sponsor)
    .bind(&body.phase)
    .bind(&body.indication)
    .bind(&body.principal_investigator)
    .bind(body.target_enrollment)
    .bind(body.end_date)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
