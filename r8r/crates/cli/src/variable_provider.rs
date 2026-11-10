//! The engine's view of the instance's variables.

use crate::databases::Database;
use r8r_core::Variables;
use serde_json::{Map, Value};
use std::sync::Arc;

#[derive(Clone)]
pub struct DatabaseVariables {
    db: Arc<Database>,
}

impl std::fmt::Debug for DatabaseVariables {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DatabaseVariables").finish_non_exhaustive()
    }
}

impl DatabaseVariables {
    #[must_use]
    pub fn new(db: Arc<Database>) -> Self {
        DatabaseVariables { db }
    }
}

impl Variables for DatabaseVariables {
    /// A read that fails yields no variables rather than aborting the run.
    ///
    /// Every `{{ vars.X }}` in the workflow then resolves to nothing, which
    /// surfaces as an obviously empty URL in the execution log — visible, and
    /// nowhere near as confusing as a run that dies before its first node with
    /// a database error.
    fn all(&self) -> Map<String, Value> {
        self.db.variables().as_map().unwrap_or_else(|error| {
            tracing::error!(%error, "could not read instance variables");
            Map::new()
        })
    }
}
