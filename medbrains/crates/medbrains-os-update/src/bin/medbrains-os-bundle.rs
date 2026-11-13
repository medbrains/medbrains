//! The release side of updates: makes keys, bundles and signatures. Runs on a build or signing machine
//! and is not in the image. Signing takes only the small manifest, so the private key can stay on a
//! machine that never sees the image (`docs/architecture/OS-UPDATES.md`, the release key).
//!
//!     medbrains-os-bundle keygen <out prefix>
//!     medbrains-os-bundle extract <image.raw> <partition name> <out file>
//!     medbrains-os-bundle make <out dir> <version> <arch> <min version> <root image> <boot file>
//!         [--upgrades-from V] [--expires-days N] [--security] [--summary TEXT]
//!     medbrains-os-bundle refresh <bundle dir> <days>    new expiry; the old signatures are removed
//!     medbrains-os-bundle sign <bundle dir> <key id> <private key file>

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::process::{Command, ExitCode};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ed25519_dalek::{Signer, SigningKey};
use medbrains_os_update::disk;
use medbrains_os_update::manifest::{
    BOOT_FILE, BootImage, MANIFEST_FILE, Manifest, ROOT_FILE, RootImage, SIGNATURE_FILE,
};

const SECTOR: u64 = 512;
const ENTRY_LABEL_AT: usize = 56;
const NO_LIMIT: u64 = u64::MAX;
const FORMAT: u32 = 1;
const SEED_LEN: usize = 32;
const ZSTD_LEVEL: &str = "-19";

/// Makes a key pair. The private half gets mode 0600 and must never reach a machine in the field.
fn keygen(prefix: &str) -> Result<(), String> {
    let mut seed = [0_u8; SEED_LEN];
    getrandom::fill(&mut seed).map_err(|e| e.to_string())?;
    let key = SigningKey::from_bytes(&seed);
    let public = STANDARD.encode(key.verifying_key().to_bytes());
    fs::write(format!("{prefix}.pub"), format!("{public}\n")).map_err(|e| e.to_string())?;
    let private = format!("{prefix}.key");
    let mut file = File::options()
        .write(true)
        .create_new(true)
        .open(&private)
        .map_err(|e| format!("{private}: {e}"))?;
    file.set_permissions(std::os::unix::fs::PermissionsExt::from_mode(0o600))
        .map_err(|e| e.to_string())?;
    writeln!(file, "{}", STANDARD.encode(seed)).map_err(|e| e.to_string())
}

/// A partition's byte range, from a GPT in `header` and its `entries`, by the partition's name.
fn find_partition(header: &[u8], entries: &[u8], wanted: &str) -> Option<(u64, u64)> {
    let entry_size =
        usize::try_from(u32::from_le_bytes(header.get(84..88)?.try_into().ok()?)).ok()?;
    if entry_size < ENTRY_LABEL_AT || header.get(..8)? != b"EFI PART" {
        return None;
    }
    entries.chunks_exact(entry_size).find_map(|entry| {
        let label: Vec<u16> = entry
            .get(ENTRY_LABEL_AT..)?
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes(*pair))
            .take_while(|unit| *unit != 0)
            .collect();
        if String::from_utf16_lossy(&label) != wanted {
            return None;
        }
        let first = u64::from_le_bytes(entry.get(32..40)?.try_into().ok()?);
        let last = u64::from_le_bytes(entry.get(40..48)?.try_into().ok()?);
        Some((first * SECTOR, (last - first + 1) * SECTOR))
    })
}

/// Copies one partition out of a disk image, by its name.
fn extract(image: &str, wanted: &str, out: &str) -> Result<(), String> {
    let mut file = File::open(image).map_err(|e| format!("{image}: {e}"))?;
    let mut header = vec![0_u8; SECTOR as usize];
    file.seek(SeekFrom::Start(SECTOR))
        .map_err(|e| e.to_string())?;
    file.read_exact(&mut header).map_err(|e| e.to_string())?;
    let field = |at: usize| -> Result<u32, String> {
        let raw = header.get(at..at + 4).and_then(|r| r.try_into().ok());
        raw.map(u32::from_le_bytes)
            .ok_or_else(|| "A short GPT header.".to_owned())
    };
    let table = u64::from(field(72)?) * SECTOR;
    let mut entries = vec![
        0_u8;
        usize::try_from(u64::from(field(80)?) * u64::from(field(84)?))
            .map_err(|e| e.to_string())?
    ];
    file.seek(SeekFrom::Start(table))
        .map_err(|e| e.to_string())?;
    file.read_exact(&mut entries).map_err(|e| e.to_string())?;
    let (start, size) = find_partition(&header, &entries, wanted)
        .ok_or_else(|| format!("{image} has no partition named {wanted}."))?;
    file.seek(SeekFrom::Start(start))
        .map_err(|e| e.to_string())?;
    let mut target = File::create(out).map_err(|e| format!("{out}: {e}"))?;
    let copied = std::io::copy(&mut file.take(size), &mut target).map_err(|e| e.to_string())?;
    if copied == size {
        Ok(())
    } else {
        Err("The image is shorter than its partition table says.".to_owned())
    }
}

/// Everything `make` needs.
struct MakeArgs<'a> {
    out: &'a str,
    version: &'a str,
    arch: &'a str,
    min_version: &'a str,
    root: &'a str,
    boot: &'a str,
    upgrades_from: &'a str,
    expires_days: u64,
    security: bool,
    summary: &'a str,
}

/// How long a signature counts unless `--expires-days` says otherwise.
const DEFAULT_EXPIRES_DAYS: u64 = 30;
/// Any machine may install a bundle that names no earlier step.
const FROM_ANY: &str = "0.0";
const DAY_SECONDS: u64 = 24 * 60 * 60;

/// Seconds since 1970, `days` from now.
fn days_from_now(days: u64) -> Result<u64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    Ok(now + days * DAY_SECONDS)
}

/// The value after `flag` in `rest`, if it is there.
fn flag<'a>(rest: &[&'a str], name: &str) -> Option<&'a str> {
    rest.iter()
        .position(|arg| *arg == name)
        .and_then(|at| rest.get(at + 1).copied())
}

/// Gives a bundle a new expiry and removes its signatures, which no longer match. Releases do this to the
/// channel's newest bundle every week, so a machine served an old copy can tell.
fn refresh(bundle: &str, days: &str) -> Result<(), String> {
    let dir = Path::new(bundle);
    let days: u64 = days
        .parse()
        .map_err(|_| "Days must be a number.".to_owned())?;
    let text = fs::read(dir.join(MANIFEST_FILE)).map_err(|e| e.to_string())?;
    let mut manifest: Manifest = serde_json::from_slice(&text).map_err(|e| e.to_string())?;
    manifest.expires = days_from_now(days)?;
    let text = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    // A new file, renamed into place: the old one may be a hard link shared with another bundle.
    medbrains_os_update::state::write_atomically(&dir.join(MANIFEST_FILE), &text)
        .map_err(|e| e.to_string())?;
    match fs::remove_file(dir.join(SIGNATURE_FILE)) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Compresses the root image, hashes everything and writes the manifest. The signature comes after.
fn make(args: &MakeArgs<'_>) -> Result<(), String> {
    let dir = Path::new(args.out);
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let compressed = dir.join(ROOT_FILE);
    let done = Command::new("zstd")
        .args(["-q", "-f", "-T0", ZSTD_LEVEL, args.root, "-o"])
        .arg(&compressed)
        .status()
        .map_err(|e| format!("zstd could not start: {e}"))?;
    if !done.success() {
        return Err("zstd failed.".to_owned());
    }
    fs::copy(args.boot, dir.join(BOOT_FILE)).map_err(|e| format!("{}: {e}", args.boot))?;
    let (raw_sha256, raw_size) = disk::hash_file(Path::new(args.root), NO_LIMIT)?;
    let (sha256, size) = disk::hash_file(&compressed, NO_LIMIT)?;
    let (boot_sha256, boot_size) = disk::hash_file(&dir.join(BOOT_FILE), NO_LIMIT)?;
    let manifest = Manifest {
        format: FORMAT,
        version: args.version.to_owned(),
        arch: args.arch.to_owned(),
        min_version: args.min_version.to_owned(),
        upgrades_from: args.upgrades_from.to_owned(),
        expires: days_from_now(args.expires_days)?,
        security: args.security,
        summary: args.summary.to_owned(),
        root: RootImage {
            sha256,
            size,
            raw_sha256,
            raw_size,
        },
        boot: BootImage {
            sha256: boot_sha256,
            size: boot_size,
        },
    };
    let text = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(dir.join(MANIFEST_FILE), text).map_err(|e| e.to_string())
}

/// Adds one signature to a bundle, so during a rotation it can carry the old key's and the new one's.
fn sign(bundle: &str, key_id: &str, key_file: &str) -> Result<(), String> {
    let dir = Path::new(bundle);
    let text = fs::read_to_string(key_file).map_err(|e| format!("{key_file}: {e}"))?;
    let seed = STANDARD.decode(text.trim()).map_err(|e| e.to_string())?;
    let seed: [u8; SEED_LEN] = seed
        .try_into()
        .map_err(|_| "A key has 32 bytes.".to_owned())?;
    let manifest = fs::read(dir.join(MANIFEST_FILE)).map_err(|e| e.to_string())?;
    let signature = SigningKey::from_bytes(&seed).sign(&manifest);
    let mut file = File::options()
        .append(true)
        .create(true)
        .open(dir.join(SIGNATURE_FILE))
        .map_err(|e| e.to_string())?;
    writeln!(file, "{key_id} {}", STANDARD.encode(signature.to_bytes())).map_err(|e| e.to_string())
}

/// Picks the action.
fn run(args: &[String]) -> Result<(), String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    match refs.as_slice() {
        ["keygen", prefix] => keygen(prefix),
        ["extract", image, name, out] => extract(image, name, out),
        [
            "make",
            out,
            version,
            arch,
            min_version,
            root,
            boot,
            rest @ ..,
        ] => make(&MakeArgs {
            out,
            version,
            arch,
            min_version,
            root,
            boot,
            upgrades_from: flag(rest, "--upgrades-from").unwrap_or(FROM_ANY),
            expires_days: flag(rest, "--expires-days")
                .map_or(Ok(DEFAULT_EXPIRES_DAYS), str::parse)
                .map_err(|_| "--expires-days takes a number.".to_owned())?,
            security: rest.contains(&"--security"),
            summary: flag(rest, "--summary").unwrap_or(""),
        }),
        ["refresh", bundle, days] => refresh(bundle, days),
        ["sign", bundle, key_id, key_file] => sign(bundle, key_id, key_file),
        _ => Err("usage: medbrains-os-bundle keygen|extract|make|sign (see the source)".to_owned()),
    }
}

/// Runs the tool and says why if it could not.
fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(words) => {
            drop(writeln!(std::io::stderr(), "{words}"));
            ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::find_partition;

    /// A GPT with one partition, in the layout the UEFI specification gives.
    fn gpt(label: &str) -> (Vec<u8>, Vec<u8>) {
        let mut header = vec![0_u8; 512];
        header[..8].copy_from_slice(b"EFI PART");
        header[84..88].copy_from_slice(&128_u32.to_le_bytes());
        let mut entry = vec![0_u8; 128];
        entry[32..40].copy_from_slice(&100_u64.to_le_bytes());
        entry[40..48].copy_from_slice(&199_u64.to_le_bytes());
        for (index, unit) in label.encode_utf16().enumerate() {
            entry[56 + index * 2..58 + index * 2].copy_from_slice(&unit.to_le_bytes());
        }
        (header, entry)
    }

    /// The partition is found by its whole name, so a similar one is never taken for it.
    #[test]
    fn a_partition_is_found_by_its_exact_name() {
        let (header, entries) = gpt("medbrains_1.0.0");
        assert_eq!(
            find_partition(&header, &entries, "medbrains_1.0.0"),
            Some((51_200, 51_200))
        );
        assert_eq!(find_partition(&header, &entries, "medbrains_1.0"), None);
        assert_eq!(find_partition(&[0; 512], &entries, "medbrains_1.0.0"), None);
    }
}
