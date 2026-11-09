//! Stock used on a patient but never charged (revenue integrity wave 1.2):
//! the charge at the point of use, against a real, migrated database.
//! Billable ward stock is charged once; overhead, package and switched-off
//! items are not; a charge that cannot post is queued and the use still saves.
//! The queue side (implants with no patient, the detector, permissions,
//! outages) is `stock_leakage_queue.rs`.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test stock_leakage -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use common::stock::{
    age_stock, consume, lines, queue, refuse_failing_codes, scan, ward, ward_item,
};
use common::{pool, scoped};
use medbrains_ward_stock::consume::ConsumeCharge;
use rust_decimal::Decimal;
use uuid::Uuid;

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_billable_item_used_on_a_patient_is_charged_once() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKIVSET", 120, true).await;

    let used = consume(&db, &claims, &w, w.item, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(used.charge, ConsumeCharge::Posted);
    assert_eq!(used.remaining, 48);
    assert_eq!(
        lines(&db, used.consumption_id).await,
        vec![(2, Decimal::from(120))]
    );
    let admission: Option<Uuid> = sqlx::query_scalar(
        "SELECT i.admission_id FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id \
          WHERE ii.source_id = $1",
    )
    .bind(used.consumption_id)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        admission,
        Some(w.admission),
        "the line is on the admission's bill"
    );

    // The detector does not raise it a second time.
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 0);
    assert!(queue(&db, w.v.tenant).await.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_overhead_or_package_item_is_not_charged() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKGLOVE", 15, false).await;
    let gloves = consume(&db, &claims, &w, w.item, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(gloves.charge, ConsumeCharge::NotBillable);
    assert!(lines(&db, gloves.consumption_id).await.is_empty());

    // A billable dressing kit the admission's day-care package includes.
    let kit = ward_item(&db, &w.v, "LKKIT", 400, true).await;
    let mut tx = scoped(&db, w.v.tenant).await;
    sqlx::query(
        "WITH bp AS (INSERT INTO billing_packages (tenant_id, code, name, total_price) \
                     VALUES ($1, 'LKDAYCARE', 'Day care', 5000) RETURNING id), \
              bpi AS (INSERT INTO billing_package_items (tenant_id, package_id, charge_code, \
                        description, unit_price) SELECT $1, id, 'LKKIT', 'Kit', 0 FROM bp), \
              inv AS (INSERT INTO invoices (tenant_id, invoice_number, patient_id, \
                        encounter_id) VALUES ($1, 'LK-INV-' || gen_random_uuid(), $2, $3) \
                      RETURNING id) \
         INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, \
           unit_price, total_price) SELECT $1, id, 'LKDAYCARE', 'Day care', 5000, 5000 FROM inv",
    )
    .bind(w.v.tenant)
    .bind(w.v.patient)
    .bind(w.v.encounter)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let packaged = consume(&db, &claims, &w, kit, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(packaged.charge, ConsumeCharge::NotBillable);
    assert!(lines(&db, packaged.consumption_id).await.is_empty());

    // Ward use names no patient and charges nothing.
    let ward_use = consume(&db, &claims, &w, kit, None).await.unwrap();
    assert_eq!(ward_use.charge, ConsumeCharge::WardUse);

    // Neither is a leak.
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn ward_stock_billing_switched_off_charges_and_queues_nothing() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKCANNULA", 90, true).await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'billing', 'auto_charge_ward_stock', 'false'::jsonb)",
    )
    .bind(w.v.tenant)
    .execute(&db)
    .await
    .unwrap();
    let used = consume(&db, &claims, &w, w.item, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(used.charge, ConsumeCharge::Disabled);
    assert!(lines(&db, used.consumption_id).await.is_empty());
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 0);
    assert!(queue(&db, w.v.tenant).await.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_charge_that_cannot_post_is_queued_and_the_use_still_saves() {
    let db = pool().await;
    refuse_failing_codes(&db).await;
    let (claims, w) = ward(&db, "LKFAILSET", 120, true).await;

    let used = consume(&db, &claims, &w, w.item, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(used.charge, ConsumeCharge::Queued);
    let saved: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM ward_stock_consumptions WHERE id = $1")
            .bind(used.consumption_id)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(saved, 1, "the use was rolled back with the charge");
    let on_hand: i32 = sqlx::query_scalar(
        "SELECT quantity FROM ward_stock WHERE tenant_id = $1 AND catalog_item_id = $2",
    )
    .bind(w.v.tenant)
    .bind(w.item)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(on_hand, 48);
    assert_eq!(
        queue(&db, w.v.tenant).await,
        vec![(
            used.consumption_id,
            "charge_failed:database".to_owned(),
            "ward_stock".to_owned(),
            Some(w.v.patient)
        )]
    );
    // Already on the queue: the detector adds nothing.
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_deferred_ward_stock_use_posts_at_the_catalogue_price_and_gst() {
    use axum::Extension;
    use axum::extract::{Path, State};
    let db = pool().await;
    let (claims, w) = ward(&db, "LKGSTSET", 120, true).await;
    let mut tx = scoped(&db, w.v.tenant).await;
    // The drug carries 12% GST; a charge-master entry of the same code is
    // priced and taxed differently, and must not win.
    sqlx::query("UPDATE pharmacy_catalog SET tax_percent = 12 WHERE id = $1")
        .bind(w.item)
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO charge_master (tenant_id, code, name, category, base_price, tax_percent) \
         VALUES ($1, 'LKGSTSET', 'IV set', 'consumable', 999, 5)",
    )
    .bind(w.v.tenant)
    .execute(&mut *tx)
    .await
    .unwrap();
    // A use whose live charge was deferred: the use saved, no bill line.
    let used: Uuid = sqlx::query_scalar(
        "INSERT INTO ward_stock_consumptions (tenant_id, department_id, catalog_item_id, \
           quantity, patient_id, encounter_id, admission_id, is_billable, consumed_by) \
         VALUES ($1, $2, $3, 2, $4, $5, $6, true, $7) RETURNING id",
    )
    .bind(w.v.tenant)
    .bind(w.v.department)
    .bind(w.item)
    .bind(w.v.patient)
    .bind(w.v.encounter)
    .bind(w.admission)
    .bind(w.v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 1);
    let (row, price, tax): (Uuid, Option<Decimal>, Option<Decimal>) = sqlx::query_as(
        "SELECT id, unit_price_override, tax_percent_override FROM charge_attention_items \
          WHERE source_entity_id = $1",
    )
    .bind(used)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(price, Some(Decimal::from(120)), "the catalogue price wins");
    assert_eq!(tax, Some(Decimal::from(12)), "the catalogue GST wins");

    let posted = medbrains_billing::charge_attention::post_charge_attention(
        State(common::state(db.clone())),
        Extension(claims.clone()),
        Path(row),
    )
    .await
    .expect("posts");
    assert_eq!(posted.0.status, "posted");
    let billed: (Decimal, Decimal) = sqlx::query_as(
        "SELECT unit_price, tax_percent FROM invoice_items \
          WHERE source = 'consumable' AND source_id = $1",
    )
    .bind(used)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(billed, (Decimal::from(120), Decimal::from(12)));
}
