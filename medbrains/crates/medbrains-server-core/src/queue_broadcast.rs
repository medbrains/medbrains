//! Queue/announcement broadcaster shared via `AppState`.
//!
//! The tokio broadcast fan-out and its event types live here (in the server
//! foundation) so `AppState` can hold a `QueueBroadcaster` without depending on
//! the routes layer. The WebSocket route handlers stay in `routes::ws`.

use std::{collections::HashMap, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, broadcast};
use uuid::Uuid;

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
