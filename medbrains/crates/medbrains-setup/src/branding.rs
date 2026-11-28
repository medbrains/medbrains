//! Branding: the admin's settings (`/api/setup/branding`) and the hospital's
//! marks, its emblem, name banner and display name.
//!
//! `GET /api/branding/marks` serves only those three branding keys to every
//! staff role (`branding.view`), for the app header. The rest of the branding
//! settings stay behind `admin.settings.branding.manage`. The images are data
//! URLs the admin screen made in the browser, so the answer can be a few
//! hundred kilobytes: it carries an `ETag` and `Cache-Control: private,
//! max-age=300`, and a repeat request with a matching `If-None-Match` gets a
//! bodiless 304.

use std::hash::{Hash, Hasher};

use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Extension, Json};
use medbrains_core::onboarding::TenantSettings;
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_core::validation::{self, ValidationErrors};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The longest image a mark may be stored as: 200 KB of image is about 273 KB
/// of base64, plus the `data:` prefix.
pub(crate) const MAX_MARK_CHARS: usize = 280_000;

/// The image types a stored mark may be. No SVG: it can carry script.
const IMAGE_PREFIXES: [&str; 3] = [
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
];

/// What the header shows; `None` when the hospital has not set it.
#[derive(Debug, Serialize)]
pub(crate) struct BrandingMarks {
    pub(crate) display_name: Option<String>,
    pub(crate) emblem: Option<String>,
    pub(crate) name_banner: Option<String>,
}

/// The routes, merged into the setup router.
pub(crate) fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/branding/marks", get(get_marks))
        .route(
            "/api/setup/branding",
            get(get_branding).put(update_branding),
        )
}

/// Refuses a mark that is neither empty, an http(s) URL, nor a PNG, JPEG or
/// WebP data URL within [`MAX_MARK_CHARS`].
pub(crate) fn validate_mark(errors: &mut ValidationErrors, field: &str, value: &str) {
    let value = value.trim();
    if value.is_empty() || value.starts_with("https://") || value.starts_with("http://") {
        return;
    }
    if !IMAGE_PREFIXES
        .iter()
        .any(|prefix| value.starts_with(prefix))
    {
        errors.add(field, "Use a web address, or a PNG, JPEG or WebP image");
    } else if value.len() > MAX_MARK_CHARS {
        errors.add(field, "The image is too large: keep it under 200 KB");
    }
}

/// `GET /api/branding/marks`: the hospital's emblem, name banner and name.
async fn get_marks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::branding::VIEW)?;
    let mut tx = kernel::scoped_tx(&state.db, &permit, &claims.department_ids).await?;
    let rows = sqlx::query!(
        "SELECT key, value #>> '{}' AS text FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'branding' \
           AND key IN ('display_name', 'logo_url', 'name_banner_url') AND deleted_at IS NULL",
        claims.tenant_id
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let text = |key: &str| {
        rows.iter()
            .find(|row| row.key == key)
            .and_then(|row| row.text.as_deref().map(str::trim))
            .filter(|value| !value.is_empty() && value.len() <= MAX_MARK_CHARS)
            .map(ToOwned::to_owned)
    };
    let marks = BrandingMarks {
        display_name: text("display_name"),
        emblem: text("logo_url"),
        name_banner: text("name_banner_url"),
    };
    Ok(cached(&marks, &headers))
}

/// The marks with their `ETag`, or a bodiless 304 when the caller already
/// holds this version.
fn cached(marks: &BrandingMarks, headers: &HeaderMap) -> Response {
    let etag = etag_of(marks);
    let fresh = headers
        .get(header::IF_NONE_MATCH)
        .is_some_and(|sent| sent.as_bytes() == etag.as_bytes());
    let mut response = if fresh {
        StatusCode::NOT_MODIFIED.into_response()
    } else {
        Json(marks).into_response()
    };
    let out = response.headers_mut();
    out.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300"),
    );
    if let Ok(value) = HeaderValue::from_str(&etag) {
        out.insert(header::ETAG, value);
    }
    response
}

/// A strong validator for the marks.
///
/// `ponytail:` std's `DefaultHasher` is stable within one build of the server,
/// which is all an ETag needs; a restart onto a new Rust release costs each
/// browser one refetch.
fn etag_of(marks: &BrandingMarks) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    (&marks.display_name, &marks.emblem, &marks.name_banner).hash(&mut hasher);
    format!("\"{:016x}\"", hasher.finish())
}

/// `GET /api/setup/branding`: every branding row, for the admin screen.
pub(crate) async fn get_branding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TenantSettings>>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::branding::MANAGE)?;
    let mut tx = kernel::scoped_tx(&state.db, &permit, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, TenantSettings>(
        "SELECT * FROM tenant_settings WHERE tenant_id = $1 AND category = 'branding' \
         ORDER BY key LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

/// One branding key and its new value.
#[derive(Debug, Deserialize)]
pub(crate) struct UpdateBrandingRequest {
    pub(crate) key: String,
    pub(crate) value: Value,
}

/// Save one branding key; colours must be hex, and the emblem and name banner
/// a web address or a small PNG, JPEG or WebP image.
pub(crate) async fn update_branding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateBrandingRequest>,
) -> Result<Json<TenantSettings>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::branding::MANAGE)?;
    let mut errors = ValidationErrors::new();
    if (body.key == "primary_color" || body.key == "secondary_color")
        && let Some(color_str) = body.value.as_str()
    {
        validation::validate_hex_color(&mut errors, &body.key, color_str);
    }
    if let (key @ ("logo_url" | "name_banner_url"), Some(mark)) =
        (body.key.as_str(), body.value.as_str())
    {
        validate_mark(&mut errors, key, mark);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = kernel::scoped_tx(&state.db, &permit, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TenantSettings>(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'branding', $2, $3) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, \
                       deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.key)
    .bind(&body.value)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn errors_for(value: &str) -> bool {
        let mut errors = ValidationErrors::new();
        validate_mark(&mut errors, "logo_url", value);
        errors.has_errors()
    }

    #[test]
    fn a_mark_is_a_web_address_or_a_small_raster_image() {
        assert!(!errors_for(""));
        assert!(!errors_for("https://example.org/emblem.png"));
        assert!(!errors_for("data:image/webp;base64,AAAA"));
        assert!(errors_for("data:image/svg+xml;base64,AAAA"));
        assert!(errors_for("data:text/html;base64,AAAA"));
        assert!(errors_for("javascript:alert(1)"));
        let huge = format!("data:image/png;base64,{}", "A".repeat(MAX_MARK_CHARS));
        assert!(errors_for(&huge));
    }

    #[test]
    fn the_etag_changes_with_the_marks_and_answers_304_when_held() {
        let one = BrandingMarks {
            display_name: Some("A".into()),
            emblem: None,
            name_banner: None,
        };
        let two = BrandingMarks {
            display_name: Some("B".into()),
            emblem: None,
            name_banner: None,
        };
        assert_ne!(etag_of(&one), etag_of(&two));
        let mut headers = HeaderMap::new();
        headers.insert(
            header::IF_NONE_MATCH,
            HeaderValue::from_str(&etag_of(&one)).unwrap_or(HeaderValue::from_static("x")),
        );
        assert_eq!(cached(&one, &headers).status(), StatusCode::NOT_MODIFIED);
        assert_eq!(cached(&two, &headers).status(), StatusCode::OK);
    }
}
