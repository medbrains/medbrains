//! Privacy-preserving display helpers for masked field-access responses.

fn is_maskable_identifier_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric()
}

/// Mask every ASCII alpha-numeric character except the last visible segment.
///
/// Separators such as spaces, dashes, slashes, and `+` are preserved so values
/// remain recognizable without exposing the raw identifier.
pub fn mask_identifier_keep_last(value: &str, visible_chars: usize) -> String {
    let maskable_count = value
        .chars()
        .filter(|ch| is_maskable_identifier_char(*ch))
        .count();
    if maskable_count == 0 {
        return String::new();
    }

    let mut remaining_visible = visible_chars.min(maskable_count);
    let mut reversed = Vec::with_capacity(value.len());
    for ch in value.chars().rev() {
        if !is_maskable_identifier_char(ch) {
            reversed.push(ch);
            continue;
        }
        if remaining_visible > 0 {
            remaining_visible -= 1;
            reversed.push(ch);
        } else {
            reversed.push('X');
        }
    }

    reversed.into_iter().rev().collect()
}

/// Mask a phone number while preserving the country/format separators and last four digits.
pub fn mask_phone(value: &str) -> String {
    mask_identifier_keep_last(value, 4)
}

/// Replace a personal name with a non-identifying label.
pub fn mask_name(value: &str) -> String {
    if value.trim().is_empty() {
        String::new()
    } else {
        "Masked name".to_owned()
    }
}

/// Replace free text with a non-identifying label.
pub fn mask_free_text(value: &str) -> String {
    if value.trim().is_empty() {
        String::new()
    } else {
        "Masked text".to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_identifier_but_keeps_last_segment_and_separators() {
        assert_eq!(mask_identifier_keep_last("AB-1234-5678", 4), "XX-XXXX-5678");
    }

    #[test]
    fn masks_phone_with_country_code() {
        assert_eq!(mask_phone("+91 98765 43210"), "+XX XXXXX X3210");
    }

    #[test]
    fn masks_blank_text_as_blank() {
        assert_eq!(mask_name("   "), "");
        assert_eq!(mask_free_text("   "), "");
    }
}
