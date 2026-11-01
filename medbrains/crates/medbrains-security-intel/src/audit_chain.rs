//! The audit chain, re-verified every hour for the last hour (RFC-OSINT §3a),
//! on top of the nightly full walk. Tampering is found within the hour, not
//! the next morning.

use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::model::{CheckError, Found, Report, Severity};
use crate::runner::{Check, Ctx};

pub const KEY: &str = "audit_chain";
/// The window overlaps the previous run so no row falls between two runs.
const WINDOW_MINUTES: i64 = 65;

#[derive(Debug)]
pub struct AuditChain;

#[async_trait::async_trait]
impl Check for AuditChain {
    fn key(&self) -> &'static str {
        KEY
    }

    fn per_tenant(&self) -> bool {
        true
    }

    async fn run(&self, ctx: &Ctx, tenant: Option<Uuid>) -> Result<Report, CheckError> {
        let tenant = tenant.ok_or_else(|| CheckError("no hospital given".into()))?;
        let since = Utc::now() - chrono::Duration::minutes(WINDOW_MINUTES);
        let result = medbrains_kernel::audit::verify_since(&ctx.worker, tenant, since).await?;
        let detail = json!({ "rows_checked": result.rows_checked, "since": since });
        let findings = match result.broken_at {
            None => Vec::new(),
            Some(row) => vec![Found {
                asset: "Audit log".to_owned(),
                key: "chain_broken".to_owned(),
                title: "The audit log was changed after it was written".to_owned(),
                severity: Severity::Critical,
                evidence: json!({ "broken_at_row": row, "rows_checked": result.rows_checked }),
                how_to_fix: "Treat as tampering: open an incident, preserve a database \
                             snapshot now, and find who had write access to audit_log."
                    .to_owned(),
                cve_id: None,
            }],
        };
        Ok(Report::found(findings, detail))
    }
}
