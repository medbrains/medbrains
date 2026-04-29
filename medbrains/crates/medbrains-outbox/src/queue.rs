//! Write-side API. Callers invoke `queue_in_tx` from inside their existing
//! transaction so the queue write is atomic with their domain write.

use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::OutboxError;

/// One outbox row to be queued. `idempotency_key` is optional — when
/// present, the unique index `outbox_events_idemp` deduplicates duplicate
/// queue-writes within a tenant for the same `event_type`.
#[derive(Debug, Clone)]
pub struct OutboxRow {
    pub tenant_id: Uuid,
    pub aggregate_type: &'static str,
    pub aggregate_id: Option<Uuid>,
    pub event_type: &'static str,
    pub payload: Value,
    pub idempotency_key: Option<String>,
}

/// Queue an outbox event inside an existing transaction. Returns the
/// inserted row id. If `idempotency_key` collides with an existing row,
/// returns the existing row id (idempotent).
pub async fn queue_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    row: OutboxRow,
) -> Result<Uuid, OutboxError> {
    let inserted: Option<(Uuid,)> = sqlx::query_as(
        "INSERT INTO outbox_events ( \
             tenant_id, aggregate_type, aggregate_id, event_type, payload, \
             idempotency_key \
         ) VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (tenant_id, event_type, idempotency_key) \
             WHERE idempotency_key IS NOT NULL \
             DO NOTHING \
         RETURNING id",
    )
    .bind(row.tenant_id)
    .bind(row.aggregate_type)
    .bind(row.aggregate_id)
    .bind(row.event_type)
    .bind(&row.payload)
    .bind(row.idempotency_key.as_deref())
    .fetch_optional(&mut **tx)
    .await?;

    if let Some((id,)) = inserted {
        return Ok(id);
    }

    // Idempotency collision — fetch the pre-existing row id so caller has
    // a stable identifier to return to the client.
    let existing: (Uuid,) = sqlx::query_as(
        "SELECT id FROM outbox_events \
         WHERE tenant_id = $1 AND event_type = $2 AND idempotency_key = $3",
    )
    .bind(row.tenant_id)
    .bind(row.event_type)
    .bind(row.idempotency_key.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    Ok(existing.0)
}
