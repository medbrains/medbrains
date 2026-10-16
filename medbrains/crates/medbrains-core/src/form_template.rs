//! Hospital-built forms: a definition is sections of typed questions; a
//! published version of it never changes; answers are checked against the
//! exact version they were given for.
//!
//! The same rules run on the server (authoritative) and are mirrored by the
//! web renderer for instant feedback. Nothing here trusts the client.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

/// Bounds on what a definition may hold — a form, not a database.
pub const MAX_SECTIONS: usize = 20;
pub const MAX_FIELDS: usize = 150;
pub const MAX_OPTIONS: usize = 50;
pub const MAX_TEXT: usize = 5000;

/// The kinds of question a hospital can ask.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldKind {
    Text,
    Textarea,
    Number,
    Date,
    YesNo,
    Select,
    Radio,
    Multiselect,
}

impl FieldKind {
    const fn has_options(self) -> bool {
        matches!(self, Self::Select | Self::Radio | Self::Multiselect)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormFieldSpec {
    pub key: String,
    pub label: String,
    pub kind: FieldKind,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub help: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormSectionSpec {
    pub title: String,
    pub fields: Vec<FormFieldSpec>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct FormDefinition {
    pub sections: Vec<FormSectionSpec>,
}

impl FormDefinition {
    pub fn fields(&self) -> impl Iterator<Item = &FormFieldSpec> {
        self.sections.iter().flat_map(|s| s.fields.iter())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormTemplate {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub module: String,
    pub draft: Value,
    pub published_version: Option<i32>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormTemplateVersion {
    pub id: Uuid,
    pub template_id: Uuid,
    pub version: i32,
    pub definition: Value,
    pub published_by: Uuid,
    pub published_at: DateTime<Utc>,
}

/// The form staff fill in now: a hospital's published version, or the
/// built-in one when the hospital has not customised it (`version_id` none).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveForm {
    pub code: String,
    pub version_id: Option<Uuid>,
    pub version: Option<i32>,
    pub definition: FormDefinition,
}

fn is_key(key: &str) -> bool {
    let mut chars = key.chars();
    chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && key.len() <= 63
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// What is wrong with a definition, in words an administrator can act on.
/// `publishing` additionally demands at least one question.
pub fn check_definition(def: &FormDefinition, publishing: bool) -> Result<(), String> {
    if def.sections.len() > MAX_SECTIONS {
        return Err(format!("A form has at most {MAX_SECTIONS} sections"));
    }
    let total = def.fields().count();
    if total > MAX_FIELDS {
        return Err(format!("A form has at most {MAX_FIELDS} questions"));
    }
    if publishing && total == 0 {
        return Err("Add at least one question before publishing".to_owned());
    }
    let mut keys = HashSet::new();
    for section in &def.sections {
        if section.title.trim().is_empty() {
            return Err("Every section needs a title".to_owned());
        }
        for field in &section.fields {
            check_field(field, &mut keys)?;
        }
    }
    Ok(())
}

fn check_field(field: &FormFieldSpec, keys: &mut HashSet<String>) -> Result<(), String> {
    if field.label.trim().is_empty() {
        return Err("Every question needs a label".to_owned());
    }
    if !is_key(&field.key) {
        return Err(format!(
            "\"{}\": the key must start with a letter and use only a-z, 0-9 and _",
            field.label
        ));
    }
    if !keys.insert(field.key.clone()) {
        return Err(format!("Two questions share the key \"{}\"", field.key));
    }
    if !field.kind.has_options() {
        return Ok(());
    }
    let distinct: HashSet<&str> = field.options.iter().map(|o| o.trim()).collect();
    if field.options.len() < 2 || distinct.len() != field.options.len() || distinct.contains("") {
        return Err(format!(
            "\"{}\" needs at least two different choices",
            field.label
        ));
    }
    if field.options.len() > MAX_OPTIONS {
        return Err(format!(
            "\"{}\" has more than {MAX_OPTIONS} choices",
            field.label
        ));
    }
    Ok(())
}

fn is_blank(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::String(s) => s.trim().is_empty(),
        Value::Array(a) => a.is_empty(),
        _ => false,
    }
}

fn check_value(field: &FormFieldSpec, value: &Value) -> Result<(), &'static str> {
    let in_options = |s: &str| field.options.iter().any(|o| o == s);
    let ok = match field.kind {
        FieldKind::Text | FieldKind::Textarea => {
            value.as_str().is_some_and(|s| s.len() <= MAX_TEXT)
        }
        FieldKind::Number => value.as_f64().is_some_and(f64::is_finite),
        FieldKind::Date => value
            .as_str()
            .is_some_and(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()),
        FieldKind::YesNo => value.is_boolean(),
        FieldKind::Select | FieldKind::Radio => value.as_str().is_some_and(in_options),
        FieldKind::Multiselect => value
            .as_array()
            .is_some_and(|a| a.iter().all(|v| v.as_str().is_some_and(in_options))),
    };
    if ok {
        Ok(())
    } else {
        Err("is not a valid answer")
    }
}

/// Answers checked against the version they were given for. Returns the
/// answers with blanks dropped, or every problem keyed by question.
pub fn check_answers(
    def: &FormDefinition,
    answers: &Map<String, Value>,
) -> Result<Map<String, Value>, HashMap<String, String>> {
    let fields: HashMap<&str, &FormFieldSpec> = def.fields().map(|f| (f.key.as_str(), f)).collect();
    let mut problems = HashMap::new();
    for key in answers.keys().filter(|k| !fields.contains_key(k.as_str())) {
        problems.insert(key.clone(), "is not a question on this form".to_owned());
    }
    let mut clean = Map::new();
    for field in def.fields() {
        match answers.get(&field.key).filter(|v| !is_blank(v)) {
            None if field.required => {
                problems.insert(field.key.clone(), format!("{} is required", field.label));
            }
            None => {}
            Some(value) => match check_value(field, value) {
                Ok(()) => {
                    clean.insert(field.key.clone(), value.clone());
                }
                Err(why) => {
                    problems.insert(field.key.clone(), format!("{} {why}", field.label));
                }
            },
        }
    }
    if problems.is_empty() {
        Ok(clean)
    } else {
        Err(problems)
    }
}

fn text(key: &str, label: &str, kind: FieldKind, required: bool) -> FormFieldSpec {
    FormFieldSpec {
        key: key.to_owned(),
        label: label.to_owned(),
        kind,
        required,
        options: Vec::new(),
        help: None,
    }
}

/// Code of the consent pilot.
pub const PROCEDURE_CONSENT: &str = "procedure_consent";
/// Every form that ships built in.
pub const BUILT_IN_CODES: &[&str] = &[PROCEDURE_CONSENT];

/// Every code with a built-in form, and that form. A hospital that has not
/// published its own version gets this one; customising starts from it.
#[must_use]
pub fn built_in(code: &str) -> Option<(&'static str, &'static str, FormDefinition)> {
    (code == PROCEDURE_CONSENT).then(|| ("Procedure consent", "opd", procedure_consent()))
}

/// The procedure consent as it was hard-coded. Its keys are the consent
/// record's own columns, so the record and its print keep working whatever a
/// hospital adds.
fn procedure_consent() -> FormDefinition {
    use FieldKind::Text as Line;
    use FieldKind::Textarea as Area;
    FormDefinition {
        sections: vec![
            FormSectionSpec {
                title: "What was explained".to_owned(),
                fields: vec![
                    text("risks_explained", "Risks explained", Area, false),
                    text(
                        "alternatives_explained",
                        "Alternatives explained",
                        Area,
                        false,
                    ),
                    text("benefits_explained", "Benefits explained", Area, false),
                    text("patient_questions", "Patient's questions", Area, false),
                ],
            },
            FormSectionSpec {
                title: "Who consented".to_owned(),
                fields: vec![
                    text("consented_by_name", "Consented by (name)", Line, false),
                    text("consented_by_relation", "Relation to patient", Line, false),
                    text("witness_name", "Witness name", Line, false),
                    text("witness_designation", "Witness designation", Line, false),
                ],
            },
        ],
    }
}

#[cfg(test)]
#[path = "form_template_tests.rs"]
mod tests;
