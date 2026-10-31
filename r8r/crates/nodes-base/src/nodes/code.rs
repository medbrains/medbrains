use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::as_item;
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::{Value, json};

/// Arbitrary Rhai script. Sandboxed: no filesystem, no network, no process —
/// and capped on operations, so a runaway loop aborts instead of hanging.
#[derive(Debug)]
pub struct CodeNode;

#[async_trait]
impl NodeExecutor for CodeNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "code".into(),
            display_name: "Code".into(),
            group: NodeGroup::Transform,
            description: "Transform items with a Rhai script".into(),
            icon: "{ }".into(),
            color: "#ec4899".into(),
            properties: vec![
                NodeProperty::new("mode", "Mode", NodePropertyKind::Options, json!("eachItem"))
                    .with_options(vec![
                        PropertyOption::new("Run once for each item", "eachItem"),
                        PropertyOption::new("Run once for all items", "allItems"),
                    ]),
                NodeProperty::new(
                    "script",
                    "Script",
                    NodePropertyKind::Code,
                    json!("// `item` is the current item, `items` is all of them.\nitem.processed = true;\nitem"),
                )
                .required()
                .describe("The last expression is the result. Available: item, items, idx, env, nodes, workflow"),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        // The script is source code, not a template — read it unresolved so
        // `{{ }}` inside a string literal survives.
        let script = ctx.str_param(&ctx.node.parameters, "script", "item");
        let mode = ctx.str_param(&ctx.node.parameters, "mode", "eachItem");

        if mode == "allItems" {
            let result = ctx.eval(&script, 0)?;
            return Ok(main_output(match result {
                Value::Array(a) => a.into_iter().map(as_item).collect(),
                other => vec![as_item(other)],
            })
            .into());
        }

        let mut out = Vec::with_capacity(ctx.input.len());
        for idx in 0..ctx.input.len() {
            match ctx.eval(&script, idx)? {
                // Returning an array from a per-item script fans out, matching
                // what people expect from n8n's Code node.
                Value::Array(a) => out.extend(a.into_iter().map(as_item)),
                Value::Null => {}
                other => out.push(as_item(other)),
            }
        }
        Ok(main_output(out).into())
    }
}
