//! The building blocks a flow may name: signals, tasks, facts and actions.
//!
//! A flow references these by name only; each is a reviewed Rust function.
//! An unregistered name fails closed (an error, never "cleared").
//!
//! Signals read the domain's own record directly (the signed summary, the
//! discharge-TAT clearances, the pre-authorisation). The before-event gate
//! (`emit_before_event`) was the other option, but it allows an event nobody
//! registered — failing open — which is wrong for a safety signal, and it
//! needs pipeline rows a hospital could switch off.

use axum::{Extension, Json, extract::Path, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde_json::{Map, Value};
use std::collections::HashMap;
use uuid::Uuid;

pub type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Who may complete a task that clears through the flow itself. Tasks
/// without one clear on their own screen (the ward handover clears from the
/// checklist).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Completion {
    /// An office, not a permission: bypass roles do not stand in for it.
    Office(&'static str),
    /// Anyone holding the block's permission (physiotherapy clearance).
    Permission(&'static str),
}

#[must_use]
pub fn task_completion(task: &str) -> Option<Completion> {
    match task {
        "ipd.ms_signoff" => Some(Completion::Office("medical_superintendent")),
        "ipd.physio_clearance" => Some(Completion::Permission(
            permissions::ipd::discharge::PHYSIO_CLEARANCE,
        )),
        _ => None,
    }
}

/// The permission the acting user needs to run an action.
#[must_use]
pub fn action_permission(action: &str) -> Option<&'static str> {
    crate::blocks::block("action", action).map(|b| b.permission)
}

/// The journey's subject: an admission and what hangs off it.
#[derive(Debug, Clone, sqlx::FromRow)]
pub(crate) struct Subject {
    pub tenant: Uuid,
    pub admission: Uuid,
    pub encounter: Uuid,
    /// `admission_status` as text.
    pub status: String,
}

pub(crate) async fn subject(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    admission: Uuid,
) -> Result<Subject, AppError> {
    sqlx::query_as::<_, Subject>(
        "SELECT tenant_id AS tenant, id AS admission, encounter_id AS encounter, status::text AS status \
           FROM admissions WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(admission)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Whether a station has cleared, and if not, what it waits for.
#[derive(Debug, Clone)]
pub(crate) struct Clearance {
    /// When the domain recorded it, so time at a station is the real time.
    pub cleared_at: Option<DateTime<Utc>>,
    /// What is outstanding, in plain words.
    pub outstanding: Vec<String>,
}

impl Clearance {
    fn from(at: Option<DateTime<Utc>>, waiting: &str) -> Self {
        Self {
            cleared_at: at,
            outstanding: if at.is_some() {
                Vec::new()
            } else {
                vec![waiting.to_owned()]
            },
        }
    }
}

/// One discharge-TAT clearance column; `col` is always a literal below.
fn tat_sql(col: &str) -> String {
    format!(
        "SELECT {col} FROM ipd_discharge_tat_log \
          WHERE tenant_id = $1 AND admission_id = $2 AND deleted_at IS NULL"
    )
}

async fn tat(tx: &mut Tx<'_>, s: &Subject, sql: &str) -> Result<Option<DateTime<Utc>>, AppError> {
    let at: Option<Option<DateTime<Utc>>> = sqlx::query_scalar(sql)
        .bind(s.tenant)
        .bind(s.admission)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(at.flatten())
}

pub(crate) async fn signal(
    tx: &mut Tx<'_>,
    name: &str,
    s: &Subject,
) -> Result<Clearance, AppError> {
    let (at, waiting) = match name {
        "ipd.discharge_summary_signed" => (
            sqlx::query_scalar::<_, DateTime<Utc>>(
                "SELECT COALESCE(finalized_at, updated_at) FROM ipd_discharge_summaries \
                  WHERE tenant_id = $1 AND admission_id = $2 AND deleted_at IS NULL \
                    AND status = 'finalized'::discharge_summary_status \
                  ORDER BY finalized_at LIMIT 1",
            )
            .bind(s.tenant)
            .bind(s.admission)
            .fetch_optional(&mut **tx)
            .await?,
            "The discharge summary to be finalised and signed",
        ),
        "ipd.doctor_cleared" => (
            tat(tx, s, &tat_sql("doctor_cleared_at")).await?,
            "Doctor clearance on the discharge TAT log",
        ),
        "ipd.nursing_cleared" => (
            tat(tx, s, &tat_sql("nursing_cleared_at")).await?,
            "Nursing clearance on the discharge TAT log",
        ),
        "ipd.pharmacy_cleared" => (
            tat(tx, s, &tat_sql("pharmacy_cleared_at")).await?,
            "Pharmacy to clear returns on the discharge TAT log",
        ),
        "ipd.billing_cleared" => (billing_cleared(tx, s).await?, "Billing clearance"),
        "insurance.tpa_approved" => (
            sqlx::query_scalar::<_, DateTime<Utc>>(
                "SELECT COALESCE(reviewed_at, updated_at) FROM pre_authorization_requests \
                  WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL \
                    AND status = 'approved' ORDER BY reviewed_at LIMIT 1",
            )
            .bind(s.tenant)
            .bind(s.encounter)
            .fetch_optional(&mut **tx)
            .await?,
            "The TPA to approve the pre-authorisation",
        ),
        "mlc.police_intimated" => (
            sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
                "SELECT MIN(pi.sent_at) FROM mlc_police_intimations pi \
                   JOIN mlc_cases c ON c.id = pi.mlc_case_id AND c.tenant_id = pi.tenant_id \
                  WHERE pi.tenant_id = $1 AND pi.deleted_at IS NULL AND c.deleted_at IS NULL \
                    AND (c.admission_id = $2 OR c.id = (SELECT mlc_case_id FROM admissions \
                          WHERE tenant_id = $1 AND id = $2))",
            )
            .bind(s.tenant)
            .bind(s.admission)
            .fetch_one(&mut **tx)
            .await?,
            "The police to be informed of this medico-legal discharge",
        ),
        other => return Err(AppError::Internal(format!("unregistered signal {other}"))),
    };
    Ok(Clearance::from(at, waiting))
}

/// Billing clears on the TAT log or on the checklist's "accounts cleared or
/// clearance recorded" item — today either records it.
async fn billing_cleared(tx: &mut Tx<'_>, s: &Subject) -> Result<Option<DateTime<Utc>>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT LEAST( \
           (SELECT billing_cleared_at FROM ipd_discharge_tat_log \
             WHERE tenant_id = $1 AND admission_id = $2 AND deleted_at IS NULL), \
           (SELECT completed_at FROM ipd_discharge_checklists \
             WHERE tenant_id = $1 AND admission_id = $2 AND deleted_at IS NULL \
               AND item_code = 'accounts_cleared' AND status = 'completed'))",
    )
    .bind(s.tenant)
    .bind(s.admission)
    .fetch_one(&mut **tx)
    .await?)
}

/// Checklist items other stations own: the summary and the accounts.
const NOT_HANDOVER: [&str; 2] = ["discharge_summary", "accounts_cleared"];

pub(crate) async fn task(
    tx: &mut Tx<'_>,
    name: &str,
    s: &Subject,
    completed_at: Option<DateTime<Utc>>,
) -> Result<Clearance, AppError> {
    match name {
        "ipd.ward_handover" => ward_handover(tx, s).await,
        "ipd.ms_signoff" => Ok(Clearance::from(
            completed_at,
            "The medical superintendent's sign-off",
        )),
        "ipd.physio_clearance" => Ok(Clearance::from(
            completed_at,
            "Physiotherapy to clear the patient for discharge",
        )),
        other => Err(AppError::Internal(format!("unregistered task {other}"))),
    }
}

/// Clears when every handover item on the admission's checklist is done.
async fn ward_handover(tx: &mut Tx<'_>, s: &Subject) -> Result<Clearance, AppError> {
    let rows: Vec<(String, String, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT item_label, status, completed_at FROM ipd_discharge_checklists \
          WHERE tenant_id = $1 AND admission_id = $2 AND deleted_at IS NULL \
            AND item_code <> ALL($3) ORDER BY sort_order LIMIT 100",
    )
    .bind(s.tenant)
    .bind(s.admission)
    .bind(NOT_HANDOVER.as_slice())
    .fetch_all(&mut **tx)
    .await?;
    if rows.is_empty() {
        return Ok(Clearance::from(
            None,
            "The discharge checklist to be started",
        ));
    }
    let outstanding: Vec<String> = rows
        .iter()
        .filter(|(_, status, _)| status != "completed")
        .map(|(label, _, _)| label.clone())
        .collect();
    let cleared_at = if outstanding.is_empty() {
        rows.iter().filter_map(|r| r.2).max()
    } else {
        None
    };
    Ok(Clearance {
        cleared_at,
        outstanding,
    })
}

#[derive(sqlx::FromRow)]
struct FactRow {
    id: Uuid,
    is_insurance: bool,
    is_mlc: bool,
    department: Option<String>,
    age_years: Option<i32>,
}

/// Every registered fact for these admissions, in one query. Unknown values
/// stay null: a branch on them then does not match, and a required signal
/// never hangs on a fact the checks have not proven (they refuse that).
pub(crate) async fn facts_bulk(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    admissions: &[Uuid],
) -> Result<HashMap<Uuid, Map<String, Value>>, AppError> {
    let rows = sqlx::query_as::<_, FactRow>(
        // A cashless stay has a live pre-authorisation on its encounter.
        "SELECT a.id, \
                EXISTS (SELECT 1 FROM pre_authorization_requests r WHERE r.tenant_id = $1 \
                   AND r.encounter_id = a.encounter_id AND r.deleted_at IS NULL \
                   AND r.status IN ('pending', 'submitted', 'approved')) AS is_insurance, \
                (a.mlc_case_id IS NOT NULL OR EXISTS (SELECT 1 FROM mlc_cases c \
                   WHERE c.tenant_id = $1 AND c.admission_id = a.id AND c.deleted_at IS NULL)) AS is_mlc, \
                d.code AS department, \
                date_part('year', age(p.date_of_birth))::int AS age_years \
           FROM admissions a \
           LEFT JOIN departments d ON d.id = a.department_id AND d.tenant_id = a.tenant_id \
           LEFT JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
          WHERE a.tenant_id = $1 AND a.id = ANY($2)",
    )
    .bind(tenant)
    .bind(admissions)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let mut m = Map::new();
            m.insert("is_insurance".to_owned(), Value::Bool(r.is_insurance));
            m.insert("is_mlc".to_owned(), Value::Bool(r.is_mlc));
            m.insert(
                "department".to_owned(),
                r.department.map_or(Value::Null, Value::String),
            );
            m.insert(
                "age_years".to_owned(),
                r.age_years.map_or(Value::Null, Value::from),
            );
            (r.id, m)
        })
        .collect())
}

/// One registered fact about the subject.
pub(crate) async fn fact(tx: &mut Tx<'_>, name: &str, s: &Subject) -> Result<Value, AppError> {
    if crate::blocks::fact(name).is_none() {
        return Err(AppError::Internal(format!("unregistered fact {name}")));
    }
    let mut all = facts_bulk(tx, s.tenant, &[s.admission]).await?;
    all.remove(&s.admission)
        .and_then(|mut m| m.remove(name))
        .ok_or(AppError::NotFound)
}

/// Run a domain action as the acting user. The domain keeps its own checks.
pub(crate) async fn run_action(
    state: &AppState,
    claims: &Claims,
    name: &str,
    s: &Subject,
    input: &Value,
) -> Result<(), AppError> {
    match name {
        "ipd.discharge.finalize" => {
            // Already discharged (a retry after the flow failed to record it):
            // the domain has done the work; do not do it twice.
            if s.status == "discharged" {
                return Ok(());
            }
            let text = |k: &str| input.get(k).and_then(Value::as_str).map(str::to_owned);
            let body = medbrains_ipd::DischargeRequest {
                discharge_type: text("discharge_type").unwrap_or_else(|| "normal".to_owned()),
                discharge_summary: text("discharge_summary"),
            };
            medbrains_ipd::discharge_patient(
                State(state.clone()),
                Extension(claims.clone()),
                Path(s.admission),
                Json(body),
            )
            .await
            .map(|_| ())
        }
        other => Err(AppError::Internal(format!("unregistered action {other}"))),
    }
}

/// Open the domain records a discharge journey reads: the TAT log and the
/// checklist, through their own handlers and permissions.
pub(crate) async fn open_discharge(
    state: &AppState,
    claims: &Claims,
    admission: Uuid,
) -> Result<(), AppError> {
    medbrains_ipd::initiate_discharge_tat(
        State(state.clone()),
        Extension(claims.clone()),
        Path(admission),
    )
    .await
    .map(|_| ())?;
    medbrains_ipd::init_discharge_checklist(
        State(state.clone()),
        Extension(claims.clone()),
        Path(admission),
        None,
    )
    .await
    .map(|_| ())?;
    Ok(())
}
