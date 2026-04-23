//! WebSocket routes for real-time TV display updates.
//!
//! Provides WebSocket endpoints for:
//! - Queue updates (token called, status changes)
//! - Emergency announcements
//! - Bed status changes

use std::{
    collections::HashMap,
    sync::Arc,
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::state::AppState;

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
    pub async fn broadcast_token_called(&self, department_id: Uuid, token_number: &str, patient_name: &str) {
        self.broadcast_queue_event(department_id, QueueEvent::TokenCalled {
            token_number: token_number.to_owned(),
            patient_name: patient_name.to_owned(),
            room: None,
            counter: None,
        }).await;
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

/// Handle a single-department WebSocket connection.
async fn handle_queue_socket(socket: WebSocket, _department_id: Uuid, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Get broadcaster from state extension (we'll add this)
    let _broadcaster = state
        .db
        .clone(); // Placeholder - we need to add broadcaster to state

    // For now, let's create a simple broadcaster inline
    // In production, this should be part of AppState
    let (_tx, mut rx) = broadcast::channel::<QueueEvent>(100);

    // Spawn task to forward broadcast messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let msg = match serde_json::to_string(&event) {
                Ok(json) => Message::Text(json.into()),
                Err(_) => continue,
            };
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages (ping/pong, close)
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                // Try to parse as client message
                if let Ok(msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match msg {
                        ClientMessage::Ping => {
                            // Client ping - could respond with pong
                        }
                        ClientMessage::Subscribe { .. } | ClientMessage::Unsubscribe { .. } => {
                            // Handle subscription changes
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(_) => break,
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
