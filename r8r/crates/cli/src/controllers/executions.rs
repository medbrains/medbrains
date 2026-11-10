use crate::databases::MAX_ATTEMPTS;
use crate::databases::{ExecutionSummary, StoredExecution};
use crate::response_helper::{ApiError, ApiResult};
use crate::server::AppState;
use axum::Json;
use axum::extract::{Path, Query, State};
use r8r_workflow::interfaces::RunResult;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workflow_id: Option<String>,
    /// `error` narrows the list to what failed — the dead-letter view.
    pub status: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_limit() -> usize {
    50
}

pub async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<ExecutionSummary>>> {
    Ok(Json(state.db.executions().list(
        q.workflow_id.as_deref(),
        q.status.as_deref(),
        q.limit,
    )?))
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<StoredExecution>> {
    state
        .db
        .executions()
        .find(&id)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("execution"))
}

/// Run a workflow again with the items that started a previous run.
///
/// Safe to reach for now that webhook triggers can declare an idempotency key:
/// a retry of an event that already completed replays its response rather than
/// doing the work twice. Without a key it genuinely runs again, which is what
/// the caller asked for.
pub async fn retry(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut outcome, result) = retry_one(&state, &id).await?;

    // A retry somebody asked for by hand carries the whole result: they are
    // watching, and what they want to know is whether it worked this time. A
    // batch of a hundred deliberately does not.
    if let Some(object) = outcome.as_object_mut() {
        object.insert("result".into(), json!(result));
    }
    Ok(Json(outcome))
}

/// How many runs one call may put through.
///
/// A bulk replay is meant for the batch a vendor outage produced, not for
/// re-running the whole history — which would take the vendor down again.
const MAX_BULK_RETRY: usize = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkRetryPayload {
    /// The runs to put through again.
    pub execution_ids: Vec<String>,
}

/// Replay a batch of runs.
///
/// The case this exists for: a vendor is down for twenty minutes, everything
/// that fired in that window fails together, and somebody has to put it all
/// through once the vendor is back. One at a time, that is a job people abandon
/// halfway — which is how a batch of results quietly goes missing.
///
/// Runs go through one after another rather than at once, because the reason
/// they failed was usually that something could not keep up.
pub async fn retry_many(
    State(state): State<AppState>,
    Json(payload): Json<BulkRetryPayload>,
) -> ApiResult<Json<Value>> {
    if payload.execution_ids.len() > MAX_BULK_RETRY {
        return Err(ApiError::bad_request(format!(
            "{} runs is more than one call replays; the limit is {MAX_BULK_RETRY}",
            payload.execution_ids.len()
        )));
    }

    let mut outcomes = Vec::with_capacity(payload.execution_ids.len());
    for id in &payload.execution_ids {
        // One failure does not abandon the batch: the point is to get through
        // the backlog, and a run that cannot be replayed is reported as such.
        match retry_one(&state, id).await {
            Ok((outcome, _)) => outcomes.push(outcome),
            Err(error) => outcomes.push(json!({
                "retryOf": id,
                "retried": false,
                "reason": error.message,
            })),
        }
    }

    let retried = outcomes
        .iter()
        .filter(|o| o["retried"] == json!(true))
        .count();
    Ok(Json(json!({
        "requested": payload.execution_ids.len(),
        "retried": retried,
        "results": outcomes,
    })))
}

/// Put one run through again, returning a summary and what happened.
async fn retry_one(state: &AppState, id: &str) -> ApiResult<(Value, RunResult)> {
    let previous = state
        .db
        .executions()
        .find(id)?
        .ok_or_else(|| ApiError::not_found("execution"))?;

    // A run still in flight is not a candidate: it may yet succeed, and
    // replaying it now would do the work twice on purpose.
    if previous.summary.status == "running" {
        return Err(ApiError::bad_request("this run has not finished yet"));
    }

    let lineage = state
        .db
        .executions()
        .lineage_for_retry(id)
        .map_err(|e| ApiError::internal(e.to_string()))?
        .ok_or_else(|| {
            ApiError::bad_request(format!(
                "this work has already been through {MAX_ATTEMPTS} attempts; \
                 another one will not fix it"
            ))
        })?;

    let workflow = state
        .db
        .workflows()
        .find(&previous.summary.workflow_id)?
        .ok_or_else(|| ApiError::not_found("the workflow this run belonged to"))?;

    // The items it was originally handed, so the retry is the same work rather
    // than a fresh empty run.
    let input = state
        .db
        .executions()
        .trigger_input(id)
        .map_err(|e| ApiError::internal(e.to_string()))?
        .unwrap_or_else(|| vec![json!({})]);

    let (execution_id, result) = state
        .runner
        .run_retry(&workflow.workflow, input, &lineage)
        .await;

    let summary = json!({
        "executionId": execution_id,
        "retryOf": id,
        "retried": true,
        "attempt": lineage.attempt,
        "status": result.status,
        "error": result.error,
    });
    Ok((summary, result))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    if state.db.executions().delete(&id)? == 0 {
        return Err(ApiError::not_found("execution"));
    }

    // The run's files go with it. Deleting the row and leaving the attachment
    // on disk is how a disk fills with things nothing points at.
    state.runner.forget_files(std::slice::from_ref(&id)).await;
    Ok(Json(serde_json::json!({ "deleted": id })))
}

/// Hand back a file a run produced.
///
/// Needed because offloading a file makes it unreachable otherwise: the item
/// carries a reference, and without somewhere to resolve it the execution log
/// shows a name and a size and nothing anybody can open.
pub async fn binary(
    State(state): State<AppState>,
    Path((id, name)): Path<(String, String)>,
) -> Result<axum::response::Response, ApiError> {
    use axum::response::IntoResponse as _;

    let bytes = state
        .runner
        .read_file(&format!("{id}/{name}"))
        .await
        .map_err(|e| ApiError::not_found(&e.to_string()))?;

    Ok((
        [(axum::http::header::CONTENT_TYPE, "application/octet-stream")],
        bytes,
    )
        .into_response())
}
