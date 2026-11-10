//! The downloadable proof of an applied change set (RFC §3.5).

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use sqlx::PgPool;
use uuid::Uuid;

use crate::engine::begin;
use crate::model::{KnowledgeProof, KnowledgeProofAuditRow};
use crate::store;

/// The proof file for an applied (or since rolled-back) set.
///
/// # Errors
/// Forbidden without `list`; conflict before the set is applied.
pub async fn proof(pool: &PgPool, claims: &Claims, id: Uuid) -> Result<KnowledgeProof, AppError> {
    require_permission(claims, permissions::knowledge::change_sets::LIST)?;
    let mut tx = begin(pool, claims).await?;
    let set = store::load_set(&mut tx, claims.tenant_id, id, false).await?;
    let (canonical, proof_hash) = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT proof_canonical, proof_hash FROM knowledge_change_sets WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id).bind(id)
    .fetch_one(&mut *tx)
    .await?;
    let (Some(canonical), Some(proof_hash)) = (canonical, proof_hash) else {
        return Err(AppError::Conflict(format!(
            "A {} change has no proof yet",
            set.status
        )));
    };
    let mut ids: Vec<Uuid> = store::load_items(&mut tx, claims.tenant_id, id)
        .await?
        .iter()
        .map(|i| i.id)
        .collect();
    ids.push(id);
    let audit_rows = sqlx::query_as::<_, KnowledgeProofAuditRow>(
        "SELECT id, action, hash, prev_hash, hash_input_canonical FROM audit_log \
          WHERE tenant_id = $1 AND created_at >= $3 AND hash IS NOT NULL \
            AND entity_type IN ('knowledge_change_set', 'knowledge_change_item') AND entity_id = ANY($2) \
            AND action IN ('knowledge_change.approve', 'knowledge_change.apply', 'knowledge_change.apply_item') \
          ORDER BY created_at, id",
    )
    .bind(claims.tenant_id).bind(&ids).bind(set.created_at)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let input = serde_json::from_str(&canonical).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(KnowledgeProof {
        change_set_id: id,
        canonical,
        input,
        proof_hash,
        audit_rows,
        how_to_verify: "sha256 of the UTF-8 bytes of `canonical` equals `proof_hash`; `canonical` is \
            `input` with object keys sorted and no whitespace. Each audit row's `hash` is the sha256 \
            of its `hash_input_canonical`; the apply row's new_values carry `proof_hash`, binding the \
            proof into the hospital's audit chain."
            .to_owned(),
    })
}
