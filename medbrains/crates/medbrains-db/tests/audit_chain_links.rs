//! The audit chain verifier checks links, not just each row's own hash.
//!
//!   `make test-db && cargo test -p medbrains-db --test audit_chain_links`
//!
//! A deleted row, or a row inserted with an honestly computed hash, leaves
//! every remaining row hashing correctly. Only the `prev_hash` links show it.
//! Tampering is done the way an attacker with the owner login would: with
//! triggers off (`session_replication_role = replica`).

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_db_migrations::testing::{add_tenant, fresh_db};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

/// Write one audit row in its own transaction; the trigger links and hashes it.
async fn write(owner: &PgPool, tenant: Uuid, action: &str) {
    let mut tx = owner.begin().await.expect("tx");
    let entry = AuditEntry {
        tenant_id: tenant,
        user_id: None,
        action,
        entity_type: "test",
        entity_id: None,
        old_values: None,
        new_values: None,
        ip_address: None,
    };
    AuditLogger::log(&mut tx, &entry).await.expect("audit row");
    tx.commit().await.expect("commit");
}

/// A tenant with `n` chained rows; returns the tenant and the rows' ids in order.
async fn chain_of(owner: &PgPool, code: &str, n: usize) -> (Uuid, Vec<Uuid>) {
    let tenant = add_tenant(owner, code).await.expect("tenant");
    for i in 0..n {
        write(owner, tenant, &format!("step_{i}")).await;
    }
    let ids = sqlx::query_scalar(
        "SELECT id FROM audit_log WHERE tenant_id = $1 ORDER BY created_at, id",
    )
    .bind(tenant)
    .fetch_all(owner)
    .await
    .expect("ids");
    (tenant, ids)
}

/// Run `sql` with triggers off, as a tamperer with the owner login would.
async fn tamper(owner: &PgPool, sql: &str, binds: &[&str]) {
    let mut conn = owner.acquire().await.expect("conn");
    sqlx::query("SET session_replication_role = replica")
        .execute(&mut *conn)
        .await
        .expect("triggers off");
    let mut q = sqlx::query(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.execute(&mut *conn).await.expect("tamper");
    sqlx::query("SET session_replication_role = origin")
        .execute(&mut *conn)
        .await
        .expect("triggers on");
}

#[tokio::test]
async fn an_intact_chain_verifies() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let (tenant, _) = chain_of(&owner, "CHAINOK", 5).await;
    let v = AuditLogger::verify_chain_for_tenant(&owner, tenant).await.expect("verify");
    assert!(v.valid, "{v:?}");
    assert_eq!(v.rows_checked, 5);
}

#[tokio::test]
async fn a_deleted_middle_row_fails() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let (tenant, ids) = chain_of(&owner, "CHAINDEL", 5).await;
    let victim = ids[2].to_string();
    tamper(&owner, "DELETE FROM audit_log WHERE id = $1::uuid", &[&victim]).await;
    let v = AuditLogger::verify_chain_for_tenant(&owner, tenant).await.expect("verify");
    assert!(!v.valid, "a deleted row went unnoticed: {v:?}");
    assert_eq!(v.broken_at, Some(ids[3]), "break reported at the row after the gap");
}

#[tokio::test]
async fn a_forged_row_with_a_self_consistent_hash_fails() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let (tenant, ids) = chain_of(&owner, "CHAINFRG", 5).await;
    // Slot a row between rows 1 and 2, linked to row 1, hashed honestly.
    let (prev, at): (String, String) = sqlx::query_as(
        "SELECT hash, (created_at + interval '1 microsecond')::text FROM audit_log WHERE id = $1",
    )
    .bind(ids[1])
    .fetch_one(&owner)
    .await
    .expect("row 1");
    let canonical = format!("{{\"forged\": true, \"prev_hash\": \"{prev}\"}}");
    let hash = hex::encode(Sha256::digest(canonical.as_bytes()));
    tamper(
        &owner,
        "INSERT INTO audit_log (tenant_id, action, entity_type, prev_hash, hash, \
             hash_input_canonical, created_at) \
         VALUES ($1::uuid, 'forged', 'test', $2, $3, $4, $5::timestamptz)",
        &[&tenant.to_string(), &prev, &hash, &canonical, &at],
    )
    .await;
    let v = AuditLogger::verify_chain_for_tenant(&owner, tenant).await.expect("verify");
    assert!(!v.valid, "a forged row went unnoticed: {v:?}");
}

/// A transaction that started first but wrote its row last is linked to the
/// newer row while sorting before it. That is the trigger working, not a break.
#[tokio::test]
async fn a_late_writer_is_not_a_break() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let (tenant, _) = chain_of(&owner, "CHAINLATE", 2).await;
    let mut early = owner.begin().await.expect("early tx");
    sqlx::query("SELECT now()").execute(&mut *early).await.expect("pin start time");
    write(&owner, tenant, "meanwhile").await;
    let entry = AuditEntry {
        tenant_id: tenant,
        user_id: None,
        action: "late",
        entity_type: "test",
        entity_id: None,
        old_values: None,
        new_values: None,
        ip_address: None,
    };
    AuditLogger::log(&mut early, &entry).await.expect("late row");
    early.commit().await.expect("commit late");
    write(&owner, tenant, "after").await;
    let v = AuditLogger::verify_chain_for_tenant(&owner, tenant).await.expect("verify");
    assert!(v.valid, "a late writer was reported as a break: {v:?}");
    assert_eq!(v.rows_checked, 5);
}
