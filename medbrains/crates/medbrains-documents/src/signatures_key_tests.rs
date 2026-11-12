#![allow(clippy::unwrap_used, clippy::expect_used)]

use medbrains_crypto::aead::encrypt_bytes;
use medbrains_signing::signing;
use uuid::Uuid;

use super::unseal_signing_key;

const KEK: &[u8] = b"test-key-encryption-key-32-bytes!";
const CONTEXT: &[u8] = b"medbrains:doctor-signature-key:v1:t:d";

/// `bytes` sealed as a credential's key is stored.
fn sealed(bytes: &[u8]) -> Vec<u8> {
    encrypt_bytes(KEK, CONTEXT, bytes).unwrap()
}

/// Whether a stored key opens against `public`.
fn open(stored: &[u8], public: &[u8]) -> bool {
    unseal_signing_key(KEK, CONTEXT, stored, public, Uuid::nil()).is_ok()
}

#[test]
fn a_sealed_key_that_derives_its_public_key_opens() {
    let (private, public) = signing::generate_keypair().unwrap();
    assert!(open(&sealed(&private), &public));
}

#[test]
fn a_cut_padded_zeroed_or_swapped_key_is_refused() {
    let (private, public) = signing::generate_keypair().unwrap();
    let (_, other_public) = signing::generate_keypair().unwrap();
    let mut padded = private.to_vec();
    padded.push(0);
    for bad in [
        &private[..1],
        &private[..31],
        &padded[..],
        &[0_u8; 32][..],
        &public[..],
    ] {
        assert!(!open(&sealed(bad), &public), "{} bytes", bad.len());
    }
    assert!(!open(&sealed(&private), &other_public), "mismatched pair");
}

#[test]
fn a_legacy_plaintext_key_is_refused() {
    let (private, public) = signing::generate_keypair().unwrap();
    assert!(!open(&private, &public));
}
