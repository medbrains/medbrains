//! MedBrains Flow, Phase 0 (#4901; `docs/research-crowd-flow-2026-10.md`).
//!
//! A live crowd and wait view of the building, built from what the hospital
//! already records: token queues, appointment check-ins, visitor passes and
//! duty rosters. No sensors and no identities: a background pass turns those
//! into one aggregate row per zone per minute (`flow_zone_minute`), and every
//! screen reads those rows. Nothing here writes to a clinical table.
//!
//! A licensed add-on: every route passes `require_module_enabled("flow")`
//! after its permission check, and bypass roles do not bypass the licence.

pub mod actions;
pub mod aggregate;
pub mod config;
pub mod forecast;
pub mod live;
pub mod model;
pub mod queries;

use axum::routing::{get, post, put};
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission, entitlement},
    state::AppState,
};

/// `module_config` code of the add-on.
pub const MODULE: &str = "flow";
/// The hospital's clock. [inferred] One country today; a tenant time-zone
/// setting replaces this constant when a second one arrives.
pub const LOCAL_TZ: &str = "Asia/Kolkata";

/// The transaction every handler runs in.
pub type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// A transaction with the caller's tenant set for row-level security.
pub async fn begin<'a>(state: &'a AppState, claims: &Claims) -> Result<Tx<'a>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// The permission, then the licence. Both must pass.
pub async fn gate(state: &AppState, claims: &Claims, permission: &str) -> Result<(), AppError> {
    require_permission(claims, permission)?;
    entitlement::require_module_enabled(&state.db, claims.tenant_id, MODULE).await
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/flow/floors", get(live::list_floors))
        .route("/api/flow/floors/{id}/live", get(live::floor_live))
        .route(
            "/api/flow/floors/{id}/history",
            get(forecast::floor_history),
        )
        .route(
            "/api/flow/floors/{id}/forecast",
            get(forecast::floor_forecast),
        )
        .route("/api/flow/zones/{id}", get(live::zone_detail))
        .route("/api/flow/board", get(live::board))
        .route(
            "/api/flow/recommendations/{id}/decide",
            post(actions::decide_recommendation),
        )
        .route("/api/flow/alerts/{id}/ack", post(actions::ack_alert))
        .route("/api/flow/config/floors", get(config::list_config_floors))
        .route(
            "/api/flow/config/floors/{id}/zones",
            get(config::list_config_zones),
        )
        .route("/api/flow/config/zones/{id}", put(config::update_zone))
        .route(
            "/api/flow/config/zones/{id}/sources",
            put(config::replace_sources),
        )
}
