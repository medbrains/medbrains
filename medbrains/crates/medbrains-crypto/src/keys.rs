//! Loading key material so that a damaged key is refused, never used.
//!
//! The eMudhra CA incident: a key-handling script truncated private keys and
//! nothing checked the result. Every check here answers "is this the key we
//! think it is?" before the key signs anything:
//!
//! - an Ed25519 seed must be exactly 32 bytes and not one repeated byte
//!   (all zeros is the usual result of a failed read);
//! - the seed must derive the public key it was configured or stored with;
//! - a public key must not be a small-order ("weak") point, and signatures
//!   are checked with `verify_strict`;
//! - the JWT pair is parsed with the real PKCS#8 / SPKI decoders and proven by
//!   signing and verifying a probe token with the library that will do it for
//!   every request.
//!
//! Errors name what is wrong, never the bytes. Raw-key constructors belong in
//! this module only (`make check-raw-key-bytes`).

use base64::{Engine, engine::general_purpose::STANDARD as B64};
use ed25519_dalek::{Signature, SigningKey, VerifyingKey};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use openssl::pkey::{Id, PKey};
use sha2::{Digest, Sha256};
use thiserror::Error;

/// Bytes in an Ed25519 seed and in an Ed25519 public key.
const ED25519_LEN: usize = 32;
/// Bytes of the SHA-256 digest shown in a fingerprint.
const FINGERPRINT_BYTES: usize = 8;

/// Why a key was refused. Never carries key bytes.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum KeyError {
    #[error("{what} must be {expected} bytes, found {got}: the key was cut or padded")]
    Length {
        what: &'static str,
        expected: usize,
        got: usize,
    },
    #[error("{0} is one byte repeated (all zeros?): a failed read, not a key")]
    Degenerate(&'static str),
    #[error("{0} does not belong to its public key: the pair does not match")]
    Mismatch(&'static str),
    #[error("{0} is not an Ed25519 key")]
    WrongType(&'static str),
    #[error("{0} could not be parsed")]
    Unparsable(&'static str),
    #[error("{0} is a small-order point and cannot verify anything")]
    Weak(&'static str),
    #[error("{0}: a signature made with the key did not verify")]
    Signature(&'static str),
}

/// An Ed25519 signing key from a raw 32-byte seed, proven to derive
/// `expected_public`.
///
/// # Errors
/// A seed of the wrong length or one repeated byte, a bad expected public
/// key, or a seed that does not derive it.
pub fn ed25519_signing_key(
    seed: &[u8],
    expected_public: &[u8],
    what: &'static str,
) -> Result<SigningKey, KeyError> {
    let seed: [u8; ED25519_LEN] = seed.try_into().map_err(|_| KeyError::Length {
        what,
        expected: ED25519_LEN,
        got: seed.len(),
    })?;
    if seed.iter().all(|b| *b == seed[0]) {
        return Err(KeyError::Degenerate(what));
    }
    let expected = ed25519_public_key(expected_public, what)?;
    let key = SigningKey::from_bytes(&seed);
    if key.verifying_key() != expected {
        return Err(KeyError::Mismatch(what));
    }
    Ok(key)
}

/// An Ed25519 public key from its raw 32 bytes, refusing small-order points.
///
/// # Errors
/// The wrong length, bytes that are not a curve point, or a weak point.
pub fn ed25519_public_key(bytes: &[u8], what: &'static str) -> Result<VerifyingKey, KeyError> {
    let raw: [u8; ED25519_LEN] = bytes.try_into().map_err(|_| KeyError::Length {
        what,
        expected: ED25519_LEN,
        got: bytes.len(),
    })?;
    let key = VerifyingKey::from_bytes(&raw).map_err(|_| KeyError::Unparsable(what))?;
    if key.is_weak() {
        return Err(KeyError::Weak(what));
    }
    Ok(key)
}

/// Check `signature` over `message` the strict way (no malleable or
/// small-order components).
///
/// # Errors
/// [`KeyError::Signature`] when it does not verify or is not 64 bytes.
pub fn verify_strict(
    key: &VerifyingKey,
    message: &[u8],
    signature: &[u8],
    what: &'static str,
) -> Result<(), KeyError> {
    let signature = Signature::from_slice(signature).map_err(|_| KeyError::Signature(what))?;
    key.verify_strict(message, &signature)
        .map_err(|_| KeyError::Signature(what))
}

/// A short, non-secret name for a public key, for logs: `SHA256:` and the
/// first 8 bytes of its digest, hex.
#[must_use]
pub fn fingerprint(public: &[u8]) -> String {
    use std::fmt::Write;
    let digest = Sha256::digest(public);
    digest
        .iter()
        .take(FINGERPRINT_BYTES)
        .fold(String::from("SHA256:"), |mut out, b| {
            let _ = write!(out, "{b:02x}");
            out
        })
}

/// The server's JWT signing pair, proven to work together.
pub struct JwtKeys {
    pub encoding: EncodingKey,
    pub decoding: DecodingKey,
    /// [`fingerprint`] of the public key, for the start-up log.
    pub fingerprint: String,
}

// Hand-written so key material never reaches a log line: only the fingerprint.
impl std::fmt::Debug for JwtKeys {
    /// Shows the fingerprint and nothing else.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JwtKeys")
            .field("fingerprint", &self.fingerprint)
            .finish_non_exhaustive()
    }
}

/// Parse `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` and prove they are one pair.
///
/// The private key is PKCS#8, as PEM or base64 DER. The public key is SPKI, as
/// PEM or base64 DER, or the raw 32 bytes base64 (what installs before this
/// check wrote). A probe token is signed and verified with `jsonwebtoken`.
///
/// # Errors
/// Either key unparsable, not Ed25519, damaged, or not the other's half.
pub fn jwt_keys(private_text: &str, public_text: &str) -> Result<JwtKeys, KeyError> {
    const PRIVATE: &str = "JWT_PRIVATE_KEY";
    const PUBLIC: &str = "JWT_PUBLIC_KEY";
    let private = jwt_private(private_text)?;
    let seed = private
        .raw_private_key()
        .map_err(|_| KeyError::Unparsable(PRIVATE))?;
    let public = jwt_public(public_text)?;
    ed25519_public_key(&public, PUBLIC)?;
    ed25519_signing_key(&seed, &public, PRIVATE)?;
    let pkcs8 = private
        .private_key_to_pkcs8()
        .map_err(|_| KeyError::Unparsable(PRIVATE))?;
    let keys = JwtKeys {
        encoding: EncodingKey::from_ed_der(&pkcs8),
        decoding: DecodingKey::from_ed_der(&public),
        fingerprint: fingerprint(&public),
    };
    probe(&keys).map_err(|()| KeyError::Signature(PUBLIC))?;
    Ok(keys)
}

/// The PKCS#8 private key in `text` (PEM, or base64 DER).
fn jwt_private(text: &str) -> Result<PKey<openssl::pkey::Private>, KeyError> {
    const WHAT: &str = "JWT_PRIVATE_KEY";
    let text = text.trim();
    let key = if text.starts_with("-----BEGIN") {
        PKey::private_key_from_pem(text.as_bytes())
    } else {
        let der = B64.decode(text).map_err(|_| KeyError::Unparsable(WHAT))?;
        PKey::private_key_from_pkcs8(&der)
    }
    .map_err(|_| KeyError::Unparsable(WHAT))?;
    if key.id() != Id::ED25519 {
        return Err(KeyError::WrongType(WHAT));
    }
    Ok(key)
}

/// The raw 32-byte Ed25519 public key in `text` (SPKI PEM, SPKI base64 DER,
/// or raw base64).
fn jwt_public(text: &str) -> Result<Vec<u8>, KeyError> {
    const WHAT: &str = "JWT_PUBLIC_KEY";
    let text = text.trim();
    let key = if text.starts_with("-----BEGIN") {
        PKey::public_key_from_pem(text.as_bytes())
    } else {
        let der = B64.decode(text).map_err(|_| KeyError::Unparsable(WHAT))?;
        if der.len() == ED25519_LEN {
            return Ok(der);
        }
        PKey::public_key_from_der(&der)
    }
    .map_err(|_| KeyError::Unparsable(WHAT))?;
    if key.id() != Id::ED25519 {
        return Err(KeyError::WrongType(WHAT));
    }
    key.raw_public_key().map_err(|_| KeyError::Unparsable(WHAT))
}

/// Sign a throwaway token with the private key and verify it with the
/// public one, through the same library that handles every request.
fn probe(keys: &JwtKeys) -> Result<(), ()> {
    let claims = serde_json::json!({ "sub": "boot-probe" });
    let token = jsonwebtoken::encode(&Header::new(Algorithm::EdDSA), &claims, &keys.encoding)
        .map_err(|_| ())?;
    let mut validation = Validation::new(Algorithm::EdDSA);
    validation.validate_exp = false;
    validation.validate_aud = false;
    validation.required_spec_claims.clear();
    jsonwebtoken::decode::<serde_json::Value>(&token, &keys.decoding, &validation)
        .map(|_| ())
        .map_err(|_| ())
}

#[cfg(test)]
#[path = "keys_tests.rs"]
mod tests;
