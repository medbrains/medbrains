//! Access manifest API — runtime view of the access tables defined in
//! `medbrains_core::access`.
//!
//! The frontend calls `GET /api/access/manifest` once at login and
//! caches the result. Drives the user-create drawer's role/group
//! selectors, the screen registry, and the sharing-scope picker
//! without the frontend needing hand-mirrored constants.

use axum::{Extension, Json, extract::State};

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

pub async fn get_manifest(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<medbrains_core::access::AccessManifest>, AppError> {
    // Any authenticated user can read the manifest — it's metadata,
    // not PHI. The `_perms` block on the frontend is computed against
    // the user's claims, not exposed here.
    Ok(Json(medbrains_core::access::build_manifest()))
}
