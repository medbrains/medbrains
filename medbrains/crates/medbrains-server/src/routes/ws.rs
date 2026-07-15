//! WebSocket routes for real-time TV display updates.
//!
//! Provides WebSocket endpoints for:
//! - Queue updates (token called, status changes)
//! - Emergency announcements
//! - Bed status changes

use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{
        Path, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, broadcast};
use uuid::Uuid;

use crate::state::AppState;

pub const TOKEN_ONLY_QUEUE_PATIENT_NAME: &str = "Token only";

// ─────────────────────────────────────────────────────────────────────────────
// Broadcaster State
// ─────────────────────────────────────────────────────────────────────────────

/// Shared state for managing WebSocket broadcasts per department.
#[derive(Clone)]
pub struct QueueBroadcaster {
    /// Map of `department_id` -> broadcast sender
    channels: Arc<RwLock<HashMap<Uuid, broadcast::Sender<QueueEvent>>>>,
    /// Global announcement channel (all displays)
    announcements: broadcast::Sender<AnnouncementEvent>,
}

impl Default for QueueBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

impl QueueBroadcaster {
    /// Create a new broadcaster with an announcements channel.
    #[must_use]
    pub fn new() -> Self {
        let (announcements, _) = broadcast::channel(100);
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            announcements,
        }
    }

    /// Get or create a broadcast channel for a department.
    pub async fn get_or_create_channel(
        &self,
        department_id: Uuid,
    ) -> broadcast::Sender<QueueEvent> {
        let mut channels = self.channels.write().await;
        channels
            .entry(department_id)
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(100);
                tx
            })
            .clone()
    }

    /// Broadcast a queue event to all subscribers of a department.
    pub async fn broadcast_queue_event(&self, department_id: Uuid, event: QueueEvent) {
        let channels = self.channels.read().await;
        if let Some(sender) = channels.get(&department_id) {
            // Ignore send errors (no receivers)
            let _ = sender.send(event);
        }
    }

    /// Broadcast a "token called" event to a department's TV displays.
    pub async fn broadcast_token_called(&self, department_id: Uuid, token_number: &str) {
        self.broadcast_queue_event(
            department_id,
            QueueEvent::TokenCalled {
                token_number: token_number.to_owned(),
                patient_name: TOKEN_ONLY_QUEUE_PATIENT_NAME.to_owned(),
                room: None,
                counter: None,
            },
        )
        .await;
    }

    /// Broadcast an announcement to all connected displays.
    pub fn broadcast_announcement(&self, event: AnnouncementEvent) {
        let _ = self.announcements.send(event);
    }

    /// Subscribe to announcements.
    pub fn subscribe_announcements(&self) -> broadcast::Receiver<AnnouncementEvent> {
        self.announcements.subscribe()
    }
}

impl std::fmt::Debug for QueueBroadcaster {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("QueueBroadcaster")
            .field("channels", &"[RwLock<HashMap>]")
            .finish()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

/// Queue update event sent to TV displays.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueueEvent {
    /// Full queue state update
    QueueUpdate {
        department_id: Uuid,
        current_token: Option<QueueTokenInfo>,
        next_tokens: Vec<QueueTokenInfo>,
        waiting_count: i32,
        completed_count: i32,
    },
    /// Single token was called
    TokenCalled {
        token_number: String,
        patient_name: String,
        room: Option<String>,
        counter: Option<String>,
    },
    /// Token status changed
    TokenStatusChanged {
        token_number: String,
        status: String,
    },
}

/// Token information for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueTokenInfo {
    pub token_number: String,
    pub patient_name: String,
    pub department_name: String,
    pub doctor_name: Option<String>,
    pub status: String,
    pub counter: Option<String>,
    pub called_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Announcement event for emergency broadcasts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementEvent {
    pub id: Uuid,
    pub message: String,
    pub priority: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod queue_privacy_tests {
    use super::{QueueBroadcaster, QueueEvent, TOKEN_ONLY_QUEUE_PATIENT_NAME};
    use uuid::Uuid;

    #[tokio::test]
    async fn token_called_broadcast_is_token_only() {
        let department_id = Uuid::nil();
        let broadcaster = QueueBroadcaster::new();
        let sender = broadcaster.get_or_create_channel(department_id).await;
        let mut receiver = sender.subscribe();

        broadcaster
            .broadcast_token_called(department_id, "T-007")
            .await;

        let event = receiver.recv().await;
        assert!(matches!(
            event,
            Ok(QueueEvent::TokenCalled {
                token_number,
                patient_name,
                room: None,
                counter: None,
            }) if token_number == "T-007" && patient_name == TOKEN_ONLY_QUEUE_PATIENT_NAME
        ));
    }
}

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
                    Ok(event) => serde_json::to_string(&event).ok(),
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
