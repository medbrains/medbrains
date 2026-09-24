//! Morse fall-risk banding, as the bedside form records it.

/// Morse: 45 and above is high, 25 to 44 moderate, below 25 low.
#[must_use]
pub const fn morse_level(score: i64) -> &'static str {
    if score >= 45 {
        "high"
    } else if score >= 25 {
        "moderate"
    } else {
        "low"
    }
}

#[cfg(test)]
mod tests {
    use super::morse_level;

    #[test]
    fn bands_at_the_morse_cut_points() {
        assert_eq!(morse_level(0), "low");
        assert_eq!(morse_level(24), "low");
        assert_eq!(morse_level(25), "moderate");
        assert_eq!(morse_level(44), "moderate");
        assert_eq!(morse_level(45), "high");
    }
}
