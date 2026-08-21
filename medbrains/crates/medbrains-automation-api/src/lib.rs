//! The HTTP surface for workflow automation.
//!
//! One router, mounted two ways.
//!
//! Nested into the `MedBrains` server, requests arrive already authenticated
//! and tenant-scoped by the middleware that guards every other route. Served
//! standalone, the same router sits behind the same auth layer applied by
//! `medbrains-automation-server`. Either way a handler receives `Claims` and
//! never has to know which deployment it is in — which is what stops the two
//! from drifting.
//!
//! Every route is permission-gated. Automation is a way to arrange things
//! `MedBrains` can already do, never a way to do more.

pub mod credentials;
pub mod executions;
pub mod state;
pub mod workflows;

use axum::Router;
use axum::routing::{get, post};

pub use state::AutomationState;

/// The automation routes, to be nested under a prefix by the caller.
///
/// The prefix is the caller's choice because the two deployments differ: the
/// embedded one nests this under `/api/automation`, and the standalone server
/// serves it at the root of its own port.
pub fn router() -> Router<AutomationState> {
    Router::new()
        .route("/node-types", get(workflows::node_types))
        .route("/credential-types", get(credentials::list_types))
        .route("/workflows", get(workflows::list).post(workflows::create))
        .route(
            "/workflows/{id}",
            get(workflows::get).patch(workflows::update).delete(workflows::delete),
        )
        .route("/workflows/{id}/activate", post(workflows::activate))
        .route("/workflows/{id}/run", post(workflows::run))
        .route("/credentials", get(credentials::list).post(credentials::create))
        .route(
            "/credentials/{id}",
            axum::routing::patch(credentials::update).delete(credentials::delete),
        )
        .route("/executions", get(executions::list))
        .route("/executions/{id}", get(executions::get).delete(executions::delete))
}
