#![allow(clippy::unwrap_used, clippy::expect_used)]

use base64::{Engine, engine::general_purpose::STANDARD as B64};
use openssl::bn::BigNum;
use openssl::ec::{Asn1Flag, EcKey, EcPoint, PointConversionForm};
use openssl::pkey::PKey;

use super::{
    GX, KeyMaterial, N, check_pair, check_peer_key, checksum, curve, decrypt, encrypt, generate,
};

// The test vector published in mgrmtech/fidelius-cli's README.
const SENDER_PRIVATE: &str = "AYhVZpbVeX4KS5Qm/W0+9Ye2q3rnVVGmqRICmseWni4=";
const SENDER_PUBLIC: &str =
    "BABVt+mpRLMXiQpIfEq6bj8hlXsdtXIxLsspmMgLNI1SR5mHgDVbjHO2A+U4QlMddGzqyEidzm1AkhtSxSO2Ahg=";
const SENDER_NONCE: &str = "lmXgblZwotx+DfBgKJF0lZXtAXgBEYr5khh79Zytr2Y=";
const REQUESTER_PRIVATE: &str = "DMxHPri8d7IT23KgLk281zZenMfVHSdeamq0RhwlIBk=";
const REQUESTER_PUBLIC: &str =
    "BAheD5rUqTy4V5xR4/6HWmYpopu5CO+KO8BECS0udNqUTSNo91TIqIIy1A4Vh+F94c+n9vAcwXU2bGcfsI5f69Y=";
const REQUESTER_NONCE: &str = "6uj1RdDUbcpI3lVMZvijkMC8Te20O4Bcyz0SyivX8Eg=";
const PLAINTEXT: &str = "Wormtail should never have been Potter cottage's secret keeper.";
const CIPHERTEXT: &str = "pzMvVZNNVtJzqPkkxcCbBUWgDEBy/mBXIeT2dJWI16ZAQnnXUb9lI+S4k8XK6mgZSKKSRIHkcNvJpllnBg548wUgavBa0vCRRwdL6kY6Yw==";

/// Key material from the three base64 fields.
fn km(private_key: &str, public_key: &str, nonce: &str) -> KeyMaterial {
    KeyMaterial {
        private_key: private_key.into(),
        public_key: public_key.into(),
        nonce: nonce.into(),
    }
}

#[test]
fn matches_the_published_fidelius_vector() {
    let sender = km(SENDER_PRIVATE, SENDER_PUBLIC, SENDER_NONCE);
    let out = encrypt(PLAINTEXT, &sender, REQUESTER_PUBLIC, REQUESTER_NONCE).unwrap();
    assert_eq!(out, CIPHERTEXT);
    let requester = km(REQUESTER_PRIVATE, REQUESTER_PUBLIC, REQUESTER_NONCE);
    let back = decrypt(CIPHERTEXT, &requester, SENDER_PUBLIC, SENDER_NONCE).unwrap();
    assert_eq!(back, PLAINTEXT);
}

#[test]
fn generated_keys_round_trip_and_reject_a_wrong_nonce() {
    let (hip, hiu) = (generate().unwrap(), generate().unwrap());
    let sealed = encrypt(
        "{\"resourceType\":\"Bundle\"}",
        &hip,
        &hiu.public_key,
        &hiu.nonce,
    )
    .unwrap();
    let opened = decrypt(&sealed, &hiu, &hip.public_key, &hip.nonce).unwrap();
    assert_eq!(opened, "{\"resourceType\":\"Bundle\"}");
    assert!(decrypt(&sealed, &hiu, &hip.public_key, &hiu.nonce).is_err());
    assert!(!format!("{hip:?}").contains(&hip.private_key));
}

#[test]
fn the_entry_checksum_is_md5_hex() {
    assert_eq!(checksum("abc").unwrap(), "900150983cd24fb0d6963f7d28e17f72");
}

/// The point of order 2 (Montgomery u = 0): x = A/3 = GX − 9, y = 0.
fn order_two_point() -> String {
    let (group, mut ctx) = curve().unwrap();
    let mut x = BigNum::from_hex_str(GX).unwrap();
    x.sub_word(9).unwrap();
    let mut raw = vec![0x04];
    raw.extend(x.to_vec_padded(32).unwrap());
    raw.extend([0_u8; 32]);
    // It is a real curve point: the refusal below is the order check, not parsing.
    let p = EcPoint::from_bytes(&group, &raw, &mut ctx).unwrap();
    assert!(p.is_on_curve(&group, &mut ctx).unwrap());
    B64.encode(raw)
}

#[test]
fn a_small_order_peer_point_is_refused() {
    let small = order_two_point();
    assert!(check_peer_key(&small).is_err());
    let sender = km(SENDER_PRIVATE, SENDER_PUBLIC, SENDER_NONCE);
    assert!(encrypt(PLAINTEXT, &sender, &small, REQUESTER_NONCE).is_err());
    // A mixed-order point (subgroup point + order-2 point) is refused too.
    let (group, mut ctx) = curve().unwrap();
    let q = EcPoint::from_bytes(&group, &B64.decode(REQUESTER_PUBLIC).unwrap(), &mut ctx).unwrap();
    let t = EcPoint::from_bytes(&group, &B64.decode(&small).unwrap(), &mut ctx).unwrap();
    let mut mixed = EcPoint::new(&group).unwrap();
    mixed.add(&group, &q, &t, &mut ctx).unwrap();
    let mixed = mixed
        .to_bytes(&group, PointConversionForm::UNCOMPRESSED, &mut ctx)
        .unwrap();
    assert!(check_peer_key(&B64.encode(mixed)).is_err());
    assert!(check_peer_key(REQUESTER_PUBLIC).is_ok());
}

#[test]
fn infinity_and_off_curve_peer_points_are_refused() {
    assert!(check_peer_key(&B64.encode([0_u8])).is_err());
    let mut off = B64.decode(REQUESTER_PUBLIC).unwrap();
    off[64] ^= 1;
    assert!(check_peer_key(&B64.encode(off)).is_err());
}

#[test]
fn a_peer_key_wrapped_in_spki_is_parsed_as_spki() {
    let (mut group, mut ctx) = curve().unwrap();
    group.set_asn1_flag(Asn1Flag::EXPLICIT_CURVE);
    let raw = B64.decode(REQUESTER_PUBLIC).unwrap();
    let point = EcPoint::from_bytes(&group, &raw, &mut ctx).unwrap();
    let spki = PKey::from_ec_key(EcKey::from_public_key(&group, &point).unwrap())
        .unwrap()
        .public_key_to_der()
        .unwrap();
    let wrapped = B64.encode(&spki);
    check_peer_key(&wrapped).unwrap();
    let sender = km(SENDER_PRIVATE, SENDER_PUBLIC, SENDER_NONCE);
    assert_eq!(
        encrypt(PLAINTEXT, &sender, &wrapped, REQUESTER_NONCE).unwrap(),
        CIPHERTEXT
    );
    // Junk that merely ends in a valid point is no longer accepted.
    let mut junk = vec![0x30, 0x00, 0x13, 0x37];
    junk.extend(&raw);
    assert!(check_peer_key(&B64.encode(junk)).is_err());
}

#[test]
fn a_reopened_private_key_must_derive_its_public_key() {
    let ours = generate().unwrap();
    check_pair(&ours).unwrap();
    let d = B64.decode(&ours.private_key).unwrap();
    assert_eq!(d.len(), 32, "the scalar is written at a fixed width");
    let mut padded = d.clone();
    padded.push(0);
    let other = generate().unwrap();
    let bad = [
        B64.encode(&d[..1]),
        B64.encode(&d[..31]),
        B64.encode(&padded),
        B64.encode([0_u8; 32]),
        other.private_key,
        ours.public_key.clone(),
    ];
    for private_key in bad {
        let broken = KeyMaterial {
            private_key,
            ..ours.clone()
        };
        assert!(check_pair(&broken).is_err());
    }
}

#[test]
fn a_private_scalar_at_or_above_the_order_is_refused() {
    let n = BigNum::from_hex_str(N).unwrap().to_vec_padded(32).unwrap();
    let sender = km(&B64.encode(n), SENDER_PUBLIC, SENDER_NONCE);
    assert!(encrypt(PLAINTEXT, &sender, REQUESTER_PUBLIC, REQUESTER_NONCE).is_err());
}

/// The requester key as Bouncy Castle 1.85 writes it with
/// `ECGenParameterSpec("curve25519")`: the cryptlib named-curve OID.
const BC_NAMED: &str = "MFswFQYHKoZIzj0CAQYKKwYBBAGXVQEFAQNCAAQIXg+a1Kk8uFecUeP+h1pmKaKbuQjvijvARAktLnTalE0jaPdUyKiCMtQOFYfhfeHPp/bwHMF1NmxnH7COX+vW";
/// The same key with Bouncy Castle's explicit X9.62 parameters.
const BC_EXPLICIT: &str = "MIIBMTCB6gYHKoZIzj0CATCB3gIBATArBgcqhkjOPQEBAiB/////////////////////////////////////////7TBEBCAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqYSRShRAQge0Je0Je0Je0Je0Je0Je0Je0Je0Je0Je0JgtenHcQyGQEQQQqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0kWiCuGaG4oIa04B7dLHdI0UySPU1+bXxhsinpxaJ+ztPZAiAQAAAAAAAAAAAAAAAAAAAAFN753qL3nNZYEmMaXPXT7QIBCANCAAQIXg+a1Kk8uFecUeP+h1pmKaKbuQjvijvARAktLnTalE0jaPdUyKiCMtQOFYfhfeHPp/bwHMF1NmxnH7COX+vW";

#[test]
fn bouncycastle_named_and_explicit_spki_keys_are_accepted() {
    let sender = km(SENDER_PRIVATE, SENDER_PUBLIC, SENDER_NONCE);
    for spki in [BC_NAMED, BC_EXPLICIT] {
        check_peer_key(spki).unwrap();
        assert_eq!(
            encrypt(PLAINTEXT, &sender, spki, REQUESTER_NONCE).unwrap(),
            CIPHERTEXT
        );
    }
}

/// `der` with the byte at `at` changed.
fn flipped(der: &[u8], at: usize) -> String {
    let mut out = der.to_vec();
    out[at] ^= 1;
    B64.encode(out)
}

#[test]
fn a_damaged_or_foreign_spki_is_refused() {
    let named = B64.decode(BC_NAMED).unwrap();
    // The last byte of the cryptlib OID: another curve's name.
    assert!(check_peer_key(&flipped(&named, 24)).is_err());
    // id-ecPublicKey changed.
    assert!(check_peer_key(&flipped(&named, 10)).is_err());
    let mut trailing = named.clone();
    trailing.push(0);
    assert!(check_peer_key(&B64.encode(trailing)).is_err());
    // A point outside the subgroup, wrapped in the named encoding.
    let mut small = named[..named.len() - 65].to_vec();
    small.extend(B64.decode(order_two_point()).unwrap());
    assert!(check_peer_key(&B64.encode(small)).is_err());
    let explicit = B64.decode(BC_EXPLICIT).unwrap();
    // A byte of the coefficient b in the explicit parameters.
    let b_at = explicit
        .windows(3)
        .position(|w| w == [0x04, 0x20, 0x7b])
        .unwrap()
        + 5;
    assert!(check_peer_key(&flipped(&explicit, b_at)).is_err());
}
