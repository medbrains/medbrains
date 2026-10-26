//! The hospital's immunisation schedule applied to its children: each
//! child's due and overdue doses, the clinic's due list, the schedule
//! setting, and the SMS reminder pass.
//!
//! The schedule engine is `medbrains_core::immunization`; this module reads
//! the doses recorded in `patient_immunizations` and the choice in
//! `tenant_settings` (category `immunization`, key `schedule`).

use std::collections::HashMap;

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{Duration, NaiveDate, Utc};
use medbrains_core::immunization::{self, DoseState, RecordedDose, ScheduleOptions, ScheduleView};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Children followed by the schedule: under 17 (UIP runs to 16 years).
const MAX_AGE_YEARS: i32 = 17;
/// Children evaluated for one due list or reminder pass.
const MAX_CHILDREN: i64 = 20_000;
const PAGE_SIZE: usize = 100;
const MAX_REMIND_DAYS: i64 = 14;

/// Today in India, as the dose-recording screen counts it.
// ponytail: fixed IST like `routes/immunizations.rs`; a hospital time zone
// setting is the upgrade if a tenant runs outside India.
fn today_ist() -> NaiveDate {
    (Utc::now() + Duration::minutes(330)).date_naive()
}

/// The hospital's setting.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct ScheduleSetting {
    #[serde(flatten)]
    pub options: ScheduleOptions,
    /// Text parents before a dose is due.
    #[serde(default)]
    pub sms_reminders: bool,
    /// How many days before the due date (0 = on the day).
    #[serde(default = "default_remind_days")]
    pub remind_days_before: i64,
}

const fn default_remind_days() -> i64 {
    2
}

async fn setting(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<ScheduleSetting, AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'immunization' \
           AND key = 'schedule' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    // A malformed setting is a fault, not a silent fallback to UIP.
    value.map_or(Ok(ScheduleSetting::default()), |v| {
        serde_json::from_value(v)
            .map_err(|e| AppError::Internal(format!("immunization schedule setting: {e}")))
    })
}

#[derive(sqlx::FromRow)]
struct DoseRow {
    id: Uuid,
    patient_id: Uuid,
    administered_on: NaiveDate,
    vaccine_key: Option<String>,
    vaccine_name: String,
}

/// Recorded doses of `patients`, struck-off ones excluded, by patient.
async fn doses_of(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patients: &[Uuid],
) -> Result<HashMap<Uuid, Vec<RecordedDose>>, AppError> {
    let rows = sqlx::query_as::<_, DoseRow>(
        "SELECT id, patient_id, administered_on, vaccine_key, vaccine_name FROM patient_immunizations \
          WHERE tenant_id = $1 AND patient_id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patients)
    .fetch_all(&mut **tx)
    .await?;
    let mut out: HashMap<Uuid, Vec<RecordedDose>> = HashMap::new();
    for r in rows {
        out.entry(r.patient_id).or_default().push(RecordedDose {
            id: r.id,
            given_on: r.administered_on,
            vaccine_key: r.vaccine_key,
            vaccine_name: r.vaccine_name,
        });
    }
    Ok(out)
}

#[derive(Debug, Serialize)]
pub struct PatientSchedule {
    /// Why no schedule can be shown, when none can.
    pub unavailable: Option<String>,
    pub schedule: Option<ScheduleView>,
}

/// `GET /api/patients/{id}/immunization-schedule`
pub async fn patient_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<PatientSchedule>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let dob: Option<NaiveDate> = sqlx::query_scalar(
        "SELECT date_of_birth FROM patients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let opts = setting(&mut tx, claims.tenant_id).await?.options;
    let mut doses = doses_of(&mut tx, claims.tenant_id, &[patient_id]).await?;
    tx.commit().await?;
    let Some(dob) = dob else {
        return Ok(Json(PatientSchedule {
            unavailable: Some("The schedule needs the child's date of birth.".to_owned()),
            schedule: None,
        }));
    };
    let today = today_ist();
    let doses = doses.remove(&patient_id).unwrap_or_default();
    Ok(Json(PatientSchedule {
        unavailable: None,
        schedule: Some(immunization::evaluate(opts, dob, &doses, today)),
    }))
}

#[derive(sqlx::FromRow)]
struct Child {
    id: Uuid,
    name: String,
    uhid: String,
    phone: Option<String>,
    date_of_birth: NaiveDate,
}

/// One dose on the due list.
#[derive(Debug, Clone, Serialize)]
pub struct DueRow {
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub phone: Option<String>,
    pub date_of_birth: NaiveDate,
    pub series: &'static str,
    pub dose: &'static str,
    pub product_key: &'static str,
    pub product_name: &'static str,
    pub due_on: NaiveDate,
    pub state: DoseState,
}

/// Children on record with at least one dose, and their next doses that are
/// due, overdue, or due within `within_days`.
async fn due_rows(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    opts: ScheduleOptions,
    today: NaiveDate,
    within_days: i64,
) -> Result<Vec<DueRow>, AppError> {
    // ponytail: evaluated in memory per request, bounded at MAX_CHILDREN;
    // a materialised due table is the upgrade if a hospital follows more.
    let children = sqlx::query_as::<_, Child>(
        "SELECT p.id, concat_ws(' ', p.first_name, p.last_name) AS name, p.uhid, \
                NULLIF(p.phone, '') AS phone, p.date_of_birth \
           FROM patients p \
          WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.date_of_birth IS NOT NULL \
            AND p.date_of_birth > (CURRENT_DATE - make_interval(years => $2)) \
            AND EXISTS (SELECT 1 FROM patient_immunizations i \
                         WHERE i.patient_id = p.id AND i.tenant_id = p.tenant_id AND i.deleted_at IS NULL) \
          ORDER BY p.date_of_birth DESC LIMIT $3",
    )
    .bind(tenant_id)
    .bind(MAX_AGE_YEARS)
    .bind(MAX_CHILDREN)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = children.iter().map(|c| c.id).collect();
    let mut doses = doses_of(tx, tenant_id, &ids).await?;
    let horizon = today + Duration::days(within_days);
    let mut rows = Vec::new();
    for c in children {
        let view = immunization::evaluate(
            opts,
            c.date_of_birth,
            &doses.remove(&c.id).unwrap_or_default(),
            today,
        );
        for s in &view.series {
            // Only the next dose of each series: later ones wait for it.
            let Some(next) = s
                .doses
                .iter()
                .find(|d| !matches!(d.state, DoseState::Given | DoseState::NotCounted))
            else {
                continue;
            };
            let wanted = match next.state {
                DoseState::Due | DoseState::Overdue => true,
                DoseState::Upcoming => next.date <= horizon,
                _ => false,
            };
            if wanted {
                rows.push(DueRow {
                    patient_id: c.id,
                    patient_name: c.name.clone(),
                    uhid: c.uhid.clone(),
                    phone: c.phone.clone(),
                    date_of_birth: c.date_of_birth,
                    series: s.name,
                    dose: next.label,
                    product_key: next.product_key,
                    product_name: next.product_name,
                    due_on: next.date,
                    state: next.state,
                });
            }
        }
    }
    rows.sort_by(|a, b| {
        a.due_on
            .cmp(&b.due_on)
            .then_with(|| a.patient_name.cmp(&b.patient_name))
    });
    Ok(rows)
}

#[derive(Debug, Deserialize)]
pub struct DueParams {
    pub within_days: Option<i64>,
    pub page: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct DueList {
    pub setting: ScheduleSetting,
    pub total: usize,
    pub rows: Vec<DueRow>,
}

/// `GET /api/immunizations/due-list`
pub async fn due_list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DueParams>,
) -> Result<Json<DueList>, AppError> {
    require_permission(&claims, permissions::patients::immunizations::DUE_LIST)?;
    let within = params.within_days.unwrap_or(7).clamp(0, 60);
    let page = params.page.unwrap_or(1).max(1);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let setting = setting(&mut tx, claims.tenant_id).await?;
    let rows = due_rows(
        &mut tx,
        claims.tenant_id,
        setting.options,
        today_ist(),
        within,
    )
    .await?;
    tx.commit().await?;
    let total = rows.len();
    let rows = rows
        .into_iter()
        .skip((page - 1) * PAGE_SIZE)
        .take(PAGE_SIZE)
        .collect();
    Ok(Json(DueList {
        setting,
        total,
        rows,
    }))
}

/// `GET /api/immunizations/settings`
pub async fn get_setting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ScheduleSetting>, AppError> {
    require_permission(&claims, permissions::patients::immunizations::CONFIGURE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let s = setting(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(s))
}

/// `PUT /api/immunizations/settings`
pub async fn put_setting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScheduleSetting>,
) -> Result<Json<ScheduleSetting>, AppError> {
    require_permission(&claims, permissions::patients::immunizations::CONFIGURE)?;
    if !(0..=MAX_REMIND_DAYS).contains(&body.remind_days_before) {
        return Err(AppError::BadRequest(format!(
            "Reminders go 0 to {MAX_REMIND_DAYS} days before a dose."
        )));
    }
    let value = serde_json::to_value(body).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let old = setting(&mut tx, claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'immunization', 'schedule', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
             updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
    )
    .bind(claims.tenant_id)
    .bind(&value)
    .execute(&mut *tx)
    .await?;
    let old_v = serde_json::to_value(old).unwrap_or_default();
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "immunization.schedule_configured",
            entity_type: "tenant_settings",
            entity_id: None,
            old_values: Some(&old_v),
            new_values: Some(&value),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(body))
}

/// One reminder pass over every hospital that sends them: each child's next
/// dose falling due `remind_days_before` from today (or already due and not
/// yet reminded) is queued as `sms.vaccination_reminder`; the outbox's
/// idempotency key makes a repeat pass a no-op. Returns the doses considered.
pub async fn send_due_reminders(pool: &sqlx::PgPool) -> Result<u64, AppError> {
    let tenants: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT s.tenant_id, t.name FROM tenant_settings s JOIN tenants t ON t.id = s.tenant_id \
          WHERE s.category = 'immunization' AND s.key = 'schedule' AND s.deleted_at IS NULL \
            AND (s.value->>'sms_reminders')::boolean IS TRUE LIMIT 5000",
    )
    .fetch_all(pool)
    .await?;
    let mut queued = 0;
    for (tenant_id, hospital) in tenants {
        queued += remind_tenant(pool, tenant_id, &hospital).await?;
    }
    Ok(queued)
}

async fn remind_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    hospital: &str,
) -> Result<u64, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let setting = setting(&mut tx, tenant_id).await?;
    let today = today_ist();
    let rows = due_rows(
        &mut tx,
        tenant_id,
        setting.options,
        today,
        setting.remind_days_before,
    )
    .await?;
    let mut queued = 0;
    for r in rows
        .iter()
        .filter(|r| r.phone.is_some() && r.state != DoseState::Overdue)
    {
        let date = r.due_on.max(today).format("%d %b %Y").to_string();
        let body = format!(
            "{}'s {} vaccine ({}) is due on {date}. Please visit the immunisation clinic at {hospital}.",
            r.patient_name, r.product_name, r.dose
        );
        medbrains_outbox::queue::queue_in_tx(
            &mut tx,
            medbrains_outbox::queue::OutboxRow {
                tenant_id,
                aggregate_type: "patient",
                aggregate_id: Some(r.patient_id),
                event_type: "sms.vaccination_reminder",
                payload: serde_json::json!({
                    "to": r.phone,
                    "body": body,
                    "template_scope": "vaccination_reminder",
                    "variables": { "child": r.patient_name, "vaccine": r.product_name, "dose": r.dose, "date": date, "hospital": hospital },
                    "patient_id": r.patient_id,
                }),
                // One reminder per dose and due date, across passes and restarts.
                idempotency_key: Some(format!("vax:{}:{}:{}", r.patient_id, r.dose, r.due_on)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("vaccination reminder: {e}")))?;
        queued += 1;
    }
    tx.commit().await?;
    Ok(queued)
}
