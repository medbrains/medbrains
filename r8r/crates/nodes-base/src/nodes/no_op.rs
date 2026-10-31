use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::{NodeGroup, NodeTypeDescription};

/// Passes items straight through. Useful as a labelled junction on the canvas.
#[derive(Debug)]
pub struct NoOpNode;

#[async_trait]
impl NodeExecutor for NoOpNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "noOp".into(),
            display_name: "No Operation".into(),
            group: NodeGroup::Flow,
            description: "Does nothing and passes items through unchanged".into(),
            icon: "○".into(),
            color: "#94a3b8".into(),
            properties: vec![],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        Ok(main_output(ctx.input.clone()).into())
    }
}
