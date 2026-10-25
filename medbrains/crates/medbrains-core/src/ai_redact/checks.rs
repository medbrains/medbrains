//! Check-digit tests that tell a real identifier from a number that merely has
//! its length: Verhoeff for Aadhaar, Luhn for payment cards.

const VERHOEFF_D: [[u8; 10]; 10] = [
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

const VERHOEFF_P: [[u8; 10]; 8] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

fn digits(s: &str) -> Vec<u8> {
    s.bytes()
        .filter(u8::is_ascii_digit)
        .map(|b| b - b'0')
        .collect()
}

/// A 12-digit number whose Verhoeff check digit holds, and which does not
/// start with 0 or 1 (UIDAI never issues those) — the shape of an Aadhaar.
#[must_use]
pub(super) fn is_aadhaar(s: &str) -> bool {
    let d = digits(s);
    if d.len() != 12 || d[0] < 2 {
        return false;
    }
    let mut c = 0u8;
    for (i, &n) in d.iter().rev().enumerate() {
        c = VERHOEFF_D[usize::from(c)][usize::from(VERHOEFF_P[i % 8][usize::from(n)])];
    }
    c == 0
}

/// A 13–19 digit number whose Luhn check holds — the shape of a card number.
#[must_use]
pub(super) fn is_card(s: &str) -> bool {
    let d = digits(s);
    if !(13..=19).contains(&d.len()) {
        return false;
    }
    let sum: u32 = d
        .iter()
        .rev()
        .enumerate()
        .map(|(i, &n)| {
            let n = u32::from(n);
            if i % 2 == 1 {
                let x = n * 2;
                if x > 9 { x - 9 } else { x }
            } else {
                n
            }
        })
        .sum();
    sum % 10 == 0
}

#[cfg(test)]
mod tests {
    use super::{is_aadhaar, is_card};

    #[test]
    fn verhoeff_tells_an_aadhaar_from_any_twelve_digits() {
        // A UIDAI-published test number shape: valid check digit.
        assert!(is_aadhaar("4991 1866 5246"));
        assert!(!is_aadhaar("4991 1866 5247"));
        assert!(!is_aadhaar("1234 5678 9012"));
    }

    #[test]
    fn luhn_tells_a_card_from_any_sixteen_digits() {
        assert!(is_card("4111 1111 1111 1111"));
        assert!(!is_card("4111 1111 1111 1112"));
    }
}
