//! A report as a dashboard widget.
//!
//! The dashboard places a report's chart on a reader's own dashboard, and asks
//! this crate what to call it and whether the reader may see it: the catalogue
//! and its permissions live here.

use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::is_bypass_role;

use crate::reports::{ReportDataKind, can_access_report, find_report};

/// What a report widget is: its name, the one permission its viewer holds
/// for it (the widget is gated on that), and whether it has data to draw.
#[derive(Debug, Clone)]
pub struct ReportWidgetSpec {
    pub title: String,
    pub purpose: String,
    pub permission: String,
    pub wired: bool,
}

/// The report `report_id` as a widget, if it exists and the caller may read
/// it; none otherwise, so a refusal does not confirm the report exists.
#[must_use]
pub fn report_for_widget(claims: &Claims, report_id: &str) -> Option<ReportWidgetSpec> {
    let report = find_report(report_id)?;
    if !can_access_report(claims, &report.definition) {
        return None;
    }
    let definition = report.definition;
    let held = definition
        .permissions
        .iter()
        .find(|p| is_bypass_role(claims) || claims.permissions.contains(p))
        .cloned()?;
    Some(ReportWidgetSpec {
        title: definition.title,
        purpose: definition.purpose,
        permission: held,
        wired: !matches!(report.data_kind, ReportDataKind::NotWired),
    })
}
