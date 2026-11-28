//! Which refresh token a refresh request carries, and whether a browser sent
//! it from somewhere other than this app.

use axum::Json;
use axum::http::HeaderMap;
use axum_extra::extract::CookieJar;
use medbrains_server_core::error::AppError;

use crate::RefreshRequestBody;

/// The refresh token a request carries: the cookie, or (native apps) the JSON body.
///
/// A cookie refresh that the browser marks as sent from another origin
/// (`Sec-Fetch-Site` other than `same-origin` or `none`) is refused. Refresh
/// cannot use the CSRF double-submit the rest of the API uses: the
/// `csrf_token` cookie expires with the access token, which is exactly when a
/// refresh is asked for. `SameSite=Lax` keeps the cookie off cross-site
/// requests, but another origin on the same site (a sibling subdomain) still
/// gets it sent; without this check a page there could rotate a signed-in
/// person's session, and two such requests at once trip reuse detection and
/// sign them out. A request without the header (a non-browser client, an older
/// browser) is not refused here; `SameSite=Lax` still applies to it.
///
/// # Errors
/// 403 for a cookie refresh from another origin; 401 when there is no token.
pub(crate) fn refresh_token_of(
    jar: &CookieJar,
    headers: &HeaderMap,
    body: Option<Json<RefreshRequestBody>>,
) -> Result<String, AppError> {
    if let Some(cookie) = jar.get("refresh_token") {
        if is_from_another_origin(headers) {
            tracing::warn!("cookie refresh from another origin refused");
            return Err(AppError::Forbidden);
        }
        return Ok(cookie.value().to_owned());
    }
    body.and_then(|Json(b)| b.refresh_token)
        .ok_or(AppError::Unauthorized)
}

/// Whether the browser says the request was started by another origin.
fn is_from_another_origin(headers: &HeaderMap) -> bool {
    headers
        .get("sec-fetch-site")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|site| !matches!(site, "same-origin" | "none"))
}
