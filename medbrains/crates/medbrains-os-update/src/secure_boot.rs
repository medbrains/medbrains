//! Decides whether the data disk may be sealed without PCR 4.
//!
//! `docs/architecture/OS-KEYS.md`, "Binding to the signed boot image". PCR 7 stands in for PCR 4 only if the firmware enforces Secure Boot and trusts
//! our certificate alone: any other certificate in PK, KEK or db could have signed a boot chain that leaves
//! PCR 7 as it is. Anything not proven is "keep PCR 4". dbx may hold anything: it only takes trust away.

use std::fs;
use std::path::Path;

/// The firmware's variables, as the kernel shows them: 4 attribute bytes, then the value.
pub const EFIVARS: &str = "/sys/firmware/efi/efivars";
/// Our Secure Boot certificate, DER, on the sealed system partition (build.sh puts it there).
pub const OUR_CERTIFICATE: &str = "/usr/share/medbrains/secure-boot-db.der";
const GLOBAL: &str = "8be4df61-93ca-11d2-aa0d-00e098032b8c";
const IMAGE_SECURITY: &str = "d719b2cb-3d3a-4596-a3bc-dad00e67656f";
/// `EFI_CERT_X509_GUID` as stored: its first three fields little-endian.
const X509_TYPE: [u8; 16] = [
    0xa1, 0x59, 0xc0, 0xa5, 0xe4, 0x94, 0xa7, 0x4a, 0x87, 0xb5, 0xab, 0x15, 0x5c, 0x2b, 0xf0, 0x72,
];
const ATTRIBUTES: usize = 4;
/// Signature type (16), list size, header size and signature size (4 each).
const LIST_HEADER: usize = 28;
/// Each signature starts with its owner's GUID.
const OWNER: usize = 16;
/// The seal with PCR 7 alone, and the one that keeps PCR 4.
pub const ONLY_OURS: &str = "7";
pub const KEEP_PCR_4: &str = "4+7";

/// One variable's value without its attribute bytes; `None` if missing or unreadable.
fn variable(dir: &Path, name: &str, guid: &str) -> Option<Vec<u8>> {
    let bytes = fs::read(dir.join(format!("{name}-{guid}"))).ok()?;
    bytes.get(ATTRIBUTES..).map(<[u8]>::to_vec)
}

/// A one-byte mode variable's value; `None` if missing, unreadable or not one byte.
fn mode(dir: &Path, name: &str) -> Option<u8> {
    match variable(dir, name, GLOBAL)?.as_slice() {
        [value] => Some(*value),
        _ => None,
    }
}

/// Reads a little-endian u32 at `at`.
fn u32_at(bytes: &[u8], at: usize) -> Option<usize> {
    let raw: [u8; 4] = bytes.get(at..at + 4)?.try_into().ok()?;
    usize::try_from(u32::from_le_bytes(raw)).ok()
}

/// True only if `lists` is well formed, holds at least one signature, and every signature in it is an
/// X.509 certificate equal to `ours`. A malformed list is not ours.
pub fn only_certificate(lists: &[u8], ours: &[u8]) -> bool {
    let (mut at, mut seen) = (0, 0_usize);
    while at < lists.len() {
        let (Some(list), Some(header), Some(size)) = (
            u32_at(lists, at + 16),
            u32_at(lists, at + 20),
            u32_at(lists, at + 24),
        ) else {
            return false;
        };
        let Some(end) = at.checked_add(list).filter(|end| *end <= lists.len()) else {
            return false;
        };
        let first = at + LIST_HEADER + header;
        if lists.get(at..at + 16) != Some(&X509_TYPE[..]) || size <= OWNER || first > end {
            return false;
        }
        if !(end - first).is_multiple_of(size) {
            return false;
        }
        for start in (first..end).step_by(size) {
            if lists.get(start + OWNER..start + size) != Some(ours) {
                return false;
            }
            seen += 1;
        }
        at = end;
    }
    seen > 0
}

/// The PCRs to seal to, from the firmware variables in `dir` and our certificate `ours`.
///
/// PCR 7 alone only if Secure Boot is on, not in setup or audit mode, and PK, KEK and db each hold our certificate
/// and nothing else. Deployed mode is allowed: it is user mode, locked further.
pub fn seal_pcrs(dir: &Path, ours: &[u8]) -> &'static str {
    let enforced = mode(dir, "SecureBoot") == Some(1)
        && mode(dir, "SetupMode") == Some(0)
        && mode(dir, "AuditMode").unwrap_or(0) == 0;
    let ours_alone = |name: &str, guid: &str| {
        variable(dir, name, guid).is_some_and(|lists| only_certificate(&lists, ours))
    };
    if enforced
        && !ours.is_empty()
        && ours_alone("PK", GLOBAL)
        && ours_alone("KEK", GLOBAL)
        && ours_alone("db", IMAGE_SECURITY)
    {
        ONLY_OURS
    } else {
        KEEP_PCR_4
    }
}

/// `seal_pcrs` for this machine. No certificate on the system partition means keep PCR 4.
pub fn this_machine() -> &'static str {
    let ours = fs::read(OUR_CERTIFICATE).unwrap_or_default();
    seal_pcrs(Path::new(EFIVARS), &ours)
}

#[cfg(test)]
#[path = "secure_boot_tests.rs"]
mod tests;
