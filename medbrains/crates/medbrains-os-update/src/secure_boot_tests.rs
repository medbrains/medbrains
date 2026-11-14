use std::path::PathBuf;

use super::{
    GLOBAL, IMAGE_SECURITY, KEEP_PCR_4, ONLY_OURS, X509_TYPE, only_certificate, seal_pcrs,
};

const OURS: &[u8] = b"our certificate, DER";
const VENDOR: &[u8] = b"a vendor's certificate, DER";
/// `EFI_CERT_SHA256_GUID`: a hash entry, as a vendor db may also hold.
const SHA256_TYPE: [u8; 16] = [
    0x26, 0x16, 0xc4, 0xc1, 0x4c, 0x50, 0x92, 0x40, 0xac, 0xa9, 0x41, 0xf9, 0x36, 0x93, 0x43, 0x28,
];

/// One `EFI_SIGNATURE_LIST` of `kind` holding `certificates`, which must all be the same size.
fn list(kind: [u8; 16], certificates: &[&[u8]]) -> Vec<u8> {
    let size = 16 + certificates[0].len();
    let total = 28 + size * certificates.len();
    let mut bytes = kind.to_vec();
    for value in [total, 0, size] {
        bytes.extend_from_slice(&u32::try_from(value).unwrap_or_default().to_le_bytes());
    }
    for certificate in certificates {
        bytes.extend_from_slice(&[7; 16]);
        bytes.extend_from_slice(certificate);
    }
    bytes
}

/// A folder of firmware variables: modes, then PK, KEK and db, each with 4 attribute bytes first.
struct Firmware {
    dir: PathBuf,
}

impl Firmware {
    /// Secure Boot on and in user mode, with our certificate alone in PK, KEK and db.
    fn ours_alone(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("mb-sb-{name}-{}", std::process::id()));
        drop(std::fs::remove_dir_all(&dir));
        std::fs::create_dir_all(&dir).unwrap_or_default();
        let firmware = Self { dir };
        firmware.set("SecureBoot", GLOBAL, &[1]);
        firmware.set("SetupMode", GLOBAL, &[0]);
        let ours = list(X509_TYPE, &[OURS]);
        firmware.set("PK", GLOBAL, &ours);
        firmware.set("KEK", GLOBAL, &ours);
        firmware.set("db", IMAGE_SECURITY, &ours);
        firmware
    }

    /// Writes one variable.
    fn set(&self, name: &str, guid: &str, value: &[u8]) {
        let mut bytes = vec![7, 0, 0, 0];
        bytes.extend_from_slice(value);
        std::fs::write(self.dir.join(format!("{name}-{guid}")), bytes).unwrap_or_default();
    }

    /// Removes one variable.
    fn remove(&self, name: &str, guid: &str) {
        drop(std::fs::remove_file(
            self.dir.join(format!("{name}-{guid}")),
        ));
    }

    /// What this firmware would be sealed to.
    fn pcrs(&self) -> &'static str {
        seal_pcrs(&self.dir, OURS)
    }
}

/// Only our certificate, everywhere, in user or deployed mode: PCR 7 is enough.
#[test]
fn our_certificate_alone_seals_to_pcr_7() {
    let firmware = Firmware::ours_alone("alone");
    assert_eq!(firmware.pcrs(), ONLY_OURS);
    firmware.set("DeployedMode", GLOBAL, &[1]);
    firmware.set("AuditMode", GLOBAL, &[0]);
    assert_eq!(firmware.pcrs(), ONLY_OURS);
}

/// The review's case: a db that also trusts a vendor keeps PCR 4, as does a vendor KEK or PK, a second
/// list of hashes, or a vendor certificate in a list of its own.
#[test]
fn any_other_trusted_entry_keeps_pcr_4() {
    let firmware = Firmware::ours_alone("vendor");
    firmware.set(
        "db",
        IMAGE_SECURITY,
        &list(X509_TYPE, &[OURS, &VENDOR[..OURS.len()]]),
    );
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
    let mut two_lists = list(X509_TYPE, &[OURS]);
    two_lists.extend(list(X509_TYPE, &[VENDOR]));
    firmware.set("db", IMAGE_SECURITY, &two_lists);
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
    let mut with_hashes = list(X509_TYPE, &[OURS]);
    with_hashes.extend(list(SHA256_TYPE, &[&[9; 32]]));
    firmware.set("db", IMAGE_SECURITY, &with_hashes);
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
    let firmware = Firmware::ours_alone("vendor-kek");
    firmware.set("KEK", GLOBAL, &list(X509_TYPE, &[VENDOR]));
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
    let firmware = Firmware::ours_alone("vendor-pk");
    firmware.set("PK", GLOBAL, &list(X509_TYPE, &[VENDOR]));
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
}

/// Setup mode, audit mode, Secure Boot off, or any mode unreadable: keep PCR 4.
#[test]
fn a_mode_that_does_not_enforce_keeps_pcr_4() {
    for (name, value) in [("SetupMode", 1), ("AuditMode", 1), ("SecureBoot", 0)] {
        let firmware = Firmware::ours_alone(name);
        firmware.set(name, GLOBAL, &[value]);
        assert_eq!(firmware.pcrs(), KEEP_PCR_4, "{name}={value}");
    }
    let firmware = Firmware::ours_alone("no-mode");
    firmware.remove("SetupMode", GLOBAL);
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
    let firmware = Firmware::ours_alone("wide-mode");
    firmware.set("SecureBoot", GLOBAL, &[1, 0]);
    assert_eq!(firmware.pcrs(), KEEP_PCR_4);
}

/// A missing key database, or no certificate of ours to compare with, keeps PCR 4.
#[test]
fn nothing_to_compare_keeps_pcr_4() {
    for (name, guid) in [("PK", GLOBAL), ("KEK", GLOBAL), ("db", IMAGE_SECURITY)] {
        let firmware = Firmware::ours_alone(&format!("missing-{name}"));
        firmware.remove(name, guid);
        assert_eq!(firmware.pcrs(), KEEP_PCR_4, "{name} missing");
    }
    let firmware = Firmware::ours_alone("no-ours");
    assert_eq!(seal_pcrs(&firmware.dir, b""), KEEP_PCR_4);
}

/// Truncated, oversized or empty lists are not ours.
#[test]
fn malformed_lists_are_not_ours() {
    let good = list(X509_TYPE, &[OURS]);
    assert!(only_certificate(&good, OURS));
    assert!(!only_certificate(&good[..good.len() - 1], OURS));
    assert!(!only_certificate(&good[..20], OURS));
    assert!(!only_certificate(&[], OURS));
    let mut too_long = good.clone();
    too_long[16] = 0xff;
    assert!(!only_certificate(&too_long, OURS));
    let mut no_entries = good;
    no_entries.truncate(28);
    no_entries[16..20].copy_from_slice(&28_u32.to_le_bytes());
    assert!(!only_certificate(&no_entries, OURS));
}
