//! UHI (Unified Health Interface) — this hospital as a Health Service
//! Provider App (HSPA): patient apps find and book its teleconsultations,
//! ambulances and blood availability through NHA's gateway.
//!
//! - `protocol`    — domains, actions, context, ACK/NACK
//! - `auth`        — signature checks, registry lookup, the gateway address
//! - `settings`    — subscriber, signing key, services (Settings → UHI)
//! - `inbound`     — the public endpoint every UHI call arrives at
//! - `slots`       — open teleconsultation slots from real schedules
//! - `teleconsult` — teleconsultation search → booking
//! - `requests`    — blood and ambulance search → pending request
//! - `queue`       — the staff screen that accepts or declines requests
//! - `outbox`      — the signed `on_*` answers

pub mod auth;
pub mod inbound;
pub mod outbox;
pub mod protocol;
pub mod queue;
pub mod requests;
pub mod settings;
pub mod slots;
pub mod teleconsult;

use axum::{Router, routing::post};

use crate::state::AppState;

/// Inbound UHI calls — public: each is authenticated by its signature and
/// names its hospital by the subscriber ID in the path, never by a session.
pub fn public_router() -> Router<AppState> {
    Router::new().route(
        "/api/uhi/hspa/{subscriber_id}/{action}",
        post(inbound::receive),
    )
}
