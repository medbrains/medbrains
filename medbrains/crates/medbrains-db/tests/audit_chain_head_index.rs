//! The audit chain's head lookup — run under the hospital's chain lock on
//! every audited write — is answered from an index, never by sorting the
//! hospital's audit rows.
//!
//!   `make test-db && cargo test -p medbrains-db --test audit_chain_head_index`

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_db_migrations::testing::{add_tenant, fresh_db};

#[tokio::test]
async fn the_chain_head_is_read_from_an_index_without_a_sort() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "CHAINHEAD").await.expect("tenant");

    let mut tx = owner.begin().await.expect("tx");
    // Too few rows for the planner to prefer an index by cost alone; with
    // sorting and sequential scans priced out, a plan that still sorts has
    // no index to read the order from.
    sqlx::query("SET LOCAL enable_seqscan = off")
        .execute(&mut *tx)
        .await
        .expect("seqscan off");
    sqlx::query("SET LOCAL enable_sort = off")
        .execute(&mut *tx)
        .await
        .expect("sort off");
    // The trigger's own query (audit_log_hash_chain).
    let plan: Vec<String> = sqlx::query_scalar(
        "EXPLAIN SELECT hash FROM audit_log WHERE tenant_id = $1 \
         ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await
    .expect("explain");
    let plan = plan.join("\n");
    assert!(!plan.contains("Sort"), "the head lookup sorts:\n{plan}");
    assert!(
        plan.contains("idx_audit_log_tenant_chain_head") || plan.contains("chain_head"),
        "the head lookup does not use the chain-head index:\n{plan}"
    );
}
