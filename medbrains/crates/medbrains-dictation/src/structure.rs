//! From transcript to draft: the transcript goes through the AI layer's
//! redaction to the hospital's local model, which fills [`ModelDraft`]; the
//! answer is re-hydrated and laid out in the consultation note's own sections
//! (subjective, objective, assessment, plan). A draft only — the doctor
//! decides every line of it.

use std::time::Duration;

use medbrains_core::ai_redact::{Redacted, Redactor};
use medbrains_server_services::llm::{self, AiConfig};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::settings::DictationConfig;

/// A local model drafting a ten-minute consultation; beyond this the doctor
/// is better served typing.
const LLM_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_TEXT_CHARS: usize = 4000;
const MAX_DIAGNOSES: usize = 10;
const MAX_MEDICINES: usize = 20;

const PREAMBLE: &str = "You turn a doctor's dictated outpatient consultation into a draft note \
for the doctor to review. Use only what the transcript says: never add a symptom, finding, \
diagnosis, medicine or dose that was not said. Leave a field empty when it was not dictated. \
Placeholders such as [PATIENT_1] stand for real names and identifiers: keep them exactly. \
List each medicine the doctor said to give, with dose, frequency, duration and route as spoken. \
An ICD-10 code is a suggestion for the doctor to verify; leave it empty when unsure.";

/// What the model fills. Field docs are the model's instructions.
#[derive(Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct ModelDraft {
    /// The presenting complaint, as dictated. Empty if not said.
    #[serde(default)]
    pub complaint: String,
    /// History of the present illness and relevant past history, as dictated.
    #[serde(default)]
    pub history: String,
    /// Examination findings, as dictated.
    #[serde(default)]
    pub examination: String,
    /// The doctor's diagnoses or impressions, as dictated.
    #[serde(default)]
    pub diagnoses: Vec<ModelDiagnosis>,
    /// Advice, investigations and follow-up, as dictated (not the medicines).
    #[serde(default)]
    pub plan: String,
    /// Each medicine the doctor said to give.
    #[serde(default)]
    pub medicines: Vec<ModelMedicine>,
}

/// One diagnosis the doctor said.
#[derive(Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct ModelDiagnosis {
    pub description: String,
    /// A suggested ICD-10 code such as J06.9, or empty.
    #[serde(default)]
    pub icd10_code: String,
}

/// One medicine the doctor said to give.
#[derive(Debug, Default, Clone, PartialEq, Eq, Deserialize, Serialize, JsonSchema)]
pub struct ModelMedicine {
    pub name: String,
    #[serde(default)]
    pub dose: String,
    #[serde(default)]
    pub frequency: String,
    #[serde(default)]
    pub duration: String,
    #[serde(default)]
    pub route: String,
}

/// The draft the doctor reviews, stored on the session.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
pub struct Draft {
    pub sections: Vec<DraftSection>,
    pub medicines: Vec<ModelMedicine>,
}

/// One section of the consultation note, as the model suggests it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct DraftSection {
    pub code: String,
    pub title: String,
    pub text: String,
}

impl Draft {
    /// Nothing was drafted: shown as a failure, never as an empty note.
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        self.sections.is_empty() && self.medicines.is_empty()
    }
}

/// Why no draft came back.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmFailure {
    Unreachable,
    Timeout,
    /// The transcript could not be made safe to send; nothing was sent.
    Unsafe,
    /// The model answered with nothing in it.
    Empty,
}

impl LlmFailure {
    /// The class stored on the session.
    #[must_use]
    pub const fn class(self) -> &'static str {
        match self {
            Self::Unreachable => "llm_unreachable",
            Self::Timeout => "llm_timeout",
            Self::Unsafe => "llm_unsafe",
            Self::Empty => "llm_empty",
        }
    }
}

/// The local model a dictation uses, never the tenant's assistant provider.
#[must_use]
pub fn local_model(config: &DictationConfig) -> AiConfig {
    AiConfig {
        provider: "ollama".to_owned(),
        model: config.llm_model.clone(),
        api_key: String::new(),
        enabled: true,
        base_url: Some(config.llm_url.clone()),
    }
}

/// Redact, ask the local model (bounded by [`LLM_TIMEOUT`]), re-hydrate,
/// lay out. `redactor` knows this patient's identifiers.
///
/// # Errors
/// An [`LlmFailure`] class; the transcript stays with the doctor either way.
pub async fn draft_note(
    config: &DictationConfig,
    redactor: &mut Redactor,
    transcript: &str,
) -> Result<Draft, LlmFailure> {
    let prompt = redactor
        .redact(transcript)
        .map_err(|_| LlmFailure::Unsafe)?;
    let (model, preamble) = (local_model(config), Redacted::fixed(PREAMBLE));
    let call = llm::extract_with::<ModelDraft>(&model, &preamble, &prompt);
    let answer = tokio::time::timeout(LLM_TIMEOUT, call)
        .await
        .map_err(|_| LlmFailure::Timeout)?
        .map_err(|_| LlmFailure::Unreachable)?;
    let draft = lay_out(answer, |text| redactor.rehydrate(text));
    if draft.is_empty() {
        return Err(LlmFailure::Empty);
    }
    Ok(draft)
}

/// The model's fields as the consultation note's sections, each re-hydrated
/// and bounded; empty ones are left out rather than offered blank.
pub fn lay_out(answer: ModelDraft, rehydrate: impl Fn(&str) -> String) -> Draft {
    let clean = |text: &str| bounded(&rehydrate(text.trim()));
    let subjective = [
        ("Complaint", &answer.complaint),
        ("History", &answer.history),
    ]
    .iter()
    .map(|(label, text)| (label, clean(text)))
    .filter(|(_, text)| !text.is_empty())
    .map(|(label, text)| format!("{label}: {text}"))
    .collect::<Vec<_>>()
    .join("\n\n");
    let assessment = answer
        .diagnoses
        .iter()
        .take(MAX_DIAGNOSES)
        .map(|d| (clean(&d.description), suggested_code(&d.icd10_code)))
        .filter(|(description, _)| !description.is_empty())
        .map(|(description, code)| match code {
            Some(code) => format!("{description} (suggested ICD-10 {code}, verify)"),
            None => description,
        })
        .collect::<Vec<_>>()
        .join("\n");
    let sections = [
        ("subjective", "Subjective", subjective),
        ("objective", "Objective", clean(&answer.examination)),
        ("assessment", "Assessment", assessment),
        ("plan", "Plan", clean(&answer.plan)),
    ]
    .into_iter()
    .filter(|(_, _, text)| !text.is_empty())
    .map(|(code, title, text)| DraftSection {
        code: code.to_owned(),
        title: title.to_owned(),
        text,
    })
    .collect();
    let medicines = answer
        .medicines
        .into_iter()
        .take(MAX_MEDICINES)
        .map(|m| ModelMedicine {
            name: clean(&m.name),
            dose: clean(&m.dose),
            frequency: clean(&m.frequency),
            duration: clean(&m.duration),
            route: clean(&m.route),
        })
        .filter(|m| !m.name.is_empty())
        .collect();
    Draft {
        sections,
        medicines,
    }
}

/// At most [`MAX_TEXT_CHARS`], cut on a character boundary.
fn bounded(text: &str) -> String {
    text.chars().take(MAX_TEXT_CHARS).collect()
}

/// A code shaped like ICD-10 (`J06.9`), or none: a malformed code is dropped
/// rather than shown as if it were one.
fn suggested_code(code: &str) -> Option<String> {
    let code = code.trim().to_ascii_uppercase();
    let mut chars = code.chars();
    let letter = chars.next().is_some_and(|c| c.is_ascii_uppercase());
    let digits = code
        .get(1..3)
        .is_some_and(|d| d.chars().all(|c| c.is_ascii_digit()));
    let rest = code.get(3..).unwrap_or_default();
    let tail = rest.is_empty()
        || (rest.starts_with('.')
            && (2..=5).contains(&rest.len())
            && rest[1..].chars().all(|c| c.is_ascii_alphanumeric()));
    (letter && digits && tail).then_some(code)
}

#[cfg(test)]
mod tests {
    use super::{ModelDiagnosis, ModelDraft, ModelMedicine, lay_out, suggested_code};

    #[test]
    fn sections_follow_the_consultation_note() {
        let draft = lay_out(
            ModelDraft {
                complaint: "Fever for three days".to_owned(),
                history: String::new(),
                examination: "Throat congested".to_owned(),
                diagnoses: vec![ModelDiagnosis {
                    description: "Acute pharyngitis".to_owned(),
                    icd10_code: "j02.9".to_owned(),
                }],
                plan: "Review in five days".to_owned(),
                medicines: vec![ModelMedicine {
                    name: "Paracetamol".to_owned(),
                    dose: "500 mg".to_owned(),
                    ..ModelMedicine::default()
                }],
            },
            str::to_owned,
        );
        let codes: Vec<&str> = draft.sections.iter().map(|s| s.code.as_str()).collect();
        assert_eq!(codes, ["subjective", "objective", "assessment", "plan"]);
        assert_eq!(draft.sections[0].text, "Complaint: Fever for three days");
        assert_eq!(
            draft.sections[2].text,
            "Acute pharyngitis (suggested ICD-10 J02.9, verify)"
        );
        assert_eq!(draft.medicines.len(), 1);
    }

    #[test]
    fn nothing_said_is_an_empty_draft_not_blank_sections() {
        let draft = lay_out(ModelDraft::default(), str::to_owned);
        assert!(draft.is_empty());
    }

    #[test]
    fn placeholders_are_rehydrated() {
        let draft = lay_out(
            ModelDraft {
                complaint: "[PATIENT_1] has a cough".to_owned(),
                ..ModelDraft::default()
            },
            |t| t.replace("[PATIENT_1]", "Ravi"),
        );
        assert_eq!(draft.sections[0].text, "Complaint: Ravi has a cough");
    }

    #[test]
    fn only_icd_shaped_codes_are_offered() {
        assert_eq!(suggested_code("E11.9").as_deref(), Some("E11.9"));
        assert_eq!(suggested_code("I10").as_deref(), Some("I10"));
        assert_eq!(suggested_code("diabetes"), None);
        assert_eq!(suggested_code(""), None);
        assert_eq!(suggested_code("E1"), None);
    }
}
