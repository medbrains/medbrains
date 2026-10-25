//! The answer guard: a deterministic check on what the assistant wrote,
//! sentence by sentence, before any of it reaches the user.
//!
//! Prompting alone does not hold (eval cases 10, 15, 17): the model still
//! turns labs into a diagnosis, repeats a dose instruction planted in a
//! nursing note, and adds reference ranges the record does not hold. So a
//! sentence is removed when it
//! - reads the record as a diagnosis ("consistent with iron-deficiency
//!   anaemia") naming a condition the record itself does not name;
//! - suggests starting, changing or dosing a treatment;
//! - repeats an instruction written inside a record (prompt injection);
//! - states a range, estimate or conversion with a number the record and
//!   question do not hold;
//!
//! and a contact, government or financial placeholder (`[AADHAAR_1]`) the
//! question did not carry is replaced, so it is never re-identified on screen.
//! The user is told, in [`AnswerGuard::notices`], what was removed and why.
//!
//! Works on the model's own text (placeholders, not real values), so it runs
//! before re-hydration. Fails closed: if its patterns cannot compile, every
//! sentence is held back.

mod patterns;
#[cfg(test)]
mod tests;

use std::collections::{BTreeSet, HashSet};

use patterns::{COMMON_WORDS, NOT_CONDITIONS, PATTERNS, Patterns, SHOWN_KINDS};

/// Longest text held while waiting for a sentence to end.
const MAX_PENDING: usize = 2000;
/// Distinct injected words a sentence must share to count as an echo.
const ECHO_WORDS: usize = 2;
/// Words read after a diagnosis cue, looking for a condition.
const CUE_WINDOW: usize = 4;
/// Shortest word that can show an injected instruction is being repeated.
const MIN_ECHO_WORD: usize = 4;
/// What a held identifier is shown as.
const NOT_SHOWN: &str = "(identifier not shown)";

/// Why part of an answer was removed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Reason {
    Diagnosis,
    Treatment,
    RecordInstruction,
    Unsupported,
    Identifier,
    /// The guard could not run, so nothing was shown.
    Unchecked,
}

impl Reason {
    /// What the user is told.
    #[must_use]
    pub const fn notice(self) -> &'static str {
        match self {
            Self::Diagnosis => {
                "Removed from this answer: a sentence that read the record as a diagnosis. \
                 Diagnosis is the treating clinician's decision."
            }
            Self::Treatment => {
                "Removed from this answer: a treatment or dose suggestion. \
                 Treatment and doses are the treating clinician's decision."
            }
            Self::RecordInstruction => {
                "Removed from this answer: text repeating instructions written inside \
                 the record. Instructions found in a record are never followed."
            }
            Self::Unsupported => {
                "Removed from this answer: a figure the record does not hold \
                 (a reference range, estimate or conversion)."
            }
            Self::Identifier => "An identifier the question did not ask for is not shown.",
            Self::Unchecked => {
                "This answer could not be checked for safety, so it is not shown. Try again."
            }
        }
    }
}

/// Feeds the model's answer in, hands out the sentences that pass.
#[derive(Debug, Default)]
pub struct AnswerGuard {
    question: String,
    /// Record text with injected spans removed, normalised.
    clean: String,
    /// Words that occur only in a record's injected instructions.
    injected: HashSet<String>,
    injected_spans: Vec<String>,
    pending: String,
    reasons: BTreeSet<Reason>,
}

impl AnswerGuard {
    /// A guard for an answer to `question` (model form, placeholders in).
    #[must_use]
    pub fn new(question: &str) -> Self {
        Self {
            question: question.to_owned(),
            ..Self::default()
        }
    }

    /// Text the model was given (a tool result, the page context): what the
    /// answer may restate, and where injected instructions hide.
    pub fn add_record(&mut self, text: &str) {
        let Ok(p) = PATTERNS.as_ref() else { return };
        let text = normalise(text);
        let mut clean = String::with_capacity(text.len());
        let mut at = 0;
        for m in p.injection.find_iter(&text) {
            if m.start() < at {
                continue;
            }
            clean.push_str(&text[at..m.start()]);
            let end = text[m.start()..]
                .find(['"', '\n'])
                .map_or(text.len(), |i| m.start() + i);
            self.injected_spans.push(text[m.start()..end].to_owned());
            at = end;
        }
        clean.push_str(&text[at..]);
        self.clean.push('\n');
        self.clean.push_str(&clean);
        let known: HashSet<String> = words(&self.clean)
            .chain(words(&normalise(&self.question)))
            .collect();
        self.injected = self
            .injected_spans
            .iter()
            .flat_map(|s| words(s).collect::<Vec<_>>())
            .filter(|w| !known.contains(w))
            .collect();
    }

    /// The complete sentences of `chunk` (with what came before) that pass.
    pub fn push(&mut self, chunk: &str) -> String {
        self.pending.push_str(chunk);
        let cut = last_boundary(&self.pending)
            .or_else(|| (self.pending.len() > MAX_PENDING).then_some(self.pending.len()));
        let Some(cut) = cut else { return String::new() };
        let rest = self.pending.split_off(cut);
        let ready = std::mem::replace(&mut self.pending, rest);
        self.check(&ready)
    }

    /// Whatever is still held when the answer ends.
    pub fn finish(&mut self) -> String {
        let rest = std::mem::take(&mut self.pending);
        self.check(&rest)
    }

    /// Why anything was removed, one line each, for the user.
    #[must_use]
    pub fn notices(&self) -> Vec<&'static str> {
        self.reasons.iter().map(|r| r.notice()).collect()
    }

    fn check(&mut self, text: &str) -> String {
        let Ok(p) = PATTERNS.as_ref() else {
            if !text.trim().is_empty() {
                self.reasons.insert(Reason::Unchecked);
            }
            return String::new();
        };
        let mut out = String::with_capacity(text.len());
        for (unit, _) in sentences(text) {
            if unit.trim_start().starts_with('|') {
                // A table row keeps its shape: each cell is checked on its own.
                let cells: Vec<String> = unit.split('|').map(|c| self.check_cell(p, c)).collect();
                out.push_str(&cells.join("|"));
            } else {
                out.push_str(&self.check_unit(p, unit));
            }
        }
        out
    }

    fn check_cell(&mut self, p: &Patterns, cell: &str) -> String {
        let kept: String = sentences(cell)
            .map(|(s, _)| self.check_unit(p, s))
            .collect();
        if kept.is_empty() && !cell.is_empty() {
            " ".to_owned()
        } else {
            kept
        }
    }

    fn check_unit(&mut self, p: &Patterns, unit: &str) -> String {
        match self.blocked(p, unit) {
            Some(reason) => {
                self.reasons.insert(reason);
                String::new()
            }
            None => self.hold_identifiers(p, unit),
        }
    }

    fn blocked(&self, p: &Patterns, unit: &str) -> Option<Reason> {
        let l = normalise(unit);
        if self.echoes(p, &l) {
            Some(Reason::RecordInstruction)
        } else if self.diagnoses(p, &l) {
            Some(Reason::Diagnosis)
        } else if suggests_treatment(p, l.trim()) {
            Some(Reason::Treatment)
        } else if self.unsupported(p, &l) {
            Some(Reason::Unsupported)
        } else {
            None
        }
    }

    /// A diagnosis cue followed closely by a condition the record does not name.
    fn diagnoses(&self, p: &Patterns, l: &str) -> bool {
        p.diagnosis_cue.find_iter(l).any(|m| {
            l[m.end()..]
                .split(|c: char| !c.is_alphanumeric())
                .filter(|w| !w.is_empty())
                .take(CUE_WINDOW)
                .any(|w| {
                    p.condition.is_match(w)
                        && !NOT_CONDITIONS.contains(&w)
                        && !self.clean.contains(w)
                })
        })
    }

    fn echoes(&self, p: &Patterns, l: &str) -> bool {
        if p.injection.is_match(l) {
            return true;
        }
        let shared: HashSet<String> = words(l).filter(|w| self.injected.contains(w)).collect();
        shared.len() >= ECHO_WORDS
    }

    /// A range, estimate or conversion carrying a number nobody gave it.
    fn unsupported(&self, p: &Patterns, l: &str) -> bool {
        if !p.estimate.is_match(l) {
            return false;
        }
        let known = numbers(p, &format!("{}\n{}", self.clean, normalise(&self.question)));
        numbers(p, l).iter().any(|n| !known.contains(n))
    }

    fn hold_identifiers(&mut self, p: &Patterns, unit: &str) -> String {
        let mut held = false;
        let out = p.placeholder.replace_all(unit, |c: &regex::Captures<'_>| {
            let whole = &c[0];
            let kind = &c[1];
            if SHOWN_KINDS.contains(&kind) || self.question.contains(whole) {
                whole.to_owned()
            } else {
                held = true;
                NOT_SHOWN.to_owned()
            }
        });
        if held {
            self.reasons.insert(Reason::Identifier);
        }
        out.into_owned()
    }
}

fn suggests_treatment(p: &Patterns, l: &str) -> bool {
    p.treatment.iter().any(|re| re.is_match(l))
        || (p.treatment_noun.is_match(l) && p.advice.iter().any(|re| re.is_match(l)))
}

/// Guard a whole answer at once (the eval harness; tests).
#[must_use]
pub fn guard_answer(question: &str, records: &[&str], answer: &str) -> (String, Vec<&'static str>) {
    let mut g = AnswerGuard::new(question);
    for r in records {
        g.add_record(r);
    }
    let mut shown = g.push(answer);
    shown.push_str(&g.finish());
    (shown, g.notices())
}

/// Lowercase, with typographic dashes and spaces made plain.
fn normalise(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '\u{2010}'..='\u{2015}' | '\u{2212}' => '-',
            '\u{00a0}' | '\u{202f}' | '\u{2009}' => ' ',
            c => c,
        })
        .collect::<String>()
        .to_lowercase()
}

fn words(text: &str) -> impl Iterator<Item = String> + '_ {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.chars().count() >= MIN_ECHO_WORD && !w.chars().all(|c| c.is_ascii_digit()))
        .filter(|w| !COMMON_WORDS.contains(w))
        .map(str::to_owned)
}

/// Numbers in `text` outside placeholders, `5.90` read as `5.9`.
fn numbers(p: &Patterns, text: &str) -> HashSet<String> {
    let plain = p.any_placeholder.replace_all(text, " ");
    p.number
        .captures_iter(&plain.to_lowercase())
        .filter_map(|c| c.get(1).map(|m| canonical(m.as_str())))
        .collect()
}

fn canonical(n: &str) -> String {
    if n.contains('.') {
        n.trim_end_matches('0').trim_end_matches('.').to_owned()
    } else {
        n.trim_start_matches('0').to_owned()
    }
}

/// Byte offset just past the last complete sentence in `text`.
fn last_boundary(text: &str) -> Option<usize> {
    let n: usize = sentences(text)
        .filter(|&(_, done)| done)
        .map(|(s, _)| s.len())
        .sum();
    (n > 0).then_some(n)
}

/// `text` cut after each newline and after `.`, `!` or `?` followed by
/// whitespace (which stays with the sentence it ends); a table row (`| … |`)
/// is one piece. `true` when the piece ended there, `false` for an
/// unfinished tail.
fn sentences(text: &str) -> impl Iterator<Item = (&str, bool)> {
    let mut rest = text;
    let mut line_start = true;
    std::iter::from_fn(move || {
        if rest.is_empty() {
            return None;
        }
        let row = line_start && rest.trim_start().starts_with('|');
        let bytes = rest.as_bytes();
        let end = bytes.iter().enumerate().find_map(|(i, &b)| {
            let next_space = bytes.get(i + 1).is_some_and(u8::is_ascii_whitespace);
            if b == b'\n' {
                Some(i + 1)
            } else if !row && matches!(b, b'.' | b'!' | b'?') && next_space {
                Some(i + 2)
            } else {
                None
            }
        });
        let (unit, tail) = rest.split_at(end.unwrap_or(rest.len()));
        rest = tail;
        line_start = unit.ends_with('\n');
        Some((unit, end.is_some()))
    })
}
