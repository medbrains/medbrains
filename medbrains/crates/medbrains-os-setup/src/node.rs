//! Becoming a node: what setup does once a person has approved this machine on the main machine.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use crate::machine::{PUBLIC_FILE_MODE, ROLE_NODE, log_if_failed, output, write_atomically};
use crate::{rules, status};

/// What the agent recorded when a person approved this machine.
const JOINED_FILE: &str = "/var/lib/medbrains-agent/joined.json";
/// The screen's one trusted certificate, bound into its unit. In a directory only root can write,
/// since the screen's user could otherwise add to what it trusts, or swap this for a link that root
/// would then write through. Written in place, so the running screen sees it: a new file under this
/// name would stay hidden behind the bind mount.
pub(crate) const SCREEN_CERTIFICATE: &str = "/var/lib/medbrains-settings/local-front.pem";

/// Kanidm's state: started for setup on every machine, and only a main machine may keep it.
const KANIDM_STATE: &str = "/var/lib/kanidm";
/// The marker that let kanidmd start for setup.
const IDENTITY_FOR_SETUP: &str = "/run/medbrains-console/kanidm-for-setup";

/// Overwrites every file under a directory with zeros, syncs, then removes all it holds. The directory
/// itself stays: it is a mount point in setup's sandbox, and tmpfiles makes it empty on every boot.
/// On flash the old blocks may survive the overwrite; the disk's encryption covers that.
fn wipe_dir(dir: &Path) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        if kind.is_dir() {
            wipe_dir(&entry.path())?;
            fs::remove_dir(entry.path())?;
        } else {
            if kind.is_file() {
                let mut file = fs::OpenOptions::new().write(true).open(entry.path())?;
                let len = file.metadata()?.len();
                std::io::copy(&mut std::io::repeat(0).take(len), &mut file)?;
                file.sync_all()?;
            }
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

/// A node holds no secrets but its own key: stops the identity provider setup started, and wipes
/// what it wrote. Safe to run on every boot of a node, so a power cut partway is finished next time.
pub(crate) fn drop_identity_provider() {
    drop(output(
        "systemctl",
        &["disable", "--now", "kanidmd.service"],
    ));
    log_if_failed(
        "removing the setup marker",
        absent(fs::remove_file(IDENTITY_FOR_SETUP)),
    );
    log_if_failed(
        "wiping the identity provider's data",
        absent(wipe_dir(Path::new(KANIDM_STATE))),
    );
}

/// Something already gone is what was wanted.
fn absent(result: std::io::Result<()>) -> Result<(), String> {
    match result {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Writes a file in place and to the disk, so a power cut can't leave a durable role marker beside an
/// empty trust store and a screen that can never reach its main machine.
fn write_durably(path: &str, contents: &str) -> std::io::Result<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()
}

/// Makes this machine a node, once the agent says a person approved it. The role goes down last,
/// so a power cut before it leaves a machine that simply asks again.
pub(crate) fn finish_node() -> Result<(), String> {
    let joined = fs::read_to_string(JOINED_FILE).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => "A person has not approved this machine yet.".to_owned(),
        // Not being able to read it is not the same as nobody having approved.
        _ => format!("This machine can't read what it joined: {error}"),
    })?;
    let certificate = rules::joined_certificate(&joined).ok_or_else(|| {
        "The main machine's answer could not be used. Ask to join again.".to_owned()
    })?;
    write_durably(SCREEN_CERTIFICATE, &certificate).map_err(|e| e.to_string())?;
    if let Some(hospital) = rules::joined_hospital(&joined) {
        write_atomically(status::HOSPITAL_NAME, hospital.as_bytes(), PUBLIC_FILE_MODE)?;
    }
    write_atomically(ROLE_NODE, b"", PUBLIC_FILE_MODE)?;
    drop_identity_provider();
    // From now on its clock comes from the main machine. A failure shows on screen as unconfirmed.
    output(
        "systemctl",
        &["restart", "medbrains-time-role.service", "chrony.service"],
    );
    output(
        "systemctl",
        &["start", "--no-block", "medbrains-node.target"],
    )
    .map(|_| ())
    .ok_or_else(|| "The services could not start.".to_owned())
}

#[cfg(test)]
mod tests {
    use super::wipe_dir;
    use std::fs;

    /// Nothing of the identity provider's data may be left, however deep it sits.
    #[test]
    fn a_wiped_directory_is_empty() -> std::io::Result<()> {
        let dir = std::env::temp_dir().join(format!("mb-wipe-{}", std::process::id()));
        fs::create_dir_all(dir.join("inner"))?;
        fs::write(dir.join("kanidm.db"), b"secret")?;
        fs::write(dir.join("inner/tls-key.pem"), b"key")?;
        wipe_dir(&dir)?;
        assert_eq!(fs::read_dir(&dir)?.count(), 0);
        fs::remove_dir(&dir)
    }
}
