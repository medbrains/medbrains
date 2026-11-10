//! Credential management. Secrets travel in one direction only: the API
//! accepts them, and never returns them.

use crate::response_helper::{ApiError, ApiResult};
use crate::server::AppState;
use axum::Json;
use axum::extract::{Path, State};
use r8r_workflow::credentials::CredentialTypeDescription;
use serde::Deserialize;
use serde_json::{Value, json};

/// The credential types this build knows how to authenticate with.
pub async fn list_types(State(state): State<AppState>) -> Json<Vec<CredentialTypeDescription>> {
    Json(state.credential_types.descriptions())
}

pub async fn list(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let summaries = state.db.credentials().list()?;
    Ok(Json(json!(summaries)))
}

/// One credential, with every secret replaced by a placeholder so the editor
/// can show the form pre-filled without ever holding the real value.
pub async fn get(State(state): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    let stored = state
        .db
        .credentials()
        .decrypt(&id)
        .map_err(|e| ApiError::internal(e.to_string()))?
        .ok_or_else(|| ApiError::not_found("credential"))?;

    let redacted = describe(&state, &stored.summary.type_name)?.redact(&stored.data);

    Ok(Json(json!({
        "id": stored.summary.id,
        "name": stored.summary.name,
        "type": stored.summary.type_name,
        "data": redacted,
        "createdAt": stored.summary.created_at,
        "updatedAt": stored.summary.updated_at,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayload {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    #[serde(default)]
    pub data: Value,
}

pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreatePayload>,
) -> ApiResult<Json<Value>> {
    let description = describe(&state, &payload.type_name)?;
    let name = default_name(&payload.name, &description.display_name);
    let id = uuid::Uuid::new_v4().to_string();

    state
        .db
        .credentials()
        .insert(&id, &name, &payload.type_name, &payload.data)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    Ok(Json(
        json!({ "id": id, "name": name, "type": payload.type_name }),
    ))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayload {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub data: Value,
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePayload>,
) -> ApiResult<Json<Value>> {
    let repository = state.db.credentials();
    let stored = repository
        .decrypt(&id)
        .map_err(|e| ApiError::internal(e.to_string()))?
        .ok_or_else(|| ApiError::not_found("credential"))?;

    let description = describe(&state, &stored.summary.type_name)?;
    // Fields the editor sent back as the placeholder keep their stored value,
    // so saving a form you never retyped does not wipe the secret.
    let merged = description.merge_secrets(&stored.data, &payload.data);
    let name = payload.name.unwrap_or(stored.summary.name);

    repository
        .update(&id, &name, &merged)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    Ok(Json(
        json!({ "id": id, "name": name, "type": stored.summary.type_name }),
    ))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    match state.db.credentials().delete(&id)? {
        0 => Err(ApiError::not_found("credential")),
        _ => Ok(Json(json!({ "deleted": id }))),
    }
}

fn describe(state: &AppState, type_name: &str) -> ApiResult<CredentialTypeDescription> {
    state
        .credential_types
        .get(type_name)
        .cloned()
        .ok_or_else(|| ApiError::bad_request(format!("unknown credential type `{type_name}`")))
}

fn default_name(supplied: &str, type_display_name: &str) -> String {
    if supplied.trim().is_empty() {
        format!("{type_display_name} account")
    } else {
        supplied.trim().to_owned()
    }
}
