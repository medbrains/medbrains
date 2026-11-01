//! Reading flows for the switchboard: the definition, the published
//! settings, who is on it, the pending change and its history — one round
//! trip — and the impact a proposed switch change would have.

use medbrains_core::permissions;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::engine::{begin, flow};
use crate::model::{
    FlowDef, FlowDetail, FlowSummary, HistoryEntry, ImpactExample, ImpactLine, ImpactReport,
    PendingChange, Switches, VersionCount,
};
use crate::registry::Tx;
use crate::{route, store};

/// Most example patients an impact line carries.
const MAX_EXAMPLES: i64 = 20;
const HISTORY: i64 = 10;

/// # Errors
/// Forbidden without `flows.view`.
pub async fn list(pool: &PgPool, claims: &Claims) -> Result<Vec<FlowSummary>, AppError> {
    require_permission(claims, permissions::flows::VIEW)?;
    let mut tx = begin(pool, claims).await?;
    let mut out = Vec::new();
    for f in route::library() {
        let version = store::published(&mut tx, claims.tenant_id, &f.code, false)
            .await?
            .map(|t| t.version);
        let in_flight = in_flight(&mut tx, claims.tenant_id, &f.code)
            .await?
            .iter()
            .map(|v| v.patients)
            .sum();
        out.push(FlowSummary {
            code: f.code,
            name: f.name,
            module: f.module,
            version,
            in_flight,
        });
    }
    tx.commit().await?;
    Ok(out)
}

async fn in_flight(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
) -> Result<Vec<VersionCount>, AppError> {
    Ok(sqlx::query_as::<_, VersionCount>(
        "SELECT COALESCE(template_version, 0) AS version, COUNT(*) AS patients FROM workflow_instances \
          WHERE tenant_id = $1 AND flow_code = $2 AND status = 'in_progress' AND deleted_at IS NULL \
          GROUP BY 1 ORDER BY 1",
    )
    .bind(tenant)
    .bind(code)
    .fetch_all(&mut **tx)
    .await?)
}

/// Change sets carry the flow code in each item's `after`.
const FLOW_SETS: &str = "FROM knowledge_change_sets s \
    JOIN knowledge_change_items i ON i.change_set_id = s.id AND i.deleted_at IS NULL \
    WHERE s.tenant_id = $1 AND s.area = 'flow_switches' AND s.deleted_at IS NULL \
      AND i.after->>'flow_code' = $2";

async fn pending(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
) -> Result<Option<PendingChange>, AppError> {
    Ok(sqlx::query_as::<_, PendingChange>(&format!(
        "SELECT s.id, s.status, s.title, \
                ((s.approver_id IS NOT NULL)::int + (s.second_approver_id IS NOT NULL)::int) AS approvals, \
                i.after {FLOW_SETS} AND s.status IN ('draft', 'previewed', 'approved', 'stale') \
          ORDER BY s.created_at DESC LIMIT 1"
    ))
    .bind(tenant)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn history(tx: &mut Tx<'_>, tenant: Uuid, code: &str) -> Result<Vec<HistoryEntry>, AppError> {
    Ok(sqlx::query_as::<_, HistoryEntry>(
        "SELECT s.id AS change_set_id, s.title, s.applied_at, au.full_name AS author_name, \
                ap.full_name AS approver_name, ap2.full_name AS second_approver_name, i.before, i.after \
           FROM knowledge_change_sets s \
           JOIN knowledge_change_items i ON i.change_set_id = s.id AND i.deleted_at IS NULL \
           LEFT JOIN users au ON au.id = s.author_id \
           LEFT JOIN users ap ON ap.id = s.approver_id \
           LEFT JOIN users ap2 ON ap2.id = s.second_approver_id \
          WHERE s.tenant_id = $1 AND s.area = 'flow_switches' AND s.deleted_at IS NULL \
            AND i.after->>'flow_code' = $2 AND s.applied_at IS NOT NULL \
          ORDER BY s.applied_at DESC LIMIT $3",
    )
    .bind(tenant)
    .bind(code)
    .bind(HISTORY)
    .fetch_all(&mut **tx)
    .await?)
}

/// Everything the switchboard and the map draw, in one response.
///
/// # Errors
/// Forbidden without `flows.view`; not found for an unknown flow.
pub async fn detail(pool: &PgPool, claims: &Claims, code: &str) -> Result<FlowDetail, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::VIEW)?;
    let mut tx = begin(pool, claims).await?;
    let t = store::ensure_published(&mut tx, claims.tenant_id, &flow).await?;
    let detail = FlowDetail {
        code: flow.code.clone(),
        name: flow.name.clone(),
        clinical: flow.clinical,
        template_id: t.id,
        version: t.version,
        status: t.status.clone(),
        published_at: t.published_at,
        switches: t.switches.clone(),
        switch_defs: flow.switches.clone(),
        // The map shows the stations as code defines them now; running
        // journeys keep their own pinned snapshot.
        stations: flow.stations.clone(),
        in_flight: in_flight(&mut tx, claims.tenant_id, code).await?,
        pending_change: pending(&mut tx, claims.tenant_id, code).await?,
        history: history(&mut tx, claims.tenant_id, code).await?,
        path: format!("Hospital › {}", flow.name),
    };
    tx.commit().await?;
    Ok(detail)
}

#[derive(sqlx::FromRow)]
struct Rider {
    admission_id: Uuid,
    label: String,
    total: i64,
}

/// Patients in discharge now (optionally only insurance ones), with a count.
async fn riders(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    insurance_only: bool,
) -> Result<(i64, Vec<ImpactExample>), AppError> {
    let rows = sqlx::query_as::<_, Rider>(
        "SELECT a.id AS admission_id, concat_ws(' ', p.first_name, p.last_name, '(' || p.uhid || ')') AS label, \
                COUNT(*) OVER () AS total \
           FROM workflow_instances w JOIN admissions a ON a.id = w.subject_id AND a.tenant_id = w.tenant_id \
           JOIN patients p ON p.id = a.patient_id \
          WHERE w.tenant_id = $1 AND w.flow_code = $2 AND w.status = 'in_progress' AND w.deleted_at IS NULL \
            AND (NOT $3 OR EXISTS (SELECT 1 FROM pre_authorization_requests r WHERE r.tenant_id = $1 \
                  AND r.encounter_id = a.encounter_id AND r.deleted_at IS NULL \
                  AND r.status IN ('pending', 'submitted', 'approved'))) \
          ORDER BY w.started_at LIMIT $4",
    )
    .bind(tenant)
    .bind(code)
    .bind(insurance_only)
    .bind(MAX_EXAMPLES)
    .fetch_all(&mut **tx)
    .await?;
    let total = rows.first().map_or(0, |r| r.total);
    let examples = rows
        .into_iter()
        .map(|r| ImpactExample {
            label: r.label,
            href: Some(format!("/ipd/admissions/{}", r.admission_id)),
        })
        .collect();
    Ok((total, examples))
}

fn line(
    severity: &str,
    relation: &str,
    summary: String,
    (count, examples): (i64, Vec<ImpactExample>),
) -> ImpactLine {
    let truncated = count > MAX_EXAMPLES;
    ImpactLine {
        severity: severity.to_owned(),
        relation: relation.to_owned(),
        summary,
        count,
        examples,
        truncated,
    }
}

fn people(n: i64) -> String {
    if n == 1 {
        "1 patient".to_owned()
    } else {
        format!("{n} patients")
    }
}

/// What moving `code` from `before` to `after` changes, and who it touches.
/// Shared by the switchboard's preview and the change-set adapter.
///
/// # Errors
/// Bad request when `after` is not allowed (a locked signal among it).
pub async fn impact_lines(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    flow: &FlowDef,
    before: &Switches,
    after: &Switches,
) -> Result<ImpactReport, AppError> {
    route::validate(flow, after).map_err(AppError::BadRequest)?;
    let route_changes = route::route_changes(flow, before, after);
    let mut entries = Vec::new();
    if !route_changes.is_empty() {
        let all = riders(tx, tenant, &flow.code, false).await?;
        let summary = format!(
            "{} in discharge now stay on their current route; discharges started after this is applied follow the new one",
            people(all.0)
        );
        entries.push(line("info", "in_flight", summary, all));
    }
    for def in flow
        .switches
        .iter()
        .filter(|d| before.get(&d.key) != after.get(&d.key))
    {
        let by_fact = flow.stations.iter().any(|s| {
            !s.fact_when.is_null()
                && s.switch_when
                    .as_object()
                    .is_some_and(|c| c.contains_key(&def.key))
        });
        if !by_fact {
            continue;
        }
        let affected = riders(tx, tenant, &flow.code, true).await?;
        let skips = after.get(&def.key) == Some(&Value::Bool(false));
        let summary = format!(
            "{} with insurance in discharge now; new insurance discharges would {} TPA clearance",
            people(affected.0),
            if skips {
                "no longer wait for"
            } else {
                "wait for"
            }
        );
        // Dropping a check is graded money: a cashless bill could settle unapproved.
        entries.push(line(
            if skips { "money" } else { "info" },
            "insurance_in_flight",
            summary,
            affected,
        ));
    }
    Ok(ImpactReport {
        route_changes,
        entries,
    })
}

/// The switchboard's "Preview": route change and impact, nothing written.
///
/// # Errors
/// Forbidden without `flows.switch`; bad request for switches not allowed.
pub async fn impact(
    pool: &PgPool,
    claims: &Claims,
    code: &str,
    after: &Switches,
) -> Result<ImpactReport, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::SWITCH)?;
    let mut tx = begin(pool, claims).await?;
    let t = store::ensure_published(&mut tx, claims.tenant_id, &flow).await?;
    let report = impact_lines(
        &mut tx,
        claims.tenant_id,
        &flow,
        &store::switches(&t),
        after,
    )
    .await?;
    tx.commit().await?;
    Ok(report)
}
