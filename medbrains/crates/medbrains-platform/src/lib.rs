//! Platform leaf crate: integration hub, geo lookups, terminology, clinical
//! knowledge base, station registry + handoff. Mounted via router().

use axum::{Router, routing::{get, post, put}};
use medbrains_server_core::state::AppState;

pub mod ckb;
pub mod geo;
pub mod integration;
pub mod station_handoff;
pub mod stations;
pub mod terminology;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/geo/countries", get(geo::list_countries))
        .route(
            "/api/geo/countries/{id}/states",
            get(geo::list_states),
        )
        .route(
            "/api/geo/states/{id}/districts",
            get(geo::list_districts),
        )
        .route("/api/geo/regulators", get(geo::list_regulators))
        .route(
            "/api/geo/regulators/auto-detect",
            get(geo::auto_detect_regulators),
        )
        .route(
            "/api/geo/districts/{id}/subdistricts",
            get(geo::list_subdistricts),
        )
        .route(
            "/api/geo/subdistricts/{id}/towns",
            get(geo::list_towns),
        )
        .route(
            "/api/geo/pincode/{code}",
            get(geo::search_pincode),
        )
        .route(
            "/api/stations",
            get(stations::list_stations).post(stations::create_station),
        )
        .route(
            "/api/stations/{id}",
            put(stations::update_station).delete(stations::delete_station),
        )
        .route(
            "/api/terminology/search",
            get(terminology::search_terminology),
        )
        .route(
            "/api/terminology/search-with-suggestions",
            get(terminology::search_terminology_with_suggestions),
        )
        .route(
            "/api/terminology/lookup",
            get(terminology::lookup_terminology),
        )
        .route("/api/ckb/diagnoses", get(ckb::list_diagnoses))
        .route("/api/ckb/formulary", get(ckb::list_formulary))
        .route("/api/ckb/lab-reference", get(ckb::list_lab_reference))
        .route("/api/ckb/nlem-generics", get(ckb::list_nlem_generics))
        .route("/api/ckb/state-schemes", get(ckb::list_state_schemes))
        .route("/api/ckb/state-formulary", get(ckb::list_state_formulary))
        .route("/api/ckb/notifiable-reports", get(ckb::list_notifiable_reports))
        .route(
            "/api/ckb/notifiable-reports/{id}",
            put(ckb::update_notifiable_report),
        )
        .route(
            "/api/integration/default-pipelines",
            get(integration::list_default_pipelines),
        )
        .route(
            "/api/integration/default-pipelines/{event_type}",
            put(integration::set_default_pipeline_enabled),
        )
        .route(
            "/api/integration/pipelines",
            get(integration::list_pipelines).post(integration::create_pipeline),
        )
        .route(
            "/api/integration/pipelines/{id}",
            get(integration::get_pipeline)
                .put(integration::update_pipeline)
                .delete(integration::delete_pipeline),
        )
        .route(
            "/api/integration/pipelines/{id}/status",
            put(integration::update_pipeline_status),
        )
        .route(
            "/api/integration/pipelines/{id}/trigger",
            post(integration::trigger_pipeline),
        )
        .route(
            "/api/integration/pipelines/{id}/executions",
            get(integration::list_executions),
        )
        .route(
            "/api/integration/executions/{id}",
            get(integration::get_execution),
        )
        .route(
            "/api/integration/node-templates",
            get(integration::list_node_templates)
                .post(integration::create_node_template),
        )
        .route(
            "/api/station-handoffs",
            get(station_handoff::list_station_handoffs).post(station_handoff::create_station_handoff),
        )
        .route(
            "/api/station-handoffs/{id}/acknowledge",
            put(station_handoff::acknowledge_station_handoff),
        )
}
