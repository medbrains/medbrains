//! Which crates reach the core only through this facade, for Admin → Kernel.
//!
//! Read from `boundary.txt`, the baseline `scripts/check_kernel_boundary.py`
//! computes from the code and CI holds to it — so the page shows exactly what
//! CI enforces, from one source. A crate is `on_facade` (kernel only),
//! `partial` (kernel plus direct access) or `not_yet` (no kernel).
#![allow(clippy::print_stdout)]

use std::error::Error;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

fn main() -> Result<(), Box<dyn Error>> {
    println!("cargo:rerun-if-changed=boundary.txt");
    let baseline = fs::read_to_string("boundary.txt")?;
    let mut out = String::from("&[\n");
    for line in baseline
        .lines()
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
    {
        let mut cols = line.split_whitespace();
        let (Some(name), Some(status)) = (cols.next(), cols.next()) else {
            return Err(format!("boundary.txt: malformed line '{line}'").into());
        };
        writeln!(out, "    ({name:?}, {status:?}),")?;
    }
    out.push(']');
    fs::write(
        Path::new(&std::env::var("OUT_DIR")?).join("facade_crates.rs"),
        out,
    )?;
    Ok(())
}
