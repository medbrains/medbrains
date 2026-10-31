use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::{NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription};
use serde_json::json;

/// Drops items that fail the condition. An `if` with only the true branch.
#[derive(Debug)]
pub struct FilterNode;

#[async_trait]
impl NodeExecutor for FilterNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "filter".into(),
            display_name: "Filter".into(),
            group: NodeGroup::Flow,
            description: "Keep only the items matching a condition".into(),
            icon: "▽".into(),
            color: "#22c55e".into(),
            properties: vec![
                NodeProperty::new(
                    "condition",
                    "Keep When",
                    NodePropertyKind::Code,
                    json!("item.value > 0"),
                )
                .required(),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let condition = ctx.str_param(&ctx.node.parameters, "condition", "true");
        let mut kept = Vec::new();
        for idx in 0..ctx.input.len() {
            if ctx.eval_bool(&condition, idx)? {
                kept.push(ctx.item(idx));
            }
        }
        Ok(main_output(kept).into())
    }
}
