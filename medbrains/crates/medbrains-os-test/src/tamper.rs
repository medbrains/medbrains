//! A system partition changed while the machine is off.
//!
//! As someone with the disk in their hands could do it (`docs/architecture/OS-VERITY.md`). One byte of a
//! file the system reads at every start is changed in a copy of the image, in two places: `os-release`,
//! read before the system starts, which the initrd must stop on; and the data disk's setup script, read
//! once the system runs, which the seal check must stop on, through dm-verity's event. Each start must
//! stop before the data disk is set up, and say so on the screen and the serial port.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

use medbrains_os_update::gpt;
use medbrains_os_update::seal::STOPPED_WORDS;

use crate::ensure;
use crate::vm::{image_version, make_overlay, serial_of_boot};

/// What the initrd says when the system does not start (`os/trial-initrd`).
const INITRD_NOTICE: &str = "MedBrains could not start its system";
/// The start of what the seal check says when it stops a running machine.
const NOTICE: &str = "MedBrains stopped: the system partition failed its seal check";
/// The first line of `disk-setup` after its shebang: read by bash on the first start, after the initrd.
const DISK_SETUP_LINE: &str = "# The encrypted data partition (/var). Class A code";
const BOOT_LIMIT: Duration = Duration::from_secs(240);
const CHUNK: usize = 8 * 1024 * 1024;

/// The offset in `image` of the first `marker` inside the byte range `start..start + size`.
fn find_in(image: &Path, start: u64, size: u64, marker: &[u8]) -> Result<u64, String> {
    let mut file = File::open(image).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(start))
        .map_err(|e| e.to_string())?;
    let mut reader = file.take(size);
    let (mut window, mut buffer, mut seen) = (Vec::new(), vec![0_u8; CHUNK], 0_u64);
    loop {
        let count = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            return Err("the marker is not in the system partition".to_owned());
        }
        window.extend_from_slice(buffer.get(..count).unwrap_or_default());
        if let Some(at) = window.windows(marker.len()).position(|w| w == marker) {
            return Ok(start + seen + at as u64);
        }
        // Keep a marker's length, so one split across two reads is still found.
        let keep = window.len().saturating_sub(marker.len());
        seen += keep as u64;
        window.drain(..keep);
    }
}

/// Both changes, each on its own copy of `image`.
pub(crate) fn changed_system_does_not_start(image: &Path) -> Result<(), String> {
    let version = image_version(image)?;
    ensure(
        STOPPED_WORDS.starts_with(NOTICE),
        "the notice and the product disagree",
    )?;
    let os_release = format!("IMAGE_VERSION=\"{version}\"");
    stops_with(image, os_release.as_bytes(), INITRD_NOTICE)
        .map_err(|e| format!("os-release: {e}"))?;
    stops_with(image, DISK_SETUP_LINE.as_bytes(), NOTICE).map_err(|e| format!("disk-setup: {e}"))
}

/// A copy of `image` with the first byte of `marker` in its system partition changed, and its first
/// start, which must stop and say `notice`.
fn stops_with(image: &Path, marker: &[u8], notice: &str) -> Result<(), String> {
    let version = image_version(image)?;
    let (start, size) = gpt::partition_range(image, &format!("medbrains_{version}"))?;
    let at = find_in(image, start, size, marker)?;
    let dir = std::env::temp_dir().join(format!("mb-os-tamper-{}-{at}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let disk = dir.join("disk.qcow2");
    make_overlay(image, &disk)?;
    // One byte, in the copy only: neither marker starts with `J`.
    let written = Command::new("qemu-io")
        .args(["-f", "qcow2", "-c", &format!("write -P 0x4a {at} 1")])
        .arg(&disk)
        .output()
        .map_err(|e| format!("qemu-io: {e}"))?;
    ensure(
        written.status.success(),
        "qemu-io could not change the copy",
    )?;
    let text = serial_of_boot(&disk, notice, BOOT_LIMIT)?;
    drop(std::fs::remove_dir_all(&dir));
    ensure(
        text.contains(notice),
        format!("no plain message; the serial port ended: {}", tail(&text)),
    )
}

/// The last few hundred characters of `text`.
fn tail(text: &str) -> String {
    let skip = text.chars().count().saturating_sub(400);
    text.chars().skip(skip).collect()
}

#[cfg(test)]
mod tests {
    use super::find_in;

    /// The marker is found where it is, also across the boundary between two reads.
    #[test]
    fn a_marker_is_found_at_its_offset() {
        let path = std::env::temp_dir().join(format!("mb-tamper-{}", std::process::id()));
        let mut bytes = vec![0_u8; super::CHUNK + 10];
        bytes[super::CHUNK - 2..super::CHUNK + 3].copy_from_slice(b"HELLO");
        assert!(std::fs::write(&path, &bytes).is_ok());
        assert_eq!(
            find_in(&path, 0, bytes.len() as u64, b"HELLO"),
            Ok(super::CHUNK as u64 - 2)
        );
        assert_eq!(find_in(&path, 4, 100, b"HELLO").ok(), None);
        assert!(std::fs::remove_file(&path).is_ok());
    }
}
