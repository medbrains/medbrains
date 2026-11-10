use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use r8r_core::execute_context::main_output;
use r8r_core::{CoreError, ExecuteContext, NodeExecutor, NodeOutcome, Result, Suspension};
use r8r_workflow::node_helpers::millis;
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use serde_json::json;
use std::time::Duration as StdDuration;

/// Pauses the workflow.
///
/// A short pause is just a pause — the run holds still and carries on, which is
/// what respecting a rate limit needs. Anything longer is not something to hold
/// a process open for: the run stops, and what it was carrying is written down
/// so it can continue after a deploy, a crash, or three days.
#[derive(Debug)]
pub struct WaitNode;

/// The longest a run will simply hold still.
///
/// Beyond this the wait is recorded rather than slept through — a task sleeping
/// in memory is lost the next time r8r restarts, and the workflow would then
/// never finish and never say so.
const MAX_INLINE_WAIT_MS: u64 = 60_000;

#[async_trait]
impl NodeExecutor for WaitNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "wait".into(),
            display_name: "Wait".into(),
            group: NodeGroup::Flow,
            description: "Pause, until a moment arrives or somebody approves".into(),
            icon: "⏸".into(),
            color: "#94a3b8".into(),
            properties: vec![
                NodeProperty::new(
                    "mode",
                    "Wait For",
                    NodePropertyKind::Options,
                    json!("duration"),
                )
                .with_options(vec![
                    PropertyOption::new("An amount of time", "duration"),
                    PropertyOption::new("A specific moment", "until"),
                    PropertyOption::new("Someone to approve", "approval"),
                ]),
                NodeProperty::new("ms", "Milliseconds", NodePropertyKind::Number, json!(1000))
                    .show_when("mode", &["duration"])
                    .describe(
                        "Under a minute the run holds still. Longer than that it is written \
                         down and continues later, so a restart cannot lose it.",
                    ),
                NodeProperty::new("until", "Resume At", NodePropertyKind::String, json!(""))
                    .show_when("mode", &["until"])
                    .required()
                    .placeholder("2026-09-01T09:00:00Z")
                    .describe("An RFC 3339 timestamp, or an expression producing one"),
                NodeProperty::new(
                    "reason",
                    "What Is Being Waited For",
                    NodePropertyKind::String,
                    json!(""),
                )
                .show_when("mode", &["approval"])
                .required()
                .placeholder("Pharmacist to review the prescription")
                .describe("Shown to whoever finds this run waiting"),
            ],
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let params = ctx.static_params()?;

        match ctx.str_param(&params, "mode", "duration").as_str() {
            // Never resumes on its own: a prescription must not continue as
            // though a pharmacist had approved it because time went by.
            "approval" => {
                let reason = ctx.require_str(&params, "reason")?;
                Ok(NodeOutcome::Suspend(Box::new(Suspension::for_approval(
                    &reason,
                    ctx.input.clone(),
                ))))
            }

            "until" => {
                let raw = ctx.require_str(&params, "until")?;
                let resume_at = parse_moment(&raw)?;
                Ok(NodeOutcome::Suspend(Box::new(Suspension::until(
                    resume_at,
                    ctx.input.clone(),
                ))))
            }

            _ => wait_for(ctx, &params).await,
        }
    }
}

/// A duration: held inline while it is short, recorded once it is not.
async fn wait_for(ctx: &ExecuteContext<'_>, params: &serde_json::Value) -> Result<NodeOutcome> {
    let ms = millis(ctx.num_param(params, "ms", 1000.0), u64::MAX);

    if ms <= MAX_INLINE_WAIT_MS {
        tokio::time::sleep(StdDuration::from_millis(ms)).await;
        return Ok(main_output(ctx.input.clone()).into());
    }

    let resume_at = Utc::now() + Duration::milliseconds(i64::try_from(ms).unwrap_or(i64::MAX));
    Ok(NodeOutcome::Suspend(Box::new(Suspension::until(
        resume_at,
        ctx.input.clone(),
    ))))
}

fn parse_moment(raw: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw.trim())
        .map(|moment| moment.with_timezone(&Utc))
        .map_err(|e| {
            CoreError::Node(format!(
                "`{raw}` is not a moment this can wait until — expected something like \
                 2026-09-01T09:00:00Z ({e})"
            ))
        })
}
