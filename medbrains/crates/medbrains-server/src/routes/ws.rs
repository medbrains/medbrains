//! WebSocket routes for real-time TV display updates.
//!
//! Provides WebSocket endpoints for:
//! - Queue updates (token called, status changes)
//! - Emergency announcements
//! - Bed status changes

use axum::{
    extract::{
        Path, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::state::AppState;

// Broadcaster + event types moved to medbrains-server-core so AppState can hold a
// QueueBroadcaster without depending on routes; re-exported so crate::routes::ws::* resolves.
pub use medbrains_server_core::queue_broadcast::{
    AnnouncementEvent, QueueBroadcaster, QueueEvent, QueueTokenInfo, TOKEN_ONLY_QUEUE_PATIENT_NAME,
};

/// Client message for subscribing/unsubscribing.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    Subscribe { department_id: Uuid },
    Unsubscribe { department_id: Uuid },
    Ping,
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// WebSocket endpoint for queue updates.
///
/// GET /`ws/queue/{department_id`}
pub async fn queue_ws_handler(
    ws: WebSocketUpgrade,
    Path(department_id): Path<Uuid>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_queue_socket(socket, department_id, state))
}

/// Which hospital a board belongs to, taken from the queue it is pointed at.
///
/// These sockets are public — a board has no credentials — so the id in the
/// path is the only thing that says whose display this is. It is a token scope
/// id: a department, a camp counter, a station or a location, because the
/// engine broadcasts on whichever of those the token belongs to. Resolving it
/// against `departments` alone refused every other kind, so a room or camp
/// board never received a live update. An id no scope owns means a
/// misconfigured board, and it gets no feed at all rather than everybody's.
async fn tenant_of_scope(state: &AppState, scope_id: Uuid) -> Option<Uuid> {
    sqlx::query_scalar!( // allow-raw-sql: resolves the tenant itself, so none can scope it
        r#"SELECT tenant_id AS "tenant_id!" FROM token_scopes WHERE scope_id = $1 LIMIT 1"#,
        scope_id,
    )
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
}

/// WebSocket endpoint for all-department updates (multi-display).
///
/// GET /ws/queue
pub async fn queue_ws_handler_all(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_multi_queue_socket(socket, state))
}

/// Handle a single-department WebSocket connection. Subscribes to the real
/// per-department queue channel AND the global announcement channel (emergency
/// codes must reach every board) from `state.queue_broadcaster`. Bounded
/// (lag-drop) and torn down on disconnect.
async fn handle_queue_socket(socket: WebSocket, department_id: Uuid, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    let Some(tenant_id) = tenant_of_scope(&state, department_id).await else {
        tracing::warn!(scope_id = %department_id, "queue socket refused — no such queue scope");
        return;
    };

    let mut queue_rx = state
        .queue_broadcaster
        .get_or_create_channel(department_id)
        .await
        .subscribe();
    let mut announce_rx = state.queue_broadcaster.subscribe_announcements();

    let send_task = tokio::spawn(async move {
        loop {
            let json = tokio::select! {
                ev = queue_rx.recv() => match ev {
                    Ok(event) => serde_json::to_string(&event).ok(),
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => break,
                },
                ev = announce_rx.recv() => match ev {
                    // One global channel carries every hospital's
                    // announcements; this board only shows its own.
                    Ok(event) if event.tenant_id == tenant_id => {
                        serde_json::to_string(&event).ok()
                    }
                    Ok(_) => continue,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => break,
                },
            };
            let Some(json) = json else { continue };
            if sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    // Inbound: exit on close (boards are read-only displays).
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }

    send_task.abort();
}

/// Handle a multi-department WebSocket connection with dynamic subscriptions.
async fn handle_multi_queue_socket(socket: WebSocket, _state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Track subscribed departments
    let _subscribed: Vec<Uuid> = Vec::new();

    // Handle incoming messages
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                if let Ok(msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match msg {
                        ClientMessage::Subscribe { department_id } => {
                            // Add subscription
                            tracing::debug!("Client subscribed to department {department_id}");
                        }
                        ClientMessage::Unsubscribe { department_id } => {
                            // Remove subscription
                            tracing::debug!("Client unsubscribed from department {department_id}");
                        }
                        ClientMessage::Ping => {
                            let pong = Message::Text(r#"{"type":"pong"}"#.into());
                            if sender.send(pong).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(_) => break,
            _ => {}
        }
    }
}
