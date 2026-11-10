//! Encryption of credential data at rest.
//!
//! Mirrors `packages/core/src/encryption` in n8n. Secrets are sealed with
//! AES-256-GCM before they touch the database, so a stolen `r8r.sqlite` is not
//! a stolen set of API tokens. GCM is authenticated: a tampered ciphertext
//! fails to decrypt rather than yielding garbage.

use crate::errors::{CoreError, Result};
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use rand::Rng as _;
use sha2::{Digest, Sha256};

/// Marks a value as sealed by this module, and gives us room to change scheme.
const PREFIX: &str = "r8r.v1:";
const NONCE_BYTES: usize = 12;

/// A key derived once at startup and reused for every credential.
#[derive(Clone)]
pub struct Encryptor {
    cipher: Aes256Gcm,
}

impl std::fmt::Debug for Encryptor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never print anything that could reveal the key.
        f.debug_struct("Encryptor").finish_non_exhaustive()
    }
}

impl Encryptor {
    /// Derive the key from a passphrase. Any length of input is accepted; it is
    /// hashed to the 32 bytes AES-256 needs.
    #[must_use]
    pub fn from_passphrase(passphrase: &str) -> Self {
        let digest = Sha256::digest(passphrase.as_bytes());
        let key = Key::<Aes256Gcm>::from(digest);
        Encryptor {
            cipher: Aes256Gcm::new(&key),
        }
    }

    /// Seal `plaintext`, returning `r8r.v1:<base64(nonce ‖ ciphertext)>`.
    ///
    /// A fresh random nonce per call is what keeps GCM safe; reusing one would
    /// leak plaintext, so it is generated here and never supplied by a caller.
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        // `rand::rng()` is a CSPRNG seeded from the operating system, which is
        // what a GCM nonce requires.
        let mut nonce_bytes = [0u8; NONCE_BYTES];
        rand::rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);

        let ciphertext = self
            .cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| CoreError::Node("could not encrypt credential data".into()))?;

        let mut sealed = Vec::with_capacity(NONCE_BYTES + ciphertext.len());
        sealed.extend_from_slice(&nonce_bytes);
        sealed.extend_from_slice(&ciphertext);

        Ok(format!("{PREFIX}{}", BASE64.encode(sealed)))
    }

    /// Open a value produced by [`Self::encrypt`].
    ///
    /// A value without the prefix is returned unchanged, so a database written
    /// before encryption was switched on still reads.
    pub fn decrypt(&self, sealed: &str) -> Result<String> {
        let Some(encoded) = sealed.strip_prefix(PREFIX) else {
            return Ok(sealed.to_owned());
        };

        let raw = BASE64
            .decode(encoded)
            .map_err(|_| CoreError::Node("credential data is not valid base64".into()))?;
        if raw.len() <= NONCE_BYTES {
            return Err(CoreError::Node("credential data is truncated".into()));
        }
        let (nonce_bytes, ciphertext) = raw.split_at(NONCE_BYTES);
        let nonce: [u8; NONCE_BYTES] = nonce_bytes
            .try_into()
            .map_err(|_| CoreError::Node("credential data has a malformed nonce".into()))?;

        let plaintext = self
            .cipher
            .decrypt(&Nonce::from(nonce), ciphertext)
            .map_err(|_| {
                CoreError::Node(
                    "could not decrypt credential data — wrong encryption key, or the data was \
                     tampered with"
                        .into(),
                )
            })?;

        String::from_utf8(plaintext)
            .map_err(|_| CoreError::Node("decrypted credential data is not valid UTF-8".into()))
    }

    /// Has this value already been sealed?
    #[must_use]
    pub fn is_sealed(value: &str) -> bool {
        value.starts_with(PREFIX)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encryptor() -> Encryptor {
        Encryptor::from_passphrase("test passphrase")
    }

    #[test]
    fn a_secret_round_trips() {
        let sealed = encryptor().encrypt("xoxb-my-token").expect("encrypts");
        assert_eq!(
            encryptor().decrypt(&sealed).expect("decrypts"),
            "xoxb-my-token"
        );
    }

    #[test]
    fn the_ciphertext_never_contains_the_plaintext() {
        let sealed = encryptor().encrypt("xoxb-my-token").expect("encrypts");
        assert!(!sealed.contains("xoxb"));
        assert!(Encryptor::is_sealed(&sealed));
    }

    #[test]
    fn encrypting_the_same_value_twice_gives_different_ciphertext() {
        // A fixed nonce would make identical secrets recognisable in the table.
        let encryptor = encryptor();
        let first = encryptor.encrypt("same").expect("encrypts");
        let second = encryptor.encrypt("same").expect("encrypts");
        assert_ne!(first, second);
    }

    #[test]
    fn a_different_key_cannot_open_it() {
        let sealed = encryptor().encrypt("secret").expect("encrypts");
        let attacker = Encryptor::from_passphrase("wrong passphrase");
        assert!(attacker.decrypt(&sealed).is_err());
    }

    #[test]
    fn tampering_is_detected_rather_than_producing_garbage() {
        let sealed = encryptor().encrypt("secret").expect("encrypts");
        let mut bytes = sealed.clone().into_bytes();
        // Flip a byte inside the base64 payload.
        let last = bytes.len() - 2;
        bytes[last] = if bytes[last] == b'A' { b'B' } else { b'A' };
        let tampered = String::from_utf8(bytes).expect("still utf-8");

        assert!(encryptor().decrypt(&tampered).is_err());
    }

    #[test]
    fn unsealed_legacy_data_is_passed_through() {
        assert_eq!(
            encryptor().decrypt("plain text").expect("passes through"),
            "plain text"
        );
    }

    #[test]
    fn truncated_data_is_rejected_with_a_clear_message() {
        let error = encryptor().decrypt("r8r.v1:AAAA").expect_err("should fail");
        assert!(error.to_string().contains("truncated") || error.to_string().contains("base64"));
    }

    #[test]
    fn unicode_and_empty_values_survive() {
        let encryptor = encryptor();
        for value in ["", "🔐 clé", "a".repeat(10_000).as_str()] {
            let sealed = encryptor.encrypt(value).expect("encrypts");
            assert_eq!(encryptor.decrypt(&sealed).expect("decrypts"), value);
        }
    }
}
