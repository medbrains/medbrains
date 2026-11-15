//! The six digits both screens show.
//!
//! A hash of the two keys alone would not catch a fake main machine: six digits are a million
//! tries, and an attacker could grind a key whose code matches in about a second. So each side
//! also adds a random nonce, and the node commits to its nonce before it sees the main machine's.
//! Neither side can then choose a key or nonce that steers the code, so each try is one in a million.
//! But tries can be repeated: someone holding a node on one code can start handshakes with the real
//! main machine and leave quietly on a miss, testing a guess each time. The gateway counts those
//! across all addresses and pauses joining past a limit, which is what bounds the total. Pure, so all
//! of it is tested.

use sha2::{Digest, Sha256};

/// A random value that goes into one code.
pub(crate) type Nonce = [u8; 32];

const COMMIT_DOMAIN: &[u8] = b"medbrains/join/commit/1";
const CODE_DOMAIN: &[u8] = b"medbrains/join/code/1";
/// The second code, which a person carries the other way. Its own domain, so knowing one code says
/// nothing about the other.
const CONFIRM_DOMAIN: &[u8] = b"medbrains/join/confirm/1";
const CODE_SPACE: u64 = 1_000_000;

/// A fresh nonce from the OS.
pub(crate) fn new_nonce() -> anyhow::Result<Nonce> {
    let mut nonce = [0_u8; 32];
    getrandom::fill(&mut nonce).map_err(|e| anyhow::anyhow!("no randomness: {e}"))?;
    Ok(nonce)
}

/// What the node sends first: binds it to a nonce without showing it.
pub(crate) fn commitment(nonce: &Nonce) -> [u8; 32] {
    Sha256::new()
        .chain_update(COMMIT_DOMAIN)
        .chain_update(nonce)
        .finalize()
        .into()
}

/// The code a person reads off the node and types on the main machine, proving the node to it.
pub(crate) fn join_code(
    main: &[u8; 32],
    node: &[u8; 32],
    main_nonce: &Nonce,
    node_nonce: &Nonce,
) -> String {
    digits(CODE_DOMAIN, main, node, main_nonce, node_nonce)
}

/// The code a person reads off the main machine's screen and types on the node, proving the main
/// machine to it. A fake main machine can work this out too, but it is not the hospital's screen, so
/// nobody reads it from there; and a machine in the middle has two transcripts, so two codes.
pub(crate) fn confirm_code(
    main: &[u8; 32],
    node: &[u8; 32],
    main_nonce: &Nonce,
    node_nonce: &Nonce,
) -> String {
    digits(CONFIRM_DOMAIN, main, node, main_nonce, node_nonce)
}

/// Six digits from one domain, both keys and both nonces.
fn digits(
    domain: &[u8],
    main: &[u8; 32],
    node: &[u8; 32],
    main_nonce: &Nonce,
    node_nonce: &Nonce,
) -> String {
    let hash = Sha256::new()
        .chain_update(domain)
        .chain_update(main)
        .chain_update(node)
        .chain_update(main_nonce)
        .chain_update(node_nonce)
        .finalize();
    let mut first = [0_u8; 8];
    first.copy_from_slice(&hash[..8]);
    format!("{:06}", u64::from_be_bytes(first) % CODE_SPACE)
}

#[cfg(test)]
mod tests {
    use super::{commitment, confirm_code, join_code, new_nonce};

    const MAIN: [u8; 32] = [1; 32];
    const NODE: [u8; 32] = [2; 32];

    /// Both screens compute this separately, so the same inputs must give the same digits.
    #[test]
    fn both_sides_get_the_same_six_digits() {
        let code = join_code(&MAIN, &NODE, &[3; 32], &[4; 32]);
        assert_eq!(code, join_code(&MAIN, &NODE, &[3; 32], &[4; 32]));
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    /// A fake main machine has a different key, and that must change what the node shows.
    #[test]
    fn every_input_changes_the_code() {
        let base = join_code(&MAIN, &NODE, &[3; 32], &[4; 32]);
        assert_ne!(
            base,
            join_code(&[9; 32], &NODE, &[3; 32], &[4; 32]),
            "main key"
        );
        assert_ne!(
            base,
            join_code(&MAIN, &[9; 32], &[3; 32], &[4; 32]),
            "node key"
        );
        assert_ne!(
            base,
            join_code(&MAIN, &NODE, &[9; 32], &[4; 32]),
            "main nonce"
        );
        assert_ne!(
            base,
            join_code(&MAIN, &NODE, &[3; 32], &[9; 32]),
            "node nonce"
        );
        assert_ne!(
            base,
            join_code(&NODE, &MAIN, &[3; 32], &[4; 32]),
            "swapped keys"
        );
    }

    /// The two directions must not share digits, or reading one would give away the other.
    #[test]
    fn the_second_code_is_not_the_first() {
        let first = join_code(&MAIN, &NODE, &[3; 32], &[4; 32]);
        let second = confirm_code(&MAIN, &NODE, &[3; 32], &[4; 32]);
        assert_ne!(first, second);
        assert_eq!(second, confirm_code(&MAIN, &NODE, &[3; 32], &[4; 32]));
        assert_ne!(
            second,
            confirm_code(&[9; 32], &NODE, &[3; 32], &[4; 32]),
            "another main machine"
        );
    }

    /// The keys alone must not fix the code, or an attacker grinds a key until it matches.
    /// Fresh nonces with the same keys spread over many codes.
    #[test]
    fn the_same_keys_do_not_always_give_the_same_code() -> anyhow::Result<()> {
        let mut seen = std::collections::HashSet::new();
        for _ in 0..50 {
            seen.insert(join_code(&MAIN, &NODE, &new_nonce()?, &new_nonce()?));
        }
        assert!(seen.len() > 40, "only {} distinct codes", seen.len());
        Ok(())
    }

    #[test]
    fn a_commitment_binds_one_nonce_and_does_not_reveal_it() {
        assert_eq!(commitment(&[5; 32]), commitment(&[5; 32]));
        assert_ne!(commitment(&[5; 32]), commitment(&[6; 32]));
        assert_ne!(commitment(&[5; 32]), [5; 32]);
    }
}
