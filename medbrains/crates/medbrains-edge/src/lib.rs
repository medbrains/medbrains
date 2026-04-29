//! # medbrains-edge
//!
//! Offline-first edge sync for MedBrains hospital deployments.
//!
//! Runs on a small box inside the hospital DC (a NUC, a Raspberry Pi 5,
//! a hypervisor VM — anything with 2 GB RAM). When the WAN goes down
//! or the hospital LAN is partitioned, devices keep writing locally;
//! when the network heals, edits replicate without conflict via
//! [Loro](https://loro.dev) CRDTs.
//!
//! ## Deployment topology
//!
//! ```text
//! ┌─────────────────────────── HOSPITAL LAN ──────────────────────────┐
//! │                                                                   │
//! │  Doctor tablets ──┐                                               │
//! │  Nurse stations ──┼──► medbrains-edge (this crate)                │
//! │  Reception PCs ───┘    + Loro doc store on disk                   │
//! │                        + mDNS service registration                │
//! │                        + WSS sync server on :7811                 │
//! │                                                                   │
//! │  When WAN is up: medbrains-edge bridges sync ops to               │
//! │                  medbrains-server in cloud                        │
//! │  When WAN is down: medbrains-edge keeps the LAN in sync alone     │
//! └───────────────────────────────────────────────────────────────────┘
//! ```
//!
//! ## Tier classification
//!
//! Not every table fits a CRDT. Three tiers:
//!
//! - **T1 — server-authoritative.** Money, scheduling, prescriptions
//!   that must NOT have last-write-wins semantics. The edge node does
//!   NOT generate these locally during outages; clients see a
//!   read-only banner and queue the intent in an outbox that drains
//!   on reconnect with operator confirmation. Examples:
//!   `billing_invoices`, `pharmacy_dispenses`, `prescription_orders`.
//!
//! - **T2 — append-only CRDT.** Pure event streams that never get
//!   edited after the fact. Last-write-wins is fine because there are
//!   no overlapping writes. Examples: `vital_signs`, `audit_log`,
//!   `device_telemetry`, `triage_observations`.
//!
//! - **T3 — CRDT with commit gate.** Editable text / JSON where
//!   conflict resolution is "merge concurrent edits, then human
//!   reviews". Examples: `patient_notes`, `nursing_handoff_notes`,
//!   non-prescription `clinical_observations`.
//!
//! See [`Tier`] and the per-table [`TierClassification`] in
//! `medbrains-core::crdt`.
//!
//! ## Open source
//!
//! Apache-2.0. Hospitals can run this on their own hardware without
//! contacting MedBrains — the protocol is documented, the binary is
//! reproducible, the CRDT format is upstream Loro.

pub mod doc_store;
pub mod merkle;
pub mod sync;

pub use doc_store::DocStore;
pub use merkle::MerkleAudit;
pub use sync::{SyncServer, SyncServerError};

/// Server-side handshake protocol version. Bumped on incompatible
/// wire-format changes.
pub const PROTOCOL_VERSION: u32 = 1;
