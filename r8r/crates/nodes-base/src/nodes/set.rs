use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{CoreError, ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::as_item;
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::{Map, Value, json};

/// Add or overwrite fields on every item. The workhorse of most workflows.
#[derive(Debug)]
pub struct SetNode;

#[async_trait]
impl NodeExecutor for SetNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "set".into(),
            display_name: "Edit Fields".into(),
            group: NodeGroup::Transform,
            description: "Set, rename or drop fields on each item".into(),
            icon: "✏️".into(),
            color: "#0ea5e9".into(),
            properties: vec![
                NodeProperty::new("mode", "Mode", NodePropertyKind::Options, json!("fields"))
                    .with_options(vec![
                        PropertyOption::new("Fields", "fields"),
                        PropertyOption::new("Raw JSON", "json"),
                    ]),
                NodeProperty::new(
                    "fields",
                    "Fields to Set",
                    NodePropertyKind::KeyValue,
                    json!({}),
                )
                .show_when("mode", &["fields"])
                .describe("Values may use {{ item.something }} expressions"),
                NodeProperty::new(
                    "keepOnlySet",
                    "Keep Only Set Fields",
                    NodePropertyKind::Boolean,
                    json!(false),
                )
                .show_when("mode", &["fields"]),
                NodeProperty::new(
                    "json",
                    "JSON",
                    NodePropertyKind::Json,
                    json!("{\n  \"key\": \"{{ item.value }}\"\n}"),
                )
                .show_when("mode", &["json"])
                .describe("Replaces the item entirely"),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let mut out = Vec::with_capacity(ctx.input.len());
        for idx in 0..ctx.input.len() {
            let params = ctx.params(idx)?;
            let mode = ctx.str_param(&params, "mode", "fields");

            if mode == "json" {
                let raw = ctx.str_param(&params, "json", "{}");
                // Templates inside the JSON are already resolved; a resolved
                // template can itself be a value, so parse leniently.
                let parsed = match params.get("json") {
                    // A template that resolved to a real value needs no reparse.
                    Some(structured @ (Value::Object(_) | Value::Array(_))) => structured.clone(),
                    _ => serde_json::from_str::<Value>(&raw)
                        .map_err(|e| CoreError::Node(format!("invalid JSON: {e}")))?,
                };
                out.push(as_item(parsed));
                continue;
            }

            let fields = ctx.object_param(&params, "fields");
            let mut item: Map<String, Value> = if ctx.bool_param(&params, "keepOnlySet", false) {
                Map::new()
            } else {
                ctx.item(idx).as_object().cloned().unwrap_or_default()
            };
            for (k, v) in fields {
                item.insert(k, v);
            }
            out.push(Value::Object(item));
        }
        Ok(main_output(out).into())
    }
}
