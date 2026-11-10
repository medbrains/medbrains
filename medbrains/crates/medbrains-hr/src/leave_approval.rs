//! Leave approval — the two-step chain HR norms expect.
//!
//! 1. **Department head** (`approve_hod`): the head of the applicant's
//!    department — `departments.head_employee_id` — or HR (`hr.leave.manage`)
//!    moves `pending_hod` to `pending_admin`, or rejects.
//! 2. **HR** (`approve` / `approve_admin`): only `hr.leave.manage` gives the
//!    final approval.
//!
//! Nobody decides their own leave, and every decision is written to the
//! audit chain inside the same transaction. The final approval draws the
//! leave's days from the balance in that transaction, under a row lock, and
//! is refused when the balance is short (`leave_rules::draw_balance`).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_core::hr::LeaveRequest;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::leave::{Tx, holds, leave_owner};

#[derive(Debug, Deserialize)]
pub struct LeaveActionRequest {
    pub action: String,
    pub remarks: Option<String>,
}

/// Whether the caller heads the department this employee belongs to.
async fn heads_department_of(
    tx: &mut Tx<'_>,
    claims: &Claims,
    employee_id: Uuid,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS( \
           SELECT 1 FROM employees e \
           JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
                              AND d.deleted_at IS NULL \
           JOIN employees h ON h.id = d.head_employee_id AND h.deleted_at IS NULL \
           WHERE e.id = $2 AND e.tenant_id = $1 AND e.deleted_at IS NULL AND h.user_id = $3)",
    )
    .bind(claims.tenant_id)
    .bind(employee_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?)
}

/// The status an action moves a leave to, after checking the leave is at the
/// right stage and the caller holds the right to take this step.
fn next_status(
    action: &str,
    current: &str,
    is_head: bool,
    manages: bool,
) -> Result<&'static str, AppError> {
    let (next, stages): (&str, &[&str]) = match action {
        "approve_hod" => ("pending_admin", &["pending_hod"]),
        "approve_admin" | "approve" => ("approved", &["pending_hod", "pending_admin"]),
        "reject" => ("rejected", &["draft", "pending_hod", "pending_admin"]),
        _ => return Err(AppError::BadRequest("Invalid action".into())),
    };
    if !stages.contains(&current) {
        return Err(AppError::Conflict(format!(
            "This leave is already {}. Refresh to see where it stands.",
            current.replace('_', " ")
        )));
    }
    let allowed = match next {
        "approved" => manages,
        _ if current == "pending_hod" => is_head || manages,
        _ => manages,
    };
    if allowed {
        return Ok(next);
    }
    Err(AppError::ForbiddenReason(if current == "pending_hod" {
        "Only the head of this employee's department, or HR, can decide this leave.".into()
    } else {
        "Final approval of leave is HR's.".into()
    }))
}

pub async fn leave_action(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LeaveActionRequest>,
) -> Result<Json<LeaveRequest>, AppError> {
    require_permission(&claims, permissions::hr::leave::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Separation of duties: an approver never decides their own leave, even
    // with every approval permission (bypass roles included).
    let owner = leave_owner(&mut tx, claims.tenant_id, id).await?;
    if owner.user_id == Some(claims.sub) {
        return Err(AppError::ForbiddenReason(
            "You cannot approve or reject your own leave. It goes to your department head or HR."
                .into(),
        ));
    }
    let manages = holds(&claims, permissions::hr::leave::MANAGE);
    let is_head = heads_department_of(&mut tx, &claims, owner.employee_id).await?;
    if !manages && !is_head {
        // Outside the caller's department: not theirs to see, let alone decide.
        return Err(AppError::NotFound);
    }
    let new_status = next_status(&body.action, &owner.status, is_head, manages)?;

    let drawn = if new_status == "approved" {
        refuse_if_marked_present(&mut tx, claims.tenant_id, id).await?;
        crate::leave_rules::draw_balance(&mut tx, claims.tenant_id, &owner.terms).await?
    } else {
        None
    };

    let row = sqlx::query_as::<_, LeaveRequest>(
        "UPDATE leave_requests SET \
         status = $3::leave_status, \
         hod_id = CASE WHEN $3 IN ('pending_admin','rejected') AND hod_id IS NULL \
                       THEN $4 ELSE hod_id END, \
         hod_action_at = CASE WHEN $3 IN ('pending_admin','rejected') AND hod_action_at IS NULL \
                              THEN now() ELSE hod_action_at END, \
         hod_remarks = CASE WHEN $3 IN ('pending_admin','rejected') AND hod_remarks IS NULL \
                            THEN $5 ELSE hod_remarks END, \
         admin_id = CASE WHEN $3 IN ('approved','rejected') AND admin_id IS NULL \
                         THEN $4 ELSE admin_id END, \
         admin_action_at = CASE WHEN $3 IN ('approved','rejected') AND admin_action_at IS NULL \
                                THEN now() ELSE admin_action_at END, \
         admin_remarks = CASE WHEN $3 IN ('approved','rejected') AND admin_remarks IS NULL \
                              THEN $5 ELSE admin_remarks END \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.remarks)
    .fetch_one(&mut *tx)
    .await?;

    let decision = serde_json::json!({
        "action": body.action,
        "from": owner.status,
        "to": new_status,
        "as": if is_head { "department_head" } else { "hr" },
        "remarks": body.remarks,
        "balance": drawn,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "leave.decision",
            entity_type: "leave_request",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&decision),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Reverse of the `create_attendance` guard: don't approve a leave that
/// overlaps days the employee was already marked present — payroll would
/// count them twice.
async fn refuse_if_marked_present(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    leave_id: Uuid,
) -> Result<(), AppError> {
    let has_present: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
           SELECT 1 FROM attendance_records a \
           JOIN leave_requests l ON l.id = $2 AND l.tenant_id = $1 \
           WHERE a.tenant_id = $1 AND a.employee_id = l.employee_id \
             AND a.status = 'present' \
             AND a.attendance_date BETWEEN l.start_date AND l.end_date)",
    )
    .bind(tenant_id)
    .bind(leave_id)
    .fetch_one(&mut **tx)
    .await?;
    if has_present {
        return Err(AppError::BadRequest(
            "Employee has 'present' attendance within the leave dates — correct the attendance before approving this leave.".into(),
        ));
    }
    Ok(())
}

/// One application from the caller's team, named for the approver.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TeamLeave {
    pub id: Uuid,
    pub employee_id: Uuid,
    pub employee_name: String,
    pub department_name: String,
    pub leave_type: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub days: rust_decimal::Decimal,
    pub status: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TeamLeaveResponse {
    /// False for an approver who heads no department — the card has nothing to show.
    pub is_department_head: bool,
    pub leaves: Vec<TeamLeave>,
}

/// `GET /api/hr/me/team-leaves` — leave of the departments the caller heads,
/// pending first, the caller's own excluded.
pub async fn list_team_leaves(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TeamLeaveResponse>, AppError> {
    require_permission(&claims, permissions::hr::leave::APPROVE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let is_department_head: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM departments d \
           JOIN employees h ON h.id = d.head_employee_id AND h.deleted_at IS NULL \
           WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND h.user_id = $2)",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let leaves = sqlx::query_as::<_, TeamLeave>(
        "SELECT l.id, l.employee_id, \
                TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS employee_name, \
                d.name AS department_name, l.leave_type::text AS leave_type, \
                l.start_date, l.end_date, l.days, l.status::text AS status, l.reason \
         FROM leave_requests l \
         JOIN employees e ON e.id = l.employee_id AND e.tenant_id = l.tenant_id \
                          AND e.deleted_at IS NULL \
         JOIN departments d ON d.id = e.department_id AND d.tenant_id = l.tenant_id \
                            AND d.deleted_at IS NULL \
         JOIN employees h ON h.id = d.head_employee_id AND h.deleted_at IS NULL \
         WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND h.user_id = $2 \
           AND e.user_id IS DISTINCT FROM $2 \
         ORDER BY (l.status = 'pending_hod') DESC, l.start_date DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(TeamLeaveResponse {
        is_department_head,
        leaves,
    }))
}

#[cfg(test)]
mod tests {
    use super::next_status;

    #[test]
    fn the_head_moves_only_the_first_step() {
        assert_eq!(
            next_status("approve_hod", "pending_hod", true, false).ok(),
            Some("pending_admin")
        );
        assert!(next_status("approve", "pending_admin", true, false).is_err());
        assert!(next_status("approve_hod", "pending_hod", false, false).is_err());
        assert_eq!(
            next_status("reject", "pending_hod", true, false).ok(),
            Some("rejected")
        );
        assert!(next_status("reject", "pending_admin", true, false).is_err());
    }

    #[test]
    fn hr_gives_final_approval_but_not_twice() {
        assert_eq!(
            next_status("approve", "pending_admin", false, true).ok(),
            Some("approved")
        );
        assert!(next_status("approve", "approved", false, true).is_err());
        assert!(next_status("approve_hod", "pending_admin", false, true).is_err());
        assert!(next_status("frobnicate", "pending_hod", true, true).is_err());
    }
}
