//! Offer every clinical event to the hospital's webhook subscriptions (#224).
//!
//! One outbox row per matching subscription, carrying only identifiers (see
//! `medbrains_outbox::handlers::webhook::minimal_data`); the outbox delivers,
//! signs and retries. Keyed on the subscription and the event, so a
//! redelivered event is not sent twice.

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_outbox::handlers::webhook::{EVENT_TYPE, minimal_data};
use medbrains_outbox::queue::{OutboxRow, queue_in_tx};

/// At most this many partners are told about one event.
const MAX_SUBSCRIPTIONS: i64 = 50;

pub async fn fan_out(
    pool: &PgPool,
    tenant_id: Uuid,
    event_type: &str,
    envelope: &Value,
    data: &Value,
) {
    if let Err(error) = try_fan_out(pool, tenant_id, event_type, envelope, data).await {
        tracing::error!(%tenant_id, event_type, %error, "webhook fan-out failed");
    }
}

async fn try_fan_out(
    pool: &PgPool,
    tenant_id: Uuid,
    event_type: &str,
    envelope: &Value,
    data: &Value,
) -> Result<(), sqlx::Error> {
    let mut tx = super::default_pipelines::tenant_tx(pool, tenant_id).await?;
    let subscriptions: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM webhook_subscriptions \
          WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL AND $2 = ANY(event_types) \
          LIMIT $3",
    )
    .bind(tenant_id)
    .bind(event_type)
    .bind(MAX_SUBSCRIPTIONS)
    .fetch_all(&mut *tx)
    .await?;
    if subscriptions.is_empty() {
        return Ok(());
    }
    let event_key = hex::encode(Sha256::digest(envelope.to_string().as_bytes()));
    let data = minimal_data(data);
    for subscription in subscriptions {
        let queued = queue_in_tx(
            &mut tx,
            OutboxRow {
                tenant_id,
                aggregate_type: "webhook_subscription",
                aggregate_id: Some(subscription),
                event_type: EVENT_TYPE,
                payload: json!({
                    "subscription_id": subscription,
                    "event_type": event_type,
                    "data": data,
                }),
                idempotency_key: Some(format!("wh:{subscription}:{event_key}")),
            },
        )
        .await;
        if let Err(error) = queued {
            tracing::error!(%subscription, %error, "webhook delivery not queued");
        }
    }
    tx.commit().await
}
