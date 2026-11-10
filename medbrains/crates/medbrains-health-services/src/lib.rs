//! `medbrains-health-services`: what the hospital layer adds on top of the kernel.
//!
//! RFC-HOSPITAL-OS §3a. The kernel knows nothing about patients; this crate
//! does, and it reaches the database only through the kernel's unit of work
//! (`medbrains_kernel::Tx`), the way any app does.
//!
//! Consent answers `Allow`, `Deny` or `Unknown`, never a boolean, so an outage
//! cannot read as a refusal or a grant.

pub mod consent;
pub mod patient;
