//! ABDM HIE-CM bundle encryption.
//!
//! The HIE flow wraps the clinical FHIR Bundle inside an additional
//! AES-GCM blob whose key is derived via ECDH-P256 between the HIP's
//! ephemeral keypair and the HIU's published public key. The wrapped
//! ciphertext + the ephemeral public key + nonce are sent through the
//! HIE gateway alongside the JWS-signed envelope.
//!
//! Reference: ABDM HCX/HIE Implementation Guide §6 (Encryption).

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use hkdf::Hkdf;
use p256::ecdh::EphemeralSecret;
use p256::{EncodedPoint, PublicKey};
use rand::RngCore;
use sha2::Sha256;

use crate::CryptoError;

/// One encrypted bundle ready for transport. All fields are
/// base64-encoded so the whole thing JSON-serializes cleanly inside
/// the HIE notify payload.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EncryptedBundle {
    /// HIP's ephemeral P-256 public key (X9.63 uncompressed point).
    pub hip_public_key: String,
    /// 12-byte AES-GCM nonce.
    pub nonce: String,
    /// AES-256-GCM ciphertext + 16-byte auth tag.
    pub ciphertext: String,
    /// HKDF info string used as KDF salt context (caller-defined).
    pub kdf_info: String,
}

/// Encrypt a JSON-serializable FHIR Bundle for an HIU. Caller passes
/// the HIU's published public key (raw uncompressed P-256 bytes,
/// base64-encoded — same shape ABDM CM emits in `keyMaterial.publicKey`).
pub fn encrypt_bundle<T: serde::Serialize>(
    bundle: &T,
    hiu_public_key_b64: &str,
    kdf_info: &str,
) -> Result<EncryptedBundle, CryptoError> {
    let plaintext = serde_json::to_vec(bundle).map_err(|_| CryptoError::Encoding)?;

    // 1. Decode the HIU's public key.
    let hiu_pub_bytes = B64
        .decode(hiu_public_key_b64.trim())
        .map_err(|_| CryptoError::Encoding)?;
    let hiu_point =
        EncodedPoint::from_bytes(&hiu_pub_bytes).map_err(|_| CryptoError::InvalidKey)?;
    let hiu_public_key =
        PublicKey::from_sec1_bytes(hiu_point.as_bytes()).map_err(|_| CryptoError::InvalidKey)?;

    // 2. Generate ephemeral HIP keypair.
    let hip_secret = EphemeralSecret::random(&mut OsRng);
    let hip_public = EncodedPoint::from(hip_secret.public_key());

    // 3. ECDH shared secret.
    let shared = hip_secret.diffie_hellman(&hiu_public_key);

    // 4. HKDF-SHA256 → 32-byte AES-256 key.
    let hk = Hkdf::<Sha256>::new(None, shared.raw_secret_bytes());
    let mut aes_key_bytes = [0u8; 32];
    hk.expand(kdf_info.as_bytes(), &mut aes_key_bytes)
        .map_err(|_| CryptoError::InvalidKey)?;

    // 5. AES-256-GCM encrypt with random nonce.
    let mut nonce_bytes = [0u8; 12];
    rand::rng().fill_bytes(&mut nonce_bytes);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&aes_key_bytes));
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_ref())
        .map_err(|_| CryptoError::Encrypt)?;

    Ok(EncryptedBundle {
        hip_public_key: B64.encode(hip_public.as_bytes()),
        nonce: B64.encode(nonce_bytes),
        ciphertext: B64.encode(ciphertext),
        kdf_info: kdf_info.to_owned(),
    })
}
