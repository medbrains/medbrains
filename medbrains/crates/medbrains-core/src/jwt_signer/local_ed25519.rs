//! Local Ed25519 `JwtSigner`. Used in `onprem` and dev. The signing
//! key is held in memory, loaded once at boot from a sops-decrypted
//! file (or generated ephemerally for dev).
//!
//! No AWS, no KMS, no network. Verification is the same as the cloud
//! KMS flow (Ed25519 pubkey lookup by kid).

use super::{JwtSigner, JwtSignerError};
use async_trait::async_trait;
use ed25519_dalek::{Signer, SigningKey};
use std::fmt;

#[derive(Clone)]
pub struct LocalEd25519Signer {
    kid: String,
    key: SigningKey,
}

impl fmt::Debug for LocalEd25519Signer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Never log the private key; safe Debug.
        f.debug_struct("LocalEd25519Signer")
            .field("kid", &self.kid)
            .field("key", &"[redacted]")
            .finish()
    }
}

impl LocalEd25519Signer {
    pub fn new(kid: impl Into<String>, key: SigningKey) -> Self {
        Self { kid: kid.into(), key }
    }

    /// Build from raw 32-byte secret. Returns error if length is wrong.
    pub fn from_bytes(kid: impl Into<String>, bytes: &[u8]) -> Result<Self, JwtSignerError> {
        if bytes.len() != ed25519_dalek::SECRET_KEY_LENGTH {
            return Err(JwtSignerError::KeyMissing(format!(
                "expected {} bytes, got {}",
                ed25519_dalek::SECRET_KEY_LENGTH,
                bytes.len()
            )));
        }
        let mut buf = [0u8; ed25519_dalek::SECRET_KEY_LENGTH];
        buf.copy_from_slice(bytes);
        Ok(Self::new(kid, SigningKey::from_bytes(&buf)))
    }

    pub fn verifying_key_bytes(&self) -> [u8; ed25519_dalek::PUBLIC_KEY_LENGTH] {
        self.key.verifying_key().to_bytes()
    }
}

#[async_trait]
impl JwtSigner for LocalEd25519Signer {
    async fn sign(&self, kid: &str, signing_input: &[u8]) -> Result<Vec<u8>, JwtSignerError> {
        if kid != self.kid {
            return Err(JwtSignerError::KeyMissing(format!(
                "requested kid {kid}, signer holds {}",
                self.kid
            )));
        }
        Ok(self.key.sign(signing_input).to_bytes().to_vec())
    }

    fn current_kid(&self) -> &str {
        &self.kid
    }

    fn alg(&self) -> &'static str {
        "EdDSA"
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use ed25519_dalek::{Verifier, VerifyingKey};

    #[tokio::test]
    async fn sign_and_verify_roundtrip() {
        let mut secret = [0u8; 32];
        for (i, b) in secret.iter_mut().enumerate() {
            *b = i as u8;
        }
        let signer = LocalEd25519Signer::from_bytes("k1", &secret).unwrap();
        let payload = b"header.payload";
        let sig_bytes = signer.sign("k1", payload).await.unwrap();
        let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).unwrap();
        let vk = VerifyingKey::from_bytes(&signer.verifying_key_bytes()).unwrap();
        vk.verify(payload, &sig).unwrap();
    }

    #[tokio::test]
    async fn rejects_wrong_kid() {
        let signer = LocalEd25519Signer::from_bytes("k1", &[1u8; 32]).unwrap();
        let err = signer.sign("k2", b"x").await.unwrap_err();
        assert!(matches!(err, JwtSignerError::KeyMissing(_)));
    }
}
