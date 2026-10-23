//! ABDM (Ayushman Bharat Digital Mission) integration routes.
//!
//! Phase 11 of the hybrid roadmap.
//! - `bridge` — where ABDM delivers callbacks, and which campuses it serves.
//! - `dashboard` — the management dashboard; `dhis` — the incentive rules.
//! - `hfr` — Health Facility Registry, one HFR ID per campus.
//! - `hpr` — Healthcare Professionals Registry IDs on doctor profiles.
//! - `hip` — ABDM Milestone 2: this hospital as a Health Information Provider.
//! - `hiu` — ABDM Milestone 3: this hospital as a Health Information User.
//! - `scan_share` — Scan & Share: counter QR codes and the desk's queue of
//!   shared ABHA profiles (the gateway side is `hip::profile_share`).
//! - `hip_relay` — Cloud-side relay: verified gateway callbacks kept for the
//!   on-premises server to pull.

pub mod abha;
pub mod abha_account;
pub mod abha_address;
pub mod abha_card;
pub mod abha_common;
pub mod abha_enrol;
mod abha_find;
pub mod abha_optout;
pub mod abha_profile;
pub mod abha_qr;
pub mod abha_link;
pub mod abha_verify;
pub mod bridge;
mod bridge_rules;
pub mod dashboard;
pub mod dhis;
pub mod hfr;
pub mod hip;
pub mod hiu;
pub mod mental_health_sharing;
pub mod hip_relay;
pub mod scan_share;
pub mod settings;
pub mod hpr;
mod registry_access;
