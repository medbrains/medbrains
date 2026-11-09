//! Free-text "contains" search for capped lists.
//!
//! A list capped at a few hundred rows silently drops what falls past the
//! cap; a picker that filters only what it was sent cannot find it. The
//! screen sends what was typed and the query narrows with `ILIKE`, so the
//! row the user looks for is in what comes back.

/// The `ILIKE` pattern for "contains `q`", with `\`, `%` and `_` taken
/// literally; `None` for no search (absent or blank).
pub fn contains_pattern(q: Option<&str>) -> Option<String> {
    let q = q.map(str::trim).filter(|q| !q.is_empty())?;
    let escaped = q
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    Some(format!("%{escaped}%"))
}

#[cfg(test)]
mod tests {
    use super::contains_pattern;

    #[test]
    fn typed_text_is_matched_literally() {
        assert_eq!(contains_pattern(None), None);
        assert_eq!(contains_pattern(Some("  ")), None);
        assert_eq!(
            contains_pattern(Some(" Ward 3 ")).as_deref(),
            Some("%Ward 3%")
        );
        assert_eq!(
            contains_pattern(Some("50%_a\\b")).as_deref(),
            Some("%50\\%\\_a\\\\b%")
        );
    }
}
