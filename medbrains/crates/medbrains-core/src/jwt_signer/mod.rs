//! `JwtSigner` — signs / verifies JWTs without binding to AWS.
//!
//! Cloud impl signs via AWS KMS (`KMS:Sign` API, no local key
//! material) and lives in `medbrains-server`. On-prem impl uses
//! Ed25519 keys held locally (sops-encrypted on disk, decrypted by
//! Flux at deploy time, loaded at boot).
//!
//! Verification is local in both cases — every node holds the public
//! key set; only signing differs. The `kid` header lets verifiers pick
//! the right pubkey across rotations.

pub mod local_ed25519;

use async_trait::async_trait;
use std::fmt;

#[derive(Debug)]
pub enum JwtSignerError {
    KeyMissing(String),
    Sign(String),
    Verify(String),
    Backend(String),
}

impl fmt::Display for JwtSignerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::KeyMissing(m) => write!(f, "jwt key missing: {m}"),
            Self::Sign(m) => write!(f, "jwt sign: {m}"),
            Self::Verify(m) => write!(f, "jwt verify: {m}"),
            Self::Backend(m) => write!(f, "jwt backend: {m}"),
        }
    }
}

impl std::error::Error for JwtSignerError {}

#[async_trait]
pub trait JwtSigner: Send + Sync + fmt::Debug {
    /// Sign a payload (already-canonical JWT signing input bytes:
    /// header.payload). Returns the signature bytes.
    async fn sign(&self, kid: &str, signing_input: &[u8]) -> Result<Vec<u8>, JwtSignerError>;

    /// The kid the binary should put in the JWT header for this
    /// signer's current key.
    fn current_kid(&self) -> &str;

    /// The algorithm string for the JWT header (`EdDSA`, `RS256`, …).
    fn alg(&self) -> &'static str;
}

pub use local_ed25519::LocalEd25519Signer;
