mod common;

use uuid::Uuid;

/// Stock reporting must count only what can actually be dispensed.
///
/// `pharmacy_catalog.current_stock` includes expired batches. Expired stock
/// cannot be given to a patient, so a shelf full of out-of-date tablets is a
/// stockout wearing a disguise — and a query that reads `current_stock` calls
/// it healthy inventory.
///
/// The first item below is exactly that: 500 units on the shelf, every one of
/// them out of date, and `current_stock` saying 500. It must come back
/// `stocked_out = true`.
#[tokio::test]
async fn expired_stock_is_not_counted_as_available() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let suffix = &Uuid::new_v4().to_string()[..8];

    let make_item = |label: &'static str, reorder: i32| {
        let db = app.db.clone();
        let suffix = suffix.to_owned();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO pharmacy_catalog \
                 (tenant_id, code, name, reorder_level, current_stock, is_active) \
                 VALUES ($1, $2, $3, $4, 500, true) RETURNING id",
            )
            .bind(tenant_id)
            .bind(format!("{label}-{suffix}"))
            .bind(format!("Parity {label}"))
            .bind(reorder)
            .fetch_one(&db)
            .await
            .expect("insert catalog item")
        }
    };

    let add_batch = |item_id: Uuid, qty: i32, expiry_offset: i32| {
        let db = app.db.clone();
        async move {
            sqlx::query(
                "INSERT INTO pharmacy_batches \
                 (tenant_id, catalog_item_id, batch_number, expiry_date, quantity_on_hand) \
                 VALUES ($1, $2, $3, CURRENT_DATE + $4, $5)",
            )
            .bind(tenant_id)
            .bind(item_id)
            .bind(Uuid::new_v4().to_string())
            .bind(expiry_offset)
            .bind(qty)
            .execute(&db)
            .await
            .expect("insert batch");
        }
    };

    // Everything on the shelf is out of date. current_stock says 500.
    let all_expired = make_item("EXPIRED", 50).await;
    add_batch(all_expired, 500, -10).await;

    // Genuinely well stocked, with a little expiring soon.
    let healthy = make_item("HEALTHY", 50).await;
    add_batch(healthy, 400, 365).await;
    add_batch(healthy, 60, 15).await;

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/pharmacy-stockout-expiry-days-on-hand/data",
        )
        .await
        .json()
        .await
        .expect("report json");

    assert_eq!(
        report["summary"]["status"].as_str(),
        Some("live"),
        "the report must be wired, not 'not_wired': {report}"
    );

    let rows = report["rows"].as_array().expect("rows array");
    let expired_row = rows
        .iter()
        .find(|row| row["item_code"].as_str() == Some(&format!("EXPIRED-{suffix}")))
        .unwrap_or_else(|| panic!("the all-expired item should appear: {report}"));

    assert_eq!(
        expired_row["usable_on_hand"].as_i64(),
        Some(0),
        "expired tablets cannot be dispensed, so usable stock is zero even \
         though current_stock reads 500: {expired_row}"
    );
    assert_eq!(
        expired_row["expired_on_hand"].as_i64(),
        Some(500),
        "the expired quantity is reported, not hidden — it explains the full \
         shelf and it is a write-off somebody signs for: {expired_row}"
    );
    assert_eq!(
        expired_row["stocked_out"].as_bool(),
        Some(true),
        "an item with nothing in date is stocked out however full the shelf \
         looks: {expired_row}"
    );
    assert_eq!(
        expired_row["below_reorder"].as_bool(),
        Some(true),
        "reorder is judged on usable stock, not on current_stock: {expired_row}"
    );

    let healthy_row = rows
        .iter()
        .find(|row| row["item_code"].as_str() == Some(&format!("HEALTHY-{suffix}")))
        .unwrap_or_else(|| panic!("the healthy item should appear: {report}"));

    assert_eq!(healthy_row["usable_on_hand"].as_i64(), Some(460));
    assert_eq!(
        healthy_row["expiring_within_30_days"].as_i64(),
        Some(60),
        "stock in date but about to expire is flagged before it is lost: \
         {healthy_row}"
    );
    assert_eq!(healthy_row["stocked_out"].as_bool(), Some(false));
    assert_eq!(healthy_row["below_reorder"].as_bool(), Some(false));
}
