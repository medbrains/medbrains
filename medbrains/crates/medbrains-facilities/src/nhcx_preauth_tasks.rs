//! NHCX Tasks about a pre-authorisation.
//!
//! Where it stands (`hcx/status`, under `insurance.nhcx.submit`) and, under
//! `insurance.nhcx.cancel_preauth`, withdrawing it. The Task machinery is
//! shared with claims in `nhcx_tasks`.

use axum::extract::{Extension, Path, State};
use axum::routing::post;
use axum::{Json, Router};
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::nhcx::NhcxOperation;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

use crate::nhcx_common::Tx;
use crate::nhcx_task_bundle::TaskAsk;
use crate::nhcx_tasks::{
    ClaimTaskRequest, PREAUTH_SUBJECT, Subject, TaskSpec, begin, queue_task, reason,
    require_permission, sent_call, sent_to, subject,
};

/// The pre-authorisation Task routes, mounted by the crate router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/insurance/prior-auths/{id}/nhcx/status",
            post(preauth_status),
        )
        .route(
            "/api/insurance/prior-auths/{id}/nhcx/cancel",
            post(cancel_preauth),
        )
}

/// Load and lock the pre-authorisation, then check the caller may see its
/// patient's billing.
async fn locked_preauth(
    tx: &mut Tx<'_>,
    (state, claims): (&AppState, &Claims),
    id: Uuid,
) -> Result<Subject, AppError> {
    let s = subject(tx, PREAUTH_SUBJECT, claims.tenant_id, id).await?;
    medbrains_authz_gate::require_patient_billing_access(state, claims, s.patient_id).await?;
    Ok(s)
}

/// `POST /api/insurance/prior-auths/{id}/nhcx/status` — ask the payer
/// where the pre-authorisation stands.
///
/// # Errors
/// As [`crate::nhcx_tasks::claim_status`], for a pre-authorisation.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn preauth_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let mut tx = begin(&state, &claims).await?;
    let s = locked_preauth(&mut tx, (&state, &claims), id).await?;
    let spec = TaskSpec {
        ask: TaskAsk::Status {
            checks: sent_call(&s)?,
        },
        operation: NhcxOperation::Status,
        claim_id: None,
        prior_auth_id: Some(s.id),
        recipient: sent_to(&s)?,
        request: json!({}),
    };
    let queued = queue_task(&mut tx, &claims, &spec).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

/// `POST /api/insurance/prior-auths/{id}/nhcx/cancel` — withdraw a pre-auth:
/// a `cancel` Task under PC01; the payer's PC02 marks it cancelled.
///
/// # Errors
/// 403 without `insurance.nhcx.cancel_preauth`; 409 for one never sent or
/// already closed; otherwise as [`crate::nhcx_tasks::cancel_claim`].
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn cancel_preauth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ClaimTaskRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::CANCEL_PREAUTH)?;
    let why = reason(&body.reason)?;
    let mut tx = begin(&state, &claims).await?;
    let s = locked_preauth(&mut tx, (&state, &claims), id).await?;
    // Nothing left for the payer to withdraw.
    if matches!(s.status.as_str(), "cancelled" | "denied" | "expired") {
        return Err(AppError::Conflict(format!(
            "the pre-auth is {}; there is nothing left to cancel",
            s.status
        )));
    }
    let spec = TaskSpec {
        ask: TaskAsk::Cancel {
            focus: s.id,
            number: &s.number,
            reason: why,
        },
        operation: NhcxOperation::Cancel,
        claim_id: None,
        prior_auth_id: Some(s.id),
        recipient: sent_to(&s)?,
        request: json!({ "reason": why }),
    };
    let queued = queue_task(&mut tx, &claims, &spec).await?;
    tx.commit().await?;
    Ok(Json(queued))
}
