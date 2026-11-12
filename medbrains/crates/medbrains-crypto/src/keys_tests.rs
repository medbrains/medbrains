#![allow(clippy::unwrap_used, clippy::expect_used)]

use base64::{Engine, engine::general_purpose::STANDARD as B64};
use ed25519_dalek::Signer;
use openssl::pkey::PKey;

use super::{
    KeyError, ed25519_public_key, ed25519_signing_key, fingerprint, jwt_keys, verify_strict,
};

/// RFC 8032 §7.1 TEST 1 and TEST 2: (secret, public, message, signature), hex.
const RFC8032: [(&str, &str, &str, &str); 2] = [
    (
        "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
        "",
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    ),
    (
        "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
        "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
        "72",
        "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
    ),
];

/// Bytes from lower-case hex (test vectors).
fn hex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

#[test]
fn rfc8032_vectors_load_sign_and_verify_through_the_helper() {
    for (secret, public, message, signature) in RFC8032 {
        let key = ed25519_signing_key(&hex(secret), &hex(public), "test").unwrap();
        let made = key.sign(&hex(message)).to_bytes();
        assert_eq!(made.to_vec(), hex(signature));
        let public = ed25519_public_key(&hex(public), "test").unwrap();
        verify_strict(&public, &hex(message), &made, "test").unwrap();
        let mut forged = made;
        forged[0] ^= 1;
        assert_eq!(
            verify_strict(&public, &hex(message), &forged, "test"),
            Err(KeyError::Signature("test"))
        );
    }
}

#[test]
fn a_damaged_seed_is_refused() {
    let (secret, public) = (hex(RFC8032[0].0), hex(RFC8032[0].1));
    let mut padded = secret.clone();
    padded.push(0);
    for (seed, got) in [(&secret[..1], 1), (&secret[..31], 31), (&padded[..], 33)] {
        assert_eq!(
            ed25519_signing_key(seed, &public, "s").map(|_| ()),
            Err(KeyError::Length {
                what: "s",
                expected: 32,
                got
            })
        );
    }
    for byte in [0_u8, 0xff] {
        assert_eq!(
            ed25519_signing_key(&[byte; 32], &public, "s").map(|_| ()),
            Err(KeyError::Degenerate("s"))
        );
    }
}

#[test]
fn a_mismatched_pair_or_a_public_key_as_the_seed_is_refused() {
    let (secret, other_public) = (hex(RFC8032[0].0), hex(RFC8032[1].1));
    assert_eq!(
        ed25519_signing_key(&secret, &other_public, "s").map(|_| ()),
        Err(KeyError::Mismatch("s"))
    );
    let public = hex(RFC8032[0].1);
    assert_eq!(
        ed25519_signing_key(&public, &public, "s").map(|_| ()),
        Err(KeyError::Mismatch("s"))
    );
}

#[test]
fn a_small_order_public_key_is_refused() {
    // The identity point (y = 1): every signature "verifies" against it.
    let mut identity = [0_u8; 32];
    identity[0] = 1;
    assert_eq!(
        ed25519_public_key(&identity, "p").map(|_| ()),
        Err(KeyError::Weak("p"))
    );
}

#[test]
fn a_fingerprint_is_short_stable_and_names_the_key() {
    let a = fingerprint(&hex(RFC8032[0].1));
    assert_eq!(a.len(), "SHA256:".len() + 16);
    assert_eq!(a, fingerprint(&hex(RFC8032[0].1)));
    assert_ne!(a, fingerprint(&hex(RFC8032[1].1)));
}

/// A fresh pair as install.sh writes it: base64 PKCS#8 DER, base64 raw public.
fn install_pair() -> (PKey<openssl::pkey::Private>, String, String) {
    let key = PKey::generate_ed25519().unwrap();
    let private = B64.encode(key.private_key_to_pkcs8().unwrap());
    let public = B64.encode(key.raw_public_key().unwrap());
    (key, private, public)
}

#[test]
fn every_supported_jwt_format_loads_and_proves_itself() {
    let (key, private, public) = install_pair();
    jwt_keys(&private, &public).unwrap();
    let pem_private = String::from_utf8(key.private_key_to_pem_pkcs8().unwrap()).unwrap();
    let pem_public = String::from_utf8(key.public_key_to_pem().unwrap()).unwrap();
    jwt_keys(&pem_private, &pem_public).unwrap();
    let spki_b64 = B64.encode(key.public_key_to_der().unwrap());
    let loaded = jwt_keys(&private, &spki_b64).unwrap();
    assert_eq!(
        loaded.fingerprint,
        fingerprint(&key.raw_public_key().unwrap())
    );
}

#[test]
fn a_mismatched_jwt_pair_refuses() {
    let (_, private, _) = install_pair();
    let (_, _, other_public) = install_pair();
    assert_eq!(
        jwt_keys(&private, &other_public).map(|_| ()),
        Err(KeyError::Mismatch("JWT_PRIVATE_KEY"))
    );
}

#[test]
fn a_public_key_or_a_cut_key_in_place_of_the_jwt_private_key_refuses() {
    let (key, private, public) = install_pair();
    let spki = B64.encode(key.public_key_to_der().unwrap());
    assert!(jwt_keys(&spki, &public).is_err());
    assert!(jwt_keys(&public, &public).is_err());
    let der = key.private_key_to_pkcs8().unwrap();
    let cut = B64.encode(&der[..der.len() - 1]);
    assert!(jwt_keys(&cut, &public).is_err());
    assert!(jwt_keys(&private, &B64.encode([7_u8; 31])).is_err());
}

/// PKCS#8 v1 for Ed25519 around `seed`, with lengths fixed up for its size.
fn pkcs8_around(seed: &[u8]) -> String {
    let n = u8::try_from(seed.len()).unwrap();
    let mut der = vec![
        0x30,
        14 + n,
        0x02,
        0x01,
        0x00,
        0x30,
        0x05,
        0x06,
        0x03,
        0x2b,
        0x65,
        0x70,
    ];
    der.extend([0x04, n + 2, 0x04, n]);
    der.extend_from_slice(seed);
    B64.encode(der)
}

#[test]
fn a_jwt_private_key_whose_seed_was_cut_padded_or_zeroed_refuses() {
    let (key, _, public) = install_pair();
    let seed = key.raw_private_key().unwrap();
    let mut padded = seed.clone();
    padded.push(0);
    for bad in [&seed[..1], &seed[..31], &padded[..]] {
        assert!(
            jwt_keys(&pkcs8_around(bad), &public).is_err(),
            "{} bytes",
            bad.len()
        );
    }
    assert!(jwt_keys(&pkcs8_around(&seed), &public).is_ok());
    assert!(jwt_keys(&pkcs8_around(&[0_u8; 32]), &public).is_err());
}

#[test]
fn a_non_ed25519_jwt_key_is_the_wrong_type() {
    let group = openssl::ec::EcGroup::from_curve_name(openssl::nid::Nid::X9_62_PRIME256V1).unwrap();
    let ec = PKey::from_ec_key(openssl::ec::EcKey::generate(&group).unwrap()).unwrap();
    let (_, _, public) = install_pair();
    let private = B64.encode(ec.private_key_to_pkcs8().unwrap());
    assert_eq!(
        jwt_keys(&private, &public).map(|_| ()),
        Err(KeyError::WrongType("JWT_PRIVATE_KEY"))
    );
}
