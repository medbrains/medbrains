//! Erasing received copies. A copy is kept only while its consent stands
//! and its `dataEraseAt` has not passed: revocation and expiry erase at
//! once (the notify callback), the erase date is enforced on every read and
//! every push (bounded per call), and reads refuse anything past it even
//! before the erase has run. The bundle is set NULL — the content is gone —
//! and the row stays, stamped, as the record of what was once held.

use uuid::Uuid;

use crate::error::AppError;

/// Copies erased per call by the erase-date sweep.
const ERASE_BATCH: i64 = 500;

/// Erase every copy held under `artefact_ids`, and their keys.
///
/// # Errors
/// A database fault.
pub async fn erase_artefacts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    artefact_ids: &[Uuid],
    reason: &str,
) -> Result<u64, AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_artefacts SET key_material_sealed = NULL \
          WHERE tenant_id = $1 AND id = ANY($2) AND role = 'hiu'",
    )
    .bind(tenant_id)
    .bind(artefact_ids)
    .execute(&mut **tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let erased = sqlx::query(
        "UPDATE abdm_received_records SET bundle = NULL, purged_at = now(), purge_reason = $3 \
          WHERE tenant_id = $1 AND consent_artefact_id = ANY($2) AND purged_at IS NULL",
    )
    .bind(tenant_id)
    .bind(artefact_ids)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    Ok(erased.rows_affected())
}

/// Erase copies whose erase date has passed — at most [`ERASE_BATCH`].
///
/// # Errors
/// A database fault.
pub async fn erase_due(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<u64, AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_artefacts SET key_material_sealed = NULL \
          WHERE tenant_id = $1 AND role = 'hiu' AND key_material_sealed IS NOT NULL \
            AND data_erase_at <= now()",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let erased = sqlx::query(
        "UPDATE abdm_received_records SET bundle = NULL, purged_at = now(), purge_reason = 'erased' \
          WHERE id IN (SELECT id FROM abdm_received_records \
                        WHERE tenant_id = $1 AND purged_at IS NULL AND erase_at <= now() \
                        ORDER BY erase_at LIMIT $2)",
    )
    .bind(tenant_id)
    .bind(ERASE_BATCH)
    .execute(&mut **tx)
    .await?;
    Ok(erased.rows_affected())
}
