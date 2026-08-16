//! The pure core of the central approvals platform.
//!
//! The product grew sixteen independent request/approval implementations —
//! access requests, leave, co-signature, restricted drugs, blood, transport,
//! stock disposal, pre-authorisation and the rest. Fifteen have a `status`
//! column and ten a `requested_by`; past that they share nothing, including
//! four different state machines and two different words for a refusal.
//!
//! The real cost is that each one re-derives its own controls, and most get it
//! wrong. `iam_access_requests` refuses a reviewer who is the requester or the
//! subject; `leave_requests` never checked, and its two-stage chain could be
//! skipped entirely because the update was keyed on the row id alone.
//!
//! This crate is where those controls live once. It holds no database driver
//! and no web framework on purpose: the state machine and every control are
//! pure functions over values, so the rule set can be tested exhaustively by
//! constructing a struct rather than seeding a schema and starting a server.
//! A rule that cannot be tested cheaply is a rule that stops being tested.
//!
//! # Layers
//!
//! ```text
//! medbrains-approvals-core   <- here: types, state machine, controls (pure)
//! medbrains-approvals-db        repositories, migrations, guarded updates
//! medbrains-approvals           orchestration, plug traits
//! medbrains-approvals-api       routes
//! ```
//!
//! Domain crates depend on the engine; the engine names no domain crate.
//! Handlers are registered at the composition root.
//!
//! # Using it
//!
//! The caller loads state, asks what may happen, and persists the answer.
//! Nothing here writes:
//!
//! ```
//! use medbrains_approvals_core::{controls, Decision, Outcome};
//! # use medbrains_approvals_core::{Actor, RequestState, RequestStatus, StepState, StepStatus};
//! # use uuid::Uuid;
//! # let request = RequestState {
//! #     id: Uuid::new_v4(), kind: "hr.leave".to_owned(), status: RequestStatus::Pending,
//! #     requester_id: Uuid::new_v4(), on_behalf_of_id: None, current_step_seq: 1,
//! #     requires_elevation: false, expires_at: None,
//! # };
//! # let step = StepState {
//! #     id: Uuid::new_v4(), seq: 1, status: StepStatus::Active, quorum: 1,
//! #     requires_witness: false, decisions: Vec::new(), sla_due_at: None,
//! # };
//! # let actor = Actor {
//! #     user_id: Uuid::new_v4(), is_assigned: true, is_bypass_role: false, via_delegation: None,
//! # };
//! let outcome = controls::evaluate(&request, &step, &actor, Decision::Approve, None, 1)?;
//! assert_eq!(outcome, Outcome::AdvanceToNextStep);
//! # Ok::<(), medbrains_approvals_core::ControlViolation>(())
//! ```
//!
//! The returned [`Outcome`] is applied by the caller inside the deciding
//! transaction, alongside the domain effect, so an effect that fails rolls the
//! decision back with it.

pub mod conditions;
pub mod controls;
pub mod error;
pub mod model;
pub mod rules;

pub use error::ControlViolation;
pub use model::{
    Actor, Decision, Outcome, RecordedDecision, RequestId, RequestState, RequestStatus, StepId,
    StepState, StepStatus, UserId,
};
pub use rules::{ApproverRule, RuleError};
