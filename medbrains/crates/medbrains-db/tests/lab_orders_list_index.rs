//! The lab order list's page — a hospital's live orders, newest first — is
//! read from an index, never by sorting all of the hospital's orders.
//!
//!   `make test-db`, then this crate's test `lab_orders_list_index`.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_db_migrations::testing::{add_tenant, fresh_db};

#[tokio::test]
async fn a_page_of_lab_orders_is_read_from_an_index_without_a_sort() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "LABPAGE").await.expect("tenant");

    let mut tx = owner.begin().await.expect("tx");
    // Too few rows for the planner to prefer an index by cost alone; with
    // sorting and sequential scans priced out, a plan that still sorts has
    // no index to read the order from.
    for off in ["SET LOCAL enable_seqscan = off", "SET LOCAL enable_sort = off"] {
        sqlx::query(off).execute(&mut *tx).await.expect(off);
    }
    // list_orders' query with no filters, as the lab worklist opens.
    let plan: Vec<String> = sqlx::query_scalar(
        "EXPLAIN SELECT * FROM lab_orders WHERE tenant_id = $1 AND deleted_at IS NULL \
         ORDER BY created_at DESC LIMIT 20 OFFSET 40",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await
    .expect("explain");
    let plan = plan.join("\n");
    assert!(!plan.contains("Sort  ("), "a page of lab orders sorts:\n{plan}");
    assert!(
        plan.contains("idx_lab_orders_tenant_created_live"),
        "a page of lab orders does not use the list index:\n{plan}"
    );
}
