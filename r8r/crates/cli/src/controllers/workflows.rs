use crate::databases::{StoredVersion, StoredWorkflow, VersionEntry};
use crate::response_helper::{ApiError, ApiResult};
use crate::server::AppState;
use axum::Json;
use axum::extract::{Path, State};
use r8r_workflow::Workflow;
use r8r_workflow::diff::WorkflowDiff;
use r8r_workflow::interfaces::{ExecutionMode, Items};
use serde::Deserialize;
use serde_json::{Value, json};

pub async fn list(State(state): State<AppState>) -> ApiResult<Json<Vec<StoredWorkflow>>> {
    Ok(Json(state.db.workflows().list()?))
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<StoredWorkflow>> {
    load(&state, &id).map(Json)
}

pub async fn create(
    State(state): State<AppState>,
    Json(mut wf): Json<Workflow>,
) -> ApiResult<Json<StoredWorkflow>> {
    // Ignore any client-supplied id: the server owns identity.
    wf.id = uuid::Uuid::new_v4().to_string();
    if wf.name.trim().is_empty() {
        wf.name = "My workflow".into();
    }
    reject_invalid(&wf)?;
    let stored = state.db.workflows().insert(&wf)?;
    state.db.versions().record(&wf, Some("Created"))?;
    Ok(Json(stored))
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(mut wf): Json<Workflow>,
) -> ApiResult<Json<StoredWorkflow>> {
    let existing = load(&state, &id)?;
    wf.id = id;
    if wf.name.trim().is_empty() {
        wf.name = existing.workflow.name;
    }
    // Whether a workflow is running is decided by `/activate`, never by the
    // body of a save. A client that leaves `active` out of its payload — the
    // editor's autosave among them — would otherwise switch off a live
    // workflow as a side effect of an unrelated edit.
    wf.active = existing.workflow.active;
    reject_invalid(&wf)?;
    state.db.workflows().update(&wf)?;
    // Recorded after the write, so a save that fails leaves no history entry
    // claiming it happened. An identical save records nothing.
    state.db.versions().record(&wf, None)?;
    load(&state, &wf.id).map(Json)
}

// ------------------------------------------------------------------ history

pub async fn history(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<VersionEntry>>> {
    load(&state, &id)?;
    Ok(Json(state.db.versions().history(&id)?))
}

pub async fn version(
    State(state): State<AppState>,
    Path((id, version)): Path<(String, i64)>,
) -> ApiResult<Json<StoredVersion>> {
    state
        .db
        .versions()
        .find(&id, version)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("version"))
}

#[derive(Debug, Deserialize)]
pub struct ComparePayload {
    pub from: i64,
    pub to: i64,
}

pub async fn compare(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ComparePayload>,
) -> ApiResult<Json<WorkflowDiff>> {
    state
        .db
        .versions()
        .compare(&id, payload.from, payload.to)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("version"))
}

/// Put a workflow back the way an earlier version had it.
///
/// The restore is written as a new version rather than by rewinding, so the
/// history still shows that it happened — which matters when the restore turns
/// out to be the thing that broke something.
///
/// Whether the workflow is switched on is left exactly as it was. A version
/// records what a workflow does, not whether it was running, and restoring one
/// must never start or stop anything by itself.
pub async fn restore(
    State(state): State<AppState>,
    Path((id, version)): Path<(String, i64)>,
) -> ApiResult<Json<StoredWorkflow>> {
    let current = load(&state, &id)?;
    let earlier = state
        .db
        .versions()
        .find(&id, version)?
        .ok_or_else(|| ApiError::not_found("version"))?;

    let mut restored = earlier.workflow;
    restored.id.clone_from(&id);
    restored.active = current.workflow.active;
    reject_invalid(&restored)?;

    state.db.workflows().update(&restored)?;
    state
        .db
        .versions()
        .record(&restored, Some(&format!("Restored version {version}")))?;
    load(&state, &id).map(Json)
}

pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    match state.db.workflows().delete(&id)? {
        0 => Err(ApiError::not_found("workflow")),
        _ => Ok(Json(json!({ "deleted": id }))),
    }
}

#[derive(Debug, Deserialize)]
pub struct ActivatePayload {
    pub active: bool,
}

pub async fn set_active(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ActivatePayload>,
) -> ApiResult<Json<StoredWorkflow>> {
    let stored = load(&state, &id)?;

    // Activating is a promise that triggers will fire; refuse if there is
    // nothing to fire, so the toggle never lies about what the server will do.
    if payload.active {
        let triggers = stored
            .workflow
            .trigger_nodes(|k| state.registry.is_trigger(k));
        let automatic = triggers.iter().any(|n| n.kind != "manual");
        if !automatic {
            return Err(ApiError::bad_request(
                "add a Webhook or Schedule trigger before activating this workflow",
            ));
        }
    }

    state.db.workflows().set_active(&id, payload.active)?;
    load(&state, &id).map(Json)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPayload {
    /// Node to start from. Defaults to the workflow's trigger.
    #[serde(default)]
    pub start_node: Option<String>,
    /// Items fed to the starting node.
    #[serde(default)]
    pub input: Option<Items>,
}

/// Run a saved workflow by hand — what the editor's Execute button calls.
pub async fn run(
    State(state): State<AppState>,
    Path(id): Path<String>,
    payload: Option<Json<RunPayload>>,
) -> ApiResult<Json<Value>> {
    let stored = load(&state, &id)?;
    let payload = payload.map(|Json(p)| p).unwrap_or_default();
    let input = payload.input.unwrap_or_else(|| vec![json!({})]);

    let (execution_id, result) = state
        .runner
        .run(
            &stored.workflow,
            payload.start_node.as_deref(),
            input,
            ExecutionMode::Manual,
        )
        .await;

    Ok(Json(
        json!({ "executionId": execution_id, "result": result }),
    ))
}

/// Run a workflow posted in the request body without saving it. Lets the editor
/// execute unsaved changes.
pub async fn run_unsaved(
    State(state): State<AppState>,
    Json(payload): Json<RunUnsavedPayload>,
) -> ApiResult<Json<Value>> {
    reject_invalid(&payload.workflow)?;
    let input = payload.input.unwrap_or_else(|| vec![json!({})]);
    let result = state
        .runner
        .dry_run(
            &payload.workflow,
            payload.start_node.as_deref(),
            input,
            ExecutionMode::Manual,
        )
        .await;
    Ok(Json(
        json!({ "executionId": Value::Null, "result": result }),
    ))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunUnsavedPayload {
    pub workflow: Workflow,
    #[serde(default)]
    pub start_node: Option<String>,
    #[serde(default)]
    pub input: Option<Items>,
}

fn load(state: &AppState, id: &str) -> ApiResult<StoredWorkflow> {
    state
        .db
        .workflows()
        .find(id)?
        .ok_or_else(|| ApiError::not_found("workflow"))
}

fn reject_invalid(wf: &Workflow) -> ApiResult<()> {
    let problems = wf.validate();
    if problems.is_empty() {
        return Ok(());
    }
    Err(ApiError::bad_request(problems.join("; ")))
}
