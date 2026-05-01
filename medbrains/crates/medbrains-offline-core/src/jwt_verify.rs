//! Offline JWT verification.
//!
//! Phase A.1 of the mobile/TV/edge expansion roadmap. Pure logic —
//! signature + expiry only, no token issuance, no async, no I/O.
//! The cloud is the only JWT issuer; devices verify what they're
//! handed.
//!
//! # Algorithm
//!
//! Ed25519 (`EdDSA`). Cloud signs with its private key; every device
//! verifies with the cloud's public key (distributed at app build
//! time or pulled at first launch).
//!
//! # Replay window
//!
//! `iat` (issued-at) ± `clock_skew_tolerance` (default 5 minutes)
//! defines the acceptable window. Tokens from the future or older
//! than `exp` are rejected. The `exp` check is straight comparison
//! against the host clock — devices with badly-drifted clocks (old
//! Android tablets) need NTP at boot or this returns `Expired` even
//! for valid tokens.
//!
//! # Revocation
//!
//! Verification only checks signature + expiry. Revocation is a
//! separate layer ([`crate::revocation_cache`]) — the consumer
//! calls `verify_jwt` first, then `is_revoked(claims.sub,
//! claims.iat)` if the token is otherwise valid.

use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror::Error;
use uuid::Uuid;

/// Outcome of a JWT verification attempt.
///
/// Distinct enum (rather than `Result`) so consumers can branch on
/// the specific failure mode without inspecting error strings —
/// mobile UIs surface different toasts for "session expired" vs
/// "your account was disabled".
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JwtOutcome {
    /// Signature + expiry checks passed. Caller must still
    /// consult [`crate::revocation_cache::RevocationCache`] before
    /// honoring.
    Valid(JwtClaims),
    /// `exp < now - clock_skew`. Refresh flow.
    Expired,
    /// `iat > now + clock_skew`. Token from the future.
    NotYetValid,
    /// Cryptographic verification failed. Don't auto-retry —
    /// either tampered or signed by the wrong key.
    InvalidSignature,
    /// Header / payload / segment-count problem. Token is
    /// structurally broken; report and discard.
    Malformed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JwtClaims {
    /// User id — the subject of the token.
    pub sub: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Issued-at, seconds since epoch.
    pub iat: i64,
    /// Expiry, seconds since epoch.
    pub exp: i64,
    /// Department ids the user is scoped to (for dept-RLS).
    #[serde(default)]
    pub department_ids: Vec<Uuid>,
    /// Flat permission strings (e.g. `"opd.visit.create"`). Used
    /// only as a fallback when the AuthzCache misses for a non-
    /// online-required action.
    #[serde(default)]
    pub permissions: Vec<String>,
    /// Role label for analytics + UI gating. Authoritative
    /// permission check is `permissions` + AuthzCache.
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Error)]
pub enum VerifyError {
    /// The supplied verifying key was malformed.
    #[error("verifying key: {0}")]
    BadVerifyingKey(String),
}

/// Public-key handle for Ed25519 verification. Wraps an
/// `ed25519_dalek::VerifyingKey` so the public surface stays simple
/// while crypto correctness is delegated to a vetted implementation.
#[derive(Debug, Clone)]
pub struct VerifyingKey {
    inner: ed25519_dalek::VerifyingKey,
}

impl VerifyingKey {
    /// 32-byte Ed25519 public key. Returns `BadVerifyingKey` if the
    /// bytes don't form a valid curve point.
    pub fn from_bytes(bytes: [u8; 32]) -> Result<Self, VerifyError> {
        let inner = ed25519_dalek::VerifyingKey::from_bytes(&bytes)
            .map_err(|e| VerifyError::BadVerifyingKey(e.to_string()))?;
        Ok(Self { inner })
    }

    pub fn as_bytes(&self) -> [u8; 32] {
        self.inner.to_bytes()
    }
}

/// Default clock-skew tolerance per NHA / RFC 7519 best practice.
pub const DEFAULT_CLOCK_SKEW: Duration = Duration::from_secs(300);

/// Verify a JWT and return a typed outcome.
///
/// `now` is parameterized so tests can drive the clock; production
/// passes `SystemTime::now()`.
pub fn verify_jwt(
    token: &str,
    public_key: &VerifyingKey,
    now: SystemTime,
    clock_skew: Duration,
) -> JwtOutcome {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return JwtOutcome::Malformed(format!(
            "expected 3 segments separated by '.', got {}",
            parts.len()
        ));
    }

    let header_b64 = parts[0];
    let payload_b64 = parts[1];
    let signature_b64 = parts[2];

    // Header sanity-check: alg must be EdDSA.
    let header_bytes = match base64url_decode(header_b64) {
        Ok(b) => b,
        Err(e) => return JwtOutcome::Malformed(format!("header base64: {e}")),
    };
    let header: serde_json::Value = match serde_json::from_slice(&header_bytes) {
        Ok(v) => v,
        Err(e) => return JwtOutcome::Malformed(format!("header parse: {e}")),
    };
    if header.get("alg").and_then(|v| v.as_str()) != Some("EdDSA") {
        return JwtOutcome::Malformed("alg must be EdDSA".to_owned());
    }

    let signature_bytes = match base64url_decode(signature_b64) {
        Ok(b) => b,
        Err(e) => return JwtOutcome::Malformed(format!("signature base64: {e}")),
    };
    if signature_bytes.len() != 64 {
        return JwtOutcome::Malformed(format!(
            "Ed25519 signature must be 64 bytes, got {}",
            signature_bytes.len()
        ));
    }

    let signed_input = format!("{header_b64}.{payload_b64}");
    if !verify_signature_bytes(public_key, signed_input.as_bytes(), &signature_bytes) {
        return JwtOutcome::InvalidSignature;
    }

    let payload_bytes = match base64url_decode(payload_b64) {
        Ok(b) => b,
        Err(e) => return JwtOutcome::Malformed(format!("payload base64: {e}")),
    };
    let claims: JwtClaims = match serde_json::from_slice(&payload_bytes) {
        Ok(c) => c,
        Err(e) => return JwtOutcome::Malformed(format!("payload parse: {e}")),
    };

    let now_unix = now
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let skew = clock_skew.as_secs() as i64;

    if claims.iat - skew > now_unix {
        return JwtOutcome::NotYetValid;
    }
    if claims.exp + skew < now_unix {
        return JwtOutcome::Expired;
    }

    JwtOutcome::Valid(claims)
}

/// Inner verification via `ed25519_dalek::VerifyingKey::verify_strict`.
/// Strict mode rejects signatures with non-canonical encodings of the
/// `s` scalar — important for cross-implementation compatibility (see
/// <https://hdevalence.ca/blog/2020-10-04-its-25519am>).
fn verify_signature_bytes(key: &VerifyingKey, signed_input: &[u8], signature: &[u8]) -> bool {
    let Ok(sig_array) = <[u8; 64]>::try_from(signature) else {
        return false;
    };
    let sig = ed25519_dalek::Signature::from_bytes(&sig_array);
    key.inner.verify_strict(signed_input, &sig).is_ok()
}

// ── base64url (no_std-friendly, no extra dep) ──────────────────────

fn base64url_decode(input: &str) -> Result<Vec<u8>, &'static str> {
    let mut lookup = [255u8; 256];
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    for (i, &c) in alphabet.iter().enumerate() {
        lookup[c as usize] = i as u8;
    }
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf = 0u32;
    let mut buf_len = 0u32;
    for c in input.bytes() {
        if c == b'=' {
            break;
        }
        let v = lookup[c as usize];
        if v == 255 {
            return Err("invalid base64url char");
        }
        buf = (buf << 6) | u32::from(v);
        buf_len += 6;
        if buf_len >= 8 {
            buf_len -= 8;
            out.push(((buf >> buf_len) & 0xFF) as u8);
        }
    }
    Ok(out)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    fn b64u(bytes: &[u8]) -> String {
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let mut out = String::new();
        let mut buf = 0u32;
        let mut buf_len = 0u32;
        for &b in bytes {
            buf = (buf << 8) | u32::from(b);
            buf_len += 8;
            while buf_len >= 6 {
                buf_len -= 6;
                let idx = ((buf >> buf_len) & 0x3F) as usize;
                out.push(alphabet[idx] as char);
            }
        }
        if buf_len > 0 {
            let idx = ((buf << (6 - buf_len)) & 0x3F) as usize;
            out.push(alphabet[idx] as char);
        }
        out
    }

    fn make_jwt(iat_secs: i64, exp_secs: i64) -> String {
        let header = b64u(br#"{"alg":"EdDSA","typ":"JWT"}"#);
        let claims = serde_json::json!({
            "sub": Uuid::nil().to_string(),
            "tenant_id": Uuid::nil().to_string(),
            "iat": iat_secs,
            "exp": exp_secs,
            "department_ids": [],
            "permissions": ["opd.visit.create"],
        });
        let payload = b64u(serde_json::to_vec(&claims).unwrap().as_slice());
        let signature = b64u(&[0u8; 64]);
        format!("{header}.{payload}.{signature}")
    }

    /// All-zero bytes don't form a valid Ed25519 point, so we use a
    /// known-good public key fixture (Ed25519 reference test vector).
    fn key() -> VerifyingKey {
        // From RFC 8032 §7.1 test vector 1.
        let bytes: [u8; 32] = [
            0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7,
            0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64, 0x07, 0x3a,
            0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25,
            0xaf, 0x02, 0x1a, 0x68, 0xf7, 0x07, 0x51, 0x1a,
        ];
        VerifyingKey::from_bytes(bytes).unwrap()
    }

    fn now() -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(1_700_000_000)
    }

    #[test]
    fn malformed_segment_count() {
        let out = verify_jwt("not.three", &key(), now(), DEFAULT_CLOCK_SKEW);
        assert!(matches!(out, JwtOutcome::Malformed(_)));
    }

    #[test]
    fn malformed_alg() {
        let header = b64u(br#"{"alg":"HS256"}"#);
        let payload = b64u(br#"{}"#);
        let sig = b64u(&[0u8; 64]);
        let token = format!("{header}.{payload}.{sig}");
        let out = verify_jwt(&token, &key(), now(), DEFAULT_CLOCK_SKEW);
        match out {
            JwtOutcome::Malformed(msg) => assert!(msg.contains("EdDSA")),
            other => panic!("expected Malformed, got {other:?}"),
        }
    }

    #[test]
    fn signature_wrong_length() {
        let header = b64u(br#"{"alg":"EdDSA"}"#);
        let payload = b64u(br#"{}"#);
        let short_sig = b64u(&[0u8; 16]);
        let token = format!("{header}.{payload}.{short_sig}");
        let out = verify_jwt(&token, &key(), now(), DEFAULT_CLOCK_SKEW);
        match out {
            JwtOutcome::Malformed(msg) => assert!(msg.contains("64 bytes")),
            other => panic!("expected Malformed, got {other:?}"),
        }
    }

    #[test]
    fn signature_failure_returns_invalid_signature() {
        // Stub verifier returns false → every well-formed token
        // hits InvalidSignature. This is the "safe default" path
        // until ed25519-dalek wires in (see verify_signature_bytes
        // doc comment).
        let now_secs = 1_700_000_000;
        let token = make_jwt(now_secs - 60, now_secs + 3600);
        let out = verify_jwt(&token, &key(), now(), DEFAULT_CLOCK_SKEW);
        assert_eq!(out, JwtOutcome::InvalidSignature);
    }

    /// Sign + verify round-trip. Uses ed25519-dalek directly to mint
    /// a valid signature, then checks that verify_jwt accepts it.
    #[test]
    fn signed_token_verifies_and_returns_claims() {
        use ed25519_dalek::{Signer, SigningKey};

        // Deterministic signing key for test reproducibility.
        let signing = SigningKey::from_bytes(&[7u8; 32]);
        let pk = VerifyingKey {
            inner: signing.verifying_key(),
        };

        let now_secs = 1_700_000_000;
        let header = b64u(br#"{"alg":"EdDSA","typ":"JWT"}"#);
        let user_id = Uuid::new_v4();
        let tenant_id = Uuid::new_v4();
        let claims = serde_json::json!({
            "sub": user_id.to_string(),
            "tenant_id": tenant_id.to_string(),
            "iat": now_secs - 60,
            "exp": now_secs + 3600,
            "department_ids": [],
            "permissions": ["opd.visit.create"],
            "role": "doctor",
        });
        let payload = b64u(serde_json::to_vec(&claims).unwrap().as_slice());
        let signed_input = format!("{header}.{payload}");
        let sig = signing.sign(signed_input.as_bytes());
        let sig_b64 = b64u(&sig.to_bytes());
        let token = format!("{header}.{payload}.{sig_b64}");

        let now = UNIX_EPOCH + Duration::from_secs(now_secs as u64);
        let out = verify_jwt(&token, &pk, now, DEFAULT_CLOCK_SKEW);

        match out {
            JwtOutcome::Valid(c) => {
                assert_eq!(c.sub, user_id);
                assert_eq!(c.tenant_id, tenant_id);
                assert_eq!(c.permissions, vec!["opd.visit.create"]);
                assert_eq!(c.role.as_deref(), Some("doctor"));
            }
            other => panic!("expected Valid, got {other:?}"),
        }
    }

    /// Same payload, but the signature has been tampered.
    #[test]
    fn tampered_signature_invalid() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing = SigningKey::from_bytes(&[9u8; 32]);
        let pk = VerifyingKey {
            inner: signing.verifying_key(),
        };

        let now_secs = 1_700_000_000;
        let header = b64u(br#"{"alg":"EdDSA"}"#);
        let payload = b64u(
            serde_json::to_vec(&serde_json::json!({
                "sub": Uuid::nil().to_string(),
                "tenant_id": Uuid::nil().to_string(),
                "iat": now_secs - 60,
                "exp": now_secs + 3600,
            }))
            .unwrap()
            .as_slice(),
        );
        let signed_input = format!("{header}.{payload}");
        let sig = signing.sign(signed_input.as_bytes());
        let mut sig_bytes = sig.to_bytes();
        sig_bytes[0] ^= 0xFF; // flip a byte
        let sig_b64 = b64u(&sig_bytes);
        let token = format!("{header}.{payload}.{sig_b64}");

        let now = UNIX_EPOCH + Duration::from_secs(now_secs as u64);
        let out = verify_jwt(&token, &pk, now, DEFAULT_CLOCK_SKEW);
        assert_eq!(out, JwtOutcome::InvalidSignature);
    }

    /// Valid signature but exp in the past beyond skew → Expired.
    #[test]
    fn expired_token_returns_expired() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing = SigningKey::from_bytes(&[3u8; 32]);
        let pk = VerifyingKey {
            inner: signing.verifying_key(),
        };

        let issued_at = 1_700_000_000;
        let header = b64u(br#"{"alg":"EdDSA"}"#);
        let payload = b64u(
            serde_json::to_vec(&serde_json::json!({
                "sub": Uuid::nil().to_string(),
                "tenant_id": Uuid::nil().to_string(),
                "iat": issued_at,
                "exp": issued_at + 3600,
            }))
            .unwrap()
            .as_slice(),
        );
        let signed_input = format!("{header}.{payload}");
        let sig = signing.sign(signed_input.as_bytes());
        let sig_b64 = b64u(&sig.to_bytes());
        let token = format!("{header}.{payload}.{sig_b64}");

        // 2 hours later, well past exp + skew.
        let now = UNIX_EPOCH + Duration::from_secs((issued_at + 7200) as u64);
        let out = verify_jwt(&token, &pk, now, DEFAULT_CLOCK_SKEW);
        assert_eq!(out, JwtOutcome::Expired);
    }

    /// Valid signature but iat in the future beyond skew → NotYetValid.
    #[test]
    fn future_iat_returns_not_yet_valid() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing = SigningKey::from_bytes(&[11u8; 32]);
        let pk = VerifyingKey {
            inner: signing.verifying_key(),
        };

        let future_iat = 1_700_000_000 + 1200; // 20 min in the future
        let header = b64u(br#"{"alg":"EdDSA"}"#);
        let payload = b64u(
            serde_json::to_vec(&serde_json::json!({
                "sub": Uuid::nil().to_string(),
                "tenant_id": Uuid::nil().to_string(),
                "iat": future_iat,
                "exp": future_iat + 3600,
            }))
            .unwrap()
            .as_slice(),
        );
        let signed_input = format!("{header}.{payload}");
        let sig = signing.sign(signed_input.as_bytes());
        let sig_b64 = b64u(&sig.to_bytes());
        let token = format!("{header}.{payload}.{sig_b64}");

        let now = UNIX_EPOCH + Duration::from_secs(1_700_000_000);
        let out = verify_jwt(&token, &pk, now, DEFAULT_CLOCK_SKEW);
        assert_eq!(out, JwtOutcome::NotYetValid);
    }

}
