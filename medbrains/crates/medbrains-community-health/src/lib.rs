//! Occupational health leaf crate (employee screenings, drug screens,
//! vaccinations, injuries, exposures, hazards). Mounted by medbrains-server.

use axum::{
    Router,
    routing::{get, post, put},
};
use medbrains_server_core::state::AppState;

pub mod occ_health;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/occ-health/screenings",
            get(occ_health::list_screenings).post(occ_health::create_screening),
        )
        .route(
            "/api/occ-health/screenings/due",
            get(occ_health::list_due_screenings),
        )
        .route(
            "/api/occ-health/screenings/{id}",
            get(occ_health::get_screening).put(occ_health::update_screening),
        )
        .route(
            "/api/occ-health/drug-screens",
            get(occ_health::list_drug_screens).post(occ_health::create_drug_screen),
        )
        .route(
            "/api/occ-health/drug-screens/{id}",
            put(occ_health::update_drug_screen),
        )
        .route(
            "/api/occ-health/vaccinations",
            get(occ_health::list_vaccinations).post(occ_health::create_vaccination),
        )
        .route(
            "/api/occ-health/vaccinations/{id}",
            put(occ_health::update_vaccination),
        )
        .route(
            "/api/occ-health/vaccinations/compliance",
            get(occ_health::vaccination_compliance),
        )
        .route(
            "/api/occ-health/injuries",
            get(occ_health::list_injuries).post(occ_health::create_injury),
        )
        .route(
            "/api/occ-health/injuries/{id}",
            put(occ_health::update_injury),
        )
        .route(
            "/api/occ-health/injuries/{id}/employer-view",
            get(occ_health::get_employer_view),
        )
        .route(
            "/api/occ-health/exposures",
            get(occ_health::list_exposures).post(occ_health::create_exposure),
        )
        .route(
            "/api/occ-health/hazards",
            get(occ_health::list_hazards).post(occ_health::create_hazard),
        )
        .route(
            "/api/occ-health/analytics",
            get(occ_health::health_analytics),
        )
        .route(
            "/api/occ-health/clearance",
            post(occ_health::return_to_work_clearance),
        )
}
