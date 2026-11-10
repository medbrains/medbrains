//! Reading and writing `workflow_*` rows. No decisions here.

use chrono::{DateTime, Utc};
use serde_json::Value;
use uuid::Uuid;

use crate::model::{FlowDef, Station, Switches, Template};
use crate::registry::Tx;
use crate::route;
use medbrains_server_core::error::AppError;

const TEMPLATE: &str = "SELECT id, code, version, status, steps, switches, published_at \
     FROM workflow_templates WHERE tenant_id = $1 AND deleted_at IS NULL";

fn to_json<T: serde::Serialize>(v: &T) -> Result<Value, AppError> {
    serde_json::to_value(v).map_err(|e| AppError::Internal(e.to_string()))
}

/// The published version of `code`, if one exists.
pub async fn published(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    lock: bool,
) -> Result<Option<Template>, AppError> {
    let lock = if lock { " FOR UPDATE" } else { "" };
    Ok(sqlx::query_as::<_, Template>(&format!(
        "{TEMPLATE} AND code = $2 AND scope = 'hospital' AND status = 'published'{lock}"
    ))
    .bind(tenant)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?)
}

pub async fn template_by_id(tx: &mut Tx<'_>, tenant: Uuid, id: Uuid) -> Result<Template, AppError> {
    sqlx::query_as::<_, Template>(&format!("{TEMPLATE} AND id = $2"))
        .bind(tenant)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// The published version, laying down version 1 with the flow's default
/// switches (today's behaviour) the first time a hospital uses the flow.
pub async fn ensure_published(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    flow: &FlowDef,
) -> Result<Template, AppError> {
    if let Some(t) = published(tx, tenant, &flow.code, false).await? {
        return Ok(t);
    }
    sqlx::query(
        "INSERT INTO workflow_templates (tenant_id, code, name, version, steps, switches, status, published_at) \
         VALUES ($1, $2, $3, 1, $4, $5, 'published', now()) ON CONFLICT DO NOTHING",
    )
    .bind(tenant)
    .bind(&flow.code)
    .bind(&flow.name)
    .bind(to_json(&flow.stations)?)
    .bind(Value::Object(route::defaults(flow)))
    .execute(&mut **tx)
    .await?;
    published(tx, tenant, &flow.code, false)
        .await?
        .ok_or_else(|| AppError::Internal("flow was not published".to_owned()))
}

/// Publish new switch settings as the next version and retire the current
/// one, keeping the published track. Running journeys keep the version they
/// started on. Returns the new id.
///
/// # Errors
/// Refuses switches the flow does not allow (a locked signal among them).
pub async fn publish_switches(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    switches: &Switches,
) -> Result<Uuid, AppError> {
    publish(tx, tenant, code, switches, None).await
}

/// Publish the next version: these switches on `track`, or on the current
/// published track when `None`. The caller has checked a new track
/// (`builder::check_proposal`); this re-validates the switches only.
///
/// # Errors
/// Refuses switches the flow does not allow.
pub async fn publish(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    switches: &Switches,
    track: Option<&[Station]>,
) -> Result<Uuid, AppError> {
    let flow = route::find(code).ok_or(AppError::NotFound)?;
    route::validate(&flow, switches).map_err(AppError::BadRequest)?;
    let current = ensure_published(tx, tenant, &flow).await?;
    let steps = match track {
        Some(t) => to_json(&t)?,
        None => current.steps.clone(),
    };
    // Lock it so two applies cannot both read version N.
    published(tx, tenant, code, true).await?;
    sqlx::query("UPDATE workflow_templates SET status = 'retired', is_active = false WHERE tenant_id = $1 AND id = $2")
        .bind(tenant)
        .bind(current.id)
        .execute(&mut **tx)
        .await?;
    Ok(sqlx::query_scalar(
        "INSERT INTO workflow_templates (tenant_id, code, name, version, steps, switches, status, \
                published_at, published_from) \
         SELECT $1, $2, $3, COALESCE(MAX(version), 0) + 1, $4, $5, 'published', now(), $6 \
           FROM workflow_templates WHERE tenant_id = $1 AND code = $2 RETURNING id",
    )
    .bind(tenant)
    .bind(code)
    .bind(&flow.name)
    .bind(steps)
    .bind(Value::Object(switches.clone()))
    .bind(current.id)
    .fetch_one(&mut **tx)
    .await?)
}

/// The template's stations, as pinned when it was published.
pub fn stations(t: &Template) -> Result<Vec<Station>, AppError> {
    serde_json::from_value(t.steps.clone())
        .map_err(|e| AppError::Internal(format!("bad steps: {e}")))
}

pub fn switches(t: &Template) -> Switches {
    t.switches.as_object().cloned().unwrap_or_default()
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub(crate) struct Instance {
    pub id: Uuid,
    pub template_id: Uuid,
    pub subject_id: Option<Uuid>,
    pub status: String,
    pub current_step: i32,
    pub state: Value,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

const INSTANCE: &str = "SELECT id, template_id, subject_id, status::text AS status, \
     current_step, state, started_at, completed_at FROM workflow_instances \
     WHERE tenant_id = $1 AND deleted_at IS NULL";

/// The subject's most recent journey on the flow, locked when asked.
pub(crate) async fn instance_for(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    subject: Uuid,
    lock: bool,
) -> Result<Option<Instance>, AppError> {
    let lock = if lock { " FOR UPDATE" } else { "" };
    Ok(sqlx::query_as::<_, Instance>(&format!(
        "{INSTANCE} AND flow_code = $2 AND subject_id = $3 ORDER BY started_at DESC LIMIT 1{lock}"
    ))
    .bind(tenant)
    .bind(code)
    .bind(subject)
    .fetch_optional(&mut **tx)
    .await?)
}

pub(crate) struct NewInstance<'a> {
    pub tenant: Uuid,
    pub template: &'a Template,
    pub subject_type: &'a str,
    pub subject: Uuid,
    pub patient: Option<Uuid>,
    pub user: Uuid,
}

pub(crate) async fn insert_instance(
    tx: &mut Tx<'_>,
    n: &NewInstance<'_>,
) -> Result<Uuid, AppError> {
    Ok(sqlx::query_scalar(
        "INSERT INTO workflow_instances (tenant_id, template_id, template_version, flow_code, \
                subject_type, subject_id, patient_id, status, started_by, state) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress', $8, '{}'::jsonb) RETURNING id",
    )
    .bind(n.tenant)
    .bind(n.template.id)
    .bind(n.template.version)
    .bind(&n.template.code)
    .bind(n.subject_type)
    .bind(n.subject)
    .bind(n.patient)
    .bind(n.user)
    .fetch_one(&mut **tx)
    .await?)
}

/// Move the journey to `step` (or finish it) and keep its state.
pub(crate) async fn save_instance(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
    step: i32,
    state: &Value,
    finished: bool,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE workflow_instances SET current_step = $3, state = $4, \
                status = CASE WHEN $5 THEN 'completed'::workflow_status ELSE status END, \
                completed_at = CASE WHEN $5 THEN now() ELSE completed_at END \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant)
    .bind(id)
    .bind(step)
    .bind(state)
    .bind(finished)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One station's log row: when the patient arrived and when it cleared.
#[derive(Debug, Clone, sqlx::FromRow)]
pub(crate) struct StepLog {
    pub step_index: i32,
    pub action: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

pub(crate) async fn logs(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    instance: Uuid,
) -> Result<Vec<StepLog>, AppError> {
    Ok(sqlx::query_as::<_, StepLog>(
        "SELECT step_index, action, started_at, completed_at \
           FROM workflow_step_logs WHERE tenant_id = $1 AND instance_id = $2 AND deleted_at IS NULL \
          ORDER BY started_at, step_index LIMIT 200",
    )
    .bind(tenant)
    .bind(instance)
    .fetch_all(&mut **tx)
    .await?)
}

pub(crate) struct LogEntry<'a> {
    pub tenant: Uuid,
    pub instance: Uuid,
    pub index: i32,
    pub key: &'a str,
    pub action: &'a str,
    pub actor: Option<Uuid>,
    pub data: Value,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub sla_met: Option<bool>,
}

pub(crate) async fn insert_log(tx: &mut Tx<'_>, e: &LogEntry<'_>) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO workflow_step_logs (tenant_id, instance_id, step_index, step_name, actor_id, \
                action, data, sla_met, started_at, completed_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(e.tenant)
    .bind(e.instance)
    .bind(e.index)
    .bind(e.key)
    .bind(e.actor)
    .bind(e.action)
    .bind(&e.data)
    .bind(e.sla_met)
    .bind(e.started_at)
    .bind(e.completed_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Close the open `arrived` row for a station.
pub(crate) async fn close_log(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    instance: Uuid,
    index: i32,
    at: DateTime<Utc>,
    sla_met: Option<bool>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE workflow_step_logs SET action = 'cleared', completed_at = $4, sla_met = $5 \
          WHERE tenant_id = $1 AND instance_id = $2 AND step_index = $3 \
            AND action = 'arrived' AND completed_at IS NULL",
    )
    .bind(tenant)
    .bind(instance)
    .bind(index)
    .bind(at)
    .bind(sla_met)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
