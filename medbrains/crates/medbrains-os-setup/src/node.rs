//! Becoming a node: what setup does once a person has approved this machine on the main machine.

use std::fs;
use std::io::Write;

use crate::machine::{PUBLIC_FILE_MODE, ROLE_NODE, output, write_atomically};
use crate::{rules, status};

/// What the agent recorded when a person approved this machine.
const JOINED_FILE: &str = "/var/lib/medbrains-agent/joined.json";
/// The screen's one trusted certificate, bound into its unit. In a directory only root can write,
/// since the screen's user could otherwise add to what it trusts, or swap this for a link that root
/// would then write through. Written in place, so the running screen sees it: a new file under this
/// name would stay hidden behind the bind mount.
pub(crate) const SCREEN_CERTIFICATE: &str = "/var/lib/medbrains-settings/local-front.pem";

/// Writes a file in place and to the disk, so a power cut can't leave a durable role marker beside an
/// empty trust store and a screen that can never reach its main machine.
fn write_durably(path: &str, contents: &str) -> std::io::Result<()> {
    let mut file = fs::OpenOptions::new().write(true).truncate(true).open(path)?;
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
    let certificate = rules::joined_certificate(&joined)
        .ok_or_else(|| "The main machine's answer could not be used. Ask to join again.".to_owned())?;
    write_durably(SCREEN_CERTIFICATE, &certificate).map_err(|e| e.to_string())?;
    if let Some(hospital) = rules::joined_hospital(&joined) {
        write_atomically(status::HOSPITAL_NAME, hospital.as_bytes(), PUBLIC_FILE_MODE)?;
    }
    write_atomically(ROLE_NODE, b"", PUBLIC_FILE_MODE)?;
    // From now on its clock comes from the main machine. A failure shows on screen as unconfirmed.
    output("systemctl", &["restart", "medbrains-time-role.service", "chrony.service"]);
    output("systemctl", &["start", "--no-block", "medbrains-node.target"])
        .map(|_| ())
        .ok_or_else(|| "The services could not start.".to_owned())
}
