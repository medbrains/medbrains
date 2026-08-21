//! Engine failures.

use medbrains_approvals_core::ControlViolation;
use medbrains_approvals_store::StoreError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    /// A control refused the decision. The message is written for the person
    /// who was refused.
    #[error(transparent)]
    Control(#[from] ControlViolation),

    #[error(transparent)]
    Store(#[from] StoreError),

    /// The request type names an `effect_key` that nothing implements.
    ///
    /// Fatal on purpose. The alternative — approving and doing nothing — is
    /// the worst outcome available, because every person involved believes the
    /// thing happened.
    #[error(
        "request type '{kind}' expects the effect '{effect_key}', which is not registered on this \
         server; the approval was not applied"
    )]
    UnregisteredEffect { kind: String, effect_key: String },

    /// A domain precondition failed.
    #[error("{0}")]
    Domain(String),

    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

impl EngineError {
    /// Whether this is the caller's fault (403), a state conflict (409), or
    /// ours (500).
    ///
    /// An authority failure is reported without detail: someone with no
    /// business with a request must not learn from the error whether it
    /// exists, is closed, or is mid-chain.
    #[must_use]
    pub const fn http_status(&self) -> u16 {
        match self {
            Self::Control(violation) if violation.is_authority_failure() => 403,
            Self::Control(_) | Self::Store(StoreError::ConcurrentUpdate) => 409,
            Self::Store(StoreError::RequestNotFound(_) | StoreError::StepNotFound { .. }) => 404,
            Self::Domain(_) => 422,
            Self::UnregisteredEffect { .. } | Self::Store(_) | Self::Database(_) => 500,
        }
    }
}
