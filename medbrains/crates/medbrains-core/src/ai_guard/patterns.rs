//! What the guard looks for, compiled once. Everything matches lowercase text
//! with typographic dashes and spaces made plain (see `super::normalise`).
//! A pattern that fails to compile blocks the whole answer, never nothing.

use std::sync::LazyLock;

use regex::Regex;

pub(super) struct Patterns {
    /// Words after which a condition name reads as a diagnosis.
    pub(super) diagnosis_cue: Regex,
    /// A condition name: a suffix (`-itis`, `-aemia`…) or a common noun.
    pub(super) condition: Regex,
    /// Telling someone to start, change or dose a treatment.
    pub(super) treatment: Vec<Regex>,
    /// Advice, a treatment suggestion when `treatment_noun` also matches.
    pub(super) advice: Vec<Regex>,
    pub(super) treatment_noun: Regex,
    /// Text in a record that addresses the AI rather than the reader.
    pub(super) injection: Regex,
    /// A reference range, estimate or conversion.
    pub(super) estimate: Regex,
    /// A number not glued to a letter on its left (`V4`, `HbA1c` are names).
    pub(super) number: Regex,
    /// The redactor's numbered placeholders, `[AADHAAR_1]`; group 1 the kind.
    pub(super) placeholder: Regex,
    /// Any bracketed placeholder shape, removed before reading numbers.
    pub(super) any_placeholder: Regex,
}

/// Names that end like a condition but are not one.
pub(super) const NOT_CONDITIONS: &[&str] = &[
    "diagnosis",
    "prognosis",
    "coma",
    "stoma",
    "aroma",
    "diploma",
    "sympathy",
    "empathy",
];

/// Placeholder kinds an answer may show without being asked: who the record
/// is about and who cared for them, the hospital's own numbers, dates.
/// Anything else — contact, government, financial, device — only when the
/// question itself carried it. Unknown kinds are held (fail closed).
pub(super) const SHOWN_KINDS: &[&str] = &[
    "PATIENT",
    "RELATIVE",
    "DOCTOR",
    "STAFF",
    "PERSON",
    "UHID",
    "INVOICE",
    "AMOUNT",
    "ID",
    "ATTACHMENT",
];

/// The patient's own contact details: shown only when the user may see them
/// on the patient screen ([`super::ContactAccess`]). Government, financial and
/// device identifiers are never in this list.
pub(super) const CONTACT_KINDS: &[&str] = &["PHONE", "EMAIL", "ADDRESS", "PINCODE"];

/// Words too common to show that an answer is repeating a record's
/// injected instruction.
pub(super) const COMMON_WORDS: &[&str] = &[
    "patient", "this", "that", "with", "from", "have", "will", "your", "they", "them", "then",
    "than", "were", "been", "their", "there", "what", "when", "which", "into", "about", "also",
    "only", "note", "record", "please", "should",
];

/// A treatment suggestion whatever it names.
const TREATMENT: &[&str] = &[
    r"\b(i|we) (would )?(recommend|suggest|advise)\b",
    r"\b(initiation|initiating|commencing|starting) (of )?(\w+ ){0,3}(therapy|treatment|supplement\w*|replacement|medication|antibiotics?|insulin|dose)",
    r"\b(therapy|treatment|replacement|supplementation) (is|would be|may be|can be) (a |the )?(common|usual|standard|first-line|recommended|indicated|appropriate|reasonable)",
    r"\b(common|usual|standard|first-line) (management|treatment|therapy)",
    r"\b(start|initiate|increase|decrease|reduce|titrate|uptitrate|taper|switch to|add|give|administer|raise)\b[^.\n]{0,40}\b\d+(\.\d+)?\s?(mg|mcg|g|ml|units?|iu)\b",
    r"\b(dose|dosage) (should|is recommended|adjustment|reduction|increase|can be|may be|does not require)",
    r"\b(recommended|appropriate|suggested|usual|starting|maximum|safe) (dose|dosage|regimen)",
    r"\b(including|such as|e\.g\.?,?|like|for example)[^.\n]{0,30}\b(supplement\w*|replacement|therapy|tablets?|infusion|transfusion|antibiotics?)\b",
];

/// Advice that is a treatment suggestion only when the sentence is about a
/// treatment ([`TREATMENT_NOUN`]): "the consent should be added" is admin.
const ADVICE: &[&str] = &[
    r"\b(recommend|suggest|advis|consider)\w* (to )?(start|add|increas|reduc|decreas|stop|switch|giv|prescrib|titrat|initiat|commenc|hold|withhold|using|a dose|a trial|treat)",
    r"\b(should|must|needs? to|ought to) (be )?(start|given|prescribed|increased|reduced|decreased|stopped|switched|treated|titrated|commenced|initiated|added|held|continued|adjusted)",
    r"\bcan be (continued|started|given|increased|reduced)\b",
    r"^\W*(\d+[.)]\s*)?(start|give|increase|reduce|add|begin|stop|switch|titrate|administer|commence|initiate|prescribe)\b",
];

const TREATMENT_NOUN: &str = r"\b(mg|mcg|units?|iu|doses?|dosage|therapy|treatment|tablets?|capsules?|supplement\w*|medications?|medicines?|drugs?|antibiotics?|insulin|infusion|injection|regimen|iron)\b";

fn compile() -> Result<Patterns, regex::Error> {
    Ok(Patterns {
        diagnosis_cue: Regex::new(concat!(
            r"\b(consistent|compatible|in keeping) with\b",
            r"|\b(suggestive|indicative|characteristic|diagnostic|typical|suspicious) (of|for)\b",
            r"|\b(likely|probable|probably|possible|presumed|suspected)\b",
            r"|\b(suggests?|indicates?|points? to|confirms?|due to|diagnos(is|ed|e))\b",
            r"|\b(has|have|had|suffering from|signs of)\b",
            r"|\)\s*[-:=]\s*",
        ))?,
        condition: Regex::new(concat!(
            r"^([a-z]+(itis|osis|emia|aemia|oma|pathy|plasia|penia|cytosis)",
            r"|anaemia|anemia|infection|disease|syndrome|deficiency|failure|disorder|cancer",
            r"|malignancy|sepsis|diabetes|hypertension|hypothyroidism|hyperthyroidism",
            r"|pneumonia|fracture|infarction|stroke|tuberculosis)$",
        ))?,
        treatment: TREATMENT
            .iter()
            .map(|p| Regex::new(p))
            .collect::<Result<_, _>>()?,
        advice: ADVICE
            .iter()
            .map(|p| Regex::new(p))
            .collect::<Result<_, _>>()?,
        treatment_noun: Regex::new(TREATMENT_NOUN)?,
        injection: Regex::new(concat!(
            r"(ignore|disregard|forget) (all |any |the )*(previous|prior|above|earlier|preceding|instructions)",
            r"|you are now|(admin|developer|god|jailbreak|debug) mode|system prompt",
            r"|new instructions|as an ai\b|do not tell (the )?(doctor|user|nurse)",
        ))?,
        estimate: Regex::new(concat!(
            r"\b(normal|typical(ly)?|usual(ly)?|reference|expected|physiolog\w*|range|approx\w*",
            r"|about|around|roughly|equivalent|equals?|would be|corresponds? to|converts? to",
            r"|i\.e|if (entered|recorded|read|interpreted|meant))\b|[~≈=→]",
        ))?,
        number: Regex::new(r"(?:^|[^a-z0-9_.])(\d+(?:\.\d+)?)")?,
        placeholder: Regex::new(r"\[([A-Z][A-Z_]*?)_\d+\]")?,
        any_placeholder: Regex::new(r"\[[A-Z][^\[\]\n]{0,80}\]")?,
    })
}

pub(super) static PATTERNS: LazyLock<Result<Patterns, regex::Error>> = LazyLock::new(compile);
