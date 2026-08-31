//! Force a rebuild when the migration directory changes.
//!
//! `sqlx::migrate!` is a proc macro, and on stable Rust proc macros cannot
//! register file dependencies (`proc_macro::tracked_path` is nightly-only).
//! Without this, cargo has no idea the crate depends on `src/migrations`, so
//! adding a migration does NOT recompile — and the new SQL is simply absent
//! from the binary. `cargo build` succeeds, the deploy succeeds, and the
//! schema change quietly never happens.
//!
//! Measured 2026-08-31 before this file existed: adding a migration and
//! changing one both recompiled nothing.
//!
//! This mattered less while migrations lived in `medbrains-db`, which 109
//! crates depend on and which therefore rebuilt often enough to mask it.
//! Isolating migrations removed that accidental cover, which is why the
//! guard has to be explicit now.
fn main() {
    println!("cargo:rerun-if-changed=src/migrations");
}
