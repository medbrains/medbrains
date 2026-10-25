//! The batch's own rows: its header, its audit entry, and the UHIDs it reserves.

use chrono::{DateTime, Utc};
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::tx_for;

/// UHIDs for the batch's new patients, taken from the hospital's series in a
/// short transaction of their own: holding the sequence row for the whole
/// import would stall every live registration. A dry run reserves nothing;
/// a refused batch leaves a gap in the UHID series, never a duplicate.
pub(crate) async fn reserve_uhids(
    state: &AppState,
    tenant: Uuid,
    count: usize,
    dry_run: bool,
) -> Result<Vec<String>, AppError> {
    if count == 0 {
        return Ok(Vec::new());
    }
    if dry_run {
        return Ok((1..=count).map(|n| format!("DRYRUN-{n:06}")).collect());
    }
    let n = i64::try_from(count).unwrap_or(i64::MAX);
    let mut tx = tx_for(state, tenant).await?;
    let (last, prefix, pad): (i64, String, i32) = sqlx::query_as(
        "UPDATE sequences SET current_val = current_val + $2 \
          WHERE tenant_id = $1 AND seq_type = 'UHID' RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant)
    .bind(n)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Internal("UHID sequence not configured for this tenant".to_owned()))?;
    tx.commit().await?;
    let pad = usize::try_from(pad).unwrap_or(5);
    Ok((last - n + 1..=last)
        .map(|v| format!("{prefix}{v:0>pad$}"))
        .collect())
}

/// Who committed which batch, with what it added: the audit trail of an import.
pub(crate) async fn audit_commit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    b: NewBatch<'_>,
    tallies: &Value,
) -> Result<(), AppError> {
    let new_values = json!({ "label": b.label, "tallies": tallies, "go_live_at": b.go_live });
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "history_import.commit",
            entity_type: "history_import_batch",
            entity_id: Some(b.id),
            old_values: None,
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// The batch row's columns, written when it starts (and again after a rollback, so the report survives).
#[derive(Debug, Clone, Copy)]
pub(crate) struct NewBatch<'a> {
    pub(crate) id: Uuid,
    pub(crate) tenant: Uuid,
    pub(crate) user: Uuid,
    pub(crate) label: &'a str,
    pub(crate) dry_run: bool,
    pub(crate) go_live: DateTime<Utc>,
    pub(crate) count: i32,
}

pub(crate) async fn insert_batch(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    b: NewBatch<'_>,
) -> Result<(), AppError> {
    let NewBatch {
        id,
        tenant,
        user,
        label,
        dry_run,
        go_live,
        count,
    } = b;
    sqlx::query(
        "INSERT INTO history_import_batches (id, tenant_id, label, dry_run, status, go_live_at, record_count, created_by) \
         VALUES ($1, $2, $3, $4, 'validated', $5, $6, $7)",
    )
    .bind(id)
    .bind(tenant)
    .bind(label)
    .bind(dry_run)
    .bind(go_live)
    .bind(count)
    .bind(user)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub(crate) async fn finish_batch(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: Uuid,
    status: &str,
    tallies: &Value,
    problems: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE history_import_batches SET status = $2, tallies = $3, problems = $4 WHERE id = $1",
    )
    .bind(id)
    .bind(status)
    .bind(tallies)
    .bind(problems)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
