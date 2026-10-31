//! Runs that are waiting, and the act of letting them continue.
//!
//! A workflow paused on a pharmacist's review is not finished and is not
//! broken, and it will not continue by itself. Somebody has to be able to find
//! it, see what it is waiting for, and decide.

use crate::databases::WaitingRun;
use crate::response_helper::{ApiError, ApiResult};
use crate::server::AppState;
use axum::Json;
use axum::extract::{Path, Query, State};
use r8r_workflow::interfaces::Items;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workflow_id: Option<String>,
}

/// Everything currently waiting.
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let waiting = state.db.waits().list(query.workflow_id.as_deref())?;
    Ok(Json(json!(
        waiting.iter().map(describe).collect::<Vec<_>>()
    )))
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumePayload {
    /// What the approver is adding — a decision, a note, a signature.
    ///
    /// Merged onto the items the run was carrying rather than replacing them:
    /// the approver adds to what the workflow already knew.
    #[serde(default)]
    pub data: Option<Value>,
}

/// Let a waiting run continue.
pub async fn resume(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    payload: Option<Json<ResumePayload>>,
) -> ApiResult<Json<Value>> {
    let waiting = state
        .db
        .waits()
        .find(&execution_id)?
        .ok_or_else(|| ApiError::not_found("a run waiting under that id"))?;

    let workflow = state
        .db
        .workflows()
        .find(&waiting.workflow_id)?
        .ok_or_else(|| ApiError::not_found("the workflow this run belonged to"))?;

    let extra = payload
        .and_then(|Json(payload)| payload.data)
        .map(|data| -> Items { vec![data] });

    // Cleared before the run rather than after: if continuing it fails, the
    // failure belongs in the execution history, not as a run stuck waiting
    // forever on a decision somebody already made.
    state.db.waits().clear(&execution_id)?;

    let (resumed_id, result) = state
        .runner
        .resume(&workflow.workflow, &waiting, extra)
        .await;

    tracing::info!(
        waited = %execution_id,
        resumed = %resumed_id,
        workflow = %workflow.workflow.name,
        node = %waiting.suspended.node_name,
        "a waiting run was allowed to continue"
    );

    Ok(Json(json!({
        "executionId": resumed_id,
        "resumedFrom": execution_id,
        "result": result,
    })))
}

/// Stop waiting, without continuing.
///
/// A prescription that was refused, or an approval nobody is going to give:
/// the run ends rather than sitting in the list forever, and it says so.
pub async fn cancel(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let waiting = state
        .db
        .waits()
        .find(&execution_id)?
        .ok_or_else(|| ApiError::not_found("a run waiting under that id"))?;

    state.db.waits().clear(&execution_id)?;
    state.db.executions().mark_cancelled(
        &execution_id,
        &format!("cancelled while {}", waiting.suspended.suspension.reason),
    )?;

    Ok(Json(json!({ "cancelled": execution_id })))
}

fn describe(waiting: &WaitingRun) -> Value {
    json!({
        "executionId": waiting.execution_id,
        "workflowId": waiting.workflow_id,
        "node": waiting.suspended.node_name,
        "reason": waiting.suspended.suspension.reason,
        "needsApproval": waiting.suspended.suspension.needs_approval,
        "resumeAt": waiting.suspended.suspension.resume_at,
        "waitingSince": waiting.created_at,
        "items": waiting.suspended.suspension.items.len(),
    })
}
