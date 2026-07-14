//! Postgres `LISTEN/NOTIFY` bridge → NotificationHub (RFC-NOTIFICATION-SYSTEM).
//!
//! Migration 0285 installs an `AFTER INSERT` trigger on `notifications` that
//! `pg_notify`s the committed row on the `notification_created` channel. This
//! task LISTENs on a dedicated connection and republishes each row to the
//! in-process [`NotificationHub`] for WebSocket fan-out — so **every** producer
//! that calls `create_notification` delivers in real time with no caller
//! changes, and only on commit (persist-then-deliver by construction).
//!
//! Resilience (bounded per DEVICE-CONSTRAINED-RULES): the listener runs in a
//! supervised loop; if the connection drops it reconnects after a fixed delay
//! rather than a tight loop. Malformed payloads are skipped, never fatal.

use std::time::Duration;

use serde::Deserialize;
use sqlx::PgPool;
use sqlx::postgres::PgListener;
use uuid::Uuid;

use crate::services::notification_hub::{NotificationEvent, NotificationHub, user_topic};

const CHANNEL: &str = "notification_created";
const RECONNECT_DELAY: Duration = Duration::from_secs(5);

#[derive(Debug, Deserialize)]
struct Payload {
    id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    kind: String,
    title: String,
    body: Option<String>,
    category: Option<String>,
    entity_type: Option<String>,
    entity_id: Option<Uuid>,
    action_url: Option<String>,
}

/// Spawn the supervised LISTEN bridge. Call once at startup.
pub fn spawn(pool: PgPool, hub: NotificationHub) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = run(&pool, &hub).await {
                tracing::warn!(%error, "notification listener stopped; reconnecting");
            }
            tokio::time::sleep(RECONNECT_DELAY).await;
        }
    });
}

async fn run(pool: &PgPool, hub: &NotificationHub) -> Result<(), sqlx::Error> {
    let mut listener = PgListener::connect_with(pool).await?;
    listener.listen(CHANNEL).await?;
    tracing::info!("notification listener connected");
    loop {
        let msg = listener.recv().await?;
        let Ok(payload) = serde_json::from_str::<Payload>(msg.payload()) else {
            tracing::warn!("notification listener: skipping malformed payload");
            continue;
        };
        let event = NotificationEvent {
            id: payload.id,
            tenant_id: payload.tenant_id,
            kind: payload.kind,
            title: payload.title,
            body: payload.body,
            category: payload.category,
            entity_type: payload.entity_type,
            entity_id: payload.entity_id,
            action_url: payload.action_url,
        };
        hub.publish(&[user_topic(payload.user_id)], event).await;
    }
}

#[cfg(test)]
mod tests {
    use super::Payload;

    /// Locks the trigger↔listener contract: the `json_build_object` shape in
    /// migration 0285 must deserialize into `Payload` (nullable fields absent).
    #[test]
    fn parses_trigger_payload() {
        let json = r#"{
            "id":"11111111-1111-1111-1111-111111111111",
            "tenant_id":"22222222-2222-2222-2222-222222222222",
            "user_id":"33333333-3333-3333-3333-333333333333",
            "kind":"warning","title":"Critical lab result",
            "body":"Potassium 6.8","category":"Lab",
            "entity_type":"lab_order","entity_id":null,"action_url":"/lab/orders/x"
        }"#;
        let p: Payload = serde_json::from_str(json).expect("payload parses");
        assert_eq!(p.kind, "warning");
        assert_eq!(p.category.as_deref(), Some("Lab"));
        assert!(p.entity_id.is_none());
    }
}
