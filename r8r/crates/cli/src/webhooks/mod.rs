//! Turns an inbound HTTP request into a workflow execution.
//! Mirrors `packages/cli/src/webhooks`.

use crate::databases::{DEFAULT_WINDOW_HOURS, RecordedResponse};
use crate::server::AppState;
use axum::Json;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use r8r_workflow::Expression;
use r8r_workflow::Workflow;
use r8r_workflow::interfaces::{ExecutionMode, ExecutionStatus, Node};
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

/// Decoded query string. A `BTreeMap` keeps the item deterministic, which
/// matters because executions are stored and compared.
type QueryParams = BTreeMap<String, String>;

/// `ANY /webhook/{*path}`
// `tracing`'s macros expand into branchy code that the cognitive-complexity
// lint attributes to this function; what is written here is a short sequence of
// guards.
#[allow(clippy::cognitive_complexity)]
pub async fn handle(
    State(state): State<AppState>,
    method: Method,
    Path(path): Path<String>,
    Query(query): Query<QueryParams>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let workflows = match state.db.workflows().active() {
        Ok(workflows) => workflows,
        Err(e) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("database error: {e}"),
            );
        }
    };

    let Some((workflow, node)) = find_target(&workflows, &path, method.as_str()) else {
        return nobody_listening(&method, &path);
    };

    tracing::info!(
        method = method.as_str(),
        path = %path,
        workflow = %workflow.name,
        bytes = body.len(),
        "webhook received"
    );

    let item = request_item(&method, &path, &headers, &query, &body);
    let node_id = node.id.clone();

    // Has this exact event already been handled? Senders retry, and a retried
    // clinical event must not do the work a second time.
    let idempotency_key = idempotency_key_for(node, &item);
    if let Some(replayed) = replay_if_seen(&state, &workflow, idempotency_key.as_deref()) {
        return replayed;
    }

    if node.param("respond").and_then(Value::as_str) == Some("immediately") {
        // Fire and forget: the caller gets 202 and never waits on the workflow.
        let accepted = accept_and_run(state.clone(), workflow.clone(), node_id, item);
        record(
            &state,
            &workflow.id,
            idempotency_key.as_deref(),
            StatusCode::ACCEPTED,
            &json!({ "accepted": true }),
            None,
        );
        return accepted;
    }

    let (execution_id, result) = state
        .runner
        .run(
            &workflow,
            Some(&node_id),
            vec![item],
            ExecutionMode::Webhook,
        )
        .await;

    let (status, payload) = reply_parts(&execution_id, result);
    record(
        &state,
        &workflow.id,
        idempotency_key.as_deref(),
        status,
        &payload,
        Some(&execution_id),
    );

    (status, Json(payload)).into_response()
}

/// Nothing is listening on this path and method.
fn nobody_listening(method: &Method, path: &str) -> Response {
    tracing::warn!(
        method = method.as_str(),
        %path,
        "webhook received for a path no active workflow listens on"
    );
    error(
        StatusCode::NOT_FOUND,
        &format!(
            "no active workflow is listening on {} /webhook/{path}",
            method.as_str()
        ),
    )
}

/// The response this event already received, if it has been handled before.
///
/// A failed lookup is not a reason to reject the request: the worst case is the
/// behaviour we had before, and refusing real events in order to guard against
/// duplicates would be the wrong trade.
// `tracing`'s macros expand into branchy code the complexity lint attributes to
// this function; what is written here is one lookup and three outcomes.
#[allow(clippy::cognitive_complexity)]
fn replay_if_seen(state: &AppState, workflow: &Workflow, key: Option<&str>) -> Option<Response> {
    let key = key?;

    match state
        .db
        .idempotency()
        .recall(&workflow.id, key, DEFAULT_WINDOW_HOURS)
    {
        Ok(Some(recorded)) => {
            tracing::info!(
                workflow = %workflow.name,
                %key,
                first_seen = %recorded.first_seen.to_rfc3339(),
                "replaying the response to a repeated request"
            );
            Some(replay(&recorded))
        }
        Ok(None) => None,
        Err(e) => {
            tracing::error!(error = %e, "could not check idempotency; treating the request as new");
            None
        }
    }
}

/// The key that identifies this event, if the trigger declares one.
///
/// It is an expression over the request, because only the workflow knows what
/// makes two requests the same: a header the sender sets, an id in the body, or
/// a composite of both.
fn idempotency_key_for(node: &Node, item: &Value) -> Option<String> {
    let template = node.param("idempotencyKey").and_then(Value::as_str)?.trim();
    if template.is_empty() {
        return None;
    }

    let expression = Expression::new("", "");
    let resolved = expression
        .resolve(
            &Value::String(template.to_owned()),
            item,
            0,
            &vec![item.clone()],
        )
        .ok()?;

    let key = r8r_workflow::stringify(&resolved);
    let key = key.trim();

    // A key that resolved to nothing is not a key. Treating "" as one would
    // make every request with a missing header a duplicate of the last.
    if key.is_empty() {
        None
    } else {
        Some(key.to_owned())
    }
}

/// Remember what was returned, so a retry gets the same answer.
fn record(
    state: &AppState,
    workflow_id: &str,
    key: Option<&str>,
    status: StatusCode,
    body: &Value,
    execution_id: Option<&str>,
) {
    let Some(key) = key else { return };

    // Only successful handling is remembered. A failure the sender retries
    // should be allowed to succeed the second time — that is what retrying is
    // for, and pinning a 500 for a day would be actively harmful.
    if !status.is_success() {
        return;
    }

    if let Err(e) =
        state
            .db
            .idempotency()
            .remember(workflow_id, key, status.as_u16(), body, execution_id)
    {
        tracing::error!(error = %e, "could not record idempotency; a retry will run again");
    }
}

fn replay(recorded: &RecordedResponse) -> Response {
    let status = StatusCode::from_u16(recorded.status).unwrap_or(StatusCode::OK);
    (
        status,
        // Says plainly that this is a replay, so a caller comparing responses
        // is not left wondering why nothing happened.
        [("x-r8r-idempotent-replay", "true")],
        Json(recorded.body.clone()),
    )
        .into_response()
}

/// Answer 202 immediately and run the workflow in the background.
fn accept_and_run(state: AppState, workflow: Workflow, node_id: String, item: Value) -> Response {
    tokio::spawn(async move {
        state
            .runner
            .run(
                &workflow,
                Some(&node_id),
                vec![item],
                ExecutionMode::Webhook,
            )
            .await;
    });
    (StatusCode::ACCEPTED, Json(json!({ "accepted": true }))).into_response()
}

/// Translate a finished execution into the status and body the caller sees.
///
/// Split from sending it so the same pair can be recorded for idempotent
/// replay — a retry has to receive exactly what the first attempt did.
fn reply_parts(
    execution_id: &str,
    result: r8r_workflow::interfaces::RunResult,
) -> (StatusCode, Value) {
    if result.status == ExecutionStatus::Error {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "executionId": execution_id, "error": result.error }),
        );
    }

    // One item replies as an object, several as an array — the shape callers
    // expect from an API rather than r8r's internal item list.
    let mut items = result.last;
    let payload = if items.len() == 1 {
        items.pop().unwrap_or(Value::Null)
    } else {
        Value::Array(items)
    };
    (StatusCode::OK, payload)
}

/// First active workflow with a webhook node matching this path and method.
fn find_target<'a>(
    workflows: &'a [crate::databases::StoredWorkflow],
    path: &str,
    method: &str,
) -> Option<(Workflow, &'a Node)> {
    let wanted = path.trim_matches('/');
    for stored in workflows {
        for node in &stored.workflow.nodes {
            if node.kind != "webhook" || node.disabled {
                continue;
            }
            let node_path = node
                .param("path")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim_matches('/');
            if node_path != wanted {
                continue;
            }
            let node_method = node
                .param("method")
                .and_then(Value::as_str)
                .unwrap_or("POST");
            if node_method != "ANY" && !node_method.eq_ignore_ascii_case(method) {
                continue;
            }
            return Some((stored.workflow.clone(), node));
        }
    }
    None
}

fn request_item(
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    query: &QueryParams,
    body: &Bytes,
) -> Value {
    let header_map: Map<String, Value> = headers
        .iter()
        .filter(|(name, _)| !is_sensitive(name.as_str()))
        .map(|(name, value)| (name.to_string(), json!(value.to_str().unwrap_or_default())))
        .collect();

    let text = String::from_utf8_lossy(body).to_string();
    let parsed_body = if text.trim().is_empty() {
        Value::Null
    } else {
        serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text))
    };

    json!({
        "method": method.as_str(),
        "path": path,
        "headers": header_map,
        "query": query,
        "body": parsed_body,
    })
}

/// Credentials in the request must not be copied into the stored execution,
/// which is readable by anyone who can open the editor.
fn is_sensitive(name: &str) -> bool {
    matches!(
        name,
        "authorization" | "cookie" | "proxy-authorization" | "x-api-key"
    )
}

fn error(status: StatusCode, message: &str) -> Response {
    (status, Json(json!({ "error": message }))).into_response()
}
