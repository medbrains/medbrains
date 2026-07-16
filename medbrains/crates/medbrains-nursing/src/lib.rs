//! Nursing leaf crate: vitals recording, clinical nursing notes, shift handoff.

use axum::{Router, routing::{get,post,put}};
use medbrains_server_core::state::AppState;

pub mod nurse_clinical;
pub mod nurse_handoff;
pub mod nurse_vitals;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/nurse/vitals",
            post(nurse_vitals::create_vitals_reading),
        )
        .route(
            "/api/nurse/vitals/encounter/{encounter_id}",
            get(nurse_vitals::list_vitals_for_encounter),
        )
        .route(
            "/api/nurse/vitals-schedules",
            get(nurse_vitals::list_vitals_schedules)
                .post(nurse_vitals::create_vitals_schedule),
        )
        .route(
            "/api/nurse/vitals-schedules/{id}/end",
            put(nurse_vitals::end_vitals_schedule),
        )
        .route(
            "/api/nurse/io-entries",
            post(nurse_vitals::create_io_entry),
        )
        .route(
            "/api/nurse/io-entries/encounter/{encounter_id}",
            get(nurse_vitals::list_io_for_encounter),
        )
        .route(
            "/api/nurse/io-entries/encounter/{encounter_id}/balance",
            get(nurse_vitals::io_balance),
        )
        .route(
            "/api/nurse/pain-entries",
            post(nurse_vitals::create_pain_entry),
        )
        .route(
            "/api/nurse/pain-entries/encounter/{encounter_id}",
            get(nurse_vitals::list_pain_for_encounter),
        )
        .route(
            "/api/nurse/fall-risk",
            post(nurse_vitals::create_fall_risk),
        )
        .route(
            "/api/nurse/fall-risk/encounter/{encounter_id}",
            get(nurse_vitals::list_fall_risk_for_encounter),
        )
        .route(
            "/api/nurse/restraint-events",
            post(nurse_clinical::create_restraint_event),
        )
        .route(
            "/api/nurse/restraint-events/order/{restraint_order_id}",
            get(nurse_clinical::list_restraint_for_order),
        )
        .route(
            "/api/nurse/wounds",
            post(nurse_clinical::create_wound),
        )
        .route(
            "/api/nurse/wounds/encounter/{encounter_id}",
            get(nurse_clinical::list_wounds_for_encounter),
        )
        .route(
            "/api/nurse/handoffs",
            post(nurse_handoff::create_handoff),
        )
        .route(
            "/api/nurse/handoffs/{id}/accept",
            put(nurse_handoff::accept_handoff),
        )
        .route(
            "/api/nurse/handoffs/encounter/{encounter_id}",
            get(nurse_handoff::list_handoffs_for_encounter),
        )
        .route(
            "/api/nurse/code-blue",
            get(nurse_handoff::list_code_blue)
                .post(nurse_handoff::start_code_blue),
        )
        .route(
            "/api/nurse/code-blue/{id}/append",
            put(nurse_handoff::append_code_blue_entry),
        )
        .route(
            "/api/nurse/code-blue/{id}/end",
            put(nurse_handoff::end_code_blue),
        )
        .route(
            "/api/nurse/equipment-checks",
            get(nurse_handoff::list_equipment_checks)
                .post(nurse_handoff::create_equipment_check),
        )
}
