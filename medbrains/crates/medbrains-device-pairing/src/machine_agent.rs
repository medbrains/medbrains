//! What `medbrains-agent --main` asks this server, over loopback, with the token only that agent
//! holds. A filing grants nothing, and a tenant is never taken from what a machine sent: the
//! hospital is the one this box serves.

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
use medbrains_kernel::{Actor, Tx, begin};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::machines::constant_time_eq;

/// A person has this long to walk to the main machine and approve.
const REQUEST_TTL_MINUTES: i64 = 10;
/// How many machines may wait at once. The list never refuses a new request: a stranger on the
/// LAN must not be able to stop a hospital adding a machine by filling it. Instead the oldest makes
/// way, and the administrator sees what was pushed out.
const MAX_WAITING: i64 = 20;
/// How many of those one address may hold, so one stranger cannot push out everyone else. Its own
/// oldest goes first. A real machine has one address and asks once.
const MAX_WAITING_PER_ADDRESS: i64 = 3;
/// How many pushed-out requests are kept to show, however long a flood lasts.
const MAX_DROPPED_KEPT: i64 = 50;
const DROPPED_BY_ADDRESS: &str = "More requests came from the same address.";
const DROPPED_LIST_FULL: &str = "The waiting list was full, and this was the oldest.";
const TOKEN_ENV: &str = "MEDBRAINS_MACHINE_AGENT_TOKEN";
const TOKEN_HEADER: &str = "x-machine-agent-token";

/// Where a machine's latest request stands, as its agent is told.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum JoinState {
    Pending,
    Approved,
    Rejected,
    Expired,
    /// A newer request pushed this one out, so this machine should ask again.
    Dropped,
}

/// Reads a request row. A pending request past its time has expired, whatever its status says.
fn join_state(
    status: &str,
    dropped: bool,
    expires_at: DateTime<Utc>,
    now: DateTime<Utc>,
) -> JoinState {
    match status {
        "pending" if expires_at > now => JoinState::Pending,
        "pending" => JoinState::Expired,
        "claimed" | "approved" => JoinState::Approved,
        _ if dropped => JoinState::Dropped,
        _ => JoinState::Rejected,
    }
}

/// The surface recorded for a machine's type, or `None` for a type this does not know.
fn app_variant(kind: &str) -> Option<&'static str> {
    match kind {
        "workstation" => Some("Desktop-Workstation"),
        "display" => Some("Desktop-Display"),
        _ => None,
    }
}

/// True when `presented` is the token this box's agent was given. With no token configured, as
/// off the appliance, nothing passes.
fn agent_token_matches(configured: Option<&str>, presented: Option<&str>) -> bool {
    match (configured, presented) {
        (Some(configured), Some(presented)) if !configured.is_empty() => {
            constant_time_eq(configured, presented)
        }
        _ => false,
    }
}

/// Refuses anything but the agent on this box. The answer says nothing about why.
fn require_agent(headers: &HeaderMap) -> Result<(), AppError> {
    let configured = std::env::var(TOKEN_ENV).ok();
    let presented = headers.get(TOKEN_HEADER).and_then(|v| v.to_str().ok());
    if agent_token_matches(configured.as_deref(), presented) {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

/// The hospital this box serves, only when there is exactly one, with its name. This is where the
/// tenant comes from: never from a machine, and never by picking among several.
async fn this_hospital(db: &sqlx::PgPool) -> Result<(Uuid, String), AppError> {
    let mut rows = sqlx::query!("SELECT id, name FROM tenants WHERE is_active = true LIMIT 2")
        .fetch_all(db)
        .await?;
    match (rows.pop(), rows.is_empty()) {
        (Some(hospital), true) => Ok((hospital.id, hospital.name)),
        _ => Err(AppError::NotFound),
    }
}

/// Who the agent's work runs as: this hospital, and no person.
const fn agent_actor(tenant_id: Uuid) -> Actor {
    Actor { tenant_id, user_id: Uuid::nil() }
}

/// `POST /api/machine-agent/join`'s body. The key and the address come from the iroh connection, as
/// the agent saw them; a machine says neither.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JoinFiling {
    pub node_id: String,
    pub address: String,
    pub label: String,
    pub kind: String,
    pub code: String,
}

/// The answer an agent passes on to its machine.
#[derive(Debug, Serialize)]
pub struct JoinAnswer {
    pub state: JoinState,
}

/// Makes room for one more request. This machine's own waiting request is replaced; past the limits,
/// the oldest goes, from this address first. Keeps a bounded record of what went.
async fn make_room(
    tx: &mut Tx,
    filing: &JoinFiling,
) -> Result<(), AppError> {
    sqlx::query!(
        "UPDATE device_pairing_requests SET status = 'denied' \
          WHERE node_id = $1 AND status = 'pending'",
        filing.node_id,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE device_pairing_requests SET status = 'denied', drop_reason = $3 WHERE id IN ( \
           SELECT id FROM device_pairing_requests \
            WHERE node_id IS NOT NULL AND status = 'pending' AND expires_at > now() \
              AND source_address = $1 \
            ORDER BY created_at DESC OFFSET $2)",
        filing.address,
        MAX_WAITING_PER_ADDRESS - 1,
        DROPPED_BY_ADDRESS,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE device_pairing_requests SET status = 'denied', drop_reason = $2 WHERE id IN ( \
           SELECT id FROM device_pairing_requests \
            WHERE node_id IS NOT NULL AND status = 'pending' AND expires_at > now() \
            ORDER BY created_at DESC OFFSET $1)",
        MAX_WAITING - 1,
        DROPPED_LIST_FULL,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM device_pairing_requests WHERE id IN ( \
           SELECT id FROM device_pairing_requests WHERE drop_reason IS NOT NULL \
            ORDER BY created_at DESC OFFSET $1)",
        MAX_DROPPED_KEPT,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Files a request for this hospital, which grants nothing. A machine already admitted is told so.
/// Public so the flood rules can be tested without an agent token.
pub async fn file_request(
    db: &sqlx::PgPool,
    tenant: Uuid,
    filing: &JoinFiling,
) -> Result<JoinState, AppError> {
    let variant = app_variant(&filing.kind)
        .ok_or_else(|| AppError::BadRequest("unknown machine type".to_owned()))?;
    let mut tx = begin(db, agent_actor(tenant)).await?;
    // One filing at a time, so the limits below cannot be raced past.
    sqlx::query_scalar!(
        r#"SELECT 1 AS "locked!" FROM pg_advisory_xact_lock(hashtext('machine-join'))"#
    )
    .fetch_one(&mut *tx)
    .await?;
    let admitted = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM device_node_keys k
           JOIN paired_devices d ON d.id = k.paired_device_id
          WHERE k.node_id = $1 AND k.tenant_id = $2 AND k.revoked_at IS NULL
            AND d.revoked_at IS NULL) AS "admitted!""#,
        filing.node_id,
        tenant,
    )
    .fetch_one(&mut *tx)
    .await?;
    if admitted {
        return Ok(JoinState::Approved);
    }
    make_room(&mut tx, filing).await?;
    let request = Uuid::new_v4();
    let reference = format!("machine:{request}");
    sqlx::query!(
        "INSERT INTO device_pairing_requests \
           (id, tenant_id, device_code, user_code, app_variant, requested_label, expires_at, \
            node_id, join_code, source_address) \
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)",
        request,
        tenant,
        reference,
        variant,
        filing.label.trim(),
        Utc::now() + Duration::minutes(REQUEST_TTL_MINUTES),
        filing.node_id,
        filing.code,
        filing.address,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(JoinState::Pending)
}

/// `POST /api/machine-agent/join`.
pub async fn file_join(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<JoinFiling>,
) -> Result<Json<JoinAnswer>, AppError> {
    require_agent(&headers)?;
    let db = &state.db;
    let (tenant, _) = this_hospital(db).await?;
    let answer = file_request(&state.db, tenant, &body).await?;
    Ok(Json(JoinAnswer { state: answer }))
}

/// `GET /api/machine-agent/join/{node_id}`: where this key's latest request stands.
pub async fn get_join_state(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(node_id): Path<String>,
) -> Result<Json<JoinAnswer>, AppError> {
    require_agent(&headers)?;
    let db = &state.db;
    let (tenant, _) = this_hospital(db).await?;
    let mut tx = begin(&state.db, agent_actor(tenant)).await?;
    let row = sqlx::query!(
        r#"SELECT status, expires_at, drop_reason IS NOT NULL AS "dropped!"
             FROM device_pairing_requests
            WHERE node_id = $1 ORDER BY created_at DESC LIMIT 1"#,
        node_id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let answer = row.map_or(JoinState::Expired, |row| {
        join_state(&row.status, row.dropped, row.expires_at, Utc::now())
    });
    Ok(Json(JoinAnswer { state: answer }))
}

/// `POST /api/machine-agent/sync`'s body.
#[derive(Debug, Deserialize)]
pub struct SyncBody {
    /// The keys with an open tunnel right now.
    #[serde(default)]
    pub connected: Vec<String>,
}

/// `POST /api/machine-agent/sync`'s answer.
#[derive(Debug, Serialize)]
pub struct SyncAnswer {
    pub hospital: String,
    pub roster: PeerRosterDoc,
}

/// `POST /api/machine-agent/sync`: records who is connected, and answers with who may be. Live
/// keys of machines only, so a phone's sync key cannot open a tunnel to the front end.
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
        sqlx::query!(
            "WITH seen AS (UPDATE device_node_keys SET last_seen_at = now() \
               WHERE tenant_id = $1 AND node_id = ANY($2) AND revoked_at IS NULL \
               RETURNING paired_device_id) \
             UPDATE paired_devices SET last_seen_at = now() \
              WHERE id IN (SELECT paired_device_id FROM seen)",
            tenant,
            body.connected.as_slice(),
        )
        .execute(&mut *tx)
        .await?;
    }
    let rows = sqlx::query!(
        "SELECT k.node_id, k.paired_device_id, d.app_variant \
           FROM device_node_keys k JOIN paired_devices d ON d.id = k.paired_device_id \
          WHERE k.tenant_id = $1 AND k.revoked_at IS NULL AND d.revoked_at IS NULL \
            AND d.app_variant IN ('Desktop-Workstation', 'Desktop-Display') \
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

/// The agent's routes. Public to the router; each checks the token only this box's agent holds.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/machine-agent/join", post(file_join))
        .route("/api/machine-agent/join/{node_id}", get(get_join_state))
        .route("/api/machine-agent/sync", post(agent_sync))
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};

    use super::{JoinState, agent_token_matches, app_variant, join_state};

    /// A request past its time must read as expired, or a key could be approved forever.
    #[test]
    fn a_pending_request_past_its_time_has_expired() {
        let now = Utc::now();
        let later = now + Duration::minutes(1);
        assert_eq!(join_state("pending", false, later, now), JoinState::Pending);
        assert_eq!(join_state("pending", false, now, now), JoinState::Expired);
        assert_eq!(join_state("claimed", false, now, now), JoinState::Approved);
        assert_eq!(join_state("denied", false, later, now), JoinState::Rejected);
    }

    /// Only an approved state may read as approved: anything unknown is a refusal.
    #[test]
    fn an_unknown_status_grants_nothing() {
        let now = Utc::now();
        assert_eq!(join_state("anything", false, now + Duration::days(1), now), JoinState::Rejected);
    }

    /// A machine pushed out by a flood must be told to ask again, not that a person refused it.
    #[test]
    fn a_dropped_request_says_so() {
        let now = Utc::now();
        assert_eq!(join_state("denied", true, now, now), JoinState::Dropped);
    }

    /// Off the appliance there is no token, and nothing may pass, including an empty one.
    #[test]
    fn the_agent_routes_need_the_configured_token() {
        assert!(agent_token_matches(Some("secret"), Some("secret")));
        assert!(!agent_token_matches(Some("secret"), Some("wrong")));
        assert!(!agent_token_matches(Some("secret"), None));
        assert!(!agent_token_matches(None, Some("secret")));
        assert!(!agent_token_matches(Some(""), Some("")));
    }

    #[test]
    fn only_the_two_machine_types_are_accepted() {
        assert_eq!(app_variant("workstation"), Some("Desktop-Workstation"));
        assert_eq!(app_variant("display"), Some("Desktop-Display"));
        assert_eq!(app_variant("tv"), None);
    }
}
