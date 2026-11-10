//! The instance encryption key.
//!
//! Mirrors n8n's `~/.n8n/config` encryption key. Credentials are useless
//! without it, so it must survive restarts: it is read from the environment
//! when set, and otherwise generated once and stored beside the database with
//! owner-only permissions.

use r8r_core::Encryptor;
use rand::Rng as _;
use std::path::{Path, PathBuf};

const ENV_VAR: &str = "R8R_ENCRYPTION_KEY";
const KEY_BYTES: usize = 32;

/// Where the generated key lives when the environment does not supply one.
#[must_use]
pub fn key_path(database_path: &str) -> PathBuf {
    let database = Path::new(database_path);
    // `parent()` of a bare filename is an empty path, which would place the
    // key at the filesystem root's notion of "here"; make it explicit.
    let directory = database
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    directory.join(".r8r-encryption-key")
}

/// Load the key, generating and persisting one on first run.
///
/// Losing this file makes stored credentials unreadable, which is why the
/// caller is told where it lives.
pub fn load(database_path: &str) -> std::io::Result<(Encryptor, KeySource)> {
    load_with(std::env::var(ENV_VAR).ok().as_deref(), database_path)
}

/// The testable half: the environment is passed in rather than read, so a test
/// never has to mutate global process state.
pub fn load_with(
    from_env: Option<&str>,
    database_path: &str,
) -> std::io::Result<(Encryptor, KeySource)> {
    if let Some(key) = from_env.map(str::trim).filter(|key| !key.is_empty()) {
        return Ok((Encryptor::from_passphrase(key), KeySource::Environment));
    }

    let path = key_path(database_path);
    if let Ok(existing) = std::fs::read_to_string(&path) {
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return Ok((Encryptor::from_passphrase(trimmed), KeySource::File(path)));
        }
    }

    let generated = generate();
    write_private(&path, &generated)?;
    Ok((
        Encryptor::from_passphrase(&generated),
        KeySource::Generated(path),
    ))
}

#[derive(Debug, Clone)]
pub enum KeySource {
    Environment,
    File(PathBuf),
    Generated(PathBuf),
}

impl std::fmt::Display for KeySource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KeySource::Environment => write!(f, "from ${ENV_VAR}"),
            KeySource::File(path) => write!(f, "from {}", path.display()),
            KeySource::Generated(path) => {
                write!(f, "generated at {} — back this up", path.display())
            }
        }
    }
}

fn generate() -> String {
    use std::fmt::Write as _;

    let mut bytes = [0u8; KEY_BYTES];
    rand::rng().fill_bytes(&mut bytes);

    bytes
        .iter()
        .fold(String::with_capacity(KEY_BYTES * 2), |mut hex, byte| {
            // Writing into a String cannot fail.
            let _ = write!(hex, "{byte:02x}");
            hex
        })
}

/// Write the key readable only by its owner. On a shared host, a world-readable
/// key file would defeat encrypting the database at all.
fn write_private(path: &Path, key: &str) -> std::io::Result<()> {
    std::fs::write(path, key)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_key_file_sits_next_to_the_database() {
        let path = key_path("/var/lib/r8r/r8r.sqlite");
        assert_eq!(path, Path::new("/var/lib/r8r/.r8r-encryption-key"));
    }

    #[test]
    fn a_bare_filename_keeps_the_key_in_the_working_directory() {
        assert_eq!(key_path("r8r.sqlite"), Path::new("./.r8r-encryption-key"));
    }

    #[test]
    fn a_generated_key_is_long_enough_to_be_worth_something() {
        let key = generate();
        assert_eq!(key.len(), KEY_BYTES * 2, "32 bytes as hex");
        assert_ne!(key, generate(), "two runs must not agree");
    }

    #[test]
    fn a_generated_key_is_reused_on_the_next_start() {
        let dir = tempfile::tempdir().expect("temp dir");
        let database = dir.path().join("r8r.sqlite").to_string_lossy().into_owned();

        let (first, source) = load_with(None, &database).expect("first load");
        assert!(matches!(source, KeySource::Generated(_)));

        let (second, source) = load_with(None, &database).expect("second load");
        assert!(
            matches!(source, KeySource::File(_)),
            "the key must be reused, not regenerated"
        );

        // Proof it is the same key: one seals, the other opens.
        let sealed = first.encrypt("secret").expect("encrypts");
        assert_eq!(second.decrypt(&sealed).expect("decrypts"), "secret");
    }

    #[test]
    fn an_environment_key_wins_and_writes_nothing_to_disk() {
        let dir = tempfile::tempdir().expect("temp dir");
        let database = dir.path().join("r8r.sqlite").to_string_lossy().into_owned();

        let (_, source) = load_with(Some("my-key"), &database).expect("loads from environment");

        assert!(matches!(source, KeySource::Environment));
        assert!(
            !key_path(&database).exists(),
            "no key file should be created"
        );
    }

    #[test]
    fn a_blank_environment_key_is_ignored_rather_than_used() {
        // An empty R8R_ENCRYPTION_KEY would otherwise encrypt everything under
        // the hash of the empty string.
        let dir = tempfile::tempdir().expect("temp dir");
        let database = dir.path().join("r8r.sqlite").to_string_lossy().into_owned();

        let (_, source) = load_with(Some("   "), &database).expect("loads");
        assert!(matches!(source, KeySource::Generated(_)));
    }

    #[cfg(unix)]
    #[test]
    fn the_key_file_is_not_readable_by_anyone_else() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("key");
        write_private(&path, "abc").expect("writes");

        let mode = std::fs::metadata(&path)
            .expect("metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
