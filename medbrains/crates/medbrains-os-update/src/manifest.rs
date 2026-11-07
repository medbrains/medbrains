//! What a bundle says about itself, who signed it, and whether this machine may take it. Everything
//! here is decided from a few kilobytes, before any of the bundle's payload is touched.

use std::fs;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::version::Version;

/// The signed description of a bundle.
pub const MANIFEST_FILE: &str = "manifest.json";
/// Signatures over the manifest's exact bytes.
pub const SIGNATURE_FILE: &str = "manifest.sig";
/// The compressed system image. Names are fixed here, so a manifest can never name a path.
pub const ROOT_FILE: &str = "root.img.zst";
/// The boot file.
pub const BOOT_FILE: &str = "boot.efi";
/// The most a manifest or signature file may be: they are read into memory unverified.
pub const MAX_SMALL_FILE: u64 = 16 * 1024;
/// A test key only counts on an image that carries this file; `build.sh` adds it to debug images only.
pub const DEBUG_IMAGE_MARK: &str = "THIS-IS-A-DEBUG-IMAGE";
/// Space kept free on the data disk after a bundle is staged, so an update can't starve the database.
pub const DATA_RESERVE: u64 = 1024 * 1024 * 1024;
/// Room kept free in the boot partition beyond the new boot file.
pub const ESP_RESERVE: u64 = 4 * 1024 * 1024;
const FORMAT: u32 = 1;
const MAX_SIGNATURES: usize = 4;
const TEST_KEY_PREFIX: &str = "test-";
/// How many different trusted keys must sign, as one number in this file beside the keys. Absent means one.
const THRESHOLD_FILE: &str = "threshold";
const KEY_SUFFIX: &str = ".pub";
const ED25519_PUBLIC_LEN: usize = 32;

/// The compressed system image.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RootImage {
    /// Hash of the compressed file.
    pub sha256: String,
    /// Size of the compressed file.
    pub size: u64,
    /// Hash of the partition image.
    pub raw_sha256: String,
    /// Size of the partition image.
    pub raw_size: u64,
}

/// The boot file: kernel, initrd and command line in one.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BootImage {
    /// Hash of the file.
    pub sha256: String,
    /// Size of the file.
    pub size: u64,
}

/// What a bundle says it is. Every field is covered by the signature.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    /// The bundle format this was written in.
    pub format: u32,
    /// The image version inside.
    pub version: String,
    /// `arm64` or `x86-64`.
    pub arch: String,
    /// Versions below this must never be installed again once this one has proved good.
    pub min_version: String,
    /// The oldest version that may install this one directly. A machine further behind must first install
    /// the bundle of this version, found beside this one, so parts that upgrade one step at a time, such as
    /// Kanidm, never skip a step.
    pub upgrades_from: String,
    /// When this signature stops counting, in seconds since 1970. Releases re-sign the channel's manifest
    /// before then, so a machine shown an old copy notices it is being held back.
    pub expires: u64,
    /// A security fix: urged on the screen, and still never applied by force.
    pub security: bool,
    /// One plain sentence for the screen.
    pub summary: String,
    /// The system image.
    pub root: RootImage,
    /// The boot file.
    pub boot: BootImage,
}

/// A public key this image trusts.
#[derive(Debug, Clone)]
pub struct TrustedKey {
    id: String,
    key: VerifyingKey,
}

impl TrustedKey {
    /// Reads a key from its base64 text, or `None` if it is not a valid public key.
    pub fn parse(id: &str, base64_text: &str) -> Option<Self> {
        let raw = STANDARD.decode(base64_text.trim()).ok()?;
        let bytes: [u8; ED25519_PUBLIC_LEN] = raw.try_into().ok()?;
        Some(Self {
            id: id.to_owned(),
            key: VerifyingKey::from_bytes(&bytes).ok()?,
        })
    }
}

/// The architecture this program was built for, as bundles spell it.
pub const fn this_arch() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x86-64"
    }
}

/// Keys named `test-*` never count unless the image is marked as a debug image.
fn key_counts(file_name: &str, debug_image: bool) -> bool {
    debug_image || !file_name.starts_with(TEST_KEY_PREFIX)
}

/// Reads the image's trusted keys. A file that doesn't parse is skipped, which can only refuse more.
/// A folder that can't be read trusts nothing.
pub fn load_keys(dir: &Path) -> Vec<TrustedKey> {
    let debug_image = dir.join(DEBUG_IMAGE_MARK).exists();
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut keys = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(id) = name.strip_suffix(KEY_SUFFIX) else {
            continue;
        };
        if !key_counts(&name, debug_image) {
            continue;
        }
        let text = fs::read_to_string(entry.path()).unwrap_or_default();
        keys.extend(TrustedKey::parse(id, &text));
    }
    keys
}

/// How many different keys must sign an update on this image: at least one, from the threshold file.
pub fn load_threshold(dir: &Path) -> usize {
    fs::read_to_string(dir.join(THRESHOLD_FILE))
        .ok()
        .and_then(|text| text.trim().parse().ok())
        .unwrap_or(1)
        .max(1)
}

/// Returns the ids of the trusted keys that signed `manifest`, if at least `threshold` different ones did.
/// A signature file holds up to `MAX_SIGNATURES` lines of `<key id> <base64 signature>`, so one bundle can
/// carry an old key's signature and a new one's while keys rotate, or two people's.
pub fn verify_signature(
    manifest: &[u8],
    signatures: &str,
    keys: &[TrustedKey],
    threshold: usize,
) -> Result<Vec<String>, String> {
    if keys.is_empty() {
        return Err("This machine holds no key to check updates with.".to_owned());
    }
    let mut signed_by: Vec<String> = Vec::new();
    for line in signatures.lines().take(MAX_SIGNATURES) {
        let Some((id, text)) = line.split_once(' ') else {
            continue;
        };
        let Some(key) = keys.iter().find(|key| key.id == id) else {
            continue;
        };
        let signature = STANDARD
            .decode(text.trim())
            .ok()
            .and_then(|raw| Signature::from_slice(&raw).ok());
        let valid = signature.is_some_and(|s| key.key.verify(manifest, &s).is_ok());
        if valid && !signed_by.contains(&key.id) {
            signed_by.push(key.id.clone());
        }
    }
    if signed_by.is_empty() {
        return Err("This update is not signed by a key this machine trusts.".to_owned());
    }
    if signed_by.len() < threshold {
        return Err(format!(
            "This update needs {threshold} signatures from different keys and has {}, so it was refused.",
            signed_by.len()
        ));
    }
    Ok(signed_by)
}

/// What this machine knows when it judges a bundle.
#[derive(Debug, Clone)]
pub struct Facts {
    /// The running version.
    pub current: Version,
    /// This machine's architecture.
    pub arch: String,
    /// The anti-rollback floor, if one has been set.
    pub floor: Option<Version>,
    /// Versions that failed on this machine.
    pub failed: Vec<String>,
    /// A person asked to try a version that failed before.
    pub retry: bool,
    /// Size of the inactive system partition.
    pub slot_bytes: u64,
    /// Free bytes on the data disk.
    pub data_free: u64,
    /// Free bytes in the boot partition, counting the old boot file this update would replace.
    pub esp_free: u64,
    /// Seconds since 1970, by this machine's clock.
    pub now: u64,
}

/// The reason this machine must refuse `manifest`, in words for the screen, or `None` if it may take it.
/// Nothing is written before this has answered `None`.
pub fn refusal(manifest: &Manifest, facts: &Facts) -> Option<String> {
    if manifest.format != FORMAT {
        return Some(format!(
            "This update uses format {}, which this version cannot read.",
            manifest.format
        ));
    }
    if manifest.arch != facts.arch {
        return Some(format!(
            "This update is for {} machines; this one is {}.",
            manifest.arch, facts.arch
        ));
    }
    let (Some(version), Some(min_version), Some(upgrades_from)) = (
        Version::parse(&manifest.version),
        Version::parse(&manifest.min_version),
        Version::parse(&manifest.upgrades_from),
    ) else {
        return Some("This update has an unreadable version number.".to_owned());
    };
    if manifest.expires <= facts.now {
        return Some(
            "This update's signature has run out. Ask for a freshly signed copy: an old copy is how \
             someone would keep this machine from hearing about newer fixes."
                .to_owned(),
        );
    }
    if upgrades_from > version {
        return Some("This update's version numbers contradict each other.".to_owned());
    }
    if facts.current < upgrades_from && version > facts.current {
        return Some(format!(
            "Version {version} can only be installed from {upgrades_from} or later. Install version \
             {upgrades_from} first; the machine looks for it beside this update."
        ));
    }
    version_refusal(&version, &min_version, manifest, facts).or_else(|| space_refusal(manifest, facts))
}

/// The anti-rollback rules: only newer, at or above the floor, and not a known failure.
fn version_refusal(
    version: &Version,
    min_version: &Version,
    manifest: &Manifest,
    facts: &Facts,
) -> Option<String> {
    if *version == facts.current {
        return Some(format!("This machine already runs version {version}."));
    }
    if *version < facts.current {
        return Some(format!(
            "Version {version} is older than this machine's {}, so it can't be installed. \
             Use Go back to return to the previous version.",
            facts.current
        ));
    }
    if min_version > version {
        return Some("This update's version numbers contradict each other.".to_owned());
    }
    if facts.floor.as_ref().is_some_and(|floor| version < floor) {
        return Some(format!(
            "Version {version} has known problems and can't be installed again."
        ));
    }
    if facts.failed.contains(&manifest.version) && !facts.retry {
        return Some(format!(
            "Version {version} failed on this machine before. A person can ask to try it again."
        ));
    }
    None
}

/// The reason there is not enough room for `manifest`, or `None`.
fn space_refusal(manifest: &Manifest, facts: &Facts) -> Option<String> {
    if manifest.root.raw_size == 0 || manifest.root.raw_size > facts.slot_bytes {
        return Some("This update does not fit this machine's system partition.".to_owned());
    }
    let staged = manifest.root.size.saturating_add(manifest.boot.size);
    if facts.data_free < staged.saturating_add(DATA_RESERVE) {
        return Some(
            "There is not enough free space on the data disk for this update. Nothing was changed."
                .to_owned(),
        );
    }
    if facts.esp_free < manifest.boot.size.saturating_add(ESP_RESERVE) {
        return Some(
            "There is not enough free space in the boot partition for this update. Nothing was changed."
                .to_owned(),
        );
    }
    None
}

#[cfg(test)]
#[path = "manifest_tests.rs"]
mod tests;
