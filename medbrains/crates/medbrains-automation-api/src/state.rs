//! What every automation handler shares.

use medbrains_automation::engine::Automation;
use sqlx::PgPool;
use std::sync::Arc;

/// Retention: how many runs of a workflow are kept.
///
/// A run's payload can hold clinical data, so this is deliberately short. It is
/// enough to debug what happened this morning, not an archive.
pub const DEFAULT_EXECUTION_RETENTION: i64 = 50;

#[derive(Clone)]
pub struct AutomationState {
    pub pool: PgPool,
    pub automation: Arc<Automation>,
    pub retention: i64,
}

impl std::fmt::Debug for AutomationState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AutomationState")
            .field("automation", &self.automation)
            .field("retention", &self.retention)
            .finish_non_exhaustive()
    }
}

impl AutomationState {
    #[must_use]
    pub fn new(pool: PgPool, automation: Arc<Automation>) -> Self {
        AutomationState { pool, automation, retention: DEFAULT_EXECUTION_RETENTION }
    }

    #[must_use]
    pub fn with_retention(mut self, runs: i64) -> Self {
        self.retention = runs.clamp(1, 10_000);
        self
    }
}
