//! AI notes from dictation, slice 1: OPD consultation, doctor's voice only
//! (`RFCs/modules/RFC-MODULE-ai-dictation.md`).
//!
//! The doctor records or uploads; [`stt`] transcribes on the hospital's own
//! machine; [`structure`] drafts the consultation note with the local model
//! through the AI layer's redaction; the doctor accepts, edits or rejects
//! each section and saves through the normal clinical-notes path; [`review`]
//! logs every decision and deletes the recording, and [`purge`] deletes any
//! recording left unsaved for 24 hours. A documentation aid: the doctor
//! decides, nothing is filed automatically, and drafted medicines reach a
//! prescription only through the prescription screen and its safety checks.

pub mod address;
pub mod process;
pub mod purge;
pub mod review;
pub mod session;
pub mod settings;
pub mod structure;
pub mod stt;
pub mod view;

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use medbrains_server_core::state::AppState;

/// The dictation routes. Each handler checks its own permission.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/opd/encounters/{id}/dictations",
            post(session::create_dictation).layer(DefaultBodyLimit::max(session::MAX_AUDIO_BYTES)),
        )
        .route(
            "/api/opd/dictations/{id}/retry",
            post(session::retry_dictation),
        )
        .route(
            "/api/opd/dictations/{id}/review",
            post(review::review_dictation),
        )
        .route(
            "/api/admin/dictation/settings",
            get(settings::get_settings).put(settings::save_settings),
        )
}
