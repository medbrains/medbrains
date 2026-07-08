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
