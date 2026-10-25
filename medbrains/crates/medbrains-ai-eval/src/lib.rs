//! Golden-case evaluation for `MedBrains` AI features.
//!
//! Founder rule: an answer is *exact* — every claim grounded in the source
//! record, nothing added, nothing important left out — and *operational*:
//! data quality and clear-cut admin decisions, never a clinical suggestion.
//!
//! A case (`cases/*.json`, format 1) is a synthetic source record, the
//! question asked about it, and what a correct answer must and must not say.
//! The harness builds the model request exactly as the assistant does — the
//! assistant's own system prompt, every text through
//! [`medbrains_core::ai_redact::Redactor`] — then grades the answer with
//! deterministic rules ([`graders`]). Offline runs replay a recorded answer
//! (`cases/recorded/<id>.json`); live runs ask the model ([`live`]).
//!
//! What is not exercised: the tool-calling loop. The record a tool would
//! have returned is handed to the model in the request (`SDBench`'s
//! "gatekeeper", reduced to one reveal).

pub mod graders;
pub mod live;
pub mod report;

use std::path::{Path, PathBuf};

use chrono::NaiveDate;
use medbrains_core::ai_guard::HISTORY_MESSAGES;
use medbrains_core::ai_redact::{
    Kind, KnownIdentifiers, PLACEHOLDER_NOTE, PseudonymMap, RedactError, Redacted, Redactor,
};
use serde::{Deserialize, Serialize};

/// The assistant's system prompt — the one in production, not a copy.
pub const SYSTEM_PROMPT: &str = include_str!("../../medbrains-ai/src/ai_system_prompt.txt");

/// The only case format this harness reads.
const FORMAT: u32 = 1;

/// What the answer should be.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Expect {
    /// Answer from the record.
    Answer,
    /// Decline (restricted class, clinical decision, missing data) —
    /// before the model or in its words.
    Refuse,
}

/// One identifier the record carries, as the assistant loads it.
#[derive(Debug, Clone, Deserialize)]
pub struct Identifier {
    pub kind: Kind,
    pub value: String,
}

/// Who said a prior message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    User,
    Assistant,
}

/// One earlier message of the conversation, as stored (before redaction).
#[derive(Debug, Clone, Deserialize)]
pub struct Prior {
    pub role: Role,
    pub content: String,
}

/// One golden case.
#[derive(Debug, Clone, Deserialize)]
pub struct Case {
    pub format: u32,
    pub id: String,
    /// Must be `true`: live runs may send a case to a non-India endpoint.
    pub synthetic: bool,
    /// Which assistant tool / feature the record stands in for.
    pub task: String,
    pub today: NaiveDate,
    #[serde(default)]
    pub identifiers: Vec<Identifier>,
    /// Raw identifiers in free text the redactor must catch by shape.
    #[serde(default)]
    pub planted: Vec<String>,
    pub source: serde_json::Value,
    /// Earlier messages, oldest first; only the last
    /// [`HISTORY_MESSAGES`] are sent, as the assistant does.
    #[serde(default)]
    pub history: Vec<Prior>,
    pub question: String,
    pub expect: Expect,
    /// Regexes (case-insensitive) every one of which the answer must match.
    #[serde(default)]
    pub must_include: Vec<String>,
    /// Regexes none of which the answer may match.
    #[serde(default)]
    pub must_not_include: Vec<String>,
    /// Numbers or drug names the answer may state that are derived, not
    /// copied: a count, a unit conversion, a translated drug name.
    #[serde(default)]
    pub derived_ok: Vec<String>,
    #[serde(default)]
    pub max_words: Option<usize>,
    /// A failure already recorded as a finding; the run fails if it passes,
    /// so the mark is removed when the bug is fixed.
    #[serde(default)]
    pub known_failure: Option<String>,
}

/// The request as the redactor produced it — all a model ever sees.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Request {
    pub system: Redacted,
    /// The earlier messages sent, oldest first.
    pub history: Vec<(Role, Redacted)>,
    pub user: Redacted,
    /// The parts of `user`: what the tool returned, and what was asked.
    pub record: Redacted,
    pub question: Redacted,
}

impl Request {
    /// Everything sent, as one text (for leak checks).
    #[must_use]
    pub fn sent(&self) -> String {
        let history: Vec<&str> = self.history.iter().map(|(_, m)| m.for_model()).collect();
        format!(
            "{}\n{}\n{}",
            self.system.for_model(),
            history.join("\n"),
            self.user.for_model()
        )
    }

    /// The earlier messages as `role: text` lines (what a recording keeps).
    #[must_use]
    pub fn history_lines(&self) -> Vec<String> {
        self.history
            .iter()
            .map(|(role, m)| format!("{role:?}: {}", m.for_model()))
            .collect()
    }
}

/// What happened before any model was asked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Prepared {
    /// Safe to send.
    Send(Request),
    /// The question names a restricted class: refused, nothing sent.
    RefusedRestricted(Request),
    /// Redaction failed closed: nothing sent.
    RefusedUnsafe(String),
}

impl Case {
    /// Every case under `dir`, sorted by file name.
    ///
    /// # Errors
    /// A file cannot be read or parsed, is not format 1, or is not synthetic.
    pub fn load_all(dir: &Path) -> Result<Vec<Self>, String> {
        let mut paths: Vec<PathBuf> = std::fs::read_dir(dir)
            .map_err(|e| format!("{}: {e}", dir.display()))?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        paths.sort();
        paths.iter().map(|p| Self::load(p)).collect()
    }

    fn load(path: &Path) -> Result<Self, String> {
        let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let case: Self =
            serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
        if case.format != FORMAT {
            return Err(format!(
                "{}: format {} (want {FORMAT})",
                case.id, case.format
            ));
        }
        if !case.synthetic {
            return Err(format!(
                "{}: not marked synthetic — refusing to load",
                case.id
            ));
        }
        Ok(case)
    }

    /// The source record as the tool would have returned it, keys sorted so
    /// the request is the same whether or not a workspace build turns on
    /// `serde_json`'s `preserve_order` (else every recording reads as stale).
    #[must_use]
    pub fn source_text(&self) -> String {
        self.source
            .as_str()
            .map_or_else(|| sorted(&self.source).to_string(), str::to_owned)
    }

    /// Build the model request through the redactor, as the assistant does.
    #[must_use]
    pub fn prepare(&self) -> Prepared {
        let mut known = KnownIdentifiers::default();
        for id in &self.identifiers {
            known.add(id.kind, Some(&id.value));
        }
        let mut r = Redactor::new(PseudonymMap::default(), &known, self.today);
        match self.redact_parts(&mut r) {
            Ok((system, label, record, question, history)) => {
                let restricted = question.is_withheld();
                let request = Request {
                    system,
                    history,
                    user: label.join("\n", &record).join("\n\n", &question),
                    record,
                    question,
                };
                if restricted {
                    Prepared::RefusedRestricted(request)
                } else {
                    Prepared::Send(request)
                }
            }
            Err(e) => Prepared::RefusedUnsafe(e.to_string()),
        }
    }

    fn redact_parts(&self, r: &mut Redactor) -> Result<Parts, RedactError> {
        // As production's history shows it: the tool has already run, and
        // this is what it returned. A bare "result" read to Haiku as a call
        // still to make, and it wrote one out as text (case 06).
        // The user's questions from before the recent history, as the
        // assistant's context block carries them.
        let keep = usize::from(HISTORY_MESSAGES);
        let dropped = &self.history[..self.history.len().saturating_sub(keep)];
        let asked: Vec<&str> = dropped
            .iter()
            .filter(|m| m.role == Role::User)
            .map(|m| m.content.as_str())
            .collect();
        let earlier = medbrains_core::ai_history::earlier_questions(&asked)
            .map(|line| format!("{line}\n\n"))
            .unwrap_or_default();
        let label = r.redact(&format!(
            "{earlier}Already run for this question ({}); its result:",
            self.task
        ))?;
        let record = r.redact(&self.source_text())?;
        let question = r.redact(&self.question)?;
        let recent = &self.history[self.history.len().saturating_sub(keep)..];
        let history = recent
            .iter()
            .map(|m| {
                let text = if m.role == Role::Assistant {
                    r.redact_own_answer(&m.content)?
                } else {
                    r.redact(&m.content)?
                };
                Ok((m.role, text))
            })
            .collect::<Result<_, RedactError>>()?;
        Ok((system(), label, record, question, history))
    }
}

/// A case redacted: system, the record's label, record, question, and the
/// history sent.
type Parts = (Redacted, Redacted, Redacted, Redacted, Vec<(Role, Redacted)>);

/// The fixed system prefix, byte for byte as the assistant sends it every
/// turn (per-turn context goes in the user turn), so it can be cached.
#[must_use]
pub fn system() -> Redacted {
    Redacted::fixed(SYSTEM_PROMPT).join("\n\n", &Redacted::fixed(PLACEHOLDER_NOTE))
}

/// `value` with every object's keys in sorted order.
fn sorted(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            serde_json::Value::Object(
                keys.into_iter()
                    .filter_map(|k| map.get(k).map(|v| (k.clone(), sorted(v))))
                    .collect(),
            )
        }
        serde_json::Value::Array(items) => {
            serde_json::Value::Array(items.iter().map(sorted).collect())
        }
        other => other.clone(),
    }
}

/// A model's answer to one case, with what it cost.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Answer {
    pub provider: String,
    pub model: String,
    /// The request it answered, as sent — a stale recording no longer matches.
    pub system: String,
    /// The earlier messages it was sent, as [`Request::history_lines`].
    #[serde(default)]
    pub history: Vec<String>,
    pub user: String,
    pub output: String,
    /// Input tokens billed at the full rate (cache reads and writes apart).
    pub input_tokens: u64,
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: u64,
    #[serde(default)]
    pub cache_write_tokens: u64,
    /// The provider stopped at the output cap: the answer is incomplete.
    #[serde(default)]
    pub truncated: bool,
}

impl Answer {
    /// Whether this answer was given to exactly `request`.
    #[must_use]
    pub fn answers(&self, request: &Request) -> bool {
        self.system == request.system.for_model()
            && self.history == request.history_lines()
            && self.user == request.user.for_model()
    }
}

/// Where a case's recording lives.
#[must_use]
pub fn recording_path(cases_dir: &Path, id: &str) -> PathBuf {
    cases_dir.join("recorded").join(format!("{id}.json"))
}

/// The cases shipped with this crate.
#[must_use]
pub fn default_cases_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("cases")
}
