//! Small authenticated-encryption helpers for local `MedBrains` secrets.
//!
//! This is intentionally not a public interoperability format. It is for
//! tenant-local secrets and opaque QR/barcode event tokens where the scanner
//! must not reveal clinical or operational identifiers.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hkdf::Hkdf;
use rand::RngCore;
use serde::Serialize;
use serde::de::DeserializeOwned;
use sha2::Sha256;

use crate::CryptoError;

const ENVELOPE_MAGIC: &[u8; 4] = b"MBE1";
const NONCE_LEN: usize = 12;
const TOKEN_PREFIX: &str = "MBE1.";

fn derive_key(master_key: &[u8], context: &[u8]) -> Result<[u8; 32], CryptoError> {
    if master_key.len() < 32 {
        return Err(CryptoError::InvalidKey);
    }

    let hk = Hkdf::<Sha256>::new(Some(b"medbrains:aead:v1"), master_key);
    let mut key = [0u8; 32];
    hk.expand(context, &mut key)
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(key)
}

pub fn encrypt_bytes(
    master_key: &[u8],
    context: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let key = derive_key(master_key, context)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| CryptoError::InvalidKey)?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);

    let ciphertext = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plaintext,
                aad: context,
            },
        )
        .map_err(|_| CryptoError::Encrypt)?;

    let mut envelope = Vec::with_capacity(ENVELOPE_MAGIC.len() + NONCE_LEN + ciphertext.len());
    envelope.extend_from_slice(ENVELOPE_MAGIC);
    envelope.extend_from_slice(&nonce_bytes);
    envelope.extend_from_slice(&ciphertext);
    Ok(envelope)
}

pub fn decrypt_bytes(
    master_key: &[u8],
    context: &[u8],
    envelope: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    if !envelope.starts_with(ENVELOPE_MAGIC) || envelope.len() <= ENVELOPE_MAGIC.len() + NONCE_LEN {
        return Err(CryptoError::Decrypt);
    }

    let key = derive_key(master_key, context)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| CryptoError::InvalidKey)?;

    let nonce_start = ENVELOPE_MAGIC.len();
    let ciphertext_start = nonce_start + NONCE_LEN;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    nonce_bytes.copy_from_slice(&envelope[nonce_start..ciphertext_start]);
    let nonce = Nonce::from(nonce_bytes);
    cipher
        .decrypt(
            &nonce,
            Payload {
                msg: &envelope[ciphertext_start..],
                aad: context,
            },
        )
        .map_err(|_| CryptoError::Decrypt)
}

pub fn encrypt_token<T: Serialize>(
    master_key: &[u8],
    context: &[u8],
    payload: &T,
) -> Result<String, CryptoError> {
    let plaintext = serde_json::to_vec(payload).map_err(|_| CryptoError::Encoding)?;
    let envelope = encrypt_bytes(master_key, context, &plaintext)?;
    Ok(format!(
        "{TOKEN_PREFIX}{}",
        URL_SAFE_NO_PAD.encode(envelope)
    ))
}

pub fn decrypt_token<T: DeserializeOwned>(
    master_key: &[u8],
    context: &[u8],
    token: &str,
) -> Result<T, CryptoError> {
    let encoded = token
        .strip_prefix(TOKEN_PREFIX)
        .ok_or(CryptoError::Encoding)?;
    let envelope = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| CryptoError::Encoding)?;
    let plaintext = decrypt_bytes(master_key, context, &envelope)?;
    serde_json::from_slice(&plaintext).map_err(|_| CryptoError::Encoding)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use serde::{Deserialize, Serialize};

    use super::*;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct DemoToken {
        subject: String,
    }

    #[test]
    fn encrypted_bytes_round_trip() {
        let key = b"01234567890123456789012345678901";
        let context = b"tenant-a:doctor-signature";
        let envelope = encrypt_bytes(key, context, b"private-key").unwrap();

        assert_ne!(envelope, b"private-key");
        assert!(envelope.starts_with(ENVELOPE_MAGIC));
        assert_eq!(
            decrypt_bytes(key, context, &envelope).unwrap(),
            b"private-key"
        );
    }

    #[test]
    fn wrong_context_fails() {
        let key = b"01234567890123456789012345678901";
        let envelope = encrypt_bytes(key, b"context-a", b"secret").unwrap();
        assert!(decrypt_bytes(key, b"context-b", &envelope).is_err());
    }

    #[test]
    fn encrypted_token_round_trip() {
        let key = b"01234567890123456789012345678901";
        let token = encrypt_token(
            key,
            b"qr-event",
            &DemoToken {
                subject: "appointment".to_owned(),
            },
        )
        .unwrap();

        assert!(token.starts_with(TOKEN_PREFIX));
        let decoded: DemoToken = decrypt_token(key, b"qr-event", &token).unwrap();
        assert_eq!(
            decoded,
            DemoToken {
                subject: "appointment".to_owned()
            }
        );
    }
}
