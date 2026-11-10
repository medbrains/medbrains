//! Free text with the person taken out, for anything that leaves as a log line
//! or an error report.
//!
//! Text goes through the AI redactor first (`medbrains_core::ai_redact`, the
//! same patterns that keep identifiers out of model calls), then through three
//! rules of our own that suit error messages, where words are lower case and
//! values are not: anything quoted goes, two or more capitalised words in a
//! row go (a name with no "Mr" in front of it), and any run of four or more
//! digits goes (a UHID with no "UHID" in front of it). A lone capitalised word
//! is not caught — it is also how every sentence starts. Before any of that,
//! credentials go: a JWT, a `Bearer` value, or any opaque run of 32+ token
//! characters (an API key, a session id).

use std::sync::LazyLock;

use medbrains_core::ai_redact::redact_for_record;
use regex::Regex;

/// Error text with identifiers and values removed.
#[must_use]
pub fn scrub_text(text: &str) -> String {
    let Some([tokens, quoted, names, digits]) = rules() else {
        // A rule that does not compile withholds the text rather than send it.
        return "[withheld]".to_owned();
    };
    let text = tokens.replace_all(text, "[token]");
    let redacted = redact_for_record(&text, chrono::Utc::now().date_naive());
    let text = quoted.replace_all(&redacted, "[value]");
    let text = names.replace_all(&text, "[name]");
    digits.replace_all(&text, "[n]").into_owned()
}

/// The compiled token, quoted-value, name and digit-run rules, built once.
fn rules() -> Option<[&'static Regex; 4]> {
    static RULES: LazyLock<Result<[Regex; 4], regex::Error>> = LazyLock::new(|| {
        Ok([
            Regex::new(r"eyJ[\w-]+\.[\w-]+\.[\w-]*|(?i:\bbearer\s+)[\w.~+/-]+=*|\b[\w-]{32,}\b")?,
            Regex::new(r#"'[^'\n]{1,200}'|"[^"\n]{1,200}"|`[^`\n]{1,200}`"#)?,
            Regex::new(r"\b\p{Lu}\p{Ll}+(?:[ .'-]+\p{Lu}\p{Ll}+)+\b")?,
            Regex::new(r"\d{4,}")?,
        ])
    });
    let [tokens, quoted, names, digits] = RULES.as_ref().ok()?;
    Some([tokens, quoted, names, digits])
}
