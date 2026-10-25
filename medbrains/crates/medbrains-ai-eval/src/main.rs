//! `medbrains-ai-eval [--live] [--record] [--only 03,17]`
//!
//! Offline by default (recorded answers, no key, no network). `--live` asks
//! the model on the synthetic cases; `--record` also saves its answers as the
//! new recordings. `--only` runs the cases whose id starts with one of the
//! comma-separated prefixes (re-record just the cases a change touched).
//! Exits 1 on an unexpected result.

use std::io::Write as _;
use std::process::ExitCode;

use medbrains_ai_eval::default_cases_dir;
use medbrains_ai_eval::live::Provider;
use medbrains_ai_eval::report::{Mode, render, run};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let has = |flag: &str| args.iter().any(|a| a == flag);
    let mut out = std::io::stdout().lock();
    let mode = if has("--live") || has("--record") {
        match Provider::detect() {
            Ok(provider) => Mode::Live {
                provider,
                record: has("--record"),
            },
            Err(why) => {
                let _ = writeln!(out, "eval-ai-live skipped: {why}");
                return ExitCode::SUCCESS;
            }
        }
    } else {
        Mode::Offline
    };
    let only: Vec<String> = args
        .iter()
        .position(|a| a == "--only")
        .and_then(|i| args.get(i + 1))
        .map(|v| v.split(',').map(str::to_owned).collect())
        .unwrap_or_default();
    match run(&default_cases_dir(), mode, &only) {
        Ok(results) => {
            let _ = write!(out, "{}", render(&results));
            if results
                .iter()
                .any(medbrains_ai_eval::report::CaseResult::is_unexpected)
            {
                ExitCode::FAILURE
            } else {
                ExitCode::SUCCESS
            }
        }
        Err(e) => {
            let _ = writeln!(std::io::stderr(), "eval-ai: {e}");
            ExitCode::FAILURE
        }
    }
}
