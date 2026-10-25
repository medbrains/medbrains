//! The assistant's one tool for hospital-wide counts ([`super::aggregate`],
//! [`super::revenue`]): the model names an approved metric and a date
//! placeholder; the server computes, shelves the result for a widget and
//! tells the model only what it needs.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use chrono::NaiveDate;
use medbrains_core::ai_widgets::compact_for_model;
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};

use super::aggregate::{Metric, can_list, counts};
use super::revenue;

#[derive(serde::Deserialize)]
pub(super) struct AggregateArgs {
    metric: String,
    /// A range placeholder such as `[LAST_30_DAYS]`; that one when absent.
    #[serde(default)]
    range: String,
}

/// The assistant's one tool for hospital-wide counts.
pub(super) struct AggregateTool {
    pub(super) session: super::redaction::Session,
    pub(super) state: AppState,
    pub(super) claims: Claims,
    pub(super) shelf: super::show::Shelf,
}

/// `[from, to]` from a range placeholder, the last 30 days by default.
fn range(placeholder: &str) -> (NaiveDate, NaiveDate) {
    let today = chrono::Local::now().date_naive();
    let name = if placeholder.trim().is_empty() {
        "[LAST_30_DAYS]"
    } else {
        placeholder.trim()
    };
    let filled = super::dates::fill(&format!("?{name}"), today);
    let get = |k: &str| {
        filled
            .split(['?', '&'])
            .find_map(|kv| kv.strip_prefix(k)?.strip_prefix('=')?.parse().ok())
    };
    match (get("from"), get("to")) {
        (Some(from), Some(to)) => (from, to),
        _ => (today - chrono::Days::new(29), today),
    }
}

impl AggregateTool {
    async fn answer(&self, args: &AggregateArgs) -> String {
        let (from, to) = range(&args.range);
        if args.metric.trim() == revenue::METRIC {
            return self.revenue((from, to)).await;
        }
        let Some(metric) = Metric::parse(args.metric.trim()) else {
            return format!(
                "Unknown metric {:?}. Approved: allergies, diagnoses, \
                 opd_visits_by_department, admissions_by_day, critical_lab_alerts, \
                 revenue_by_period.",
                args.metric
            );
        };
        match counts(&self.state, &self.claims, metric, (from, to)).await {
            Ok(mut result) => {
                if can_list(&self.claims) {
                    result["_drill"] = json!({
                        "metric": metric.name(),
                        "key": metric.fields().0,
                        "from": from.to_string(),
                        "to": to.to_string(),
                    });
                }
                let source = format!("aggregate:{}", metric.name());
                super::show::shelve(&self.shelf, &self.session, &source, &result);
                if let Some(o) = result.as_object_mut() {
                    o.remove("_drill");
                    o.insert("show_source".to_owned(), json!(source));
                }
                result.to_string()
            }
            Err(e) => {
                tracing::warn!(target: "ai", error = %e, "aggregate failed");
                super::UNKNOWN_FOR_MODEL.to_owned()
            }
        }
    }
}

impl AggregateTool {
    /// Billed, collected and invoices per day, week or month over the range,
    /// for a user who may read the billing reports.
    async fn revenue(&self, range: (NaiveDate, NaiveDate)) -> String {
        if require_permission(&self.claims, permissions::billing::reports::VIEW).is_err() {
            return "Not available to this user: revenue needs the billing reports permission."
                .to_owned();
        }
        match revenue::by_period(&self.state, &self.claims, range).await {
            Ok(result) => {
                let source = format!("aggregate:{}", revenue::METRIC);
                super::show::shelve(&self.shelf, &self.session, &source, &result);
                let mut told = compact_for_model(&result);
                told["show_source"] = json!(source);
                told.to_string()
            }
            Err(e) => {
                tracing::warn!(target: "ai", error = %e, "revenue aggregate failed");
                super::UNKNOWN_FOR_MODEL.to_owned()
            }
        }
    }
}

impl rig::tool::Tool for AggregateTool {
    const NAME: &'static str = "aggregate";
    type Error = std::convert::Infallible;
    type Args = AggregateArgs;
    type Output = medbrains_core::ai_redact::Redacted;

    fn description(&self) -> String {
        "Hospital-wide counts over the patients this user may see, for questions about many \
        patients at once (never one patient's record). metric: allergies (patients per \
        allergen), diagnoses (patients per ICD code), opd_visits_by_department, \
        admissions_by_day, critical_lab_alerts (per parameter), revenue_by_period (billed, \
        collected and invoices per day, week or month — chosen from the range — with exact \
        totals). range: a date placeholder such as [LAST_30_DAYS] (the default), \
        [LAST_12_MONTHS] or [FY_THIS]. Show the result with show(source = \
        its show_source); a count shown as \"<5\" is small and stays that way."
            .to_owned()
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "metric": { "type": "string", "enum": [
                    "allergies", "diagnoses", "opd_visits_by_department",
                    "admissions_by_day", "critical_lab_alerts", "revenue_by_period"
                ] },
                "range": { "type": "string", "description": "e.g. [LAST_30_DAYS]" }
            },
            "required": ["metric"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        Ok(super::redaction::for_model(
            &self.session,
            &self.answer(&args).await,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::range;

    #[test]
    fn a_range_placeholder_becomes_from_and_to() {
        let (from, to) = range("[LAST_7_DAYS]");
        assert_eq!((to - from).num_days(), 6);
        let (from, to) = range("");
        assert_eq!((to - from).num_days(), 29);
        let (from, to) = range("[LAST_12_MONTHS]");
        assert!((364..=365).contains(&(to - from).num_days()));
    }
}
