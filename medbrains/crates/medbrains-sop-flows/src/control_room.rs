//! The control room (RFC §5.2 #1): how many patients wait at each station,
//! the longest wait against the timetable, and the station losing the most
//! time today — computed from step logs, never invented.

use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::engine::{begin, flow};
use crate::registry::{self, Tx};
use crate::{store, walk};

/// Patients brought up to date per load (oldest first).
// ponytail: one walk per open journey, bounded here; batch the signal reads
// per station if a hospital runs more than this many discharges at once.
const SYNC_LIMIT: i64 = 50;
/// Patients listed per station.
const PER_STATION: usize = 20;
/// This many waiting at once reads as busy.
const BUSY: usize = 3;
/// Fewer timed stops than this today is not enough to name a bottleneck.
const MIN_SAMPLES: i64 = 3;

#[derive(Debug, Clone, Serialize)]
pub struct StationPatient {
    pub admission_id: Uuid,
    pub label: String,
    pub minutes: i64,
    pub overdue: bool,
    pub version: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StationLoad {
    pub key: String,
    pub name: String,
    pub path: String,
    pub holder: String,
    pub sla_minutes: Option<i64>,
    pub count: usize,
    pub longest_minutes: Option<i64>,
    /// `calm`, `busy` or `overdue`, always shown as text.
    pub label: String,
    pub patients: Vec<StationPatient>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ControlRoom {
    pub flow_code: String,
    pub as_of: DateTime<Utc>,
    /// Patient names are shown only to holders of `ipd.admissions.list`.
    pub patients_visible: bool,
    pub stations: Vec<StationLoad>,
    /// "Pharmacy returns is adding 1 h 40 min to each discharge today", or
    /// "Not enough data yet".
    pub spotlight: String,
    pub spotlight_station: Option<String>,
}

#[derive(sqlx::FromRow)]
struct Waiting {
    admission_id: Uuid,
    step_name: String,
    started_at: DateTime<Utc>,
    version: Option<i32>,
    label: String,
}

#[derive(sqlx::FromRow)]
struct Timing {
    step_name: String,
    samples: i64,
    avg_minutes: f64,
}

async fn sync_open(tx: &mut Tx<'_>, tenant: Uuid, code: &str) -> Result<(), AppError> {
    let subjects: Vec<Uuid> = sqlx::query_scalar(
        "SELECT subject_id FROM workflow_instances WHERE tenant_id = $1 AND flow_code = $2 \
            AND status = 'in_progress' AND deleted_at IS NULL ORDER BY started_at LIMIT $3",
    )
    .bind(tenant)
    .bind(code)
    .bind(SYNC_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    for subject in subjects {
        let Some(inst) = store::instance_for(tx, tenant, code, subject, true).await? else {
            continue;
        };
        let s = registry::subject(tx, tenant, subject).await?;
        let mut j = walk::load(tx, tenant, inst).await?;
        walk::walk(tx, &mut j, &s).await?;
    }
    Ok(())
}

pub(crate) fn duration(minutes: i64) -> String {
    match (minutes / 60, minutes % 60) {
        (0, m) => format!("{m} min"),
        (h, 0) => format!("{h} h"),
        (h, m) => format!("{h} h {m} min"),
    }
}

const fn label(count: usize, overdue: bool) -> &'static str {
    if overdue {
        "overdue"
    } else if count >= BUSY {
        "busy"
    } else {
        "calm"
    }
}

/// The station with the longest average stop today, as a sentence.
fn spotlight(
    timings: &[Timing],
    name_of: impl Fn(&str) -> Option<String>,
) -> (String, Option<String>) {
    let total: i64 = timings.iter().map(|t| t.samples).sum();
    let worst = timings
        .iter()
        .filter(|t| t.samples >= 2 && t.avg_minutes >= 1.0)
        .max_by(|a, b| a.avg_minutes.total_cmp(&b.avg_minutes));
    worst.filter(|_| total >= MIN_SAMPLES).map_or_else(
        || ("Not enough data yet".to_owned(), None),
        |t| {
            #[allow(clippy::cast_possible_truncation)]
            let avg = t.avg_minutes.round() as i64;
            let name = name_of(&t.step_name).unwrap_or_else(|| t.step_name.clone());
            (
                format!(
                    "{name} is adding {} to each discharge today ({} patients)",
                    duration(avg),
                    t.samples
                ),
                Some(t.step_name.clone()),
            )
        },
    )
}

/// # Errors
/// Forbidden without `flows.view`.
pub async fn control_room(
    pool: &PgPool,
    claims: &Claims,
    code: &str,
) -> Result<ControlRoom, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::VIEW)?;
    let patients_visible = is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::ipd::admissions::LIST);
    let mut tx = begin(pool, claims).await?;
    sync_open(&mut tx, claims.tenant_id, code).await?;
    let waiting = sqlx::query_as::<_, Waiting>(
        "SELECT w.subject_id AS admission_id, l.step_name, l.started_at, w.template_version AS version, \
                concat_ws(' ', p.first_name, p.last_name, '(' || p.uhid || ')') AS label \
           FROM workflow_instances w \
           JOIN workflow_step_logs l ON l.instance_id = w.id AND l.step_index = w.current_step \
                AND l.action = 'arrived' AND l.completed_at IS NULL AND l.deleted_at IS NULL \
           JOIN admissions a ON a.id = w.subject_id AND a.tenant_id = w.tenant_id \
           JOIN patients p ON p.id = a.patient_id \
          WHERE w.tenant_id = $1 AND w.flow_code = $2 AND w.status = 'in_progress' AND w.deleted_at IS NULL \
          ORDER BY l.started_at LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .fetch_all(&mut *tx)
    .await?;
    let timings = sqlx::query_as::<_, Timing>(
        "SELECT l.step_name, COUNT(*) AS samples, \
                AVG(EXTRACT(EPOCH FROM (COALESCE(l.completed_at, now()) - l.started_at)) / 60)::float8 AS avg_minutes \
           FROM workflow_step_logs l JOIN workflow_instances w ON w.id = l.instance_id \
          WHERE l.tenant_id = $1 AND w.flow_code = $2 AND l.deleted_at IS NULL \
            AND l.action IN ('arrived', 'cleared') AND l.started_at >= date_trunc('day', now()) \
          GROUP BY l.step_name",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let now = Utc::now();
    let stations = flow
        .stations
        .iter()
        .map(|st| {
            let here: Vec<StationPatient> = waiting
                .iter()
                .filter(|w| w.step_name == st.key)
                .map(|w| {
                    let minutes = (now - w.started_at).num_minutes();
                    StationPatient {
                        admission_id: w.admission_id,
                        label: if patients_visible {
                            w.label.clone()
                        } else {
                            String::new()
                        },
                        minutes,
                        overdue: st.sla_minutes.is_some_and(|sla| minutes > sla),
                        version: w.version,
                    }
                })
                .collect();
            let overdue = here.iter().any(|p| p.overdue);
            StationLoad {
                key: st.key.clone(),
                name: st.name.clone(),
                path: st.path.clone(),
                holder: st.holder.clone(),
                sla_minutes: st.sla_minutes,
                count: here.len(),
                longest_minutes: here.iter().map(|p| p.minutes).max(),
                label: label(here.len(), overdue).to_owned(),
                patients: if patients_visible {
                    here.into_iter().take(PER_STATION).collect()
                } else {
                    Vec::new()
                },
            }
        })
        .collect();
    let (spotlight, spotlight_station) = spotlight(&timings, |key| {
        flow.stations
            .iter()
            .find(|s| s.key == key)
            .map(|s| s.name.clone())
    });
    Ok(ControlRoom {
        flow_code: flow.code,
        as_of: now,
        patients_visible,
        stations,
        spotlight,
        spotlight_station,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(step: &str, samples: i64, avg: f64) -> Timing {
        Timing {
            step_name: step.to_owned(),
            samples,
            avg_minutes: avg,
        }
    }

    #[test]
    fn spotlight_names_the_slowest_station_or_admits_too_little_data() {
        let name = |k: &str| Some(format!("Station {k}"));
        assert_eq!(spotlight(&[], name).0, "Not enough data yet");
        assert_eq!(spotlight(&[t("a", 2, 90.0)], name).0, "Not enough data yet");
        let (text, key) = spotlight(&[t("a", 2, 30.0), t("b", 3, 100.0), t("c", 1, 500.0)], name);
        assert_eq!(
            text,
            "Station b is adding 1 h 40 min to each discharge today (3 patients)"
        );
        assert_eq!(key.as_deref(), Some("b"));
    }

    #[test]
    fn labels_are_words() {
        assert_eq!(label(0, false), "calm");
        assert_eq!(label(3, false), "busy");
        assert_eq!(label(1, true), "overdue");
    }
}
