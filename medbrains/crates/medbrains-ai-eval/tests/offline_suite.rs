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

#[test]
fn a_long_conversation_sends_only_the_recent_messages() {
    use medbrains_ai_eval::{Case, Prepared};
    use medbrains_core::ai_guard::HISTORY_MESSAGES;
    let cases = Case::load_all(&default_cases_dir()).unwrap_or_default();
    let long = cases.iter().find(|c| c.id.starts_with("24-"));
    assert!(long.is_some_and(|c| c.history.len() > usize::from(HISTORY_MESSAGES)));
    let Some(Prepared::Send(r)) = long.map(Case::prepare) else {
        unreachable!("case 24 must be sent");
    };
    assert_eq!(r.history.len(), usize::from(HISTORY_MESSAGES));
    let first = r.history_lines().into_iter().next().unwrap_or_default();
    assert!(first.starts_with("User: Has billing"), "{first}");
}
