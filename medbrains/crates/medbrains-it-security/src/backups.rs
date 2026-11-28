//! Backup history rows for Admin → System health → "Database backups".

use medbrains_core::it_security::BackupHistory;
use uuid::Uuid;

/// The newest backups a hospital may see: its own and the system-wide ones
/// (`tenant_id` NULL, which is what the standalone backup job writes).
///
/// Kept apart from the handler so a test can decode a real row: the card
/// answered 500 from the first backup on, because `expires_at` was read as a
/// date and the column is `timestamptz`.
pub(crate) async fn recent(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
) -> Result<Vec<BackupHistory>, sqlx::Error> {
    sqlx::query_as::<_, BackupHistory>(
        "SELECT * FROM backup_history
         WHERE (tenant_id IS NULL OR tenant_id = $1) AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 100",
    )
    .bind(tenant_id)
    .fetch_all(conn)
    .await
}

#[cfg(test)]
mod db_tests {
    // Against a real, migrated database: the row the backup job writes must
    // decode, or the card is a 500 for every hospital that has ever backed up.
    #![allow(clippy::expect_used)]

    use medbrains_db_migrations::testing::{add_tenant, fresh_db};

    #[tokio::test]
    async fn a_recorded_backup_decodes_with_its_expiry() {
        let db = fresh_db().await.expect("test database");
        let owner = db.owner().await.expect("owner");
        let tenant = add_tenant(&owner, "BKP").await.expect("tenant");
        // The INSERT of deploy/standalone/medbrains-pg-backup.
        sqlx::query(
            "INSERT INTO backup_history (tenant_id, backup_type, backup_name, file_path, \
                 file_size_bytes, status, started_at, completed_at, retention_days, expires_at) \
             VALUES (NULL, 'pg_dump', 'nightly', 'nightly', 1024, 'completed', now(), now(), 14, \
                     now() + make_interval(days => 14))",
        )
        .execute(&owner)
        .await
        .expect("backup row");

        let mut conn = owner.acquire().await.expect("connection");
        let rows = super::recent(&mut conn, tenant).await.expect("rows decode");
        assert_eq!(rows.len(), 1);
        let backup = rows.first().expect("the backup");
        let expires = backup.expires_at.expect("expiry");
        assert_eq!((expires - backup.started_at).num_days(), 14);
    }
}
