//! Walking a journey forward: record what the domain already says.
//!
//! A walk never runs a domain action and never writes a domain status. It
//! reads each station's signal or task, and for every one that has cleared
//! closes its log row at the time the domain recorded it, then moves on. It
//! stops at the first station still holding, at an action (which a person
//! runs), or at the end. Bounded by the number of stations.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::model::{Station, StationKind, Switches, Template, Ticket, TicketStation, TicketStop};
use crate::registry::{self, Clearance, Subject, Tx};
use crate::route::{find, on_patient_route};
use crate::store::{self, Instance, LogEntry, StepLog};
use medbrains_server_core::error::AppError;

/// A journey with its pinned template, loaded for a walk.
pub(crate) struct Journey {
    pub inst: Instance,
    pub template: Template,
    pub stations: Vec<Station>,
    pub switches: Switches,
}

/// Where the walk stopped and what the station waits for.
pub(crate) struct Stop {
    pub index: usize,
    pub arrived: DateTime<Utc>,
    pub outstanding: Vec<String>,
}

pub(crate) fn facts(state: &Value) -> Value {
    state.get("facts").cloned().unwrap_or_else(|| json!({}))
}

fn sla_met(st: &Station, from: DateTime<Utc>, to: DateTime<Utc>) -> Option<bool> {
    st.sla_minutes.map(|sla| (to - from).num_minutes() <= sla)
}

fn signed_off(state: &Value, key: &str) -> Option<DateTime<Utc>> {
    state
        .pointer(&format!("/signoffs/{key}/at"))
        .and_then(Value::as_str)
        .and_then(|s| s.parse().ok())
}

/// The arrival time recorded for `index`, or none if it was never reached.
fn arrival(logs: &[StepLog], index: usize) -> Option<DateTime<Utc>> {
    logs.iter()
        .rev()
        .find(|l| usize::try_from(l.step_index).ok() == Some(index) && l.action != "failed")
        .map(|l| l.started_at)
}

async fn clearance(
    tx: &mut Tx<'_>,
    j: &Journey,
    st: &Station,
    s: &Subject,
) -> Result<Option<Clearance>, AppError> {
    Ok(Some(match &st.kind {
        StationKind::Signal { signal } => registry::signal(tx, signal, s).await?,
        StationKind::Task { task } => {
            registry::task(tx, task, s, signed_off(&j.inst.state, &st.key)).await?
        }
        StationKind::Action { .. } | StationKind::Switch { .. } | StationKind::End => {
            return Ok(None);
        }
    }))
}

/// Walk forward from the current station. Returns where it stopped, or
/// `None` when the journey reached its end.
pub(crate) async fn walk(
    tx: &mut Tx<'_>,
    j: &mut Journey,
    s: &Subject,
) -> Result<Option<Stop>, AppError> {
    let tenant = s.tenant;
    let logs = store::logs(tx, tenant, j.inst.id).await?;
    let mut index = usize::try_from(j.inst.current_step).unwrap_or(0);
    let mut arrived = arrival(&logs, index).unwrap_or_else(Utc::now);
    let mut reached = arrival(&logs, index).is_some();
    let mut stop = None;
    let mut finished = false;
    while let Some(st) = j.stations.get(index) {
        let at = i32::try_from(index).unwrap_or(i32::MAX);
        if !on_patient_route(st, &j.switches, &facts(&j.inst.state)) {
            index += 1;
            reached = false;
            continue;
        }
        if !reached {
            store::insert_log(
                tx,
                &LogEntry {
                    tenant,
                    instance: j.inst.id,
                    index: at,
                    key: &st.key,
                    action: "arrived",
                    actor: None,
                    data: json!({}),
                    started_at: arrived,
                    completed_at: None,
                    sla_met: None,
                },
            )
            .await?;
        }
        let done_at = match &st.kind {
            StationKind::Switch { fact } => {
                let value = registry::fact(tx, fact, s).await?;
                if let Some(state) = j.inst.state.as_object_mut() {
                    let f = state.entry("facts").or_insert_with(|| json!({}));
                    f[fact.as_str()] = value;
                }
                arrived
            }
            StationKind::End => {
                finished = true;
                arrived
            }
            StationKind::Action { .. } => {
                stop = Some(Stop {
                    index,
                    arrived,
                    outstanding: Vec::new(),
                });
                break;
            }
            _ => {
                let Some(c) = clearance(tx, j, st, s).await? else {
                    break;
                };
                // Cleared before the patient got here: no time spent.
                let Some(cleared) = c.cleared_at else {
                    stop = Some(Stop {
                        index,
                        arrived,
                        outstanding: c.outstanding,
                    });
                    break;
                };
                cleared.max(arrived)
            }
        };
        store::close_log(
            tx,
            tenant,
            j.inst.id,
            at,
            done_at,
            sla_met(st, arrived, done_at),
        )
        .await?;
        if finished {
            break;
        }
        index += 1;
        arrived = done_at;
        reached = false;
    }
    let last = i32::try_from(index).unwrap_or(i32::MAX);
    store::save_instance(tx, tenant, j.inst.id, last, &j.inst.state, finished).await?;
    j.inst.current_step = last;
    if finished {
        "completed".clone_into(&mut j.inst.status);
    }
    Ok(stop)
}

const fn kind_name(k: &StationKind) -> &'static str {
    match k {
        StationKind::Action { .. } => "action",
        StationKind::Task { .. } => "task",
        StationKind::Switch { .. } => "switch",
        StationKind::Signal { .. } => "signal",
        StationKind::End => "end",
    }
}

/// The switch sentence whose clause names this station's lane.
fn routed_by(code: &str, st: &Station) -> Option<String> {
    let flow = find(code)?;
    let clause = st.switch_when.as_object()?;
    flow.switches
        .iter()
        .find(|d| clause.contains_key(&d.key))
        .map(|d| d.sentence.clone())
}

pub(crate) async fn ticket(
    tx: &mut Tx<'_>,
    j: &Journey,
    stop: Option<Stop>,
    tenant: Uuid,
) -> Result<Ticket, AppError> {
    let logs = store::logs(tx, tenant, j.inst.id).await?;
    let now = Utc::now();
    let current_index = usize::try_from(j.inst.current_step).unwrap_or(0);
    let facts = facts(&j.inst.state);
    let stops = j
        .stations
        .iter()
        .enumerate()
        .map(|(i, st)| {
            let cleared = logs
                .iter()
                .find(|l| usize::try_from(l.step_index).ok() == Some(i) && l.action == "cleared")
                .and_then(|l| l.completed_at);
            let state = if cleared.is_some() {
                "done"
            } else if j.inst.status != "completed" && i == current_index {
                "current"
            } else if !on_patient_route(st, &j.switches, &facts) || i < current_index {
                "skipped"
            } else {
                "ahead"
            };
            TicketStop {
                key: st.key.clone(),
                name: st.name.clone(),
                lane: st.lane.clone(),
                state: state.to_owned(),
                cleared_at: cleared,
            }
        })
        .collect();
    let current = stop.and_then(|stop| {
        let st = j.stations.get(stop.index)?;
        let minutes = (now - stop.arrived).num_minutes();
        Some(TicketStation {
            key: st.key.clone(),
            name: st.name.clone(),
            path: st.path.clone(),
            kind: kind_name(&st.kind).to_owned(),
            holder: st.holder.clone(),
            outstanding: stop.outstanding,
            since: stop.arrived,
            minutes,
            sla_minutes: st.sla_minutes,
            overdue: st.sla_minutes.is_some_and(|sla| minutes > sla),
            routed_by: routed_by(&j.template.code, st),
        })
    });
    Ok(Ticket {
        instance_id: j.inst.id,
        flow_code: j.template.code.clone(),
        subject_id: j.inst.subject_id.unwrap_or_default(),
        version: j.template.version,
        status: j.inst.status.clone(),
        started_at: j.inst.started_at,
        completed_at: j.inst.completed_at,
        current,
        stops,
        last_error: j
            .inst
            .state
            .get("last_error")
            .cloned()
            .filter(|v| !v.is_null()),
    })
}

pub(crate) async fn load(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    inst: Instance,
) -> Result<Journey, AppError> {
    let template = store::template_by_id(tx, tenant, inst.template_id).await?;
    let stations = store::stations(&template)?;
    let switches = store::switches(&template);
    Ok(Journey {
        inst,
        template,
        stations,
        switches,
    })
}
