//! The one door every LLM call goes through.
//!
//! DPDP Act 2023 s.8, s.16; ABDM HDM Policy. Nothing reaches a model as a plain string: a model call takes a
//! [`Redacted`], and the only ways to make one are [`Redactor::redact`] (text
//! that came from records or a person) and [`Redacted::fixed`] (a literal in
//! the source code).
//!
//! Redaction **pseudonymises** rather than deletes. Each identifier becomes a
//! stable placeholder — `[PATIENT_1]`, `[RELATIVE_1]`, `[PHONE_1]`,
//! `[AADHAAR_1]`, `[POLICY_1]`, `[DATE_-3d]` — so the model can still reason
//! (`[PATIENT_1]'s wife [RELATIVE_1] reports…`). The mapping stays on the
//! server ([`PseudonymMap`]) and the answer is re-hydrated there before the
//! authorised user sees it.
//!
//! What is caught: identifiers known from the patient's own record (every name
//! part, relatives, phones, UHID, ABHA, address, …) wherever they appear;
//! identity fields of any JSON record; people named by a cue (Mr/Smt/Dr, "his
//! wife Lakshmi", S/o); and the shapes of Indian identifiers and payment data
//! (Aadhaar with Verhoeff, cards with Luhn, PAN, GSTIN, IFSC, UPI, voter id,
//! passport, licence, vehicle, IP/MAC, keyword-anchored account, policy,
//! claim, invoice and hospital numbers). Dates become offsets from today; a
//! date of birth becomes an age. Attachments are dropped.
//!
//! It fails closed: a pattern that does not compile, or a known identifier
//! still present after redaction, is an error, and the caller must refuse the
//! AI call rather than send anything.

mod checks;
mod names;
mod patterns;
pub mod sensitive;
mod stream;
#[cfg(test)]
mod tests;

use std::collections::{HashMap, HashSet};

use chrono::{Datelike as _, NaiveDate};
use regex::Regex;
use serde::{Deserialize, Serialize};

pub use stream::StreamRehydrator;

/// What an identifier is — decides its placeholder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Kind {
    Patient,
    Relative,
    Doctor,
    Staff,
    Person,
    Phone,
    Email,
    Address,
    Pincode,
    Uhid,
    Abha,
    AbhaAddress,
    Aadhaar,
    Pan,
    VoterId,
    Passport,
    DrivingLicence,
    Vehicle,
    Ip,
    Device,
    BankAccount,
    Ifsc,
    Card,
    Upi,
    Policy,
    Gstin,
    Invoice,
    Amount,
    Id,
    Date,
    Attachment,
}

impl Kind {
    const fn label(self) -> &'static str {
        match self {
            Self::Patient => "PATIENT",
            Self::Relative => "RELATIVE",
            Self::Doctor => "DOCTOR",
            Self::Staff => "STAFF",
            Self::Person => "PERSON",
            Self::Phone => "PHONE",
            Self::Email => "EMAIL",
            Self::Address => "ADDRESS",
            Self::Pincode => "PINCODE",
            Self::Uhid => "UHID",
            Self::Abha => "ABHA",
            Self::AbhaAddress => "ABHA_ADDRESS",
            Self::Aadhaar => "AADHAAR",
            Self::Pan => "PAN",
            Self::VoterId => "VOTER_ID",
            Self::Passport => "PASSPORT",
            Self::DrivingLicence => "DL",
            Self::Vehicle => "VEHICLE",
            Self::Ip => "IP",
            Self::Device => "DEVICE",
            Self::BankAccount => "BANK_ACCOUNT",
            Self::Ifsc => "IFSC",
            Self::Card => "CARD",
            Self::Upi => "UPI",
            Self::Policy => "POLICY",
            Self::Gstin => "GSTIN",
            Self::Invoice => "INVOICE",
            Self::Amount => "AMOUNT",
            Self::Id => "ID",
            Self::Date => "DATE",
            Self::Attachment => "ATTACHMENT",
        }
    }

    const fn is_person(self) -> bool {
        matches!(
            self,
            Self::Patient | Self::Relative | Self::Doctor | Self::Staff | Self::Person
        )
    }
}

/// Why text could not be made safe for a model. Carries no identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RedactError {
    /// A built-in pattern failed to compile.
    Patterns(String),
    /// An identifier known to be in scope survived redaction.
    Residual(Kind),
}

impl std::fmt::Display for RedactError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Patterns(e) => write!(f, "redaction patterns unavailable: {e}"),
            Self::Residual(k) => write!(f, "a {} identifier survived redaction", k.label()),
        }
    }
}

impl std::error::Error for RedactError {}

/// Text that may be sent to a model. Constructed only by redaction or from a
/// source literal, so a call site cannot hand a model a raw record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct Redacted(String);

impl Redacted {
    /// A prompt written in the source code (a system prompt, an instruction).
    /// `'static` is the point: it cannot be built from a record at runtime.
    #[must_use]
    pub fn fixed(text: &'static str) -> Self {
        Self(text.to_owned())
    }

    /// The text for the model call. The only accessor, named so a reviewer —
    /// and `scripts/check_llm_redaction.py` — can see where it leaves.
    #[must_use]
    pub fn for_model(&self) -> &str {
        &self.0
    }

    /// Whether redaction withheld a restricted clinical class from this text
    /// ([`sensitive`]) — a question that names one is refused, not sent.
    #[must_use]
    pub fn is_withheld(&self) -> bool {
        self.0.contains(sensitive::WITHHELD)
    }

    /// Two redacted texts joined (e.g. a fixed system prompt and a redacted
    /// context block).
    #[must_use]
    pub fn join(&self, sep: &'static str, other: &Self) -> Self {
        Self(format!("{}{sep}{}", self.0, other.0))
    }
}

/// Told to the model with every redacted context, so it uses placeholders as
/// written. Shared by the assistant and its eval harness.
/// It carries no example placeholder on purpose: given `[PATIENT_1]` (or
/// even `[KIND_n]`) as an example, a model wrote it into answers about
/// records that had no such identifier.
pub const PLACEHOLDER_NOTE: &str = "Identifiers in this conversation (names, numbers, contacts, \
    addresses) are replaced by bracketed placeholders, and dates by a bracketed offset in days \
    from today. Use only placeholders that appear in the data, exactly as written; if the data \
    has none for something, leave it out. Never invent one, and never guess or ask for the real \
    values.";

/// One placeholder and what it stands for. Server-side only.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct Entry {
    placeholder: String,
    original: String,
    kind: Kind,
}

/// Placeholder ↔ original, kept on the server (persisted per conversation so
/// placeholders stay stable across turns). Never sent to a model, never logged.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct PseudonymMap {
    entries: Vec<Entry>,
    /// Normalised spelling → placeholder (name parts share their person's).
    #[serde(default)]
    aliases: HashMap<String, String>,
}

impl PseudonymMap {
    /// Replace every placeholder with what it stands for.
    #[must_use]
    pub fn rehydrate(&self, text: &str) -> String {
        if !text.contains('[') {
            return text.to_owned();
        }
        let mut out = text.to_owned();
        for e in &self.entries {
            if out.contains(&e.placeholder) {
                out = out.replace(&e.placeholder, &e.original);
            }
        }
        out
    }

    fn count(&self, kind: Kind) -> usize {
        self.entries.iter().filter(|e| e.kind == kind).count()
    }
}

fn normalise(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Identifiers already known to be in scope — from the patient's own record,
/// their relatives, and the clinician asking.
#[derive(Debug, Clone, Default)]
pub struct KnownIdentifiers {
    values: Vec<(Kind, String)>,
}

impl KnownIdentifiers {
    /// Add one value (blank values are ignored).
    pub fn add(&mut self, kind: Kind, value: Option<&str>) {
        if let Some(v) = value.map(str::trim).filter(|v| !v.is_empty()) {
            self.values.push((kind, v.to_owned()));
        }
    }
}

/// One alternation over every known value, and normalised value → placeholder.
type KnownMatcher = (Regex, HashMap<String, String>);

/// Words a name cue can be followed by that are not names.
const NOT_NAMES: &[&str] = &[
    "Patient",
    "Has",
    "Had",
    "Is",
    "Was",
    "Says",
    "Said",
    "Reports",
    "Reported",
    "Noted",
    "Diabetic",
    "Hypertensive",
    "Asthmatic",
    "Alive",
    "Deceased",
    "Unknown",
    "Present",
    "Absent",
    "Not",
    "No",
    "Also",
    "And",
    "The",
    "With",
    "Without",
    "Who",
    "At",
    "In",
    "On",
];

/// One redaction session: the known identifiers, and the map that keeps
/// placeholders stable across every text sent in a conversation.
#[derive(Debug, Clone)]
pub struct Redactor {
    map: PseudonymMap,
    /// (needle, placeholder) for values that must not survive.
    known: Vec<(String, String)>,
    today: NaiveDate,
    keep_amounts: bool,
    /// Withhold restricted clinical classes ([`sensitive`]). On by default.
    withhold_sensitive: bool,
    /// Placeholders for the identifiers given at construction (the patient's
    /// own record), not ones found later in other text.
    own: HashSet<String>,
}

impl Redactor {
    /// A session continuing `map` (empty for a new conversation).
    #[must_use]
    pub fn new(map: PseudonymMap, known: &KnownIdentifiers, today: NaiveDate) -> Self {
        let mut r = Self {
            map,
            known: Vec::new(),
            today,
            keep_amounts: false,
            withhold_sensitive: true,
            own: HashSet::new(),
        };
        for (kind, value) in &known.values {
            let p = r.learn(*kind, value);
            r.own.insert(p);
        }
        r
    }

    /// The placeholders of `kinds` that stand for the identifiers this
    /// session was built with — the patient's own record — never one found
    /// later in a tool result, which may be about someone else.
    #[must_use]
    pub fn own_placeholders(&self, kinds: &[Kind]) -> HashSet<String> {
        self.map
            .entries
            .iter()
            .filter(|e| kinds.contains(&e.kind) && self.own.contains(&e.placeholder))
            .map(|e| e.placeholder.clone())
            .collect()
    }

    /// The assistant's own earlier answer, replayed as history: its amounts
    /// are figures it was already given (aggregates, totals), so they stay as
    /// written — turned into `[AMOUNT_n]` they read to the model as
    /// placeholders it never wrote, and it "confessed" to them. Identifiers
    /// are redacted as always.
    ///
    /// # Errors
    /// As [`Self::redact`].
    pub fn redact_own_answer(&mut self, text: &str) -> Result<Redacted, RedactError> {
        let kept = self.keep_amounts;
        self.keep_amounts = true;
        let out = self.redact(text);
        self.keep_amounts = kept;
        out
    }

    /// Keep money amounts (a billing task that needs them). Off by default.
    #[must_use]
    pub const fn keeping_amounts(mut self) -> Self {
        self.keep_amounts = true;
        self
    }

    /// For text that is about a subject, not a person — a training-course
    /// topic — where naming a clinical class (an HIV counselling course) is
    /// the point. Identifiers are still redacted. Never use it for text that
    /// came from a patient's record.
    #[must_use]
    pub const fn allowing_clinical_topics(mut self) -> Self {
        self.withhold_sensitive = false;
        self
    }

    /// The map to persist with the conversation.
    #[must_use]
    pub const fn map(&self) -> &PseudonymMap {
        &self.map
    }

    /// Text safe to send to a model, or an error — never a partial result.
    ///
    /// # Errors
    /// A pattern is unavailable, or an identifier known to be in scope is
    /// still present afterwards.
    pub fn redact(&mut self, text: &str) -> Result<Redacted, RedactError> {
        let free = patterns::free_text().map_err(RedactError::Patterns)?;
        let cues = patterns::name_cues().map_err(RedactError::Patterns)?;
        let dates = patterns::dates().map_err(RedactError::Patterns)?;
        // Shapes before names, so an email or UPI id goes whole rather than
        // having the name inside it replaced and its domain left behind.
        let withheld;
        let text = if self.withhold_sensitive {
            withheld = sensitive::withhold_in_text(text)
                .map_err(RedactError::Patterns)?
                .0;
            withheld.as_str()
        } else {
            text
        };
        let mut out = self.redact_fields(text)?;
        out = self.replace_patterns(&out, free);
        out = self.replace_known(&out)?;
        out = self.replace_cued_names(&out, cues);
        out = self.replace_bare_names(&out)?;
        out = self.replace_known(&out)?;
        out = self.replace_dates(&out, dates);
        self.verify(&out)?;
        Ok(Redacted(out))
    }

    /// Re-hydrate a model's answer for the authorised user.
    #[must_use]
    pub fn rehydrate(&self, text: &str) -> String {
        self.map.rehydrate(text)
    }

    fn placeholder(&mut self, kind: Kind, original: &str) -> String {
        let key = normalise(original);
        if let Some(p) = self.map.aliases.get(&key) {
            return p.clone();
        }
        let placeholder = format!("[{}_{}]", kind.label(), self.map.count(kind) + 1);
        self.map.entries.push(Entry {
            placeholder: placeholder.clone(),
            original: original.to_owned(),
            kind,
        });
        self.map.aliases.insert(key, placeholder.clone());
        placeholder
    }

    /// Remember a value so every later mention of it is replaced; a person's
    /// name parts share the person's placeholder.
    fn learn(&mut self, kind: Kind, value: &str) -> String {
        let p = self.placeholder(kind, value);
        self.known.push((value.to_owned(), p.clone()));
        if kind.is_person() {
            for part in value.split_whitespace().filter(|w| w.chars().count() >= 3) {
                self.map
                    .aliases
                    .entry(normalise(part))
                    .or_insert_with(|| p.clone());
                self.known.push((part.to_owned(), p.clone()));
            }
        }
        self.known.sort_by_key(|(n, _)| std::cmp::Reverse(n.len()));
        self.known.dedup();
        p
    }

    fn redact_fields(&mut self, text: &str) -> Result<String, RedactError> {
        let keys: Vec<&str> = patterns::IDENTITY_KEYS
            .iter()
            .map(|(k, _)| *k)
            .chain([
                "date_of_birth",
                "dob",
                "city",
                "village",
                "district",
                "street",
            ])
            .chain(patterns::ATTACHMENT_KEYS.iter().copied())
            .collect();
        let re = Regex::new(&format!(
            r#""({})"\s*:\s*("(?:[^"\\]|\\.)*"?|-?\d[\d.]*)"#,
            keys.join("|")
        ))
        .map_err(|e| RedactError::Patterns(e.to_string()))?;
        let mut out = String::with_capacity(text.len());
        let mut last = 0;
        for c in re.captures_iter(text) {
            let (Some(whole), Some(key), Some(raw)) = (c.get(0), c.get(1), c.get(2)) else {
                continue;
            };
            out.push_str(&text[last..whole.start()]);
            let value = raw.as_str().trim_matches('"');
            let replaced = self.field_value(key.as_str(), value);
            out.push('"');
            out.push_str(key.as_str());
            out.push_str("\":\"");
            out.push_str(&replaced);
            out.push('"');
            last = whole.end();
        }
        out.push_str(&text[last..]);
        Ok(out)
    }

    fn field_value(&mut self, key: &str, value: &str) -> String {
        if value.is_empty() {
            return String::new();
        }
        if patterns::ATTACHMENT_KEYS.contains(&key) {
            return "[ATTACHMENT_WITHHELD]".to_owned();
        }
        if key == "date_of_birth" || key == "dob" {
            return self.age_of(value);
        }
        let kind = patterns::IDENTITY_KEYS
            .iter()
            .find(|(k, _)| *k == key)
            .map_or(Kind::Address, |(_, kind)| *kind);
        self.learn(kind, value)
    }

    fn age_of(&self, dob: &str) -> String {
        NaiveDate::parse_from_str(dob.get(..10).unwrap_or(dob), "%Y-%m-%d").map_or_else(
            |_| "[DOB_WITHHELD]".to_owned(),
            |d| {
                let years = self.today.year()
                    - d.year()
                    - i32::from((self.today.month(), self.today.day()) < (d.month(), d.day()));
                format!("[AGE {years}y]")
            },
        )
    }

    /// Every known value, in one pass: a single alternation (longest first,
    /// so a full name wins over its parts), matched text looked up by its
    /// normalised spelling.
    fn known_regex(&self) -> Result<Option<KnownMatcher>, RedactError> {
        if self.known.is_empty() {
            return Ok(None);
        }
        let lookup: HashMap<String, String> = self
            .known
            .iter()
            .map(|(n, p)| (normalise(n), p.clone()))
            .collect();
        let alternation: Vec<String> = self.known.iter().map(|(n, _)| bounded(n)).collect();
        let re = Regex::new(&format!("(?i){}", alternation.join("|")))
            .map_err(|e| RedactError::Patterns(e.to_string()))?;
        Ok(Some((re, lookup)))
    }

    fn replace_known(&self, text: &str) -> Result<String, RedactError> {
        let Some((re, lookup)) = self.known_regex()? else {
            return Ok(text.to_owned());
        };
        Ok(re
            .replace_all(text, |c: &regex::Captures<'_>| {
                let hit = c.get(0).map_or("", |m| m.as_str());
                lookup
                    .get(&normalise(hit))
                    .cloned()
                    .unwrap_or_else(|| "[WITHHELD]".to_owned())
            })
            .into_owned())
    }

    fn replace_cued_names(&mut self, text: &str, cues: &[(Regex, Kind)]) -> String {
        let mut out = text.to_owned();
        for (re, kind) in cues {
            let mut next = String::with_capacity(out.len());
            let mut last = 0;
            for c in re.captures_iter(&out) {
                let (Some(_), Some(name)) = (c.get(1), c.get(2)) else {
                    continue;
                };
                let first = name.as_str().split_whitespace().next().unwrap_or_default();
                if NOT_NAMES.contains(&first) {
                    continue;
                }
                next.push_str(&out[last..name.start()]);
                let p = self.learn(*kind, name.as_str());
                next.push_str(&p);
                last = name.end();
            }
            next.push_str(&out[last..]);
            out = next;
        }
        out
    }

    /// Names no cue or record marked ([`names`]); fails closed with the text.
    fn replace_bare_names(&mut self, text: &str) -> Result<String, RedactError> {
        let hits = names::find(text).map_err(RedactError::Patterns)?;
        let mut out = String::with_capacity(text.len());
        let mut last = 0;
        for r in hits {
            out.push_str(&text[last..r.start]);
            let p = self.learn(Kind::Person, &text[r.clone()]);
            out.push_str(&p);
            last = r.end;
        }
        out.push_str(&text[last..]);
        Ok(out)
    }

    fn replace_patterns(&mut self, text: &str, pats: &[patterns::Pattern]) -> String {
        let mut out = text.to_owned();
        for pat in pats {
            let mut next = String::with_capacity(out.len());
            let mut last = 0;
            for c in pat.re.captures_iter(&out) {
                let Some(m) = c.get(pat.group) else { continue };
                let kind = match pat.classify {
                    patterns::Classify::Is(k) => k,
                    patterns::Classify::TwelveDigits if checks::is_aadhaar(m.as_str()) => {
                        Kind::Aadhaar
                    }
                    patterns::Classify::LongDigits if checks::is_card(m.as_str()) => Kind::Card,
                    patterns::Classify::TwelveDigits | patterns::Classify::LongDigits => Kind::Id,
                };
                if kind == Kind::Amount && self.keep_amounts {
                    continue;
                }
                next.push_str(&out[last..m.start()]);
                if kind == Kind::Attachment {
                    next.push_str("[ATTACHMENT_WITHHELD]");
                } else {
                    let p = self.placeholder(kind, m.as_str());
                    next.push_str(&p);
                }
                last = m.end();
            }
            next.push_str(&out[last..]);
            out = next;
        }
        out
    }

    fn replace_dates(&mut self, text: &str, re: &Regex) -> String {
        let today = self.today;
        let mut next = String::with_capacity(text.len());
        let mut last = 0;
        for c in re.captures_iter(text) {
            let Some(m) = c.get(0) else { continue };
            next.push_str(&text[last..m.start()]);
            // An ISO timestamp's time of day stays; only its date is shifted.
            let time = c.get(4).map_or("", |t| t.as_str());
            let date = &m.as_str()[..m.len() - time.len()];
            let placeholder = parse_date(&c).map_or_else(
                || "[DATE]".to_owned(),
                |d| format!("[DATE_{:+}d]", (d - today).num_days()),
            );
            if !self
                .map
                .entries
                .iter()
                .any(|e| e.placeholder == placeholder)
            {
                self.map.entries.push(Entry {
                    placeholder: placeholder.clone(),
                    original: date.to_owned(),
                    kind: Kind::Date,
                });
            }
            next.push_str(&placeholder);
            next.push_str(time);
            last = m.end();
        }
        next.push_str(&text[last..]);
        next
    }

    /// Fail closed: nothing known to be in scope may remain.
    fn verify(&self, out: &str) -> Result<(), RedactError> {
        let Some((re, lookup)) = self.known_regex()? else {
            return Ok(());
        };
        let Some(hit) = re.find(out) else {
            return Ok(());
        };
        let placeholder = lookup.get(&normalise(hit.as_str()));
        let kind = self
            .map
            .entries
            .iter()
            .find(|e| Some(&e.placeholder) == placeholder)
            .map_or(Kind::Id, |e| e.kind);
        Err(RedactError::Residual(kind))
    }
}

/// Text with identifiers removed, for a record or a log line that is not a
/// model call (e.g. a stored test finding). Withheld entirely if it cannot be
/// made safe.
#[must_use]
pub fn redact_for_record(text: &str, today: NaiveDate) -> String {
    Redactor::new(PseudonymMap::default(), &KnownIdentifiers::default(), today)
        .redact(text)
        .map_or_else(|_| "[withheld: could not be redacted]".to_owned(), |r| r.0)
}

/// A literal as a whole-word pattern: word boundaries only where the literal
/// starts or ends with a word character (a phone's leading `+` has none).
fn bounded(needle: &str) -> String {
    let word = |c: Option<char>| c.is_some_and(|c| c.is_alphanumeric() || c == '_');
    let start = if word(needle.chars().next()) {
        r"\b"
    } else {
        ""
    };
    let end = if word(needle.chars().last()) {
        r"\b"
    } else {
        ""
    };
    format!("{start}{}{end}", regex::escape(needle))
}

fn parse_date(c: &regex::Captures<'_>) -> Option<NaiveDate> {
    let n = |i: usize| c.get(i).and_then(|m| m.as_str().parse::<u32>().ok());
    if let (Some(y), Some(m), Some(d)) = (n(1), n(2), n(3)) {
        return NaiveDate::from_ymd_opt(i32::try_from(y).ok()?, m, d);
    }
    if let (Some(d), Some(m), Some(y)) = (n(5), n(6), n(7)) {
        return NaiveDate::from_ymd_opt(i32::try_from(y).ok()?, m, d);
    }
    let month = c.get(9)?.as_str().get(..3)?.to_lowercase();
    let months = [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    let m = u32::try_from(months.iter().position(|x| *x == month)? + 1).ok()?;
    NaiveDate::from_ymd_opt(i32::try_from(n(10)?).ok()?, m, n(8)?)
}
