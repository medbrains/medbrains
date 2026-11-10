use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::ensure_one;
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::json;

/// Exposes `/webhook/<path>`. The server matches the request to this node and
/// passes `{ body, query, headers, method }` in as the first item.
#[derive(Debug)]
pub struct WebhookTrigger;

#[async_trait]
impl NodeExecutor for WebhookTrigger {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "webhook".into(),
            display_name: "Webhook".into(),
            group: NodeGroup::Trigger,
            description: "Runs the workflow when an HTTP request hits its URL".into(),
            icon: "🔗".into(),
            color: "#0ea5e9".into(),
            properties: vec![
                NodeProperty::new("path", "Path", NodePropertyKind::String, json!("my-hook"))
                    .required()
                    .placeholder("my-hook")
                    .describe("Served at /webhook/<path>"),
                NodeProperty::new(
                    "method",
                    "HTTP Method",
                    NodePropertyKind::Options,
                    json!("POST"),
                )
                .with_options(vec![
                    PropertyOption::new("GET", "GET"),
                    PropertyOption::new("POST", "POST"),
                    PropertyOption::new("PUT", "PUT"),
                    PropertyOption::new("PATCH", "PATCH"),
                    PropertyOption::new("DELETE", "DELETE"),
                    PropertyOption::new("Any", "ANY"),
                ]),
                NodeProperty::new(
                    "idempotencyKey",
                    "Idempotency Key",
                    NodePropertyKind::String,
                    json!(""),
                )
                .placeholder("{{ item.headers[\"idempotency-key\"] }}")
                .describe(
                    "What identifies this event. Set it, and a repeat of the same request \
                     replays the first response instead of running again. Senders retry \
                     whenever they do not get a timely answer, so without this a retry \
                     does the work twice. Leave blank to treat every request as new.",
                ),
                NodeProperty::new(
                    "respond",
                    "Respond With",
                    NodePropertyKind::Options,
                    json!("lastNode"),
                )
                .with_options(vec![
                    PropertyOption::new("Last node's output", "lastNode"),
                    PropertyOption::new("Immediately (202)", "immediately"),
                ])
                .describe("Whether the caller waits for the workflow to finish"),
            ],
            outputs: vec!["main".into()],
            inputs: vec![],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        Ok(main_output(ensure_one(ctx.input.clone())).into())
    }
}
