//! Approving or refusing a screen waiting to be paired (see
//! [`crate::device_code`] for the whole flow).
//!
//! The person approving types the code the screen shows: the list they pick
//! from never carries it, so approving proves they can see the screen. A wrong
//! code counts against the request and the fifth refuses it. Only this
//! hospital's requests can be found, and an approved screen acts as the
//! hospital's display account, never as the person who approved it.

use axum::extract::rejection::JsonRejection;
use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, Tx, begin, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::{Claims, is_display_variant};
use medbrains_server_core::state::AppState;

use crate::device_code::{PendingRequest, normalize_user_code};
use crate::machines::constant_time_eq;

/// Wrong codes before a request is refused. A person mistypes once or twice;
/// a script guessing 26^8 codes needs far more than this.
const MAX_CODE_ATTEMPTS: i32 = 5;

const WRONG_CODE: &str = "That is not the code on the screen. Check that you chose the right \
                          screen and type the code it shows.";
const REFUSED_AFTER_WRONG_CODES: &str = "Five wrong codes, so this request was refused. The \
                                         screen shows a new code by itself.";

/// An administrator's decision about one waiting screen.
#[derive(Debug, Deserialize)]
pub struct ApproveRequest {
    /// The waiting screen, from the list.
    pub request_id: Uuid,
    /// The code the person approving reads off that screen and types. Needed
    /// to approve, not to deny.
    #[serde(default)]
    pub user_code: String,
    #[serde(default)]
    pub deny: bool,
    /// For a waiting-room screen: the department whose board it shows.
    pub department_id: Option<Uuid>,
    /// For a waiting-room screen: which board (`opd`, `pharmacy`, …).
    pub board_module: Option<String>,
    /// For a customer display (`board_module = counter_display`): its counter.
    pub station_id: Option<Uuid>,
}

/// `flow` is the Flow floor map (#4901): it shows the floor the
/// chosen department's zone is on, and answers only while the add-on is on.
const BOARD_MODULES: [&str; 7] = [
    "registration",
    "opd",
    "lab",
    "radiology",
    "pharmacy",
    "billing",
    "flow",
];

/// A customer display: bound to one billing or pharmacy counter, not a
/// department (#4883).
pub const COUNTER_DISPLAY: &str = "counter_display";

/// The counter a customer display is approved for: an active billing or
/// pharmacy counter of this hospital. Returns the counter's department, which
/// the device row carries like a board's.
async fn counter_of(
    tx: &mut Tx,
    tenant_id: Uuid,
    station_id: Option<Uuid>,
) -> Result<(Uuid, Option<Uuid>), AppError> {
    let refuse = || AppError::BadRequest("Choose the counter this display shows".to_owned());
    let station_id = station_id.ok_or_else(refuse)?;
    let row: Option<(Option<Uuid>,)> = sqlx::query_as(
        "SELECT department_id FROM stations \
          WHERE id = $1 AND tenant_id = $2 AND is_active AND deleted_at IS NULL \
            AND station_type IN ('billing_counter', 'pharmacy_counter')",
    )
    .bind(station_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let (department_id,) = row.ok_or_else(refuse)?;
    Ok((station_id, department_id))
}

/// The hospital's display account: a service account, so it cannot sign in
/// and holds no grants. What a screen may do comes from its pairing (the auth
/// middleware gives a display exactly `display.board.read`). Created on first
/// use.
async fn display_account(tx: &mut Tx, tenant_id: Uuid) -> Result<Uuid, AppError> {
    if let Some(id) = sqlx::query_scalar!(
        "SELECT id FROM users WHERE tenant_id = $1 AND username = 'display_boards' \
           AND is_service_account",
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    {
        return Ok(id);
    }
    Ok(sqlx::query_scalar!(
        "INSERT INTO users (tenant_id, username, email, full_name, role, is_service_account, \
           is_active, email_verified) \
         VALUES ($1, 'display_boards', $2, 'Waiting-room screens', 'service_account', true, \
           true, false) \
         RETURNING id",
        tenant_id,
        // `.invalid` is reserved (RFC 2606): mail to it fails loudly.
        format!("display_boards.{tenant_id}@service.invalid"),
    )
    .fetch_one(&mut **tx)
    .await?)
}

/// A waiting screen of this hospital, locked for this decision: its variant
/// and the code it shows.
async fn lock_waiting(
    tx: &mut Tx,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<(String, String), AppError> {
    sqlx::query_as(
        "SELECT app_variant, user_code FROM device_pairing_requests \
          WHERE id = $1 AND tenant_id = $2 AND node_id IS NULL AND status = 'pending' \
            AND expires_at > now() FOR UPDATE",
    )
    .bind(request_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Records who decided what about which waiting screen, in the decision's own
/// transaction, so neither can happen without the other.
async fn audit(
    tx: &mut Tx,
    claims: &Claims,
    action: &str,
    request_id: Uuid,
) -> Result<(), AppError> {
    let details = serde_json::json!({ "request_id": request_id });
    let entry = AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action,
        entity_type: "screen_pairing_request",
        entity_id: Some(request_id),
        old_values: None,
        new_values: Some(&details),
        ip_address: None,
    };
    medbrains_kernel::audit(tx, &entry).await?;
    Ok(())
}

/// Counts a wrong code against the request and refuses it on the last one.
/// Committed, with its audit row, before the refusal is answered, so the
/// count survives it.
async fn count_wrong_code(
    mut tx: Tx,
    claims: &Claims,
    request_id: Uuid,
) -> Result<AppError, AppError> {
    let status: String = sqlx::query_scalar(
        "UPDATE device_pairing_requests SET code_attempts = code_attempts + 1, \
           status = CASE WHEN code_attempts + 1 >= $2 THEN 'denied' ELSE status END \
         WHERE id = $1 RETURNING status",
    )
    .bind(request_id)
    .bind(MAX_CODE_ATTEMPTS)
    .fetch_one(&mut *tx)
    .await?;
    audit(&mut tx, claims, "screen_pairing.wrong_code", request_id).await?;
    tx.commit().await?;
    let message = if status == "denied" {
        REFUSED_AFTER_WRONG_CODES
    } else {
        WRONG_CODE
    };
    Ok(AppError::ForbiddenReason(message.to_owned()))
}

/// True when what a person typed is the screen's code. Case, spaces and the
/// dash are forgiven; the comparison does not stop at the first difference.
fn code_matches(expected: &str, typed: &str) -> bool {
    !expected.is_empty() && constant_time_eq(expected, &normalize_user_code(typed))
}

/// Where an approved screen points: its board's department, or for a
/// customer display its counter and that counter's department.
async fn screen_target(
    tx: &mut Tx,
    tenant_id: Uuid,
    body: &ApproveRequest,
) -> Result<(Option<Uuid>, Option<Uuid>), AppError> {
    if body.board_module.as_deref() == Some(COUNTER_DISPLAY) {
        let (station, department) = counter_of(tx, tenant_id, body.station_id).await?;
        return Ok((Some(station), department));
    }
    let module_ok = body
        .board_module
        .as_deref()
        .is_some_and(|m| BOARD_MODULES.contains(&m));
    let Some(department_id) = body.department_id.filter(|_| module_ok) else {
        return Err(AppError::BadRequest(
            "Choose the board and the department this screen shows".to_owned(),
        ));
    };
    let active = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM departments
                              WHERE id = $1 AND tenant_id = $2 AND is_active) AS "ok!""#,
        department_id,
        tenant_id,
    )
    .fetch_one(&mut **tx)
    .await?;
    if !active {
        return Err(AppError::BadRequest(
            "Choose an active department".to_owned(),
        ));
    }
    Ok((None, Some(department_id)))
}

/// `POST /api/admin/device-pairing/approve`: approves or refuses a waiting screen.
///
/// Only this hospital's screens are found. Approving needs the code the screen shows; a
/// wrong code answers 403 and the fifth refuses the request. An approved
/// screen acts as the hospital's display account, never as the approver.
pub async fn approve_pairing_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<ApproveRequest>, JsonRejection>,
) -> Result<Json<PendingRequest>, AppError> {
    require_permission(&claims, permissions::devices::pairing::TOKEN_CREATE)?;
    let Json(body) = body?;
    let mut tx = begin(&state.db, Actor::from_claims(&claims)).await?;
    let (app_variant, code) = lock_waiting(&mut tx, claims.tenant_id, body.request_id).await?;

    let (approved_for, station_id, department_id, board_module) = if body.deny {
        (None, None, None, None)
    } else {
        // Requests from before only screens could ask; one is never approved.
        if !is_display_variant(&app_variant) {
            return Err(AppError::BadRequest(
                "Only a screen pairs with a code. Refuse this request.".to_owned(),
            ));
        }
        if !code_matches(&code, &body.user_code) {
            return Err(count_wrong_code(tx, &claims, body.request_id).await?);
        }
        let (station, department) = screen_target(&mut tx, claims.tenant_id, &body).await?;
        let account = display_account(&mut tx, claims.tenant_id).await?;
        (
            Some(account),
            station,
            department,
            body.board_module.as_deref(),
        )
    };

    let row = sqlx::query_as::<_, PendingRequest>(
        "UPDATE device_pairing_requests SET \
           status = $1, approved_by_user_id = $2, approved_for_user_id = $3, \
           approved_at = now(), department_id = $5, board_module = $6, station_id = $7 \
         WHERE id = $4 AND tenant_id = $8 \
         RETURNING id, upper(left(id::text, 6)) AS reference, app_variant, requested_label, \
                   expires_at, created_at",
    )
    .bind(if body.deny { "denied" } else { "approved" })
    .bind(claims.sub)
    .bind(approved_for)
    .bind(body.request_id)
    .bind(department_id)
    .bind(board_module)
    .bind(station_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let action = if body.deny {
        "screen_pairing.denied"
    } else {
        "screen_pairing.approved"
    };
    audit(&mut tx, &claims, action, body.request_id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::code_matches;
    use crate::device_code::{format_user_code, generate_user_code};

    #[test]
    fn approving_needs_exactly_the_code_on_the_screen() {
        let code = generate_user_code();
        assert!(code_matches(&code, &format_user_code(&code).to_lowercase()));
        let mut wrong = code.clone().into_bytes();
        wrong[0] = if wrong[0] == b'2' { b'3' } else { b'2' };
        assert!(!code_matches(&code, &String::from_utf8_lossy(&wrong)));
        assert!(!code_matches(&code, ""), "no code typed approves nothing");
        assert!(!code_matches("", ""), "an empty code never matches");
    }
}
