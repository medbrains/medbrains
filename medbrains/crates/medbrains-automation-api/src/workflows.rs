//! Workflow management.
//!
//! Building a workflow is gated on `automation.manage`; arming one is gated
//! separately on `automation.activate`, because activation is the moment a
//! workflow gains authority of its own.

use axum::extract::{Path, State};
use axum::{Extension, Json};
use medbrains_automation::RunAs;
use medbrains_automation::prelude::{ExecutionMode, NodeTypeDescription, Workflow};
use medbrains_automation_store::executions;
use medbrains_automation_store::workflows::{self, StoredWorkflow};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::state::AutomationState;

pub async fn node_types(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<NodeTypeDescription>>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;
    Ok(Json(state.automation.node_types()))
}

pub async fn list(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;

    let stored = workflows::list(&state.pool, claims.tenant_id).await.map_err(|error| store_error(&error))?;
    let listed: Vec<Value> = stored.iter().map(describe).collect();

    Ok(Json(json!(listed)))
}

pub async fn get(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::VIEW)?;

    let stored = workflows::find(&state.pool, claims.tenant_id, id)
        .await
        .map_err(|error| store_error(&error))?
        .ok_or(AppError::NotFound)?;

    Ok(Json(describe(&stored)))
}

pub async fn create(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Json(workflow): Json<Workflow>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;
    reject_invalid(&workflow)?;

    let id = workflows::insert(&state.pool, claims.tenant_id, claims.sub, &workflow)
        .await
        .map_err(|error| store_error(&error))?;

    tracing::info!(workflow = %workflow.name, tenant = %claims.tenant_id, "workflow created");
    Ok(Json(json!({ "id": id, "name": workflow.name, "active": false })))
}

pub async fn update(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(workflow): Json<Workflow>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;
    reject_invalid(&workflow)?;

    let affected = workflows::update(&state.pool, claims.tenant_id, id, &workflow)
        .await
        .map_err(|error| store_error(&error))?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }

    // Editing deactivates. The permissions were lent to the workflow somebody
    // reviewed, and a changed graph is not that workflow.
    Ok(Json(json!({ "id": id, "name": workflow.name, "active": false })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivatePayload {
    pub active: bool,
    /// What the workflow needs to be able to do. Bounded by what the person
    /// activating it holds.
    #[serde(default)]
    pub permissions: Vec<String>,
}

/// Arm or disarm a workflow.
///
/// Activation lends the workflow the caller's authority, so it is refused if
/// the caller asks for more than they hold. A workflow can therefore never
/// outrank the person who armed it.
pub async fn activate(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ActivatePayload>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::ACTIVATE)?;

    if !payload.active {
        let affected =
            workflows::deactivate(&state.pool, claims.tenant_id, id).await.map_err(|error| store_error(&error))?;
        if affected == 0 {
            return Err(AppError::NotFound);
        }
        tracing::info!(workflow = %id, tenant = %claims.tenant_id, "workflow deactivated");
        return Ok(Json(json!({ "id": id, "active": false })));
    }

    let stored = workflows::find(&state.pool, claims.tenant_id, id)
        .await
        .map_err(|error| store_error(&error))?
        .ok_or(AppError::NotFound)?;

    let run_as = RunAs::grant(
        claims.tenant_id,
        claims.sub,
        &held_by(&claims, &payload.permissions),
        &payload.permissions,
    )
    .map_err(|refused| AppError::ForbiddenReason(refused.to_string()))?;

    // Check the graph against the authority now, while somebody is watching,
    // rather than at 03:00 when the schedule fires.
    state
        .automation
        .check(&stored.workflow, &run_as)
        .map_err(|refused| AppError::ForbiddenReason(refused.to_string()))?;

    workflows::activate(&state.pool, id, &run_as).await.map_err(|error| store_error(&error))?;

    tracing::info!(
        workflow = %stored.workflow.name,
        tenant = %claims.tenant_id,
        activated_by = %claims.sub,
        permissions = payload.permissions.len(),
        "workflow activated"
    );

    Ok(Json(json!({ "id": id, "active": true, "runAs": run_as.permissions() })))
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPayload {
    #[serde(default)]
    pub input: Option<Vec<serde_json::Map<String, Value>>>,
}

/// Run a workflow by hand.
///
/// A manual run uses the caller's own authority rather than the workflow's
/// stored one: the person is present, so there is no reason to act through a
/// delegation, and an unactivated workflow stays testable.
pub async fn run(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    payload: Option<Json<RunPayload>>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::RUN)?;

    let stored = workflows::find(&state.pool, claims.tenant_id, id)
        .await
        .map_err(|error| store_error(&error))?
        .ok_or(AppError::NotFound)?;

    let caller = RunAs::restore(claims.tenant_id, Some(claims.sub), effective(&claims));
    let input = payload
        .map(|Json(payload)| payload.input.unwrap_or_default())
        .unwrap_or_default()
        .into_iter()
        .map(Value::Object)
        .collect::<Vec<_>>();
    let input = if input.is_empty() { vec![json!({})] } else { input };

    // Named before it runs, so a file the run downloads can be stored against
    // it and removed with it.
    let execution_id = Uuid::new_v4();
    let started_at = chrono::Utc::now();

    // Written down before the run, so a run that never finishes still leaves a
    // record. Without it a crash mid-run is invisible: the workflow ran, may
    // have written to the hospital, and the history shows nothing.
    executions::open(
        &state.pool,
        &executions::Opening {
            id: execution_id,
            tenant_id: claims.tenant_id,
            workflow_id: id,
            workflow_name: &stored.workflow.name,
            mode: "manual",
            started_at,
        },
    )
    .await
    .map_err(|error| store_error(&error))?;

    let result = state
        .automation
        .run_as_execution(
            &execution_id.to_string(),
            &stored.workflow,
            &caller,
            ExecutionMode::Manual,
            input,
        )
        .await;
    let duration = (chrono::Utc::now() - started_at).num_milliseconds();

    executions::record(
        &state.pool,
        &executions::Finished {
            id: execution_id,
            tenant_id: claims.tenant_id,
            workflow_id: id,
            workflow_name: &stored.workflow.name,
            mode: "manual",
            started_at,
            duration_ms: duration,
            result: &result,
            keep: state.retention,
        },
    )
    .await
    .map_err(|error| store_error(&error))?;

    Ok(Json(json!({ "executionId": execution_id, "result": result })))
}

pub async fn delete(
    State(state): State<AutomationState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::automation::MANAGE)?;

    match workflows::delete(&state.pool, claims.tenant_id, id).await.map_err(|error| store_error(&error))? {
        0 => Err(AppError::NotFound),
        _ => Ok(Json(json!({ "deleted": id }))),
    }
}

// ----------------------------------------------------------------- helpers

/// What the caller actually holds.
///
/// A bypass role passes every `require_permission` check, so its `permissions`
/// list is not the truth about what it can do. Treating it as such would make
/// an administrator unable to activate anything, which is the opposite of the
/// intent — so for those roles the requested set is taken as held.
fn held_by(claims: &Claims, requested: &[String]) -> Vec<String> {
    if is_bypass_role(claims) { requested.to_vec() } else { claims.permissions.clone() }
}

fn effective(claims: &Claims) -> Vec<String> {
    claims.permissions.clone()
}

fn describe(stored: &StoredWorkflow) -> Value {
    json!({
        "id": stored.workflow.id,
        "name": stored.workflow.name,
        "active": stored.workflow.active,
        "nodes": stored.workflow.nodes,
        "connections": stored.workflow.connections,
        "settings": stored.workflow.settings,
        "runAs": {
            "userId": stored.run_as.user_id,
            "permissions": stored.run_as.permissions(),
        },
        "createdAt": stored.created_at,
        "updatedAt": stored.updated_at,
    })
}

fn reject_invalid(workflow: &Workflow) -> Result<(), AppError> {
    let problems = workflow.validate();
    if problems.is_empty() {
        return Ok(());
    }
    Err(AppError::BadRequest(problems.join("; ")))
}

fn store_error(error: &medbrains_automation_store::StoreError) -> AppError {
    tracing::error!(%error, "automation store failed");
    AppError::Internal(error.to_string())
}
