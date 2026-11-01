//! What a check returns.

use serde::Serialize;
use serde_json::Value;

/// How bad a finding is, in the words the screen shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }
}

/// One thing a check found. `(asset, key)` identifies it within its check, so
/// the same problem found again merges instead of adding a row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Found {
    pub asset: String,
    pub key: String,
    pub title: String,
    pub severity: Severity,
    pub evidence: Value,
    pub how_to_fix: String,
    pub cve_id: Option<String>,
}

/// A successful run.
#[derive(Debug, Clone, Default)]
pub struct Report {
    pub findings: Vec<Found>,
    /// What the screen shows about the run beyond its findings.
    pub detail: Value,
    /// False when the check does not apply here (e.g. not a Debian host):
    /// recorded as `not_applicable`, never as a clean pass.
    pub not_applicable: bool,
}

impl Report {
    #[must_use]
    pub const fn found(findings: Vec<Found>, detail: Value) -> Self {
        Self {
            findings,
            detail,
            not_applicable: false,
        }
    }

    #[must_use]
    pub fn not_applicable(why: &str) -> Self {
        Self {
            findings: Vec::new(),
            detail: serde_json::json!({ "reason": why }),
            not_applicable: true,
        }
    }
}

/// A run that could not finish. Recorded as an `error` heartbeat; the screen
/// shows "could not check", never "nothing found".
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CheckError(pub String);

impl std::fmt::Display for CheckError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<sqlx::Error> for CheckError {
    fn from(e: sqlx::Error) -> Self {
        Self(format!("database: {e}"))
    }
}

impl From<medbrains_kernel::AppError> for CheckError {
    fn from(e: medbrains_kernel::AppError) -> Self {
        Self(e.to_string())
    }
}
