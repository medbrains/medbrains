//! The central approvals engine.
//!
//! One request model and one approval engine for the whole product, replacing
//! the sixteen that grew separately. The design goal is not to hold those
//! sixteen — it is that the seventeenth request type needs no code:
//!
//! * a **request type** is a row, its **form** is rows, and its **approval
//!   chain** is rows, so an administrator can add "request a parking pass"
//!   without a deployment;
//! * code appears only where a decision has a real effect — granting a
//!   permission, releasing stock — through [`plug::ApprovalEffect`];
//! * ordering, quorum, witnesses, delegation, escalation and the audit trail
//!   belong to the engine, and a domain can neither reimplement nor weaken
//!   them.
//!
//! Shape follows Frappe (`DocType` and Workflow as data) and Odoo (Approval
//! Category), with time-boxed grants and recertification from Microsoft PIM.
//!
//! # Dependency direction
//!
//! This crate names no domain crate. Domains depend on it and register
//! themselves into a [`plug::Registry`] at the composition root, so adding a
//! domain never edits a file here. A `match` on kind would have inverted that
//! and put every domain's name in the engine.
//!
//! # Layers
//!
//! ```text
//! medbrains-approvals-core    types, state machine, controls — pure, no sqlx
//! medbrains-approvals-store   repositories and the guarded writes
//! medbrains-approvals         <- here: orchestration and the plug traits
//! medbrains-approvals-api     routes
//! ```
//!
//! # Transactions
//!
//! [`engine::decide_request`] does not open or commit one. The caller owns the
//! transaction, sets the tenant context for RLS, and the domain effect runs
//! inside it — so an effect that fails rolls the approval back with it.

pub mod directory;
pub mod engine;
pub mod error;
pub mod plug;
pub mod raise;

pub use directory::{ResolutionContext, resolve};
pub use engine::{Decided, DecisionInput, decide_request};
pub use error::EngineError;
pub use plug::{ApprovalEffect, EffectContext, ExternalDecider, ExternalOutcome, Registry, Tx};
pub use raise::{RaiseInput, Raised, raise_request};
