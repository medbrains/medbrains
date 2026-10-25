//! A sentence the user must never see: one carrying a placeholder that
//! cannot be read back (a date request like `[TODAY]`, or a `[PATIENT_3]` no
//! record holds), or one talking about placeholders at all. Founder test,
//! 2026-10-25: "My earlier answer used placeholders rather than these
//! figures" — a confession to something that never happened.

use std::sync::LazyLock;

use regex::Regex;

/// A date request the server fills in a tool call; never part of an answer.
static DATE_REQUEST: LazyLock<Result<Regex, regex::Error>> = LazyLock::new(|| {
    Regex::new(r"\[(?:TODAY|DAYS_AGO_\d+|LAST_[A-Z0-9_]+|THIS_[A-Z_]+|FY_[A-Z_]+)\]")
});
/// A bracketed token in the redactor's shape.
static TOKEN: LazyLock<Result<Regex, regex::Error>> =
    LazyLock::new(|| Regex::new(r"\[[A-Z][A-Z0-9_+-]*\]"));
/// Talk about placeholders: the assistant's plumbing, never the user's answer.
static TALK: LazyLock<Result<Regex, regex::Error>> =
    LazyLock::new(|| Regex::new(r"(?i)\bplace-?holders?\b"));
/// The assistant narrating itself: its earlier answers, its testing, its
/// mistakes ("I have not tested a 12-month range, and my earlier answers were
/// wrong"). The user asked about the hospital, not about the assistant.
static SELF_TALK: LazyLock<Result<Regex, regex::Error>> = LazyLock::new(|| {
    Regex::new(
        r"(?i)\b(?:my (?:earlier|previous|last|first) (?:answers?|repl(?:y|ies)|response)|i (?:have not|haven't|did not|didn't) test|i (?:made|have made) (?:a |an )?(?:mistake|error)|i apologi[sz]e|(?:my|the) (?:earlier|previous) (?:answers?|figures?) (?:was|were) wrong)",
    )
});

/// Whether `sentence` is the assistant talking about itself. Fails closed.
pub(super) fn self_talk(sentence: &str) -> bool {
    SELF_TALK.as_ref().map_or(true, |re| re.is_match(sentence))
}

/// Whether `sentence` carries a date request (`[TODAY]`) or talks about
/// placeholders. An identifier placeholder is judged after read-back
/// ([`resolve_or_hide`]): only the conversation's map knows which are real.
/// Fails closed: if the patterns cannot compile, every sentence is held.
pub(super) fn unresolved(sentence: &str) -> bool {
    let (Ok(date), Ok(talk)) = (DATE_REQUEST.as_ref(), TALK.as_ref()) else {
        return true;
    };
    talk.is_match(sentence) || date.is_match(sentence)
}

/// What the user sees once the answer is read back through the
/// conversation's map: every placeholder the map knew is a real value by now,
/// so any token still bracketed was never resolved and is not shown raw.
#[must_use]
pub fn resolve_or_hide(read_back: &str) -> String {
    TOKEN.as_ref().map_or_else(
        |_| read_back.to_owned(),
        |re| re.replace_all(read_back, "(not available)").into_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::{resolve_or_hide, self_talk, unresolved};

    #[test]
    fn a_date_request_or_talk_of_placeholders_never_reaches_the_user() {
        assert!(unresolved("Revenue for [TODAY] was low."));
        assert!(unresolved("Billed in [LAST_30_DAYS]: ₹10."));
        assert!(unresolved("My earlier answer used placeholders."));
        assert!(!unresolved("[PATIENT_1] is allergic to penicillin."));
        assert!(!unresolved("Billed ₹9,98,718.20 today."));
    }

    #[test]
    fn a_placeholder_left_after_read_back_is_hidden() {
        assert_eq!(
            resolve_or_hide("Ravi has no allergies; [PATIENT_3] is not known."),
            "Ravi has no allergies; (not available) is not known."
        );
        assert_eq!(resolve_or_hide("See [WITHHELD: restricted]."), "See [WITHHELD: restricted].");
    }

    #[test]
    fn the_assistant_never_narrates_its_own_answers_or_testing() {
        assert!(self_talk(
            "I have not tested a 12-month range, and my earlier placeholder answers were wrong."
        ));
        assert!(self_talk("My earlier answer used placeholders rather than these figures."));
        assert!(self_talk("I apologise for the confusion."));
        assert!(!self_talk("Billed ₹4,64,76,791.72 in the 12 months to 25 Oct 2026."));
        assert!(!self_talk("The earlier admission was on Monday."));
    }
}
