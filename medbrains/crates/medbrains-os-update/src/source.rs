//! Where a bundle comes from: a folder on local media, or a configured URL. Both end in the same
//! files in the same place, so they share every check after this.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::child;
use crate::disk;

/// A download's whole time limit. A stalled one ends much sooner, on `STALL_SECONDS`.
const DOWNLOAD_LIMIT: Duration = Duration::from_secs(6 * 60 * 60);
const SMALL_LIMIT: Duration = Duration::from_secs(60);
const STALL_SECONDS: &str = "120";
const STALL_BYTES_PER_SECOND: &str = "1024";
/// Removable partitions looked at per request.
const MAX_USB_PARTITIONS: usize = 8;
/// The folder on a USB stick.
pub const USB_FOLDER: &str = "medbrains-update";

/// A place holding a bundle's files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Source {
    /// A folder on this machine, such as a mounted USB stick.
    Folder(PathBuf),
    /// An `https://` address; the extra path is a private CA for a hospital's own mirror.
    Address(String, Option<PathBuf>),
}

impl Source {
    /// Understands what a person or a test typed: an address, or a folder.
    pub fn parse(text: &str, ca: Option<PathBuf>) -> Result<Self, String> {
        if let Some(rest) = text.strip_prefix("https://") {
            if rest.is_empty() || rest.contains(char::is_whitespace) {
                return Err("That is not a usable address.".to_owned());
            }
            return Ok(Self::Address(text.trim_end_matches('/').to_owned(), ca));
        }
        if text.starts_with('/') {
            return Ok(Self::Folder(PathBuf::from(text)));
        }
        Err("Updates come from an https:// address or a folder.".to_owned())
    }

    /// The bundle of an earlier step, kept beside this one in a folder named after its version. `version`
    /// has been parsed as dotted numbers, so it can't climb out of the folder.
    pub fn step(&self, version: &str) -> Self {
        match self {
            Self::Folder(folder) => Self::Folder(folder.join(version)),
            Self::Address(base, ca) => Self::Address(format!("{base}/{version}"), ca.clone()),
        }
    }

    /// Copies the bundle's `name` to `to`, failing rather than taking more than `limit` bytes.
    pub fn fetch(&self, name: &str, to: &Path, limit: u64) -> Result<(), String> {
        match self {
            Self::Folder(folder) => copy_limited(&folder.join(name), to, limit),
            Self::Address(base, ca) => download(&format!("{base}/{name}"), ca.as_deref(), to, limit),
        }
    }

    /// Reads a small file of the bundle into memory.
    pub fn fetch_small(&self, name: &str, scratch: &Path, limit: u64) -> Result<Vec<u8>, String> {
        let to = scratch.join(format!("{name}.part"));
        self.fetch(name, &to, limit)?;
        let bytes = fs::read(&to).map_err(|e| e.to_string());
        // A leftover small file is removed with the rest of the staging folder at the next start.
        drop(fs::remove_file(&to));
        bytes
    }
}

/// Copies at most `limit` bytes; a longer file is a fault, so it can't fill the disk.
fn copy_limited(from: &Path, to: &Path, limit: u64) -> Result<(), String> {
    let source = File::open(from).map_err(|e| format!("{}: {e}", from.display()))?;
    let mut target = File::create(to).map_err(|e| format!("{}: {e}", to.display()))?;
    let copied = std::io::copy(&mut source.take(limit + 1), &mut target)
        .map_err(|e| format!("{}: {e}", from.display()))?;
    if copied > limit {
        return Err(format!("{} is bigger than it said.", from.display()));
    }
    Ok(())
}

/// Downloads with `curl`, over https only, including after a redirect. A stalled link ends it.
fn download(url: &str, ca: Option<&Path>, to: &Path, limit: u64) -> Result<(), String> {
    let (to_text, limit_text) = (to.to_string_lossy(), limit.to_string());
    let mut args = vec![
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--connect-timeout",
        "20",
        "--speed-time",
        STALL_SECONDS,
        "--speed-limit",
        STALL_BYTES_PER_SECOND,
        "--max-filesize",
        &limit_text,
        "--output",
        &to_text,
    ];
    let ca_text = ca.map(Path::to_string_lossy);
    if let Some(ca_text) = &ca_text {
        args.extend(["--cacert", ca_text]);
    }
    args.push(url);
    let done = child::run("curl", &args, DOWNLOAD_LIMIT)
        .ok_or_else(|| "The download did not finish in time.".to_owned())?;
    if done.success {
        return Ok(());
    }
    Err(format!(
        "The download failed: {}",
        String::from_utf8_lossy(&done.stderr).trim()
    ))
}

/// Filesystems a USB stick may hold.
fn is_usable_stick_filesystem(name: &str) -> bool {
    matches!(name, "vfat" | "exfat" | "ext4")
}

/// Removable partitions from `lsblk --json -o PATH,HOTPLUG,RM,FSTYPE,TYPE --list`. A stick counts only
/// if the kernel says it can be unplugged, so a fixed disk is never mounted here.
pub fn removable_partitions(lsblk: &str) -> Vec<String> {
    let parsed: serde_json::Value = serde_json::from_str(lsblk).unwrap_or_default();
    let Some(devices) = parsed.get("blockdevices").and_then(|d| d.as_array()) else {
        return Vec::new();
    };
    devices
        .iter()
        .filter(|d| {
            let flag = |key: &str| d.get(key).and_then(serde_json::Value::as_bool);
            flag("hotplug") == Some(true) || flag("rm") == Some(true)
        })
        .filter(|d| {
            d.get("fstype")
                .and_then(|f| f.as_str())
                .is_some_and(is_usable_stick_filesystem)
        })
        .filter_map(|d| d.get("path")?.as_str().map(str::to_owned))
        .take(MAX_USB_PARTITIONS)
        .collect()
}

/// The stick's partitions, as this machine sees them right now.
pub fn list_sticks() -> Result<Vec<String>, String> {
    let text = disk::run_text(
        "lsblk",
        &["--json", "--list", "-o", "PATH,HOTPLUG,RM,FSTYPE,TYPE"],
        SMALL_LIMIT,
    )?;
    Ok(removable_partitions(&text))
}

#[cfg(test)]
mod tests {
    use super::{Source, removable_partitions};
    use std::path::PathBuf;

    /// Plain http would let anyone on the path see what a machine asks for, and is refused.
    #[test]
    fn only_https_and_folders_are_sources() {
        assert!(Source::parse("http://mirror/os", None).is_err());
        assert!(Source::parse("ftp://mirror/os", None).is_err());
        assert!(Source::parse("mirror/os", None).is_err());
        assert!(Source::parse("https://", None).is_err());
        assert!(Source::parse("https://a b", None).is_err());
        assert_eq!(
            Source::parse("https://mirror/os/", None),
            Ok(Source::Address("https://mirror/os".to_owned(), None))
        );
        assert_eq!(
            Source::parse("/media/usb", None),
            Ok(Source::Folder(PathBuf::from("/media/usb")))
        );
    }

    /// The system disk is not a stick, and a stick's other filesystems are left alone.
    #[test]
    fn only_removable_partitions_with_known_filesystems_are_looked_at() {
        let lsblk = r#"{"blockdevices":[
            {"path":"/dev/vda2","hotplug":false,"rm":false,"fstype":"ext4","type":"part"},
            {"path":"/dev/sda1","hotplug":true,"rm":true,"fstype":"vfat","type":"part"},
            {"path":"/dev/sdb1","hotplug":true,"rm":false,"fstype":"ntfs","type":"part"},
            {"path":"/dev/sdc","hotplug":false,"rm":true,"fstype":"ext4","type":"disk"}]}"#;
        assert_eq!(removable_partitions(lsblk), ["/dev/sda1", "/dev/sdc"]);
        assert!(removable_partitions("not json").is_empty());
    }
}
