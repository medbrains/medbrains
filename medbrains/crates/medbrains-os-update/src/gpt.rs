//! Finds a partition in a disk image by its name, from the GPT the UEFI specification lays out. Used on a
//! build machine, by the bundle tool and the OS tests, never on a running system.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const SECTOR: u64 = 512;
const ENTRY_LABEL_AT: usize = 56;

/// A partition's byte range, from a GPT in `header` and its `entries`, by the partition's name.
pub fn find_partition(header: &[u8], entries: &[u8], wanted: &str) -> Option<(u64, u64)> {
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
        Some((first * SECTOR, (last.checked_sub(first)? + 1) * SECTOR))
    })
}

/// The byte offset and size of the partition named `wanted` in the disk image at `image`.
pub fn partition_range(image: &Path, wanted: &str) -> Result<(u64, u64), String> {
    let shown = image.display();
    let mut file = File::open(image).map_err(|e| format!("{shown}: {e}"))?;
    let mut header = vec![0_u8; 512];
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
    find_partition(&header, &entries, wanted)
        .ok_or_else(|| format!("{shown} has no partition named {wanted}."))
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

    /// The partition is found by its whole name, so a similar one, such as its hash tree, is never
    /// taken for it.
    #[test]
    fn a_partition_is_found_by_its_exact_name() {
        let (header, entries) = gpt("medbrains_1.0.0");
        assert_eq!(
            find_partition(&header, &entries, "medbrains_1.0.0"),
            Some((51_200, 51_200))
        );
        assert_eq!(find_partition(&header, &entries, "medbrains_1.0"), None);
        assert_eq!(
            find_partition(&header, &entries, "medbrains_1.0.0_verity"),
            None
        );
        assert_eq!(find_partition(&[0; 512], &entries, "medbrains_1.0.0"), None);
    }
}
