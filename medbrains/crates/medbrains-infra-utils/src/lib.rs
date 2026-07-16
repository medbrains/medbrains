//! Infra utilities leaf crate: config import/export, schema registry, DLT
//! template registry, AEBAS attendance. Mounted via router().

use axum::{Router, routing::{get, post, put}};
use medbrains_server_core::state::AppState;

pub mod aebas;
pub mod config_transfer;
pub mod dlt;
pub mod schema_registry;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/setup/config-export",
            get(config_transfer::export_config),
        )
        .route(
            "/api/setup/config-import",
            post(config_transfer::import_config),
        )
        .route(
            "/api/schema/modules",
            get(schema_registry::list_modules),
        )
        .route(
            "/api/schema/modules/{code}/entities",
            get(schema_registry::list_module_entities),
        )
        .route(
            "/api/schema/events",
            get(schema_registry::list_event_schemas),
        )
        .route(
            "/api/schema/events/{event_type}",
            get(schema_registry::get_event_schema),
        )
        .route(
            "/api/communications/dlt-templates",
            get(dlt::list_templates).post(dlt::create_template),
        )
        .route(
            "/api/communications/dlt-templates/{id}",
            put(dlt::update_template).delete(dlt::delete_template),
        )
        .route("/api/aebas/status", get(aebas::status))
        .route(
            "/api/aebas/period-summary",
            post(aebas::import_period_summary),
        )
}
