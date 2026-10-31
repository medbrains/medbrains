use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::{get_path, set_path};
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::{Map, Value, json};

/// Maps fields from a source shape to a destination shape.
///
/// This is the node that makes two APIs talk to each other. Each row names a
/// destination path and where its value comes from — another path, or an
/// expression when the value needs combining or calculating. Dot paths work on
/// both sides, so a flat source can build a nested destination without any
/// intermediate steps.
#[derive(Debug)]
pub struct MapFieldsNode;

#[async_trait]
impl NodeExecutor for MapFieldsNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "mapFields".into(),
            display_name: "Map Fields".into(),
            group: NodeGroup::Transform,
            description: "Reshape items: map source fields onto destination fields".into(),
            icon: "⇄".into(),
            color: "#a78bfa".into(),
            properties: vec![
                NodeProperty::new(
                    "mappings",
                    "Field Mappings",
                    NodePropertyKind::FieldMapper,
                    json!({}),
                )
                .required()
                .describe(
                    "Destination on the left, source on the right. Both accept dot paths \
                     (customer.address.city). Use {{ }} on the right to combine or calculate.",
                ),
                NodeProperty::new(
                    "mode",
                    "Unmapped Fields",
                    NodePropertyKind::Options,
                    json!("drop"),
                )
                .with_options(vec![
                    PropertyOption::new("Drop them", "drop"),
                    PropertyOption::new("Keep them", "keep"),
                ])
                .describe("What to do with source fields no mapping mentions"),
                NodeProperty::new(
                    "skipMissing",
                    "Skip Missing Sources",
                    NodePropertyKind::Boolean,
                    json!(false),
                )
                .describe("Leave the destination out entirely when its source has no value"),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        // Read the mappings unresolved: a right-hand side is a *path* unless it
        // is an expression, and resolving the whole tree first would erase the
        // difference.
        // Everything here is read unresolved. `static_params` would evaluate
        // the mapping expressions against an empty item, which is exactly the
        // wrong moment — they belong to the item being processed.
        let raw = ctx.object_param(&ctx.node.parameters, "mappings");
        let keep_unmapped = ctx.str_param(&ctx.node.parameters, "mode", "drop") == "keep";
        let skip_missing = ctx.bool_param(&ctx.node.parameters, "skipMissing", false);

        let mut out = Vec::with_capacity(ctx.input.len());
        for idx in 0..ctx.input.len() {
            let item = ctx.item(idx);
            let mut mapped = if keep_unmapped {
                item.clone()
            } else {
                Value::Object(Map::new())
            };

            for (destination, source) in &raw {
                let value = resolve_source(ctx, source, &item, idx)?;
                if skip_missing && value.is_null() {
                    continue;
                }
                set_path(&mut mapped, destination, value);
            }
            out.push(mapped);
        }

        Ok(main_output(out).into())
    }
}

/// Where one destination's value comes from.
fn resolve_source(
    ctx: &ExecuteContext<'_>,
    source: &Value,
    item: &Value,
    idx: usize,
) -> Result<Value> {
    match source {
        // An expression: combine fields, calculate, apply a condition.
        Value::String(text) if text.contains("{{") => {
            Ok(ctx.expression.resolve(source, item, idx, ctx.input)?)
        }
        // A plain string names a field.
        Value::String(path) => Ok(get_path(item, path).cloned().unwrap_or(Value::Null)),
        // Anything else is a constant the user typed.
        other => Ok(other.clone()),
    }
}
