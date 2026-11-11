//! The seal on a system slot (`docs/architecture/OS-VERITY.md`).
//!
//! A boot file carries `roothash=` on its
//! command line; systemd finds the slot's data and hash partitions by the UUIDs that hash gives them (the
//! first and second half), and dm-verity refuses any block that does not match. So naming a slot is
//! giving its two partitions those UUIDs, and that happens only once the slot is written and checked.

use std::time::Duration;

use crate::child;
use crate::disk::run_text;

/// A SHA-256 root hash, in hex.
const HASH_HEX_LEN: usize = 64;
/// A partition UUID, in hex without dashes.
const UUID_HEX_LEN: usize = 32;
/// Reading a whole 2 GiB slot and its tree: minutes on slow flash, so this is generous.
const VERIFY_LIMIT: Duration = Duration::from_mins(20);
const PARTITION_LIMIT: Duration = Duration::from_secs(30);

/// The root hash on a kernel command line, if it carries exactly one well-formed one.
pub fn roothash(cmdline: &str) -> Option<&str> {
    let mut found = cmdline
        .split_whitespace()
        .filter_map(|word| word.strip_prefix("roothash="));
    let hash = found.next()?;
    let well_formed =
        hash.len() == HASH_HEX_LEN && hash.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'));
    (well_formed && found.next().is_none()).then_some(hash)
}

/// Words that would start a sealed system without its seal holding: verity options of systemd's own, a
/// second `root=`, or dm-verity told to read past a changed block. A boot file carrying any is refused.
const UNSAFE_WORDS: [&str; 3] = ["systemd.verity", "ignore-corruption", "ignore_corruption"];

/// The root hash of a boot file's command line, if the line seals its system and nothing on it undoes
/// that: exactly one `roothash=`, exactly one `root=`, and none of `UNSAFE_WORDS`.
pub fn sealed_cmdline(cmdline: &str) -> Result<&str, String> {
    let words: Vec<&str> = cmdline.split_whitespace().collect();
    if let Some(word) = words.iter().find(|word| {
        UNSAFE_WORDS
            .iter()
            .any(|unsafe_word| word.contains(unsafe_word))
    }) {
        return Err(format!(
            "Its command line carries {word}, which would undo the seal."
        ));
    }
    let roots = words
        .iter()
        .filter(|word| word.starts_with("root="))
        .count();
    if roots != 1 {
        return Err(format!(
            "Its command line names {roots} systems to start, not one."
        ));
    }
    roothash(cmdline).ok_or_else(|| "Its command line carries no single root hash.".to_owned())
}

/// Formats 32 hex digits as a UUID, the way `lsblk` prints a partition's.
fn as_uuid(hex: &str) -> Option<String> {
    if hex.len() != UUID_HEX_LEN {
        return None;
    }
    let part = |from: usize, to: usize| hex.get(from..to);
    Some(format!(
        "{}-{}-{}-{}-{}",
        part(0, 8)?,
        part(8, 12)?,
        part(12, 16)?,
        part(16, 20)?,
        part(20, 32)?
    ))
}

/// The UUIDs of the data and the hash partition that a boot file with this root hash looks for.
pub fn partition_uuids(roothash: &str) -> Option<(String, String)> {
    Some((
        as_uuid(roothash.get(..UUID_HEX_LEN)?)?,
        as_uuid(roothash.get(UUID_HEX_LEN..)?)?,
    ))
}

/// The UUID of the system partition running now, from the root hash it was started with.
pub fn running_slot_uuid() -> Option<String> {
    let cmdline = std::fs::read_to_string("/proc/cmdline").ok()?;
    partition_uuids(roothash(&cmdline)?).map(|(data, _)| data)
}

/// A fresh random UUID, for a slot that is being emptied: no boot file can find it any more.
pub fn random_uuid() -> Result<String, String> {
    let mut bytes = [0_u8; UUID_HEX_LEN / 2];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    as_uuid(&hex::encode(bytes)).ok_or_else(|| "A random UUID could not be made.".to_owned())
}

/// Gives a partition a new UUID. The next start reads it from the disk; udev is told for this one.
pub fn set_uuid(disk: &str, number: &str, path: &str, uuid: &str) -> Result<(), String> {
    run_text(
        "sfdisk",
        &[
            "--no-reread",
            "--no-tell-kernel",
            "--part-uuid",
            disk,
            number,
            uuid,
        ],
        PARTITION_LIMIT,
    )?;
    // As for a label: only this boot's view is at stake.
    drop(child::run(
        "udevadm",
        &["trigger", "--settle", path],
        PARTITION_LIMIT,
    ));
    Ok(())
}

/// Checks every block of `data` against the tree in `hash` and the root hash the boot file will use,
/// so a slot whose parts disagree is never named, and so never started.
pub fn verify(data: &str, hash: &str, roothash: &str) -> Result<(), String> {
    run_text(
        "veritysetup",
        &["verify", data, hash, roothash],
        VERIFY_LIMIT,
    )
    .map(|_| ())
    .map_err(|_| {
        "The new system does not match the seal its boot file carries, so it was not installed."
            .to_owned()
    })
}

/// What dm-verity says of the running system: `Some(true)` intact so far, `Some(false)` a block failed
/// its check since this start. The kernel keeps that until the next start. `None`: it could not be asked.
pub fn root_is_intact() -> Option<bool> {
    let status = run_text("veritysetup", &["status", "root"], PARTITION_LIMIT).ok()?;
    seal_status(&status)
}

/// Reads the `status:` line of `veritysetup status`.
fn seal_status(text: &str) -> Option<bool> {
    let value = text
        .lines()
        .find_map(|line| line.trim().strip_prefix("status:"))?
        .trim();
    match value {
        "verified" => Some(true),
        "corrupted" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{partition_uuids, roothash, seal_status, sealed_cmdline};

    /// Only the kernel's two words count; anything else is not known, never "fine".
    #[test]
    fn the_seal_status_is_read_strictly() {
        let shown = |s: &str| {
            format!("/dev/mapper/root is active.\n  type:        VERITY\n  status:      {s}\n")
        };
        assert_eq!(seal_status(&shown("verified")), Some(true));
        assert_eq!(seal_status(&shown("corrupted")), Some(false));
        assert_eq!(seal_status(&shown("unknown")), None);
        assert_eq!(seal_status("/dev/mapper/root is inactive."), None);
    }

    const HASH: &str = "0123456789abcdef0123456789abcdeffedcba9876543210fedcba9876543210";

    /// The hash is read from among the other words, and anything doubtful reads as none.
    #[test]
    fn only_one_well_formed_root_hash_counts() {
        let line = format!("root=/dev/mapper/root ro roothash={HASH} quiet");
        assert_eq!(roothash(&line), Some(HASH));
        assert_eq!(roothash("root=/dev/mapper/root ro"), None);
        assert_eq!(roothash(&format!("roothash={HASH} roothash={HASH}")), None);
        assert_eq!(roothash(&format!("roothash={}", &HASH[..63])), None);
        assert_eq!(roothash(&format!("roothash={}", HASH.to_uppercase())), None);
        assert_eq!(roothash(&format!("xroothash={HASH}")), None);
    }

    /// A line that seals its system passes; one that names a second system or switches the seal off is
    /// refused, whatever else it carries.
    #[test]
    fn a_command_line_that_undoes_the_seal_is_refused() {
        let good = format!("root=/dev/mapper/root ro roothash={HASH} quiet");
        assert_eq!(sealed_cmdline(&good), Ok(HASH));
        for bad in [
            format!("{good} systemd.verity=no"),
            format!("{good} systemd.verity_root_options=ignore-corruption"),
            format!("{good} root=/dev/vda3"),
            format!("roothash={HASH} quiet"),
            "root=/dev/mapper/root ro".to_owned(),
        ] {
            assert!(sealed_cmdline(&bad).is_err(), "{bad}");
        }
    }

    /// systemd's rule: the data partition takes the first half of the hash, the tree the second.
    #[test]
    fn the_partitions_are_named_by_the_two_halves() {
        assert_eq!(
            partition_uuids(HASH),
            Some((
                "01234567-89ab-cdef-0123-456789abcdef".to_owned(),
                "fedcba98-7654-3210-fedc-ba9876543210".to_owned()
            ))
        );
        assert_eq!(partition_uuids("short"), None);
    }
}
