//! Running the suite and reporting it: per case pass/fail with the rule that
//! failed, then a summary with tokens and cost per passing case.

use std::fmt::Write as _;
use std::path::Path;

use crate::graders::{Failure, grade};
use crate::live::{Provider, cost};
use crate::{Answer, Case, Prepared, recording_path};

/// Where answers come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Recorded answers only — no key, no network.
    Offline,
    /// Ask the model; `record` also writes the answers as the new recordings.
    Live { provider: Provider, record: bool },
}

/// One case's result.
#[derive(Debug, Clone)]
pub struct CaseResult {
    pub id: String,
    pub task: String,
    pub failures: Vec<Failure>,
    pub known_failure: Option<String>,
    pub answer: Option<Answer>,
}

impl CaseResult {
    /// Failed where it was expected to pass, or passed where a known failure
    /// is marked (the mark must then be removed).
    #[must_use]
    pub const fn is_unexpected(&self) -> bool {
        self.failures.is_empty() == self.known_failure.is_some()
    }
}

/// Run every case in `dir`.
///
/// # Errors
/// The cases cannot be loaded, or a recording cannot be read or written.
pub fn run(dir: &Path, mode: Mode) -> Result<Vec<CaseResult>, String> {
    Case::load_all(dir)?
        .iter()
        .map(|case| run_case(dir, case, mode))
        .collect()
}

fn run_case(dir: &Path, case: &Case, mode: Mode) -> Result<CaseResult, String> {
    let prepared = case.prepare();
    let answer = match (&prepared, mode) {
        (Prepared::Send(_), Mode::Offline) => recorded(dir, &case.id)?,
        (Prepared::Send(request), Mode::Live { provider, record }) => {
            let a = provider
                .ask(request)
                .map_err(|e| format!("{}: {e}", case.id))?;
            if record {
                let json = serde_json::to_string_pretty(&a).map_err(|e| e.to_string())?;
                std::fs::write(recording_path(dir, &case.id), json + "\n")
                    .map_err(|e| format!("{}: {e}", case.id))?;
            }
            Some(a)
        }
        _ => None,
    };
    Ok(CaseResult {
        id: case.id.clone(),
        task: case.task.clone(),
        failures: grade(case, &prepared, answer.as_ref()),
        known_failure: case.known_failure.clone(),
        answer,
    })
}

fn recorded(dir: &Path, id: &str) -> Result<Option<Answer>, String> {
    let path = recording_path(dir, id);
    if !path.exists() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{id}: {e}"))?;
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|e| format!("{id}: {e}"))
}

/// The report, as Markdown.
#[must_use]
pub fn render(results: &[CaseResult]) -> String {
    let mut s = String::from("| case | task | result | failing rules |\n|---|---|---|---|\n");
    for r in results {
        let status = match (r.failures.is_empty(), &r.known_failure, r.is_unexpected()) {
            (true, None, _) => "pass",
            (false, Some(_), false) => "known fail",
            (true, Some(_), _) => "FIXED (remove known_failure)",
            _ => "FAIL",
        };
        let rules: Vec<String> = r
            .failures
            .iter()
            .map(|f| format!("{}: {}", f.rule, f.detail.replace('|', "/")))
            .collect();
        let _ = writeln!(
            s,
            "| {} | {} | {status} | {} |",
            r.id,
            r.task,
            rules.join("; ")
        );
    }
    s.push('\n');
    s.push_str(&summary(results));
    s
}

fn summary(results: &[CaseResult]) -> String {
    let passed = results.iter().filter(|r| r.failures.is_empty()).count();
    let known = results
        .iter()
        .filter(|r| !r.failures.is_empty() && r.known_failure.is_some())
        .count();
    let unexpected = results.iter().filter(|r| r.is_unexpected()).count();
    let answers: Vec<&Answer> = results.iter().filter_map(|r| r.answer.as_ref()).collect();
    let tin: u64 = answers.iter().map(|a| a.input_tokens).sum();
    let tout: u64 = answers.iter().map(|a| a.output_tokens).sum();
    let usd = answers.iter().map(|a| cost(a)).fold(0.0, |s, c| s + c);
    let per_pass = if passed == 0 {
        "n/a".to_owned()
    } else {
        let p = usd / passed as f64;
        format!("${p:.5}")
    };
    let models: Vec<&str> = {
        let mut m: Vec<&str> = answers.iter().map(|a| a.model.as_str()).collect();
        m.sort_unstable();
        m.dedup();
        m
    };
    format!(
        "| cases | pass | known fail | unexpected | tokens in/out | est. cost | cost per pass | model |\n\
         |---|---|---|---|---|---|---|---|\n\
         | {} | {passed} | {known} | {unexpected} | {tin}/{tout} | ${usd:.4} | {per_pass} | {} |\n",
        results.len(),
        models.join(", "),
    )
}
