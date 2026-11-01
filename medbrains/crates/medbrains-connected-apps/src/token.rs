//! `POST /api/oauth/token` — OAuth 2.0 client credentials (RFC 6749 §4.4),
//! the SMART Backend Services shape.
//!
//! The client authenticates with `client_secret_basic` or `client_secret_post`
//! and receives a bearer token that lives [`TOKEN_MINUTES`] minutes. The token
//! is an `api_keys` row tied to the app: its permissions are the app's grant
//! (or a subset the app asked for with `scope`), its identity is the app's
//! service account, and it is verified, rate limited and logged on every
//! request like every other machine credential.

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::middleware::from_fn_with_state;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Form, Json, Router};
use base64::Engine as _;
use chrono::{Duration, Utc};
use medbrains_kernel::{Actor, AppError};
use medbrains_server_core::middleware::connected_app::{AppCredential, Exchange, exchange};
use medbrains_server_core::middleware::rate_limit::{RateLimiter, rate_limit_middleware};
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

/// Short on purpose: a leaked token is worth a quarter of an hour, and the
/// app re-asks with its secret, which is when revocation and approval are
/// re-read. Revocation also cuts live tokens at once (see `revoke`).
const TOKEN_MINUTES: i64 = 15;
/// More live tokens than this for one app means a client that never reuses
/// its token; refusing keeps the table bounded.
const MAX_LIVE_TOKENS: i64 = 20;
/// Expired tokens are kept this long so their usage log answers "what did it
/// touch" after an incident, then pruned (their usage rows go with them).
const KEEP_EXPIRED_DAYS: i32 = 90;

/// Public: the app has no session yet. Rate limited per IP like sign-in,
/// because each attempt costs an Argon2 hash.
pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/api/oauth/token", post(issue))
        .layer(from_fn_with_state(
            RateLimiter::new(),
            rate_limit_middleware,
        ))
}

#[derive(Debug, Deserialize)]
struct TokenRequest {
    grant_type: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
    scope: Option<String>,
}

/// An RFC 6749 §5.2 error. `no-store` on every answer, success or not.
fn oauth_error(status: StatusCode, code: &str, description: &str) -> Response {
    (
        status,
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({ "error": code, "error_description": description })),
    )
        .into_response()
}

/// A fault is never an authentication answer. A database outage reported as
/// `invalid_client` sends a vendor off rotating a good secret.
fn fault(error: &AppError) -> Response {
    tracing::error!(%error, "token endpoint could not decide");
    oauth_error(
        StatusCode::SERVICE_UNAVAILABLE,
        "temporarily_unavailable",
        "The hospital could not check these credentials right now. Retry with backoff.",
    )
}

/// `client_secret_basic` (preferred by RFC 6749) or `client_secret_post`.
fn client_credentials(headers: &HeaderMap, form: &TokenRequest) -> Option<(String, String)> {
    let basic = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Basic "))
        .and_then(|b| {
            base64::engine::general_purpose::STANDARD
                .decode(b.trim())
                .ok()
        })
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|pair| {
            pair.split_once(':')
                .map(|(id, s)| (id.to_owned(), s.to_owned()))
        });
    basic.or_else(|| Some((form.client_id.clone()?, form.client_secret.clone()?)))
}

/// The permissions this token carries: the app's grant, narrowed to `scope`
/// when one is asked for. Asking for anything not granted is refused, never
/// silently trimmed, so a misconfigured client finds out.
fn narrow(granted: &[String], scope: Option<&str>) -> Result<Vec<String>, String> {
    let Some(scope) = scope.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(granted.to_vec());
    };
    let mut out = Vec::new();
    for asked in scope.split_whitespace() {
        // FHIR scopes are derived from permissions; they never add one.
        if asked.starts_with("system/") {
            continue;
        }
        if !granted.iter().any(|g| g == asked) {
            return Err(format!("'{asked}' was not granted to this app"));
        }
        out.push(asked.to_owned());
    }
    if out.is_empty() {
        return Ok(granted.to_vec());
    }
    Ok(out)
}

async fn issue(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<TokenRequest>,
) -> Response {
    if form.grant_type.as_deref() != Some("client_credentials") {
        return oauth_error(
            StatusCode::BAD_REQUEST,
            "unsupported_grant_type",
            "Only client_credentials is supported.",
        );
    }
    let Some((client_id, secret)) = client_credentials(&headers, &form) else {
        return oauth_error(
            StatusCode::UNAUTHORIZED,
            "invalid_client",
            "Client authentication failed.",
        );
    };
    let app = match exchange(&state.db, &client_id, &secret).await {
        Ok(Exchange::Granted(app)) => app,
        Ok(Exchange::InvalidClient) => {
            return oauth_error(
                StatusCode::UNAUTHORIZED,
                "invalid_client",
                "Client authentication failed.",
            );
        }
        Ok(Exchange::NotApproved(why)) => {
            return oauth_error(
                StatusCode::BAD_REQUEST,
                "unauthorized_client",
                &format!("This app is {why}."),
            );
        }
        Err(error) => return fault(&error),
    };
    let permissions = match narrow(&app.permissions, form.scope.as_deref()) {
        Ok(p) => p,
        Err(why) => return oauth_error(StatusCode::BAD_REQUEST, "invalid_scope", &why),
    };
    match mint(&state, &app, &permissions).await {
        Ok(Some(token)) => {
            let scope = permissions.join(" ");
            (
                StatusCode::OK,
                [(header::CACHE_CONTROL, "no-store")],
                Json(json!({
                    "access_token": token,
                    "token_type": "Bearer",
                    "expires_in": TOKEN_MINUTES * 60,
                    "scope": scope,
                })),
            )
                .into_response()
        }
        Ok(None) => oauth_error(
            StatusCode::TOO_MANY_REQUESTS,
            "slow_down",
            "Too many live tokens for this app — reuse a token until it expires.",
        ),
        Err(error) => fault(&error),
    }
}

/// Mint a token row as the app itself. `None` when the app is at its cap.
async fn mint(
    state: &AppState,
    app: &AppCredential,
    permissions: &[String],
) -> Result<Option<String>, AppError> {
    let minted = medbrains_api_keys::mint(medbrains_api_keys::Environment::Live, permissions)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let actor = Actor {
        tenant_id: app.tenant_id,
        user_id: app.service_user_id,
    };
    let key_id = Uuid::new_v4();
    let expires_at = Utc::now() + Duration::minutes(TOKEN_MINUTES);
    let issued = medbrains_kernel::work(&state.db, actor, async |tx| {
        // Their usage rows go with them (ON DELETE CASCADE).
        sqlx::query!(
            "DELETE FROM api_keys WHERE connected_app_id = $1 AND tenant_id = $2 \
                AND expires_at < now() - make_interval(days => $3)",
            app.app_id,
            app.tenant_id,
            KEEP_EXPIRED_DAYS,
        )
        .execute(&mut **tx)
        .await?;
        let live: i64 = sqlx::query_scalar!(
            r#"SELECT count(*) AS "n!" FROM api_keys WHERE connected_app_id = $1 AND tenant_id = $2
                AND revoked_at IS NULL AND expires_at > now()"#,
            app.app_id,
            app.tenant_id,
        )
        .fetch_one(&mut **tx)
        .await?;
        if live >= MAX_LIVE_TOKENS {
            return Ok(false);
        }
        sqlx::query!(
            "INSERT INTO api_keys (id, tenant_id, name, key_prefix, key_hash, permissions, expires_at, \
               created_by, service_user_id, connected_app_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)",
            key_id,
            app.tenant_id,
            format!("{} (OAuth token)", app.name),
            &minted.prefix,
            &minted.hash,
            serde_json::json!(permissions),
            expires_at,
            app.service_user_id,
            app.app_id,
        )
        .execute(&mut **tx)
        .await?;
        let values = json!({ "token": key_id, "permissions": permissions, "expires_at": expires_at });
        crate::record(tx, "connected_app_token_issued", app.app_id, &values).await?;
        Ok(true)
    })
    .await?;
    Ok(issued.then_some(minted.secret))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use axum::http::{HeaderMap, HeaderValue, StatusCode, header};

    use super::{TokenRequest, client_credentials, fault, narrow};
    use medbrains_kernel::AppError;

    fn form(id: Option<&str>, secret: Option<&str>) -> TokenRequest {
        TokenRequest {
            grant_type: Some("client_credentials".to_owned()),
            client_id: id.map(str::to_owned),
            client_secret: secret.map(str::to_owned),
            scope: None,
        }
    }

    #[test]
    fn basic_auth_wins_and_post_is_the_fallback() {
        let mut headers = HeaderMap::new();
        // base64("mbapp_x:mbcs_y")
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Basic bWJhcHBfeDptYmNzX3k="),
        );
        assert_eq!(
            client_credentials(&headers, &form(Some("a"), Some("b"))),
            Some(("mbapp_x".to_owned(), "mbcs_y".to_owned()))
        );
        assert_eq!(
            client_credentials(&HeaderMap::new(), &form(Some("a"), Some("b"))),
            Some(("a".to_owned(), "b".to_owned()))
        );
        assert_eq!(
            client_credentials(&HeaderMap::new(), &form(Some("a"), None)),
            None
        );
    }

    #[test]
    fn a_scope_can_narrow_but_never_widen() {
        let granted = vec!["patients.view".to_owned(), "lab.orders.view".to_owned()];
        assert_eq!(narrow(&granted, None).unwrap(), granted);
        assert_eq!(
            narrow(&granted, Some("patients.view system/Patient.read")).unwrap(),
            vec!["patients.view"]
        );
        assert!(narrow(&granted, Some("patients.view billing.invoices.create")).is_err());
        assert_eq!(
            narrow(&granted, Some("system/Patient.read")).unwrap(),
            granted
        );
    }

    #[test]
    fn a_fault_is_503_never_a_credential_answer() {
        let response = fault(&AppError::ServiceUnavailable("db down".to_owned()));
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    }
}
