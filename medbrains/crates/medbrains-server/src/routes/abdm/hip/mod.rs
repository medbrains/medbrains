//! ABDM Milestone 2 — this hospital as a Health Information Provider (HIP).
//!
//! - `gateway`   — the signed-in gateway client for one hospital, and the
//!   authentication every gateway callback goes through.
//! - `linking`   — HIP-initiated linking: link token, then link.
//! - `link_callbacks` — the gateway's `on_*` answers to that linking.
//! - `discovery` — user-initiated discovery and linking (PHR app → us).
//! - `consent`   — consent notifications and health-information requests.
//! - `bundles`   — the NRCeS FHIR bundles a transfer carries.
//! - `records`   — the staff screens: a patient's ABDM records, sharing totals.
//! - `outbox`    — the outbox handler that links a newly captured record.
//!
//! Care contexts are captured by a database trigger when a record is
//! finalised (migration 1110), so no save path can forget to.

pub mod bundles;
pub mod consent;
pub mod discovery;
pub mod gateway;
pub mod link_callbacks;
pub mod linking;
pub mod outbox;
pub mod records;

use axum::{Router, routing::post};
use medbrains_abdm::gateway as paths;

use crate::state::AppState;

/// The gateway's callbacks — public: each one is authenticated by the
/// gateway's JWT and names its hospital by `X-HIP-ID`, never by a session.
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route(
            paths::CB_ON_GENERATE_TOKEN,
            post(link_callbacks::on_generate_token),
        )
        .route(
            paths::CB_ON_LINK_CARE_CONTEXT,
            post(link_callbacks::on_link_care_context),
        )
        .route(paths::CB_DISCOVER, post(discovery::discover))
        .route(paths::CB_LINK_INIT, post(discovery::link_init))
        .route(paths::CB_LINK_CONFIRM, post(discovery::link_confirm))
        .route(paths::CB_CONSENT_NOTIFY, post(consent::notify))
        .route(
            paths::CB_HI_REQUEST,
            post(consent::health_information_request),
        )
}
