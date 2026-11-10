//! What a workflow remembers, and how to make it forget.
//!
//! Forgetting is the interesting half. A workflow that syncs "everything since
//! `lastSync`" covers old ground again once that value is cleared, which is how
//! a backfill is started — and how a bad sync is corrected.

use crate::response_helper::{ApiError, ApiResult};
use crate::server::AppState;
use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};

/// Everything this workflow remembers.
pub async fn get(
    State(state): State<AppState>,
    Path(workflow_id): Path<String>,
) -> ApiResult<Json<Value>> {
    ensure_exists(&state, &workflow_id)?;
    Ok(Json(json!(state.db.state().load(&workflow_id)?)))
}

/// Forget one value.
///
/// The usual reason: re-run a sync from the beginning without editing the
/// workflow, by clearing the watermark it reads.
pub async fn forget(
    State(state): State<AppState>,
    Path((workflow_id, key)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    ensure_exists(&state, &workflow_id)?;

    let forgotten = state.db.state().forget(&workflow_id, &key)? > 0;
    if forgotten {
        tracing::info!(workflow = %workflow_id, %key, "workflow state cleared");
    }

    Ok(Json(
        json!({ "workflowId": workflow_id, "key": key, "forgotten": forgotten }),
    ))
}

/// Forget everything.
pub async fn clear(
    State(state): State<AppState>,
    Path(workflow_id): Path<String>,
) -> ApiResult<Json<Value>> {
    ensure_exists(&state, &workflow_id)?;

    let cleared = state.db.state().clear(&workflow_id)?;
    tracing::info!(workflow = %workflow_id, cleared, "all workflow state cleared");

    Ok(Json(
        json!({ "workflowId": workflow_id, "cleared": cleared }),
    ))
}

/// A 404 for an unknown workflow beats an empty object, which would read as
/// "it remembers nothing" rather than "there is no such workflow".
fn ensure_exists(state: &AppState, workflow_id: &str) -> ApiResult<()> {
    state
        .db
        .workflows()
        .find(workflow_id)?
        .ok_or_else(|| ApiError::not_found("workflow"))
        .map(|_| ())
}
