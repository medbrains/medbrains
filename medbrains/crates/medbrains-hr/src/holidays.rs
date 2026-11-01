//! HR → Holidays: the hospital's holiday list and weekly offs, and the leave
//! day preview the request form shows as dates are chosen.
//!
//! Anyone with `hr.leave.list`, or with a linked employee record, reads the
//! holidays (they are drawn on My time off). Only `hr.holiday.manage` changes
//! them, and every change is audited.

use axum::{
    Extension, Json,
    extract::{Path, Query, State, rejection::JsonRejection},
};
use chrono::NaiveDate;
use medbrains_core::hr::LeaveType;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::leave::{Tx, caller_employee_id, holds};
use crate::leave_rules::{self, Holiday, LeaveDayCount};

/// The widest window one list call covers: a month grid across a year end
/// fits, and a year's holiday list.
const MAX_WINDOW_DAYS: i64 = 400;
const KINDS: [&str; 3] = ["national", "regional", "restricted"];

#[derive(Debug, Deserialize)]
pub struct HolidayWindow {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct HolidayCalendar {
    pub holidays: Vec<Holiday>,
    /// `0` = Sunday … `6` = Saturday.
    pub weekly_offs: Vec<u32>,
}

#[derive(Debug, Deserialize)]
pub struct HolidayInput {
    pub holiday_date: NaiveDate,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeeklyOffsInput {
    pub weekly_offs: Vec<u32>,
}

#[derive(Debug, Deserialize)]
pub struct LeavePreviewQuery {
    pub leave_type: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub is_half_day: Option<bool>,
}

async fn begin(state: &AppState, claims: &Claims) -> Result<Tx<'static>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// HR (`hr.leave.list`) or an employee reading for their own My time off.
async fn require_reader(tx: &mut Tx<'_>, claims: &Claims) -> Result<(), AppError> {
    if holds(claims, permissions::hr::leave::LIST)
        || caller_employee_id(tx, claims).await?.is_some()
    {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

async fn audit(
    tx: &mut Tx<'_>,
    claims: &Claims,
    action: &str,
    id: Option<Uuid>,
    values: &Value,
) -> Result<(), AppError> {
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "hr_holiday",
            entity_id: id,
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// `GET /api/hr/holidays?from&to`
pub async fn list_holidays(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(w): Query<HolidayWindow>,
) -> Result<Json<HolidayCalendar>, AppError> {
    if w.to < w.from || (w.to - w.from).num_days() > MAX_WINDOW_DAYS {
        return Err(AppError::BadRequest(format!(
            "Choose a window of at most {MAX_WINDOW_DAYS} days, ending after it starts."
        )));
    }
    let mut tx = begin(&state, &claims).await?;
    require_reader(&mut tx, &claims).await?;
    let holidays = leave_rules::holidays_between(&mut tx, claims.tenant_id, w.from, w.to).await?;
    let weekly_offs = leave_rules::load_weekly_offs(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(HolidayCalendar {
        holidays,
        weekly_offs,
    }))
}

fn validate(body: &HolidayInput) -> Result<String, AppError> {
    let name = body.name.trim();
    if name.is_empty() || name.chars().count() > 120 {
        return Err(AppError::BadRequest(
            "Give the holiday a name of up to 120 characters.".into(),
        ));
    }
    if !KINDS.contains(&body.kind.as_str()) {
        return Err(AppError::BadRequest(
            "Kind is national, regional or restricted.".into(),
        ));
    }
    Ok(name.to_owned())
}

/// A clearer refusal than the unique index's for a date that is taken.
async fn refuse_taken(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    date: NaiveDate,
    except: Option<Uuid>,
) -> Result<(), AppError> {
    let taken: Option<String> = sqlx::query_scalar(
        "SELECT name FROM hr_holidays \
         WHERE tenant_id = $1 AND holiday_date = $2 AND deleted_at IS NULL \
           AND ($3::uuid IS NULL OR id <> $3)",
    )
    .bind(tenant_id)
    .bind(date)
    .bind(except)
    .fetch_optional(&mut **tx)
    .await?;
    match taken {
        Some(name) => Err(AppError::Conflict(format!(
            "{} is already a holiday: {name}.",
            leave_rules::date_words(date)
        ))),
        None => Ok(()),
    }
}

/// `POST /api/hr/holidays`
pub async fn create_holiday(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<HolidayInput>, JsonRejection>,
) -> Result<Json<Holiday>, AppError> {
    require_permission(&claims, permissions::hr::holiday::MANAGE)?;
    let Json(body) = body?;
    let name = validate(&body)?;
    let mut tx = begin(&state, &claims).await?;
    refuse_taken(&mut tx, claims.tenant_id, body.holiday_date, None).await?;
    let row = sqlx::query_as::<_, Holiday>(
        "INSERT INTO hr_holidays (tenant_id, holiday_date, name, kind, created_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id, holiday_date, name, kind",
    )
    .bind(claims.tenant_id)
    .bind(body.holiday_date)
    .bind(&name)
    .bind(&body.kind)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &claims,
        "hr_holiday.create",
        Some(row.id),
        &json!(row),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/hr/holidays/{id}`
pub async fn update_holiday(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Result<Json<HolidayInput>, JsonRejection>,
) -> Result<Json<Holiday>, AppError> {
    require_permission(&claims, permissions::hr::holiday::MANAGE)?;
    let Json(body) = body?;
    let name = validate(&body)?;
    let mut tx = begin(&state, &claims).await?;
    refuse_taken(&mut tx, claims.tenant_id, body.holiday_date, Some(id)).await?;
    let row = sqlx::query_as::<_, Holiday>(
        "UPDATE hr_holidays SET holiday_date = $3, name = $4, kind = $5 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING id, holiday_date, name, kind",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.holiday_date)
    .bind(&name)
    .bind(&body.kind)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    audit(&mut tx, &claims, "hr_holiday.update", Some(id), &json!(row)).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/hr/holidays/{id}` — soft delete; leave already filed keeps its days.
pub async fn delete_holiday(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Holiday>, AppError> {
    require_permission(&claims, permissions::hr::holiday::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let row = sqlx::query_as::<_, Holiday>(
        "UPDATE hr_holidays SET deleted_at = now(), deleted_by = $3 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING id, holiday_date, name, kind",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    audit(&mut tx, &claims, "hr_holiday.delete", Some(id), &json!(row)).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/hr/weekly-offs`
pub async fn set_weekly_offs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<WeeklyOffsInput>, JsonRejection>,
) -> Result<Json<WeeklyOffsInput>, AppError> {
    require_permission(&claims, permissions::hr::holiday::MANAGE)?;
    let Json(mut body) = body?;
    if body.weekly_offs.iter().any(|d| *d > 6) {
        return Err(AppError::BadRequest(
            "Weekdays are 0 (Sunday) to 6 (Saturday).".into(),
        ));
    }
    if body.weekly_offs.len() > 6 {
        return Err(AppError::BadRequest(
            "At least one day a week must be a working day.".into(),
        ));
    }
    body.weekly_offs.sort_unstable();
    body.weekly_offs.dedup();
    let mut tx = begin(&state, &claims).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
                       value = EXCLUDED.value, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(leave_rules::SETTINGS_CATEGORY)
    .bind(leave_rules::WEEKLY_OFFS_KEY)
    .bind(json!(body.weekly_offs))
    .execute(&mut *tx)
    .await?;
    let values = json!({ "weekly_offs": body.weekly_offs });
    audit(&mut tx, &claims, "hr_weekly_offs.update", None, &values).await?;
    tx.commit().await?;
    Ok(Json(body))
}

/// `GET /api/hr/leaves/preview` — the days a leave of these dates would take,
/// counted by the same rule that files it.
pub async fn preview_leave_days(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<LeavePreviewQuery>,
) -> Result<Json<LeaveDayCount>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    require_reader(&mut tx, &claims).await?;
    let range = (q.start_date, q.end_date);
    let count = leave_rules::compute_days(
        &mut tx,
        claims.tenant_id,
        q.leave_type,
        range,
        q.is_half_day.unwrap_or(false),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(count))
}
