//! Clinical scoring & bedside-calculator routes (`/api/clinical/*`).
//!
//! Stateless compute endpoints (NEWS2, SOFA, MELD, GCS, CURB-65, qSOFA, Wells,
//! CHA2DS2-VASc, HAS-BLED, CIWA-Ar, PEWS, MEOWS, CAM-ICU, CPOT, …). Extracted
//! from `medbrains-server` as a leaf domain crate; `medbrains-server` mounts
//! [`router`] under its main router.

use axum::{Router, routing::post};
use medbrains_server_core::state::AppState;

pub mod aldrete;
pub mod anion_gap;
pub mod cam_icu;
pub mod cha2ds2_vasc;
pub mod child_pugh;
pub mod ciwa_ar;
pub mod cpot;
pub mod curb65;
pub mod gcs;
pub mod glasgow_blatchford;
pub mod has_bled;
pub mod lung_protective;
pub mod meld;
pub mod meows;
pub mod news2;
pub mod osmolar_gap;
pub mod paediatric_fluid;
pub mod pews;
pub mod sepsis;
pub mod sofa;
pub mod wells_dvt;
pub mod wells_pe;

/// All `/api/clinical/*` scoring routes owned by this crate, mounted by `medbrains-server`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/clinical/news2", post(news2::news2_score))
        .route("/api/clinical/aldrete", post(aldrete::aldrete_score))
        .route("/api/clinical/gcs", post(gcs::gcs_score))
        .route("/api/clinical/sofa", post(sofa::sofa_score))
        .route("/api/clinical/meld", post(meld::meld_score))
        .route("/api/clinical/curb-65", post(curb65::curb65_score))
        .route("/api/clinical/anion-gap", post(anion_gap::anion_gap))
        .route("/api/clinical/osmolar-gap", post(osmolar_gap::osmolar_gap))
        .route("/api/clinical/qsofa", post(sepsis::qsofa_score))
        .route("/api/clinical/meows", post(meows::meows_score))
        .route("/api/clinical/pews", post(pews::pews_score))
        .route("/api/clinical/cam-icu", post(cam_icu::cam_icu_assessment))
        .route("/api/clinical/cpot", post(cpot::cpot_score))
        .route("/api/clinical/wells-pe", post(wells_pe::wells_pe_score))
        .route("/api/clinical/wells-dvt", post(wells_dvt::wells_dvt_score))
        .route("/api/clinical/cha2ds2-vasc", post(cha2ds2_vasc::cha2ds2_vasc_score))
        .route("/api/clinical/has-bled", post(has_bled::has_bled_score))
        .route("/api/clinical/ciwa-ar", post(ciwa_ar::ciwa_ar_score))
        .route("/api/clinical/child-pugh", post(child_pugh::child_pugh_score))
        .route(
            "/api/clinical/lung-protective",
            post(lung_protective::lung_protective),
        )
        .route(
            "/api/clinical/glasgow-blatchford",
            post(glasgow_blatchford::glasgow_blatchford_score),
        )
        .route(
            "/api/clinical/paediatric-fluid",
            post(paediatric_fluid::paediatric_fluid),
        )
}
