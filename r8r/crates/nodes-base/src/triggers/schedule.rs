use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::ensure_one;
use r8r_workflow::{NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription};
use serde_json::json;

/// Fired by the scheduler in the `cli` crate on a cron expression.
#[derive(Debug)]
pub struct ScheduleTrigger;

#[async_trait]
impl NodeExecutor for ScheduleTrigger {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "schedule".into(),
            display_name: "Schedule".into(),
            group: NodeGroup::Trigger,
            description: "Runs the workflow on a cron schedule".into(),
            icon: "⏰".into(),
            color: "#f59e0b".into(),
            properties: vec![
                NodeProperty::new(
                    "cron",
                    "Cron Expression",
                    NodePropertyKind::String,
                    json!("0 */5 * * * *"),
                )
                .required()
                .placeholder("0 */5 * * * *")
                .describe("Six fields: sec min hour day month weekday (UTC)"),
            ],
            outputs: vec!["main".into()],
            inputs: vec![],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        Ok(main_output(ensure_one(ctx.input.clone())).into())
    }
}
