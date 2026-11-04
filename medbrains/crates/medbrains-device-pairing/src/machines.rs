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
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::sha256_hex;

/// Wrong codes before a request is refused outright. A person mistypes; a script guesses.
const MAX_CODE_ATTEMPTS: i32 = 3;
/// A machine counts as online for this long after the agent last reported it connected.
const ONLINE_SECONDS: i64 = 15;
const WRONG_CODE: &str = "That is not the code on the machine. Check that you are approving the \
                          right one, because a different code can mean a fake main machine.";

/// Compares without stopping at the first difference.
pub(crate) fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0_u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

/// A machine waiting for a person.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WaitingMachine {
    pub id: Uuid,
    pub label: String,
    pub app_variant: String,
    pub code: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// A joined machine. `online` is worked out from when the agent last reported it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct JoinedMachine {
    pub id: Uuid,
    pub label: String,
    pub app_variant: String,
    pub online: bool,
    pub paired_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

/// The Nodes screen in one call.
#[derive(Debug, Serialize)]
pub struct MachineList {
    pub waiting: Vec<WaitingMachine>,
    pub machines: Vec<JoinedMachine>,
}

/// `GET /api/admin/machines`: everything the Nodes screen shows.
pub async fn list_machines(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MachineList>, AppError> {
    require_permission(&claims, machines::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let waiting = sqlx::query_as::<_, WaitingMachine>(
        "SELECT id, requested_label AS label, app_variant, join_code AS code, expires_at, created_at \
           FROM device_pairing_requests \
          WHERE tenant_id = $1 AND node_id IS NOT NULL AND status = 'pending' AND expires_at > now() \
          ORDER BY created_at LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let joined = sqlx::query_as::<_, JoinedMachine>(
        "SELECT d.id, d.label, d.app_variant, d.paired_at, d.last_seen_at, \
                COALESCE(d.last_seen_at > now() - make_interval(secs => $2), false) AS online \
           FROM paired_devices d \
          WHERE d.tenant_id = $1 AND d.revoked_at IS NULL \
            AND d.app_variant IN ('Desktop-Workstation', 'Desktop-Display') \
          ORDER BY d.label LIMIT 1000",
    )
    .bind(claims.tenant_id)
    .bind(ONLINE_SECONDS as f64)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(MachineList { waiting, machines: joined }))
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
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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
    AuditLogger::log(tx, &entry).await?;
    Ok(())
}

/// A waiting request, locked for this decision.
async fn lock_waiting(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    id: Uuid,
) -> Result<(String, String, String, String), AppError> {
    sqlx::query_as(
        "SELECT node_id, join_code, requested_label, app_variant \
           FROM device_pairing_requests \
          WHERE id = $1 AND tenant_id = $2 AND node_id IS NOT NULL AND status = 'pending' \
            AND expires_at > now() FOR UPDATE",
    )
    .bind(id)
    .bind(tenant)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Writes the machine and its key: the same two rows a device's sync key has, so the roster sees it.
async fn admit_machine(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
    (node_id, label, variant): (&str, &str, &str),
) -> Result<Uuid, AppError> {
    let device: Uuid = sqlx::query_scalar(
        "INSERT INTO paired_devices \
           (tenant_id, label, app_variant, cert_fingerprint, cert_pem) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(label)
    .bind(variant)
    // Per request, because a removed machine may be approved again with the same key.
    .bind(sha256_hex(format!("{node_id}:{id}").as_bytes()))
    .bind(format!("iroh:{node_id}"))
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO device_node_keys (tenant_id, paired_device_id, node_id, created_by) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(claims.tenant_id)
    .bind(device)
    .bind(node_id)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE device_pairing_requests SET status = 'claimed', approved_by_user_id = $2, \
           approved_at = now(), claimed_at = now(), paired_device_id = $3 WHERE id = $1",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(device)
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
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, machines::APPROVE)?;
    let Json(body) = body?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (node_id, code, label, variant) = lock_waiting(&mut tx, claims.tenant_id, id).await?;
    if !code_matches(&code, &body.code) {
        sqlx::query(
            "UPDATE device_pairing_requests SET code_attempts = code_attempts + 1, \
               status = CASE WHEN code_attempts + 1 >= $2 THEN 'denied' ELSE status END \
             WHERE id = $1",
        )
        .bind(id)
        .bind(MAX_CODE_ATTEMPTS)
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
    Ok(Json(serde_json::json!({ "id": device })))
}

/// `POST /api/admin/machines/requests/{id}/reject`: refuses a waiting machine. Its key gets nothing.
pub async fn reject_machine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, machines::APPROVE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (node_id, _, label, _) = lock_waiting(&mut tx, claims.tenant_id, id).await?;
    sqlx::query("UPDATE device_pairing_requests SET status = 'denied' WHERE id = $1")
        .bind(id)
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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query_scalar::<_, Uuid>(
        "UPDATE paired_devices SET revoked_at = now(), revoked_by_user_id = $2, \
           revoked_reason = 'Removed on the Nodes screen' \
         WHERE id = $1 AND tenant_id = $3 AND revoked_at IS NULL \
           AND app_variant IN ('Desktop-Workstation', 'Desktop-Display') RETURNING id",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    sqlx::query(
        "UPDATE device_node_keys SET revoked_at = now(), revoked_by = $2 \
          WHERE paired_device_id = $1 AND tenant_id = $3 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
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
