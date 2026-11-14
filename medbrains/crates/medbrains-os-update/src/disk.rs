//! The two system partitions and the boot partition, read and changed with standard tools only.

use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::child::{self, USUAL_LIMIT};
use crate::{state, verity};

/// The version in a slot's partition name.
const LABEL_PREFIX: &str = "medbrains_";
/// What systemd treats as a free slot.
pub const EMPTY_LABEL: &str = "_empty";
/// Where the boot partition is mounted, on demand, by systemd.
pub const ESP: &str = "/boot";
/// Where the loader looks for boot files.
pub const BOOT_DIR: &str = "/boot/EFI/Linux";
/// Where a boot file waits for its update to be applied. The loader never looks here.
pub const STAGED_BOOT_DIR: &str = "/boot/EFI/MedBrains";
/// Where entries the boot loader only reports, with no file of their own, say they come from.
const EFI_VARIABLES: &str = "/sys/firmware/efi/efivars/";
const WRITE_CHUNK: usize = 1024 * 1024;
const PARTITION_LIMIT: Duration = Duration::from_secs(30);
const MOUNT_LIMIT: Duration = Duration::from_secs(60);

/// One system partition.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Part {
    /// Its device, such as `/dev/vda3`.
    pub path: String,
    /// Its number on the disk.
    pub number: String,
    /// Its partition name.
    pub label: String,
    /// Its partition UUID, which is how a boot file finds it.
    pub uuid: String,
    /// Its size.
    pub bytes: u64,
}

impl Part {
    /// The version this partition holds, if its name says one.
    pub fn version(&self) -> Option<&str> {
        self.label.strip_prefix(LABEL_PREFIX)
    }
}

/// The running system's partition and the other slot: its system partition and its hash tree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Slots {
    /// The disk, such as `/dev/vda`.
    pub disk: String,
    /// What is running.
    pub active: Part,
    /// The hash tree that seals `active`.
    pub active_hash: Part,
    /// What an update may overwrite.
    pub inactive: Part,
    /// The hash tree that seals `inactive`.
    pub inactive_hash: Part,
}

/// One entry the boot loader can see.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BootEntry {
    /// Its boot file.
    pub path: PathBuf,
    /// The image version inside it.
    pub version: String,
    /// True if this boot came from it.
    pub selected: bool,
    /// Starts left, if it is still on trial or has run out.
    pub tries_left: Option<u64>,
}

/// The name a version's partition carries.
pub fn slot_label(version: &str) -> String {
    format!("{LABEL_PREFIX}{version}")
}

/// The name a version's hash tree partition carries.
pub fn hash_label(version: &str) -> String {
    format!("{LABEL_PREFIX}{version}_verity")
}

/// A helper's output as text, or a fault that says what failed.
pub fn run_text(program: &str, args: &[&str], limit: Duration) -> Result<String, String> {
    let done = child::run(program, args, limit)
        .ok_or_else(|| format!("{program} did not answer in time."))?;
    if !done.success {
        let reason = String::from_utf8_lossy(&done.stderr);
        return Err(format!("{program} failed: {}", reason.trim()));
    }
    Ok(String::from_utf8_lossy(&done.stdout).trim().to_owned())
}

/// Finds the slots from `lsblk --json` text.
///
/// The running system and its tree are found by the UUIDs its root hash
/// gives them, and for each exactly one other partition of the same type. Anything else is a fault:
/// guessing could overwrite data.
pub fn parse_slots(
    lsblk: &str,
    root_uuid: &str,
    hash_uuid: &str,
    disk: &str,
) -> Result<Slots, String> {
    let parsed: Value = serde_json::from_str(lsblk).map_err(|e| e.to_string())?;
    let partitions = parsed
        .get("blockdevices")
        .and_then(Value::as_array)
        .ok_or_else(|| "lsblk gave no partitions.".to_owned())?;
    let text = |p: &Value, key: &str| p.get(key).and_then(Value::as_str).unwrap_or("").to_owned();
    let part = |p: &Value| Part {
        path: text(p, "path"),
        number: p.get("partn").map_or_else(String::new, value_text),
        label: text(p, "partlabel"),
        uuid: text(p, "partuuid"),
        bytes: p.get("size").and_then(Value::as_u64).unwrap_or(0),
    };
    let other = |uuid: &str, what: &str| -> Result<(Part, Part), String> {
        let running = partitions
            .iter()
            .find(|p| text(p, "partuuid") == uuid)
            .ok_or_else(|| format!("The running system's {what} ({uuid}) was not found."))?;
        let kind = text(running, "parttype");
        let others: Vec<&Value> = partitions
            .iter()
            .filter(|p| text(p, "parttype") == kind && text(p, "partuuid") != uuid)
            .collect();
        let [found] = others.as_slice() else {
            return Err(format!(
                "Expected one other {what} and found {}. Nothing was changed.",
                others.len()
            ));
        };
        Ok((part(running), part(found)))
    };
    let (active, inactive) = other(root_uuid, "system partition")?;
    let (active_hash, inactive_hash) = other(hash_uuid, "hash partition")?;
    Ok(Slots {
        disk: disk.to_owned(),
        active,
        active_hash,
        inactive,
        inactive_hash,
    })
}

/// A JSON number or string as text.
fn value_text(value: &Value) -> String {
    value
        .as_str()
        .map_or_else(|| value.to_string(), str::to_owned)
}

/// Reads the slots of the running machine, from the root hash its boot file started it with.
pub fn read_slots() -> Result<Slots, String> {
    let cmdline = fs::read_to_string("/proc/cmdline").map_err(|e| e.to_string())?;
    let (root_uuid, hash_uuid) = verity::roothash(&cmdline)
        .and_then(verity::partition_uuids)
        .ok_or_else(|| "This system was not started from a sealed system partition.".to_owned())?;
    let running = format!("/dev/disk/by-partuuid/{root_uuid}");
    let parent = run_text("lsblk", &["-ndo", "PKNAME", &running], USUAL_LIMIT)?;
    let disk = format!("/dev/{parent}");
    let listing = run_text(
        "lsblk",
        &[
            "--json",
            "--bytes",
            "-o",
            "PATH,PARTN,PARTLABEL,PARTUUID,PARTTYPE,SIZE,TYPE",
            "--list",
            &disk,
        ],
        USUAL_LIMIT,
    )?;
    parse_slots(&listing, &root_uuid, &hash_uuid, &disk)
}

/// Parses `bootctl list --json=short`; entries without a boot file, such as "reboot to firmware", go.
///
/// The loader reports those with its EFI variable as their path, not a file on the boot partition. One
/// with a file but no version, such as a loader entry someone added, stays with an empty version, so
/// the boot partition check sees it.
pub fn parse_entries(json: &str) -> Result<Vec<BootEntry>, String> {
    let parsed: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let entries = parsed
        .as_array()
        .ok_or_else(|| "bootctl gave no list.".to_owned())?;
    Ok(entries
        .iter()
        .filter_map(|entry| {
            let path = entry.get("path")?.as_str()?;
            if path.starts_with(EFI_VARIABLES) {
                return None;
            }
            Some(BootEntry {
                path: PathBuf::from(path),
                version: entry
                    .get("version")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_owned(),
                selected: entry
                    .get("isSelected")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                tries_left: entry.get("triesLeft").and_then(Value::as_u64),
            })
        })
        .collect())
}

/// What the boot loader can see.
pub fn boot_entries() -> Result<Vec<BootEntry>, String> {
    parse_entries(&run_text(
        "bootctl",
        &["list", "--json=short", "--no-pager"],
        USUAL_LIMIT,
    )?)
}

/// Renames a partition, then waits until the system has seen it.
pub fn set_label(disk: &str, part: &Part, label: &str) -> Result<(), String> {
    run_text(
        "sfdisk",
        &[
            "--no-reread",
            "--no-tell-kernel",
            "--part-label",
            disk,
            &part.number,
            label,
        ],
        PARTITION_LIMIT,
    )?;
    // udev keeps the old name until told to look again, and `lsblk` asks udev. Only this boot's view is
    // at stake: the next start reads the disk, so a failure here is not worth stopping for.
    drop(child::run(
        "udevadm",
        &["trigger", "--settle", &part.path],
        PARTITION_LIMIT,
    ));
    Ok(())
}

/// Hashes everything read from `reader`, up to `limit` bytes, and returns the hash and the count.
pub fn hash_reader(mut reader: impl Read, limit: u64) -> std::io::Result<(String, u64)> {
    let mut hasher = Sha256::new();
    let (mut buffer, mut total) = (vec![0_u8; WRITE_CHUNK], 0_u64);
    while total <= limit {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(buffer.get(..count).unwrap_or_default());
        total += count as u64;
    }
    Ok((hex::encode(hasher.finalize()), total))
}

/// Hash and size of a file, reading at most `limit` bytes of it.
pub fn hash_file(path: &Path, limit: u64) -> Result<(String, u64), String> {
    let file = File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    hash_reader(BufReader::new(file), limit).map_err(|e| format!("{}: {e}", path.display()))
}

/// Copies `reader` to `target`, refusing more than `limit` bytes. Returns the hash and the count.
fn copy_bounded(
    mut reader: impl Read,
    target: &mut File,
    limit: u64,
) -> Result<(String, u64), String> {
    let mut hasher = Sha256::new();
    let (mut buffer, mut total) = (vec![0_u8; WRITE_CHUNK], 0_u64);
    loop {
        let count = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            return Ok((hex::encode(hasher.finalize()), total));
        }
        total += count as u64;
        if total > limit {
            return Err("The system image is bigger than it said.".to_owned());
        }
        let chunk = buffer.get(..count).unwrap_or_default();
        hasher.update(chunk);
        target.write_all(chunk).map_err(|e| e.to_string())?;
    }
}

/// Decompresses `image` onto `partition`, stopping if it runs past `raw_size`, and flushes it to the
/// disk. Returns the hash of what was written.
fn write_partition(image: &Path, partition: &str, raw_size: u64) -> Result<String, String> {
    let mut zstd = Command::new("zstd")
        .args(["-dcq", "--"])
        .arg(image)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("zstd could not start: {e}"))?;
    let output = zstd
        .stdout
        .take()
        .ok_or_else(|| "zstd gave no output.".to_owned())?;
    let mut target = File::options()
        .write(true)
        .open(partition)
        .map_err(|e| format!("{partition}: {e}"))?;
    let copied = copy_bounded(output, &mut target, raw_size);
    if copied.is_err() {
        // Already gone is the only way this fails, and the copy's own error is what gets reported.
        drop(zstd.kill());
    }
    let status = zstd.wait().map_err(|e| e.to_string())?;
    let (hash, total) = copied?;
    if !status.success() {
        return Err("The system image could not be decompressed.".to_owned());
    }
    if total != raw_size {
        return Err("The system image is smaller than it said.".to_owned());
    }
    target.sync_all().map_err(|e| format!("{partition}: {e}"))?;
    Ok(hash)
}

/// Hashes the first `size` bytes of a partition straight from the disk, past the kernel's cache, so
/// a write the disk lost can't pass.
fn read_back_hash(partition: &str, size: u64) -> Result<String, String> {
    let mut dd = Command::new("dd")
        .arg(format!("if={partition}"))
        .arg("bs=1M")
        .arg("iflag=direct,count_bytes")
        .arg(format!("count={size}"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("dd could not start: {e}"))?;
    let output = dd
        .stdout
        .take()
        .ok_or_else(|| "dd gave no output.".to_owned())?;
    let hashed = hash_reader(output, size);
    let status = dd.wait().map_err(|e| e.to_string())?;
    let (hash, total) = hashed.map_err(|e| e.to_string())?;
    if !status.success() || total != size {
        return Err(format!("{partition} could not be read back."));
    }
    Ok(hash)
}

/// Writes the image and proves it, by its hash on the way in and again from the disk.
pub fn write_slot(
    image: &Path,
    partition: &str,
    raw_size: u64,
    raw_sha256: &str,
) -> Result<(), String> {
    let written = write_partition(image, partition, raw_size)?;
    if written != raw_sha256 {
        return Err("The system image does not match its signed hash.".to_owned());
    }
    if read_back_hash(partition, raw_size)? != raw_sha256 {
        return Err("The disk did not keep what was written to it.".to_owned());
    }
    Ok(())
}

/// Mounts `partition` at `at` for the length of `work`, which always unmounts again.
pub fn with_mounted<T>(
    partition: &str,
    at: &Path,
    options: &str,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    fs::create_dir_all(at).map_err(|e| format!("{}: {e}", at.display()))?;
    let at_text = at.to_string_lossy();
    run_text("mount", &["-o", options, partition, &at_text], MOUNT_LIMIT)?;
    let result = work();
    let unmounted = run_text("umount", &[&at_text], MOUNT_LIMIT);
    let value = result?;
    unmounted?;
    Ok(value)
}

/// A boot file's name with start counting: `name+left-done.efi`, replacing any counts it had. A `+`
/// inside a kernel version stays part of the name: only a real `+left[-done]` tail is replaced.
pub fn counted_name(path: &Path, left: u32, done: u32) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    let base = stem
        .rsplit_once('+')
        .filter(|(_, tail)| counts_tail(tail))
        .map_or(stem, |(base, _)| base);
    Some(format!("{base}+{left}-{done}.efi"))
}

/// True if `tail` is the `left` or `left-done` of a counted name.
fn counts_tail(tail: &str) -> bool {
    tail.split('-')
        .all(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}

/// Free bytes on the filesystem holding `path`.
pub fn free_bytes(path: &str) -> Result<u64, String> {
    let text = run_text("df", &["-B1", "--output=avail", path], USUAL_LIMIT)?;
    text.lines()
        .nth(1)
        .and_then(|line| line.trim().parse().ok())
        .ok_or_else(|| format!("df gave no free space for {path}."))
}

/// Makes every change to the boot partition survive a power cut. FAT has no journal, and an fsync of the
/// directory did not keep a rename there: after a cut on QEMU the staged boot file was back under its
/// temporary name, and an applied one under its staged name, so the update never started. Flushing the whole
/// partition, which is small, does keep it.
pub fn flush_boot_partition() -> Result<(), String> {
    run_text("sync", &["--file-system", ESP], PARTITION_LIMIT).map(|_| ())
}

/// Copies a verified file to `to` in one step, flushed, so a power cut leaves it whole or absent.
pub fn copy_flushed(from: &Path, to: &Path) -> Result<(), String> {
    let temporary = to.with_extension("tmp");
    let mut source = File::open(from).map_err(|e| format!("{}: {e}", from.display()))?;
    let mut target =
        File::create(&temporary).map_err(|e| format!("{}: {e}", temporary.display()))?;
    std::io::copy(&mut source, &mut target).map_err(|e| format!("{}: {e}", to.display()))?;
    target
        .sync_all()
        .map_err(|e| format!("{}: {e}", to.display()))?;
    fs::rename(&temporary, to).map_err(|e| format!("{}: {e}", to.display()))?;
    state::sync_parent(to).map_err(|e| format!("{}: {e}", to.display()))
}

#[cfg(test)]
#[path = "disk_tests.rs"]
mod tests;
