//! ABDM ABHA: configuration, the gateway session and ABDM's public key.
//!
//! The gateway session token and ABDM's encryption key never leave the
//! server: they are cached here per hospital and environment and refreshed
//! before they expire. Without credentials every ABHA call answers 503, so
//! the screen says "set up ABDM" instead of pretending a call succeeded.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::{Extension, Json, extract::State};
use medbrains_abdm::{
    AbdmAbhaClient, AbdmEnvironment, AbdmError, AbhaIntegrationReadiness, SessionTokenRequest,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Refresh a session this long before ABDM would expire it.
const SESSION_MARGIN: Duration = Duration::from_secs(60);
/// ABDM rotates its encryption key rarely; an hour bounds how stale ours gets.
const PUBLIC_KEY_TTL: Duration = Duration::from_secs(3600);

type Cached = (String, Instant);
// ponytail: in-process caches, one server per hospital install; move to the
// shared store if the API ever runs as several replicas.
static SESSIONS: LazyLock<Mutex<HashMap<(Uuid, AbdmEnvironment), Cached>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
/// Keyed by the ABDM address, not just the environment, so a changed
/// address (a rehearsal against a stand-in) never reuses another server's key.
static PUBLIC_KEYS: LazyLock<Mutex<HashMap<String, Cached>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn cached<K: std::hash::Hash + Eq>(map: &Mutex<HashMap<K, Cached>>, key: &K) -> Option<String> {
    let guard = map.lock().unwrap_or_else(PoisonError::into_inner);
    guard
        .get(key)
        .filter(|(_, until)| *until > Instant::now())
        .map(|(value, _)| value.clone())
}

fn remember<K: std::hash::Hash + Eq>(
    map: &Mutex<HashMap<K, Cached>>,
    key: K,
    value: &str,
    ttl: Duration,
) {
    let mut guard = map.lock().unwrap_or_else(PoisonError::into_inner);
    guard.insert(key, (value.to_owned(), Instant::now() + ttl));
}

/// A ready ABDM connection for one hospital: client, live session, live key.
pub struct Abdm {
    pub client: AbdmAbhaClient,
    pub environment: AbdmEnvironment,
    pub session: String,
    public_key: String,
}

// Hand-written so the session token and key can never reach a log line.
impl std::fmt::Debug for Abdm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Abdm")
            .field("environment", &self.environment)
            .finish_non_exhaustive()
    }
}

impl Abdm {
    /// Encrypt a field (ABHA number, mobile, OTP) the way ABDM requires.
    ///
    /// # Errors
    /// 503 when ABDM's published key cannot be used.
    pub fn encrypt(&self, plaintext: &str) -> Result<String, AppError> {
        medbrains_crypto::abha::encrypt_field(&self.public_key, plaintext).map_err(|_| {
            AppError::ServiceUnavailable("ABDM's encryption key could not be used".to_owned())
        })
    }
}

/// Connect to ABDM for the caller's hospital.
///
/// # Errors
/// 503 when credentials are missing or ABDM is unreachable.
pub async fn connect(state: &AppState, tenant_id: Uuid) -> Result<Abdm, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let key = secret_key(state).await;
    let config = read_abdm_config(&mut tx, &tenant_id, &key).await?;
    tx.commit().await?;

    let base = base_url_override(state).await;
    let client =
        AbdmAbhaClient::new(config.environment, base.as_deref()).map_err(map_abdm_error)?;
    let session = if let Some(token) = cached(&SESSIONS, &(tenant_id, config.environment)) {
        token
    } else {
        let fresh = client
            .create_session(&SessionTokenRequest {
                client_id: config.client_id,
                client_secret: config.client_secret,
            })
            .await
            .map_err(map_abdm_error)?;
        let ttl = Duration::from_secs(fresh.expires_in).saturating_sub(SESSION_MARGIN);
        remember(
            &SESSIONS,
            (tenant_id, config.environment),
            &fresh.access_token,
            ttl,
        );
        fresh.access_token
    };
    let key_source = client.readiness().abha_base_url;
    let public_key = if let Some(key) = cached(&PUBLIC_KEYS, &key_source) {
        key
    } else {
        let fetched = client
            .public_certificate(&session)
            .await
            .map_err(map_abdm_error)?;
        remember(
            &PUBLIC_KEYS,
            key_source,
            &fetched.public_key,
            PUBLIC_KEY_TTL,
        );
        fetched.public_key
    };
    Ok(Abdm {
        client,
        environment: config.environment,
        session,
        public_key,
    })
}

#[derive(Debug, Serialize)]
pub struct AbhaStatusResponse {
    pub environment: AbdmEnvironment,
    pub configured: bool,
    pub source: String,
    pub readiness: AbhaIntegrationReadiness,
}

/// `GET /api/abdm/abha/status` — whether ABHA can be used, and against which
/// environment. Never returns credentials.
///
/// # Errors
/// 403 without `abdm.abha.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AbhaStatusResponse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::abdm::abha::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // A missing configuration is an answer here ("not configured"), not a fault.
    let key = secret_key(&state).await;
    let config = match read_abdm_config(&mut tx, &claims.tenant_id, &key).await {
        Ok(config) => Some(config),
        Err(AppError::ServiceUnavailable(_)) => None,
        Err(other) => return Err(other),
    };
    tx.commit().await?;

    let environment = config
        .as_ref()
        .map_or(AbdmEnvironment::Sandbox, |c| c.environment);
    let base = base_url_override(&state).await;
    let readiness = AbdmAbhaClient::new(environment, base.as_deref())
        .map_err(map_abdm_error)?
        .readiness();
    Ok(Json(AbhaStatusResponse {
        environment,
        configured: config.is_some(),
        source: config.map_or_else(|| "none".to_owned(), |c| c.source.to_owned()),
        readiness,
    }))
}

/// Where the ABDM client secret's encryption key lives in the secret store.
const SECRET_KEY_NAME: &str = "MEDBRAINS_ABDM_SECRET_KEY";
/// Development fallback only; production sets the key in the secret store.
const DEV_SECRET_KEY: &[u8] = b"medbrains-dev-abdm-secret-key-32";
const SECRET_CONTEXT: &[u8] = b"abdm-client-secret";

pub(crate) async fn secret_key(state: &AppState) -> Vec<u8> {
    match state.secret_resolver.get(SECRET_KEY_NAME).await {
        Ok(value) if value.len() >= 32 => value.into_bytes(),
        _ => DEV_SECRET_KEY.to_vec(),
    }
}

/// Encrypt the client secret for storage.
///
/// # Errors
/// 500 when encryption fails.
pub(crate) fn seal_secret(key: &[u8], secret: &str) -> Result<String, AppError> {
    medbrains_crypto::aead::encrypt_token(key, SECRET_CONTEXT, &secret)
        .map_err(|_| AppError::Internal("could not encrypt the ABDM secret".to_owned()))
}

/// What `tenant_settings` holds for ABDM. The secret is only ever stored
/// sealed; nothing returns it.
#[derive(Debug, Default, Deserialize, Serialize)]
pub(crate) struct StoredAbdmConfig {
    pub environment: Option<AbdmEnvironment>,
    pub client_id: Option<String>,
    pub client_secret_sealed: Option<String>,
}

pub(crate) struct ResolvedAbdmConfig {
    pub environment: AbdmEnvironment,
    client_id: String,
    client_secret: String,
    pub source: &'static str,
}

pub(crate) async fn stored_abdm_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<StoredAbdmConfig, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'abdm' AND key = 'abha_config' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    row.map_or_else(
        || Ok(StoredAbdmConfig::default()),
        |value| {
            serde_json::from_value(value)
                .map_err(|err| AppError::Internal(format!("invalid abha_config: {err}")))
        },
    )
}

async fn read_abdm_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    key: &[u8],
) -> Result<ResolvedAbdmConfig, AppError> {
    let stored = stored_abdm_config(tx, tenant_id).await?;
    if let (Some(client_id), Some(sealed)) = (stored.client_id, stored.client_secret_sealed) {
        let client_secret: String =
            medbrains_crypto::aead::decrypt_token(key, SECRET_CONTEXT, &sealed).map_err(|_| {
                AppError::ServiceUnavailable(
                    "the saved ABDM secret cannot be read — enter it again in Settings → ABDM"
                        .to_owned(),
                )
            })?;
        return Ok(ResolvedAbdmConfig {
            environment: stored.environment.unwrap_or(AbdmEnvironment::Sandbox),
            client_id,
            client_secret,
            source: "settings",
        });
    }

    let client_id = std::env::var("ABDM_CLIENT_ID").ok();
    let client_secret = std::env::var("ABDM_CLIENT_SECRET").ok();
    if let (Some(client_id), Some(client_secret)) = (client_id, client_secret) {
        let environment = if std::env::var("ABDM_ENVIRONMENT").as_deref() == Ok("production") {
            AbdmEnvironment::Production
        } else {
            AbdmEnvironment::Sandbox
        };
        return Ok(ResolvedAbdmConfig {
            environment,
            client_id,
            client_secret,
            source: "env",
        });
    }

    Err(AppError::ServiceUnavailable(
        "ABDM is not set up for this hospital yet — ask an administrator to add the ABDM keys"
            .to_owned(),
    ))
}

/// Whether this hospital has ABDM keys — saved on Settings → ABDM or in the
/// server's environment — without signing in.
///
/// # Errors
/// A database fault is an error, never "not configured".
pub(crate) async fn abdm_configured(state: &AppState, tenant_id: Uuid) -> Result<bool, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let stored = stored_abdm_config(&mut tx, &tenant_id).await?;
    tx.commit().await?;
    let saved = stored.client_id.is_some() && stored.client_secret_sealed.is_some();
    let in_env =
        std::env::var("ABDM_CLIENT_ID").is_ok() && std::env::var("ABDM_CLIENT_SECRET").is_ok();
    Ok(saved || in_env)
}

/// A mock ABDM for tests and rehearsals, when the secret store names one.
async fn base_url_override(state: &AppState) -> Option<String> {
    state
        .secret_resolver
        .get(medbrains_abdm::ABDM_BASE_URL_OVERRIDE)
        .await
        .ok()
        .filter(|v| !v.trim().is_empty())
}

/// Drop the cached session so the next call signs in with the saved keys.
pub(crate) fn forget_session(tenant_id: Uuid) {
    let mut guard = SESSIONS.lock().unwrap_or_else(PoisonError::into_inner);
    guard.retain(|(tenant, _), _| *tenant != tenant_id);
}

/// ABDM's refusal (wrong OTP, expired transaction) is the user's to fix and
/// reads as 400 with ABDM's own words; an outage is 503, never "invalid".
pub fn map_abdm_error(error: AbdmError) -> AppError {
    match error {
        AbdmError::Status { status, message } if status.is_client_error() => {
            AppError::BadRequest(message)
        }
        AbdmError::Status { .. } | AbdmError::Http(_) => AppError::ServiceUnavailable(
            "ABDM is not responding right now — try again in a minute".to_owned(),
        ),
    }
}
