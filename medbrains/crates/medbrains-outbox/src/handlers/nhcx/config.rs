//! The hospital's NHCX settings — participant code, environment, gateway
//! credentials and keys — as the outbox handler, the callback receiver and
//! Settings → NHCX all read them.
//!
//! The client secret and private key are sealed (AEAD) with a server-held
//! key before they are stored, and only ever unsealed here, in memory, for
//! the call that needs them.

use medbrains_core::nhcx::NhcxEnvironment;
use medbrains_core::secrets::SecretResolver;
use sqlx::PgConnection;
use uuid::Uuid;

/// Secret-store key holding the sealing key.
const SEALING_KEY_NAME: &str = "MEDBRAINS_NHCX_SECRET_KEY";
/// Development fallback only; production sets the key in the secret store.
const DEV_SEALING_KEY: &[u8] = b"medbrains-dev-nhcx-secret-key-32";
pub const CLIENT_SECRET_CONTEXT: &[u8] = b"nhcx-client-secret";
pub const PRIVATE_KEY_CONTEXT: &[u8] = b"nhcx-private-key";
/// When the hospital has not saved its own, the ABDM client credentials the
/// server holds — NHCX signs in with the same ABDM credentials.
const ENV_CLIENT_ID: &str = "ABDM_CLIENT_ID";
const ENV_CLIENT_SECRET: &str = "ABDM_CLIENT_SECRET";

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    /// Something the hospital must set up first; the message says what.
    #[error("{0}")]
    NotSetUp(String),
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
}

/// The sealing key for NHCX secrets.
pub async fn sealing_key(resolver: &dyn SecretResolver) -> Vec<u8> {
    match resolver.get(SEALING_KEY_NAME).await {
        Ok(value) if value.len() >= 32 => value.into_bytes(),
        _ => DEV_SEALING_KEY.to_vec(),
    }
}

/// Seal a secret for storage.
///
/// # Errors
/// When encryption fails (a sealing key shorter than 32 bytes).
pub fn seal(
    key: &[u8],
    context: &[u8],
    secret: &str,
) -> Result<String, medbrains_crypto::CryptoError> {
    medbrains_crypto::aead::encrypt_token(key, context, &secret)
}

fn unseal(key: &[u8], context: &[u8], sealed: &str, what: &str) -> Result<String, ConfigError> {
    medbrains_crypto::aead::decrypt_token(key, context, sealed).map_err(|_| {
        ConfigError::NotSetUp(format!(
            "the saved NHCX {what} cannot be read — enter it again in Settings → NHCX"
        ))
    })
}

/// The `nhcx_settings` row plus the participant code from `tenants`.
#[derive(Debug, Default, sqlx::FromRow)]
pub struct StoredSettings {
    pub participant_code: Option<String>,
    pub environment: Option<String>,
    pub client_id: Option<String>,
    pub client_secret_sealed: Option<String>,
    pub private_key_sealed: Option<String>,
    pub public_cert_pem: Option<String>,
    pub gateway_jwt_public_key_pem: Option<String>,
}

impl StoredSettings {
    #[must_use]
    pub fn environment(&self) -> NhcxEnvironment {
        if self.environment.as_deref() == Some("production") {
            NhcxEnvironment::Production
        } else {
            NhcxEnvironment::Sandbox
        }
    }

    /// The participant code, when one is set.
    #[must_use]
    pub fn participant_code(&self) -> Option<&str> {
        self.participant_code
            .as_deref()
            .map(str::trim)
            .filter(|c| !c.is_empty())
    }
}

/// Read the tenant's stored settings. The connection must carry the tenant's
/// RLS context (or bypass RLS, as the outbox worker does).
///
/// # Errors
/// Database errors only; nothing saved yet is an all-`None` row.
pub async fn stored(
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<StoredSettings, ConfigError> {
    let row = sqlx::query_as::<_, StoredSettings>(
        "SELECT t.abdm_hcx_sender_code AS participant_code, s.environment, s.client_id, \
                s.client_secret_sealed, s.private_key_sealed, s.public_cert_pem, \
                s.gateway_jwt_public_key_pem \
         FROM tenants t \
         LEFT JOIN nhcx_settings s ON s.tenant_id = t.id AND s.deleted_at IS NULL \
         WHERE t.id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?;
    Ok(row.unwrap_or_default())
}

/// What a gateway sign-in needs.
pub struct Credentials {
    pub environment: NhcxEnvironment,
    pub client_id: String,
    pub client_secret: String,
}

// Hand-written so the secret can never reach a log line.
impl std::fmt::Debug for Credentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Credentials")
            .field("environment", &self.environment)
            .field("client_id", &self.client_id)
            .finish_non_exhaustive()
    }
}

/// The saved client credentials, or the server's ABDM credentials when the
/// hospital saved none.
///
/// # Errors
/// [`ConfigError::NotSetUp`] when neither exists or the saved secret cannot
/// be unsealed.
pub async fn credentials(
    stored: &StoredSettings,
    resolver: &dyn SecretResolver,
) -> Result<Credentials, ConfigError> {
    if let (Some(client_id), Some(sealed)) = (&stored.client_id, &stored.client_secret_sealed) {
        let key = sealing_key(resolver).await;
        return Ok(Credentials {
            environment: stored.environment(),
            client_id: client_id.clone(),
            client_secret: unseal(&key, CLIENT_SECRET_CONTEXT, sealed, "client secret")?,
        });
    }
    match (
        resolver.get(ENV_CLIENT_ID).await,
        resolver.get(ENV_CLIENT_SECRET).await,
    ) {
        (Ok(client_id), Ok(client_secret)) if !client_id.is_empty() => Ok(Credentials {
            environment: stored.environment(),
            client_id,
            client_secret,
        }),
        _ => Err(ConfigError::NotSetUp(
            "NHCX gateway credentials are not set up — add them in Settings → NHCX".to_owned(),
        )),
    }
}

/// Whether the server holds fallback ABDM credentials.
pub async fn has_env_credentials(resolver: &dyn SecretResolver) -> bool {
    resolver
        .get(ENV_CLIENT_ID)
        .await
        .is_ok_and(|v| !v.is_empty())
        && resolver.get(ENV_CLIENT_SECRET).await.is_ok()
}

/// The hospital's private key, unsealed.
///
/// # Errors
/// [`ConfigError::NotSetUp`] when none is saved or it cannot be unsealed.
pub async fn private_key(
    stored: &StoredSettings,
    resolver: &dyn SecretResolver,
) -> Result<String, ConfigError> {
    let sealed = stored
        .private_key_sealed
        .as_deref()
        .ok_or_else(|| ConfigError::NotSetUp("NHCX private key is not set up".to_owned()))?;
    let key = sealing_key(resolver).await;
    unseal(&key, PRIVATE_KEY_CONTEXT, sealed, "private key")
}

/// The test-only base-URL override, when the secret store names one.
pub async fn base_url_override(resolver: &dyn SecretResolver) -> Option<String> {
    resolver
        .get(medbrains_core::nhcx::BASE_URL_OVERRIDE)
        .await
        .ok()
        .map(|v| v.trim().trim_end_matches('/').to_owned())
        .filter(|v| !v.is_empty())
}
