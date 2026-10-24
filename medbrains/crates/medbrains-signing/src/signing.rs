//! Ed25519 digital signature utilities for clinical records.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.4. Two
//! representations of every signature:
//!   1. Cryptographic — Ed25519 over SHA-256 of canonical JSON payload
//!   2. Visual — image stamp on PDF documents (display_image_url)
//!
//! Private-key storage is handled by `routes::signatures`: keys are wrapped
//! with AES-GCM before they are stored in
//! `doctor_signature_credentials.encrypted_private_key`. This module only owns
//! canonicalization, key generation, signing, and verification.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SigningError {
    #[error("invalid private key length")]
    InvalidPrivateKey,

    #[error("invalid public key length")]
    InvalidPublicKey,

    #[error("invalid signature length")]
    InvalidSignature,

    #[error("signature verification failed")]
    VerifyFailed,

    #[error("canonicalization failed: {0}")]
    Canonicalize(String),
}

/// Generate a new Ed25519 keypair. Returns `(private_key_bytes,
/// public_key_bytes)`. Uses `getrandom` to avoid rand_core version
/// conflicts with `ed25519-dalek 2`.
pub fn generate_keypair() -> Result<([u8; 32], [u8; 32]), SigningError> {
    let mut seed = [0u8; 32];
    getrandom::fill(&mut seed)
        .map_err(|e| SigningError::Canonicalize(format!("getrandom: {e}")))?;
    let signing = SigningKey::from_bytes(&seed);
    let verifying = signing.verifying_key();
    Ok((signing.to_bytes(), verifying.to_bytes()))
}

/// Canonicalize a JSON value to a deterministic byte sequence: every
/// object's keys are sorted lexicographically, no extra whitespace,
/// arrays preserved in order. Required for signature stability — two
/// clients producing the same logical payload must hash to the same
/// bytes regardless of key insertion order.
pub fn canonicalize(value: &Value) -> Result<Vec<u8>, SigningError> {
    let canonical = canonical_value(value);
    serde_json::to_vec(&canonical).map_err(|e| SigningError::Canonicalize(e.to_string()))
}

fn canonical_value(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<(String, Value)> = map
                .iter()
                .map(|(k, v)| (k.clone(), canonical_value(v)))
                .collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            Value::Object(entries.into_iter().collect())
        }
        Value::Array(arr) => Value::Array(arr.iter().map(canonical_value).collect()),
        other => other.clone(),
    }
}

/// SHA-256 over the canonical bytes. Returns 32-byte digest.
#[must_use]
pub fn payload_hash(canonical_bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(canonical_bytes);
    let out = hasher.finalize();
    let mut digest = [0u8; 32];
    digest.copy_from_slice(&out);
    digest
}

/// Sign a 32-byte payload hash with the given private key.
pub fn sign(private_key: &[u8], hash: &[u8; 32]) -> Result<[u8; 64], SigningError> {
    let key_bytes: [u8; 32] = private_key
        .try_into()
        .map_err(|_| SigningError::InvalidPrivateKey)?;
    let signing = SigningKey::from_bytes(&key_bytes);
    let signature = signing.sign(hash);
    Ok(signature.to_bytes())
}

/// Verify an Ed25519 signature against the payload hash and public key.
pub fn verify(
    public_key: &[u8],
    hash: &[u8; 32],
    signature_bytes: &[u8],
) -> Result<(), SigningError> {
    let pk_bytes: [u8; 32] = public_key
        .try_into()
        .map_err(|_| SigningError::InvalidPublicKey)?;
    let verifying =
        VerifyingKey::from_bytes(&pk_bytes).map_err(|_| SigningError::InvalidPublicKey)?;
    let sig_bytes: [u8; 64] = signature_bytes
        .try_into()
        .map_err(|_| SigningError::InvalidSignature)?;
    let signature = Signature::from_bytes(&sig_bytes);
    verifying
        .verify(hash, &signature)
        .map_err(|_| SigningError::VerifyFailed)
}

/// Convenience: canonicalize → hash → sign in one call.
pub fn sign_payload(private_key: &[u8], payload: &Value) -> Result<SignedPayload, SigningError> {
    let canonical = canonicalize(payload)?;
    let hash = payload_hash(&canonical);
    let signature = sign(private_key, &hash)?;
    Ok(SignedPayload { hash, signature })
}

#[derive(Debug, Clone)]
pub struct SignedPayload {
    pub hash: [u8; 32],
    pub signature: [u8; 64],
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonical_object_keys_sorted() {
        let v = json!({ "z": 1, "a": 2, "m": { "y": 3, "x": 4 } });
        let bytes = canonicalize(&v).unwrap();
        let s = std::str::from_utf8(&bytes).unwrap();
        assert!(s.contains(r#""a":2"#));
        assert!(s.contains(r#""m":{"x":4,"y":3}"#));
        assert!(s.contains(r#""z":1"#));
    }

    #[test]
    fn sign_and_verify_round_trip() {
        let (priv_key, pub_key) = generate_keypair().unwrap();
        let payload = json!({ "patient": "X", "drug": "metformin", "dose": "500mg" });
        let signed = sign_payload(&priv_key, &payload).unwrap();
        verify(&pub_key, &signed.hash, &signed.signature).unwrap();
    }

    #[test]
    fn signature_fails_on_tampered_payload() {
        let (priv_key, pub_key) = generate_keypair().unwrap();
        let payload = json!({ "patient": "X", "amount": 1000 });
        let signed = sign_payload(&priv_key, &payload).unwrap();

        // Tamper: change amount, re-hash, verify against original signature
        let tampered = json!({ "patient": "X", "amount": 9999 });
        let tampered_canonical = canonicalize(&tampered).unwrap();
        let tampered_hash = payload_hash(&tampered_canonical);

        let r = verify(&pub_key, &tampered_hash, &signed.signature);
        assert!(r.is_err());
    }

    /// RFC 8032 §7.1, test 1. Keys stored in the database and signatures
    /// already issued were made with ed25519-dalek 2; the same seed must give
    /// the same public key and the same signature after the upgrade, or every
    /// stored key and issued signature stops verifying.
    #[test]
    fn rfc8032_vector_is_unchanged() {
        let hex32 = |s: &str| -> [u8; 32] { hex::decode(s).unwrap().try_into().unwrap() };
        let seed = hex32("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
        let public = hex32("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
        let expected = hex::decode(
            "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
        )
        .unwrap();

        let signing = SigningKey::from_bytes(&seed);
        assert_eq!(signing.verifying_key().to_bytes(), public);
        let signature = ed25519_dalek::Signer::sign(&signing, b"");
        assert_eq!(signature.to_bytes().to_vec(), expected);
        let sig: [u8; 64] = expected.try_into().unwrap();
        let verifying = VerifyingKey::from_bytes(&public).unwrap();
        assert!(
            ed25519_dalek::Verifier::verify(&verifying, b"", &ed25519_dalek::Signature::from_bytes(&sig))
                .is_ok()
        );
    }
}
