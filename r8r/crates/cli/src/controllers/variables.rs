//! Reading and writing the instance's variables.

use crate::databases::{MAX_VARIABLE_CHARS, MAX_VARIABLES, StoredVariable, valid_key};
use crate::response_helper::{ApiError, ApiResult};
use crate::server::AppState;
use axum::Json;
use axum::extract::{Path, State};
use serde::Deserialize;
use serde_json::{Value, json};

pub async fn list(State(state): State<AppState>) -> ApiResult<Json<Vec<StoredVariable>>> {
    Ok(Json(state.db.variables().list()?))
}

#[derive(Debug, Deserialize)]
pub struct VariablePayload {
    pub value: Value,
}

pub async fn set(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(payload): Json<VariablePayload>,
) -> ApiResult<Json<Value>> {
    if !valid_key(&key) {
        return Err(ApiError::bad_request(
            "a variable name must start with a letter or underscore and \
             contain only letters, numbers and underscores — otherwise \
             `{{ vars.name }}` cannot read it back",
        ));
    }

    let encoded = payload.value.to_string();
    if encoded.len() > MAX_VARIABLE_CHARS {
        return Err(ApiError::bad_request(format!(
            "a variable may hold at most {MAX_VARIABLE_CHARS} characters; \
             something this large belongs in the workflow or a file"
        )));
    }

    let variables = state.db.variables();
    // Replacing an existing variable is always allowed; only adding a new one
    // can push the instance past the cap.
    if !variables.exists(&key)? && variables.count()? >= MAX_VARIABLES {
        return Err(ApiError::bad_request(format!(
            "this instance already has {MAX_VARIABLES} variables — \
             variables are configuration, not a data store"
        )));
    }

    variables.set(&key, &payload.value)?;
    Ok(Json(json!({ "key": key, "value": payload.value })))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> ApiResult<Json<Value>> {
    match state.db.variables().delete(&key)? {
        0 => Err(ApiError::not_found("variable")),
        _ => Ok(Json(json!({ "deleted": key }))),
    }
}
