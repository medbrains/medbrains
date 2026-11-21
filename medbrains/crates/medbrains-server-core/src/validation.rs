use std::collections::{HashMap, HashSet};

use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;

/// Collects per-field validation errors.
#[derive(Debug, Default, Serialize)]
pub struct ValidationErrors {
    fields: HashMap<String, Vec<String>>,
}

impl ValidationErrors {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, field: &str, message: impl Into<String>) {
        self.fields
            .entry(field.to_owned())
            .or_default()
            .push(message.into());
    }

    #[must_use]
    pub fn has_errors(&self) -> bool {
        !self.fields.is_empty()
    }

    #[must_use]
    pub fn into_fields(self) -> HashMap<String, Vec<String>> {
        self.fields
    }
}

// ── Regex patterns ───────────────────────────────────────

static CODE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[A-Z0-9][A-Z0-9\-]*[A-Z0-9]$").unwrap_or_else(|_| unreachable!())
});

static USERNAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z][a-z0-9_]*$").unwrap_or_else(|_| unreachable!()));

static EMAIL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
        .unwrap_or_else(|_| unreachable!())
});

static HEX_COLOR_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap_or_else(|_| unreachable!()));

static PINCODE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{4,10}$").unwrap_or_else(|_| unreachable!()));

static PHONE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[\d+\-() ]+$").unwrap_or_else(|_| unreachable!()));

static PREFIX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9\-]{0,10}$").unwrap_or_else(|_| unreachable!()));

static FORM_CODE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z][a-z0-9._]*$").unwrap_or_else(|_| unreachable!()));

static HTML_TAG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<[^>]*>").unwrap_or_else(|_| unreachable!()));

static API_ENDPOINT_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^/api/[a-z0-9/\-_]+$").unwrap_or_else(|_| unreachable!()));

// ── Validators ───────────────────────────────────────────

pub fn validate_code(errors: &mut ValidationErrors, field: &str, value: &str) {
    if value.len() < 2 {
        errors.add(field, "Code must be at least 2 characters");
    } else if value.len() > 20 {
        errors.add(field, "Code must be at most 20 characters");
    } else if !CODE_RE.is_match(value) {
        errors.add(
            field,
            "Code must be uppercase alphanumeric with optional hyphens, no leading/trailing hyphen",
        );
    }
}

pub fn validate_name(errors: &mut ValidationErrors, field: &str, value: &str) {
    if value.len() < 2 {
        errors.add(field, "Name must be at least 2 characters");
    } else if value.len() > 100 {
        errors.add(field, "Name must be at most 100 characters");
    }
}

// Person names accept single-character initials (common in South Indian
// naming conventions where surnames are often a single initial like
// "S" for Subramaniam, "K" for Krishnan). Use this for patient and
// contact names rather than `validate_name`, which has a 2-char floor
// suited to org/dept names.
pub fn validate_person_name(errors: &mut ValidationErrors, field: &str, value: &str) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        errors.add(field, "Name is required");
    } else if trimmed.chars().count() > 100 {
        errors.add(field, "Name must be at most 100 characters");
    }
}

pub fn validate_username(errors: &mut ValidationErrors, field: &str, value: &str) {
    if value.len() < 3 {
        errors.add(field, "Username must be at least 3 characters");
    } else if value.len() > 30 {
        errors.add(field, "Username must be at most 30 characters");
    } else if !USERNAME_RE.is_match(value) {
        errors.add(
            field,
            "Username must start with a letter and contain only lowercase letters, digits, and underscores",
        );
    }
}

pub fn validate_email(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !EMAIL_RE.is_match(value) {
        errors.add(field, "Invalid email address");
    }
}

/// Shortest password accepted when one is set or changed (NIST SP 800-63B rev 4: at least 8,
/// 15 recommended for a single factor; 12 is the floor chosen for staff logins).
pub const PASSWORD_MIN_CHARS: usize = 12;
/// Longest password accepted, so a hash request cannot be made arbitrarily expensive.
pub const PASSWORD_MAX_CHARS: usize = 128;
/// Shortest username or hospital name/code worth looking for inside a password; anything
/// shorter would refuse good passwords by accident.
const PASSWORD_CONTEXT_MIN_CHARS: usize = 3;

/// The 10,000 most common passwords, lowercase, built once. Source and licence are in the
/// header of `common_passwords.txt`.
static COMMON_PASSWORDS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    include_str!("common_passwords.txt")
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .collect()
});

/// A password to check, with what is known about whose it is. Fields left empty are
/// not checked, so a caller passes only what it already has in hand.
#[derive(Debug, Default, Clone, Copy)]
pub struct PasswordCheck<'a> {
    pub password: &'a str,
    pub username: &'a str,
    pub hospital_name: &'a str,
    pub hospital_code: &'a str,
}

impl<'a, P: AsRef<str> + ?Sized> From<&'a P> for PasswordCheck<'a> {
    /// A check of the password alone, for callers that know nothing about its owner.
    fn from(password: &'a P) -> Self {
        Self {
            password: password.as_ref(),
            ..Self::default()
        }
    }
}

impl<'a, P, U> From<(&'a P, &'a U)> for PasswordCheck<'a>
where
    P: AsRef<str> + ?Sized,
    U: AsRef<str> + ?Sized,
{
    /// A check of `(password, username)`, the common case, so a call site stays one line.
    fn from((password, username): (&'a P, &'a U)) -> Self {
        Self {
            password: password.as_ref(),
            username: username.as_ref(),
            ..Self::default()
        }
    }
}

/// Checks a password being set or changed.
///
/// 12 to 128 characters, the existing composition rules, not one of the most common
/// passwords, and not holding the username or the hospital's name or code. Only setting a
/// password is checked; existing ones keep working.
/// `check` is a password, a `(password, username)` pair, or a full [`PasswordCheck`].
pub fn validate_password<'a>(
    errors: &mut ValidationErrors,
    field: &str,
    check: impl Into<PasswordCheck<'a>>,
) {
    let check = check.into();
    let value = check.password;
    let length = value.chars().count();
    if length < PASSWORD_MIN_CHARS {
        errors.add(field, "Password must be at least 12 characters");
    } else if length > PASSWORD_MAX_CHARS {
        errors.add(field, "Password must be at most 128 characters");
    }
    if !value.chars().any(char::is_uppercase) {
        errors.add(field, "Password must contain at least one uppercase letter");
    }
    if !value.chars().any(char::is_lowercase) {
        errors.add(field, "Password must contain at least one lowercase letter");
    }
    if !value.chars().any(|c| c.is_ascii_digit()) {
        errors.add(field, "Password must contain at least one digit");
    }
    if !value.chars().any(|c| !c.is_alphanumeric()) {
        errors.add(
            field,
            "Password must contain at least one special character",
        );
    }
    if is_common_password(value) {
        errors.add(
            field,
            "This password is too common. Choose one that is harder to guess",
        );
    }
    if contains_context(value, check.username) {
        errors.add(field, "Password must not contain your username");
    }
    if contains_context(value, check.hospital_name) || contains_context(value, check.hospital_code)
    {
        errors.add(
            field,
            "Password must not contain the hospital's name or code",
        );
    }
}

/// True when the password, lowercased, is on the common list, either whole or with its
/// trailing digits and symbols taken off, so `Password@123` counts as `password`.
fn is_common_password(value: &str) -> bool {
    let lower = value.to_lowercase();
    let stem = lower.trim_end_matches(|c: char| !c.is_alphabetic());
    COMMON_PASSWORDS.contains(lower.as_str()) || COMMON_PASSWORDS.contains(stem)
}

/// True when `needle` appears inside the password, both lowercased with everything but letters
/// and digits removed, so `Rishi-Care#1` holds "Rishi Care". Needles shorter than three
/// characters are ignored.
fn contains_context(password: &str, needle: &str) -> bool {
    let squash = |s: &str| -> String {
        s.chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect()
    };
    let needle = squash(needle);
    needle.chars().count() >= PASSWORD_CONTEXT_MIN_CHARS && squash(password).contains(&needle)
}

pub fn validate_optional_email(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !value.is_empty() && !EMAIL_RE.is_match(value) {
        errors.add(field, "Invalid email address");
    }
}

pub fn validate_optional_url(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !value.is_empty() && url::Url::parse(value).is_err() {
        errors.add(field, "Invalid URL");
    }
}

pub fn validate_hex_color(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !HEX_COLOR_RE.is_match(value) {
        errors.add(field, "Must be a valid hex color (#RRGGBB)");
    }
}

pub fn validate_optional_pincode(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !value.is_empty() && !PINCODE_RE.is_match(value) {
        errors.add(field, "PIN code must be 4-10 digits");
    }
}

pub fn validate_optional_phone(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !value.is_empty() && !PHONE_RE.is_match(value) {
        errors.add(
            field,
            "Phone must contain only digits, +, -, spaces, and parentheses",
        );
    }
}

pub fn validate_prefix(errors: &mut ValidationErrors, field: &str, value: &str) {
    if value.len() > 10 {
        errors.add(field, "Prefix must be at most 10 characters");
    } else if !PREFIX_RE.is_match(value) {
        errors.add(field, "Prefix must be alphanumeric with optional hyphens");
    }
}

/// A sequence's minimum digit count: 0 (no padding, plain 1, 2, 3) to 10,
/// matching the `chk_sequences_pad_width` check.
pub fn validate_pad_width(errors: &mut ValidationErrors, field: &str, value: i32) {
    if !(0..=10).contains(&value) {
        errors.add(field, "Pad width must be between 0 and 10");
    }
}

pub fn validate_form_code(errors: &mut ValidationErrors, field: &str, value: &str) {
    if value.len() < 2 {
        errors.add(field, "Code must be at least 2 characters");
    } else if value.len() > 100 {
        errors.add(field, "Code must be at most 100 characters");
    } else if !FORM_CODE_RE.is_match(value) {
        errors.add(
            field,
            "Code must start with a lowercase letter and contain only lowercase letters, digits, dots, and underscores",
        );
    }
}

/// Reject strings containing HTML tags to prevent stored XSS via admin-authored content.
pub fn validate_no_html(errors: &mut ValidationErrors, field: &str, value: &str) {
    if HTML_TAG_RE.is_match(value) {
        errors.add(field, "HTML tags are not allowed");
    }
}

/// Validate that a value is a known Mantine color name.
/// Prevents CSS injection through section/field color properties.
const MANTINE_COLORS: &[&str] = &[
    "dark", "gray", "red", "pink", "grape", "violet", "indigo", "blue", "cyan", "teal", "green",
    "lime", "yellow", "orange",
];

pub fn validate_mantine_color(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !MANTINE_COLORS.contains(&value) {
        errors.add(
            field,
            "Must be a valid Mantine color name (e.g., red, blue, green)",
        );
    }
}

/// Validate that an action endpoint only points to internal API routes.
pub fn validate_api_endpoint(errors: &mut ValidationErrors, field: &str, value: &str) {
    if !API_ENDPOINT_RE.is_match(value) {
        errors.add(
            field,
            "Endpoint must start with /api/ and contain only lowercase letters, digits, hyphens, underscores, and slashes",
        );
    }
}

#[cfg(test)]
mod password_tests {
    use super::{PasswordCheck, ValidationErrors, validate_password};

    /// Whether `validate_password` rejects `check`.
    fn refused<'a>(check: impl Into<PasswordCheck<'a>>) -> bool {
        let mut errors = ValidationErrors::new();
        validate_password(&mut errors, "password", check);
        errors.has_errors()
    }

    /// Whether a password is rejected with no username or hospital to compare.
    fn refused_alone(password: &str) -> bool {
        refused(password)
    }

    #[test]
    fn pad_width_zero_to_ten_accepted() {
        let refused = |v| {
            let mut errors = ValidationErrors::new();
            super::validate_pad_width(&mut errors, "pad_width", v);
            errors.has_errors()
        };
        assert!(!refused(0) && !refused(10));
        assert!(refused(-1) && refused(11));
    }

    #[test]
    fn eleven_characters_refused_twelve_accepted() {
        assert!(refused_alone("Kq7#vLm2pXz"));
        assert!(!refused_alone("Kq7#vLm2pXzw"));
    }

    #[test]
    fn length_counts_characters_not_bytes() {
        // 11 characters but 21 bytes: byte length would have passed it.
        assert!(refused_alone("Ünïcødé#9Ab"));
        assert!(!refused_alone("Ünïcødé#9Abc"));
    }

    #[test]
    fn longer_than_128_refused() {
        let long = format!("Aa1#{}", "x".repeat(125));
        assert!(refused_alone(&long));
    }

    #[test]
    fn common_passwords_refused() {
        assert!(refused_alone("password123456"));
        assert!(refused_alone("Password@123"));
        assert!(refused_alone("Password@123456"));
        assert!(refused_alone("Iloveyou@2024"));
    }

    #[test]
    fn password_holding_username_refused() {
        assert!(refused(("Xy#DrMeena2049", "drmeena")));
        assert!(!refused_alone("Xy#DrMeena2049"));
    }

    #[test]
    fn password_holding_hospital_name_or_code_refused() {
        let base = PasswordCheck::from("Sample-Care#2049x");
        assert!(refused(PasswordCheck {
            hospital_code: "SAMPLE",
            ..base
        }));
        assert!(refused(PasswordCheck {
            hospital_name: "Sample Care",
            ..base
        }));
        assert!(!refused(base));
    }

    #[test]
    fn short_context_is_ignored() {
        let check = PasswordCheck {
            hospital_code: "AB",
            ..PasswordCheck::from("Tab#lets9Zqwx")
        };
        assert!(!refused(check));
    }
}
