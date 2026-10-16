//! Short names and abbreviations a catalogue entry is searched by
//! ("LFT", "NCCT head"). Shared by the lab test and radiology exam masters.

/// Most short names one entry may carry.
pub const SYNONYMS_MAX: usize = 20;

/// Trimmed, non-empty, case-insensitively unique, at most [`SYNONYMS_MAX`].
#[must_use]
pub fn clean_synonyms(list: Option<&[String]>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    list.unwrap_or_default()
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && seen.insert(s.to_lowercase()))
        .take(SYNONYMS_MAX)
        .map(str::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{SYNONYMS_MAX, clean_synonyms};

    #[test]
    fn synonyms_are_trimmed_deduplicated_and_bounded() {
        let raw: Vec<String> = ["LFT", " lft ", "", "Liver function"]
            .iter()
            .map(|s| (*s).to_owned())
            .collect();
        assert_eq!(clean_synonyms(Some(&raw)), vec!["LFT", "Liver function"]);
        let many: Vec<String> = (0..40).map(|n| format!("s{n}")).collect();
        assert_eq!(clean_synonyms(Some(&many)).len(), SYNONYMS_MAX);
        assert!(clean_synonyms(None).is_empty());
    }
}
