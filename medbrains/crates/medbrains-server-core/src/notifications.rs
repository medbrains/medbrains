//! In-app notification centre — per-user, tenant-scoped feed with read state.

use axum::{
    Extension, Json,
    extract::{
        Path, Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, header::COOKIE},
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use std::sync::Arc;

use crate::notification_hub::{EventScope, NotificationEvent, user_topic};
use medbrains_core::permissions;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub category: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub action_url: Option<String>,
    pub is_read: bool,
    pub read_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    pub unread: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub notifications: Vec<Notification>,
    pub unread_count: i64,
}

#[derive(Debug, Serialize)]
pub struct UnreadCountResponse {
    pub unread_count: i64,
}

const SELECT_COLS: &str = "id, kind, title, body, category, entity_type, entity_id, \
     action_url, is_read, read_at, created_at";

/// GET /api/notifications — the caller's feed (optionally unread-only).
pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListNotificationsQuery>,
) -> Result<Json<NotificationListResponse>, AppError> {
    let limit = params.limit.unwrap_or(30).clamp(1, 100);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sql = if params.unread.unwrap_or(false) {
        format!(
            "SELECT {SELECT_COLS} FROM notifications \
             WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC LIMIT $2"
        )
    } else {
        format!(
            "SELECT {SELECT_COLS} FROM notifications \
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
        )
    };
    let notifications = sqlx::query_as::<_, Notification>(&sql)
        .bind(claims.sub)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?;

    let unread_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(NotificationListResponse { notifications, unread_count }))
}

/// GET /api/notifications/unread-count
pub async fn notifications_unread_count(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let unread_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(UnreadCountResponse { unread_count }))
}

/// POST /api/notifications/{id}/read
pub async fn mark_notification_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    let unread_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(UnreadCountResponse { unread_count }))
}

/// POST /api/notifications/read-all
pub async fn mark_all_notifications_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE notifications SET is_read = true, read_at = now() \
         WHERE user_id = $1 AND is_read = false",
    )
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(UnreadCountResponse { unread_count: 0 }))
}

// ── Push token registration ──────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub expo_token: String,
    pub platform: Option<String>,
    pub surface: Option<String>,
}

/// POST /api/notifications/push-tokens — register (or refresh) this device's
/// Expo push token so the notification listener can deliver a push when the app
/// is backgrounded. Idempotent per (tenant, user, token).
pub async fn register_push_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RegisterPushTokenRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.expo_token.trim().is_empty() {
        return Err(AppError::BadRequest("expo_token is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO device_push_tokens (tenant_id, user_id, expo_token, platform, surface) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (tenant_id, user_id, expo_token) DO UPDATE SET \
           platform = EXCLUDED.platform, surface = EXCLUDED.surface, \
           revoked = false, last_seen_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.expo_token.trim())
    .bind(&body.platform)
    .bind(&body.surface)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Producer helper ──────────────────────────────────────────────
/// A notification to insert for a recipient user. Use via `create_notification`.
#[derive(Debug)]
pub struct NewNotification<'a> {
    pub user_id: Uuid,
    pub kind: &'a str,
    pub title: &'a str,
    pub body: Option<&'a str>,
    pub category: Option<&'a str>,
    pub entity_type: Option<&'a str>,
    pub entity_id: Option<Uuid>,
    pub action_url: Option<&'a str>,
}

/// Insert a notification row (call inside a tenant-scoped transaction).
/// Returns the new row id so a caller can publish it live post-commit via
/// [`publish_notification`]. Existing callers that write `…await?;` and discard
/// the id keep compiling (persist-only; they gain real-time by publishing).
pub async fn create_notification(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    notification: NewNotification<'_>,
) -> Result<Uuid, AppError> {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO notifications \
         (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    )
    .bind(tenant_id)
    .bind(notification.user_id)
    .bind(notification.kind)
    .bind(notification.title)
    .bind(notification.body)
    .bind(notification.category)
    .bind(notification.entity_type)
    .bind(notification.entity_id)
    .bind(notification.action_url)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

/// Fan a persisted notification out to the recipient's live sockets (call
/// **after** the transaction commits — persist-then-deliver; the DB row is the
/// source of truth, real-time is best-effort on top). O(subscribers).
pub fn publish_notification(state: &AppState, tenant_id: Uuid, id: Uuid, n: &NewNotification<'_>) {
    let event = NotificationEvent {
        id,
        tenant_id,
        kind: n.kind.to_owned(),
        title: n.title.to_owned(),
        body: n.body.map(str::to_owned),
        category: n.category.map(str::to_owned),
        entity_type: n.entity_type.map(str::to_owned),
        entity_id: n.entity_id,
        action_url: n.action_url.map(str::to_owned),
        scope: EventScope::Inbox,
    };
    let hub = state.notifications.clone();
    let topic = user_topic(n.user_id);
    // Fire-and-forget: delivery must never block or fail the request path.
    tokio::spawn(async move {
        hub.publish(&[topic], event).await;
    });
}

/// Tell a department's open screens that something changed, without writing a
/// notification row for anyone.
///
/// Board signals are ephemeral by design: a queue moving is not an item in
/// somebody's inbox, and persisting one per vitals reading would grow the
/// `notifications` table by the busiest thing the hospital does. Screens that
/// miss a signal recover on their next fetch — the database stays the source of
/// truth, this is only the nudge.
pub fn publish_board_signal(
    state: &AppState,
    tenant_id: Uuid,
    department_id: Uuid,
    kind: &str,
    entity_type: &str,
    entity_id: Uuid,
) {
    publish_to_board(
        state,
        tenant_id,
        crate::notification_hub::department_topic(department_id),
        kind,
        entity_type,
        entity_id,
    );
}

/// Same nudge, addressed to a shared board surface (`lab`, `pharmacy`) rather
/// than a department. A lab board serves whoever is standing in front of it, not
/// one department's staff, so its stream is keyed by surface.
pub fn publish_surface_board_signal(
    state: &AppState,
    tenant_id: Uuid,
    surface: &str,
    kind: &str,
    entity_type: &str,
    entity_id: Uuid,
) {
    publish_to_board(
        state,
        tenant_id,
        crate::notification_hub::board_topic(surface),
        kind,
        entity_type,
        entity_id,
    );
}

fn publish_to_board(
    state: &AppState,
    tenant_id: Uuid,
    topic: String,
    kind: &str,
    entity_type: &str,
    entity_id: Uuid,
) {
    let event = NotificationEvent {
        id: Uuid::new_v4(),
        tenant_id,
        kind: kind.to_owned(),
        title: String::new(),
        body: None,
        category: None,
        entity_type: Some(entity_type.to_owned()),
        entity_id: Some(entity_id),
        action_url: None,
        scope: EventScope::Board,
    };
    let hub = state.notifications.clone();
    // Fire-and-forget: a board nudge must never block or fail the request path.
    tokio::spawn(async move {
        hub.publish(&[topic], event).await;
    });
}

/// Convenience for non-transactional producers: insert in its own tenant-scoped
/// transaction, commit, then publish live. Go-forward creator that gets
/// real-time for free.
pub async fn create_and_publish(
    state: &AppState,
    tenant_id: Uuid,
    notification: NewNotification<'_>,
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let id = create_notification(&mut tx, tenant_id, notification.clone_ref()).await?;
    tx.commit().await?;
    publish_notification(state, tenant_id, id, &notification);
    Ok(())
}

impl NewNotification<'_> {
    /// Shallow copy of the borrowed fields (all `Copy`/`&str`) so the value can
    /// be used both for the insert and the post-commit publish.
    fn clone_ref(&self) -> NewNotification<'_> {
        NewNotification {
            user_id: self.user_id,
            kind: self.kind,
            title: self.title,
            body: self.body,
            category: self.category,
            entity_type: self.entity_type,
            entity_id: self.entity_id,
            action_url: self.action_url,
        }
    }
}

// ── Real-time delivery: WebSocket ─────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct WsAuthQuery {
    /// Fallback auth for non-cookie clients (mobile/native): `?token=<jwt>`.
    pub token: Option<String>,
}

/// `GET /ws/notifications` — the caller's live notification stream. Authed
/// inside the handler (WS upgrades bypass the API auth layer): `access_token`
/// cookie first (browsers send it on upgrade), else `?token=` (mobile). On
/// reconnect the client backfills missed rows via `GET /api/notifications`.
pub async fn notifications_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<WsAuthQuery>,
) -> Result<impl IntoResponse, AppError> {
    let token = headers
        .get(COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|c| crate::middleware::auth::parse_cookie_value(c, "access_token").map(str::to_owned))
        .or(q.token)
        .ok_or(AppError::Unauthorized)?;
    let claims = crate::middleware::auth::decode_and_validate(&token, &state.jwt_decoding_key)?;
    let topics = socket_topics(&claims);
    Ok(ws.on_upgrade(move |socket| handle_notifications_socket(socket, state, topics)))
}

/// A socket never names its own topics. Subscribing to a department stream is
/// an authorization decision, so the topic list is derived from the signed
/// claims — a client-supplied topic would let any user read another
/// department's patient traffic.
///
/// Capped so a malformed or oversized token cannot spawn unbounded forwarders
/// (DEVICE-CONSTRAINED-RULES: bound every fan-out).
fn socket_topics(claims: &Claims) -> Vec<String> {
    const MAX_DEPARTMENT_TOPICS: usize = 64;

    let mut topics = Vec::with_capacity(claims.department_ids.len() + 1);
    topics.push(user_topic(claims.sub));
    let mut seen = std::collections::HashSet::new();
    for department_id in claims.department_ids.iter().take(MAX_DEPARTMENT_TOPICS) {
        if seen.insert(*department_id) {
            topics.push(crate::notification_hub::department_topic(*department_id));
        }
    }
    for (surface, required_any) in SURFACE_BOARD_PERMISSIONS {
        let permitted = crate::middleware::authorization::is_bypass_role(claims)
            || required_any
                .iter()
                .any(|needed| claims.permissions.iter().any(|held| held == needed));
        if permitted {
            topics.push(crate::notification_hub::board_topic(surface));
        }
    }
    topics
}

/// Who may listen to a shared board's stream.
///
/// This mirrors `requiredAnyPermissions` on `TOKEN_BOARD_SURFACES` in
/// `@medbrains/types` — the same rule that decides whether the board renders at
/// all decides whether its live stream is readable. Keep the two in step: a
/// surface added there and missed here silently falls back to polling, which is
/// slow rather than wrong; the reverse would leak a board to someone who cannot
/// open it.
const SURFACE_BOARD_PERMISSIONS: &[(&str, &[&str])] = &[
    (
        "lab",
        &[
            permissions::lab::phlebotomy::LIST,
            permissions::lab::samples::LIST,
            permissions::lab::orders::LIST,
            permissions::lab::reports::VIEW,
        ],
    ),
    (
        "pharmacy",
        &[
            permissions::pharmacy::prescriptions::LIST,
            permissions::pharmacy::prescriptions::VIEW,
        ],
    ),
];

async fn handle_notifications_socket(socket: WebSocket, state: AppState, topics: Vec<String>) {
    let (mut sender, mut receiver) = socket.split();

    // One broadcast receiver per topic, merged into a single bounded queue so
    // the writer stays one task regardless of how many departments a user
    // covers. Bounded: a slow client is dropped, never buffered without limit.
    let (tx, mut merged) = tokio::sync::mpsc::channel::<Arc<NotificationEvent>>(256);
    let mut forwarders = Vec::with_capacity(topics.len());
    for topic in topics {
        let mut rx = state.notifications.subscribe(&topic).await;
        let tx = tx.clone();
        forwarders.push(tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    // Lagged (bounded backlog exceeded) is non-fatal: the client
                    // backfills via the REST feed on the next poll.
                    Ok(event) => {
                        if tx.send(event).await.is_err() {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
        }));
    }
    drop(tx);

    let send_task = tokio::spawn(async move {
        while let Some(event) = merged.recv().await {
            let Ok(json) = serde_json::to_string(&*event) else {
                continue;
            };
            if sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    // Drain inbound (ping/close) until the client disconnects.
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }
    for forwarder in forwarders {
        forwarder.abort();
    }
    send_task.abort();
}

#[cfg(test)]
mod tests {
    use super::socket_topics;
    use crate::middleware::auth::Claims;
    use uuid::Uuid;

    fn claims(role: &str, permissions: &[&str], departments: &[Uuid]) -> Claims {
        Claims {
            sub: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: role.to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: departments.to_vec(),
            perm_version: 0,
            exp: 0,
        }
    }

    /// A board's live stream must be readable by exactly the people who may open
    /// the board. Someone without lab permissions holding a socket open would
    /// otherwise see every result posting in the hospital go past.
    #[test]
    fn a_socket_only_joins_boards_its_claims_allow() {
        let lab = claims("lab_technician", &["lab.orders.list"], &[]);
        let topics = socket_topics(&lab);
        assert!(topics.iter().any(|t| t == "board:lab"));
        assert!(
            !topics.iter().any(|t| t == "board:pharmacy"),
            "lab permissions must not open the pharmacy board: {topics:?}"
        );
    }

    #[test]
    fn a_socket_with_no_board_permissions_joins_no_boards() {
        let topics = socket_topics(&claims("receptionist", &["patients.list"], &[]));
        assert!(
            !topics.iter().any(|t| t.starts_with("board:")),
            "no board permission should mean no board stream: {topics:?}"
        );
    }

    /// Departments come from the signed token, never from the client, and are
    /// de-duplicated so a repeated id cannot spawn a second forwarder.
    #[test]
    fn department_topics_are_derived_and_deduplicated() {
        let department = Uuid::new_v4();
        let topics = socket_topics(&claims("nurse", &[], &[department, department]));
        let wanted = format!("department:{department}");
        assert_eq!(topics.iter().filter(|t| **t == wanted).count(), 1);
    }
}
