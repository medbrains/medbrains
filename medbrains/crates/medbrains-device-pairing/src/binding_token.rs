//! The signed hospital-binding token a QR carries — pure signing and
//! verification, no I/O. Wire contract: a compact JWS (`EdDSA`,
//! `typ: mb-binding+jws`) whose payload names the hospital, the server's
//! base URL, its TLS key pin, the issuer key and a single- or limited-use
//! nonce.
//!
//! The key is dedicated, not the session-JWT key: it is pinned into every
//! bound app for as long as the app stays bound, so it must rotate on its own
//! schedule, never together with session signing; and it signs text an
//! administrator chose, which a session key should never do.

use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// What the QR text starts with; the token follows.
pub const QR_PREFIX: &str = "medbrains://bind?t=";
/// The JWS `typ` that marks a binding token (never a session token).
pub const TOKEN_TYPE: &str = "mb-binding+jws";
/// The audience every binding token names.
pub const AUDIENCE: &str = "medbrains-app";
/// Payload version.
pub const VERSION: u8 = 1;
/// What the server signs to prove it holds the QR's key.
const PROOF_DOMAIN: &str = "mb-binding-proof:v1";

#[derive(Debug, Serialize, Deserialize)]
struct Header {
    alg: String,
    typ: String,
    kid: String,
}

/// The claims a binding token carries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BindingClaims {
    pub v: u8,
    pub iss: String,
    pub aud: String,
    pub tenant: String,
    pub tenant_name: String,
    pub api_base: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spki: Option<String>,
    pub ik: String,
    pub jti: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TokenError {
    #[error("binding signing key is not a base64 32-byte Ed25519 seed")]
    BadKey,
    #[error("binding code is malformed")]
    Malformed,
    #[error("binding code signature does not verify")]
    BadSignature,
}

/// The binding key from its base64 32-byte seed (the configured secret).
///
/// # Errors
/// `BadKey` when the value is not a base64 32-byte seed.
pub fn signing_key(seed_b64: &str) -> Result<SigningKey, TokenError> {
    let bytes = STANDARD
        .decode(seed_b64.trim())
        .map_err(|_| TokenError::BadKey)?;
    let seed: [u8; 32] = bytes.try_into().map_err(|_| TokenError::BadKey)?;
    Ok(SigningKey::from_bytes(&seed))
}

/// The public key as it travels: 32 raw bytes, base64url without padding.
pub fn issuer_key(key: &SigningKey) -> String {
    URL_SAFE_NO_PAD.encode(key.verifying_key().as_bytes())
}

/// First 8 bytes of SHA-256 of the raw public key, as hex.
fn key_id(key: &VerifyingKey) -> String {
    hex::encode(&Sha256::digest(key.as_bytes())[..8])
}

/// Sign `claims` into a compact JWS.
///
/// # Errors
/// `Malformed` if the claims cannot be serialised.
pub fn sign(key: &SigningKey, claims: &BindingClaims) -> Result<String, TokenError> {
    let header = Header {
        alg: "EdDSA".to_owned(),
        typ: TOKEN_TYPE.to_owned(),
        kid: key_id(&key.verifying_key()),
    };
    let input = format!("{}.{}", encode_json(&header)?, encode_json(claims)?);
    let sig = key.sign(input.as_bytes());
    Ok(format!(
        "{input}.{}",
        URL_SAFE_NO_PAD.encode(sig.to_bytes())
    ))
}

/// Verify a token (or the QR text that carries it) with this server's key,
/// returning its claims. Expiry and use are the caller's to judge — they
/// need the database to answer apart.
///
/// # Errors
/// `Malformed` for anything that is not a binding token of this version;
/// `BadSignature` when it was not signed by `key` or was altered.
pub fn verify(key: &VerifyingKey, token: &str) -> Result<BindingClaims, TokenError> {
    let token = token.trim();
    let token = token.strip_prefix(QR_PREFIX).unwrap_or(token);
    let mut parts = token.split('.');
    let (Some(h), Some(p), Some(s), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(TokenError::Malformed);
    };
    let header: Header = decode_json(h)?;
    if header.alg != "EdDSA" || header.typ != TOKEN_TYPE {
        return Err(TokenError::Malformed);
    }
    let sig_bytes: [u8; 64] = URL_SAFE_NO_PAD
        .decode(s)
        .map_err(|_| TokenError::Malformed)?
        .try_into()
        .map_err(|_| TokenError::Malformed)?;
    key.verify(
        format!("{h}.{p}").as_bytes(),
        &Signature::from_bytes(&sig_bytes),
    )
    .map_err(|_| TokenError::BadSignature)?;
    let claims: BindingClaims = decode_json(p)?;
    if claims.v != VERSION || claims.aud != AUDIENCE {
        return Err(TokenError::Malformed);
    }
    Ok(claims)
}

/// The server's answer to a device's challenge: proof that the server the
/// device reached (over the pinned TLS key) holds the QR's signing key.
pub fn proof(key: &SigningKey, jti: &str, challenge: &str) -> String {
    let message = format!("{PROOF_DOMAIN}:{jti}:{challenge}");
    URL_SAFE_NO_PAD.encode(key.sign(message.as_bytes()).to_bytes())
}

/// A random nonce: a v4 UUID's bytes (122 random bits), base64url.
pub fn new_nonce() -> String {
    URL_SAFE_NO_PAD.encode(uuid::Uuid::new_v4().as_bytes())
}

/// Whether `pin` looks like a base64 SHA-256 (the `OkHttp` `sha256/` form).
pub fn is_spki_pin(pin: &str) -> bool {
    STANDARD.decode(pin).is_ok_and(|b| b.len() == 32)
}

fn encode_json<T: Serialize>(value: &T) -> Result<String, TokenError> {
    let bytes = serde_json::to_vec(value).map_err(|_| TokenError::Malformed)?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn decode_json<T: for<'de> Deserialize<'de>>(segment: &str) -> Result<T, TokenError> {
    let bytes = URL_SAFE_NO_PAD
        .decode(segment)
        .map_err(|_| TokenError::Malformed)?;
    serde_json::from_slice(&bytes).map_err(|_| TokenError::Malformed)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    fn claims(key: &SigningKey) -> BindingClaims {
        BindingClaims {
            v: VERSION,
            iss: "https://h.test".into(),
            aud: AUDIENCE.into(),
            tenant: "AMH".into(),
            tenant_name: "AMH".into(),
            api_base: "https://h.test".into(),
            spki: Some(STANDARD.encode([1u8; 32])),
            ik: issuer_key(key),
            jti: new_nonce(),
            iat: 1,
            exp: 2,
        }
    }

    #[test]
    fn a_signed_token_verifies_and_round_trips() {
        let k = key();
        let c = claims(&k);
        let qr = format!("{QR_PREFIX}{}", sign(&k, &c).unwrap());
        assert_eq!(verify(&k.verifying_key(), &qr).unwrap(), c);
    }

    #[test]
    fn an_altered_payload_or_another_key_is_refused() {
        let k = key();
        let token = sign(&k, &claims(&k)).unwrap();
        let mut parts: Vec<&str> = token.split('.').collect();
        let mut forged = claims(&k);
        forged.api_base = "https://evil.test".into();
        let forged_payload = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&forged).unwrap());
        parts[1] = &forged_payload;
        assert_eq!(
            verify(&k.verifying_key(), &parts.join(".")),
            Err(TokenError::BadSignature)
        );
        let other = SigningKey::from_bytes(&[8u8; 32]);
        assert_eq!(
            verify(&other.verifying_key(), &token),
            Err(TokenError::BadSignature)
        );
        assert_eq!(
            verify(&k.verifying_key(), "a.b"),
            Err(TokenError::Malformed)
        );
    }

    #[test]
    fn the_proof_verifies_with_the_issuer_key() {
        let k = key();
        let sig: [u8; 64] = URL_SAFE_NO_PAD
            .decode(proof(&k, "j", "c"))
            .unwrap()
            .try_into()
            .unwrap();
        let msg = format!("{PROOF_DOMAIN}:j:c");
        assert!(
            k.verifying_key()
                .verify(msg.as_bytes(), &Signature::from_bytes(&sig))
                .is_ok()
        );
    }

    #[test]
    fn a_seed_must_be_32_bytes_and_a_pin_a_sha256() {
        assert!(signing_key(&STANDARD.encode([1u8; 32])).is_ok());
        assert_eq!(signing_key("short").err(), Some(TokenError::BadKey));
        assert!(is_spki_pin(&STANDARD.encode([0u8; 32])));
        assert!(!is_spki_pin("nope"));
    }
}
