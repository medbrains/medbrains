//! The startup checks' report: what the server found about its own setup when
//! it booted. Written once by `medbrains-server`, read by the infrastructure
//! screen, so an administrator sees the same findings the log printed.

use std::sync::OnceLock;

use serde::Serialize;

/// How bad a finding is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Level {
    Ok,
    /// Works, but should be fixed; never stops a boot.
    Warn,
    /// Unsafe to serve patients. Stops a production boot.
    Fail,
}

/// One check's answer.
#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    /// Stable id, e.g. `env.identifier_key`.
    pub check: &'static str,
    pub level: Level,
    /// What was found, in words an operator can act on.
    pub detail: String,
    /// How to fix it, when it is not `Ok`.
    pub fix: Option<&'static str>,
}

impl Finding {
    #[must_use]
    pub fn ok(check: &'static str, detail: impl Into<String>) -> Self {
        Self { check, level: Level::Ok, detail: detail.into(), fix: None }
    }

    #[must_use]
    pub fn warn(check: &'static str, detail: impl Into<String>, fix: &'static str) -> Self {
        Self { check, level: Level::Warn, detail: detail.into(), fix: Some(fix) }
    }

    #[must_use]
    pub fn fail(check: &'static str, detail: impl Into<String>, fix: &'static str) -> Self {
        Self { check, level: Level::Fail, detail: detail.into(), fix: Some(fix) }
    }
}

static REPORT: OnceLock<Vec<Finding>> = OnceLock::new();

/// Keep this boot's findings for the infrastructure screen. Later calls are
/// ignored: the report describes the boot, not the present moment.
pub fn record(findings: Vec<Finding>) {
    let _ = REPORT.set(findings);
}

/// This boot's findings; empty before the checks have run.
#[must_use]
pub fn report() -> &'static [Finding] {
    REPORT.get().map_or(&[], Vec::as_slice)
}
