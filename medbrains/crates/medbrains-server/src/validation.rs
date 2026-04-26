use std::collections::HashMap;

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

pub fn validate_password(errors: &mut ValidationErrors, field: &str, value: &str) {
    if value.len() < 8 {
        errors.add(field, "Password must be at least 8 characters");
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

pub fn validate_pad_width(errors: &mut ValidationErrors, field: &str, value: i32) {
    if !(3..=10).contains(&value) {
        errors.add(field, "Pad width must be between 3 and 10");
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
