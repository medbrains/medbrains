//! Locum / cross-coverage admin endpoints.
//! See `RFCs/sprints/SPRINT-doctor-activities.md` §2.2.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CoverageAssignment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub absent_doctor_id: Uuid,
    pub covering_doctor_id: Uuid,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub reason: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListCoverageQuery {
    pub absent_doctor_id: Option<Uuid>,
    pub covering_doctor_id: Option<Uuid>,
    pub active_now: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCoverageRequest {
    pub absent_doctor_id: Uuid,
    pub covering_doctor_id: Uuid,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub reason: Option<String>,
}

pub async fn list_coverage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListCoverageQuery>,
) -> Result<Json<Vec<CoverageAssignment>>, AppError> {
    require_permission(&claims, permissions::admin::coverage::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let active_now = q.active_now.unwrap_or(false);
    let rows = sqlx::query_as::<_, CoverageAssignment>(
        "SELECT * FROM doctor_coverage_assignments \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR absent_doctor_id = $2) \
           AND ($3::uuid IS NULL OR covering_doctor_id = $3) \
           AND (NOT $4 OR (start_at <= now() AND end_at > now())) \
         ORDER BY start_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(q.absent_doctor_id)
    .bind(q.covering_doctor_id)
    .bind(active_now)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_coverage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCoverageRequest>,
) -> Result<Json<CoverageAssignment>, AppError> {
    require_permission(&claims, permissions::admin::coverage::MANAGE)?;
    if body.absent_doctor_id == body.covering_doctor_id {
        return Err(AppError::BadRequest(
            "absent_doctor and covering_doctor must differ".to_owned(),
        ));
    }
    if body.end_at <= body.start_at {
        return Err(AppError::BadRequest(
            "end_at must be after start_at".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CoverageAssignment>(
        "INSERT INTO doctor_coverage_assignments \
         (tenant_id, absent_doctor_id, covering_doctor_id, start_at, end_at, reason, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.absent_doctor_id)
    .bind(body.covering_doctor_id)
    .bind(body.start_at)
    .bind(body.end_at)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_coverage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::coverage::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let n = sqlx::query("DELETE FROM doctor_coverage_assignments WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "deleted": true })))
}
