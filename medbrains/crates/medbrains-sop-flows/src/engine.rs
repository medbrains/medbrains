//! The service layer: every operation checks its own permission, so HTTP is
//! not the only guard (RFC-AUTHZ rule 4).

use chrono::Utc;
use medbrains_core::permissions;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

use crate::model::{FlowDef, RunRequest, StationKind, Ticket};
use crate::registry::{self, Subject, Tx};
use crate::route;
use crate::store::{self, NewInstance};
use crate::walk::{self, Journey};

pub(crate) async fn begin<'a>(pool: &'a PgPool, claims: &Claims) -> Result<Tx<'a>, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

pub(crate) fn flow(code: &str) -> Result<FlowDef, AppError> {
    route::find(code).ok_or(AppError::NotFound)
}

/// The open journey for a subject, locked, with its subject row.
async fn journey(
    tx: &mut Tx<'_>,
    claims: &Claims,
    code: &str,
    subject: Uuid,
) -> Result<Option<(Journey, Subject)>, AppError> {
    let Some(inst) = store::instance_for(tx, claims.tenant_id, code, subject, true).await? else {
        return Ok(None);
    };
    let s = registry::subject(tx, claims.tenant_id, subject).await?;
    Ok(Some((walk::load(tx, claims.tenant_id, inst).await?, s)))
}

async fn walk_and_ticket(
    tx: &mut Tx<'_>,
    j: &mut Journey,
    s: &Subject,
) -> Result<Ticket, AppError> {
    let stop = if j.inst.status == "completed" {
        None
    } else {
        walk::walk(tx, j, s).await?
    };
    walk::ticket(tx, j, stop, s.tenant).await
}

/// Start a discharge journey on the published version and open the domain
/// records it reads (the TAT log and checklist) through their own handlers.
///
/// # Errors
/// Forbidden without discharge-TAT update or care-team access; conflict when
/// the admission is not open.
pub async fn start(
    state: &AppState,
    claims: &Claims,
    code: &str,
    subject: Uuid,
) -> Result<Ticket, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::ipd::discharge_tat::UPDATE)?;
    medbrains_authz_gate::require_admission_access(state, claims, subject).await?;
    registry::open_discharge(state, claims, subject).await?;
    let mut tx = begin(&state.db, claims).await?;
    let s = registry::subject(&mut tx, claims.tenant_id, subject).await?;
    if !matches!(s.status.as_str(), "admitted" | "transferred") {
        return Err(AppError::Conflict(format!(
            "This admission is {}; there is nothing to discharge",
            s.status
        )));
    }
    let open = store::instance_for(&mut tx, claims.tenant_id, code, subject, true).await?;
    if open.is_some_and(|o| o.status != "completed" && o.status != "cancelled") {
        return Err(AppError::Conflict(
            "Discharge has already started for this admission".to_owned(),
        ));
    }
    let template = store::ensure_published(&mut tx, claims.tenant_id, &flow).await?;
    let patient: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM admissions WHERE tenant_id = $1 AND id = $2")
            .bind(claims.tenant_id)
            .bind(subject)
            .fetch_optional(&mut *tx)
            .await?;
    store::insert_instance(
        &mut tx,
        &NewInstance {
            tenant: claims.tenant_id,
            template: &template,
            subject_type: &flow.subject_type,
            subject,
            patient,
            user: claims.sub,
        },
    )
    .await?;
    let (mut j, s) = journey(&mut tx, claims, code, subject)
        .await?
        .ok_or(AppError::NotFound)?;
    let ticket = walk_and_ticket(&mut tx, &mut j, &s).await?;
    tx.commit().await?;
    Ok(ticket)
}

/// The patient's ticket, brought up to date with what the domain records.
/// Writes only the journey's position and step logs, never a domain status.
///
/// # Errors
/// Forbidden without `flows.view` or care-team access.
pub async fn ticket(
    state: &AppState,
    claims: &Claims,
    code: &str,
    subject: Uuid,
) -> Result<Option<Ticket>, AppError> {
    flow(code)?;
    require_permission(claims, permissions::flows::VIEW)?;
    medbrains_authz_gate::require_admission_access(state, claims, subject).await?;
    let mut tx = begin(&state.db, claims).await?;
    let Some((mut j, s)) = journey(&mut tx, claims, code, subject).await? else {
        return Ok(None);
    };
    let ticket = walk_and_ticket(&mut tx, &mut j, &s).await?;
    tx.commit().await?;
    Ok(Some(ticket))
}

/// A domain refusal is the station failing; a fault (database, internal) is
/// not, and is never recorded as one.
fn refusal_reason(e: &AppError) -> Option<String> {
    match e {
        AppError::Conflict(m) | AppError::BadRequest(m) | AppError::ForbiddenReason(m) => {
            Some(m.clone())
        }
        AppError::NotFound => Some("The admission is not open for discharge".to_owned()),
        AppError::Forbidden => Some("You do not have permission to run this step".to_owned()),
        _ => None,
    }
}

/// Run the action at the patient's current station. When the domain refuses,
/// the station records the reason and the journey does not move.
///
/// # Errors
/// The action's own permission; conflict when the patient is not at that
/// station; the domain's refusal, passed through unchanged.
pub async fn run(
    state: &AppState,
    claims: &Claims,
    code: &str,
    subject: Uuid,
    req: &RunRequest,
) -> Result<Ticket, AppError> {
    flow(code)?;
    require_permission(claims, permissions::flows::VIEW)?;
    medbrains_authz_gate::require_admission_access(state, claims, subject).await?;
    let mut tx = begin(&state.db, claims).await?;
    let (mut j, s) = journey(&mut tx, claims, code, subject)
        .await?
        .ok_or(AppError::NotFound)?;
    let stop = walk::walk(&mut tx, &mut j, &s).await?;
    let index = stop.as_ref().map(|st| st.index);
    let st = index.and_then(|i| j.stations.get(i)).cloned();
    let (Some(index), Some(st)) = (index, st) else {
        return Err(AppError::Conflict(
            "The patient is not waiting at any step".to_owned(),
        ));
    };
    let StationKind::Action { action } = &st.kind else {
        return Err(AppError::Conflict(format!(
            "The patient is at {}, which is not a step you run",
            st.name
        )));
    };
    if st.key != req.station {
        return Err(AppError::Conflict(format!(
            "The patient is at {}, not {}",
            st.name, req.station
        )));
    }
    let perm = registry::action_permission(action)
        .ok_or_else(|| AppError::Internal(format!("unregistered action {action}")))?;
    require_permission(claims, perm)?;
    let outcome = registry::run_action(state, claims, action, &s, &req.input).await;
    let at_step = i32::try_from(index).unwrap_or(i32::MAX);
    let now = Utc::now();
    if let Err(e) = outcome {
        let Some(reason) = refusal_reason(&e) else {
            return Err(e);
        };
        store::insert_log(
            &mut tx,
            &store::LogEntry {
                tenant: claims.tenant_id,
                instance: j.inst.id,
                index: at_step,
                key: &st.key,
                action: "failed",
                actor: Some(claims.sub),
                data: json!({ "reason": reason }),
                started_at: now,
                completed_at: Some(now),
                sla_met: None,
            },
        )
        .await?;
        j.inst.state["last_error"] =
            json!({ "station": st.key, "name": st.name, "reason": reason, "at": now });
        store::save_instance(
            &mut tx,
            claims.tenant_id,
            j.inst.id,
            at_step,
            &j.inst.state,
            false,
        )
        .await?;
        tx.commit().await?;
        return Err(e);
    }
    let arrived = stop.map_or(now, |st| st.arrived);
    let met = st
        .sla_minutes
        .map(|sla| (now - arrived).num_minutes() <= sla);
    store::close_log(&mut tx, claims.tenant_id, j.inst.id, at_step, now, met).await?;
    j.inst.state["last_error"] = Value::Null;
    j.inst.current_step = at_step + 1;
    let s = registry::subject(&mut tx, claims.tenant_id, subject).await?;
    let ticket = walk_and_ticket(&mut tx, &mut j, &s).await?;
    tx.commit().await?;
    Ok(ticket)
}

/// Complete a task that clears through the flow.
///
/// The superintendent's sign-off or physiotherapy clearance. Only the task's office, or a holder
/// of its permission, may complete it, and only while the patient waits there.
///
/// # Errors
/// Forbidden for anyone outside the office; conflict elsewhere on the route.
pub async fn complete_task(
    state: &AppState,
    claims: &Claims,
    code: &str,
    subject: Uuid,
    station: &str,
) -> Result<Ticket, AppError> {
    flow(code)?;
    require_permission(claims, permissions::flows::VIEW)?;
    medbrains_authz_gate::require_admission_access(state, claims, subject).await?;
    let mut tx = begin(&state.db, claims).await?;
    let (mut j, s) = journey(&mut tx, claims, code, subject)
        .await?
        .ok_or(AppError::NotFound)?;
    let stop = walk::walk(&mut tx, &mut j, &s).await?;
    let st = stop.and_then(|st| j.stations.get(st.index)).cloned();
    let Some(st) = st.filter(|st| st.key == station) else {
        return Err(AppError::Conflict(format!(
            "The patient is not waiting at {station}"
        )));
    };
    let StationKind::Task { task } = &st.kind else {
        return Err(AppError::Conflict(format!("{} is not a task", st.name)));
    };
    match registry::task_completion(task)
        .ok_or_else(|| AppError::Conflict(format!("{} clears on its own screen", st.name)))?
    {
        // An office, not a permission: bypass roles do not stand in for it.
        registry::Completion::Office(office) => {
            if claims.role != office || is_bypass_role(claims) {
                return Err(AppError::ForbiddenReason(format!(
                    "{} is completed by the {}",
                    st.name,
                    st.holder.to_lowercase()
                )));
            }
        }
        registry::Completion::Permission(perm) => require_permission(claims, perm)?,
    }
    j.inst.state["signoffs"][st.key.as_str()] = json!({ "by": claims.sub, "at": Utc::now() });
    let ticket = walk_and_ticket(&mut tx, &mut j, &s).await?;
    tx.commit().await?;
    Ok(ticket)
}
