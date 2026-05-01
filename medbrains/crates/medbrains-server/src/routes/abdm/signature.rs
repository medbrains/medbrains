//! ABDM gateway signature verification.
//!
//! Phase 11.2. ABDM signs every callback with a JWS (compact-form
//! JSON Web Signature) using the HIP's NHA-issued public key. The
//! signature is carried in the `x-hcx-signature` header (compact
//! form `base64url(header).base64url(payload).base64url(signature)`)
//! over the request body bytes.
//!
//! Verification flow:
//!   1. Read `x-hcx-signature` header
//!   2. Split into header / payload / signature
//!   3. Decode the JWS header — kid identifies which NHA cert to use
//!   4. Verify the signature against the body (RSA-PKCS1-v1_5 or
//!      RS256 — NHA documents both)
//!   5. Reject if the JWS payload's `iat` is older than 5 minutes
//!      (replay protection per NHA spec)
//!
//! Operating modes:
//!   - `Strict`     : reject if header missing, signature invalid,
//!                     or stale. Production.
//!   - `Permissive` : log a warning but accept. Used for staging
//!                     while NHA hands over the cert chain. Default
//!                     in dev environments — never in prod.
//!
//! Mode is chosen via `ABDM_SIGNATURE_MODE` env var.

use axum::http::HeaderMap;
use std::time::Duration;
use thiserror::Error;

const SIGNATURE_HEADER: &str = "x-hcx-signature";
const REPLAY_WINDOW_SECS: u64 = 300; // 5 minutes per NHA spec

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignatureMode {
    /// Reject on any verification failure.
    Strict,
    /// Log + accept. Use only while NHA cert chain is being
    /// provisioned.
    Permissive,
}

impl SignatureMode {
    pub fn from_env() -> Self {
        match std::env::var("ABDM_SIGNATURE_MODE").as_deref() {
            Ok("strict") => Self::Strict,
            _ => Self::Permissive,
        }
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SignatureError {
    #[error("missing x-hcx-signature header")]
    MissingHeader,

    #[error("malformed signature: {0}")]
    Malformed(String),

    #[error("signature stale (older than {0:?})")]
    Stale(Duration),

    #[error("signature did not verify against the request body")]
    BadSignature,

    #[error("unknown kid (no NHA cert for this signer)")]
    UnknownKid,
}

/// Verify a request's signature header against `body_bytes`.
/// Returns Ok(()) on accept; Err on reject (caller maps to 401).
///
/// The actual JWS-verify implementation is wired when NHA hands over
/// the cert chain. Until then we only structural-check the header.
pub fn verify_signature(
    headers: &HeaderMap,
    body_bytes: &[u8],
    mode: SignatureMode,
) -> Result<(), SignatureError> {
    let sig = read_signature_header(headers);

    let outcome = match sig {
        None => Err(SignatureError::MissingHeader),
        Some(s) => structurally_validate(&s, body_bytes),
    };

    match (outcome, mode) {
        (Ok(()), _) => Ok(()),
        (Err(e), SignatureMode::Permissive) => {
            tracing::warn!(
                error = ?e,
                "abdm signature verification failed but mode=permissive — accepting"
            );
            Ok(())
        }
        (Err(e), SignatureMode::Strict) => Err(e),
    }
}

fn read_signature_header(headers: &HeaderMap) -> Option<String> {
    headers
        .get(SIGNATURE_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
}

/// Compact-JWS structural check: three base64url-decodable segments
/// separated by dots. Real cryptographic verification lands when the
/// NHA cert chain is provisioned — until then we keep the surface
/// stable so the strict-mode flip is one decode call.
///
/// We DO check the JWS payload's `iat` for replay protection because
/// the gateway signs `iat` itself, and rejecting old signed
/// envelopes is a defense even if we can't verify the signature
/// proper yet.
fn structurally_validate(sig: &str, _body_bytes: &[u8]) -> Result<(), SignatureError> {
    let parts: Vec<&str> = sig.split('.').collect();
    if parts.len() != 3 {
        return Err(SignatureError::Malformed(format!(
            "expected 3 segments, got {}",
            parts.len()
        )));
    }
    for (i, p) in parts.iter().enumerate() {
        if p.is_empty() {
            return Err(SignatureError::Malformed(format!("segment {i} is empty")));
        }
    }

    if let Some(iat) = parse_iat_from_payload(parts[1]) {
        let now = chrono::Utc::now().timestamp();
        let age = now - iat;
        if age < 0 || age > REPLAY_WINDOW_SECS as i64 {
            return Err(SignatureError::Stale(Duration::from_secs(REPLAY_WINDOW_SECS)));
        }
    }

    // Cryptographic verification deferred — see module docs.
    Ok(())
}

/// base64url-decode the JWS payload and extract `iat` if present.
/// Returns None if the payload isn't valid JSON or lacks `iat`. We
/// never propagate the structural shape upward — the signature
/// header is the auth surface, the payload is opaque.
fn parse_iat_from_payload(b64_payload: &str) -> Option<i64> {
    let bytes = base64url_decode(b64_payload).ok()?;
    let payload: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    payload.get("iat").and_then(|v| v.as_i64())
}

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
    use axum::http::HeaderValue;

    fn header_with(sig: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(SIGNATURE_HEADER, HeaderValue::from_str(sig).unwrap());
        h
    }

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

    fn jws_with_iat(iat_secs: i64) -> String {
        let header = b64u(br#"{"alg":"RS256","kid":"nha-1"}"#);
        let payload = b64u(format!(r#"{{"iat":{iat_secs}}}"#).as_bytes());
        let signature = b64u(b"deadbeef");
        format!("{header}.{payload}.{signature}")
    }

    #[test]
    fn missing_header_strict_rejects() {
        let h = HeaderMap::new();
        let err = verify_signature(&h, b"body", SignatureMode::Strict).unwrap_err();
        assert_eq!(err, SignatureError::MissingHeader);
    }

    #[test]
    fn missing_header_permissive_accepts() {
        let h = HeaderMap::new();
        verify_signature(&h, b"body", SignatureMode::Permissive).unwrap();
    }

    #[test]
    fn malformed_signature_strict_rejects() {
        let h = header_with("not.three.parts.even");
        let err = verify_signature(&h, b"body", SignatureMode::Strict).unwrap_err();
        assert!(matches!(err, SignatureError::Malformed(_)));
    }

    #[test]
    fn empty_segment_rejected() {
        let h = header_with("hdr..sig");
        let err = verify_signature(&h, b"body", SignatureMode::Strict).unwrap_err();
        assert!(matches!(err, SignatureError::Malformed(_)));
    }

    #[test]
    fn fresh_signature_passes_structural_check() {
        let now = chrono::Utc::now().timestamp();
        let h = header_with(&jws_with_iat(now));
        verify_signature(&h, b"body", SignatureMode::Strict).unwrap();
    }

    #[test]
    fn stale_signature_rejected_in_strict() {
        let stale = chrono::Utc::now().timestamp() - (REPLAY_WINDOW_SECS as i64 + 60);
        let h = header_with(&jws_with_iat(stale));
        let err = verify_signature(&h, b"body", SignatureMode::Strict).unwrap_err();
        assert_eq!(err, SignatureError::Stale(Duration::from_secs(REPLAY_WINDOW_SECS)));
    }

    #[test]
    fn stale_signature_warned_in_permissive() {
        let stale = chrono::Utc::now().timestamp() - 999;
        let h = header_with(&jws_with_iat(stale));
        verify_signature(&h, b"body", SignatureMode::Permissive).unwrap();
    }

    #[test]
    fn future_iat_rejected_in_strict() {
        // Clock-skew tolerance is 0 by design — NHA spec is "now",
        // and a future iat is more likely an attacker than a clock
        // drift in production.
        let future = chrono::Utc::now().timestamp() + 600;
        let h = header_with(&jws_with_iat(future));
        let err = verify_signature(&h, b"body", SignatureMode::Strict).unwrap_err();
        assert_eq!(err, SignatureError::Stale(Duration::from_secs(REPLAY_WINDOW_SECS)));
    }

    #[test]
    fn signature_without_iat_passes_structural_check() {
        // No iat = no replay check; structural validity is enough.
        // The cryptographic verify (when wired) catches forged
        // payloads regardless.
        let header = b64u(br#"{"alg":"RS256"}"#);
        let payload = b64u(br#"{"hello":"world"}"#);
        let signature = b64u(b"sig");
        let jws = format!("{header}.{payload}.{signature}");
        let h = header_with(&jws);
        verify_signature(&h, b"body", SignatureMode::Strict).unwrap();
    }
}
