//! The scan-and-share routes, kept out of `routes/mod.rs`'s build_router.

use axum::{
    Router,
    routing::{get, post},
};

use super::scan_share::{complete, counters, dismiss, queue, verification};
use crate::state::AppState;

/// The front desk's scan-and-share routes: the counters' QR codes, the queue
/// of shared profiles, and verifying, completing or dismissing one. Behind
/// the signed-in session; each handler checks its own permission.
pub fn staff_router() -> Router<AppState> {
    Router::new()
        .route("/api/abdm/scan-share/counters", get(counters))
        .route("/api/abdm/scan-share/queue", get(queue))
        .route("/api/abdm/scan-share/{id}/verification", post(verification))
        .route("/api/abdm/scan-share/{id}/complete", post(complete))
        .route("/api/abdm/scan-share/{id}/dismiss", post(dismiss))
}
