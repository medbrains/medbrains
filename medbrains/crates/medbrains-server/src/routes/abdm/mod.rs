//! ABDM (Ayushman Bharat Digital Mission) integration routes.
//!
//! Phase 11 of the hybrid roadmap.
//! - `hfr` — Health Facility Registry, one HFR ID per campus.
//! - `hpr` — Healthcare Professionals Registry IDs on doctor profiles.
//! - `hip_relay` — Cloud-side relay for ABDM gateway callbacks.
//!   The gateway POSTs here with NHCX results +
//!   HIE bundle requests; we forward to the on-prem
//!   server over the Headscale tailnet.

pub mod abha;
pub mod abha_account;
pub mod abha_address;
pub mod abha_card;
pub mod abha_common;
pub mod abha_enrol;
pub mod abha_link;
pub mod abha_verify;
pub mod hfr;
pub mod hip_relay;
pub mod settings;
pub mod hpr;
mod registry_access;
pub mod signature;
