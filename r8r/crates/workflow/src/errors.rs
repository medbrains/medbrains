use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorkflowError {
    #[error("expression error: {0}")]
    Expression(String),
    #[error("workflow contains a cycle")]
    Cycle,
    #[error("no trigger node to start from")]
    NoTrigger,
    #[error("unknown node type `{0}`")]
    UnknownNodeType(String),
    #[error("node `{node}` failed: {message}")]
    NodeExecution { node: String, message: String },
    #[error("{0}")]
    Other(String),
}

impl From<String> for WorkflowError {
    fn from(s: String) -> Self {
        WorkflowError::Other(s)
    }
}

pub type Result<T> = std::result::Result<T, WorkflowError>;
