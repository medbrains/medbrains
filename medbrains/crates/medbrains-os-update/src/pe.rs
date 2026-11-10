//! Reads one section out of a boot file (a PE image). Used only on a file whose hash the signed
//! manifest already vouched for, and bounds-checked anyway.

const PE_OFFSET_AT: usize = 0x3c;
const COFF_LEN: usize = 24;
const SECTION_LEN: usize = 40;
const NAME_LEN: usize = 8;
const SIZE_AT: usize = 8;
const FILE_SIZE_AT: usize = 16;
const FILE_OFFSET_AT: usize = 20;
const SECTION_COUNT_AT: usize = 6;
const OPTIONAL_SIZE_AT: usize = 20;
const MAX_SECTIONS: usize = 96;

/// A little-endian `u16` at `at`.
fn u16_at(bytes: &[u8], at: usize) -> Option<usize> {
    let raw: [u8; 2] = bytes.get(at..at.checked_add(2)?)?.try_into().ok()?;
    Some(usize::from(u16::from_le_bytes(raw)))
}

/// A little-endian `u32` at `at`.
fn u32_at(bytes: &[u8], at: usize) -> Option<usize> {
    let raw: [u8; 4] = bytes.get(at..at.checked_add(4)?)?.try_into().ok()?;
    usize::try_from(u32::from_le_bytes(raw)).ok()
}

/// The contents of section `name`, without padding, or `None` if the file has none or is malformed.
pub fn section<'a>(bytes: &'a [u8], name: &str) -> Option<&'a [u8]> {
    let pe = u32_at(bytes, PE_OFFSET_AT)?;
    if bytes.get(pe..pe.checked_add(4)?)? != b"PE\0\0" {
        return None;
    }
    let count = u16_at(bytes, pe + SECTION_COUNT_AT)?.min(MAX_SECTIONS);
    let table = pe + COFF_LEN + u16_at(bytes, pe + OPTIONAL_SIZE_AT)?;
    for index in 0..count {
        let at = table + index * SECTION_LEN;
        let raw_name = bytes.get(at..at + NAME_LEN)?;
        if raw_name.split(|b| *b == 0).next()? != name.as_bytes() {
            continue;
        }
        let size = u32_at(bytes, at + SIZE_AT)?.min(u32_at(bytes, at + FILE_SIZE_AT)?);
        let start = u32_at(bytes, at + FILE_OFFSET_AT)?;
        return bytes.get(start..start.checked_add(size)?);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::section;

    const OFFSET: usize = 0x100;
    const TABLE: usize = 0x40 + 24;

    /// Writes `bytes` into `file` at `at`.
    fn put(file: &mut [u8], at: usize, bytes: &[u8]) {
        for (index, byte) in bytes.iter().enumerate() {
            if let Some(slot) = file.get_mut(at + index) {
                *slot = *byte;
            }
        }
    }

    /// A minimal PE image with one section, as `ukify` lays them out.
    fn pe_with(name: &[u8; 8], body: &[u8]) -> Vec<u8> {
        let mut file = vec![0_u8; 0x200];
        put(&mut file, 0x3c, &[0x40]);
        put(&mut file, 0x40, b"PE\0\0");
        put(&mut file, 0x46, &[1]);
        put(&mut file, TABLE, name);
        let size = u32::try_from(body.len()).unwrap_or(0).to_le_bytes();
        put(&mut file, TABLE + 8, &size);
        put(&mut file, TABLE + 16, &size);
        put(&mut file, TABLE + 20, &0x100_u32.to_le_bytes());
        put(&mut file, OFFSET, body);
        file
    }

    /// The section is found by its exact name.
    #[test]
    fn a_section_is_found_by_name_and_only_by_name() {
        let file = pe_with(b".pcrpkey", b"KEY");
        assert_eq!(section(&file, ".pcrpkey"), Some(&b"KEY"[..]));
        assert_eq!(section(&file, ".osrel"), None);
    }

    /// Damaged files must end in `None`, never in a panic or a read out of bounds.
    #[test]
    fn a_malformed_file_has_no_sections() {
        assert_eq!(section(b"", ".pcrpkey"), None);
        assert_eq!(section(&[0xff; 64], ".pcrpkey"), None);
        let mut lying = pe_with(b".pcrpkey", b"KEY");
        put(&mut lying, TABLE + 8, &u32::MAX.to_le_bytes());
        put(&mut lying, TABLE + 16, &u32::MAX.to_le_bytes());
        assert_eq!(section(&lying, ".pcrpkey"), None);
    }
}
