//! The shapes that identify a person, an account or a payment wherever they
//! are typed. Compiled once; a pattern that fails to compile makes every
//! redaction fail (closed), never silently match nothing.

use std::sync::LazyLock;

use regex::Regex;

use super::Kind;

/// How a match is classified once found.
#[derive(Clone, Copy)]
pub(super) enum Classify {
    /// Always this kind.
    Is(Kind),
    /// 12 digits: Aadhaar if the Verhoeff check holds, else a generic id.
    TwelveDigits,
    /// 13–19 digits: card if Luhn holds, else a generic id.
    LongDigits,
}

pub(super) struct Pattern {
    pub(super) re: Regex,
    pub(super) classify: Classify,
    /// Capture group holding the identifier (0 = whole match). The rest of the
    /// match (a keyword such as "policy no") stays, so the model keeps context.
    pub(super) group: usize,
}

/// JSON fields whose value says who a person is, keyed to what they are.
pub(super) const IDENTITY_KEYS: &[(&str, Kind)] = &[
    ("first_name", Kind::Patient),
    ("middle_name", Kind::Patient),
    ("last_name", Kind::Patient),
    ("full_name", Kind::Person),
    ("full_name_local", Kind::Patient),
    ("patient_name", Kind::Patient),
    ("preferred_name", Kind::Patient),
    ("temporary_name", Kind::Patient),
    ("maiden_name", Kind::Patient),
    ("father_name", Kind::Relative),
    ("mother_name", Kind::Relative),
    ("spouse_name", Kind::Relative),
    ("guardian_name", Kind::Relative),
    ("next_of_kin_name", Kind::Relative),
    ("emergency_contact_name", Kind::Relative),
    ("contact_name", Kind::Relative),
    ("attendant_name", Kind::Relative),
    ("doctor_name", Kind::Doctor),
    ("user_name", Kind::Staff),
    ("author_name", Kind::Staff),
    ("ordered_by_name", Kind::Staff),
    ("phone", Kind::Phone),
    ("phone_secondary", Kind::Phone),
    ("phone_alt", Kind::Phone),
    ("mobile", Kind::Phone),
    ("alternate_phone", Kind::Phone),
    ("whatsapp_number", Kind::Phone),
    ("next_of_kin_phone", Kind::Phone),
    ("emergency_contact_phone", Kind::Phone),
    ("email", Kind::Email),
    ("address", Kind::Address),
    ("address_line1", Kind::Address),
    ("address_line2", Kind::Address),
    ("address_line_1", Kind::Address),
    ("address_line_2", Kind::Address),
    ("line1", Kind::Address),
    ("line2", Kind::Address),
    ("landmark", Kind::Address),
    ("birth_place", Kind::Address),
    ("pincode", Kind::Pincode),
    ("postal_code", Kind::Pincode),
    ("uhid", Kind::Uhid),
    ("mrn", Kind::Uhid),
    ("abha_number", Kind::Abha),
    ("abha_id", Kind::Abha),
    ("abha_address", Kind::AbhaAddress),
    ("aadhaar", Kind::Aadhaar),
    ("aadhaar_number", Kind::Aadhaar),
    ("aadhaar_last4", Kind::Aadhaar),
    ("pan_number", Kind::Pan),
    ("passport_number", Kind::Passport),
    ("voter_id", Kind::VoterId),
    ("driving_license", Kind::DrivingLicence),
    ("policy_number", Kind::Policy),
    ("member_id", Kind::Policy),
    ("claim_number", Kind::Policy),
    ("tpa_member_id", Kind::Policy),
    ("account_number", Kind::BankAccount),
    ("bank_account", Kind::BankAccount),
    ("ifsc", Kind::Ifsc),
    ("upi_id", Kind::Upi),
    ("gstin", Kind::Gstin),
    ("invoice_number", Kind::Invoice),
    ("receipt_number", Kind::Invoice),
    ("ip_address", Kind::Ip),
    ("device_id", Kind::Device),
    ("imei", Kind::Device),
    ("user_agent", Kind::Device),
];

/// Fields whose value is an attachment or image: never sent, not even as a
/// placeholder the model could ask about.
pub(super) const ATTACHMENT_KEYS: &[&str] = &[
    "photo_url",
    "photo",
    "image",
    "image_url",
    "signature",
    "signature_url",
    "file_url",
    "document_url",
    "attachment",
    "attachment_url",
    "thumbnail",
    "content_base64",
];

/// Free-text shapes, in priority order: the more specific shape first, so a
/// GSTIN is not taken for the PAN inside it, an email not for a UPI id.
static FREE_TEXT: LazyLock<Result<Vec<Pattern>, regex::Error>> = LazyLock::new(|| {
    let p = |re: &str, classify: Classify, group: usize| -> Result<Pattern, regex::Error> {
        Ok(Pattern {
            re: Regex::new(re)?,
            classify,
            group,
        })
    };
    Ok(vec![
        p(
            r"data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+",
            Classify::Is(Kind::Attachment),
            0,
        )?,
        p(
            r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+",
            Classify::Is(Kind::Email),
            0,
        )?,
        p(
            r"(?i)\b[\w.]{3,}@(?:abdm|sbx)\b",
            Classify::Is(Kind::AbhaAddress),
            0,
        )?,
        p(r"\b[\w.-]{2,}@[A-Za-z]{2,}\b", Classify::Is(Kind::Upi), 0)?,
        p(
            r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b",
            Classify::Is(Kind::Gstin),
            0,
        )?,
        p(
            r"\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b",
            Classify::Is(Kind::Pan),
            0,
        )?,
        p(r"\b[A-Z]{4}0[A-Z0-9]{6}\b", Classify::Is(Kind::Ifsc), 0)?,
        p(
            r"\b[A-Z]{2}[ -]?\d{2}[ -]?(?:19|20)\d{2}[ -]?\d{7}\b",
            Classify::Is(Kind::DrivingLicence),
            0,
        )?,
        p(
            r"\b[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}\b",
            Classify::Is(Kind::Vehicle),
            0,
        )?,
        p(r"\b[A-Z]{3}\d{7}\b", Classify::Is(Kind::VoterId), 0)?,
        p(r"\b[A-Z][1-9]\d{6}\b", Classify::Is(Kind::Passport), 0)?,
        p(
            r"\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b",
            Classify::Is(Kind::Device),
            0,
        )?,
        p(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", Classify::Is(Kind::Ip), 0)?,
        p(
            r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b",
            Classify::Is(Kind::Ip),
            0,
        )?,
        // ABHA number: 14 digits, often 2-4-4-4.
        p(r"\b\d{2}-\d{4}-\d{4}-\d{4}\b", Classify::Is(Kind::Abha), 0)?,
        // Long digit runs: a card if Luhn holds, else an id of some kind.
        p(r"\b\d(?:[ -]?\d){12,18}\b", Classify::LongDigits, 0)?,
        // Twelve digits: an Aadhaar if Verhoeff holds, else an id.
        p(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b", Classify::TwelveDigits, 0)?,
        // Keyword-anchored numbers: the keyword stays, the number goes.
        p(
            r"(?i)\b(?:a/c|acct|account|bank\s+account)\b\s*(?:no\.?|number|#)?\s*[:\-]?\s*(\d{9,18})\b",
            Classify::Is(Kind::BankAccount),
            1,
        )?,
        p(
            r"(?i)\b(?:policy|claim|member|membership|tpa|insurance|card|pre-?auth)\b\s*(?:no\.?|number|id|#)?\s*[:\-#]?\s*([A-Z0-9][A-Z0-9/\-]*\d[A-Z0-9/\-]*)",
            Classify::Is(Kind::Policy),
            1,
        )?,
        p(
            r"(?i)\b(?:invoice|receipt|bill|txn|transaction|utr)\b\s*(?:no\.?|number|id|#)?\s*[:\-#]?\s*([A-Z0-9][A-Z0-9/\-]*\d[A-Z0-9/\-]*)",
            Classify::Is(Kind::Invoice),
            1,
        )?,
        p(
            r"(?i)\b(?:uhid|mrn|ip\s*no|op\s*no|reg(?:istration)?\s*no|hospital\s*no)\b\.?\s*[:\-#]?\s*([A-Z0-9][A-Z0-9/\-]*\d[A-Z0-9/\-]*)",
            Classify::Is(Kind::Uhid),
            1,
        )?,
        p(
            r"(?i)\bpin\s*(?:code)?\s*[:\-]?\s*([1-9]\d{5})\b",
            Classify::Is(Kind::Pincode),
            1,
        )?,
        // Indian mobile with or without +91/0; landline with STD code.
        p(
            r"(?:\+91[ -]?|\b0)?\b[6-9]\d{4}[ -]?\d{5}\b",
            Classify::Is(Kind::Phone),
            0,
        )?,
        p(r"\b0\d{2,4}[ -]\d{6,8}\b", Classify::Is(Kind::Phone), 0)?,
        p(
            r"(?i)(?:₹|\brs\.?|\binr)\s?\d[\d,]*(?:\.\d+)?",
            Classify::Is(Kind::Amount),
            0,
        )?,
    ])
});

/// People named in free text by a cue: an honorific, a relationship, or an
/// Indian patronymic (S/o, D/o, W/o). Group 1 is the cue, group 2 the name.
static NAME_CUES: LazyLock<Result<Vec<(Regex, Kind)>, regex::Error>> = LazyLock::new(|| {
    let name = r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})";
    Ok(vec![
        (
            Regex::new(&format!(r"\b(Dr\.?|Doctor)\s+{name}"))?,
            Kind::Doctor,
        ),
        (
            Regex::new(&format!(
                r"\b(Mr|Mrs|Ms|Miss|Smt|Shri|Sri|Srimati|Kumari|Km|Master|Baby|Thiru|Tmt|Selvi|Mx)\.?\s+{name}"
            ))?,
            Kind::Person,
        ),
        (
            Regex::new(&format!(
                r"(?i:\b(wife|husband|son|daughter|father|mother|brother|sister|uncle|aunt|aunty|grandson|granddaughter|grandmother|grandfather|guardian|attendant|spouse|neighbour|neighbor|friend|nephew|niece|cousin|amma|appa|beta|bhai|didi)(?:\s+(?:named|called|is|was))?)\s+{name}"
            ))?,
            Kind::Relative,
        ),
        // Not C/o: in a clinical note that is "complains of", not "care of".
        (
            Regex::new(&format!(r"\b([SDW]/[Oo]\.?)\s+{name}"))?,
            Kind::Relative,
        ),
    ])
});

/// Dates as typed in Indian records: ISO, DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY.
static DATES: LazyLock<Result<Regex, regex::Error>> = LazyLock::new(|| {
    Regex::new(
        r"(?i)\b(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})|(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(\d{4}))\b",
    )
});

pub(super) fn free_text() -> Result<&'static [Pattern], String> {
    FREE_TEXT
        .as_ref()
        .map(Vec::as_slice)
        .map_err(ToString::to_string)
}

pub(super) fn name_cues() -> Result<&'static [(Regex, Kind)], String> {
    NAME_CUES
        .as_ref()
        .map(Vec::as_slice)
        .map_err(ToString::to_string)
}

pub(super) fn dates() -> Result<&'static Regex, String> {
    DATES.as_ref().map_err(ToString::to_string)
}
