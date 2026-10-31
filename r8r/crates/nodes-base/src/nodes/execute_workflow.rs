use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::json;

/// Runs another workflow and continues with what it produced.
///
/// The point is reuse: the six nodes that look up a patient and normalise the
/// result live in one workflow, and everything that needs them calls it.
/// Copying them into each workflow is how they end up disagreeing.
#[derive(Debug)]
pub struct ExecuteWorkflowNode;

#[async_trait]
impl NodeExecutor for ExecuteWorkflowNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "executeWorkflow".into(),
            display_name: "Execute Workflow".into(),
            group: NodeGroup::Flow,
            description: "Run another workflow and carry on with its output".into(),
            icon: "⧉".into(),
            color: "#22c55e".into(),
            properties: vec![
                NodeProperty::new(
                    "workflowId",
                    "Workflow",
                    NodePropertyKind::String,
                    json!(""),
                )
                .required()
                .describe("The id of the workflow to run"),
                NodeProperty::new(
                    "mode",
                    "Run It",
                    NodePropertyKind::Options,
                    json!("onceWithAll"),
                )
                .with_options(vec![
                    PropertyOption::new("Once, with every item", "onceWithAll"),
                    PropertyOption::new("Once for each item", "oncePerItem"),
                ])
                .describe(
                    "Once with everything is one call and one execution. Once per item is \
                         one call each — right when the sub-workflow acts on a single record, \
                         costly when it does not.",
                ),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let params = ctx.static_params()?;
        let workflow_id = ctx.require_str(&params, "workflowId")?;

        if ctx.str_param(&params, "mode", "onceWithAll") == "oncePerItem" {
            let mut out = Vec::with_capacity(ctx.input.len());
            for idx in 0..ctx.input.len() {
                // Resolved per item so the id itself can be an expression —
                // routing to a different sub-workflow per record.
                let per_item = ctx.params(idx)?;
                let target = ctx.require_str(&per_item, "workflowId")?;

                let produced = ctx
                    .sub_workflows
                    .run(&target, vec![ctx.item(idx)], ctx.chain)
                    .await?;
                out.extend(produced);
            }
            return Ok(main_output(out).into());
        }

        let produced = ctx
            .sub_workflows
            .run(&workflow_id, ctx.input.clone(), ctx.chain)
            .await?;
        Ok(main_output(produced).into())
    }
}
