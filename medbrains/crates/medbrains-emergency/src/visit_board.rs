//! The ER list's routes, who may read it, and the wait target of each triage
//! level.

use axum::routing::get;
use axum::{Extension, Json, extract::State};
use medbrains_core::er_wait_targets::{ER_WAIT_TARGETS, ErWaitTargets};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_any_permission;
use medbrains_server_core::state::AppState;

/// Any of these opens the ER list: it is the department's board, read by
/// everyone staffing it.
pub(crate) const BOARD_READ: [&str; 6] = [
    permissions::emergency::visits::LIST,
    permissions::emergency::visits::UPDATE,
    permissions::emergency::triage::LIST,
    permissions::emergency::triage::CREATE,
    permissions::emergency::resuscitation::LIST,
    permissions::emergency::resuscitation::CREATE,
];

/// GET /api/emergency/wait-targets: the door-to-doctor target, in minutes, of
/// each triage level, so the ER list can say "over target" in words. Read by
/// whoever may read the list.
pub async fn wait_targets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ErWaitTargets>, AppError> {
    require_any_permission(&claims, &BOARD_READ)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    Ok(Json(ER_WAIT_TARGETS))
}

/// The ER list (and the front door that adds to it) and its wait targets.
pub(crate) fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/emergency/visits",
            get(super::list_visits).post(super::create_visit),
        )
        .route("/api/emergency/wait-targets", get(wait_targets))
}
