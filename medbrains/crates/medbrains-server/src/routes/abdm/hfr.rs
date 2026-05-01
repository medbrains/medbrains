//! ABDM HFR — Health Facility Registry.
//!
//! Workflow:
//!   1. Hospital admin submits facility details via POST /api/abdm/hfr
//!   2. Backend persists abdm_hfr_registrations (status=queued) and
//!      enqueues an outbox event `abdm.hfr.register` (handler not yet
//!      shipped — covered by Phase 11.2 follow-up)
//!   3. Once NHA approves, the gateway callback (via hip_relay)
//!      updates the row to status=approved + sets nha_facility_id
//!   4. Backend writes facility_id back onto tenants
//!
//! For Phase 11.1 we ship the API + persistence; the actual gateway
//! call lands when the NHA paperwork track finalizes the API
//! credentials.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HfrRegistration {
    pub id: Uuid,
    pub status: String,
    pub nha_facility_id: Option<String>,
    pub error_message: Option<String>,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct HfrRegisterRequest {
    pub facility_name: String,
    pub address: String,
    pub state: String,
    pub city: String,
    pub pincode: String,
    /// Phone in E.164 form.
    pub contact_phone: String,
    pub email: String,
    /// Hospital ownership: `government` | `private` | `trust`.
    pub ownership: String,
    /// Specializations (free-form). Persisted in payload JSONB.
    pub specializations: Vec<String>,
}

const ABDM_HFR_VIEW: &str = "abdm.hfr.view";
const ABDM_HFR_REGISTER: &str = "abdm.hfr.register";

pub async fn register(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<HfrRegisterRequest>,
) -> Result<Json<HfrRegistration>, AppError> {
    require_permission(&claims, ABDM_HFR_REGISTER)?;
    if body.pincode.len() != 6 || !body.pincode.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest("pincode must be 6 digits".into()));
    }
    if !body.contact_phone.starts_with('+') {
        return Err(AppError::BadRequest("contact_phone must be E.164 (+...)".into()));
    }
    if !matches!(body.ownership.as_str(), "government" | "private" | "trust") {
        return Err(AppError::BadRequest("ownership must be government | private | trust".into()));
    }

    let payload = serde_json::to_value(&body).map_err(|e| {
        AppError::BadRequest(format!("payload serialize: {e}"))
    })?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HfrRegistration>(
        "INSERT INTO abdm_hfr_registrations \
            (tenant_id, status, payload) \
         VALUES ($1, 'queued', $2) \
         RETURNING id, status, nha_facility_id, error_message, submitted_at, updated_at",
    )
    .bind(claims.tenant_id)
    .bind(payload)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    // The gateway call runs through the outbox once Phase 11.2 ships
    // the abdm.hfr.register handler. For now the row sits at
    // status=queued and a follow-up admin tool (or that handler)
    // moves it forward.

    Ok(Json(row))
}

pub async fn list_registrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HfrRegistration>>, AppError> {
    require_permission(&claims, ABDM_HFR_VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HfrRegistration>(
        "SELECT id, status, nha_facility_id, error_message, submitted_at, updated_at \
         FROM abdm_hfr_registrations \
         ORDER BY submitted_at DESC \
         LIMIT 50",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TenantFacility {
    pub abdm_facility_id: Option<String>,
    pub abdm_hcx_sender_code: Option<String>,
    pub abdm_facility_active: bool,
}

pub async fn get_tenant_facility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TenantFacility>, AppError> {
    require_permission(&claims, ABDM_HFR_VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, TenantFacility>(
        "SELECT abdm_facility_id, abdm_hcx_sender_code, abdm_facility_active \
         FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
