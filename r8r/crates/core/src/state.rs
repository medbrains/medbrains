//! What a workflow remembers between runs.
//!
//! Without this every run is a full load: a workflow that syncs appointments
//! fetches all of them every time, because it has no way to know what it saw
//! last. Remembering one value — the moment of the newest record it processed —
//! turns that into an incremental sync.
//!
//! The whole difficulty is *when* that value is allowed to move.
//!
//! Writing it the moment it is computed is the classic way to lose data: the
//! run fetches records, advances the watermark, then fails before doing
//! anything with them. The next run asks for everything since the new
//! watermark, and those records are never seen again — silently, and only
//! noticed when somebody asks why an appointment never synced.
//!
//! So writes are staged during the run and committed only if it succeeds.
//! A failed run leaves the watermark where it was, and the next run covers the
//! same ground. Doing work twice is recoverable; skipping it is not.

use crate::errors::Result;
use async_trait::async_trait;
use serde_json::{Map, Value};
use std::sync::{Arc, Mutex, PoisonError};

/// Where a workflow's remembered values live between runs.
#[async_trait]
pub trait StateStore: Send + Sync + std::fmt::Debug {
    /// Everything this workflow remembers.
    ///
    /// Read once at the start of a run rather than per lookup: it is a handful
    /// of values, and one read means every expression sees the same state.
    async fn load(&self, workflow_id: &str) -> Result<Map<String, Value>>;

    /// Commit staged values. Called only after a run has succeeded.
    async fn commit(&self, workflow_id: &str, values: Map<String, Value>) -> Result<()>;
}

/// For contexts with nowhere to remember anything.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoState;

#[async_trait]
impl StateStore for NoState {
    async fn load(&self, _workflow_id: &str) -> Result<Map<String, Value>> {
        Ok(Map::new())
    }

    /// Silently dropped rather than an error: a workflow that saves state on a
    /// server with no store still works, it simply does not remember. Failing
    /// the run would be a worse trade for the common embedded case.
    async fn commit(&self, _workflow_id: &str, _values: Map<String, Value>) -> Result<()> {
        Ok(())
    }
}

/// Values a run has asked to remember, not yet written.
///
/// Shared through the execution context, which nodes hold immutably — hence
/// the lock. Contention is nil: staging a value is a map insert, and runs are
/// one at a time within an execution.
#[derive(Debug, Default, Clone)]
pub struct StagedState {
    pending: Arc<Mutex<Map<String, Value>>>,
}

impl StagedState {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Ask for a value to be remembered if this run succeeds.
    pub fn stage(&self, key: &str, value: Value) {
        // A poisoned lock means a previous staging panicked mid-insert; the map
        // itself is still usable, so recover rather than take the run down.
        let mut pending = self.pending.lock().unwrap_or_else(PoisonError::into_inner);
        pending.insert(key.to_owned(), value);
    }

    /// What has been staged so far.
    #[must_use]
    pub fn peek(&self) -> Map<String, Value> {
        self.pending
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.pending
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn nothing_is_staged_to_begin_with() {
        assert!(StagedState::new().is_empty());
    }

    #[test]
    fn a_staged_value_can_be_read_back() {
        let staged = StagedState::new();
        staged.stage("lastSync", json!("2026-08-21T09:00:00Z"));

        assert_eq!(staged.peek()["lastSync"], json!("2026-08-21T09:00:00Z"));
    }

    #[test]
    fn staging_the_same_key_twice_keeps_the_later_value() {
        // A workflow that narrows a watermark as it goes should end with the
        // last thing it decided, not the first.
        let staged = StagedState::new();
        staged.stage("lastSync", json!(1));
        staged.stage("lastSync", json!(2));

        assert_eq!(staged.peek()["lastSync"], json!(2));
    }

    #[test]
    fn staging_is_shared_between_clones() {
        // The context hands nodes a clone; they must all stage into one place.
        let staged = StagedState::new();
        let handed_to_a_node = staged.clone();

        handed_to_a_node.stage("cursor", json!("abc"));

        assert_eq!(staged.peek()["cursor"], json!("abc"));
    }

    #[tokio::test]
    async fn a_server_with_no_store_remembers_nothing_and_does_not_fail() {
        // A workflow that saves state still works; it simply does not remember.
        let store = NoState;
        assert!(store.load("wf").await.expect("loads").is_empty());

        let mut values = Map::new();
        values.insert("lastSync".into(), json!("x"));
        assert!(store.commit("wf", values).await.is_ok());
    }
}
