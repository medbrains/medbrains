use sha2::{Digest, Sha256};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Parameters for an audit log entry.
#[derive(Debug)]
pub struct AuditEntry<'a> {
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: &'a str,
    pub entity_type: &'a str,
    pub entity_id: Option<Uuid>,
    pub old_values: Option<&'a serde_json::Value>,
    pub new_values: Option<&'a serde_json::Value>,
    pub ip_address: Option<&'a str>,
}

/// Audit logger that maintains a SHA-256 hash chain for tamper evidence.
#[derive(Debug)]
pub struct AuditLogger;

impl AuditLogger {
    /// Log an auditable action within the given transaction.
    /// Fetches the previous hash to form a chain.
    #[allow(clippy::cast_sign_loss)]
    pub async fn log(
        tx: &mut Transaction<'_, Postgres>,
        entry: &AuditEntry<'_>,
    ) -> Result<(), sqlx::Error> {
        // Get the previous hash for the chain
        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT hash FROM audit_log WHERE tenant_id = $1 \
             AND hash IS NOT NULL \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(entry.tenant_id)
        .fetch_optional(&mut **tx)
        .await?;

        // Build the hash payload
        let hash_input = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}",
            entry.tenant_id,
            entry.user_id.map_or_else(String::new, |u| u.to_string()),
            entry.action,
            entry.entity_type,
            entry.entity_id.map_or_else(String::new, |e| e.to_string()),
            entry
                .old_values
                .map_or_else(String::new, ToString::to_string),
            entry
                .new_values
                .map_or_else(String::new, ToString::to_string),
            prev_hash.as_deref().unwrap_or(""),
        );

        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let hash = hex::encode(hasher.finalize());

        sqlx::query(
            "INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, \
             old_values, new_values, ip_address, prev_hash, hash) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(entry.tenant_id)
        .bind(entry.user_id)
        .bind(entry.action)
        .bind(entry.entity_type)
        .bind(entry.entity_id)
        .bind(entry.old_values)
        .bind(entry.new_values)
        .bind(entry.ip_address)
        .bind(prev_hash.as_deref())
        .bind(&hash)
        .execute(&mut **tx)
        .await?;

        Ok(())
    }
}
