//! Clinical scoring & bedside-calculator routes (`/api/clinical/*`).
//!
//! Stateless compute endpoints (NEWS2, SOFA, MELD, GCS, CURB-65, Aldrete, …).
//! Extracted from `medbrains-server` as a leaf domain crate; `medbrains-server`
//! mounts [`router`] under its main router. More scores fold in over time.

use axum::{Router, routing::post};
use medbrains_server_core::state::AppState;

pub mod aldrete;
pub mod curb65;
pub mod gcs;
pub mod meld;
pub mod news2;
pub mod sofa;

/// All `/api/clinical/*` scoring routes owned by this crate, mounted by `medbrains-server`.
#[must_use]
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/clinical/news2", post(news2::news2_score))
        .route("/api/clinical/aldrete", post(aldrete::aldrete_score))
        .route("/api/clinical/gcs", post(gcs::gcs_score))
        .route("/api/clinical/sofa", post(sofa::sofa_score))
        .route("/api/clinical/meld", post(meld::meld_score))
        .route("/api/clinical/curb-65", post(curb65::curb65_score))
}
