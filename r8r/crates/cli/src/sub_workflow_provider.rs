//! Running one stored workflow from inside another.
//!
//! There is a knot here worth naming: the runner owns the engine, the engine
//! hands nodes the ability to call a workflow, and calling a workflow needs the
//! runner. Rather than merge the three, the provider is built first holding
//! nothing and is given the runner once it exists — so the cycle is a weak
//! reference resolved at startup instead of a redesign.

use crate::databases::Database;
use crate::workflow_runner::WorkflowRunner;
use async_trait::async_trait;
use r8r_core::sub_workflows::check_call;
use r8r_core::{CoreError, Result, SubWorkflows};
use r8r_workflow::interfaces::Items;
use std::sync::{Arc, OnceLock, Weak};

#[derive(Default)]
pub struct DatabaseSubWorkflows {
    db: OnceLock<Arc<Database>>,
    /// Weak so the runner is not kept alive by the engine it owns.
    runner: OnceLock<Weak<WorkflowRunner>>,
}

impl std::fmt::Debug for DatabaseSubWorkflows {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DatabaseSubWorkflows")
            .field("ready", &self.runner.get().is_some())
            .finish_non_exhaustive()
    }
}

impl DatabaseSubWorkflows {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Hand it the pieces once they exist. Called once, at startup.
    pub fn attach(&self, db: &Arc<Database>, runner: &Arc<WorkflowRunner>) {
        let _ = self.db.set(Arc::clone(db));
        let _ = self.runner.set(Arc::downgrade(runner));
    }
}

#[async_trait]
impl SubWorkflows for DatabaseSubWorkflows {
    async fn run(&self, workflow_id: &str, input: Items, chain: &[String]) -> Result<Items> {
        // Refused before anything runs, so the message names the workflows
        // rather than arriving as an exhausted stack.
        check_call(workflow_id, chain)?;

        let (Some(db), Some(runner)) = (self.db.get(), self.runner.get().and_then(Weak::upgrade))
        else {
            return Err(CoreError::Node(
                "workflows cannot call other workflows on this server".into(),
            ));
        };

        let stored = db
            .workflows()
            .find(workflow_id)
            .map_err(|e| CoreError::Node(format!("could not load `{workflow_id}`: {e}")))?
            .ok_or_else(|| {
                CoreError::Node(format!(
                    "this workflow calls `{workflow_id}`, which no longer exists"
                ))
            })?;

        let mut nested = chain.to_vec();
        nested.push(workflow_id.to_owned());

        let (_, result) = runner.run_nested(&stored.workflow, input, nested).await;

        // The sub-workflow's failure is this node's failure. Swallowing it
        // would let the caller carry on with nothing and look successful.
        if let Some(error) = result.error {
            return Err(CoreError::Node(format!(
                "`{}` failed: {error}",
                stored.workflow.name
            )));
        }

        Ok(result.last)
    }
}
