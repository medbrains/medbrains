//! Tests for reading the disk's layout: guessing wrong here would overwrite the running system.

use std::path::Path;

use super::{counted_name, hash_reader, parse_entries, parse_slots, slot_label};

const ROOT: &str = "b921b045-1df0-41c3-af44-4c6f280d3fae";
const HASH: &str = "df3300ce-d69f-4c92-978c-9bfb0f38d820";
const VAR: &str = "4d21b016-b534-45c2-a9fb-5c16e091fd2d";

/// The UUID of slot `n`'s system partition, or with `kind` 1 its hash tree.
fn uuid(n: usize, kind: usize) -> String {
    format!("0000000{kind}-0000-0000-0000-00000000000{n}")
}

/// `lsblk --json` for a disk with `count` slots, each a system partition and its hash tree.
fn listing(count: usize) -> String {
    let mut rows = vec![format!(
        r#"{{"path":"/dev/vda","partn":null,"partlabel":null,"partuuid":null,"parttype":null,"size":34359738368,"type":"disk"}},
           {{"path":"/dev/vda9","partn":9,"partlabel":"medbrains-data","partuuid":"{}","parttype":"{VAR}","size":29000000000,"type":"part"}}"#,
        uuid(9, 2)
    )];
    for n in 0..count {
        for (kind, (parttype, size)) in [(ROOT, 2_147_483_648_u64), (HASH, 33_554_432)]
            .iter()
            .enumerate()
        {
            rows.push(format!(
                r#"{{"path":"/dev/vda{at}","partn":{at},"partlabel":"medbrains_1.0.{n}","partuuid":"{}","parttype":"{parttype}","size":{size},"type":"part"}}"#,
                uuid(n, kind),
                at = 2 + n * 2 + kind
            ));
        }
    }
    format!(r#"{{"blockdevices":[{}]}}"#, rows.join(","))
}

/// The other slot is the pair of partitions the running root hash does not name, never the data disk.
#[test]
fn the_other_slot_is_found_and_the_data_disk_never_is() {
    let found = parse_slots(&listing(2), &uuid(1, 0), &uuid(1, 1), "/dev/vda");
    let paths = found
        .as_ref()
        .map(|s| (&*s.active.path, &*s.inactive.path, &*s.inactive_hash.path));
    assert_eq!(paths, Ok(("/dev/vda4", "/dev/vda2", "/dev/vda3")));
    let inactive = found.as_ref().map(|s| s.inactive.clone());
    assert_eq!(inactive.as_ref().map(|p| p.version()), Ok(Some("1.0.0")));
    assert_eq!(inactive.as_ref().map(|p| p.number.as_str()), Ok("2"));
}

/// One slot, three slots, or a root hash that names nothing on this disk: nothing is safe to overwrite.
#[test]
fn an_unexpected_layout_is_a_fault() {
    assert!(parse_slots(&listing(1), &uuid(0, 0), &uuid(0, 1), "/dev/vda").is_err());
    assert!(parse_slots(&listing(3), &uuid(0, 0), &uuid(0, 1), "/dev/vda").is_err());
    assert!(parse_slots(&listing(2), &uuid(7, 0), &uuid(0, 1), "/dev/vda").is_err());
    assert!(parse_slots(&listing(2), &uuid(0, 0), &uuid(7, 1), "/dev/vda").is_err());
    assert!(parse_slots("not json", &uuid(0, 0), &uuid(0, 1), "/dev/vda").is_err());
}

/// Only entries with a boot file count, and a counted one reports its starts left.
#[test]
fn boot_entries_are_read_from_bootctl() {
    let json = r#"[
        {"id":"a.efi","path":"/boot//EFI/Linux/a+2-1.efi","version":"1.0.1","isSelected":true,"triesLeft":2,"triesDone":1},
        {"id":"b.efi","path":"/boot//EFI/Linux/b.efi","version":"1.0.0","isSelected":false},
        {"id":"auto-reboot-to-firmware-setup","title":"Firmware"}]"#;
    let entries = parse_entries(json).unwrap_or_default();
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].tries_left, Some(2));
    assert!(entries[0].selected);
    assert_eq!(entries[1].tries_left, None);
    assert!(parse_entries("{}").is_err());
}

/// Counted names keep the base name, and a `+` inside a kernel version stays part of it.
#[test]
fn counted_names_replace_only_real_counts() {
    let name = |p: &str, l, d| counted_name(Path::new(p), l, d);
    assert_eq!(
        name("/b/medbrains-os_1.0.1+3-0.efi", 0, 3).as_deref(),
        Some("medbrains-os_1.0.1+0-3.efi")
    );
    assert_eq!(
        name("/b/medbrains-os_1.0.1.efi", 0, 0).as_deref(),
        Some("medbrains-os_1.0.1+0-0.efi")
    );
    assert_eq!(
        name("/b/medbrains-os-6.12.115+deb13.1-arm64.efi", 0, 0).as_deref(),
        Some("medbrains-os-6.12.115+deb13.1-arm64+0-0.efi")
    );
}

/// Hashing stops near the limit, so a huge file can't be read without end.
#[test]
fn hashing_is_bounded() {
    let endless = std::io::repeat(7);
    let hashed = hash_reader(endless, 5 * 1024 * 1024);
    assert!(hashed.is_ok_and(|(_, total)| total < 8 * 1024 * 1024));
    assert_eq!(slot_label("1.2.3"), "medbrains_1.2.3");
}
