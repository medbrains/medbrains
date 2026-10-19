//! ABDM Milestone 3 — this hospital as a Health Information User (HIU):
//! our doctors see a patient's records from other facilities, with the
//! patient's consent.
//!
//! - `requests`  — a doctor raises a consent request.
//! - `callbacks` — the gateway's on-init, notify, on-fetch and on-request.
//! - `keys`      — the Fidelius key pair per health-information request, sealed.
//! - `push`      — the HIP's data push: decrypt, verify, store, notify ABDM.
//! - `purge`     — erasing copies on revocation, expiry and `dataEraseAt`.
//! - `scope`     — what a consent allows, checked without a database.
//! - `view`      — the staff screens: requests and received records.
//!
//! Our HIU ID is the main campus's HFR facility ID, the same one records
//! are shared as (M2).

pub mod callbacks;
pub mod keys;
pub mod purge;
pub mod push;
pub mod requests;
pub mod scope;
pub mod view;

use axum::{Router, extract::DefaultBodyLimit, routing::post};
use medbrains_abdm::gateway as paths;

use crate::state::AppState;

/// A pushed page carries up to 100 encrypted bundles, reports and scans
/// included; larger than the default JSON limit.
const PUSH_BODY_LIMIT: usize = 32 * 1024 * 1024;

/// The gateway's HIU callbacks and the HIPs' data push — public: callbacks
/// are authenticated by the gateway's JWT and `X-HIU-ID`, the push by the
/// artefact it names, its transaction and our key (see `push`).
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route(paths::CB_HIU_CONSENT_ON_INIT, post(callbacks::on_init))
        .route(paths::CB_HIU_CONSENT_NOTIFY, post(callbacks::notify))
        .route(paths::CB_HIU_CONSENT_ON_FETCH, post(callbacks::on_fetch))
        .route(paths::CB_HIU_HI_ON_REQUEST, post(callbacks::on_request))
        .route(
            paths::HIU_DATA_PUSH_PATH,
            post(push::receive).layer(DefaultBodyLimit::max(PUSH_BODY_LIMIT)),
        )
}
