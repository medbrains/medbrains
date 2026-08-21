//! Machine credentials for the API.
//!
//! A key is not a user. It carries an explicit list of permissions and no
//! role, so it cannot widen when a role does, and a leaked key exposes exactly
//! what it was granted rather than everything its creator could do.
//!
//! The minting and verification logic lives here, pure, with no database and
//! no web framework — so the properties that matter are settled by tests
//! rather than by reading a handler.

use std::fmt;

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use thiserror::Error;

/// Marks a key as belonging to this system, and which environment it is for.
///
/// Two reasons the prefix is worth the bytes:
///
/// * a leaked key is recognisable on sight — in a log, a commit, a support
///   ticket — instead of looking like any other opaque string;
/// * the format is registerable with secret-scanning services, which is how a
///   key committed to a public repository gets revoked in minutes rather than
///   after the breach.
///
/// This repository went public with a production `DATABASE_URL` in its
/// history. A scannable prefix is the difference between finding that out from
/// a scanner and finding it out from an intruder.
pub const LIVE_PREFIX: &str = "mb_live_";
pub const TEST_PREFIX: &str = "mb_test_";

/// 32 bytes. Not a password — there is nothing to guess — so the defence is
/// entropy rather than a slow hash.
const SECRET_BYTES: usize = 32;

/// How much of the key is stored in the clear so a console can identify it.
/// Long enough to be unambiguous across a tenant's keys, far short of useful.
const VISIBLE_CHARS: usize = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Live,
    Test,
}

impl Environment {
    #[must_use]
    pub const fn prefix(self) -> &'static str {
        match self {
            Self::Live => LIVE_PREFIX,
            Self::Test => TEST_PREFIX,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum KeyError {
    #[error("an API key must carry at least one permission")]
    NoPermissions,

    /// A key that can do anything is a key that should not exist. The whole
    /// point of a machine credential is that it is narrower than a person.
    #[error("'{0}' cannot be granted to an API key — it bypasses permission checks entirely")]
    BypassPermission(String),

    #[error("this does not look like an API key")]
    Malformed,

    #[error("could not generate a key: {0}")]
    Random(String),
}

/// Permission codes that must never appear on a key.
///
/// Wildcards and administrative bypasses defeat the explicit-allowlist model:
/// a key holding one of these is a key holding everything, including whatever
/// is added next year.
const NEVER_ON_A_KEY: &[&str] = &["*", "admin.*", "super_admin", "hospital_admin"];

/// A freshly minted key. The secret exists only here and is never stored.
#[derive(Clone)]
pub struct MintedKey {
    /// Shown to the creator once. There is no way to recover it afterwards,
    /// which is the point: a key that can be re-read is a key in a database
    /// somebody can read.
    pub secret: String,
    /// Stored in the clear, for display.
    pub prefix: String,
    /// Stored. What a presented key is matched against.
    pub hash: String,
}

// Without this, a debug log of the struct prints the secret. Deriving Debug
// here would be a credential leak with no code change to cause it.
impl fmt::Debug for MintedKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MintedKey")
            .field("prefix", &self.prefix)
            .field("secret", &"<redacted>")
            .field("hash", &"<redacted>")
            .finish()
    }
}

/// Mint a key for a set of permissions.
///
/// # Errors
/// [`KeyError::NoPermissions`] for an empty grant, [`KeyError::BypassPermission`]
/// for anything that would defeat the allowlist, [`KeyError::Random`] if the
/// system entropy source fails.
pub fn mint(environment: Environment, permissions: &[String]) -> Result<MintedKey, KeyError> {
    if permissions.is_empty() {
        return Err(KeyError::NoPermissions);
    }
    for permission in permissions {
        let code = permission.trim();
        if NEVER_ON_A_KEY.contains(&code) || code.ends_with(".*") {
            return Err(KeyError::BypassPermission(code.to_owned()));
        }
    }

    let mut bytes = [0_u8; SECRET_BYTES];
    getrandom::fill(&mut bytes).map_err(|error| KeyError::Random(error.to_string()))?;

    let secret = format!("{}{}", environment.prefix(), hex::encode(bytes));
    let prefix: String = secret.chars().take(VISIBLE_CHARS).collect();
    let hash = fingerprint(&secret);

    Ok(MintedKey {
        secret,
        prefix,
        hash,
    })
}

/// The stored form of a key.
///
/// SHA-256 rather than a password hash: the input is 256 bits of randomness,
/// so there is no dictionary to defend against, and this runs on every single
/// authenticated request — where a deliberately slow hash would be a denial of
/// service against ourselves.
#[must_use]
pub fn fingerprint(secret: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hex::encode(hasher.finalize())
}

/// Whether a presented key matches a stored fingerprint.
///
/// Constant-time. A `==` on the hash leaks, through timing, how many leading
/// characters were right — which turns an unguessable key into one that can be
/// recovered a byte at a time.
#[must_use]
pub fn verify(presented: &str, stored_hash: &str) -> bool {
    if !looks_like_key(presented) {
        return false;
    }
    let computed = fingerprint(presented);
    computed.as_bytes().ct_eq(stored_hash.as_bytes()).into()
}

/// A cheap shape check before hashing.
///
/// Rejects obviously-not-a-key input without spending a hash on it, and stops
/// a session cookie or a JWT being accidentally treated as a key.
#[must_use]
pub fn looks_like_key(candidate: &str) -> bool {
    let Some(body) = candidate
        .strip_prefix(LIVE_PREFIX)
        .or_else(|| candidate.strip_prefix(TEST_PREFIX))
    else {
        return false;
    };
    body.len() == SECRET_BYTES * 2 && body.chars().all(|c| c.is_ascii_hexdigit())
}

/// The visible part of a key, for display next to its name.
///
/// # Errors
/// [`KeyError::Malformed`] if it is not a key.
pub fn prefix_of(secret: &str) -> Result<String, KeyError> {
    if !looks_like_key(secret) {
        return Err(KeyError::Malformed);
    }
    Ok(secret.chars().take(VISIBLE_CHARS).collect())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::{
        Environment, KeyError, LIVE_PREFIX, TEST_PREFIX, fingerprint, looks_like_key, mint,
        prefix_of, verify,
    };

    fn perms() -> Vec<String> {
        vec!["lab.results.create".to_owned()]
    }

    #[test]
    fn a_minted_key_verifies_against_its_own_hash() {
        let key = mint(Environment::Live, &perms()).unwrap();
        assert!(verify(&key.secret, &key.hash));
    }

    #[test]
    fn two_keys_are_never_the_same() {
        let a = mint(Environment::Live, &perms()).unwrap();
        let b = mint(Environment::Live, &perms()).unwrap();
        assert_ne!(a.secret, b.secret);
        assert_ne!(a.hash, b.hash);
    }

    #[test]
    fn the_environment_is_visible_in_the_key() {
        assert!(
            mint(Environment::Live, &perms())
                .unwrap()
                .secret
                .starts_with(LIVE_PREFIX)
        );
        assert!(
            mint(Environment::Test, &perms())
                .unwrap()
                .secret
                .starts_with(TEST_PREFIX)
        );
    }

    #[test]
    fn the_stored_prefix_is_not_enough_to_use() {
        let key = mint(Environment::Live, &perms()).unwrap();
        assert!(key.secret.starts_with(&key.prefix));
        assert!(
            !verify(&key.prefix, &key.hash),
            "the visible prefix must not authenticate"
        );
    }

    #[test]
    fn a_key_cannot_be_granted_a_bypass() {
        // The one rule that makes a machine credential safer than a user.
        for bad in [
            "*",
            "admin.*",
            "super_admin",
            "hospital_admin",
            "patients.*",
        ] {
            assert!(
                matches!(
                    mint(Environment::Live, &[bad.to_owned()]),
                    Err(KeyError::BypassPermission(_))
                ),
                "{bad} should be refused"
            );
        }
    }

    #[test]
    fn a_key_granting_nothing_is_refused() {
        // Not a safe default: it gets widened in a hurry by whoever is
        // debugging why their integration returns 403.
        // `MintedKey` is deliberately not comparable — it holds a secret, and
        // making secrets easy to compare is how timing leaks get written.
        assert!(matches!(
            mint(Environment::Live, &[]),
            Err(KeyError::NoPermissions)
        ));
    }

    #[test]
    fn a_wrong_key_does_not_verify() {
        let key = mint(Environment::Live, &perms()).unwrap();
        let other = mint(Environment::Live, &perms()).unwrap();
        assert!(!verify(&other.secret, &key.hash));
    }

    #[test]
    fn things_that_are_not_keys_are_rejected_before_hashing() {
        // A session cookie or a JWT must never be mistaken for a key.
        for junk in [
            "",
            "mb_live_",
            "mb_live_nothex!!",
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
            "Bearer mb_live_00",
        ] {
            assert!(!looks_like_key(junk), "{junk:?} should not look like a key");
            assert!(
                !verify(junk, &fingerprint("mb_live_x")),
                "{junk:?} must not verify"
            );
        }
    }

    #[test]
    fn a_key_of_the_wrong_length_is_rejected() {
        // Truncation is the realistic failure: a key cut short by a form field
        // or a log line must not be accepted as a shorter valid key.
        let key = mint(Environment::Live, &perms()).unwrap();
        let truncated = &key.secret[..key.secret.len() - 2];
        assert!(!looks_like_key(truncated));
    }

    #[test]
    fn the_secret_never_appears_in_debug_output() {
        // Deriving Debug would put a live credential into any log line that
        // formatted the struct, with nothing in the code to hint at it.
        let key = mint(Environment::Live, &perms()).unwrap();
        let rendered = format!("{key:?}");
        assert!(!rendered.contains(&key.secret));
        assert!(!rendered.contains(&key.hash));
        assert!(
            rendered.contains(&key.prefix),
            "the prefix is safe and useful to show"
        );
    }

    #[test]
    fn prefix_of_refuses_something_that_is_not_a_key() {
        assert_eq!(prefix_of("not-a-key"), Err(KeyError::Malformed));
        let key = mint(Environment::Test, &perms()).unwrap();
        assert_eq!(prefix_of(&key.secret).unwrap(), key.prefix);
    }
}
