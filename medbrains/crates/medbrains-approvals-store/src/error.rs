//! Failures from the persistence layer.

use medbrains_approvals_core::ControlViolation;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("approval request {0} not found")]
    RequestNotFound(Uuid),

    #[error("approval request {request} has no stage {seq}")]
    StepNotFound { request: Uuid, seq: i32 },

    /// The guarded update matched no rows.
    ///
    /// Distinct from a control violation: the core said the decision was
    /// allowed against the state we read, and by the time we wrote, that state
    /// had changed. Two approvers deciding at the same moment is the ordinary
    /// cause, and the loser must be told the request moved rather than that
    /// they did something wrong.
    #[error("this request changed while your decision was being recorded — reload and try again")]
    ConcurrentUpdate,

    #[error(transparent)]
    Control(#[from] ControlViolation),

    #[error(transparent)]
    Database(#[from] sqlx::Error),
}
