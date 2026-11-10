//! Why part of an answer was removed, and what the user is told.

/// Why part of an answer was removed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Reason {
    Diagnosis,
    Treatment,
    RecordInstruction,
    Unsupported,
    /// A placeholder that would show raw, or talk about placeholders.
    Placeholder,
    /// The assistant narrating itself (its earlier answers, testing, mistakes).
    SelfTalk,
    Identifier,
    /// Contact details held because the access check failed.
    ContactUnchecked,
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
            Self::Placeholder => {
                "Removed from this answer: a sentence with a reference the assistant could \
                 not resolve. Ask again if something is missing."
            }
            Self::SelfTalk => {
                "Removed from this answer: commentary about the assistant itself rather \
                 than the question."
            }
            Self::Identifier => "An identifier the question did not ask for is not shown.",
            Self::ContactUnchecked => {
                "Contact details are not shown: whether you may see them could not be \
                 checked. Try again."
            }
            Self::Unchecked => {
                "This answer could not be checked for safety, so it is not shown. Try again."
            }
        }
    }
}
