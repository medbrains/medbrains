//! MedBrains OS machines joining the main machine (OS-SETUP-AND-TRUST §8).
//!
//! The agent on this box (`medbrains-agent --main`) takes a node's request over iroh and files it
//! here. It grants nothing: only a person with `devices.machines.approve`, retyping the code the
//! machine shows, turns it into a `paired_devices` row with a `device_node_keys` row, and that
//! key on the roster is the only thing the agent admits. The hospital comes from this server,
//! which serves one; nothing the node sent can choose it.

use axum::extract::{Path, State, rejection::JsonRejection};
use axum::routing::{delete, get, post};
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use medbrains_core::permissions::devices::machines;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, Tx, begin, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::sha256_hex;

/// Wrong codes before a request is refused outright. A person mistypes; a script guesses.
const MAX_CODE_ATTEMPTS: i32 = 3;
/// A machine counts as online for this long after the agent last reported it connected.
const ONLINE_SECONDS: f64 = 15.0;
const WRONG_CODE: &str = "That is not the code on the machine. Check that you are approving the \
                          right one, because a different code can mean a fake main machine.";

/// Compares without stopping at the first difference.
pub(crate) fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0_u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

/// A machine waiting for a person.
#[derive(Debug, Serialize)]
pub struct WaitingMachine {
    pub id: Uuid,
    pub label: String,
    pub app_variant: String,
    pub address: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// A joined machine. `online` is worked out from when the agent last reported it.
#[derive(Debug, Serialize)]
pub struct JoinedMachine {
    pub id: Uuid,
    pub label: String,
    pub app_variant: String,
    pub online: bool,
    /// Approved, and its screen has not connected, so a person has yet to type the second code.
    pub awaiting_confirmation: bool,
    /// The loopback address its connections reach this machine from, which the audit log records.
    pub screen_address: Option<String>,
    pub paired_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

/// A request a newer one pushed out, so an administrator can see a flood and who it came from.
#[derive(Debug, Serialize)]
pub struct DroppedRequest {
    pub label: String,
    pub address: Option<String>,
    pub reason: String,
    pub created_at: DateTime<Utc>,
}

/// The Nodes screen in one call.
#[derive(Debug, Serialize)]
pub struct MachineList {
    pub waiting: Vec<WaitingMachine>,
    pub machines: Vec<JoinedMachine>,
    pub dropped: Vec<DroppedRequest>,
}

/// `GET /api/admin/machines`: everything the Nodes screen shows.
pub async fn list_machines(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MachineList>, AppError> {
    require_permission(&claims, machines::VIEW)?;
    let mut tx = begin(&state.db, Actor::from_claims(&claims)).await?;
    let waiting = sqlx::query_as!(
        WaitingMachine,
        r#"SELECT id, requested_label AS label, app_variant, source_address AS address, expires_at, created_at
             FROM device_pairing_requests
            WHERE tenant_id = $1 AND node_id IS NOT NULL AND status = 'pending'
              AND expires_at > now()
            ORDER BY created_at LIMIT 100"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    let joined = sqlx::query_as!(
        JoinedMachine,
        r#"SELECT d.id, d.label, d.app_variant, d.paired_at, d.last_seen_at,
                  COALESCE(d.last_seen_at > now() - make_interval(secs => $2), false) AS "online!",
                  d.last_seen_at IS NULL AS "awaiting_confirmation!",
                  host(d.last_seen_ip) AS screen_address
             FROM paired_devices d
            WHERE d.tenant_id = $1 AND d.revoked_at IS NULL
              AND d.app_variant IN ('Desktop-Workstation', 'Desktop-Display')
            ORDER BY d.label LIMIT 1000"#,
        claims.tenant_id,
        ONLINE_SECONDS,
    )
    .fetch_all(&mut *tx)
    .await?;
    let dropped = sqlx::query_as!(
        DroppedRequest,
        r#"SELECT requested_label AS label, source_address AS address,
                  drop_reason AS "reason!", created_at
             FROM device_pairing_requests
            WHERE tenant_id = $1 AND drop_reason IS NOT NULL
            ORDER BY created_at DESC LIMIT 20"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(MachineList { waiting, machines: joined, dropped }))
}

/// What a person carries back to the machine, to prove this is really its main machine.
#[derive(Debug, Serialize)]
pub struct ApprovedMachine {
    pub id: Uuid,
    pub confirm_code: String,
}

/// What a person retypes to approve.
#[derive(Debug, Deserialize)]
pub struct ApproveBody {
    pub code: String,
}

/// True when the digits a person typed are the code. Spaces are forgiven.
fn code_matches(expected: &str, typed: &str) -> bool {
    let typed: String = typed.chars().filter(|c| !c.is_whitespace()).collect();
    !expected.is_empty() && constant_time_eq(expected, &typed)
}

/// Records who decided what about which machine, in the decision's own transaction, so neither can
/// happen without the other.
async fn audit(
    tx: &mut Tx,
    claims: &Claims,
    action: &str,
    machine: Uuid,
    details: &serde_json::Value,
) -> Result<(), AppError> {
    let entry = AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action,
        entity_type: "machine",
        entity_id: Some(machine),
        old_values: None,
        new_values: Some(details),
        ip_address: None,
    };
    medbrains_kernel::audit(tx, &entry).await?;
    Ok(())
}

/// A waiting request, locked for this decision.
async fn lock_waiting(
    tx: &mut Tx,
    tenant: Uuid,
    id: Uuid,
) -> Result<(String, String, String, String), AppError> {
    let row = sqlx::query!(
        r#"SELECT node_id AS "node_id!", join_code AS "code!", requested_label, app_variant
             FROM device_pairing_requests
            WHERE id = $1 AND tenant_id = $2 AND node_id IS NOT NULL AND status = 'pending'
              AND expires_at > now() FOR UPDATE"#,
        id,
        tenant,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok((row.node_id, row.code, row.requested_label, row.app_variant))
}

/// Writes the machine and its key: the same two rows a device's sync key has, so the roster sees it.
async fn admit_machine(
    tx: &mut Tx,
    claims: &Claims,
    id: Uuid,
    (node_id, label, variant): (&str, &str, &str),
) -> Result<Uuid, AppError> {
    let device = sqlx::query_scalar!(
        "INSERT INTO paired_devices \
           (tenant_id, label, app_variant, cert_fingerprint, cert_pem) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
        claims.tenant_id,
        label,
        variant,
        // Per request, because a removed machine may be approved again with the same key.
        sha256_hex(format!("{node_id}:{id}").as_bytes()),
        format!("iroh:{node_id}"),
    )
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query!(
        "INSERT INTO device_node_keys (tenant_id, paired_device_id, node_id, created_by) \
         VALUES ($1, $2, $3, $4)",
        claims.tenant_id,
        device,
        node_id,
        claims.sub,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE device_pairing_requests SET status = 'claimed', approved_by_user_id = $2, \
           approved_at = now(), claimed_at = now(), paired_device_id = $3 WHERE id = $1",
        id,
        claims.sub,
        device,
    )
    .execute(&mut **tx)
    .await?;
    Ok(device)
}

/// `POST /api/admin/machines/requests/{id}/approve`: admits the key, if the person typed the code
/// the machine shows. A wrong code answers 403, which the audit layer records, and the third wrong
/// code refuses the request.
pub async fn approve_machine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Result<Json<ApproveBody>, JsonRejection>,
) -> Result<Json<ApprovedMachine>, AppError> {
    require_permission(&claims, machines::APPROVE)?;
    let Json(body) = body?;
    let mut tx = begin(&state.db, Actor::from_claims(&claims)).await?;
    let (node_id, code, label, variant) = lock_waiting(&mut tx, claims.tenant_id, id).await?;
    if !code_matches(&code, &body.code) {
        sqlx::query!(
            "UPDATE device_pairing_requests SET code_attempts = code_attempts + 1, \
               status = CASE WHEN code_attempts + 1 >= $2 THEN 'denied' ELSE status END \
             WHERE id = $1",
            id,
            MAX_CODE_ATTEMPTS,
        )
        .execute(&mut *tx)
        .await?;
        let details = serde_json::json!({ "node_id": node_id, "label": label });
        audit(&mut tx, &claims, "machine.wrong_code", id, &details).await?;
        tx.commit().await?;
        return Err(AppError::ForbiddenReason(WRONG_CODE.to_owned()));
    }
    let device = admit_machine(&mut tx, &claims, id, (&node_id, &label, &variant)).await?;
    let details = serde_json::json!({ "node_id": node_id, "label": label, "type": variant });
    audit(&mut tx, &claims, "machine.approved", device, &details).await?;
    tx.commit().await?;
    Ok(Json(ApprovedMachine { id: device, confirm_code: second_code(&mut tx_read(&state, &claims).await?, device).await? }))
}

/// `POST /api/admin/machines/{id}/confirm-code`: the second code again, for a person who closed the
/// dialog or a machine that restarted and asked afresh. Only someone who may approve sees it.
pub async fn machine_confirm_code(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApprovedMachine>, AppError> {
    require_permission(&claims, machines::APPROVE)?;
    let mut tx = tx_read(&state, &claims).await?;
    Ok(Json(ApprovedMachine { id, confirm_code: second_code(&mut tx, id).await? }))
}

/// A unit of work for reading what an approval left behind.
async fn tx_read(state: &AppState, claims: &Claims) -> Result<Tx, AppError> {
    Ok(begin(&state.db, Actor::from_claims(claims)).await?)
}

/// The digits a person types on the machine, from the request that admitted it. Only while it has
/// not connected: once it has, nothing needs them, and nobody should see them.
async fn second_code(tx: &mut Tx, device: Uuid) -> Result<String, AppError> {
    sqlx::query_scalar!(
        r#"SELECT r.confirm_code AS "confirm_code!" FROM device_pairing_requests r
             JOIN paired_devices d ON d.id = r.paired_device_id
            WHERE d.id = $1 AND d.revoked_at IS NULL AND d.last_seen_at IS NULL
              AND r.status = 'claimed' AND r.confirm_code IS NOT NULL
            ORDER BY r.created_at DESC LIMIT 1"#,
        device,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// `POST /api/admin/machines/requests/{id}/reject`: refuses a waiting machine. Its key gets nothing.
pub async fn reject_machine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, machines::APPROVE)?;
    let mut tx = begin(&state.db, Actor::from_claims(&claims)).await?;
    let (node_id, _, label, _) = lock_waiting(&mut tx, claims.tenant_id, id).await?;
    sqlx::query!("UPDATE device_pairing_requests SET status = 'denied' WHERE id = $1", id)
        .execute(&mut *tx)
        .await?;
    let details = serde_json::json!({ "node_id": node_id, "label": label });
    audit(&mut tx, &claims, "machine.rejected", id, &details).await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

/// `DELETE /api/admin/machines/{id}`: ends a machine's access. The key leaves the roster at once,
/// and the agent closes its open tunnel at its next sync, seconds later.
pub async fn remove_machine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, machines::REMOVE)?;
    let mut tx = begin(&state.db, Actor::from_claims(&claims)).await?;
    sqlx::query_scalar!(
        "UPDATE paired_devices SET revoked_at = now(), revoked_by_user_id = $2, \
           revoked_reason = 'Removed on the Nodes screen' \
         WHERE id = $1 AND tenant_id = $3 AND revoked_at IS NULL \
           AND app_variant IN ('Desktop-Workstation', 'Desktop-Display') RETURNING id",
        id,
        claims.sub,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    sqlx::query!(
        "UPDATE device_node_keys SET revoked_at = now(), revoked_by = $2 \
          WHERE paired_device_id = $1 AND tenant_id = $3 AND revoked_at IS NULL",
        id,
        claims.sub,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;
    audit(&mut tx, &claims, "machine.removed", id, &serde_json::json!({})).await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

/// The Nodes screen's routes, for people with the permissions above.
pub fn admin_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/admin/machines", get(list_machines))
        .route("/api/admin/machines/{id}", delete(remove_machine))
        .route("/api/admin/machines/requests/{id}/approve", post(approve_machine))
        .route("/api/admin/machines/{id}/confirm-code", post(machine_confirm_code))
        .route("/api/admin/machines/requests/{id}/reject", post(reject_machine))
}

#[cfg(test)]
mod tests {
    use super::code_matches;

    #[test]
    fn a_person_must_type_exactly_the_code() {
        assert!(code_matches("123456", "123456"));
        assert!(code_matches("123456", " 123 456 "));
        assert!(!code_matches("123456", "123457"));
        assert!(!code_matches("123456", ""));
        assert!(!code_matches("", ""), "an empty code must never match");
    }
}
