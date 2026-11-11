use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use uuid::Uuid;

use sqlx::PgPool;

use crate::{error::AppError, state::AppState};

// Defined in the kernel, which reads them without knowing about HTTP. Re-exported
// because this module is where a request's identity comes from: the middleware
// below fills them in, and handlers across the workspace name them from here.
pub use medbrains_kernel::{ActingAgent, ActorKind, Claims};

/// Run `next` with the agent (if any) in scope, so audit and access rows
/// written for this request record it. An agent may only read: a write it
/// asks for is refused here, before any handler runs — agent changes go
/// through a proposal a person approves, never straight to a record.
pub(crate) async fn run_as(
    state: &AppState,
    claims: &Claims,
    request: Request,
    next: Next,
) -> Response {
    let Some(agent) = claims.act.clone() else {
        return next.run(request).await;
    };
    if !matches!(
        *request.method(),
        axum::http::Method::GET | axum::http::Method::HEAD
    ) {
        // The attempt is evidence: audited like any other refusal, with the
        // agent named, before the answer goes back.
        let entry = medbrains_db::audit::HttpAuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            correlation_id: Uuid::new_v4(),
            action: "agent_write_refused".to_owned(),
            entity_type: request
                .uri()
                .path()
                .trim_start_matches("/api/")
                .split('/')
                .next()
                .unwrap_or("unknown")
                .to_owned(),
            entity_id: None,
            ip_address: None,
            user_agent: None,
            session_id: None,
            module: Some("ai".to_owned()),
            status_code: 403,
            method: request.method().as_str().to_owned(),
            acting_agent: Some(agent.to_audit_json()),
        };
        if let Err(e) = medbrains_db::audit::AuditLogger::log_http(&state.db, &entry).await {
            tracing::error!(error = %e, "failed to audit a refused agent write");
        }
        return AppError::ForbiddenReason(
            "An AI agent cannot change records. It can only propose a change for a person to \
             approve."
                .to_owned(),
        )
        .into_response();
    }
    medbrains_db::audit::ACTING_AGENT
        .scope(agent.to_audit_json(), next.run(request))
        .await
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
/// Injects `Claims` and `AuthMethod` into request extensions, and notes a
/// person's request for the OS updater's quiet window (`activity`).
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
        let account = verify_perm_version(&state.db, &claims).await?;
        refuse_until_password_changed(account.must_change_password, request.uri().path())?;
        let device_variant = verify_device_not_revoked(&state.db, &claims).await?;
        super::activity::note(request.headers(), device_variant.as_deref());
        request.extensions_mut().insert(AuthMethod::Cookie);
        if account.is_vendor {
            return Ok(super::vendor_access::serve(&state, claims, request, next).await);
        }
        hydrate_permissions(&state.db, &mut claims, device_variant.as_deref()).await?;
        request.extensions_mut().insert(claims.clone());
        return Ok(run_as(&state, &claims, request, next).await);
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
        let account = verify_perm_version(&state.db, &claims).await?;
        refuse_until_password_changed(account.must_change_password, request.uri().path())?;
        let device_variant = verify_device_not_revoked(&state.db, &claims).await?;
        super::activity::note(request.headers(), device_variant.as_deref());
        request.extensions_mut().insert(AuthMethod::Bearer);
        if account.is_vendor {
            return Ok(super::vendor_access::serve(&state, claims, request, next).await);
        }
        hydrate_permissions(&state.db, &mut claims, device_variant.as_deref()).await?;
        request.extensions_mut().insert(claims.clone());
        return Ok(run_as(&state, &claims, request, next).await);
    }

    // Neither cookie nor bearer found
    Err(AppError::Unauthorized)
}

/// Run the auth middleware's account checks on a token a handler decoded
/// itself — a WebSocket upgrade, which no middleware sees.
///
/// Refuses a deactivated or deleted account and a stale permission version
/// (401), a temporary password not yet changed or a vendor account (403) and
/// a revoked device (401), then fills in the account's permissions.
///
/// # Errors
/// Any refusal above, or a database failure.
pub async fn verify_decoded(db: &PgPool, claims: &mut Claims) -> Result<(), AppError> {
    let account = verify_perm_version(db, claims).await?;
    if account.must_change_password {
        return Err(AppError::ForbiddenReason(
            "Change your temporary password to continue.".to_owned(),
        ));
    }
    // A path that decodes its own token (a socket) cannot be masked or
    // recorded per request the way the vendor gate does, so a vendor account
    // is refused on it outright.
    if account.is_vendor {
        return Err(AppError::ForbiddenReason(
            "This is not available to MedBrains accounts.".to_owned(),
        ));
    }
    let device_variant = verify_device_not_revoked(db, claims).await?;
    hydrate_permissions(db, claims, device_variant.as_deref()).await
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
        if let Some(val) = trimmed.strip_prefix(name)
            && let Some(val) = val.strip_prefix('=')
        {
            return Some(val.trim());
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
///
/// A service account holds no grants of its own (the database refuses them).
/// Presented by a paired device, its permissions are the device's: a
/// waiting-room screen reads boards and nothing else.
async fn hydrate_permissions(
    db: &PgPool,
    claims: &mut Claims,
    device_variant: Option<&str>,
) -> Result<(), AppError> {
    if claims.role == "super_admin" || claims.role == "hospital_admin" {
        return Ok(());
    }
    if claims.role == "service_account" {
        claims.permissions = device_permissions(device_variant);
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
///
/// Returns the device's app variant, which decides what a service-account
/// device may do.
async fn verify_device_not_revoked(
    db: &PgPool,
    claims: &Claims,
) -> Result<Option<String>, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id).await?;
    let Some(device_id) = claims.paired_device_id else {
        return Ok(None);
    };

    // Runtime query rather than the checked macro: this crate's queries are
    // runtime by convention, and a macro here would need `.sqlx` metadata
    // regenerated against a migrated database to build at all.
    //
    // A device issued to a vendor account is refused like a revoked one: a
    // tablet paired by a support engineer must not outlive their grant.
    let row: Option<(bool, String)> = sqlx::query_as(
        "SELECT d.revoked_at IS NULL AND NOT COALESCE(u.is_vendor_staff \
                    OR public.app_email_is_vendor(u.email, $3), false), \
                d.app_variant \
           FROM paired_devices d LEFT JOIN users u ON u.id = d.issued_to_user_id \
          WHERE d.id = $1 AND d.tenant_id = $2",
    )
    .bind(device_id)
    .bind(claims.tenant_id)
    .bind(super::vendor_access::vendor_domains())
    .fetch_optional(&mut *conn)
    .await?;

    if device_admitted(row.as_ref().map(|(live, _)| *live)) {
        Ok(row.map(|(_, variant)| variant))
    } else {
        Err(AppError::Unauthorized)
    }
}

/// A screen, not a person: a waiting-room display or a TV.
pub fn is_display_variant(app_variant: &str) -> bool {
    app_variant == "display" || app_variant.starts_with("tv")
}

/// What a service-account device may do, from what it was paired as. Only a
/// display has anything: it reads boards.
fn device_permissions(device_variant: Option<&str>) -> Vec<String> {
    match device_variant {
        Some(variant) if is_display_variant(variant) => {
            vec![medbrains_core::permissions::display::board::READ.to_owned()]
        }
        _ => Vec::new(),
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

/// What the per-request `users` lookup says about the account.
struct AccountState {
    /// A temporary password still has to be changed.
    must_change_password: bool,
    /// A vendor account: served only under a hospital grant
    /// (`vendor_access`), whatever its role.
    is_vendor: bool,
}

/// Reject tokens whose `perm_version` is stale, or whose user is gone.
///
/// Compares the JWT's `perm_version` against the current DB value.
/// Returns `Unauthorized` if the token is outdated, missing a permission
/// version, or references a user who was deactivated or deleted. Deleting a
/// user soft-deletes the row and leaves `perm_version` untouched, so a live
/// token stayed valid until it expired — the account was gone from every
/// list while its phone kept a ward screen.
///
/// The same round trip says whether a password change is owed and whether
/// this is a vendor account, so neither costs a query of its own.
async fn verify_perm_version(db: &PgPool, claims: &Claims) -> Result<AccountState, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id).await?;
    if claims.perm_version <= 0 {
        return Err(AppError::Unauthorized);
    }

    let current: Option<(i32, bool, bool)> = sqlx::query_as(
        "SELECT perm_version, must_change_password, \
                COALESCE(is_vendor_staff OR public.app_email_is_vendor(email, $3), false) \
           FROM users \
         WHERE id = $1 AND tenant_id = $2 AND is_active AND deleted_at IS NULL",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .bind(super::vendor_access::vendor_domains())
    .fetch_optional(&mut *conn)
    .await?;

    match current {
        Some((version, must_change_password, is_vendor)) if version == claims.perm_version => {
            Ok(AccountState {
                must_change_password,
                is_vendor,
            })
        }
        Some(_) | None => Err(AppError::Unauthorized),
    }
}

/// What someone who still owes a password change may call: who they are, the
/// change itself, and leaving.
const BEFORE_PASSWORD_CHANGE: [&str; 4] = [
    "/api/auth/me",
    "/api/auth/change-password",
    "/api/auth/logout",
    "/api/auth/logout-all",
];

/// Refuse everything else until a required password change is made. The browser
/// shows the change screen, but the temporary password must not work on the API.
fn refuse_until_password_changed(must_change: bool, path: &str) -> Result<(), AppError> {
    if must_change && !BEFORE_PASSWORD_CHANGE.contains(&path) {
        return Err(AppError::ForbiddenReason(
            "Change your temporary password to continue.".to_owned(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{device_admitted, device_permissions, refuse_until_password_changed};

    /// A temporary password opens the change screen and nothing else.
    #[test]
    fn a_temporary_password_reaches_only_the_password_change() {
        assert!(refuse_until_password_changed(true, "/api/patients").is_err());
        assert!(refuse_until_password_changed(true, "/api/admin/users").is_err());
        assert!(refuse_until_password_changed(true, "/api/auth/me").is_ok());
        assert!(refuse_until_password_changed(true, "/api/auth/change-password").is_ok());
        assert!(refuse_until_password_changed(false, "/api/patients").is_ok());
    }

    /// A paired screen reads boards; any other service-account device, and a
    /// service account with no device at all, can do nothing.
    #[test]
    fn a_service_account_device_gets_only_what_it_was_paired_as() {
        assert_eq!(
            device_permissions(Some("tv")),
            vec!["display.board.read".to_owned()]
        );
        assert_eq!(
            device_permissions(Some("display")),
            vec!["display.board.read".to_owned()]
        );
        assert!(device_permissions(Some("mobile-staff")).is_empty());
        assert!(device_permissions(None).is_empty());
    }

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
