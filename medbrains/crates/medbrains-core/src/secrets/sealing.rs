//! Which mode the server runs in, and the keys that seal stored secrets. A key whose development
//! fallback is public in this repository must never be used off development: whatever it seals
//! stays sealed under it, so one failed lookup would be permanent.

use std::fmt;

use super::{SecretError, SecretResolver};

/// The one mode with development protections off. Anything else is treated as production.
pub const DEVELOPMENT: &str = "development";
const PRODUCTION: &str = "production";
/// Shortest sealing key accepted.
const MIN_KEY_LEN: usize = 32;

/// The mode for a raw `MEDBRAINS_ENV`. Unset is development only in a debug build: a release binary
/// someone forgot to configure must fail closed, and `cargo run` must keep working.
#[must_use]
pub fn environment_name(raw: Option<&str>) -> String {
    let name = raw.map(str::trim).filter(|v| !v.is_empty()).map(str::to_lowercase);
    name.unwrap_or_else(|| {
        if cfg!(debug_assertions) { DEVELOPMENT } else { PRODUCTION }.to_owned()
    })
}

/// True if this process runs in development mode.
#[must_use]
pub fn is_development() -> bool {
    let raw = std::env::var("MEDBRAINS_ENV").ok();
    environment_name(raw.as_deref()) == DEVELOPMENT
}

/// Why a sealing key could not be had. A store that failed is not a key that is unset.
#[derive(Debug, PartialEq, Eq)]
pub enum SealingKeyError {
    /// The secret store answered, and this key is not set.
    NotSet(String),
    /// The key is set, and too short to use.
    TooShort(String),
    /// The secret store could not answer.
    Unreadable { key: String, reason: String },
}

impl fmt::Display for SealingKeyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotSet(key) => write!(f, "{key} is not set"),
            Self::TooShort(key) => write!(f, "{key} must be at least {MIN_KEY_LEN} bytes"),
            Self::Unreadable { key, reason } => write!(f, "{key} could not be read: {reason}"),
        }
    }
}

impl std::error::Error for SealingKeyError {}

/// What a lookup means. The development key answers only "unset, in development".
fn decide(
    found: Result<String, SecretError>,
    name: &str,
    dev_key: &[u8],
    development: bool,
) -> Result<Vec<u8>, SealingKeyError> {
    match found {
        Ok(value) if value.len() >= MIN_KEY_LEN => Ok(value.into_bytes()),
        Ok(_) => Err(SealingKeyError::TooShort(name.to_owned())),
        Err(SecretError::NotFound(_)) if development => Ok(dev_key.to_vec()),
        Err(SecretError::NotFound(_)) => Err(SealingKeyError::NotSet(name.to_owned())),
        Err(e) => Err(SealingKeyError::Unreadable { key: name.to_owned(), reason: e.to_string() }),
    }
}

/// The key named `name`, or `dev_key` only when it is unset in development.
///
/// # Errors
/// Off development when the key is unset, and in every mode when it is too short or the store
/// failed.
pub async fn sealing_key(
    secrets: &dyn SecretResolver,
    name: &str,
    dev_key: &[u8],
) -> Result<Vec<u8>, SealingKeyError> {
    decide(secrets.get(name).await, name, dev_key, is_development())
}

#[cfg(test)]
mod tests {
    use super::{DEVELOPMENT, SealingKeyError, decide, environment_name};
    use crate::secrets::SecretError;

    const DEV: &[u8] = b"public";

    #[test]
    fn the_public_key_is_only_for_an_unset_key_in_development() {
        let unset = || Err(SecretError::NotFound("K".to_owned()));
        assert_eq!(decide(unset(), "K", DEV, true), Ok(DEV.to_vec()));
        assert_eq!(decide(unset(), "K", DEV, false), Err(SealingKeyError::NotSet("K".to_owned())));
    }

    #[test]
    fn a_store_fault_is_never_the_public_key_and_never_reads_as_unset() {
        for development in [true, false] {
            let fault = Err(SecretError::Backend("down".to_owned()));
            assert!(matches!(
                decide(fault, "K", DEV, development),
                Err(SealingKeyError::Unreadable { .. })
            ));
        }
    }

    #[test]
    fn a_short_key_is_refused_in_every_mode() {
        for development in [true, false] {
            let short = decide(Ok("short".to_owned()), "K", DEV, development);
            assert_eq!(short, Err(SealingKeyError::TooShort("K".to_owned())));
        }
        let long = "x".repeat(32);
        assert_eq!(decide(Ok(long.clone()), "K", DEV, false), Ok(long.into_bytes()));
    }

    #[test]
    fn modes_are_read_loosely_and_unset_follows_the_build() {
        assert_eq!(environment_name(Some(" Production ")), "production");
        assert_eq!(environment_name(Some("prod")), "prod");
        // Tests are debug builds; a release build answers production here.
        assert_eq!(environment_name(None), DEVELOPMENT);
        assert_eq!(environment_name(Some("  ")), DEVELOPMENT);
    }
}
