use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::ensure_one;
use r8r_workflow::{NodeGroup, NodeTypeDescription};

/// Fires only when someone presses Execute in the editor or calls the run API.
#[derive(Debug)]
pub struct ManualTrigger;

#[async_trait]
impl NodeExecutor for ManualTrigger {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "manual".into(),
            display_name: "Manual Trigger".into(),
            group: NodeGroup::Trigger,
            description: "Runs the workflow when you execute it by hand".into(),
            icon: "▶".into(),
            color: "#7d5bed".into(),
            properties: vec![],
            outputs: vec!["main".into()],
            inputs: vec![],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        Ok(main_output(ensure_one(ctx.input.clone())).into())
    }
}
