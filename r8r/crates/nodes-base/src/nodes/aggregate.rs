use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::{NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription};
use serde_json::json;

/// Collapses every incoming item into a single item holding the list.
#[derive(Debug)]
pub struct AggregateNode;

#[async_trait]
impl NodeExecutor for AggregateNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "aggregate".into(),
            display_name: "Aggregate".into(),
            group: NodeGroup::Transform,
            description: "Roll all items up into one item containing a list".into(),
            icon: "⇊".into(),
            color: "#0ea5e9".into(),
            properties: vec![NodeProperty::new(
                "field",
                "Output Field",
                NodePropertyKind::String,
                json!("items"),
            )],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let params = ctx.static_params()?;
        let field = ctx.str_param(&params, "field", "items");
        Ok(main_output(vec![json!({ field: ctx.input })]).into())
    }
}
