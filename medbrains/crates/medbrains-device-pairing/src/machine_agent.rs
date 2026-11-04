//! What `medbrains-agent --main` asks this server, over loopback, with the token only that agent
//! holds. A filing grants nothing, and a tenant is never taken from what a machine sent: the
//! hospital is the one this box serves.

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::machines::constant_time_eq;

/// A person has this long to walk to the main machine and approve.
const REQUEST_TTL_MINUTES: i64 = 10;
/// How many machines may wait at once, so a flood of keys cannot fill the list. A real machine
/// that finds it full is told so, and an administrator can reject what is filling it.
const MAX_WAITING: i64 = 20;
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
    /// Too many machines are already waiting.
    Busy,
}

/// Reads a request row. A pending request past its time has expired, whatever its status says.
fn join_state(status: &str, expires_at: DateTime<Utc>, now: DateTime<Utc>) -> JoinState {
    match status {
        "pending" if expires_at > now => JoinState::Pending,
        "pending" => JoinState::Expired,
        "claimed" | "approved" => JoinState::Approved,
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
    let mut rows = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, name FROM tenants WHERE is_active = true LIMIT 2",
    )
    .fetch_all(db)
    .await?;
    match (rows.pop(), rows.is_empty()) {
        (Some(hospital), true) => Ok(hospital),
        _ => Err(AppError::NotFound),
    }
}

/// `POST /api/machine-agent/join`'s body. The key comes from the iroh connection, as the agent saw it.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JoinFiling {
    pub node_id: String,
    pub label: String,
    pub kind: String,
    pub code: String,
}

/// The answer an agent passes on to its machine.
#[derive(Debug, Serialize)]
pub struct JoinAnswer {
    pub state: JoinState,
}

/// `POST /api/machine-agent/join`: files a request, which grants nothing. A machine already
/// admitted is told so; one that asks again replaces its own waiting request.
pub async fn file_join(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<JoinFiling>,
) -> Result<Json<JoinAnswer>, AppError> {
    require_agent(&headers)?;
    let variant = app_variant(&body.kind)
        .ok_or_else(|| AppError::BadRequest("unknown machine type".to_owned()))?;
    let (tenant, _) = this_hospital(&state.db).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await?;
    // One filing at a time, so the count below cannot be raced past its limit.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('machine-join'))")
        .execute(&mut *tx)
        .await?;
    let admitted: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM device_node_keys k \
           JOIN paired_devices d ON d.id = k.paired_device_id \
          WHERE k.node_id = $1 AND k.tenant_id = $2 AND k.revoked_at IS NULL AND d.revoked_at IS NULL)",
    )
    .bind(&body.node_id)
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await?;
    if admitted {
        return Ok(Json(JoinAnswer { state: JoinState::Approved }));
    }
    sqlx::query(
        "UPDATE device_pairing_requests SET status = 'denied' \
          WHERE node_id = $1 AND status = 'pending'",
    )
    .bind(&body.node_id)
    .execute(&mut *tx)
    .await?;
    let waiting: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM device_pairing_requests \
          WHERE node_id IS NOT NULL AND status = 'pending' AND expires_at > now()",
    )
    .fetch_one(&mut *tx)
    .await?;
    if waiting >= MAX_WAITING {
        tx.commit().await?;
        return Ok(Json(JoinAnswer { state: JoinState::Busy }));
    }
    let request = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO device_pairing_requests \
           (id, tenant_id, device_code, user_code, app_variant, requested_label, expires_at, \
            node_id, join_code) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(request)
    .bind(tenant)
    .bind(format!("machine:{request}"))
    .bind(format!("machine:{request}"))
    .bind(variant)
    .bind(body.label.trim())
    .bind(Utc::now() + Duration::minutes(REQUEST_TTL_MINUTES))
    .bind(&body.node_id)
    .bind(&body.code)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(JoinAnswer { state: JoinState::Pending }))
}

/// `GET /api/machine-agent/join/{node_id}`: where this key's latest request stands.
pub async fn get_join_state(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(node_id): Path<String>,
) -> Result<Json<JoinAnswer>, AppError> {
    require_agent(&headers)?;
    let (tenant, _) = this_hospital(&state.db).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await?;
    let row: Option<(String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT status, expires_at FROM device_pairing_requests \
          WHERE node_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&node_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let answer = row.map_or(JoinState::Expired, |(status, expires_at)| {
        join_state(&status, expires_at, Utc::now())
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
    let (tenant, hospital) = this_hospital(&state.db).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await?;
    if !body.connected.is_empty() {
        sqlx::query(
            "WITH seen AS (UPDATE device_node_keys SET last_seen_at = now() \
               WHERE tenant_id = $1 AND node_id = ANY($2) AND revoked_at IS NULL \
               RETURNING paired_device_id) \
             UPDATE paired_devices SET last_seen_at = now() \
              WHERE id IN (SELECT paired_device_id FROM seen)",
        )
        .bind(tenant)
        .bind(&body.connected)
        .execute(&mut *tx)
        .await?;
    }
    let rows = sqlx::query_as::<_, (String, Uuid, String)>(
        "SELECT k.node_id, k.paired_device_id, d.app_variant \
           FROM device_node_keys k JOIN paired_devices d ON d.id = k.paired_device_id \
          WHERE k.tenant_id = $1 AND k.revoked_at IS NULL AND d.revoked_at IS NULL \
            AND d.app_variant IN ('Desktop-Workstation', 'Desktop-Display') \
          ORDER BY k.node_id LIMIT 5000",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let peers = rows.into_iter().map(|(node_id, paired_device_id, app_variant)| PeerRosterEntry {
        node_id,
        binding: PeerBinding { paired_device_id, tenant_id: tenant, app_variant, revoked: false },
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
        assert_eq!(join_state("pending", later, now), JoinState::Pending);
        assert_eq!(join_state("pending", now, now), JoinState::Expired);
        assert_eq!(join_state("claimed", now, now), JoinState::Approved);
        assert_eq!(join_state("denied", later, now), JoinState::Rejected);
    }

    /// Only an approved state may read as approved: anything unknown is a refusal.
    #[test]
    fn an_unknown_status_grants_nothing() {
        let now = Utc::now();
        assert_eq!(join_state("anything", now + Duration::days(1), now), JoinState::Rejected);
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
