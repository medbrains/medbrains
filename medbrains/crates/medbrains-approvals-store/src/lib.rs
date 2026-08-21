//! Persistence for the central approvals platform.
//!
//! Sits between the pure core, which decides what may happen, and the engine,
//! which orchestrates it. This crate knows about rows; it does not know about
//! HTTP, and it does not know about any domain.
//!
//! # Where the rules are enforced
//!
//! Twice, on purpose.
//!
//! [`medbrains_approvals_core`] judges a decision against state read a moment
//! earlier, and refuses with a message a person can act on — "this request has
//! moved on to stage 2 since you opened it". That is the good error.
//!
//! Every write here then re-states the same assumptions in its `WHERE` clause.
//! If the request moved between the judgement and the write, the update
//! matches zero rows and the caller gets [`error::StoreError::ConcurrentUpdate`]
//! instead of overwriting somebody else's decision. That is the guard that
//! does not depend on anyone remembering to ask.
//!
//! The second layer is what the sixteen hand-rolled implementations lacked.
//! The leave module's approval update was `WHERE id = $1 AND tenant_id = $2` —
//! no stage, no status — so a request could be advanced from any state to any
//! other, and two approvers could both win.
//!
//! # Transactions
//!
//! Nothing here opens or commits a transaction. The caller owns it, sets the
//! tenant context for RLS, and runs the domain effect in the same one, so an
//! effect that fails rolls the approval back with it.

pub mod decide;
pub mod error;
pub mod load;

pub use decide::{RecordDecision, record};
pub use error::StoreError;
pub use load::{DecisionContext, decision_context};
