//! Who owns the data disk's files. `/var` keeps numeric ids, not names, so a new system whose users or
//! groups have other numbers would hand files to the wrong service (`OS-UPDATES.md`).

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::disk::with_mounted;

/// Names whose numeric id differs between two `passwd` or `group` files.
pub fn id_conflicts(current: &str, new: &str) -> Vec<String> {
    let ids = |text: &'_ str| -> HashMap<String, String> {
        text.lines()
            .filter_map(|line| {
                let mut fields = line.split(':');
                let name = fields.next()?;
                let id = fields.nth(1)?;
                Some((name.to_owned(), id.to_owned()))
            })
            .collect()
    };
    let (ours, theirs) = (ids(current), ids(new));
    let mut conflicts: Vec<String> = ours
        .iter()
        .filter(|(name, id)| theirs.get(*name).is_some_and(|other| other != *id))
        .map(|(name, _)| name.clone())
        .collect();
    conflicts.sort_unstable();
    conflicts
}

/// Checks the new system agrees about who owns the data disk's files.
///
/// Mounted without its journal, so
/// nothing is written: one changed block and the seal would refuse the whole slot. The machine id is not
/// copied: it lives on the data partition (`OS-VERITY.md`). A refusal here leaves the slot unnamed.
pub fn check_owners(partition: &str, at: &Path) -> Result<(), String> {
    with_mounted(partition, at, "ro,noload,noexec,nosuid,nodev", || {
        for file in ["passwd", "group"] {
            let ours = fs::read_to_string(format!("/etc/{file}")).map_err(|e| e.to_string())?;
            let theirs =
                fs::read_to_string(at.join("etc").join(file)).map_err(|e| e.to_string())?;
            let conflicts = id_conflicts(&ours, &theirs);
            if !conflicts.is_empty() {
                return Err(format!(
                    "This update would change who owns the data disk's files ({}). It was not installed.",
                    conflicts.join(", ")
                ));
            }
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::id_conflicts;

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
}
