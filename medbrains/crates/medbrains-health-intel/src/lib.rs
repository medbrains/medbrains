//! Health intelligence (RFC-OSINT §4, phase 2 "Health I"): the hospital's own
//! notifiable-disease counts against its usual, public outbreak notices for
//! its region, and server-side weather and air-quality advisories — each with
//! a heartbeat, so a stopped feed or recompute is an alert, never "all clear".
//!
//! Aggregate only: no patient identity leaves this crate, and counts of 1–4
//! are shown as "fewer than 5".

pub mod baseline;
pub mod environment;
pub mod job;
pub mod routes;
pub mod status;

use axum::routing::get;
use medbrains_server_core::state::AppState;

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/health-intel", get(routes::get_health_intel))
        .route(
            "/api/health-intel/environment",
            get(routes::get_health_environment),
        )
}
