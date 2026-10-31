//! The engine's view of what a workflow remembers.

use crate::databases::Database;
use async_trait::async_trait;
use r8r_core::{CoreError, Result, StateStore};
use serde_json::{Map, Value};
use std::sync::Arc;

#[derive(Clone)]
pub struct DatabaseState {
    db: Arc<Database>,
}

impl std::fmt::Debug for DatabaseState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DatabaseState").finish_non_exhaustive()
    }
}

impl DatabaseState {
    #[must_use]
    pub fn new(db: Arc<Database>) -> Self {
        DatabaseState { db }
    }
}

#[async_trait]
impl StateStore for DatabaseState {
    async fn load(&self, workflow_id: &str) -> Result<Map<String, Value>> {
        self.db
            .state()
            .load(workflow_id)
            .map_err(|e| CoreError::Node(format!("could not read workflow state: {e}")))
    }

    async fn commit(&self, workflow_id: &str, values: Map<String, Value>) -> Result<()> {
        self.db
            .state()
            .commit(workflow_id, &values)
            .map(|_| ())
            .map_err(|e| CoreError::Node(format!("could not save workflow state: {e}")))
    }
}
