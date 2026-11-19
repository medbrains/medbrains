//! UHI (Unified Health Interface) — this hospital as a Health Service
//! Provider App (HSPA): patient apps find and book its teleconsultations,
//! visits, lab tests, ambulances and blood availability through NHA's
//! gateway.
//!
//! - `protocol`    — domains, actions, context, ACK/NACK
//! - `auth`        — signature checks, registry lookup, the gateway address
//! - `settings`    — subscriber, services, gateway contract (Settings → UHI)
//! - `keys`        — the signing key pair, generated or imported
//! - `inbound`     — the public endpoint every UHI call arrives at
//! - `slots`       — open consultation slots from real schedules
//! - `slot_ids`    — slot UUIDs and the holds `init` places
//! - `fees`        — what a consultation costs, and how a quote says it
//! - `teleconsult` — consultation (online or physical) init → booking
//! - `consult_search` — consultation search: doctors, then their slots
//! - `consultation` — the physical consultation's terms, hold and PIN
//! - `payment`     — paying online: the hold, its expiry
//! - `payment_events` — the payment link and the captured payment
//! - `labs`        — lab test search → request lab staff accept
//! - `requests`    — blood and ambulance search → pending request
//! - `queue`       — the staff screen that accepts or declines requests
//! - `queue_row`   — one row of the requests screen and its view
//! - `outbox`      — the signed `on_*` answers

pub mod auth;
pub mod consult_search;
pub mod consultation;
pub mod fees;
pub mod inbound;
pub mod keys;
pub mod labs;
pub mod outbox;
pub mod payment;
pub mod payment_events;
pub mod protocol;
pub mod queue;
mod queue_row;
pub mod requests;
pub mod settings;
pub mod slot_ids;
pub mod slots;
pub mod teleconsult;

use axum::{
    Router,
    routing::{get, post},
};

use crate::state::AppState;

/// Inbound UHI calls — public: each is authenticated by its signature and
/// names its hospital by its code in the path, never by a session.
pub fn public_router() -> Router<AppState> {
    Router::new().route("/api/uhi/hspa/{hospital}/{action}", post(inbound::receive))
}

/// The staff side: settings, keys and the request queue, behind sign-in.
/// Kept here so the UHI surface reads in one place, not in the top router.
pub fn staff_router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/uhi/settings",
            get(settings::get_settings).put(settings::save_settings),
        )
        .route("/api/uhi/settings/keys", post(keys::generate_keys))
        .route("/api/uhi/requests", get(queue::list))
        .route("/api/uhi/requests/{id}/accept", post(queue::accept))
        .route("/api/uhi/requests/{id}/decline", post(queue::decline))
        .route(
            "/api/uhi/requests/{id}/check-pin",
            post(consultation::check_pin),
        )
}
