use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Generate the next value in an atomic sequence.
/// Creates the sequence row if it doesn't exist.
/// Returns a formatted string like `ACMS-2026-00042`.
pub async fn next_sequence(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    seq_type: &str,
    prefix: &str,
    pad_width: i32,
) -> Result<String, sqlx::Error> {
    // Upsert: create if not exists, then atomically increment and return
    let row: (i64, String, i32) = sqlx::query_as(
        "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
         VALUES ($1, $2, $3, 1, $4) \
         ON CONFLICT (tenant_id, seq_type) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, current_val = sequences.current_val + 1, updated_at = now() \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .bind(prefix)
    .bind(pad_width)
    .fetch_one(&mut **tx)
    .await?;

    let (val, pfx, width) = row;
    let formatted = format!("{pfx}{:0>width$}", val, width = width as usize);
    Ok(formatted)
}
