//! Which crates already reach the kernel only through this facade.
//!
//! Computed from the manifests at build time rather than kept as a list, so
//! the Kernel page cannot drift from the code. A crate is:
//!
//! - `on_facade`: depends on `medbrains-kernel` and not on `medbrains-db` or
//!   `medbrains-authz` directly;
//! - `partial`: depends on the kernel but still reaches past it;
//! - `not_yet`: does not use the kernel at all.
//!
//! The kernel's own dependencies are its building blocks, not apps, and are
//! left out. K2 turns this same rule into a CI ratchet.
#![allow(clippy::print_stdout)]

use std::error::Error;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

fn has_dep(manifest: &str, name: &str) -> bool {
    manifest.lines().any(|line| {
        let line = line.trim_start();
        line.strip_prefix(name)
            .is_some_and(|rest| rest.trim_start().starts_with('='))
    })
}

fn status(manifest: &str) -> &'static str {
    let direct = has_dep(manifest, "medbrains-db") || has_dep(manifest, "medbrains-authz");
    match (has_dep(manifest, "medbrains-kernel"), direct) {
        (true, false) => "on_facade",
        (true, true) => "partial",
        (false, _) => "not_yet",
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")?;
    let own = fs::read_to_string(Path::new(&manifest_dir).join("Cargo.toml"))?;
    let crates_dir = Path::new(&manifest_dir).join("..");
    println!("cargo:rerun-if-changed=../../Cargo.toml");

    let mut rows: Vec<(String, &'static str)> = Vec::new();
    for entry in fs::read_dir(&crates_dir)? {
        let name = entry?.file_name().to_string_lossy().into_owned();
        let path = crates_dir.join(&name).join("Cargo.toml");
        if !name.starts_with("medbrains-") || name == "medbrains-kernel" || !path.exists() {
            continue;
        }
        println!("cargo:rerun-if-changed=../{name}/Cargo.toml");
        if has_dep(&own, &name) {
            continue;
        }
        rows.push((name, status(&fs::read_to_string(&path)?)));
    }
    rows.sort();

    let mut out = String::from("&[\n");
    for (name, state) in &rows {
        writeln!(out, "    ({name:?}, {state:?}),")?;
    }
    out.push(']');
    fs::write(
        Path::new(&std::env::var("OUT_DIR")?).join("facade_crates.rs"),
        out,
    )?;
    Ok(())
}
