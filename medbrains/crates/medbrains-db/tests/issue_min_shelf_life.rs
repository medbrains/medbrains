//! A store issues only batches with the hospital's minimum shelf life left,
//! oldest first, and refuses, naming the earliest expiry, when none has.
//!
//!   `make test-db && cargo test -p medbrains-db --test issue_min_shelf_life`

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_db::stock::{StockError, StockRequest, issue_fefo};
use medbrains_db_migrations::testing::{add_tenant, fresh_db};
use sqlx::PgPool;
use uuid::Uuid;

/// A tenant with one store and one catalogue item holding a 20-day and a
/// 200-day batch of 10 units each.
async fn store_with_two_batches(owner: &PgPool, code: &str) -> (Uuid, Uuid, Uuid) {
    let tenant = add_tenant(owner, code).await.expect("tenant");
    let store: Uuid = sqlx::query_scalar(
        "INSERT INTO store_locations (tenant_id, code, name) VALUES ($1, 'MAIN', 'Main') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(owner)
    .await
    .expect("store");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name) VALUES ($1, 'AMOX', 'Amoxicillin 500') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(owner)
    .await
    .expect("item");
    for (batch, days) in [("SHORT-20", 20), ("LONG-200", 200)] {
        sqlx::query(
            "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, store_location_id, \
             batch_number, expiry_date, quantity_received, quantity_on_hand) \
             VALUES ($1, $2, $3, $4, CURRENT_DATE + $5, 10, 10)",
        )
        .bind(tenant)
        .bind(item)
        .bind(store)
        .bind(batch)
        .bind(days)
        .execute(owner)
        .await
        .expect("batch");
    }
    (tenant, store, item)
}

/// Issue `quantity` of `item` in a transaction that is rolled back.
async fn issue(
    owner: &PgPool,
    ids: (Uuid, Uuid, Uuid),
    quantity: i32,
) -> Result<Vec<String>, StockError> {
    let (tenant, store, item) = ids;
    let mut tx = owner.begin().await.expect("tx");
    let request = StockRequest {
        catalog_item_id: item,
        quantity,
    };
    let lines = issue_fefo(&mut tx, tenant, store, &[request]).await?;
    Ok(lines.into_iter().map(|l| l.batch_number).collect())
}

#[tokio::test]
async fn a_short_dated_batch_is_passed_over() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let ids = store_with_two_batches(&owner, "SHELF").await;

    // Every hospital is seeded with 90 days.
    let seeded: serde_json::Value = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 \
         AND category = 'operations' AND key = 'issue_min_shelf_life_days'",
    )
    .bind(ids.0)
    .fetch_one(&owner)
    .await
    .expect("seeded setting");
    assert_eq!(seeded, serde_json::json!(90));

    // Oldest first would take SHORT-20; with 90 days it must take LONG-200.
    assert_eq!(issue(&owner, ids, 5).await.expect("issued"), ["LONG-200"]);
}

#[tokio::test]
async fn short_dated_stock_is_refused_by_name_unless_the_hospital_allows_it() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let ids = store_with_two_batches(&owner, "SHELFNO").await;

    // More than the long batch holds: refused, naming the 20-day batch.
    let err = issue(&owner, ids, 15).await.expect_err("must refuse");
    let StockError::ShortDated {
        batch_number,
        min_days,
        ..
    } = &err
    else {
        panic!("expected ShortDated, got {err:?}");
    };
    assert_eq!((batch_number.as_str(), *min_days), ("SHORT-20", 90));
    assert!(err.to_string().contains("Amoxicillin 500"), "{err}");

    // A hospital that sets 10 days gets oldest first again.
    sqlx::query(
        "UPDATE tenant_settings SET value = '10' WHERE tenant_id = $1 \
         AND key = 'issue_min_shelf_life_days'",
    )
    .bind(ids.0)
    .execute(&owner)
    .await
    .expect("set 10 days");
    assert_eq!(
        issue(&owner, ids, 15).await.expect("issued"),
        ["SHORT-20", "LONG-200"]
    );
}
