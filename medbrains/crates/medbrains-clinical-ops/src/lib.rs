//! Stateful clinical operations routes (`/api/clinical/*`) — nutrition screening,
//! hypoglycemia events, sepsis bundles, medication reconciliation.
//!
//! Leaf domain crate (RFC-SERVER-CRATE-SPLIT); `medbrains-server` mounts [`router`].

use axum::{
    Router,
    routing::{get, patch, post},
};
use medbrains_server_core::state::AppState;

pub mod hypoglycemia;
pub mod med_reconciliation;
pub mod nutrition_screening;
pub mod sepsis_bundle;

/// All stateful `/api/clinical/*` routes owned by this crate, mounted by `medbrains-server`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/clinical/nutrition-screening",
            post(nutrition_screening::create_nutrition_screening),
        )
        .route(
            "/api/clinical/nutrition-screenings",
            get(nutrition_screening::list_nutrition_screenings),
        )
        .route(
            "/api/clinical/hypoglycemia-event",
            post(hypoglycemia::create_hypoglycemia_event),
        )
        .route(
            "/api/clinical/hypoglycemia-event/{id}/recheck",
            patch(hypoglycemia::recheck_hypoglycemia_event),
        )
        .route(
            "/api/clinical/hypoglycemia-events",
            get(hypoglycemia::list_hypoglycemia_events),
        )
        .route(
            "/api/clinical/sepsis-bundle",
            post(sepsis_bundle::create_sepsis_bundle),
        )
        .route(
            "/api/clinical/sepsis-bundle/{id}",
            patch(sepsis_bundle::update_sepsis_bundle),
        )
        .route(
            "/api/clinical/sepsis-bundles",
            get(sepsis_bundle::list_sepsis_bundles),
        )
        .route(
            "/api/clinical/med-reconciliation",
            post(med_reconciliation::create_med_reconciliation),
        )
        .route(
            "/api/clinical/med-reconciliation-item/{id}",
            patch(med_reconciliation::decide_med_item),
        )
        .route(
            "/api/clinical/med-reconciliation/{id}/complete",
            post(med_reconciliation::complete_med_reconciliation),
        )
        .route(
            "/api/clinical/med-reconciliations",
            get(med_reconciliation::list_med_reconciliations),
        )
}
