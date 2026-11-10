//! Pure workflow domain: data model, expression language and graph algorithms.
//!
//! Mirrors `packages/workflow` in n8n — no I/O, no database, no HTTP. Everything
//! here is deterministic and safe to run anywhere.

pub mod conditions;
pub mod credentials;
pub mod diff;
pub mod display_options;
pub mod errors;
pub mod expression;
pub mod graph;
pub mod interfaces;
pub mod node_helpers;
pub mod routing;
pub mod workflow;

pub use conditions::{Combinator, Condition, ConditionGroup, ConditionNode, Operator};
pub use credentials::{AuthMethod, CredentialTest, CredentialTypeDescription, REDACTED};
pub use diff::{FieldChange, NodeChange, NodeSummary, WorkflowDiff, diff};
pub use display_options::DisplayOptions;
pub use errors::WorkflowError;
pub use expression::{Expression, stringify, truthy};
pub use interfaces::{
    Connection, CredentialRequirement, ERROR_PORT, ExecutionMode, ExecutionStatus, Items, Node,
    NodeExecutionData, NodeGroup, NodeProperty, NodePropertyKind, NodeRunData, NodeRunStatus,
    NodeTypeDescription, OnError, PropertyOption, RunResult,
};
pub use routing::{BodyType, HttpMethod, OutputRouting, PostReceive, RequestRouting, Routing};
pub use workflow::Workflow;
