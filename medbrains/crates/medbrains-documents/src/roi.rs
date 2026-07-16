//! Release of Information (ROI). External parties request a patient's records;
//! the MRD officer reviews/approves; every access is logged. Gated by the
//! existing `mrd.records.*` permissions.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RoiRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub requester_type: String,
    pub requester_name: String,
    pub requester_contact: Option<String>,
    pub purpose: Option<String>,
    pub record_scope: String,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
    pub scope_notes: Option<String>,
    pub status: String,
    pub authorization_obtained: bool,
    pub expiry_date: Option<NaiveDate>,
    pub requested_by: Option<Uuid>,
    pub requested_at: DateTime<Utc>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub decision_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RoiAccessLogRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub roi_request_id: Uuid,
    pub accessed_by: Uuid,
    pub action: String,
    pub accessed_at: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RoiQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoiRequest {
    pub patient_id: Uuid,
    pub requester_type: String,
    pub requester_name: String,
    pub requester_contact: Option<String>,
    pub purpose: Option<String>,
    pub record_scope: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
    pub scope_notes: Option<String>,
    pub authorization_obtained: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRoiRequest {
    /// "approved" or "denied".
    pub decision: String,
    pub decision_reason: Option<String>,
    pub expiry_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct RoiAccessRequest {
    /// "viewed" | "downloaded" | "released".
    pub action: String,
    pub notes: Option<String>,
}

/// `GET /api/roi-requests`
pub async fn list_roi_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<RoiQuery>,
) -> Result<Json<Vec<RoiRequest>>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RoiRequest>(
        "SELECT * FROM roi_requests \
         WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) \
         ORDER BY requested_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(params.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/roi-requests`
pub async fn create_roi_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRoiRequest>,
) -> Result<Json<RoiRequest>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    if body.requester_name.trim().is_empty() {
        return Err(AppError::BadRequest("Requester name is required.".to_owned()));
    }
    let scope = body.record_scope.as_deref().unwrap_or("full");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RoiRequest>(
        "INSERT INTO roi_requests \
           (tenant_id, patient_id, requester_type, requester_name, requester_contact, purpose, \
            record_scope, date_from, date_to, scope_notes, authorization_obtained, requested_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.requester_type.trim())
    .bind(body.requester_name.trim())
    .bind(&body.requester_contact)
    .bind(&body.purpose)
    .bind(scope)
    .bind(body.date_from)
    .bind(body.date_to)
    .bind(&body.scope_notes)
    .bind(body.authorization_obtained.unwrap_or(false))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/roi-requests/{id}/review` — approve or deny (MRD officer).
pub async fn review_roi_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewRoiRequest>,
) -> Result<Json<RoiRequest>, AppError> {
    require_permission(&claims, permissions::mrd::records::MANAGE)?;

    let status = match body.decision.as_str() {
        "approved" => "approved",
        "denied" => "denied",
        other => return Err(AppError::BadRequest(format!("Invalid decision '{other}'."))),
    };
    if status == "denied" && body.decision_reason.as_deref().unwrap_or("").trim().is_empty() {
        return Err(AppError::BadRequest("A reason is required to deny a request.".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RoiRequest>(
        "UPDATE roi_requests SET \
           status = $3, decision_reason = $4, expiry_date = COALESCE($5, expiry_date), \
           reviewed_by = $6, reviewed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(status)
    .bind(&body.decision_reason)
    .bind(body.expiry_date)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Request is not pending review.".to_owned()))?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/roi-requests/{id}/access` — log an access; a download/release on
/// an approved request marks it released.
pub async fn record_roi_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RoiAccessRequest>,
) -> Result<Json<RoiAccessLogRow>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    if !["viewed", "downloaded", "released"].contains(&body.action.as_str()) {
        return Err(AppError::BadRequest(format!("Invalid access action '{}'.", body.action)));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let request = sqlx::query_as::<_, RoiRequest>(
        "SELECT * FROM roi_requests WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Records may only be released from an approved (non-expired) request.
    let releasing = body.action != "viewed";
    if releasing && request.status != "approved" && request.status != "released" {
        return Err(AppError::BadRequest(
            "Records can only be released from an approved request.".to_owned(),
        ));
    }

    let log = sqlx::query_as::<_, RoiAccessLogRow>(
        "INSERT INTO roi_access_log (tenant_id, roi_request_id, accessed_by, action, notes) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(&body.action)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    if releasing && request.status == "approved" {
        sqlx::query(
            "UPDATE roi_requests SET status = 'released', updated_at = now() \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(log))
}

/// `GET /api/roi-requests/{id}/access-log`
pub async fn list_roi_access_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<RoiAccessLogRow>>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RoiAccessLogRow>(
        "SELECT * FROM roi_access_log \
         WHERE roi_request_id = $1 AND tenant_id = $2 \
         ORDER BY accessed_at DESC LIMIT 500",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
