//! How a hospital lets its staff sign in — asked before anyone signs in.
//!
//! The sign-in screen starts with the hospital: its code, or the hospital's
//! own domain the page was opened on. The answer is that hospital's name and
//! its methods — its own identity providers ("Sign in with Microsoft") and
//! whether passwords are accepted — and nothing else: no users, no patients,
//! no other hospital's providers.

use axum::{
    Json,
    extract::{Query, State},
    http::HeaderMap,
};
use medbrains_server_core::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub(crate) struct SignInOptionsQuery {
    /// The hospital code the person typed (or the app's QR carried).
    pub(crate) code: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct IdentityProvider {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) protocol: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct SignInOptions {
    pub(crate) code: String,
    pub(crate) name: String,
    /// Username and password are accepted. When a hospital turns passwords
    /// off, its named break-glass admin still may — that path is not shown.
    pub(crate) password: bool,
    pub(crate) providers: Vec<IdentityProvider>,
}

/// `GET /api/auth/sign-in-options?code=AMH` — public. Without a code, the
/// hospital whose own domain the request came to, or `null` when the domain is
/// no hospital's, so the page asks for the code. A code naming no active
/// hospital is 404.
///
/// The no-code lookup runs on every visit to the sign-in page. Answering it
/// 404 was correct but put a failed request in every browser console on the
/// way in; "no hospital here" is an ordinary answer, not an error.
pub(crate) async fn sign_in_options(
    State(state): State<AppState>,
    Query(query): Query<SignInOptionsQuery>,
    headers: HeaderMap,
) -> Result<Json<Option<SignInOptions>>, AppError> {
    // An unknown code is "no such hospital"; a fault stays a fault, so an
    // outage never reads as a wrong code.
    let by_code = query.code.as_deref().is_some_and(|c| !c.trim().is_empty());
    let tenant_id =
        match crate::hospital::login_tenant(&state.db, query.code.as_deref(), &headers).await {
            Ok(Some(id)) => id,
            Ok(None) | Err(AppError::Unauthorized) if by_code => return Err(AppError::NotFound),
            Ok(None) | Err(AppError::Unauthorized) => return Ok(Json(None)),
            Err(other) => return Err(other),
        };
    let (code, name): (String, String) =
        sqlx::query_as("SELECT code, name FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_one(&state.db)
            .await?;
    // Providers and settings are row-level secured: read them as the hospital.
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    let providers = sqlx::query_as::<_, IdentityProvider>(
        "SELECT id, name, protocol FROM identity_providers \
          WHERE tenant_id = $1 AND is_active ORDER BY name",
    )
    .bind(tenant_id)
    .fetch_all(&mut *conn)
    .await?;
    let disabled: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'auth' AND key = 'password_login_disabled' \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?;
    let password_off =
        disabled.is_some_and(|v| v.as_bool() == Some(true) || v.as_str() == Some("true"));
    Ok(Json(Some(SignInOptions {
        code,
        name,
        password: !password_off,
        providers,
    })))
}
