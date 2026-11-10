//! Running the suite and reporting it: per case pass/fail with the rule that
//! failed, its tokens (cache reads/writes apart) and model time, then a
//! summary with cost per passing case and p50/p95 per stage.

use std::fmt::Write as _;
use std::path::Path;
use std::time::{Duration, Instant};

use crate::graders::{Failure, grade};
use crate::live::{Provider, Timing, cost};
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
    pub stages: Stages,
}

/// Wall time per harness stage for one case.
#[derive(Debug, Clone, Copy, Default)]
pub struct Stages {
    /// Building the request through the redactor.
    pub prepare: Duration,
    /// The provider call, auth apart (zero offline).
    pub call: Timing,
    /// The answer guard and the graders.
    pub grade: Duration,
}

impl CaseResult {
    /// Failed where it was expected to pass, or passed where a known failure
    /// is marked (the mark must then be removed).
    #[must_use]
    pub const fn is_unexpected(&self) -> bool {
        self.failures.is_empty() == self.known_failure.is_some()
    }
}

/// Run every case in `dir`, or only those whose id starts with one of `only`.
///
/// # Errors
/// The cases cannot be loaded, or a recording cannot be read or written.
pub fn run(dir: &Path, mode: Mode, only: &[String]) -> Result<Vec<CaseResult>, String> {
    Case::load_all(dir)?
        .iter()
        .filter(|c| only.is_empty() || only.iter().any(|o| c.id.starts_with(o.as_str())))
        .map(|case| run_case(dir, case, mode))
        .collect()
}

fn run_case(dir: &Path, case: &Case, mode: Mode) -> Result<CaseResult, String> {
    let mut stages = Stages::default();
    let started = Instant::now();
    let prepared = case.prepare();
    stages.prepare = started.elapsed();
    let answer = match (&prepared, mode) {
        (Prepared::Send(_), Mode::Offline) => recorded(dir, &case.id)?,
        (Prepared::Send(request), Mode::Live { provider, record }) => {
            let (a, call) = provider
                .ask(request)
                .map_err(|e| format!("{}: {e}", case.id))?;
            stages.call = call;
            if record {
                let json = serde_json::to_string_pretty(&a).map_err(|e| e.to_string())?;
                std::fs::write(recording_path(dir, &case.id), json + "\n")
                    .map_err(|e| format!("{}: {e}", case.id))?;
            }
            Some(a)
        }
        _ => None,
    };
    let started = Instant::now();
    let failures = grade(case, &prepared, answer.as_ref());
    stages.grade = started.elapsed();
    Ok(CaseResult {
        id: case.id.clone(),
        task: case.task.clone(),
        failures,
        known_failure: case.known_failure.clone(),
        answer,
        stages,
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
    let mut s = String::from(
        "| case | task | result | tokens in/out | cache read/write | model ms | failing rules |\n\
         |---|---|---|---|---|---|---|\n",
    );
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
        let (tokens, cache) = r.answer.as_ref().map_or_else(
            || ("-".to_owned(), "-".to_owned()),
            |a| {
                (
                    format!("{}/{}", a.input_tokens, a.output_tokens),
                    format!("{}/{}", a.cache_read_tokens, a.cache_write_tokens),
                )
            },
        );
        let _ = writeln!(
            s,
            "| {} | {} | {status} | {tokens} | {cache} | {} | {} |",
            r.id,
            r.task,
            r.stages.call.model.as_millis(),
            rules.join("; ")
        );
    }
    s.push('\n');
    s.push_str(&summary(results));
    s.push('\n');
    s.push_str(&latency(results));
    s
}

/// p50/p95 per stage, over the cases that ran it.
fn latency(results: &[CaseResult]) -> String {
    let stage = |f: &dyn Fn(&Stages) -> Option<Duration>| -> Vec<Duration> {
        let mut v: Vec<Duration> = results.iter().filter_map(|r| f(&r.stages)).collect();
        v.sort_unstable();
        v
    };
    let called = |d: Duration| (!d.is_zero()).then_some(d);
    let rows: [(&str, Vec<Duration>); 5] = [
        ("prepare (redact)", stage(&|s| Some(s.prepare))),
        ("auth (token)", stage(&|s| called(s.call.auth))),
        ("model (wall)", stage(&|s| called(s.call.model))),
        ("model (provider-reported)", stage(&|s| s.call.provider)),
        ("grade (guard + graders)", stage(&|s| Some(s.grade))),
    ];
    let mut s = String::from("| stage | n | p50 ms | p95 ms |\n|---|---|---|---|\n");
    for (name, v) in rows.iter().filter(|(_, v)| !v.is_empty()) {
        let _ = writeln!(
            s,
            "| {name} | {} | {:.1} | {:.1} |",
            v.len(),
            ms(percentile(v, 50)),
            ms(percentile(v, 95)),
        );
    }
    s
}

/// Nearest-rank percentile of a sorted, non-empty list.
fn percentile(sorted: &[Duration], p: usize) -> Duration {
    let rank = (sorted.len() * p).div_ceil(100).max(1);
    sorted.get(rank - 1).copied().unwrap_or_default()
}

fn ms(d: Duration) -> f64 {
    d.as_secs_f64() * 1000.0
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
    let read: u64 = answers.iter().map(|a| a.cache_read_tokens).sum();
    let write: u64 = answers.iter().map(|a| a.cache_write_tokens).sum();
    // One answer from a model with no known price makes the total unknown.
    let usd: Option<f64> = answers.iter().map(|a| cost(a)).sum();
    let (total, per_pass) = match usd {
        None => ("unknown".to_owned(), "unknown".to_owned()),
        Some(usd) if passed == 0 => (format!("${usd:.4}"), "n/a".to_owned()),
        Some(usd) => (format!("${usd:.4}"), format!("${:.5}", usd / passed as f64)),
    };
    let models: Vec<&str> = {
        let mut m: Vec<&str> = answers.iter().map(|a| a.model.as_str()).collect();
        m.sort_unstable();
        m.dedup();
        m
    };
    format!(
        "| cases | pass | known fail | unexpected | tokens in/out | cache read/write | est. cost | cost per pass | model |\n\
         |---|---|---|---|---|---|---|---|---|\n\
         | {} | {passed} | {known} | {unexpected} | {tin}/{tout} | {read}/{write} | {total} | {per_pass} | {} |\n",
        results.len(),
        models.join(", "),
    )
}

#[cfg(test)]
mod tests {
    use super::percentile;
    use std::time::Duration;

    #[test]
    fn percentiles_are_nearest_rank() {
        let v: Vec<Duration> = (1..=20).map(Duration::from_millis).collect();
        assert_eq!(percentile(&v, 50), Duration::from_millis(10));
        assert_eq!(percentile(&v, 95), Duration::from_millis(19));
        assert_eq!(percentile(&v[..1], 95), Duration::from_millis(1));
    }
}
