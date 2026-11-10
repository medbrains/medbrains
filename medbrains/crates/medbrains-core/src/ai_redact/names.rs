//! Names in free text with no cue and no record to match against —
//! "Ramesh said he would come back", "Murugan sonnar", "राम ने बताया".
//!
//! Two rules, both on-box and linear in the text:
//! * **Gazetteer**: a capitalised (or all-capitals) word that is a common
//!   Indian given or family name ([`LATIN`]), or a Tamil/Devanagari word that
//!   begins with one ([`SCRIPT`]). The lists are ours, written for this
//!   module, and leave out names that are also ordinary English or clinical
//!   words ("More", "Shiny", ASHA).
//! * **Context**: any other capitalised word directly before a reporting verb
//!   ("said", "told", "ne kaha", "sonnar") — a name the list does not know —
//!   unless it is a role, a pronoun or a drug.
//!
//! A hit takes the capitalised words around it with it ("Ramesh Babu"), and
//! is kept when it names a sign, a test or a place instead of a person
//! ("Thomas splint", "Lakshmi Ward"). Every hit becomes a person placeholder;
//! when unsure, the redactor redacts.

use std::collections::HashSet;
use std::ops::Range;
use std::sync::LazyLock;

use regex::Regex;

static LATIN: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| list(include_str!("names/latin.txt")));
static SCRIPT: LazyLock<Vec<&'static str>> =
    LazyLock::new(|| list(include_str!("names/script.txt")).into_iter().collect());

fn list(text: &'static str) -> HashSet<&'static str> {
    text.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .collect()
}

/// Words, Latin or Indian script, with their positions.
static WORD: LazyLock<Result<Regex, regex::Error>> = LazyLock::new(|| {
    // Whole words only: the `J` of `J18.1` and the `signed` of `signed_by`
    // are not words.
    Regex::new(r"\b[\p{Latin}]+(?:'[a-z]+)?\b|[\p{Tamil}\p{Devanagari}\p{Mn}\p{Mc}]+")
});

/// Verbs that make the word before them someone's name.
static REPORTING: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| list(include_str!("names/reporting.txt")));

/// Capitalised words that are not names.
static NOT_NAMES: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| list(include_str!("names/not_names.txt")));

/// What follows a name when it names a thing, not a person.
static NOT_A_PERSON_AFTER: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| list(include_str!("names/not_a_person_after.txt")));

/// Endings of drug names, so "Ramipril said" never becomes a person.
const DRUG_ENDINGS: &[&str] = &[
    "pril",
    "olol",
    "statin",
    "mycin",
    "cillin",
    "azole",
    "sartan",
    "dipine",
    "formin",
    "gliptin",
    "mab",
    "nib",
    "vir",
    "floxacin",
    "cycline",
    "azepam",
    "oxetine",
    "triptyline",
    "sone",
    "lone",
    "parin",
    "profen",
    "mide",
    "thiazide",
    "tidine",
    "dronate",
    "lukast",
    "zolam",
    "pine",
    "done",
    "fen",
    "cin",
    "ide",
    "ine",
    "ol",
];

fn lower(w: &str) -> String {
    w.to_lowercase()
}

fn capitalised(w: &str) -> bool {
    let mut c = w.chars();
    c.next().is_some_and(char::is_uppercase)
        && (c.clone().all(char::is_lowercase)
            || (w.chars().count() >= 3 && c.all(char::is_uppercase)))
}

/// `Ramesh`, not `RAMESH` and not `ramesh`.
fn title_case(w: &str) -> bool {
    let mut c = w.chars();
    c.next().is_some_and(char::is_uppercase) && c.all(char::is_lowercase)
}

const fn is_script(w: &str) -> bool {
    !w.is_ascii()
}

fn known(w: &str) -> bool {
    if is_script(w) {
        return SCRIPT.iter().any(|n| w.starts_with(n));
    }
    capitalised(w) && LATIN.contains(lower(w).trim_end_matches("'s"))
}

/// Endings of ordinary English nouns ("Investigation reports", "Surgery
/// said"); Indian names do not end this way.
const NOUN_ENDINGS: &[&str] = &[
    "tion", "sion", "ment", "ness", "ity", "ology", "logy", "graphy", "scopy", "apy", "ery",
    "ance", "ence", "ing", "ics", "ure", "ship", "hood", "ism", "ist",
];

fn noun_like(w: &str) -> bool {
    let w = lower(w);
    NOUN_ENDINGS.iter().any(|e| w.ends_with(e))
}

fn drug_like(w: &str) -> bool {
    let w = lower(w);
    w.chars().count() >= 6 && DRUG_ENDINGS.iter().any(|e| w.ends_with(e))
}

fn ordinary(w: &str) -> bool {
    NOT_NAMES.contains(lower(w).as_str())
}

/// Byte ranges of names in `text` that no cue or record marked.
///
/// # Errors
/// The word pattern did not compile — the caller must refuse the text.
pub(super) fn find(text: &str) -> Result<Vec<Range<usize>>, String> {
    let re = WORD.as_ref().map_err(ToString::to_string)?;
    let words: Vec<_> = re.find_iter(text).collect();
    let mut hits: Vec<Range<usize>> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let w = words[i].as_str();
        // The verb must follow with only a space between ("Ramesh said").
        let next = words
            .get(i + 1)
            .filter(|n| text[words[i].end()..n.start()].chars().all(|c| c == ' '))
            .map(|m| lower(m.as_str()));
        let by_context = capitalised(w)
            && !ordinary(w)
            && !drug_like(w)
            && !noun_like(w)
            && next.as_deref().is_some_and(|n| REPORTING.contains(n));
        if !(known(w) || by_context) || ordinary(w) {
            i += 1;
            continue;
        }
        // Take adjacent words of the same name, at most three: before it only
        // other known names ("Suresh Kumar"), after it any capitalised word
        // that is not a role or a verb ("Ramesh Babu").
        let (mut start, mut end) = (i, i);
        while start > 0
            && end - start < 2
            && joins(text, &words[start - 1], &words[start])
            && known(words[start - 1].as_str())
        {
            start -= 1;
        }
        while end + 1 < words.len() && end - start < 2 && joins(text, &words[end], &words[end + 1])
        {
            end += 1;
        }
        let after = words.get(end + 1).map(|m| lower(m.as_str()));
        if !after
            .as_deref()
            .is_some_and(|a| NOT_A_PERSON_AFTER.contains(a))
        {
            hits.push(words[start].start()..words[end].end());
        }
        i = end + 1;
    }
    Ok(hits)
}

/// Whether `b` continues the name `a` ends: capitalised, not a role, and only
/// a space between them.
fn joins(text: &str, a: &regex::Match<'_>, b: &regex::Match<'_>) -> bool {
    let gap = &text[a.end()..b.start()];
    gap.chars().all(|c| c == ' ')
        && !gap.is_empty()
        && capitalised(a.as_str())
        && capitalised(b.as_str())
        && (known(b.as_str()) || title_case(b.as_str()))
        && !REPORTING.contains(lower(b.as_str()).as_str())
        && !ordinary(a.as_str())
        && !ordinary(b.as_str())
        && !drug_like(b.as_str())
        && !NOT_A_PERSON_AFTER.contains(lower(b.as_str()).as_str())
}

#[cfg(test)]
#[path = "names_tests.rs"]
mod tests;
