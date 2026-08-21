//! Phone-number normalisation.
//!
//! Contact resolution is a single indexed lookup on
//! `(tenant_id, channel, value)`, which makes the screen-pop fast and makes
//! the stored form load-bearing: `+91 98400 12345`, `098400 12345` and
//! `9840012345` are one person, and if they are three rows the returning
//! caller gets a stranger's history on the agent's screen.
//!
//! So numbers are normalised once, at ingestion, and never at read time.
//!
//! India-first, deliberately narrow: a ten-digit mobile beginning 6-9 gets
//! `+91`, anything already in `+` form is kept, and anything else is rejected
//! rather than guessed at. Guessing a country code is how a campaign dials a
//! landline in another state.

/// Why a number could not be normalised.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhoneError {
    /// Nothing but punctuation.
    Empty,
    /// Not a recognisable Indian mobile and not in international form.
    Unrecognised,
}

impl PhoneError {
    #[must_use]
    pub const fn message(self) -> &'static str {
        match self {
            Self::Empty => "phone number is empty",
            Self::Unrecognised => {
                "not a recognisable phone number — give a 10-digit Indian \
                 mobile or an international number beginning +"
            }
        }
    }
}

/// Normalise to E.164, or say why not.
///
/// # Errors
/// Returns [`PhoneError`] when the input is empty or is neither an Indian
/// mobile nor an international number.
pub fn normalise(raw: &str) -> Result<String, PhoneError> {
    let had_plus = raw.trim_start().starts_with('+');
    let digits: String = raw.chars().filter(char::is_ascii_digit).collect();

    if digits.is_empty() {
        return Err(PhoneError::Empty);
    }

    // Already international: trust the caller's country code, only strip the
    // formatting. A leading 00 is the same intent written the older way.
    if had_plus {
        return Ok(format!("+{digits}"));
    }
    if let Some(rest) = digits.strip_prefix("00") {
        return Ok(format!("+{rest}"));
    }

    // Indian mobile, in the four shapes a form or a PBX actually produces.
    let local = digits
        .strip_prefix("91")
        .filter(|rest| rest.len() == 10)
        .or_else(|| digits.strip_prefix('0').filter(|rest| rest.len() == 10))
        .unwrap_or(digits.as_str());

    if local.len() == 10 && local.starts_with(['6', '7', '8', '9']) {
        return Ok(format!("+91{local}"));
    }

    Err(PhoneError::Unrecognised)
}

#[cfg(test)]
mod tests {
    use super::{PhoneError, normalise};

    #[test]
    fn the_same_indian_mobile_written_four_ways_is_one_number() {
        // The whole point: these must collapse, or the returning caller gets
        // somebody else's screen-pop.
        for raw in ["9840012345", "098400 12345", "+91 98400 12345", "0091-9840012345"] {
            assert_eq!(normalise(raw).as_deref(), Ok("+919840012345"), "{raw}");
        }
    }

    #[test]
    fn an_international_number_keeps_its_own_country_code() {
        assert_eq!(normalise("+1 (415) 555-0100").as_deref(), Ok("+14155550100"));
        assert_eq!(normalise("+971 50 123 4567").as_deref(), Ok("+971501234567"));
    }

    #[test]
    fn a_landline_is_refused_rather_than_guessed_at() {
        // 044 is Chennai. Ten digits, but not a mobile prefix — prepending +91
        // to a guess is how a campaign dials the wrong person.
        assert_eq!(normalise("044 2345 6789"), Err(PhoneError::Unrecognised));
        assert_eq!(normalise("12345"), Err(PhoneError::Unrecognised));
    }

    #[test]
    fn punctuation_alone_is_empty_not_unrecognised() {
        assert_eq!(normalise("   "), Err(PhoneError::Empty));
        assert_eq!(normalise("-- ()"), Err(PhoneError::Empty));
    }
}
