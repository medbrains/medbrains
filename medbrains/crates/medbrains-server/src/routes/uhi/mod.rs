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
//! - `fees`        — what a consultation costs, and how a quote says it
//! - `teleconsult` — consultation (online or physical) search → booking
//! - `payment`     — paying online: the hold, its expiry
//! - `payment_events` — the payment link and the captured payment
//! - `labs`        — lab test search → request lab staff accept
//! - `requests`    — blood and ambulance search → pending request
//! - `queue`       — the staff screen that accepts or declines requests
//! - `outbox`      — the signed `on_*` answers

pub mod auth;
pub mod fees;
pub mod inbound;
pub mod keys;
pub mod labs;
pub mod outbox;
pub mod payment;
pub mod payment_events;
pub mod protocol;
pub mod queue;
pub mod requests;
pub mod settings;
pub mod slots;
pub mod teleconsult;

use axum::{Router, routing::post};

use crate::state::AppState;

/// Inbound UHI calls — public: each is authenticated by its signature and
/// names its hospital by its code in the path, never by a session.
pub fn public_router() -> Router<AppState> {
    Router::new().route("/api/uhi/hspa/{hospital}/{action}", post(inbound::receive))
}
