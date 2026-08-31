//! Aggregates over `EXTRACT(EPOCH ...)` must say what type they return.
//!
//!   cargo test -p medbrains-db -- --ignored
//!
//! PostgreSQL 14 changed `EXTRACT` from `double precision` to `numeric`, and
//! `AVG(numeric)` is `numeric`. Any column written before that and decoded as
//! `f64` fails at run time, not at build time:
//!
//!     error occurred while decoding column "avg_wait_minutes": mismatched
//!     types; Rust type `Option<f64>` (as SQL type `FLOAT8`) is not
//!     compatible with SQL type `NUMERIC`
//!
//! The queries are built as runtime strings, so nothing checks them until
//! somebody opens the screen. This scans the source instead.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::print_stderr
)]

use std::path::{Path, PathBuf};

/// Casts that settle the type, whichever one a column wanted.
const CASTS: &[&str] = &[
    "::float8",
    "::FLOAT8",
    "::double precision",
    "::DOUBLE PRECISION",
    "::bigint",
    "::BIGINT",
    "::int",
    "::INT",
    "::numeric",
    "::NUMERIC",
];

fn crates_root() -> PathBuf {
    // From `crates/medbrains-db` up to the workspace, then back down.
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("crates directory")
        .to_path_buf()
}

fn rust_sources(dir: &Path, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if path.file_name().is_some_and(|n| n == "target") {
                continue;
            }
            rust_sources(&path, found);
        } else if path.extension().is_some_and(|e| e == "rs") {
            found.push(path);
        }
    }
}

/// Flatten a SQL string literal's line continuations and whitespace.
fn flatten(window: &str) -> String {
    let joined = window.replace("\\\n", " ");
    joined.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[test]
fn every_epoch_aggregate_says_what_type_it_returns() {
    let mut sources = Vec::new();
    rust_sources(&crates_root(), &mut sources);
    assert!(!sources.is_empty(), "found no sources to scan");

    let mut uncast = Vec::new();
    for path in &sources {
        let Ok(src) = std::fs::read_to_string(path) else {
            continue;
        };
        if !src.contains("EXTRACT(EPOCH") {
            continue;
        }

        for (start, _) in src.match_indices("EXTRACT(EPOCH") {
            // Only aggregates: a bare EXTRACT is decoded wherever it lands and
            // is not the pattern that broke.
            let before = &src[start.saturating_sub(24)..start];
            if !before.contains("AVG(") && !before.contains("SUM(") {
                continue;
            }

            let end = (start + 400).min(src.len());
            let flat = flatten(&src[start..end]);
            let Some(alias_at) = flat.find(" AS ") else {
                continue;
            };
            let head = &flat[..alias_at];
            if CASTS.iter().any(|cast| head.contains(cast)) {
                continue;
            }

            let alias: String = flat[alias_at + 4..]
                .split_whitespace()
                .next()
                .unwrap_or("?")
                .to_owned();
            uncast.push(format!(
                "{}: {alias}",
                path.strip_prefix(crates_root()).unwrap_or(path).display()
            ));
        }
    }

    assert!(
        uncast.is_empty(),
        "these aggregate over EXTRACT(EPOCH ...) with no cast, so PostgreSQL \
         returns numeric and decoding into f64 fails at run time:\n  {}",
        uncast.join("\n  ")
    );
}
