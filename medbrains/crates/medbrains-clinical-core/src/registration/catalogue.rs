//! The shape of the registration form, as data.
//!
//! One definition of every step, field, option and rule, read by the web
//! (generated TypeScript), iOS and Android (`UniFFI`) and the server (the same
//! evaluator). It is compiled in, never served: a runtime form definition was
//! tried and removed (`c72246ec`) because the form and the code drifted.
//!
//! A field's `id` is its path in the create-patient request, dotted for
//! nested objects (`address.city`, `attributes.allergy_status`,
//! `contact.whatsapp_opt_in`). A few ids are desk-only inputs that never reach
//! the server as themselves (`age_years`, `create_opd_visit`); they are marked
//! `sent: false`.

use serde::Serialize;

/// The wizard's steps, in order. Review is a step every surface draws from
/// the answers; it holds no fields of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Step {
    Intake,
    ContactIdentity,
    FamilyAddressSafety,
    PreferencesBilling,
}

/// Each step with the title the desk reads.
pub const STEPS: &[(Step, &str)] = &[
    (Step::Intake, "Intake"),
    (Step::ContactIdentity, "Contact & identity"),
    (Step::FamilyAddressSafety, "Family, address & safety"),
    (Step::PreferencesBilling, "Preferences & billing"),
];

/// How a field is entered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Text,
    LongText,
    Phone,
    Email,
    Date,
    /// Whole years; becomes an estimated date of birth.
    Age,
    Digits,
    Number,
    /// A short fixed list, all choices visible.
    Segmented,
    /// A list chosen from, fixed or loaded.
    Select,
    Toggle,
    /// Several free or catalogue-backed entries.
    Tags,
}

/// One choice: the value sent and the words shown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Opt {
    pub value: &'static str,
    pub label: &'static str,
}

/// Where a field's choices come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "source", content = "options", rename_all = "snake_case")]
pub enum Options {
    None,
    Fixed(&'static [Opt]),
    Departments,
    Doctors,
    Camps,
    DrugCatalogue,
}

/// A condition on another field: its value is one of `is`. `"*"` means any
/// value at all; toggles are `"true"` / `"false"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Cond {
    pub field: &'static str,
    pub is: &'static [&'static str],
}

/// What a rule checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Check {
    /// Has a value.
    Required,
    /// A toggle that must be on.
    Checked,
    /// At least one of these fields has a value.
    AnyFilled {
        fields: &'static [&'static str],
    },
    /// The value is one of the field's own fixed options.
    OneOfOptions,
    /// Only digits (spaces and hyphens ignored), between `min` and `max` of them.
    Digits {
        min: u32,
        max: u32,
    },
    /// Digits with an optional leading `+`, spaces, `-`, `(` `)`; 10–15 digits.
    PhoneShape,
    MaxLen {
        max: u32,
    },
    IntRange {
        min: i64,
        max: i64,
    },
    Email,
}

/// A check, when it applies, and the sentence the desk reads when it fails.
///
/// It applies when any `when` matches (or `when` is empty), every `when_all`
/// matches, and no `unless` matches. Shape checks (digits, phone, length…) only look at a value that
/// is there; `Required` decides whether one must be.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Rule {
    pub check: Check,
    pub when: &'static [Cond],
    pub when_all: &'static [Cond],
    pub unless: &'static [Cond],
    pub message: &'static str,
}

/// One input on the form.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Field {
    pub id: &'static str,
    pub label: &'static str,
    pub step: Step,
    pub kind: Kind,
    pub options: Options,
    pub rules: &'static [Rule],
    /// Whether the value goes to the server under `id` (false for desk-only inputs).
    pub sent: bool,
    /// Help the desk reads under the field, if any.
    pub hint: Option<&'static str>,
}

/// The whole catalogue, for the generators and the native apps.
#[derive(Debug, Serialize)]
pub struct Catalogue {
    pub steps: Vec<StepTitle>,
    pub fields: Vec<Field>,
}

#[derive(Debug, Serialize)]
pub struct StepTitle {
    pub step: Step,
    pub title: &'static str,
}

/// Shorthand used by the field tables.
pub(crate) const fn rule(check: Check, message: &'static str) -> Rule {
    Rule {
        check,
        when: &[],
        when_all: &[],
        unless: &[],
        message,
    }
}

pub(crate) const fn cond(field: &'static str, is: &'static [&'static str]) -> Cond {
    Cond { field, is }
}

/// A field with no rules, sent under its id.
pub(crate) const fn plain(id: &'static str, label: &'static str, step: Step, kind: Kind) -> Field {
    Field {
        id,
        label,
        step,
        kind,
        options: Options::None,
        rules: &[],
        sent: true,
        hint: None,
    }
}
