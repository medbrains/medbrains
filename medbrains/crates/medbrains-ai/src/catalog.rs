//! The read-API catalogue the assistant searches instead of reading whole.
//! Sending all ~650 endpoints cost ~6K tokens, and it was resent with every
//! later model call of the turn; a search sends the few that match.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use medbrains_core::ai_redact::Redacted;

use super::redaction;

/// The catalogue (`scripts/gen_ai_read_catalog.py`), `# section` headers
/// then one path per line.
const CATALOG: &str = include_str!("ai_read_catalog.txt");
/// Most endpoints one search returns.
const MAX_HITS: usize = 40;
/// Shortest query word that narrows anything.
const MIN_WORD: usize = 3;

/// Endpoints whose section or path holds a word of `query`, under their
/// section; with no usable word or no hit, the section names to search by.
/// With `typed_actions`, the endpoints an action replaces are left out.
pub(super) fn search(query: &str, typed_actions: bool) -> String {
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
            && !(typed_actions && super::action_tools::replaced_by(line).is_some())
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

// ── Discovery tool: list all read (GET) endpoints ───────────────────
// The whole read surface is large (650+ GET endpoints); rather than dump it into
// every request, the model calls this on demand to discover which path to hit,
// then uses call_api. The catalogue is generated from mod.rs by
// scripts/gen_ai_read_catalog.py — regenerate after route changes.

#[derive(serde::Deserialize)]
pub(super) struct ListApisArgs {
    /// Words from the question: `billing revenue`, `lab pending`.
    #[serde(default)]
    query: String,
}

pub(super) struct ListApisTool {
    pub(super) session: redaction::Session,
    /// Leave out the endpoints an action replaces (`ai.config.typed_actions`).
    pub(super) typed_actions: bool,
}

impl rig::tool::Tool for ListApisTool {
    const NAME: &'static str = "list_apis";
    type Error = std::convert::Infallible;
    type Args = ListApisArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Search the read (GET) API endpoints call_api can reach: pass a few words from the \
            question (e.g. 'billing revenue', 'lab pending'); you get the matching paths. Call \
            it before call_api when unsure of a path."
            .to_owned()
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "A few words from the question" }
            },
            "required": ["query"]
        })
    }

    fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        std::future::ready(Ok(redaction::for_model(
            &self.session,
            &search(&args.query, self.typed_actions),
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::search;

    #[test]
    fn a_search_returns_only_matching_endpoints() {
        let found = search("billing revenue", true);
        assert!(found.contains("/api/billing/reports/department-revenue"));
        assert!(!found.contains("/api/bedside/"));
        assert!(found.lines().count() <= 45);
    }

    #[test]
    fn with_typed_actions_the_replaced_endpoints_are_not_offered() {
        let found = search("opd queue", true);
        assert!(!found.lines().any(|l| l == "/api/opd/queue"), "{found}");
        assert!(found.contains("/api/opd/queue/wait-estimate"));
        assert!(
            search("opd queue", false)
                .lines()
                .any(|l| l == "/api/opd/queue")
        );
    }

    #[test]
    fn no_hit_lists_the_sections_to_search_by() {
        let found = search("zzzz", true);
        assert!(found.starts_with("No endpoint matched"));
        assert!(found.contains("billing"));
    }
}
