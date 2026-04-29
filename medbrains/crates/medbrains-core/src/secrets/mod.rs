//! `SecretResolver` — substrate-agnostic secret lookup.
//!
//! At boot, `medbrains-server` picks an impl based on `DeployMode`:
//! - `saas` / `hybrid` cloud nodes → AWS Secrets Manager (impl in
//!   `medbrains-server`, depends on `aws-sdk-secretsmanager`)
//! - `hybrid` on-prem nodes / `onprem` → `FileSecretResolver` reading
//!   sops-decrypted files dropped by Flux at `/etc/medbrains/secrets/`
//! - dev / tests → `EnvSecretResolver` reading process env vars
//!
//! Naming convention: `medbrains/{env}/{tenant_id_or_global}/{name}`.
//! The trait normalizes that into a single `get(key)` lookup; the impl
//! decides how to resolve.

pub mod env;
pub mod file;

use async_trait::async_trait;
use std::fmt;

#[derive(Debug)]
pub enum SecretError {
    NotFound(String),
    Io(String),
    Parse(String),
    Backend(String),
}

impl fmt::Display for SecretError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(k) => write!(f, "secret not found: {k}"),
            Self::Io(m) => write!(f, "secret io: {m}"),
            Self::Parse(m) => write!(f, "secret parse: {m}"),
            Self::Backend(m) => write!(f, "secret backend: {m}"),
        }
    }
}

impl std::error::Error for SecretError {}

#[async_trait]
pub trait SecretResolver: Send + Sync + fmt::Debug {
    /// Fetch a single secret value. Implementations may cache.
    async fn get(&self, key: &str) -> Result<String, SecretError>;
}

pub use env::EnvSecretResolver;
pub use file::FileSecretResolver;
