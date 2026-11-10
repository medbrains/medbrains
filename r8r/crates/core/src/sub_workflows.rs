//! Running one workflow from inside another.
//!
//! Without this every workflow is a monolith: the six nodes that look up a
//! patient and normalise the result get copied into each workflow that needs
//! them, and then they disagree.
//!
//! A node cannot reach the engine or the database by design, so calling
//! another workflow arrives the way credentials do — as a capability the
//! server supplies. That keeps `r8r-core` free of storage, and it is what lets
//! a test call a sub-workflow held in a map.

use crate::errors::{CoreError, Result};
use async_trait::async_trait;
use r8r_workflow::interfaces::Items;

/// How deep one workflow may call another.
///
/// Deep enough for the composition anybody actually builds, shallow enough
/// that a mistake surfaces as an error rather than as a stack that keeps
/// growing until something gives.
pub const MAX_DEPTH: usize = 8;

/// The ability to run another workflow.
#[async_trait]
pub trait SubWorkflows: Send + Sync + std::fmt::Debug {
    /// Run `workflow_id` with `input` and return what it produced.
    ///
    /// `chain` is the workflows already running, outermost first. It is passed
    /// rather than counted so a cycle can be reported by name — "A calls B
    /// calls A" is a sentence somebody can act on, where "too deep" is not.
    async fn run(&self, workflow_id: &str, input: Items, chain: &[String]) -> Result<Items>;
}

/// For contexts with no workflow store — tests, and embedding r8r as a
/// library that only runs one workflow at a time.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoSubWorkflows;

#[async_trait]
impl SubWorkflows for NoSubWorkflows {
    async fn run(&self, workflow_id: &str, _input: Items, _chain: &[String]) -> Result<Items> {
        Err(CoreError::Node(format!(
            "this workflow calls `{workflow_id}`, but nothing here can run another workflow"
        )))
    }
}

/// Why a call was refused before it ran.
///
/// Checked by the caller rather than left to the runtime, so the failure
/// arrives naming the workflows involved instead of as an exhausted stack.
pub fn check_call(target: &str, chain: &[String]) -> Result<()> {
    if let Some(position) = chain.iter().position(|id| id == target) {
        let loop_path = chain
            .get(position..)
            .unwrap_or_default()
            .iter()
            .map(String::as_str)
            .chain(std::iter::once(target))
            .collect::<Vec<_>>()
            .join(" → ");

        return Err(CoreError::Node(format!(
            "this would run forever: {loop_path}"
        )));
    }

    if chain.len() >= MAX_DEPTH {
        return Err(CoreError::Node(format!(
            "workflows are nested more than {MAX_DEPTH} deep; \
             the chain is {}",
            chain.join(" → ")
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn chain(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|id| (*id).to_owned()).collect()
    }

    #[test]
    fn an_ordinary_call_is_allowed() {
        assert!(check_call("b", &chain(&["a"])).is_ok());
        assert!(check_call("a", &[]).is_ok());
    }

    #[test]
    fn a_workflow_calling_itself_is_refused_by_name() {
        let refused = check_call("a", &chain(&["a"])).expect_err("should refuse");
        assert!(refused.to_string().contains("a → a"), "got: {refused}");
    }

    #[test]
    fn an_indirect_cycle_is_reported_as_the_path_it_takes() {
        // "A calls B calls C calls A" is a sentence somebody can act on.
        let refused = check_call("a", &chain(&["a", "b", "c"])).expect_err("should refuse");
        assert!(
            refused.to_string().contains("a → b → c → a"),
            "got: {refused}"
        );
    }

    #[test]
    fn a_cycle_that_does_not_reach_the_outermost_workflow_is_still_caught() {
        let refused = check_call("b", &chain(&["a", "b", "c"])).expect_err("should refuse");
        assert!(refused.to_string().contains("b → c → b"), "got: {refused}");
    }

    #[test]
    fn nesting_stops_at_a_stated_depth() {
        let deep = chain(&["w0", "w1", "w2", "w3", "w4", "w5", "w6", "w7"]);
        assert_eq!(deep.len(), MAX_DEPTH);

        let refused = check_call("w8", &deep).expect_err("should refuse");
        assert!(
            refused.to_string().contains("more than 8 deep"),
            "got: {refused}"
        );
    }

    #[test]
    fn one_below_the_limit_is_still_allowed() {
        let chain = chain(&["w0", "w1", "w2", "w3", "w4", "w5", "w6"]);
        assert!(check_call("w7", &chain).is_ok());
    }

    #[tokio::test]
    async fn without_a_workflow_store_the_refusal_says_so() {
        let error = NoSubWorkflows
            .run("wf-1", vec![json!({})], &[])
            .await
            .expect_err("should refuse");

        assert!(error.to_string().contains("wf-1"));
        assert!(error.to_string().contains("run another workflow"));
    }
}
