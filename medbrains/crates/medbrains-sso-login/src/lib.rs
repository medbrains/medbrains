//! OIDC login flow + protocol-agnostic federation core.
//!
//! Flow: `authorize` (state+nonce+PKCE → redirect to the IdP) → IdP consent →
//! `callback` (exchange code, validate the id_token against the IdP's JWKS,
//! federate the user, issue the normal MedBrains JWT). SAML reuses `federate_user`.
//!
//! Security: state (CSRF, single-use), nonce (id_token replay), PKCE S256,
//! full id_token validation (signature via JWKS + iss + aud + exp + nonce). The
//! pre-auth reads use `sso_provider_for_login()` (capability by UUID) since there
//! is no tenant RLS context yet. Tokens/secrets are never logged.

use std::collections::HashSet;

use axum::{
    Json,
    extract::{Path, Query, State},
    response::Redirect,
};
use axum::routing::{get};
use axum_extra::extract::CookieJar;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Utc;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header, jwk::JwkSet};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::auth::{Claims, encode_jwt},
    middleware::cookies::{build_access_cookie, build_refresh_cookie, build_csrf_cookie},
    state::AppState,
};

const SSO_SECRET_KEY: &str = "MEDBRAINS_OAUTH_TOKEN_KEY";
const DEV_SSO_SECRET_KEY: &[u8] = b"medbrains-dev-oauth-token-key-32";
const SSO_SECRET_CONTEXT: &[u8] = b"sso-client-secret";

fn public_base() -> String {
    std::env::var("MEDBRAINS_PUBLIC_BASE_URL").unwrap_or_else(|_| "https://127.0.0.1:8443".to_owned())
}
fn callback_uri() -> String {
    format!("{}/api/auth/sso/callback", public_base())
}

async fn secret_key(state: &AppState) -> Vec<u8> {
    match state.secret_resolver.get(SSO_SECRET_KEY).await {
        Ok(v) if v.len() >= 32 => v.into_bytes(),
        _ => DEV_SSO_SECRET_KEY.to_vec(),
    }
}

/// URL-safe random token of `bytes` entropy (state/nonce/PKCE verifier).
fn random_token(bytes: usize) -> Result<String, AppError> {
    let mut buf = vec![0u8; bytes];
    getrandom::fill(&mut buf).map_err(|_| AppError::Internal("rng failure".to_owned()))?;
    Ok(URL_SAFE_NO_PAD.encode(&buf))
}

fn enc(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

fn pkce_challenge(verifier: &str) -> String {
    let mut h = Sha256::new();
    h.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(h.finalize())
}

#[derive(Debug, sqlx::FromRow)]
struct LoginProvider {
    id: Uuid,
    tenant_id: Uuid,
    protocol: String,
    discovery_url: Option<String>,
    client_id: Option<String>,
    client_secret_enc: Option<String>,
    group_claim: String,
    default_role: Option<String>,
    jit_enabled: bool,
}

async fn load_provider(state: &AppState, id: Uuid) -> Result<LoginProvider, AppError> {
    sqlx::query_as::<_, LoginProvider>(
        "SELECT id, tenant_id, protocol, discovery_url, client_id, client_secret_enc, \
         group_claim, default_role, jit_enabled FROM sso_provider_for_login($1)",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
struct Discovery {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    jwks_uri: String,
}

async fn fetch_discovery(url: &str) -> Result<Discovery, AppError> {
    reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("oidc discovery: {e}")))?
        .json::<Discovery>()
        .await
        .map_err(|e| AppError::Internal(format!("oidc discovery parse: {e}")))
}

// ── public providers list (login page) ──────────────────────────────────────

/// Non-sensitive provider info for the login page's "Sign in with…" buttons.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PublicProvider {
    pub id: Uuid,
    pub name: String,
    pub protocol: String,
}

#[derive(Debug, Deserialize)]
pub struct ProvidersQuery {
    /// Browser hostname; scopes the list to that custom domain's tenant.
    pub domain: Option<String>,
}

/// GET /api/auth/sso/providers — active providers (pre-auth, no secrets).
/// Scoped to the tenant resolved from `?domain=` (the login page's host) when
/// it matches a custom domain; otherwise the global list.
pub async fn list_active_providers(
    State(state): State<AppState>,
    Query(query): Query<ProvidersQuery>,
) -> Result<Json<Vec<PublicProvider>>, AppError> {
    let domain = query
        .domain
        .map(|d| d.split(':').next().unwrap_or(&d).trim().to_lowercase())
        .filter(|d| !d.is_empty());
    let rows = sqlx::query_as::<_, PublicProvider>(
        "SELECT id, name, protocol FROM sso_active_providers_by_host($1)",
    )
    .bind(domain)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

// ── authorize ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AuthorizeQuery {
    pub return_to: Option<String>,
}

/// GET /api/auth/sso/{provider_id}/authorize
pub async fn oidc_authorize(
    State(state): State<AppState>,
    Path(provider_id): Path<Uuid>,
    Query(q): Query<AuthorizeQuery>,
) -> Result<Redirect, AppError> {
    let provider = load_provider(&state, provider_id).await?;
    if provider.protocol != "oidc" {
        return Err(AppError::BadRequest("provider is not OIDC".to_owned()));
    }
    let discovery_url = provider
        .discovery_url
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("provider has no discovery URL".to_owned()))?;
    let client_id = provider
        .client_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("provider has no client_id".to_owned()))?;
    let discovery = fetch_discovery(discovery_url).await?;

    let state_tok = random_token(32)?;
    let nonce = random_token(32)?;
    let verifier = random_token(48)?;
    let challenge = pkce_challenge(&verifier);

    sqlx::query(
        "INSERT INTO sso_auth_state (state, provider_id, tenant_id, nonce, pkce_verifier, return_to) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&state_tok)
    .bind(provider.id)
    .bind(provider.tenant_id)
    .bind(&nonce)
    .bind(&verifier)
    .bind(&q.return_to)
    .execute(&state.db)
    .await?;

    let url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&nonce={}&code_challenge={}&code_challenge_method=S256",
        discovery.authorization_endpoint,
        enc(client_id),
        enc(&callback_uri()),
        enc("openid email profile"),
        state_tok,
        nonce,
        challenge,
    );
    Ok(Redirect::to(&url))
}

// ── callback ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    pub state: Option<String>,
    pub code: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct AuthState {
    provider_id: Uuid,
    nonce: String,
    pkce_verifier: String,
    return_to: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    id_token: String,
}

#[derive(Debug, Deserialize)]
struct IdClaims {
    sub: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    nonce: Option<String>,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

struct SsoIdentity {
    subject: String,
    email: Option<String>,
    name: Option<String>,
    groups: Vec<String>,
}

/// GET /api/auth/sso/callback?state=&code=
pub async fn oidc_callback(
    State(state): State<AppState>,
    Query(q): Query<CallbackQuery>,
) -> Result<(CookieJar, Redirect), AppError> {
    if let Some(err) = q.error {
        tracing::warn!(error = %err, "sso callback returned an error");
        return Ok((
            CookieJar::new(),
            Redirect::to(&format!("{}/login?sso_error=1", public_base())),
        ));
    }
    let state_tok = q.state.ok_or(AppError::Unauthorized)?;
    let code = q.code.ok_or(AppError::Unauthorized)?;

    // Load + consume the single-use state (reject expired).
    let auth = sqlx::query_as::<_, AuthState>(
        "DELETE FROM sso_auth_state WHERE state = $1 AND expires_at > now() \
         RETURNING provider_id, nonce, pkce_verifier, return_to",
    )
    .bind(&state_tok)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let provider = load_provider(&state, auth.provider_id).await?;
    let discovery = fetch_discovery(
        provider
            .discovery_url
            .as_deref()
            .ok_or(AppError::Unauthorized)?,
    )
    .await?;
    let client_id = provider.client_id.clone().ok_or(AppError::Unauthorized)?;
    let client_secret = match provider.client_secret_enc.as_deref() {
        Some(enc) => {
            let key = secret_key(&state).await;
            Some(
                medbrains_crypto::aead::decrypt_token::<String>(&key, SSO_SECRET_CONTEXT, enc)
                    .map_err(|_| AppError::Internal("sso secret decrypt".to_owned()))?,
            )
        }
        None => None,
    };

    // Exchange the code for tokens (PKCE verifier proves this is the same client).
    let tokens = exchange_code(
        &discovery.token_endpoint,
        &code,
        &client_id,
        client_secret.as_deref(),
        &auth.pkce_verifier,
    )
    .await?;

    // Validate the id_token end-to-end and pull the identity + groups.
    let identity = validate_id_token(
        &discovery.jwks_uri,
        &discovery.issuer,
        &tokens.id_token,
        &client_id,
        &auth.nonce,
        &provider.group_claim,
    )
    .await?;

    // Federate (find / link / JIT-create + group sync), mint a session.
    let mut tx = state.db.begin().await?;
    let fed = match federate_user(&mut tx, &provider, &identity).await {
        Ok(f) => f,
        Err(e) => {
            // Authenticated at the IdP but refused here (no authorized role, or
            // JIT disabled for a new user) — audit the refused attempt.
            let _ = tx.rollback().await;
            audit_sso_denied(&state, &provider, &identity).await;
            return Err(e);
        }
    };

    // Compliance audit (parity with password login) — who logged in via which
    // IdP, the groups presented, the role/access-groups synced, and the outcome.
    // Same tx as federation → a login can't happen without its audit trail.
    let details = serde_json::json!({
        "provider_id": provider.id,
        "external_subject": identity.subject,
        "email": identity.email,
        "groups": identity.groups,
        "role": fed.role,
        "access_groups_synced": fed.access_groups,
        "outcome": fed.outcome,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: provider.tenant_id,
            user_id: Some(fed.user_id),
            action: "sso_login",
            entity_type: "user",
            entity_id: Some(fed.user_id),
            old_values: None,
            new_values: Some(&details),
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    let access_claims = Claims {
        sub: fed.user_id,
        tenant_id: provider.tenant_id,
        role: fed.role,
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version: fed.perm_version,
        paired_device_id: None,
        exp: (Utc::now() + chrono::Duration::minutes(15)).timestamp() as usize,
    };
    let access_token = encode_jwt(&access_claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("jwt encode: {e}")))?;

    // Refresh token (7d), same model as password login — RLS-scoped insert.
    let refresh_raw = Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_raw.as_bytes());
    let refresh_hash = hex::encode(hasher.finalize());
    sqlx::query(
        "INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(provider.tenant_id)
    .bind(fed.user_id)
    .bind(&refresh_hash)
    .bind(Utc::now() + chrono::Duration::days(7))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    // Same HttpOnly cookie session as password login → no frontend token handling.
    let cfg = &state.cookie_config;
    let csrf = random_token(32)?;
    let jar = CookieJar::new()
        .add(build_access_cookie(&access_token, cfg))
        .add(build_refresh_cookie(&refresh_raw, cfg))
        .add(build_csrf_cookie(&csrf, cfg));

    // Land the user on the SPA; the cookie authenticates the session.
    let return_to = auth.return_to.unwrap_or_else(|| "/dashboard".to_owned());
    let target = if return_to.starts_with('/') {
        format!("{}{return_to}", public_base())
    } else {
        format!("{}/dashboard", public_base())
    };
    Ok((jar, Redirect::to(&target)))
}

async fn exchange_code(
    token_endpoint: &str,
    code: &str,
    client_id: &str,
    client_secret: Option<&str>,
    pkce_verifier: &str,
) -> Result<TokenResponse, AppError> {
    let mut form = vec![
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", client_id),
        ("code_verifier", pkce_verifier),
    ];
    let redirect = callback_uri();
    form.push(("redirect_uri", &redirect));
    if let Some(secret) = client_secret {
        form.push(("client_secret", secret));
    }
    reqwest::Client::new()
        .post(token_endpoint)
        .form(&form)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("token exchange: {e}")))?
        .json::<TokenResponse>()
        .await
        .map_err(|_| AppError::Unauthorized)
}

async fn validate_id_token(
    jwks_uri: &str,
    issuer: &str,
    id_token: &str,
    client_id: &str,
    expected_nonce: &str,
    group_claim: &str,
) -> Result<SsoIdentity, AppError> {
    let jwks = reqwest::Client::new()
        .get(jwks_uri)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("jwks fetch: {e}")))?
        .json::<JwkSet>()
        .await
        .map_err(|e| AppError::Internal(format!("jwks parse: {e}")))?;

    let header = decode_header(id_token).map_err(|_| AppError::Unauthorized)?;
    let kid = header.kid.ok_or(AppError::Unauthorized)?;
    let jwk = jwks.find(&kid).ok_or(AppError::Unauthorized)?;
    let key = DecodingKey::from_jwk(jwk).map_err(|_| AppError::Unauthorized)?;

    // Algorithm from the JWK header (RS256 default — the common OIDC case).
    let alg = match header.alg {
        Algorithm::RS256 | Algorithm::RS384 | Algorithm::RS512 | Algorithm::ES256
        | Algorithm::ES384 => header.alg,
        _ => Algorithm::RS256,
    };
    let mut validation = Validation::new(alg);
    validation.set_audience(&[client_id]);
    validation.set_issuer(&[issuer]);
    validation.validate_exp = true;

    let data = decode::<IdClaims>(id_token, &key, &validation).map_err(|_| AppError::Unauthorized)?;
    let claims = data.claims;

    // Replay protection — the nonce must match the one we sent in authorize.
    if claims.nonce.as_deref() != Some(expected_nonce) {
        return Err(AppError::Unauthorized);
    }

    Ok(SsoIdentity {
        subject: claims.sub,
        email: claims.email,
        name: claims.name,
        groups: extract_groups(&claims.extra, group_claim),
    })
}

/// Extract IdP groups from the id_token claim, tolerating the shapes real IdPs
/// emit: a JSON array of strings (Entra/Okta/Keycloak), an array with numbers or
/// group objects (coerced to their id/name), or a single bare string (one
/// group). A space/comma-delimited multi-group string is intentionally NOT
/// auto-split — AD group names contain spaces, so splitting would corrupt them;
/// that case needs a configured delimiter (future, migration-backed).
fn extract_groups(extra: &serde_json::Map<String, serde_json::Value>, claim: &str) -> Vec<String> {
    match extra.get(claim) {
        Some(serde_json::Value::Array(items)) => {
            items.iter().filter_map(group_value_as_string).collect()
        }
        Some(serde_json::Value::String(s)) if !s.is_empty() => vec![s.clone()],
        _ => Vec::new(),
    }
}

/// Coerce one array element to a group identifier: a string as-is, a number as
/// text, or an object's common group key (value/id/name/displayName).
fn group_value_as_string(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Object(o) => ["value", "id", "name", "displayName"]
            .iter()
            .find_map(|k| o.get(*k).and_then(serde_json::Value::as_str))
            .map(str::to_owned),
        _ => None,
    }
}

// ── federation core ─────────────────────────────────────────────────────────

/// Resolve mapped (role, access-group-ids) from the provider's group mappings
/// against the user's IdP groups. The first matching mapping that names a role
/// wins (single role); all matching access groups are collected. Pure + tested.
fn resolve_group_targets(
    mappings: &[(String, Option<String>, Option<Uuid>)],
    user_groups: &HashSet<String>,
) -> (Option<String>, Vec<Uuid>) {
    let mut role: Option<String> = None;
    let mut access_groups: Vec<Uuid> = Vec::new();
    for (group, role_code, ag) in mappings {
        if !user_groups.contains(group) {
            continue;
        }
        if role.is_none() {
            if let Some(rc) = role_code {
                role = Some(rc.clone());
            }
        }
        if let Some(id) = ag {
            if !access_groups.contains(id) {
                access_groups.push(*id);
            }
        }
    }
    (role, access_groups)
}

struct Federated {
    user_id: Uuid,
    role: String,
    perm_version: i32,
    /// How the user was resolved — for the login audit: "returning" (matched
    /// idp+subject), "linked" (matched an existing account by email), or
    /// "provisioned" (JIT-created on first login).
    outcome: &'static str,
    /// Count of SSO-synced access groups this login (for the audit detail).
    access_groups: usize,
}

async fn federate_user(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    provider: &LoginProvider,
    identity: &SsoIdentity,
) -> Result<Federated, AppError> {
    medbrains_db::pool::set_tenant_context(tx, &provider.tenant_id).await?;

    let mappings = sqlx::query_as::<_, (String, Option<String>, Option<Uuid>)>(
        "SELECT idp_group, role_code, access_group_id FROM idp_group_mappings WHERE provider_id = $1",
    )
    .bind(provider.id)
    .fetch_all(&mut **tx)
    .await?;
    let user_groups: HashSet<String> = identity.groups.iter().cloned().collect();
    let (mapped_role, access_groups) = resolve_group_targets(&mappings, &user_groups);

    // No mapped role and no default → no access (the provider opted out of a base role).
    let role = mapped_role
        .or_else(|| provider.default_role.clone())
        .ok_or(AppError::Unauthorized)?;

    // 1. Existing federated user (idp + subject) · 2. else link by email · 3. else JIT.
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM users WHERE idp_id = $1 AND external_subject = $2",
    )
    .bind(provider.id)
    .bind(&identity.subject)
    .fetch_optional(&mut **tx)
    .await?;

    let (user_id, outcome) = match existing {
        Some(id) => {
            sqlx::query(
                "UPDATE users SET role = $2::user_role, email_verified = true, \
                 perm_version = perm_version + 1, updated_at = now() WHERE id = $1",
            )
            .bind(id)
            .bind(&role)
            .execute(&mut **tx)
            .await?;
            (id, "returning")
        }
        None => {
            let linked = match identity.email.as_deref() {
                Some(email) => sqlx::query_scalar::<_, Uuid>(
                    "SELECT id FROM users WHERE lower(email) = lower($1) AND idp_id IS NULL",
                )
                .bind(email)
                .fetch_optional(&mut **tx)
                .await?,
                None => None,
            };
            match linked {
                Some(id) => {
                    sqlx::query(
                        "UPDATE users SET idp_id = $2, external_subject = $3, role = $4::user_role, \
                         email_verified = true, perm_version = perm_version + 1, updated_at = now() \
                         WHERE id = $1",
                    )
                    .bind(id)
                    .bind(provider.id)
                    .bind(&identity.subject)
                    .bind(&role)
                    .execute(&mut **tx)
                    .await?;
                    (id, "linked")
                }
                None => {
                    if !provider.jit_enabled {
                        return Err(AppError::Unauthorized);
                    }
                    (jit_create(tx, provider, identity, &role).await?, "provisioned")
                }
            }
        }
    };

    // Re-sync SSO-managed access-group memberships (never touch 'manual' grants).
    sqlx::query("DELETE FROM access_group_members WHERE user_id = $1 AND source = 'sso'")
        .bind(user_id)
        .execute(&mut **tx)
        .await?;
    for ag in &access_groups {
        sqlx::query(
            "INSERT INTO access_group_members (group_id, user_id, tenant_id, source) \
             VALUES ($1, $2, $3, 'sso') ON CONFLICT (group_id, user_id) DO NOTHING",
        )
        .bind(ag)
        .bind(user_id)
        .bind(provider.tenant_id)
        .execute(&mut **tx)
        .await?;
    }

    let perm_version = sqlx::query_scalar::<_, i32>("SELECT perm_version FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;

    Ok(Federated {
        user_id,
        role,
        perm_version,
        outcome,
        access_groups: access_groups.len(),
    })
}

/// Best-effort audit of a REFUSED SSO login — the user authenticated at the IdP
/// but is not authorized here (no matching group mapping + no default role, or
/// JIT disabled for a new user). Uses its own tx so it survives the rolled-back
/// federation tx. `user_id` is null (no session was created).
async fn audit_sso_denied(state: &AppState, provider: &LoginProvider, identity: &SsoIdentity) {
    let details = serde_json::json!({
        "provider_id": provider.id,
        "external_subject": identity.subject,
        "email": identity.email,
        "groups": identity.groups,
        "reason": "no authorized role: no matching group mapping and no default role, or JIT disabled",
    });
    let Ok(mut tx) = state.db.begin().await else {
        return;
    };
    if medbrains_db::pool::set_tenant_context(&mut tx, &provider.tenant_id)
        .await
        .is_err()
    {
        return;
    }
    let logged = medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: provider.tenant_id,
            user_id: None,
            action: "sso_login_denied",
            entity_type: "identity_provider",
            entity_id: Some(provider.id),
            old_values: None,
            new_values: Some(&details),
            ip_address: None,
        },
    )
    .await;
    if logged.is_ok() {
        let _ = tx.commit().await;
    }
}

/// Sanitise an email/subject into a unique username matching the users CHECK
/// constraint (`^[a-z][a-z0-9_]{2,29}$`).
fn base_username(identity: &SsoIdentity) -> String {
    let seed = identity
        .email
        .as_deref()
        .and_then(|e| e.split('@').next())
        .unwrap_or(&identity.subject);
    let mut s: String = seed
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    s.retain(|c| c.is_ascii_alphanumeric() || c == '_');
    let s = s.trim_matches('_').to_owned();
    let mut s = if s.chars().next().is_some_and(|c| c.is_ascii_alphabetic()) {
        s
    } else {
        format!("u{s}")
    };
    s.truncate(28);
    if s.len() < 3 {
        s = format!("{s}sso");
    }
    s
}

async fn jit_create(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    provider: &LoginProvider,
    identity: &SsoIdentity,
    role: &str,
) -> Result<Uuid, AppError> {
    let base = base_username(identity);
    // Ensure uniqueness within the tenant.
    let mut username = base.clone();
    for suffix in 0..1000 {
        let taken = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND username = $2)",
        )
        .bind(provider.tenant_id)
        .bind(&username)
        .fetch_one(&mut **tx)
        .await?;
        if !taken {
            break;
        }
        username = format!("{}{suffix}", base.chars().take(24).collect::<String>());
    }
    let email = identity
        .email
        .clone()
        .unwrap_or_else(|| format!("{username}@sso.local"));
    let full_name = identity
        .name
        .clone()
        .or_else(|| identity.email.clone())
        .unwrap_or_else(|| username.clone());

    let id = sqlx::query_scalar::<_, Uuid>(
        // email_verified = true: the IdP already verified the address, so don't
        // nag federated users with the verify-email banner.
        "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, \
         idp_id, external_subject, email_verified) \
         VALUES ($1, $2, $3, NULL, $4, $5::user_role, $6, $7, true) RETURNING id",
    )
    .bind(provider.tenant_id)
    .bind(&username)
    .bind(&email)
    .bind(&full_name)
    .bind(role)
    .bind(provider.id)
    .bind(&identity.subject)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use uuid::Uuid;

    use super::{base_username, extract_groups, pkce_challenge, resolve_group_targets, SsoIdentity};

    fn groups(items: &[&str]) -> HashSet<String> {
        items.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn extract_groups_tolerates_idp_shapes() {
        let m = |v: serde_json::Value| v.as_object().cloned().unwrap_or_default();
        let want = |xs: &[&str]| xs.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>();
        // Array of strings (Entra/Okta/Keycloak).
        assert_eq!(
            extract_groups(&m(serde_json::json!({ "groups": ["doctors", "nurses"] })), "groups"),
            want(&["doctors", "nurses"])
        );
        // Array of group objects → coerced to a common key.
        assert_eq!(
            extract_groups(
                &m(serde_json::json!({ "groups": [{ "value": "doctors" }, { "id": "n1" }] })),
                "groups"
            ),
            want(&["doctors", "n1"])
        );
        // Single bare string → one group.
        assert_eq!(extract_groups(&m(serde_json::json!({ "g": "doctors" })), "g"), want(&["doctors"]));
        // Missing claim / empty string → no groups.
        assert!(extract_groups(&m(serde_json::json!({})), "groups").is_empty());
        assert!(extract_groups(&m(serde_json::json!({ "g": "" })), "g").is_empty());
    }

    #[test]
    fn resolves_first_role_and_all_access_groups() {
        let ag1 = Uuid::new_v4();
        let ag2 = Uuid::new_v4();
        let mappings = vec![
            ("doctors".to_owned(), Some("doctor".to_owned()), Some(ag1)),
            ("admins".to_owned(), Some("hospital_admin".to_owned()), None),
            ("research".to_owned(), None, Some(ag2)),
        ];
        let (role, ags) = resolve_group_targets(&mappings, &groups(&["doctors", "research"]));
        assert_eq!(role.as_deref(), Some("doctor")); // first matching role wins
        assert_eq!(ags, vec![ag1, ag2]);
    }

    #[test]
    fn no_matching_groups_yields_nothing() {
        let mappings = vec![("doctors".to_owned(), Some("doctor".to_owned()), None)];
        let (role, ags) = resolve_group_targets(&mappings, &groups(&["nurses"]));
        assert!(role.is_none());
        assert!(ags.is_empty());
    }

    #[test]
    fn pkce_challenge_is_deterministic_sha256() {
        // Known S256: base64url(sha256("abc")) with no padding.
        assert_eq!(pkce_challenge("abc"), "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
    }

    #[test]
    fn usernames_satisfy_the_constraint() {
        let id = SsoIdentity {
            subject: "abc-123".to_owned(),
            email: Some("Jane.Doe@hospital.org".to_owned()),
            name: None,
            groups: vec![],
        };
        let u = base_username(&id);
        assert!(u.starts_with("jane"));
        assert!(u.chars().next().unwrap().is_ascii_lowercase());
        assert!(u.len() >= 3 && u.len() <= 30);
    }
}

/// sso_login routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/auth/sso/providers",
            get(list_active_providers),
        )
        .route(
            "/api/auth/sso/{provider_id}/authorize",
            get(oidc_authorize),
        )
        .route("/api/auth/sso/callback", get(oidc_callback))
}
