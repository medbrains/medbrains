//! Credential management.
//!
//! Secrets travel one way. The API accepts them, the engine seals them, and
//! nothing sends them back — a stored value is only ever replaced, never read
//! out. That matters more here than in most systems: these tokens open doors
//! into other hospitals' systems and into insurers.

use axum::extract::{Path, State};
use axum::{Extension, Json};
use medbrains_automation::prelude::CredentialTypeDescription;
use medbrains_automation_store::credentials;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::state::AutomationState;

pub async fn list_types(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CredentialTypeDescription>>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;
    Ok(Json(state.automation.credential_types()))
}

pub async fn list(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;

    let stored = credentials::list(&state.pool, claims.tenant_id).await.map_err(|error| store_error(&error))?;
    Ok(Json(json!(stored)))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayload {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    /// Already sealed by the caller's engine before it reaches the database.
    pub data: String,
}

pub async fn create(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePayload>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;

    let id = credentials::insert(
        &state.pool,
        claims.tenant_id,
        claims.sub,
        payload.name.trim(),
        &payload.type_name,
        &payload.data,
    )
    .await
    .map_err(|error| store_error(&error))?;

    // The name is safe to log; the type tells an auditor which system this
    // opens. The data never appears anywhere.
    tracing::info!(
        credential = %payload.name,
        credential_type = %payload.type_name,
        tenant = %claims.tenant_id,
        "credential stored"
    );

    Ok(Json(json!({ "id": id, "name": payload.name, "type": payload.type_name })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayload {
    pub name: String,
    pub data: String,
}

pub async fn update(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePayload>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;

    match credentials::update(&state.pool, claims.tenant_id, id, payload.name.trim(), &payload.data)
        .await
        .map_err(|error| store_error(&error))?
    {
        0 => Err(AppError::NotFound),
        _ => Ok(Json(json!({ "id": id, "name": payload.name }))),
    }
}

pub async fn delete(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;

    match credentials::delete(&state.pool, claims.tenant_id, id).await.map_err(|error| store_error(&error))? {
        0 => Err(AppError::NotFound),
        _ => Ok(Json(json!({ "deleted": id }))),
    }
}

fn store_error(error: &medbrains_automation_store::StoreError) -> AppError {
    tracing::error!(%error, "automation credential store failed");
    AppError::Internal(error.to_string())
}
