use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{CoreError, ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_formats::Format;
use r8r_workflow::node_helpers::get_path;
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::{Value, json};

/// Renders items as text in a chosen format.
///
/// The counterpart to Parse Data: the step before posting a SOAP envelope,
/// writing a CSV export, or handing YAML to something that expects it.
#[derive(Debug)]
pub struct ConvertDataNode;

#[async_trait]
impl NodeExecutor for ConvertDataNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "convertData".into(),
            display_name: "Convert Data".into(),
            group: NodeGroup::Transform,
            description: "Write items out as XML, YAML, TOML, CSV, form or JSON text".into(),
            icon: "⇥".into(),
            color: "#38bdf8".into(),
            properties: vec![
                NodeProperty::new("format", "Format", NodePropertyKind::Options, json!("json"))
                    .with_options(format_options()),
                NodeProperty::new(
                    "sourceField",
                    "Source Field",
                    NodePropertyKind::String,
                    json!(""),
                )
                .describe("Dot path to convert. Leave blank to convert the whole item."),
                NodeProperty::new(
                    "targetField",
                    "Put Text In",
                    NodePropertyKind::String,
                    json!("data"),
                )
                .required(),
                NodeProperty::new(
                    "mode",
                    "Convert",
                    NodePropertyKind::Options,
                    json!("eachItem"),
                )
                .with_options(vec![
                    PropertyOption::new("Each item separately", "eachItem"),
                    PropertyOption::new("All items into one document", "allItems"),
                ])
                .describe("CSV exports usually want all items in one document"),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let params = ctx.static_params()?;
        let format = Format::parse_name(&ctx.str_param(&params, "format", "json"));
        let source_field = ctx.str_param(&params, "sourceField", "");
        let target = {
            let named = ctx.str_param(&params, "targetField", "data");
            if named.is_empty() {
                "data".to_owned()
            } else {
                named
            }
        };

        let pick = |item: &Value| -> Value {
            if source_field.is_empty() {
                item.clone()
            } else {
                get_path(item, &source_field)
                    .cloned()
                    .unwrap_or(Value::Null)
            }
        };

        if ctx.str_param(&params, "mode", "eachItem") == "allItems" {
            let payload = Value::Array(ctx.input.iter().map(&pick).collect());
            let text = r8r_formats::serialize(&payload, format)
                .map_err(|e| CoreError::Node(e.to_string()))?;
            return Ok(main_output(vec![json!({
                target: text,
                "contentType": format.content_type(),
                "itemCount": ctx.input.len(),
            })])
            .into());
        }

        let mut out = Vec::with_capacity(ctx.input.len());
        for idx in 0..ctx.input.len() {
            let item = ctx.item(idx);
            let text = r8r_formats::serialize(&pick(&item), format)
                .map_err(|e| CoreError::Node(e.to_string()))?;
            out.push(json!({ target.clone(): text, "contentType": format.content_type() }));
        }
        Ok(main_output(out).into())
    }
}

fn format_options() -> Vec<PropertyOption> {
    vec![
        PropertyOption::new("JSON", "json"),
        PropertyOption::new("XML", "xml"),
        PropertyOption::new("YAML", "yaml"),
        PropertyOption::new("TOML", "toml"),
        PropertyOption::new("CSV", "csv"),
        PropertyOption::new("Form URL-Encoded", "form"),
        PropertyOption::new("Excel workbook (.xlsx, base64)", "xlsx"),
        PropertyOption::new("Plain text", "text"),
    ]
}
