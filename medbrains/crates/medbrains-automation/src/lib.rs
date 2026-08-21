//! Workflow automation for MedBrains.
//!
//! The engine itself is [r8r], a separate project. What lives here is the part
//! that is specific to running one inside a hospital system:
//!
//! * [`RunAs`] — the authority a workflow acts with when no user is present.
//! * [`Deployment`] — whether the engine runs inside the MedBrains server or
//!   as its own service, which is a customer's decision rather than ours.
//! * [`Guard`] — the ceiling on what automation may consume, so a runaway
//!   schedule degrades automation and not the hospital.
//!
//! Nothing in the clinical schema depends on this crate. If automation is
//! switched off, or its tables are dropped, MedBrains is unaffected.
//!
//! [r8r]: https://github.com/DomnicAmalan/r8r

pub mod deployment;
pub mod engine;
pub mod guard;
pub mod run_as;

pub use engine::TenantStores;
pub use deployment::Deployment;
pub use guard::Guard;
pub use run_as::RunAs;

/// Re-exported so the -store and -api crates do not each depend on r8r
/// directly, and so a version bump is a change in one manifest.
pub mod prelude {
    pub use r8r_core::{
        BinaryMeta, BinaryRef, BinaryStore, CredentialProvider, CredentialRegistry, NodeRegistry,
        CoreError, NoVariables, ResolvedCredential, Result as EngineResult, StateStore,
        StaticVariables, Variables, WorkflowExecute,
    };
    pub use r8r_workflow::interfaces::{ExecutionMode, ExecutionStatus, Items, RunResult};
    pub use r8r_workflow::{CredentialTypeDescription, NodeTypeDescription, Workflow};
}
