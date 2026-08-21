//! Execution history.
//!
//! A run's stored payload is whatever flowed through the workflow, which in
//! this system can be clinical data. Reading it therefore needs the same
//! permission as viewing automation at all, and it is retained rather than
//! kept — see `medbrains-automation-store::executions`.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use medbrains_automation_store::executions;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::state::AutomationState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workflow_id: Option<Uuid>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

pub async fn list(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;

    let runs = executions::list(&state.pool, claims.tenant_id, query.workflow_id, query.limit)
        .await
        .map_err(|error| store_error(&error))?;

    Ok(Json(json!(runs)))
}

pub async fn get(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;

    let (summary, data) = executions::find(&state.pool, claims.tenant_id, id)
        .await
        .map_err(|error| store_error(&error))?
        .ok_or(AppError::NotFound)?;

    let mut body = serde_json::to_value(&summary).unwrap_or_else(|_| json!({}));
    if let Some(object) = body.as_object_mut() {
        object.insert("data".into(), data);
    }
    Ok(Json(body))
}

pub async fn delete(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;

    match executions::delete(&state.pool, claims.tenant_id, id).await.map_err(|error| store_error(&error))? {
        0 => Err(AppError::NotFound),
        _ => Ok(Json(json!({ "deleted": id }))),
    }
}

fn store_error(error: &medbrains_automation_store::StoreError) -> AppError {
    tracing::error!(%error, "automation execution store failed");
    AppError::Internal(error.to_string())
}
