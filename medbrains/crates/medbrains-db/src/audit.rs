use sha2::{Digest, Sha256};
use sqlx::{PgPool, Postgres, Transaction};
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

/// HTTP-level audit entry produced by the AuditLayer Tower middleware.
/// Carries everything the middleware can capture cheaply at request scope.
#[derive(Debug, Clone)]
pub struct HttpAuditEntry {
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub correlation_id: Uuid,
    pub action: String,             // e.g. "POST /api/patients" → "create_patients"
    pub entity_type: String,        // path segment after /api/, e.g. "patients"
    pub entity_id: Option<Uuid>,    // resolved from URL path or response body
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub session_id: Option<Uuid>,
    pub module: Option<String>,
    pub status_code: u16,
    pub method: String,
}

/// Result of a chain integrity check for one tenant.
#[derive(Debug, Clone)]
pub struct ChainVerificationResult {
    pub tenant_id: Uuid,
    pub rows_checked: i64,
    pub rows_legacy_skipped: i64,    // pre-2.5 rows without hash_input_canonical
    pub head_hash: Option<String>,
    pub broken_at: Option<Uuid>,     // audit_log.id where chain breaks
    pub valid: bool,
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
             old_values, new_values, ip_address, prev_hash, hash, hash_input_canonical) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
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
        .bind(&hash_input)
        .execute(&mut **tx)
        .await?;

        Ok(())
    }

    /// Pool-based emit of an HTTP-level audit row.
    /// Opens its own transaction so it never blocks the handler's main tx.
    /// Sets `app.tenant_id` GUC so RLS on `audit_log` allows the insert.
    /// Used by the AuditLayer Tower middleware in medbrains-server.
    pub async fn log_http(pool: &PgPool, entry: &HttpAuditEntry) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;
        // allow-raw-sql: audit-context bootstrap (set_config GUC, no tenant data)
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(entry.tenant_id.to_string())
            .execute(&mut *tx)
            .await?;

        let prev_hash: Option<String> = sqlx::query_scalar(
            "SELECT hash FROM audit_log WHERE tenant_id = $1 \
             AND hash IS NOT NULL \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(entry.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        let hash_input = format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}",
            entry.tenant_id,
            entry.user_id.map_or_else(String::new, |u| u.to_string()),
            entry.action,
            entry.entity_type,
            entry.entity_id.map_or_else(String::new, |e| e.to_string()),
            entry.method,
            entry.status_code,
            entry.correlation_id,
            prev_hash.as_deref().unwrap_or(""),
        );
        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let hash = hex::encode(hasher.finalize());

        sqlx::query(
            "INSERT INTO audit_log ( \
                 tenant_id, user_id, action, entity_type, entity_id, \
                 ip_address, user_agent, session_id, correlation_id, \
                 module, prev_hash, hash, description, hash_input_canonical \
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
        )
        .bind(entry.tenant_id)
        .bind(entry.user_id)
        .bind(&entry.action)
        .bind(&entry.entity_type)
        .bind(entry.entity_id)
        .bind(entry.ip_address.as_deref())
        .bind(entry.user_agent.as_deref())
        .bind(entry.session_id)
        .bind(entry.correlation_id)
        .bind(entry.module.as_deref())
        .bind(prev_hash.as_deref())
        .bind(&hash)
        .bind(format!("{} {} → {}", entry.method, entry.action, entry.status_code))
        .bind(&hash_input)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    /// Verify the SHA-256 hash chain for a single tenant.
    /// Walks the audit_log rows for the tenant in `created_at` order and
    /// recomputes each hash from `prev_hash` + payload. Returns the row
    /// id at which the chain first breaks, if any.
    pub async fn verify_chain_for_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
    ) -> Result<ChainVerificationResult, sqlx::Error> {
        let mut tx = pool.begin().await?;
        // allow-raw-sql: audit-context bootstrap (set_config GUC, no tenant data)
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(tenant_id.to_string())
            .execute(&mut *tx)
            .await?;

        // Read only the canonical hash-input bytes; sidesteps JSONB normalization.
        // Rows with hash_input_canonical IS NULL are pre-Phase-2.5 legacy and
        // are skipped (counted separately).
        let rows: Vec<(Uuid, String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT id, hash, hash_input_canonical, prev_hash \
             FROM audit_log \
             WHERE tenant_id = $1 AND hash IS NOT NULL \
             ORDER BY created_at ASC, id ASC",
        )
        .bind(tenant_id)
        .fetch_all(&mut *tx)
        .await?;

        let mut broken_at: Option<Uuid> = None;
        let mut head: Option<String> = None;
        let mut rows_checked: i64 = 0;
        let mut rows_legacy_skipped: i64 = 0;

        for (id, stored_hash, canonical_opt, _stored_prev) in &rows {
            let Some(canonical) = canonical_opt else {
                rows_legacy_skipped += 1;
                // Track legacy chain head so subsequent rows can still be verified
                // (their prev_hash links into stored_hash even though we can't
                // recompute the legacy row itself).
                head = Some(stored_hash.clone());
                continue;
            };
            let mut hasher = Sha256::new();
            hasher.update(canonical.as_bytes());
            let computed = hex::encode(hasher.finalize());

            if &computed != stored_hash {
                broken_at = Some(*id);
                break;
            }
            rows_checked += 1;
            head = Some(computed);
        }

        tx.commit().await?;
        Ok(ChainVerificationResult {
            tenant_id,
            rows_checked,
            rows_legacy_skipped,
            head_hash: head,
            broken_at,
            valid: broken_at.is_none(),
        })
    }

    /// List all tenants that have audit_log rows. Used by the verify-chain cron.
    pub async fn tenants_with_audit_log(pool: &PgPool) -> Result<Vec<Uuid>, sqlx::Error> {
        // allow-raw-sql: cross-tenant admin query, runs from cron job container only
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT DISTINCT tenant_id FROM audit_log ORDER BY tenant_id",
        )
        .fetch_all(pool)
        .await?;
        Ok(rows.into_iter().map(|(t,)| t).collect())
    }
}
