//! Signed A/B updates for MedBrains OS (`docs/architecture/OS-UPDATES.md`). Class A code under
//! `docs/OS-PRINCIPLES.md` section 7: the failure table is in that document.
//!
//! systemd-boot and `systemd-bless-boot` do the boot counting and the falling back. This crate does what
//! they don't: checks a signature with a key in the image, refuses old versions, verifies before writing,
//! and waits for a person or a quiet window. `systemd-sysupdate` was measured and not used (DECISIONS).

pub mod boot;
pub mod child;
pub mod disk;
pub mod gpt;
pub mod install;
pub mod manifest;
pub mod owners;
pub mod paths;
pub mod pe;
pub mod plan;
pub mod seal;
pub mod source;
pub mod state;
pub mod steps;
pub mod verity;
pub mod version;
pub mod view;
