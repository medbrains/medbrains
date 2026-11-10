//! The packages this release ships, for the dependency check: every registry
//! crate in `Cargo.lock` and every npm package in `pnpm-lock.yaml`, one
//! `ecosystem<TAB>name<TAB>version` line each. Extracted here so the binary
//! carries a few kilobytes, not the lockfiles.
#![allow(clippy::print_stdout)]

use std::error::Error;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

const CARGO_LOCK: &str = "../../Cargo.lock";
const PNPM_LOCK: &str = "../../pnpm-lock.yaml";

fn cargo_packages(lock: &str, out: &mut String) -> Result<(), Box<dyn Error>> {
    for block in lock.split("[[package]]").skip(1) {
        let field = |name: &str| {
            block.lines().find_map(|l| {
                l.strip_prefix(name)
                    .and_then(|rest| rest.strip_prefix(" = \""))
                    .and_then(|rest| rest.strip_suffix('"'))
            })
        };
        let from_registry = field("source").is_some_and(|s| s.starts_with("registry+"));
        if let (true, Some(name), Some(version)) = (from_registry, field("name"), field("version"))
        {
            writeln!(out, "crates.io\t{name}\t{version}")?;
        }
    }
    Ok(())
}

/// `packages:` keys look like `  '@scope/name@1.2.3':` or `  name@1.2.3:`.
fn npm_packages(lock: &str, out: &mut String) -> Result<(), Box<dyn Error>> {
    let Some(section) = lock.split("\npackages:\n").nth(1) else {
        return Ok(());
    };
    for line in section.lines() {
        if !line.starts_with(' ') && !line.is_empty() {
            break;
        }
        let Some(key) = line.strip_prefix("  ").filter(|k| !k.starts_with(' ')) else {
            continue;
        };
        let key = key.trim_end_matches(':').trim_matches('\'');
        let key = key.split('(').next().unwrap_or(key);
        if let Some((name, version)) = key.rsplit_once('@').filter(|(n, _)| !n.is_empty()) {
            writeln!(out, "npm\t{name}\t{version}")?;
        }
    }
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    println!("cargo:rerun-if-changed={CARGO_LOCK}");
    println!("cargo:rerun-if-changed={PNPM_LOCK}");
    let mut out = String::new();
    cargo_packages(&fs::read_to_string(CARGO_LOCK)?, &mut out)?;
    // The npm lockfile is absent from a Rust-only checkout; the check then
    // covers the crates it can see and says so in its report.
    if let Ok(lock) = fs::read_to_string(PNPM_LOCK) {
        npm_packages(&lock, &mut out)?;
    }
    fs::write(
        Path::new(&std::env::var("OUT_DIR")?).join("packages.tsv"),
        out,
    )?;
    Ok(())
}
