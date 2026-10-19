//! Crypto helpers for NHCX (JWE + the gateway's RS256 JWT) and ABDM HIE
//! (ECDH-derived AES-GCM).
//!
//! 1. **NHCX** — the FHIR bundle is the plaintext of a compact JWE
//!    (`RSA-OAEP-256 + A256GCM`) encrypted for the recipient, with the
//!    `x-hcx-*` routing headers in its protected header (`jwe::encrypt_hcx`).
//!    The gateway authenticates its callbacks with an RS256 bearer JWT
//!    (`jws::verify_rs256`).
//!
//! 2. **ABDM HIE-CM** — wraps the clinical FHIR Bundle in an extra
//!    AES-GCM payload keyed via ECDH-P256 with the consumer's
//!    ephemeral public key (`hie::encrypt_bundle`).
//!
//! Errors are intentionally opaque (`CryptoError`) so signing-key
//! material can never leak through error paths.

use thiserror::Error;

pub mod abha;
pub mod aead;
pub mod hie;
pub mod jwe;
pub mod jws;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("invalid key material")]
    InvalidKey,
    #[error("encrypt failed")]
    Encrypt,
    #[error("decrypt failed")]
    Decrypt,
    #[error("sign failed")]
    Sign,
    #[error("verify failed")]
    Verify,
    #[error("encoding error")]
    Encoding,
}
