use figment::{
    Figment,
    providers::{Env, Format, Serialized, Toml},
};
use serde::{Deserialize, Serialize};

/// Intermediate config struct for Figment extraction.
/// Fields match the env var names (lowercased) and config.toml keys.
#[derive(Debug, Deserialize, Serialize)]
struct RawConfig {
    /// Deployment environment: "development" (default) or "production".
    /// Set via MEDBRAINS_ENV. Production refuses to start without real JWT keys.
    #[serde(default)]
    medbrains_env: Option<String>,
    #[serde(default)]
    database_url: Option<String>,
    #[serde(default)]
    yottadb_url: Option<String>,
    #[serde(default = "default_db_pool_max_connections")]
    db_pool_max_connections: u32,
    #[serde(default = "default_db_pool_min_connections")]
    db_pool_min_connections: u32,
    #[serde(default = "default_db_pool_acquire_timeout_secs")]
    db_pool_acquire_timeout_secs: u64,
    #[serde(default = "default_db_pool_idle_timeout_secs")]
    db_pool_idle_timeout_secs: u64,
    #[serde(default = "default_db_pool_max_lifetime_secs")]
    db_pool_max_lifetime_secs: u64,
    #[serde(default = "default_db_statement_cache_capacity")]
    db_statement_cache_capacity: usize,
    #[serde(default = "default_db_slow_query_ms")]
    db_slow_query_ms: u64,
    #[serde(default = "default_host")]
    host: String,
    #[serde(default = "default_port")]
    port: u16,
    #[serde(default)]
    jwt_private_key: Option<String>,
    #[serde(default)]
    jwt_public_key: Option<String>,
    #[serde(default = "default_cors_origin")]
    cors_origin: String,
    #[serde(default)]
    cookie_domain: Option<String>,
    #[serde(default)]
    secure_cookies: Option<bool>,
    /// Comma-separated list of trusted proxy CIDRs (e.g., "10.0.0.0/8,172.16.0.0/12")
    /// Only trust X-Forwarded-For/X-Real-IP headers from these IPs.
    #[serde(default)]
    trusted_proxies: Option<String>,
    #[serde(default)]
    static_dir: Option<String>,
    // S3-compatible object storage for file uploads (MLC, MRD, consent, etc.)
    #[serde(default)]
    s3_bucket: Option<String>,
    #[serde(default)]
    s3_region: Option<String>,
    #[serde(default)]
    s3_endpoint: Option<String>,
    #[serde(default)]
    s3_access_key_id: Option<String>,
    #[serde(default)]
    s3_secret_access_key: Option<String>,
    /// Gotenberg (headless Chrome) base URL for server-side PDF
    /// rendering, e.g. http://127.0.0.1:3005. Unset = PDF endpoints 503.
    #[serde(default)]
    gotenberg_url: Option<String>,
}

fn default_host() -> String {
    "0.0.0.0".to_owned()
}

const fn default_port() -> u16 {
    3000
}

fn default_cors_origin() -> String {
    "https://medbrains.localhost".to_owned()
}

const fn default_db_pool_max_connections() -> u32 {
    20
}

const fn default_db_pool_min_connections() -> u32 {
    2
}

const fn default_db_pool_acquire_timeout_secs() -> u64 {
    5
}

const fn default_db_pool_idle_timeout_secs() -> u64 {
    600
}

const fn default_db_pool_max_lifetime_secs() -> u64 {
    1800
}

const fn default_db_statement_cache_capacity() -> usize {
    256
}

const fn default_db_slow_query_ms() -> u64 {
    250
}

/// Application configuration loaded from layered sources.
///
/// Layer order (later wins):
/// 1. Compiled defaults (host=`0.0.0.0`, port=`3000`)
/// 2. `config.toml` file (if present)
/// 3. Environment variables (highest priority)
///
/// `.env` files are loaded by `dotenvy` before Figment reads env vars,
/// so `.env` values participate in layer 3.
#[derive(Debug, Clone)]
pub struct AppConfig {
    /// "development" or "production" (MEDBRAINS_ENV).
    pub environment: String,
    pub database_url: String,
    pub yottadb_url: Option<String>,
    pub db_pool_max_connections: u32,
    pub db_pool_min_connections: u32,
    pub db_pool_acquire_timeout_secs: u64,
    pub db_pool_idle_timeout_secs: u64,
    pub db_pool_max_lifetime_secs: u64,
    pub db_statement_cache_capacity: usize,
    pub db_slow_query_ms: u64,
    pub host: String,
    pub port: u16,
    pub jwt_private_key_pem: String,
    pub jwt_public_key_pem: String,
    pub cors_origin: String,
    pub cookie_domain: Option<String>,
    pub secure_cookies: bool,
    /// Parsed trusted proxy CIDRs for X-Forwarded-For validation.
    pub trusted_proxies: Vec<ipnet::IpNet>,
    /// Directory containing frontend static files (SPA dist)
    pub static_dir: Option<String>,
    pub s3_bucket: Option<String>,
    pub s3_region: Option<String>,
    pub s3_endpoint: Option<String>,
    pub s3_access_key_id: Option<String>,
    pub s3_secret_access_key: Option<String>,
    pub gotenberg_url: Option<String>,
}

impl AppConfig {
    /// Load configuration from layered sources: defaults → `config.toml` → env vars.
    pub fn load() -> Result<Self, ConfigError> {
        let raw: RawConfig = Figment::new()
            .merge(Serialized::defaults(RawConfig {
                medbrains_env: None,
                database_url: None,
                yottadb_url: None,
                db_pool_max_connections: default_db_pool_max_connections(),
                db_pool_min_connections: default_db_pool_min_connections(),
                db_pool_acquire_timeout_secs: default_db_pool_acquire_timeout_secs(),
                db_pool_idle_timeout_secs: default_db_pool_idle_timeout_secs(),
                db_pool_max_lifetime_secs: default_db_pool_max_lifetime_secs(),
                db_statement_cache_capacity: default_db_statement_cache_capacity(),
                db_slow_query_ms: default_db_slow_query_ms(),
                host: default_host(),
                port: default_port(),
                jwt_private_key: None,
                jwt_public_key: None,
                cors_origin: default_cors_origin(),
                cookie_domain: None,
                secure_cookies: None,
                trusted_proxies: None,
                static_dir: None,
                s3_bucket: None,
                s3_region: None,
                s3_endpoint: None,
                s3_access_key_id: None,
                s3_secret_access_key: None,
                gotenberg_url: None,
            }))
            .merge(Toml::file("config.toml"))
            .merge(Env::raw())
            .extract()
            .map_err(|e| ConfigError::Figment(e.to_string()))?;

        let database_url = raw.database_url.ok_or_else(|| ConfigError::Missing {
            key: "DATABASE_URL".to_owned(),
        })?;

        if raw.db_pool_min_connections > raw.db_pool_max_connections {
            return Err(ConfigError::Invalid {
                key: "DB_POOL_MIN_CONNECTIONS".to_owned(),
                reason: "must be less than or equal to DB_POOL_MAX_CONNECTIONS".to_owned(),
            });
        }

        let environment = raw
            .medbrains_env
            .unwrap_or_else(|| "development".to_owned())
            .to_lowercase();

        // JWT keys: if both are set use them, otherwise generate dev keypair.
        // Production must never run on an ephemeral keypair — a restart would
        // silently invalidate every active session.
        let (private_pem, public_pem) = match (raw.jwt_private_key, raw.jwt_public_key) {
            (Some(priv_key), Some(pub_key)) => (priv_key, pub_key),
            _ if environment == "production" => {
                return Err(ConfigError::Invalid {
                    key: "JWT_PRIVATE_KEY / JWT_PUBLIC_KEY".to_owned(),
                    reason: "both must be set when MEDBRAINS_ENV=production; refusing to \
                             generate an ephemeral keypair"
                        .to_owned(),
                });
            }
            _ => generate_dev_keypair()?,
        };

        // Parse trusted proxies from comma-separated CIDR list
        let trusted_proxies: Vec<ipnet::IpNet> = raw
            .trusted_proxies
            .map(|s| {
                s.split(',')
                    .filter_map(|cidr| {
                        let trimmed = cidr.trim();
                        if trimmed.is_empty() {
                            return None;
                        }
                        match trimmed.parse::<ipnet::IpNet>() {
                            Ok(net) => Some(net),
                            Err(e) => {
                                tracing::warn!("Invalid trusted proxy CIDR '{trimmed}': {e}");
                                None
                            }
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        if trusted_proxies.is_empty() {
            tracing::warn!(
                "No TRUSTED_PROXIES configured — X-Forwarded-For headers will be trusted from any source. \
                 Set TRUSTED_PROXIES to restrict (e.g., '10.0.0.0/8,172.16.0.0/12')"
            );
        } else {
            tracing::info!("Trusted proxy CIDRs: {:?}", trusted_proxies);
        }

        Ok(Self {
            environment,
            database_url,
            yottadb_url: raw.yottadb_url,
            s3_bucket: raw.s3_bucket,
            s3_region: raw.s3_region,
            s3_endpoint: raw.s3_endpoint,
            s3_access_key_id: raw.s3_access_key_id,
            s3_secret_access_key: raw.s3_secret_access_key,
            gotenberg_url: raw.gotenberg_url,
            db_pool_max_connections: raw.db_pool_max_connections,
            db_pool_min_connections: raw.db_pool_min_connections,
            db_pool_acquire_timeout_secs: raw.db_pool_acquire_timeout_secs,
            db_pool_idle_timeout_secs: raw.db_pool_idle_timeout_secs,
            db_pool_max_lifetime_secs: raw.db_pool_max_lifetime_secs,
            db_statement_cache_capacity: raw.db_statement_cache_capacity,
            db_slow_query_ms: raw.db_slow_query_ms,
            host: raw.host,
            port: raw.port,
            jwt_private_key_pem: private_pem,
            jwt_public_key_pem: public_pem,
            cors_origin: raw.cors_origin,
            cookie_domain: raw.cookie_domain,
            secure_cookies: raw.secure_cookies.unwrap_or(false),
            trusted_proxies,
            static_dir: raw.static_dir,
        })
    }

    /// Backward-compatible alias for [`Self::load`].
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::load()
    }

    /// Build the socket address string.
    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing required config key: {key}")]
    Missing { key: String },

    #[error("invalid config value for {key}: {reason}")]
    Invalid { key: String, reason: String },

    #[error("configuration error: {0}")]
    Figment(String),

    #[error("key generation error: {0}")]
    KeyGen(String),
}

/// Ed25519 PKCS#8 DER prefix (16 bytes) — wraps a 32-byte seed into a valid PKCS#8 structure.
const PKCS8_ED25519_PREFIX: [u8; 16] = [
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
];

/// Generate an Ed25519 keypair for dev use when no key files are configured.
fn generate_dev_keypair() -> Result<(String, String), ConfigError> {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;

    tracing::warn!(
        "No JWT_PRIVATE_KEY / JWT_PUBLIC_KEY set — generating ephemeral Ed25519 dev keypair"
    );

    // Generate 32 random bytes for Ed25519 seed using getrandom (no rand_core conflict)
    let mut seed = [0u8; 32];
    getrandom::fill(&mut seed).map_err(|e| ConfigError::KeyGen(format!("getrandom error: {e}")))?;

    let signing_key = ed25519_dalek::SigningKey::from_bytes(&seed);
    let verifying_key = signing_key.verifying_key();

    // Private key: PKCS#8 DER format (required by jsonwebtoken EncodingKey::from_ed_der)
    let mut pkcs8_der = Vec::with_capacity(48);
    pkcs8_der.extend_from_slice(&PKCS8_ED25519_PREFIX);
    pkcs8_der.extend_from_slice(&seed);

    // Public key: raw 32 bytes (jsonwebtoken DecodingKey reads first 32 bytes directly)
    let private_b64 = STANDARD.encode(&pkcs8_der);
    let public_b64 = STANDARD.encode(verifying_key.to_bytes());

    Ok((private_b64, public_b64))
}
