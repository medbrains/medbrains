//! Common 3rd-party OAuth token module.
//!
//! One reusable per-tenant connection per provider (Google / Microsoft).
//! Authorization-code flow: `authorize_url` → consent → `exchange_code`
//! (stores AEAD-encrypted tokens) → `get_valid_token` (transparently refreshes
//! an expired access token). Any integration that needs a provider token
//! (telemedicine Google Meet / Teams, calendar sync, …) calls `get_valid_token`.

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, state::AppState};

const OAUTH_TOKEN_KEY_SECRET: &str = "MEDBRAINS_OAUTH_TOKEN_KEY";
const DEV_OAUTH_TOKEN_KEY: &[u8] = b"medbrains-dev-oauth-token-key-32";
const TOKEN_CONTEXT: &[u8] = b"oauth-connection-token";

#[derive(Debug)]
pub struct OAuthProviderSpec {
    pub code: &'static str,
    pub label: &'static str,
    pub auth_url: &'static str,
    pub token_url: &'static str,
    pub default_scopes: &'static str,
    /// Request a refresh token (Google `access_type=offline`, MS `offline_access`).
    pub offline: bool,
}

pub const KNOWN_OAUTH_PROVIDERS: &[OAuthProviderSpec] = &[
    OAuthProviderSpec {
        code: "google",
        label: "Google (Calendar / Meet)",
        auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        default_scopes: "https://www.googleapis.com/auth/calendar.events",
        offline: true,
    },
    OAuthProviderSpec {
        code: "microsoft",
        label: "Microsoft (Teams / Outlook)",
        auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        default_scopes: "OnlineMeetings.ReadWrite Calendars.ReadWrite offline_access",
        offline: true,
    },
];

#[must_use]
pub fn oauth_provider_spec(code: &str) -> Option<&'static OAuthProviderSpec> {
    KNOWN_OAUTH_PROVIDERS.iter().find(|p| p.code == code)
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct OAuthConnection {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub provider: String,
    pub grant_type: String,
    #[serde(skip_serializing)]
    pub access_token_enc: Option<String>,
    #[serde(skip_serializing)]
    pub refresh_token_enc: Option<String>,
    pub token_type: String,
    pub scope: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub external_account_id: Option<String>,
    pub status: String,
    pub last_error: Option<String>,
    pub connected_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

struct ProviderCreds {
    client_id: String,
    client_secret: String,
}

/// AEAD master key — from the secret store, dev fallback otherwise.
async fn oauth_token_key(state: &AppState) -> Vec<u8> {
    match state.secret_resolver.get(OAUTH_TOKEN_KEY_SECRET).await {
        Ok(value) if value.len() >= 32 => value.into_bytes(),
        _ => DEV_OAUTH_TOKEN_KEY.to_vec(),
    }
}

fn encrypt<T: Serialize>(key: &[u8], value: &T) -> Result<String, AppError> {
    medbrains_crypto::aead::encrypt_token(key, TOKEN_CONTEXT, value)
        .map_err(|e| AppError::Internal(format!("token encrypt: {e}")))
}

fn decrypt(key: &[u8], enc: &str) -> Result<String, AppError> {
    medbrains_crypto::aead::decrypt_token::<String>(key, TOKEN_CONTEXT, enc)
        .map_err(|e| AppError::Internal(format!("token decrypt: {e}")))
}

/// Per-tenant OAuth app creds from `tenant_settings` (category `oauth`,
/// key `<provider>_config` → { client_id, client_secret }).
async fn read_creds(state: &AppState, tenant_id: &Uuid, provider: &str) -> Result<ProviderCreds, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, tenant_id).await?;
    let key = format!("{provider}_config");
    let row = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'oauth' AND key = $2",
        tenant_id,
        &key,
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::ServiceUnavailable(format!("{provider} OAuth app not configured")))?;

    let client_id = row["client_id"].as_str().unwrap_or("").to_owned();
    let client_secret = row["client_secret"].as_str().unwrap_or("").to_owned();
    if client_id.is_empty() || client_secret.is_empty() {
        return Err(AppError::ServiceUnavailable(format!(
            "{provider} OAuth client_id/secret missing"
        )));
    }
    Ok(ProviderCreds { client_id, client_secret })
}

/// Build the provider consent URL the browser is redirected to.
pub async fn authorize_url(
    state: &AppState,
    tenant_id: &Uuid,
    provider: &str,
    redirect_uri: &str,
    state_token: &str,
) -> Result<String, AppError> {
    let spec = oauth_provider_spec(provider)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown OAuth provider '{provider}'")))?;
    let creds = read_creds(state, tenant_id, provider).await?;

    let mut url = url::Url::parse(spec.auth_url)
        .map_err(|e| AppError::Internal(format!("oauth auth_url parse: {e}")))?;
    {
        let mut qp = url.query_pairs_mut();
        qp.append_pair("client_id", &creds.client_id);
        qp.append_pair("redirect_uri", redirect_uri);
        qp.append_pair("response_type", "code");
        qp.append_pair("scope", spec.default_scopes);
        qp.append_pair("state", state_token);
        if spec.offline {
            // Google needs access_type=offline + prompt=consent for a refresh
            // token; MS gets it via the offline_access scope.
            qp.append_pair("access_type", "offline");
            qp.append_pair("prompt", "consent");
        }
    }
    Ok(url.to_string())
}

#[derive(serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    scope: Option<String>,
    token_type: Option<String>,
}

async fn post_token(
    token_url: &str,
    form: &[(&str, &str)],
) -> Result<TokenResponse, AppError> {
    let resp = reqwest::Client::new()
        .post(token_url)
        .form(form)
        .send()
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("oauth token request: {e}")))?;
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::BadRequest(format!("oauth token error: {body}")));
    }
    resp.json::<TokenResponse>()
        .await
        .map_err(|e| AppError::Internal(format!("oauth token parse: {e}")))
}

/// Exchange an authorization code for tokens and store the connection.
pub async fn exchange_code(
    state: &AppState,
    tenant_id: &Uuid,
    provider: &str,
    code: &str,
    redirect_uri: &str,
    connected_by: Uuid,
) -> Result<OAuthConnection, AppError> {
    let spec = oauth_provider_spec(provider)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown OAuth provider '{provider}'")))?;
    let creds = read_creds(state, tenant_id, provider).await?;

    let token = post_token(
        spec.token_url,
        &[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("client_id", &creds.client_id),
            ("client_secret", &creds.client_secret),
        ],
    )
    .await?;

    store_tokens(state, tenant_id, provider, token, Some(connected_by)).await
}

async fn store_tokens(
    state: &AppState,
    tenant_id: &Uuid,
    provider: &str,
    token: TokenResponse,
    connected_by: Option<Uuid>,
) -> Result<OAuthConnection, AppError> {
    let key = oauth_token_key(state).await;
    let access_enc = encrypt(&key, &token.access_token)?;
    let refresh_enc = match token.refresh_token.as_ref() {
        Some(rt) => Some(encrypt(&key, rt)?),
        None => None,
    };
    let expires_at = token.expires_in.map(|secs| Utc::now() + Duration::seconds(secs));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    let conn = sqlx::query_as!(
        OAuthConnection,
        "INSERT INTO oauth_connections \
         (tenant_id, provider, grant_type, access_token_enc, refresh_token_enc, \
          token_type, scope, expires_at, status, connected_by) \
         VALUES ($1, $2, 'authorization_code', $3, COALESCE($4, NULL), $5, $6, $7, 'connected', $8) \
         ON CONFLICT (tenant_id, provider) DO UPDATE SET \
           access_token_enc = EXCLUDED.access_token_enc, \
           refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, oauth_connections.refresh_token_enc), \
           token_type = EXCLUDED.token_type, scope = EXCLUDED.scope, \
           expires_at = EXCLUDED.expires_at, status = 'connected', last_error = NULL, \
           updated_at = now() \
         RETURNING *",
        tenant_id,
        provider,
        &access_enc,
        refresh_enc.as_ref(),
        token.token_type.unwrap_or_else(|| "Bearer".to_owned()),
        token.scope,
        expires_at,
        connected_by,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(conn)
}

/// The reusable getter: a valid access token for (tenant, provider),
/// refreshing transparently when the stored one is near expiry.
pub async fn get_valid_token(
    state: &AppState,
    tenant_id: &Uuid,
    provider: &str,
) -> Result<String, AppError> {
    let spec = oauth_provider_spec(provider)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown OAuth provider '{provider}'")))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    let conn = sqlx::query_as!(
        OAuthConnection,
        "SELECT * FROM oauth_connections WHERE tenant_id = $1 AND provider = $2",
        tenant_id,
        provider,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::ServiceUnavailable(format!("{provider} is not connected")))?;
    tx.commit().await?;

    let key = oauth_token_key(state).await;
    let fresh = conn
        .expires_at
        .is_none_or(|exp| exp > Utc::now() + Duration::seconds(60));
    if fresh {
        if let Some(enc) = &conn.access_token_enc {
            return decrypt(&key, enc);
        }
    }

    // Expired — refresh.
    let refresh_enc = conn
        .refresh_token_enc
        .as_ref()
        .ok_or_else(|| AppError::ServiceUnavailable(format!("{provider} token expired; reconnect")))?;
    let refresh_token = decrypt(&key, refresh_enc)?;
    let creds = read_creds(state, tenant_id, provider).await?;
    let token = post_token(
        spec.token_url,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
            ("client_id", &creds.client_id),
            ("client_secret", &creds.client_secret),
        ],
    )
    .await?;
    let access = token.access_token.clone();
    store_tokens(state, tenant_id, provider, token, conn.connected_by).await?;
    Ok(access)
}
