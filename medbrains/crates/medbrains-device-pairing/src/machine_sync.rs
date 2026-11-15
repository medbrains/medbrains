//! The agent's regular call: who is connected, who may be, and what it has seen at the door.

use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use chrono::Utc;
use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Tx, begin};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};

use crate::machine_agent::{agent_actor, require_agent, this_hospital};

/// How long an approval waits for a person to finish the second code on the machine.
const UNFINISHED_APPROVAL_MINUTES: i32 = 60;
/// The audit action for handshakes given up on, which the Machines screen also reads.
pub const GIVEN_UP_ACTION: &str = "machine.handshakes_given_up";

/// `POST /api/machine-agent/sync`'s body.
#[derive(Debug, Deserialize)]
pub struct SyncBody {
    /// The machines with an open tunnel right now.
    #[serde(default)]
    pub connected: Vec<SeenMachine>,
    #[serde(default)]
    pub given_up: GivenUp,
}

/// Handshakes the agent saw given up on since it last said. Each is what testing a guessed code looks
/// like, so they are recorded and the Machines screen warns about them.
#[derive(Debug, Default, Deserialize)]
pub struct GivenUp {
    pub count: u32,
    pub paused: bool,
}

/// One connected machine, as the agent reports it.
#[derive(Debug, Deserialize)]
pub struct SeenMachine {
    pub node_id: String,
    /// The loopback address its connections reach the front end from. Recorded on the machine, so
    /// that address in the audit log names it.
    pub address: std::net::IpAddr,
}

/// `POST /api/machine-agent/sync`'s answer.
#[derive(Debug, Serialize)]
pub struct SyncAnswer {
    pub hospital: String,
    pub roster: PeerRosterDoc,
}

/// Ends approvals whose machine never connected. The second code was never finished, so a key that
/// won a guessed code, or a machine carried away, must not sit on the roster for ever. Keys first, then
/// devices, the same order as every writer here, so two of them can't deadlock.
async fn expire_unfinished(tx: &mut Tx) -> Result<(), AppError> {
    sqlx::query!(
        "UPDATE device_node_keys k SET revoked_at = now() \
           FROM paired_devices d \
          WHERE d.id = k.paired_device_id AND k.revoked_at IS NULL AND d.revoked_at IS NULL \
            AND d.last_seen_at IS NULL AND d.paired_at < now() - make_interval(mins => $1) \
            AND d.app_variant IN ('Desktop-Workstation', 'Desktop-Display')",
        UNFINISHED_APPROVAL_MINUTES,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE paired_devices SET revoked_at = now(), \
           revoked_reason = 'Approved, and the second code was never finished' \
          WHERE revoked_at IS NULL AND last_seen_at IS NULL \
            AND paired_at < now() - make_interval(mins => $1) \
            AND app_variant IN ('Desktop-Workstation', 'Desktop-Display')",
        UNFINISHED_APPROVAL_MINUTES,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// `POST /api/machine-agent/sync`: records who is connected, and answers with who may be. Only keys
/// a person approved through the join, so no other route onto `device_node_keys` opens a tunnel.
pub async fn agent_sync(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SyncBody>,
) -> Result<Json<SyncAnswer>, AppError> {
    require_agent(&headers)?;
    let db = &state.db;
    let (tenant, hospital) = this_hospital(db).await?;
    let mut tx = begin(&state.db, agent_actor(tenant)).await?;
    if !body.connected.is_empty() {
        let keys: Vec<String> = body
            .connected
            .iter()
            .map(|seen| seen.node_id.clone())
            .collect();
        let addresses: Vec<String> = body
            .connected
            .iter()
            .map(|seen| seen.address.to_string())
            .collect();
        sqlx::query!(
            "WITH seen AS (UPDATE device_node_keys k SET last_seen_at = now() \
               FROM unnest($2::text[], $3::text[]) AS reported(node_id, address) \
               WHERE k.tenant_id = $1 AND k.node_id = reported.node_id AND k.revoked_at IS NULL \
               RETURNING k.paired_device_id, reported.address) \
             UPDATE paired_devices d SET last_seen_at = now(), last_seen_ip = seen.address::inet \
               FROM seen WHERE d.id = seen.paired_device_id",
            tenant,
            keys.as_slice(),
            addresses.as_slice(),
        )
        .execute(&mut *tx)
        .await?;
    }
    expire_unfinished(&mut tx).await?;
    if body.given_up.count > 0 {
        let details =
            serde_json::json!({ "count": body.given_up.count, "paused": body.given_up.paused });
        let entry = AuditEntry {
            tenant_id: tenant,
            user_id: None,
            action: GIVEN_UP_ACTION,
            entity_type: "machine",
            entity_id: None,
            old_values: None,
            new_values: Some(&details),
            ip_address: None,
        };
        medbrains_kernel::audit(&mut tx, &entry).await?;
    }
    let rows = sqlx::query!(
        "SELECT k.node_id, k.paired_device_id, d.app_variant \
           FROM device_node_keys k JOIN paired_devices d ON d.id = k.paired_device_id \
           JOIN device_pairing_requests r ON r.paired_device_id = d.id AND r.node_id = k.node_id \
          WHERE k.tenant_id = $1 AND k.revoked_at IS NULL AND d.revoked_at IS NULL \
            AND d.app_variant IN ('Desktop-Workstation', 'Desktop-Display') \
            AND r.status = 'claimed' \
          ORDER BY k.node_id LIMIT 5000",
        tenant,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let peers = rows.into_iter().map(|row| PeerRosterEntry {
        node_id: row.node_id,
        binding: PeerBinding {
            paired_device_id: row.paired_device_id,
            tenant_id: tenant,
            app_variant: row.app_variant,
            revoked: false,
        },
    });
    let roster = PeerRosterDoc {
        tenant_id: tenant,
        issued_at: Utc::now().timestamp(),
        peers: peers.collect(),
    };
    Ok(Json(SyncAnswer { hospital, roster }))
}
