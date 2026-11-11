//! The release side of updates: makes keys, bundles and signatures. Runs on a build or signing machine
//! and is not in the image. Signing takes only the small manifest, so the private key can stay on a
//! machine that never sees the image (`docs/architecture/OS-UPDATES.md`, the release key).
//!
//!     medbrains-os-bundle keygen <out prefix>
//!     medbrains-os-bundle extract <image.raw> <partition name> <out file>
//!     medbrains-os-bundle make <out dir> <version> <arch> <min version> <root image> <verity image> <boot file>
//!         [--upgrades-from V] [--expires-days N] [--security] [--summary TEXT] [--unchecked-seal]
//!
//! `make` refuses a boot file whose command line does not seal its system, and a system or tree that does
//! not match the boot file's root hash, so a release built wrong is stopped here and not on every machine.
//! `--unchecked-seal` skips that, for the test bundle that proves machines refuse such a release.
//!     medbrains-os-bundle refresh <bundle dir> <days>    new expiry; the old signatures are removed
//!     medbrains-os-bundle sign <bundle dir> <key id> <private key file>

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::process::{Command, ExitCode};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ed25519_dalek::{Signer, SigningKey};
use medbrains_os_update::manifest::{
    BOOT_FILE, BootImage, MANIFEST_FILE, Manifest, ROOT_FILE, RootImage, SIGNATURE_FILE,
    VERITY_FILE,
};
use medbrains_os_update::{disk, gpt, pe, verity, verity_tree};

const NO_LIMIT: u64 = u64::MAX;
const FORMAT: u32 = 2;
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

/// Copies one partition out of a disk image, by its name.
fn extract(image: &str, wanted: &str, out: &str) -> Result<(), String> {
    let (start, size) = gpt::partition_range(Path::new(image), wanted)?;
    let mut file = File::open(image).map_err(|e| format!("{image}: {e}"))?;
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
    verity: &'a str,
    boot: &'a str,
    upgrades_from: &'a str,
    expires_days: u64,
    security: bool,
    summary: &'a str,
    unchecked_seal: bool,
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

/// Compresses a partition image into the bundle as `name` and describes both forms of it.
fn pack(image: &str, dir: &Path, name: &str) -> Result<RootImage, String> {
    let compressed = dir.join(name);
    let done = Command::new("zstd")
        .args(["-q", "-f", "-T0", ZSTD_LEVEL, image, "-o"])
        .arg(&compressed)
        .status()
        .map_err(|e| format!("zstd could not start: {e}"))?;
    if !done.success() {
        return Err("zstd failed.".to_owned());
    }
    let (raw_sha256, raw_size) = disk::hash_file(Path::new(image), NO_LIMIT)?;
    let (sha256, size) = disk::hash_file(&compressed, NO_LIMIT)?;
    Ok(RootImage {
        sha256,
        size,
        raw_sha256,
        raw_size,
    })
}

/// Refuses a boot file that does not seal its system, and a system or tree that is not the one its root
/// hash names: the same checks a machine makes before naming a slot, made once, before anything is signed.
fn check_seal(args: &MakeArgs<'_>) -> Result<(), String> {
    let boot = fs::read(args.boot).map_err(|e| format!("{}: {e}", args.boot))?;
    let line = pe::section(&boot, ".cmdline")
        .ok_or_else(|| format!("{} has no command line.", args.boot))?;
    let line = String::from_utf8_lossy(line);
    let roothash = verity::sealed_cmdline(&line).map_err(|why| format!("{}: {why}", args.boot))?;
    verity_tree::verify_tree(Path::new(args.root), Path::new(args.verity), roothash)
}

/// Checks the seal, then compresses the root image and its tree, hashes everything and writes the
/// manifest. The signature comes after.
fn make(args: &MakeArgs<'_>) -> Result<(), String> {
    if !args.unchecked_seal {
        check_seal(args)?;
    }
    let dir = Path::new(args.out);
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let root = pack(args.root, dir, ROOT_FILE)?;
    let verity = pack(args.verity, dir, VERITY_FILE)?;
    fs::copy(args.boot, dir.join(BOOT_FILE)).map_err(|e| format!("{}: {e}", args.boot))?;
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
        root,
        verity,
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
            verity,
            boot,
            rest @ ..,
        ] => make(&MakeArgs {
            out,
            version,
            arch,
            min_version,
            root,
            verity,
            boot,
            upgrades_from: flag(rest, "--upgrades-from").unwrap_or(FROM_ANY),
            expires_days: flag(rest, "--expires-days")
                .map_or(Ok(DEFAULT_EXPIRES_DAYS), str::parse)
                .map_err(|_| "--expires-days takes a number.".to_owned())?,
            security: rest.contains(&"--security"),
            summary: flag(rest, "--summary").unwrap_or(""),
            unchecked_seal: rest.contains(&"--unchecked-seal"),
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
