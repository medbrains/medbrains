use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sqlx::PgPool;

use crate::{error::AppError, state::AppState};

/// JWT claims embedded in every authenticated request.
///
/// `permissions` is **NOT** part of the wire JWT — that field is
/// populated post-decode by the auth middleware via a lookup keyed on
/// `(role, perm_version)`. Inlining 100+ permission codes inflated the
/// access-token cookie past Chrome's 4 KB cap.
///
/// `#[serde(skip_serializing, default)]` keeps the field out of the
/// JWT payload but lets the rest of the codebase keep reading
/// `claims.permissions` unchanged.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
    #[serde(skip_serializing, default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub department_ids: Vec<Uuid>,
    #[serde(default)]
    pub perm_version: i32,
    pub exp: usize,
}

/// How the request was authenticated — used by CSRF middleware to skip
/// validation for Bearer-authenticated (mobile/API) requests.
#[derive(Debug, Clone, Copy)]
pub enum AuthMethod {
    Cookie,
    Bearer,
}

/// Auth middleware — tries cookie-based auth first, falls back to Bearer token.
/// Injects `Claims` and `AuthMethod` into request extensions.
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    // Try 1: access_token cookie
    let cookie_token = request
        .headers()
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_str| parse_cookie_value(cookie_str, "access_token"))
        .map(str::to_owned);

    if let Some(ref token) = cookie_token {
        let mut claims = decode_and_validate(token, &state.jwt_decoding_key)?;
        verify_perm_version(&state.db, &claims).await?;
        hydrate_permissions(&state.db, &mut claims).await?;
        request.extensions_mut().insert(AuthMethod::Cookie);
        request.extensions_mut().insert(claims);
        return Ok(next.run(request).await);
    }

    // Try 2: Authorization: Bearer <token>
    let bearer_token = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    if let Some(token) = bearer_token {
        let mut claims = decode_and_validate(token, &state.jwt_decoding_key)?;
        verify_perm_version(&state.db, &claims).await?;
        hydrate_permissions(&state.db, &mut claims).await?;
        request.extensions_mut().insert(AuthMethod::Bearer);
        request.extensions_mut().insert(claims);
        return Ok(next.run(request).await);
    }

    // Neither cookie nor bearer found
    Err(AppError::Unauthorized)
}

/// Decode and validate an Ed25519 JWT token.
fn decode_and_validate(token: &str, key: &DecodingKey) -> Result<Claims, AppError> {
    let mut validation = Validation::new(Algorithm::EdDSA);
    validation.set_required_spec_claims(&["exp", "sub"]);
    let token_data =
        decode::<Claims>(token, key, &validation).map_err(|_| AppError::Unauthorized)?;
    Ok(token_data.claims)
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

/// Encode JWT claims using Ed25519.
pub fn encode_jwt(
    claims: &Claims,
    key: &jsonwebtoken::EncodingKey,
) -> Result<String, jsonwebtoken::errors::Error> {
    let header = jsonwebtoken::Header::new(Algorithm::EdDSA);
    jsonwebtoken::encode(&header, claims, key)
}

/// Decode and validate JWT using Ed25519.
pub fn decode_jwt(token: &str, key: &DecodingKey) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::EdDSA);
    validation.set_required_spec_claims(&["exp", "sub"]);
    let data = decode::<Claims>(token, key, &validation)?;
    Ok(data.claims)
}

/// Populate `claims.permissions` by resolving (role, access_matrix)
/// against the `roles` table. Called by the auth middleware after JWT
/// decode + perm_version verification — the JWT itself no longer
/// carries the permission list (it's too big for Chrome's 4 KB cookie
/// cap when fine-grained perms are involved).
///
/// Bypass roles (super_admin / hospital_admin) keep an empty vector
/// here; `require_permission` short-circuits them anyway.
async fn hydrate_permissions(db: &PgPool, claims: &mut Claims) -> Result<(), AppError> {
    if claims.role == "super_admin" || claims.role == "hospital_admin" {
        return Ok(());
    }
    let perms = crate::routes::auth::resolve_permissions(
        db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    claims.permissions = perms;
    Ok(())
}

/// Reject tokens whose `perm_version` is stale.
///
/// Compares the JWT's `perm_version` against the current DB value.
/// Returns `Unauthorized` if the token is outdated (permissions changed
/// since it was issued). Tokens with `perm_version == 0` (old tokens
/// issued before this feature) are allowed through.
async fn verify_perm_version(db: &PgPool, claims: &Claims) -> Result<(), AppError> {
    // Skip check for legacy tokens (version 0 = pre-feature)
    if claims.perm_version == 0 {
        return Ok(());
    }

    let current: Option<i32> =
        sqlx::query_scalar("SELECT perm_version FROM users WHERE id = $1 AND tenant_id = $2")
            .bind(claims.sub)
            .bind(claims.tenant_id)
            .fetch_optional(db)
            .await?;

    match current {
        Some(v) if v == claims.perm_version => Ok(()),
        Some(_) => Err(AppError::Unauthorized),
        // User not found — let downstream handle it
        None => Ok(()),
    }
}
