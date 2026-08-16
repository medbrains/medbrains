use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::{IntoResponse, Response},
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
    /// Set when this token was issued to a paired device rather than to a
    /// person at a browser.
    ///
    /// A device token is not the same kind of credential as a session cookie.
    /// It lives for weeks on hardware that gets lost, lent and stolen, so it
    /// carries the device it was minted for and every request re-checks that
    /// the device is still one this hospital admits. Without that, revoking a
    /// lost tablet changes a row and nothing else.
    ///
    /// Absent on every user token, and absent from tokens minted before this
    /// existed — which is why it is optional rather than a breaking claim.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paired_device_id: Option<Uuid>,
    pub exp: usize,
}

/// How the request was authenticated — used by CSRF middleware to skip
/// validation for Bearer-authenticated (mobile/API) requests.
#[derive(Debug, Clone, Copy)]
pub enum AuthMethod {
    Cookie,
    Bearer,
    /// A machine credential. Like `Bearer` it carries no cookie and so needs
    /// no CSRF check; unlike it, there is no person behind the request.
    ApiKey,
}

/// Which API key authenticated this request.
///
/// A request extension rather than a field on `Claims`, because it is not a
/// claim: it is never encoded into a token and never survives the request. A
/// JWT carrying it would be a key that outlived its own revocation.
///
/// `Claims.sub` already names the key's service account, which is what the
/// ninety-nine `created_by` foreign keys need. This is the extra step — which
/// *credential* acted, so a leak is traced to one key rather than to the
/// identity every key of that integration shares.
#[derive(Debug, Clone, Copy)]
pub struct ApiKeyId(pub Uuid);

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
        verify_device_not_revoked(&state.db, &claims).await?;
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

    // Try 2a: the bearer value is an API key, not a token.
    //
    // Checked before JWT decoding because a key is not a JWT and would fail
    // that decode with `Unauthorized` — a correct-looking answer that would
    // send an integration author hunting for a malformed token.
    if let Some(secret) = bearer_token.filter(|value| medbrains_api_keys::looks_like_key(value)) {
        let (claims, key_id) = super::api_key::authenticate(&state.db, secret).await?;
        let method = request.method().to_string();
        let path = request.uri().path().to_owned();
        let tenant_id = claims.tenant_id;

        // The session surface is refused here rather than inside `authenticate`
        // so that the refusal still reaches `record_usage` below. A key
        // probing endpoints it has no business calling is the clearest sign
        // something is wrong with it, and it would otherwise leave no trace.
        let response = if super::api_key::is_session_only(&path) {
            AppError::ForbiddenReason(
                "This endpoint manages a person's session and cannot be called with an API key."
                    .to_owned(),
            )
            .into_response()
        } else {
            request.extensions_mut().insert(AuthMethod::ApiKey);
            request.extensions_mut().insert(ApiKeyId(key_id));
            request.extensions_mut().insert(claims);
            next.run(request).await
        };
        // After the response, so the recorded status is the real one. A key
        // that is 403ing repeatedly is the signal that matters most here.
        super::api_key::record_usage(
            &state.db,
            tenant_id,
            key_id,
            &method,
            &path,
            response.status().as_u16(),
        )
        .await;
        return Ok(response);
    }

    if let Some(token) = bearer_token {
        let mut claims = decode_and_validate(token, &state.jwt_decoding_key)?;
        verify_perm_version(&state.db, &claims).await?;
        verify_device_not_revoked(&state.db, &claims).await?;
        hydrate_permissions(&state.db, &mut claims).await?;
        request.extensions_mut().insert(AuthMethod::Bearer);
        request.extensions_mut().insert(claims);
        return Ok(next.run(request).await);
    }

    // Neither cookie nor bearer found
    Err(AppError::Unauthorized)
}

/// Decode and validate an Ed25519 JWT token.
pub fn decode_and_validate(token: &str, key: &DecodingKey) -> Result<Claims, AppError> {
    let mut validation = Validation::new(Algorithm::EdDSA);
    validation.set_required_spec_claims(&["exp", "sub"]);
    let token_data =
        decode::<Claims>(token, key, &validation).map_err(|_| AppError::Unauthorized)?;
    Ok(token_data.claims)
}

/// Parse a specific cookie value from the raw `Cookie` header string.
pub fn parse_cookie_value<'a>(header: &'a str, name: &str) -> Option<&'a str> {
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
    let perms =
        crate::permissions::resolve_permissions(db, claims.tenant_id, claims.sub, &claims.role)
            .await?;
    claims.permissions = perms;
    Ok(())
}

/// Refuse a token whose device has been revoked.
///
/// A device token outlives the decision to revoke it by weeks. `perm_version`
/// does not help: it tracks the *user's* permissions, and revoking a tablet
/// says nothing about the person who paired it — who is very often still a
/// working member of staff with a valid session on their own phone.
///
/// So revocation has to be checked against the device itself, on every request
/// that presents a device token. That is one indexed primary-key lookup, on the
/// same request that already reads `users` for `perm_version`, and only for
/// device-authenticated traffic. Cheaper than the alternative, which is a lost
/// tablet keeping API access for the rest of its token's life.
async fn verify_device_not_revoked(db: &PgPool, claims: &Claims) -> Result<(), AppError> {
    let Some(device_id) = claims.paired_device_id else {
        return Ok(());
    };

    // Runtime query rather than the checked macro: this crate's queries are
    // runtime by convention, and a macro here would need `.sqlx` metadata
    // regenerated against a migrated database to build at all.
    let live: Option<bool> = sqlx::query_scalar::<_, bool>(
        "SELECT revoked_at IS NULL FROM paired_devices WHERE id = $1 AND tenant_id = $2",
    )
    .bind(device_id)
    .bind(claims.tenant_id)
    .fetch_optional(db)
    .await?;

    if device_admitted(live) {
        Ok(())
    } else {
        Err(AppError::Unauthorized)
    }
}

/// Whether a `paired_devices` lookup means "still admitted".
///
/// `None` is a row that is not there — the device was deleted, or belongs to
/// another tenant. Refused for the same reason a revoked one is: the token
/// names a device this tenant no longer vouches for. Pulled out of the query so
/// the fail-closed reading is pinned by a test rather than by a `match` arm
/// somebody later "simplifies".
const fn device_admitted(live: Option<bool>) -> bool {
    matches!(live, Some(true))
}

/// Reject tokens whose `perm_version` is stale.
///
/// Compares the JWT's `perm_version` against the current DB value.
/// Returns `Unauthorized` if the token is outdated, missing a permission
/// version, or references a user row that no longer exists.
async fn verify_perm_version(db: &PgPool, claims: &Claims) -> Result<(), AppError> {
    if claims.perm_version <= 0 {
        return Err(AppError::Unauthorized);
    }

    let current: Option<i32> = sqlx::query_scalar!(
        "SELECT perm_version FROM users WHERE id = $1 AND tenant_id = $2",
        claims.sub,
        claims.tenant_id
    )
    .fetch_optional(db)
    .await?;

    match current {
        Some(v) if v == claims.perm_version => Ok(()),
        Some(_) | None => Err(AppError::Unauthorized),
    }
}

#[cfg(test)]
mod tests {
    use super::device_admitted;

    #[test]
    fn a_live_device_is_admitted() {
        assert!(device_admitted(Some(true)));
    }

    #[test]
    fn a_revoked_device_is_refused() {
        assert!(!device_admitted(Some(false)));
    }

    /// The one that matters. A token naming a device that no longer exists —
    /// deleted, or another tenant's — must not sail through because the query
    /// returned nothing to compare.
    #[test]
    fn a_device_that_is_not_there_is_refused() {
        assert!(!device_admitted(None));
    }
}
