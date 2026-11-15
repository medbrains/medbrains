//! Comparing secrets: one-time codes, their hashes, shared keys.

/// Compares without stopping at the first difference, so the time taken does
/// not say how much of a guess was right. Lengths are not secret.
#[must_use]
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len()
        && a.bytes()
            .zip(b.bytes())
            .fold(0_u8, |diff, (x, y)| diff | (x ^ y))
            == 0
}

#[cfg(test)]
mod tests {
    use super::constant_time_eq;

    #[test]
    fn equal_only_when_every_byte_matches() {
        assert!(constant_time_eq("123456", "123456"));
        assert!(!constant_time_eq("123456", "123457"));
        assert!(!constant_time_eq("123456", "12345"));
        assert!(constant_time_eq("", ""));
    }
}
