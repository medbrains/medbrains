//! Adapter: `flow_switches`, a hospital's switch settings on a library flow
//! (RFC-SOP-FLOWS §3.3). One row per flow: its code and every switch value,
//! flat so the change-set diff shows one field per switch.
//!
//! Applying publishes the next version of the flow; journeys already running
//! stay pinned to the version they started on. Locked safety signals are not
//! switches, so a row naming one fails validation.

use medbrains_core::permissions;
use medbrains_sop_flows::{catalog, model::Switches, route, store};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::adapter::{Adapter, Planned, Tx};
use crate::model::{KnowledgeImpactEntry, KnowledgeImpactExample, Op, Severity};

pub(crate) struct FlowSwitches;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct FlowSwitchRow {
    pub(crate) flow_code: String,
    #[serde(flatten)]
    pub(crate) switches: Switches,
}

/// The adapter trait speaks `sqlx::Error`; a flow error past validation is
/// unexpected, so it travels as a protocol error (a 500), never silently.
fn db(e: &medbrains_server_core::error::AppError) -> sqlx::Error {
    sqlx::Error::Protocol(e.to_string())
}

/// The library flow an item names, if it is one.
pub(crate) fn clinical(code: &str) -> Option<bool> {
    route::find(code).map(|f| f.clinical)
}

async fn row_for(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    lock: bool,
) -> Result<Option<(Uuid, FlowSwitchRow)>, sqlx::Error> {
    let t = store::published(tx, tenant, code, lock)
        .await
        .map_err(|e| db(&e))?;
    Ok(t.map(|t| {
        let row = FlowSwitchRow {
            flow_code: code.to_owned(),
            switches: store::switches(&t),
        };
        (t.id, row)
    }))
}

impl Adapter for FlowSwitches {
    const KIND: &'static str = "workflow_templates";
    const MANAGE: &'static [&'static str] = &[permissions::flows::SWITCH];
    type Row = FlowSwitchRow;
    type State = ();

    fn validate(row: &FlowSwitchRow) -> Result<(), String> {
        let flow = route::find(&row.flow_code)
            .ok_or_else(|| format!("No library flow \"{}\"", row.flow_code))?;
        route::validate(&flow, &row.switches)
    }

    /// Switch settings are changed, never removed.
    fn deactivated(row: &FlowSwitchRow) -> FlowSwitchRow {
        row.clone()
    }

    async fn list(
        tx: &mut Tx<'_>,
        tenant: Uuid,
    ) -> Result<Vec<(Uuid, FlowSwitchRow)>, sqlx::Error> {
        let mut out = Vec::new();
        for f in route::library() {
            out.extend(row_for(tx, tenant, &f.code, false).await?);
        }
        Ok(out)
    }

    /// The published settings of the target's flow: a target retired by a
    /// later apply still resolves to what is live now, so drift shows.
    async fn current(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        target: Option<Uuid>,
        after: Option<&FlowSwitchRow>,
    ) -> Result<Option<FlowSwitchRow>, sqlx::Error> {
        let code = match (target, after) {
            (Some(id), _) => match store::template_by_id(tx, tenant, id).await {
                Ok(t) => t.code,
                Err(medbrains_server_core::error::AppError::NotFound) => return Ok(None),
                Err(e) => return Err(db(&e)),
            },
            (None, Some(row)) => row.flow_code.clone(),
            (None, None) => return Ok(None),
        };
        Ok(row_for(tx, tenant, &code, true).await?.map(|(_, row)| row))
    }

    async fn write(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        op: Op,
        _target: Option<Uuid>,
        after: Option<&FlowSwitchRow>,
    ) -> Result<Uuid, sqlx::Error> {
        let (Op::Update, Some(row)) = (op, after) else {
            return Err(sqlx::Error::Protocol(
                "flow switches are only ever updated".to_owned(),
            ));
        };
        store::publish_switches(tx, tenant, &row.flow_code, &row.switches)
            .await
            .map_err(|e| db(&e))
    }

    // The trait is async; this adapter needs no reads to compare routes.
    #[allow(clippy::unused_async_trait_impl)]
    async fn observe(
        _tx: &mut Tx<'_>,
        _tenant: Uuid,
        _items: &[Planned<FlowSwitchRow>],
    ) -> Result<(), sqlx::Error> {
        Ok(())
    }

    async fn impact(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<FlowSwitchRow>],
        _before: (),
        _after: (),
    ) -> Result<Vec<KnowledgeImpactEntry>, sqlx::Error> {
        let mut out = Vec::new();
        for item in items {
            let (Some(before), Some(after)) = (&item.before, &item.after) else {
                continue;
            };
            let Some(flow) = route::find(&after.flow_code) else {
                continue;
            };
            let report =
                catalog::impact_lines(tx, tenant, &flow, &before.switches, &after.switches)
                    .await
                    .map_err(|e| db(&e))?;
            if !report.route_changes.is_empty() {
                out.push(KnowledgeImpactEntry {
                    severity: Severity::Info,
                    relation: "route".to_owned(),
                    summary: report.route_changes.join("; "),
                    count: i64::try_from(report.route_changes.len()).unwrap_or(i64::MAX),
                    examples: Vec::new(),
                    truncated: false,
                });
            }
            out.extend(report.entries.into_iter().map(|l| {
                KnowledgeImpactEntry {
                    severity: match l.severity.as_str() {
                        "safety" => Severity::Safety,
                        "money" => Severity::Money,
                        _ => Severity::Info,
                    },
                    relation: l.relation,
                    summary: l.summary,
                    count: l.count,
                    examples: l
                        .examples
                        .into_iter()
                        .map(|e| KnowledgeImpactExample {
                            label: e.label,
                            href: e.href,
                        })
                        .collect(),
                    truncated: l.truncated,
                }
            }));
        }
        Ok(out)
    }
}
