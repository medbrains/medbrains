//! Why a decision was refused.
//!
//! Each variant is a control, and each control exists because a domain that
//! hand-rolled its own approval did not have it. The messages are written to
//! be shown to the person who was refused: an approver told only "forbidden"
//! will try again, ring the helpdesk, or find someone to click it for them.

use thiserror::Error;

use crate::model::{RequestStatus, StepStatus};

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ControlViolation {
    #[error("a request must be decided by someone other than the person who raised it")]
    RequesterCannotDecide,

    #[error("a request must be decided by someone other than the person it concerns")]
    SubjectCannotDecide,

    #[error("this request is not awaiting your decision")]
    NotAnApprover,

    #[error("this request needs an administrator with elevated rights to approve it")]
    ElevationRequired,

    /// Carries both numbers so the client can say what happened rather than
    /// only that something did — two approvers acting at once is common, and
    /// the loser needs to know the request moved on, not that they failed.
    #[error(
        "this request has moved on to stage {current} since you opened it (you sent {expected})"
    )]
    StaleStep { expected: i32, current: i32 },

    #[error("stage {step} cannot be decided while stage {current} is awaiting a decision")]
    StepNotCurrent { step: i32, current: i32 },

    #[error("this stage is {0:?}, not awaiting a decision")]
    StepNotActive(StepStatus),

    #[error("this request is already {0:?} and cannot be decided again")]
    RequestClosed(RequestStatus),

    #[error("this request has not been submitted yet")]
    NotYetSubmitted,

    #[error("you have already recorded a decision on this stage")]
    AlreadyDecided,

    #[error("this decision requires a witness")]
    WitnessRequired,

    #[error("the witness must be someone other than the person deciding")]
    WitnessCannotBeActor,
}

impl ControlViolation {
    /// Whether this refusal is about who is asking rather than about the state
    /// of the request.
    ///
    /// Callers map these to 403 and the rest to 409. The distinction matters
    /// beyond tidiness: an authority failure must not disclose the state of a
    /// request the caller has no business seeing, so it is answered before any
    /// state is examined and reported without detail.
    #[must_use]
    pub const fn is_authority_failure(&self) -> bool {
        matches!(
            self,
            Self::RequesterCannotDecide
                | Self::SubjectCannotDecide
                | Self::NotAnApprover
                | Self::ElevationRequired
        )
    }
}
