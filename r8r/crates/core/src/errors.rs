use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error(transparent)]
    Workflow(#[from] r8r_workflow::WorkflowError),
    #[error("unknown node type `{0}` — is it registered?")]
    UnknownNodeType(String),
    #[error("{0}")]
    Node(String),
    /// The service asked us to slow down and said for how long.
    ///
    /// Separate from `Node` because the wait matters: retrying a 429 on the
    /// node's own schedule spends quota that is already exhausted, and makes
    /// the outage longer than the service asked for.
    #[error("{message}")]
    RateLimited {
        message: String,
        retry_after: std::time::Duration,
    },
}

impl CoreError {
    /// How long the service asked us to wait, if it said.
    #[must_use]
    pub fn retry_after(&self) -> Option<std::time::Duration> {
        match self {
            CoreError::RateLimited { retry_after, .. } => Some(*retry_after),
            CoreError::Workflow(_) | CoreError::UnknownNodeType(_) | CoreError::Node(_) => None,
        }
    }
}

impl From<String> for CoreError {
    fn from(s: String) -> Self {
        CoreError::Node(s)
    }
}

impl From<&str> for CoreError {
    fn from(s: &str) -> Self {
        CoreError::Node(s.to_string())
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
