//! SNOMED CT identifiers (SCTIDs).
//!
//! An SCTID is 6–18 digits ending in a Verhoeff check digit. Checking it at
//! the boundary turns a mistyped code into a clear refusal instead of a
//! silent "no such concept". Identifiers travel as strings in JSON: they
//! exceed 2^53, and a JavaScript client would round them into a different
//! concept.

/// Verhoeff multiplication table (dihedral group D5).
const D: [[u8; 10]; 10] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/// Verhoeff permutation table, as SNOMED generates it (spec 6.4.2:
/// `F[i][j] = F[i-1][F[1][j]]`). Row 4 differs from the table printed in
/// some general references; copying one of those rejects real SCTIDs.
const P: [[u8; 10]; 8] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/// Whether `digits` (check digit included) passes the Verhoeff check.
fn verhoeff_valid(digits: &str) -> bool {
    let mut c = 0u8;
    for (i, ch) in digits.bytes().rev().enumerate() {
        let n = ch.wrapping_sub(b'0');
        if n > 9 {
            return false;
        }
        c = D[usize::from(c)][usize::from(P[i % 8][usize::from(n)])];
    }
    c == 0
}

/// Parse a caller-supplied SCTID: 6–18 digits with a valid check digit.
///
/// Returns `None` for anything else — the caller says "not a SNOMED CT
/// identifier" rather than looking it up.
pub fn parse_sctid(value: &str) -> Option<i64> {
    let value = value.trim();
    if !(6..=18).contains(&value.len()) || !value.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if value.starts_with('0') || !verhoeff_valid(value) {
        return None;
    }
    value.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::parse_sctid;

    #[test]
    fn accepts_published_metadata_ids() {
        // Metadata identifiers every RF2 release uses (IS-A, FSN, synonym).
        assert_eq!(parse_sctid("116680003"), Some(116_680_003));
        assert_eq!(
            parse_sctid("900000000000003001"),
            Some(900_000_000_000_003_001)
        );
        assert_eq!(
            parse_sctid(" 900000000000013009 "),
            Some(900_000_000_000_013_009)
        );
        // The root and two top-level ids exercise every row of the table.
        assert_eq!(parse_sctid("138875005"), Some(138_875_005));
        assert_eq!(parse_sctid("404684003"), Some(404_684_003));
        assert_eq!(parse_sctid("71388002"), Some(71_388_002));
    }

    #[test]
    fn rejects_bad_check_digit_and_shapes() {
        assert_eq!(parse_sctid("116680004"), None, "one digit off");
        assert_eq!(parse_sctid("12345"), None, "too short");
        assert_eq!(parse_sctid("1166800O3"), None, "letter");
        assert_eq!(parse_sctid("0116680003"), None, "leading zero");
        assert_eq!(parse_sctid(""), None);
    }
}
