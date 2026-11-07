//! This machine's iroh key: one file, readable by the agent and nobody else.
//!
//! ponytail: a file for now. OS-SETUP-AND-TRUST §7 wants the machine key created inside the TPM
//! so it cannot leave; until SEC3 brings a TPM path, anyone who can read the data partition can
//! copy this file and pose as the machine. Removing the machine on the Nodes screen still ends it.

use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::Path;

use anyhow::{Context, bail};
use iroh::SecretKey;

const KEY_LENGTH: usize = 32;
const OWNER_ONLY: u32 = 0o600;

/// Reads the key, or creates it on the first run. Refuses a key others can read, because such a
/// key may already have been copied. The key is never logged.
pub(crate) fn load_or_create(path: &Path) -> anyhow::Result<SecretKey> {
    match std::fs::metadata(path) {
        Ok(found) => {
            if found.permissions().mode() & 0o077 != 0 {
                bail!("{} can be read by others; refusing to use it", path.display());
            }
            let bytes: [u8; KEY_LENGTH] = std::fs::read(path)?
                .try_into()
                .map_err(|_| anyhow::anyhow!("{} is not a key", path.display()))?;
            Ok(SecretKey::from_bytes(&bytes))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => create(path),
        Err(e) => Err(e).context("read the machine key"),
    }
}

/// Writes a new key where it cannot be read before its mode is set, then moves it into place.
fn create(path: &Path) -> anyhow::Result<SecretKey> {
    let secret = SecretKey::generate();
    let temporary = path.with_extension("new");
    drop(std::fs::remove_file(&temporary));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(OWNER_ONLY)
        .open(&temporary)
        .context("create the machine key")?;
    file.write_all(&secret.to_bytes())?;
    file.sync_all()?;
    std::fs::rename(&temporary, path)?;
    Ok(secret)
}

#[cfg(test)]
mod tests {
    use std::os::unix::fs::PermissionsExt;

    use super::load_or_create;

    #[test]
    fn a_key_is_private_and_survives_a_restart() -> anyhow::Result<()> {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("machine.key");
        let first = load_or_create(&path)?;
        assert_eq!(std::fs::metadata(&path)?.permissions().mode() & 0o777, 0o600);
        assert_eq!(load_or_create(&path)?.public(), first.public());
        Ok(())
    }

    #[test]
    fn a_key_others_can_read_is_refused() -> anyhow::Result<()> {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("machine.key");
        load_or_create(&path)?;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644))?;
        assert!(load_or_create(&path).is_err());
        Ok(())
    }
}
