use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::as_item;
use r8r_workflow::{NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription};
use serde_json::{Value, json};

/// Turns one item holding an array into one item per array element — the usual
/// next step after an HTTP node returns a list.
#[derive(Debug)]
pub struct SplitOutNode;

#[async_trait]
impl NodeExecutor for SplitOutNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "splitOut".into(),
            display_name: "Split Out".into(),
            group: NodeGroup::Transform,
            description: "Fan an array field out into one item per element".into(),
            icon: "⇉".into(),
            color: "#0ea5e9".into(),
            properties: vec![
                NodeProperty::new(
                    "field",
                    "Field to Split Out",
                    NodePropertyKind::String,
                    json!("body"),
                )
                .required()
                .describe("Dot paths work: body.data.items"),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let mut out = Vec::new();
        for idx in 0..ctx.input.len() {
            let params = ctx.params(idx)?;
            let path = ctx.str_param(&params, "field", "body");
            let item = ctx.item(idx);

            let mut cur = &item;
            for hop in path.split('.') {
                cur = cur.get(hop).unwrap_or(&Value::Null);
            }
            match cur {
                Value::Array(a) => out.extend(a.iter().cloned().map(as_item)),
                Value::Null => {}
                other => out.push(as_item(other.clone())),
            }
        }
        Ok(main_output(out).into())
    }
}
