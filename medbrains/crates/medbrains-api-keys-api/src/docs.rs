//! The API's own description, for the people integrating with it.
//!
//! `docs/openapi.json` is generated from the routers the server runs
//! (`scripts/generate_openapi.py`): every path, method and the permission it
//! requires. It is built into the binary, so what is served is the
//! description of the build that serves it.

use axum::{Extension, http::header, response::IntoResponse};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
};

const OPENAPI: &str = include_str!("../../../docs/openapi.json");

/// `GET /api/openapi.json`
pub(crate) async fn openapi(Extension(claims): Extension<Claims>) -> Result<impl IntoResponse, AppError> {
    require_permission(&claims, permissions::admin::api_keys::DOCS)?;
    Ok(([(header::CONTENT_TYPE, "application/json")], OPENAPI))
}
