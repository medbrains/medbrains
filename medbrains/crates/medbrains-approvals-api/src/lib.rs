//! HTTP surface for the central approvals platform.
//!
//! The only layer that knows about axum. Everything beneath — the controls,
//! the guarded writes, the plug traits — works without a web framework, which
//! is what lets the rule set be tested without starting one.
//!
//! Handlers here do four things and no more: read the caller's identity from
//! the verified claims, open a transaction with the tenant context set, hand
//! the work to the engine, and translate the result into a status code. Any
//! decision-making that appears in this file is decision-making in the wrong
//! place.

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{get, post},
};
use medbrains_approvals::{DecisionInput, EngineError, RaiseInput, Registry, raise_request};
use medbrains_approvals_core::Decision;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod catalog;
pub mod inbox;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/approvals/requests", get(list_requests).post(raise))
        .route("/api/approvals/requests/{id}", get(get_request))
        .route("/api/approvals/requests/{id}/decide", post(decide))
        .route(
            "/api/approvals/types",
            get(catalog::list_types).post(catalog::create_type),
        )
        .route("/api/approvals/types/{code}", get(catalog::get_type))
        .route("/api/approvals/inbox", get(inbox::awaiting_me))
        .route("/api/approvals/mine", get(inbox::raised_by_me))
}

// ── raising ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RaiseBody {
    /// The request type's code — `hr.leave`, `iam.access`.
    pub kind: String,
    pub reason: String,
    #[serde(default)]
    pub payload: serde_json::Value,
    /// Who the request concerns, when that is not the person raising it.
    #[serde(default)]
    pub on_behalf_of_id: Option<Uuid>,
    #[serde(default)]
    pub subject_type: Option<String>,
    #[serde(default)]
    pub subject_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct RaisedResponse {
    pub request_id: Uuid,
    pub steps: i32,
    /// How many people the first stage went to. Zero means an external or
    /// automatic stage, not an unassigned one — the engine refuses to create a
    /// human stage nobody can decide.
    pub awaiting: usize,
}

/// Raise a request.
///
/// # Errors
/// Whatever the engine refuses on: an unknown request type, a misconfigured
/// chain, a stage with no eligible approver, or a domain precondition.
pub async fn raise(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(body): Json<RaiseBody>,
) -> Result<Json<RaisedResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let input = RaiseInput {
        tenant_id: claims.tenant_id,
        kind: body.kind,
        // From the verified claims, never from the body. A requester the
        // caller can name is a requester the caller can impersonate, and the
        // whole segregation-of-duties rule rests on this field being true.
        requester_id: claims.sub,
        on_behalf_of_id: body.on_behalf_of_id,
        reason: body.reason,
        payload: body.payload,
        subject_type: body.subject_type,
        subject_id: body.subject_id,
    };

    let raised = raise_request(&mut tx, registry(&state), &input)
        .await
        .map_err(|error| to_app_error(&error))?;
    tx.commit().await?;

    Ok(Json(RaisedResponse {
        request_id: raised.request_id,
        steps: raised.steps,
        awaiting: raised.first_step_assignees.len(),
    }))
}

// ── deciding ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DecideBody {
    /// `approve`, `reject` or `abstain`.
    pub decision: String,
    #[serde(default)]
    pub note: Option<String>,
    /// Required where the stage demands a witness, and must not be the actor.
    #[serde(default)]
    pub witnessed_by: Option<Uuid>,
    /// The stage the client believed was live when it rendered the page.
    ///
    /// Supplied by the caller deliberately. Reading the current stage here
    /// instead would make every decision succeed against whatever the state
    /// happens to be by the time it arrives — which is the defect this
    /// platform exists to remove.
    pub expected_step_seq: i32,
}

#[derive(Debug, Serialize)]
pub struct DecidedResponse {
    pub status: String,
    /// Human-readable account of what the decision did — "1 of 2 approvals",
    /// "advanced to stage 2". The client should not have to reconstruct this.
    pub outcome: String,
    pub effect_applied: bool,
}

/// Record a decision on a request.
///
/// # Errors
/// 403 when a control refuses on authority grounds, 409 on a stale stage or a
/// closed request, 422 when a domain precondition fails.
pub async fn decide(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecideBody>,
) -> Result<Json<DecidedResponse>, AppError> {
    let decision = match body.decision.as_str() {
        "approve" => Decision::Approve,
        "reject" => Decision::Reject,
        "abstain" => Decision::Abstain,
        other => {
            return Err(AppError::BadRequest(format!(
                "'{other}' is not a decision; expected approve, reject or abstain"
            )));
        }
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let input = DecisionInput {
        tenant_id: claims.tenant_id,
        request_id: id,
        actor_id: claims.sub,
        actor_is_bypass_role: medbrains_server_core::middleware::authorization::is_bypass_role(
            &claims,
        ),
        decision,
        note: body.note,
        witnessed_by: body.witnessed_by,
        expected_step_seq: body.expected_step_seq,
    };

    let decided = medbrains_approvals::decide_request(&mut tx, registry(&state), &input)
        .await
        .map_err(|error| to_app_error(&error))?;
    tx.commit().await?;

    Ok(Json(DecidedResponse {
        status: decided.status,
        outcome: describe(decided.outcome),
        effect_applied: decided.effect_applied,
    }))
}

fn describe(outcome: medbrains_approvals_core::Outcome) -> String {
    use medbrains_approvals_core::Outcome;
    match outcome {
        Outcome::AwaitingQuorum { have, need } => {
            format!("recorded — {have} of {need} approvals on this stage")
        }
        Outcome::AdvanceToNextStep => "stage complete, moved to the next".to_owned(),
        Outcome::RequestApproved => "approved".to_owned(),
        Outcome::RequestRejected => "rejected".to_owned(),
        Outcome::Recorded => "recorded".to_owned(),
    }
}

// ── reading ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

/// # Errors
/// Database errors.
pub async fn list_requests(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<inbox::RequestSummary>>, AppError> {
    inbox::list(&state, &claims, &query).await.map(Json)
}

/// # Errors
/// 404 when the request does not exist in this tenant.
pub async fn get_request(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<inbox::RequestDetail>, AppError> {
    inbox::detail(&state, &claims, id).await.map(Json)
}

// ── plumbing ────────────────────────────────────────────────────────────────

/// The handler registry assembled at startup.
///
/// Not yet threaded through `AppState`; until the composition root registers
/// domain effects, every request type is config-only, which is exactly the
/// tier-0 case the platform is designed to serve first.
pub(crate) fn registry_for(state: &AppState) -> &'static Registry {
    registry(state)
}

fn registry(_state: &AppState) -> &'static Registry {
    static EMPTY: std::sync::OnceLock<Registry> = std::sync::OnceLock::new();
    EMPTY.get_or_init(Registry::new)
}

/// Map an engine failure onto the response it deserves.
///
/// The engine already decided the status code — see `EngineError::http_status`
/// — because the authority-versus-state distinction belongs with the rules,
/// not with the transport. An authority failure carries no detail: somebody
/// with no business with a request must not learn from the error whether it
/// exists.
fn to_app_error(error: &EngineError) -> AppError {
    match error.http_status() {
        403 => AppError::Forbidden,
        // `NotFound` carries no message here, which suits it: telling a
        // caller *which* request is missing confirms the ones that exist.
        404 => AppError::NotFound,
        409 => AppError::Conflict(error.to_string()),
        422 | 400 => AppError::BadRequest(error.to_string()),
        _ => {
            // Unregistered effects and database failures are ours, not the
            // caller's, and the detail belongs in the log rather than the body.
            tracing::error!(error = %error, "approvals engine failure");
            AppError::Internal(error.to_string())
        }
    }
}
