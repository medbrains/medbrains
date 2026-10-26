//! The assistant may prepare a research dataset request — never run one.
//!
//! For holders of `research.dataset.export` only. The tool records a request
//! (purpose, IEC reference, dataset, period) exactly as the Data exports
//! screen would, marked as prepared by the assistant. A second holder must
//! approve it there, and only the requester and approver can download it.
//! The model learns that the request exists; it never receives a row.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use medbrains_research::NewExport;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};

#[derive(serde::Deserialize)]
pub(super) struct PrepareArgs {
    dataset: String,
    /// A range placeholder such as `[FY_LAST]`.
    range: String,
    purpose: String,
    iec_reference: String,
}

pub(super) struct PrepareExportTool {
    pub(super) session: super::redaction::Session,
    pub(super) state: AppState,
    pub(super) claims: Claims,
}

impl PrepareExportTool {
    async fn answer(&self, args: PrepareArgs) -> String {
        let (period_from, period_to) = super::aggregate_tool::range(&args.range);
        let new = NewExport {
            dataset: args.dataset,
            period_from,
            period_to,
            purpose: args.purpose,
            iec_reference: args.iec_reference,
        };
        match medbrains_research::create_request(&self.state, &self.claims, &new, "assistant").await
        {
            Ok(row) => json!({
                "prepared": true,
                "dataset": row.dataset,
                "status": "waiting for a second approver",
                "where": "Admin → Research → Data exports",
                "note": "You will not see the data. A different holder of the permission must \
                         approve it; then the requester can download it for 24 hours.",
            })
            .to_string(),
            Err(e) => format!("Not prepared: {e}. Tell the user what is missing."),
        }
    }
}

impl rig::tool::Tool for PrepareExportTool {
    const NAME: &'static str = "prepare_research_export";
    type Error = std::convert::Infallible;
    type Args = PrepareArgs;
    type Output = medbrains_core::ai_redact::Redacted;

    fn description(&self) -> String {
        "Prepare (never run) a request for a de-identified research dataset, when the user asks \
        for data for a study. Needs the dataset (visits, diagnoses, admissions, labs, medicines or vitals), a period \
        placeholder such as [LAST_12_MONTHS] or [FY_LAST], the study's purpose (20+ characters) \
        and its IEC approval reference — ask the user for any they have not given. A second \
        approver must approve it; you never receive the data."
            .to_owned()
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "dataset": { "type": "string", "enum": ["visits", "diagnoses", "admissions", "labs", "medicines", "vitals"] },
                "range": { "type": "string", "description": "e.g. [LAST_12_MONTHS]" },
                "purpose": { "type": "string" },
                "iec_reference": { "type": "string" }
            },
            "required": ["dataset", "range", "purpose", "iec_reference"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        Ok(super::redaction::for_model(
            &self.session,
            &self.answer(args).await,
        ))
    }
}
