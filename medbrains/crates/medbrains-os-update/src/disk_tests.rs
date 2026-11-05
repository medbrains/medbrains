//! Tests for reading the disk's layout: guessing wrong here would overwrite the running system.

use std::path::Path;

use super::{counted_name, hash_reader, id_conflicts, parse_entries, parse_slots, slot_label};

const ROOT: &str = "b921b045-1df0-41c3-af44-4c6f280d3fae";
const VAR: &str = "4d21b016-b534-45c2-a9fb-5c16e091fd2d";

/// `lsblk --json` for a disk with `count` system partitions.
fn listing(count: usize) -> String {
    let mut rows = vec![format!(
        r#"{{"path":"/dev/vda","partn":null,"partlabel":null,"parttype":null,"size":34359738368,"type":"disk"}},
           {{"path":"/dev/vda4","partn":4,"partlabel":"medbrains-data","parttype":"{VAR}","size":29000000000,"type":"part"}}"#
    )];
    for n in 0..count {
        rows.push(format!(
            r#"{{"path":"/dev/vda{slot}","partn":{slot},"partlabel":"medbrains_1.0.{n}","parttype":"{ROOT}","size":2147483648,"type":"part"}}"#,
            slot = n + 2
        ));
    }
    format!(r#"{{"blockdevices":[{}]}}"#, rows.join(","))
}

/// The other partition is the one of the same type that is not running, never the data disk.
#[test]
fn the_other_slot_is_found_and_the_data_disk_never_is() {
    let found = parse_slots(&listing(2), "/dev/vda3", "/dev/vda");
    let slots = found.as_ref().map(|s| (&s.active.path, &s.inactive.path));
    assert_eq!(
        slots,
        Ok((&"/dev/vda3".to_owned(), &"/dev/vda2".to_owned()))
    );
    let inactive = found.as_ref().map(|s| s.inactive.clone());
    assert_eq!(inactive.as_ref().map(|p| p.version()), Ok(Some("1.0.0")));
    assert_eq!(inactive.as_ref().map(|p| p.number.as_str()), Ok("2"));
}

/// One slot, three slots, or an unknown running partition: nothing is safe to overwrite.
#[test]
fn an_unexpected_layout_is_a_fault() {
    assert!(parse_slots(&listing(1), "/dev/vda2", "/dev/vda").is_err());
    assert!(parse_slots(&listing(3), "/dev/vda2", "/dev/vda").is_err());
    assert!(parse_slots(&listing(2), "/dev/vda9", "/dev/vda").is_err());
    assert!(parse_slots("not json", "/dev/vda2", "/dev/vda").is_err());
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

/// A shifted id would hand the database's files to another user: the pingora branch adds a user,
/// and the kiosk's number moved by one when this was dynamic.
#[test]
fn a_changed_id_is_named_and_a_new_user_is_fine() {
    let ours = "root:x:0:0::/root:/bin/sh\nkiosk:x:989:989::/var/lib/kiosk:/bin/false\n";
    let same = "root:x:0:0::/root:/bin/sh\nkiosk:x:989:989::/var/lib/kiosk:/bin/false\nfront:x:988:988::/:/bin/false\n";
    let moved = "root:x:0:0::/root:/bin/sh\nkiosk:x:988:988::/var/lib/kiosk:/bin/false\n";
    assert!(id_conflicts(ours, same).is_empty());
    assert_eq!(id_conflicts(ours, moved), ["kiosk"]);
    assert!(id_conflicts("root:x:0:0\n", "other:x:5:5\n").is_empty());
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
