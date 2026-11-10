use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{CoreError, ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_formats::Format;
use r8r_workflow::node_helpers::{as_item, get_path, set_path};
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::{Value, json};

/// Turns text in any supported format into structured items.
///
/// Not every system speaks JSON: this is how a SOAP response, a CSV export or
/// a YAML config becomes items the rest of the workflow can work with.
#[derive(Debug)]
pub struct ParseDataNode;

#[async_trait]
impl NodeExecutor for ParseDataNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "parseData".into(),
            display_name: "Parse Data".into(),
            group: NodeGroup::Transform,
            description: "Read XML, SOAP, YAML, TOML, CSV, form or JSON text into items".into(),
            icon: "⇤".into(),
            color: "#38bdf8".into(),
            properties: vec![
                NodeProperty::new(
                    "sourceField",
                    "Source Field",
                    NodePropertyKind::String,
                    json!("body"),
                )
                .describe("Dot path to the text to parse. Leave blank to use the whole item."),
                NodeProperty::new("format", "Format", NodePropertyKind::Options, json!("auto"))
                    .with_options(format_options()),
                NodeProperty::new(
                    "targetField",
                    "Put Result In",
                    NodePropertyKind::String,
                    json!(""),
                )
                .describe("Leave blank to replace the item with what was parsed"),
                NodeProperty::new(
                    "splitArrays",
                    "Split Arrays Into Items",
                    NodePropertyKind::Boolean,
                    json!(true),
                )
                .describe("A CSV or a JSON array becomes one item per row"),
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
            let item = ctx.item(idx);

            let source_field = ctx.str_param(&params, "sourceField", "body");
            let source = if source_field.is_empty() {
                Some(&item)
            } else {
                get_path(&item, &source_field)
            };

            let Some(source) = source else {
                return Err(CoreError::Node(format!(
                    "`{source_field}` is not present on this item, so there is nothing to parse"
                )));
            };

            let text = match source {
                Value::String(text) => text.clone(),
                // Already structured: nothing to parse, pass it through.
                other => {
                    out.extend(place(ctx, &params, &item, other.clone()));
                    continue;
                }
            };

            let format = Format::parse_name(&ctx.str_param(&params, "format", "auto"));
            let parsed =
                r8r_formats::parse(&text, format).map_err(|e| CoreError::Node(e.to_string()))?;

            out.extend(place(ctx, &params, &item, parsed));
        }

        Ok(main_output(out).into())
    }
}

/// Put the parsed value where the node was told to, splitting arrays when
/// asked — which is what makes a CSV behave like a list of records.
fn place(ctx: &ExecuteContext<'_>, params: &Value, original: &Value, parsed: Value) -> Vec<Value> {
    let target = ctx.str_param(params, "targetField", "");
    let split = ctx.bool_param(params, "splitArrays", true);

    if target.is_empty() {
        return match parsed {
            Value::Array(entries) if split => entries.into_iter().map(as_item).collect(),
            other => vec![as_item(other)],
        };
    }

    let mut item = original.clone();
    set_path(&mut item, &target, parsed);
    vec![item]
}

fn format_options() -> Vec<PropertyOption> {
    vec![
        PropertyOption::new("Detect automatically", "auto"),
        PropertyOption::new("JSON", "json"),
        PropertyOption::new("XML", "xml"),
        PropertyOption::new("SOAP (unwrap envelope)", "soap"),
        PropertyOption::new("YAML", "yaml"),
        PropertyOption::new("TOML", "toml"),
        PropertyOption::new("CSV", "csv"),
        PropertyOption::new("Form URL-Encoded", "form"),
        PropertyOption::new("Excel workbook (.xlsx, base64)", "xlsx"),
        PropertyOption::new("Plain text", "text"),
    ]
}
