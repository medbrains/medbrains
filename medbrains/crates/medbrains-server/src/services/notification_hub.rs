//! Real-time notification hub (RFC-NOTIFICATION-SYSTEM, P1).
//!
//! One in-process fan-out point that every notification is published to, so
//! web / mobile / TV / kiosk clients receive it live over WebSocket. This is
//! the substrate; P2 wires `create_notification` (post-commit) to `publish` and
//! adds the authed `/ws/notifications` endpoint that calls `subscribe`.
//!
//! DSA / DP / cost discipline (CLAUDE.md + DEVICE-CONSTRAINED-RULES):
//! - **Topic fan-out is O(subscribers)**, never an O(N) per-event DB scan: an
//!   event is published once per topic to a `tokio::broadcast` channel and every
//!   subscriber of that topic receives the shared `Arc`, no cloning of the body.
//! - **Bounded** — each topic channel holds a fixed `CHANNEL_CAP`; a slow
//!   consumer lag-drops (receives `RecvError::Lagged`) rather than growing memory.
//! - **Self-pruning** — a topic whose last receiver dropped is removed on the
//!   next publish (`receiver_count() == 0`), so the topic map stays flat over
//!   uptime instead of accumulating one dead entry per user ever seen.

use std::collections::HashMap;
use std::sync::Arc;

use serde::Serialize;
use tokio::sync::{RwLock, broadcast};
use uuid::Uuid;

/// Bounded per-topic backlog. A consumer more than this many events behind
/// lag-drops (bounded memory) — it recovers missed rows via `?since=` on
/// reconnect (persist-then-deliver; the DB row is the source of truth).
const CHANNEL_CAP: usize = 256;

/// A live notification pushed to subscribed surfaces. Mirrors the durable
/// `notifications` row plus the resolved topics it was fanned out to.
#[derive(Debug, Clone, Serialize)]
pub struct NotificationEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub category: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub action_url: Option<String>,
}

/// Topic key for a user's personal stream.
#[must_use]
pub fn user_topic(user_id: Uuid) -> String {
    format!("user:{user_id}")
}

/// Topic key for a department's staff/board stream.
#[must_use]
pub fn department_topic(department_id: Uuid) -> String {
    format!("department:{department_id}")
}

/// Topic key for a public board surface (e.g. `board:opd`, `board:pharmacy`).
#[must_use]
pub fn board_topic(surface: &str) -> String {
    format!("board:{surface}")
}

/// Global emergency-broadcast topic (every display).
pub const EMERGENCY_TOPIC: &str = "emergency";

/// In-process real-time fan-out. Cheaply clonable (`Arc` inside); held in
/// `AppState`.
#[derive(Clone, Default)]
pub struct NotificationHub {
    topics: Arc<RwLock<HashMap<String, broadcast::Sender<Arc<NotificationEvent>>>>>,
}

impl std::fmt::Debug for NotificationHub {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NotificationHub").finish_non_exhaustive()
    }
}

impl NotificationHub {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Subscribe to a topic, creating its channel on first use. The returned
    /// receiver is bounded (`CHANNEL_CAP`); the caller (WS task) must drain it
    /// and tear it down on disconnect.
    pub async fn subscribe(&self, topic: &str) -> broadcast::Receiver<Arc<NotificationEvent>> {
        let mut topics = self.topics.write().await;
        topics
            .entry(topic.to_owned())
            .or_insert_with(|| broadcast::channel(CHANNEL_CAP).0)
            .subscribe()
    }

    /// Publish an event to every given topic. The body is shared via `Arc` (one
    /// allocation, not per-subscriber). Topics with no live receiver are pruned
    /// so the map stays bounded by the count of *currently-connected* surfaces.
    pub async fn publish(&self, topics: &[String], event: NotificationEvent) {
        let shared = Arc::new(event);
        // Fast path: read lock, send to existing topics. Collect any that are
        // now dead (no receivers) to prune under a short write lock after.
        let mut dead: Vec<String> = Vec::new();
        {
            let map = self.topics.read().await;
            for topic in topics {
                if let Some(sender) = map.get(topic) {
                    if sender.receiver_count() == 0 {
                        dead.push(topic.clone());
                    } else {
                        // Err only means "no receivers this instant" — safe to ignore.
                        let _ = sender.send(Arc::clone(&shared));
                    }
                }
            }
        }
        if !dead.is_empty() {
            let mut map = self.topics.write().await;
            for topic in dead {
                // Re-check under the write lock: a subscriber may have joined.
                if map.get(&topic).is_some_and(|s| s.receiver_count() == 0) {
                    map.remove(&topic);
                }
            }
        }
    }

    /// Number of live topic channels — for observability/tests (bounded).
    pub async fn topic_count(&self) -> usize {
        self.topics.read().await.len()
    }
}

#[cfg(test)]
mod tests {
    use super::{NotificationEvent, NotificationHub, user_topic};
    use uuid::Uuid;

    fn event(tenant: Uuid, title: &str) -> NotificationEvent {
        NotificationEvent {
            id: Uuid::new_v4(),
            tenant_id: tenant,
            kind: "info".to_owned(),
            title: title.to_owned(),
            body: None,
            category: None,
            entity_type: None,
            entity_id: None,
            action_url: None,
        }
    }

    #[tokio::test]
    async fn subscriber_receives_published_event() {
        let hub = NotificationHub::new();
        let user = Uuid::new_v4();
        let mut rx = hub.subscribe(&user_topic(user)).await;

        hub.publish(&[user_topic(user)], event(Uuid::new_v4(), "hello"))
            .await;

        let got = rx.recv().await.expect("event delivered");
        assert_eq!(got.title, "hello");
    }

    #[tokio::test]
    async fn publish_to_topic_with_no_subscriber_is_noop_and_prunes() {
        let hub = NotificationHub::new();
        let user = Uuid::new_v4();
        // Subscribe then drop the receiver → topic exists but has 0 receivers.
        {
            let _rx = hub.subscribe(&user_topic(user)).await;
        }
        assert_eq!(hub.topic_count().await, 1);
        // Publishing prunes the dead topic; no panic, no delivery.
        hub.publish(&[user_topic(user)], event(Uuid::new_v4(), "x"))
            .await;
        assert_eq!(hub.topic_count().await, 0);
    }

    #[tokio::test]
    async fn one_event_fans_out_to_multiple_topics() {
        let hub = NotificationHub::new();
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut ra = hub.subscribe(&user_topic(a)).await;
        let mut rb = hub.subscribe(&user_topic(b)).await;

        hub.publish(
            &[user_topic(a), user_topic(b)],
            event(Uuid::new_v4(), "broadcast"),
        )
        .await;

        assert_eq!(ra.recv().await.unwrap().title, "broadcast");
        assert_eq!(rb.recv().await.unwrap().title, "broadcast");
    }
}
