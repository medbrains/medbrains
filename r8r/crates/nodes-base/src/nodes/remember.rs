use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::{NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription};
use serde_json::json;

/// Remembers values for the next run.
///
/// This is what turns a workflow that fetches everything every time into one
/// that fetches what changed. Read what was remembered with `{{ state.name }}`
/// anywhere in the workflow; set it here.
///
/// Nothing is written until the run succeeds. A run that advanced its watermark
/// and then failed would skip the records it never processed, and the gap would
/// only surface when somebody asked why one never synced.
#[derive(Debug)]
pub struct RememberNode;

#[async_trait]
impl NodeExecutor for RememberNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "remember".into(),
            display_name: "Remember".into(),
            group: NodeGroup::Transform,
            description: "Save values for the next run, if this one succeeds".into(),
            icon: "⎘".into(),
            color: "#a78bfa".into(),
            properties: vec![
                NodeProperty::new("values", "Remember", NodePropertyKind::KeyValue, json!({}))
                    .required()
                    .describe(
                        "Read back as {{ state.name }} on the next run. A watermark is the \
                         usual one: lastSync = {{ now() }}, or the newest record's timestamp.",
                    ),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        // Resolved against the last item rather than each one: a watermark is
        // one value for the batch, and staging it per item would leave whichever
        // happened to be last, which is not a decision anybody made.
        let last = ctx.input.len().saturating_sub(1);
        let params = ctx.params(last)?;

        for (key, value) in ctx.object_param(&params, "values") {
            ctx.remember(&key, value);
        }

        Ok(main_output(ctx.input.clone()).into())
    }
}
