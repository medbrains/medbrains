//! Crypto helpers for NHCX (JWE+JWS) and ABDM HIE (ECDH-derived AES-GCM).
//!
//! Two distinct profiles:
//!
//! 1. **NHCX** — uses JOSE end-to-end. Hospital signs payload with
//!    `RS256` (`jws::sign_rs256`), encrypts with payer's public key
//!    using `RSA-OAEP-256 + A256GCM` (`jwe::encrypt_for_payer`).
//!
//! 2. **ABDM HIE-CM** — wraps the clinical FHIR Bundle in an extra
//!    AES-GCM payload keyed via ECDH-P256 with the consumer's
//!    ephemeral public key (`hie::encrypt_bundle`). Signature happens
//!    at the gateway envelope (JWS) before the encrypted blob is
//!    embedded.
//!
//! Errors are intentionally opaque (`CryptoError`) so signing-key
//! material can never leak through error paths.

use thiserror::Error;

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
