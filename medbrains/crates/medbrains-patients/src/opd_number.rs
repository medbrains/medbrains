//! The hospital OPD number at the desk, over HTTP.
//!
//! The policy screen and the previous and next number the registration form
//! shows. The rules live in `medbrains_server_services::opd_number`; this is HTTP.

use axum::extract::State;
use axum::routing::{get, put};
use axum::{Extension, Json};
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_services::opd_number::{self, Policy};
use serde::Serialize;

/// The policy and the numbers the form shows beside the field.
#[derive(Debug, Serialize)]
pub struct OpdNumberView {
    #[serde(flatten)]
    pub policy: Policy,
    /// The last number used, formatted; `None` before the first.
    pub previous: Option<String>,
    /// The number to fill in, formatted.
    pub next: String,
}

/// The routes, merged into the patients router.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/registration/opd-number", get(get_opd_number))
        .route("/api/registration/opd-number/policy", put(update_policy))
}

/// Read the policy and the previous and next number in the caller's transaction.
async fn view(state: &AppState, permit: &kernel::Permit) -> Result<OpdNumberView, AppError> {
    let mut tx = kernel::actor_tx(&state.db, permit, None).await?;
    let policy = opd_number::read_policy(&mut tx, permit.tenant_id()).await?;
    let suggestion = opd_number::suggest(&mut tx, permit.tenant_id(), &policy).await?;
    tx.commit().await?;
    Ok(OpdNumberView {
        previous: suggestion.previous.map(|n| policy.format(n)),
        next: policy.format(suggestion.next),
        policy,
    })
}

/// `GET /api/registration/opd-number`: whoever registers a patient or starts a
/// visit sees the policy and the previous and next number. Numbers only.
pub async fn get_opd_number(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OpdNumberView>, AppError> {
    let permit = kernel::authz::permit_any(
        &claims,
        &[
            permissions::patients::CREATE,
            permissions::opd::visit::CREATE,
        ],
    )?;
    Ok(Json(view(&state, &permit).await?))
}

/// `PUT /api/registration/opd-number/policy`: the hospital's own setting.
pub async fn update_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(policy): Json<Policy>,
) -> Result<Json<OpdNumberView>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = kernel::actor_tx(&state.db, &permit, None).await?;
    opd_number::write_policy(&mut tx, claims.tenant_id, &policy).await?;
    tx.commit().await?;
    Ok(Json(view(&state, &permit).await?))
}
