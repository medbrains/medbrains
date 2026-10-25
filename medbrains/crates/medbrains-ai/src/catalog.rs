//! The read-API catalogue the assistant searches instead of reading whole.
//! Sending all ~650 endpoints cost ~6K tokens, and it was resent with every
//! later model call of the turn; a search sends the few that match.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

/// The catalogue (`scripts/gen_ai_read_catalog.py`), `# section` headers
/// then one path per line.
const CATALOG: &str = include_str!("ai_read_catalog.txt");
/// Most endpoints one search returns.
const MAX_HITS: usize = 40;
/// Shortest query word that narrows anything.
const MIN_WORD: usize = 3;

/// Endpoints whose section or path holds a word of `query`, under their
/// section; with no usable word or no hit, the section names to search by.
pub(super) fn search(query: &str) -> String {
    let words: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric())
        .map(str::to_lowercase)
        .filter(|w| w.len() >= MIN_WORD)
        .collect();
    let mut section = "";
    let mut out: Vec<String> = Vec::new();
    let mut hits = 0;
    for line in CATALOG.lines() {
        if let Some(name) = line.strip_prefix("# ") {
            section = name;
            continue;
        }
        let haystack = format!("{section} {line}").to_lowercase();
        if hits < MAX_HITS
            && !line.is_empty()
            && words.iter().any(|w| haystack.contains(w.as_str()))
        {
            let header = format!("# {section}");
            if out
                .last()
                .is_none_or(|l| !l.starts_with('#') || *l != header)
                && !out.contains(&header)
            {
                out.push(header);
            }
            out.push(line.to_owned());
            hits += 1;
        }
    }
    if hits == 0 {
        let sections: Vec<&str> = CATALOG
            .lines()
            .filter_map(|l| l.strip_prefix("# "))
            .collect();
        return format!(
            "No endpoint matched {query:?}. Search again with words from these sections: {}",
            sections.join(", ")
        );
    }
    out.join("\n")
}

#[cfg(test)]
mod tests {
    use super::search;

    #[test]
    fn a_search_returns_only_matching_endpoints() {
        let found = search("billing revenue");
        assert!(found.contains("/api/billing/reports/department-revenue"));
        assert!(!found.contains("/api/bedside/"));
        assert!(found.lines().count() <= 45);
    }

    #[test]
    fn no_hit_lists_the_sections_to_search_by() {
        let found = search("zzzz");
        assert!(found.starts_with("No endpoint matched"));
        assert!(found.contains("billing"));
    }
}
