//! Leave — applications, approvals, balances.
//!
//! Who may see or file whose leave is decided here, not by the caller:
//!
//! - anyone with a linked employee record files and reads **their own** leave
//!   (`/api/hr/me/*`, no permission beyond being signed in — like `/me/profile`);
//! - a department head reads the leave of their department;
//! - `hr.leave.manage` (HR) files and reads leave for anyone;
//! - nobody approves or rejects their own leave.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{Datelike, NaiveDate};
use medbrains_core::hr::{LeaveBalance, LeaveRequest, LeaveType};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::state::AppState;

use crate::leave_rules::{self, LeaveTerms};

pub(crate) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

const NOT_LINKED: &str =
    "Your login is not linked to an employee record. Ask HR to link it before applying for leave.";

/// Upper bound on one list call — a calendar month of a large hospital fits.
const LIST_LIMIT: i64 = 1000;

#[derive(Debug, Deserialize)]
pub struct ListLeaveQuery {
    pub employee_id: Option<Uuid>,
    /// One status, or several comma-separated (`pending_hod,pending_admin`).
    pub status: Option<String>,
    /// Date window: leave that overlaps `[from, to]` (either end may be open).
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub department_id: Option<Uuid>,
}

/// A leave as the HR list shows it: who it belongs to, and what they have
/// left of that leave type for the leave's year — so the approver sees the
/// balance next to Approve without one request per row.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LeaveListRow {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub leave: LeaveRequest,
    pub employee_name: String,
    pub department_id: Option<Uuid>,
    /// `None` when no balance row exists for that type and year.
    pub remaining_balance: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLeaveRequest {
    /// Whose leave. Omitted means the caller's own; anyone else's needs
    /// `hr.leave.manage`.
    pub employee_id: Option<Uuid>,
    pub leave_type: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    /// Days are counted on the server — see `leave_rules`.
    pub is_half_day: Option<bool>,
    pub reason: Option<String>,
}

pub(crate) fn holds(claims: &Claims, permission: &str) -> bool {
    is_bypass_role(claims) || claims.permissions.iter().any(|p| p == permission)
}

/// The employee record the caller's login is linked to, if any.
pub(crate) async fn caller_employee_id(
    tx: &mut Tx<'_>,
    claims: &Claims,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM employees \
         WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn require_caller_employee(tx: &mut Tx<'_>, claims: &Claims) -> Result<Uuid, AppError> {
    caller_employee_id(tx, claims)
        .await?
        .ok_or_else(|| AppError::BadRequest(NOT_LINKED.to_owned()))
}

/// Whether the caller may see this employee's leave: their own, their
/// department's as its head, or anyone's with `hr.leave.manage`.
/// Denial answers 404 so the endpoint is not an existence oracle.
async fn require_leave_scope(
    tx: &mut Tx<'_>,
    claims: &Claims,
    employee_id: Uuid,
) -> Result<(), AppError> {
    if holds(claims, permissions::hr::leave::MANAGE) {
        return Ok(());
    }
    let visible: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
           SELECT 1 FROM employees e \
           WHERE e.id = $2 AND e.tenant_id = $1 AND e.deleted_at IS NULL \
             AND (e.user_id = $3 OR EXISTS( \
               SELECT 1 FROM departments d \
               JOIN employees h ON h.id = d.head_employee_id AND h.deleted_at IS NULL \
               WHERE d.id = e.department_id AND d.tenant_id = $1 \
                 AND d.deleted_at IS NULL AND h.user_id = $3)))",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    if visible {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

async fn fetch_balances(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    employee_id: Uuid,
) -> Result<Vec<LeaveBalance>, AppError> {
    Ok(sqlx::query_as::<_, LeaveBalance>(
        "SELECT * FROM leave_balances \
         WHERE tenant_id = $1 AND employee_id = $2 AND deleted_at IS NULL \
         ORDER BY year DESC, leave_type LIMIT 5000",
    )
    .bind(tenant_id)
    .bind(employee_id)
    .fetch_all(&mut **tx)
    .await?)
}

pub async fn list_leave_balances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<Vec<LeaveBalance>>, AppError> {
    require_permission(&claims, permissions::hr::leave::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    require_leave_scope(&mut tx, &claims, employee_id).await?;
    let rows = fetch_balances(&mut tx, claims.tenant_id, employee_id).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_my_leave_balances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LeaveBalance>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let me = require_caller_employee(&mut tx, &claims).await?;
    let rows = fetch_balances(&mut tx, claims.tenant_id, me).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Leave the caller may see: everyone's with `hr.leave.manage`, otherwise
/// their own and — as a department head — their department's.
pub async fn list_leave_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListLeaveQuery>,
) -> Result<Json<Vec<LeaveListRow>>, AppError> {
    require_permission(&claims, permissions::hr::leave::LIST)?;
    let statuses: Option<Vec<String>> = params
        .status
        .as_deref()
        .map(|s| s.split(',').map(|v| v.trim().to_owned()).collect());
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LeaveListRow>(
        "SELECT l.*, \
           concat_ws(' ', e.first_name, e.last_name) AS employee_name, \
           e.department_id, \
           (SELECT b.balance FROM leave_balances b \
             WHERE b.tenant_id = l.tenant_id AND b.employee_id = l.employee_id \
               AND b.leave_type = l.leave_type \
               AND b.year = EXTRACT(YEAR FROM l.start_date)::int \
               AND b.deleted_at IS NULL \
             ORDER BY b.updated_at DESC LIMIT 1) AS remaining_balance \
         FROM leave_requests l \
         JOIN employees e ON e.id = l.employee_id AND e.tenant_id = l.tenant_id \
         WHERE l.tenant_id = $1 AND l.deleted_at IS NULL \
           AND ($2::uuid IS NULL OR l.employee_id = $2) \
           AND ($3::text[] IS NULL OR l.status::text = ANY($3)) \
           AND ($6::date IS NULL OR l.end_date >= $6) \
           AND ($7::date IS NULL OR l.start_date <= $7) \
           AND ($8::uuid IS NULL OR e.department_id = $8) \
           AND ($4 OR e.user_id = $5 OR EXISTS( \
             SELECT 1 FROM departments d \
             JOIN employees h ON h.id = d.head_employee_id AND h.deleted_at IS NULL \
             WHERE d.id = e.department_id AND d.tenant_id = $1 \
               AND d.deleted_at IS NULL AND h.user_id = $5)) \
         ORDER BY l.created_at DESC LIMIT $9",
    )
    .bind(claims.tenant_id)
    .bind(params.employee_id)
    .bind(statuses)
    .bind(holds(&claims, permissions::hr::leave::MANAGE))
    .bind(claims.sub)
    .bind(params.from)
    .bind(params.to)
    .bind(params.department_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_my_leave_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LeaveRequest>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let me = require_caller_employee(&mut tx, &claims).await?;
    let rows = sqlx::query_as::<_, LeaveRequest>(
        "SELECT * FROM leave_requests \
         WHERE tenant_id = $1 AND employee_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(me)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Counts the days, then refuses a clash with leave already asked for and a
/// request larger than the balance, before anything is written.
async fn insert_leave(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    employee_id: Uuid,
    body: &CreateLeaveRequest,
) -> Result<LeaveRequest, AppError> {
    let range = (body.start_date, body.end_date);
    let half = body.is_half_day.unwrap_or(false);
    let count = leave_rules::compute_days(tx, tenant_id, body.leave_type, range, half).await?;
    leave_rules::refuse_overlap(tx, tenant_id, employee_id, range).await?;
    let year = body.start_date.year();
    leave_rules::refuse_over_balance(
        tx,
        tenant_id,
        employee_id,
        (body.leave_type, year),
        count.days,
    )
    .await?;
    Ok(sqlx::query_as::<_, LeaveRequest>(
        "INSERT INTO leave_requests \
         (tenant_id, employee_id, leave_type, start_date, end_date, \
          days, is_half_day, reason, status) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_hod') \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(employee_id)
    .bind(body.leave_type)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(count.days)
    .bind(half)
    .bind(&body.reason)
    .fetch_one(&mut **tx)
    .await?)
}

/// Files leave. The employee is the caller unless the caller holds
/// `hr.leave.manage` — a body naming someone else is never trusted alone.
pub async fn create_leave_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLeaveRequest>,
) -> Result<Json<LeaveRequest>, AppError> {
    require_permission(&claims, permissions::hr::leave::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let me = caller_employee_id(&mut tx, &claims).await?;
    let target = match body.employee_id {
        Some(id) if Some(id) != me => {
            require_permission(&claims, permissions::hr::leave::MANAGE)?;
            id
        }
        Some(id) => id,
        None => me.ok_or_else(|| AppError::BadRequest(NOT_LINKED.to_owned()))?,
    };
    let row = insert_leave(&mut tx, claims.tenant_id, target, &body).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Self-service: files leave for the caller. Any `employee_id` in the body is ignored.
pub async fn create_my_leave_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLeaveRequest>,
) -> Result<Json<LeaveRequest>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let me = require_caller_employee(&mut tx, &claims).await?;
    let row = insert_leave(&mut tx, claims.tenant_id, me, &body).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The employee a leave belongs to, the login linked to them, where it
/// stands, and what it draws on the balance.
#[derive(sqlx::FromRow)]
pub(crate) struct LeaveOwner {
    pub(crate) employee_id: Uuid,
    pub(crate) user_id: Option<Uuid>,
    pub(crate) status: String,
    #[sqlx(flatten)]
    pub(crate) terms: LeaveTerms,
}

/// Locks the leave row: two decisions or cancels on one leave run one after
/// the other, and the second sees where the first left it.
pub(crate) async fn leave_owner(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    leave_id: Uuid,
) -> Result<LeaveOwner, AppError> {
    sqlx::query_as::<_, LeaveOwner>(
        "SELECT l.id, l.employee_id, e.user_id, l.status::text AS status, l.leave_type, \
                l.start_date, l.days, l.external_source, l.balance_deducted \
         FROM leave_requests l \
         JOIN employees e ON e.id = l.employee_id AND e.tenant_id = l.tenant_id \
         WHERE l.id = $2 AND l.tenant_id = $1 AND l.deleted_at IS NULL \
         FOR UPDATE OF l",
    )
    .bind(tenant_id)
    .bind(leave_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Statuses a leave can still be cancelled from.
const CANCELLABLE: [&str; 4] = ["draft", "pending_hod", "pending_admin", "approved"];

/// Cancels leave — the applicant's own, or anyone's with `hr.leave.manage`.
/// Cancelling approved leave gives its days back to the balance; both are
/// written to the audit chain in the same transaction.
pub async fn cancel_leave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LeaveRequest>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let owner = leave_owner(&mut tx, claims.tenant_id, id).await?;
    if owner.user_id != Some(claims.sub) && !holds(&claims, permissions::hr::leave::MANAGE) {
        return Err(AppError::NotFound);
    }
    if !CANCELLABLE.contains(&owner.status.as_str()) {
        return Err(AppError::Conflict(format!(
            "This leave is already {}. Refresh to see where it stands.",
            owner.status.replace('_', " ")
        )));
    }
    let restored = if owner.status == "approved" {
        leave_rules::give_back(&mut tx, claims.tenant_id, &owner.terms).await?
    } else {
        None
    };

    let row = sqlx::query_as::<_, LeaveRequest>(
        "UPDATE leave_requests SET \
         status = 'cancelled'::leave_status, \
         cancelled_by = $3, cancelled_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let event = serde_json::json!({ "from": owner.status, "restored": restored });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "leave.cancel",
            entity_type: "leave_request",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&event),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
