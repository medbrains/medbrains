use async_trait::async_trait;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, NodeOutput, Result};
use r8r_workflow::{NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription};
use serde_json::json;

/// Routes each item to the `main` (true) or `false` output.
#[derive(Debug)]
pub struct IfNode;

#[async_trait]
impl NodeExecutor for IfNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "if".into(),
            display_name: "If".into(),
            group: NodeGroup::Flow,
            description: "Split items down a true and a false branch".into(),
            icon: "⑂".into(),
            color: "#22c55e".into(),
            properties: vec![
                NodeProperty::new(
                    "condition",
                    "Condition",
                    NodePropertyKind::Code,
                    json!("item.status == \"active\""),
                )
                .required()
                .describe("A Rhai expression evaluated per item"),
            ],
            outputs: vec!["main".into(), "false".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let condition = ctx.str_param(&ctx.node.parameters, "condition", "true");
        let (mut yes, mut no) = (Vec::new(), Vec::new());
        for idx in 0..ctx.input.len() {
            if ctx.eval_bool(&condition, idx)? {
                yes.push(ctx.item(idx));
            } else {
                no.push(ctx.item(idx));
            }
        }
        Ok(NodeOutput::from([("main".to_string(), yes), ("false".to_string(), no)]).into())
    }
}
