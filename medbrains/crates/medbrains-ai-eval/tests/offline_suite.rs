//! The CI gate: every golden case, replayed from its recording, ends as the
//! case says — a pass, or a failure already recorded as a finding.

use medbrains_ai_eval::default_cases_dir;
use medbrains_ai_eval::report::{Mode, render, run};

#[test]
fn every_golden_case_holds_offline() {
    let results = run(&default_cases_dir(), Mode::Offline, &[]);
    assert!(results.is_ok(), "{results:?}");
    let results = results.unwrap_or_default();
    assert!(results.len() >= 20, "the suite shrank to {}", results.len());
    let unexpected: Vec<&str> = results
        .iter()
        .filter(|r| r.is_unexpected())
        .map(|r| r.id.as_str())
        .collect();
    assert!(
        unexpected.is_empty(),
        "unexpected: {unexpected:?}\n{}",
        render(&results)
    );
}
