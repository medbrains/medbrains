use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::{NodeGroup, NodeTypeDescription};

/// Joins several branches back into one stream.
///
// ponytail: append only. The engine concatenates everything arriving on a
// node's inputs before the node sees it, so this cannot tell branch A from
// branch B. Combine-by-key/position needs numbered input ports on Node first.
#[derive(Debug)]
pub struct MergeNode;

#[async_trait]
impl NodeExecutor for MergeNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "merge".into(),
            display_name: "Merge".into(),
            group: NodeGroup::Flow,
            description: "Combine the items of several branches into one stream".into(),
            icon: "⋈".into(),
            color: "#22c55e".into(),
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
