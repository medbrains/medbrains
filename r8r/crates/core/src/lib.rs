//! The execution runtime: what it means to *run* a workflow.
//!
//! Mirrors `packages/core` in n8n. This crate owns the node trait, the node
//! registry and the DAG executor. It knows nothing about HTTP servers or
//! databases — that is the `cli` crate's job.

pub mod binary;
pub mod credentials;
pub mod declarative;
pub mod encryption;
pub mod errors;
pub mod execute_context;
pub mod execution_engine;
pub mod http;
pub mod nodes_loader;
pub mod pagination;
pub mod state;
pub mod sub_workflows;
pub mod suspension;
pub mod variables;

pub use binary::{BINARY_KEY, BinaryMeta, BinaryRef, BinaryStore, Carried, NoBinaryStore};
pub use credentials::{
    CredentialProvider, CredentialRegistry, NoCredentials, ResolvedCredential, StaticCredentials,
};
pub use encryption::Encryptor;
pub use errors::{CoreError, Result};
pub use execute_context::{ExecuteContext, NodeOutput};
pub use execution_engine::WorkflowExecute;
pub use nodes_loader::{NodeExecutor, NodeRegistry};
pub use pagination::{MAX_PAGES, NextPage, Pagination, Position, next_page};
pub use r8r_workflow::interfaces::ExecutionMode;
pub use state::{NoState, StagedState, StateStore};
pub use sub_workflows::{NoSubWorkflows, SubWorkflows};
pub use suspension::{NodeOutcome, SuspendedAt, Suspension};
pub use variables::{NoVariables, StaticVariables, Variables};
