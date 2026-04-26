use axum::{extract::Request, http::Method, middleware::Next, response::Response};

use crate::{error::AppError, middleware::auth::AuthMethod};

/// CSRF double-submit validation middleware.
///
/// Skips for safe HTTP methods (GET, HEAD, OPTIONS) and for Bearer-authenticated
/// requests (mobile/API clients). For cookie-authenticated mutations, validates
/// that the `csrf_token` cookie matches the `X-CSRF-Token` header.
pub async fn csrf_middleware(request: Request, next: Next) -> Result<Response, AppError> {
    let method = request.method().clone();

    // Safe methods don't need CSRF protection
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        return Ok(next.run(request).await);
    }

    // Bearer-authenticated requests (mobile/API) skip CSRF
    if let Some(auth_method) = request.extensions().get::<AuthMethod>() {
        if matches!(auth_method, AuthMethod::Bearer) {
            return Ok(next.run(request).await);
        }
    }

    // For cookie-authenticated mutations: validate double-submit
    let cookie_header = request
        .headers()
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let csrf_cookie = parse_cookie_value(cookie_header, "csrf_token");
    let csrf_header = request
        .headers()
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok());

    match (csrf_cookie, csrf_header) {
        (Some(cookie_val), Some(header_val)) if cookie_val == header_val => {
            Ok(next.run(request).await)
        }
        _ => {
            tracing::warn!("CSRF validation failed");
            Err(AppError::Forbidden)
        }
    }
}

/// Parse a specific cookie value from the raw `Cookie` header string.
fn parse_cookie_value<'a>(header: &'a str, name: &str) -> Option<&'a str> {
    for pair in header.split(';') {
        let trimmed = pair.trim();
        if let Some(val) = trimmed.strip_prefix(name) {
            if let Some(val) = val.strip_prefix('=') {
                return Some(val.trim());
            }
        }
    }
    None
}
