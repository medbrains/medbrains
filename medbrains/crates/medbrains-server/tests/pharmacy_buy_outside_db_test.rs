//! "Buy outside" at the shelf and in the database (owner, 2026-11-09).
//!
//! A bought-outside line is left out of the pick list and the unverified
//! count, and cannot be verified; an order with nothing in the catalogue
//! cannot be picked. A new catalogue item states its schedule. The database
//! keeps an unsold line unpriced and undispensed, and history stays editable
//! (migrations 1453, 1454). The review, billing and MAR rules are in
//! `pharmacy_buy_outside_test`.

use crate::dispense_world;
use crate::pharmacy_buy_outside_test::{line_id, send};

use medbrains_pharmacy::NOTHING_SOLD_HERE;
use medbrains_pharmacy::schedule_gate::PICK_FROM_CATALOGUE;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn the_database_keeps_unsold_lines_unsold_and_history_editable() {
    let d = dispense_world::desk().await;
    let drug = d.drug(None, false).await;
    let db = &d.app.db;

    // A POS sale line without a catalogue item, written straight to the table.
    let reference = format!("UPI-{}", dispense_world::tag());
    let (status, body) = send(
        &d,
        "POST",
        "/api/pharmacy/pos/sales",
        json!({ "items": [{ "catalog_item_id": drug, "drug_name": "Plain", "quantity": 1,
                            "gst_rate": 12, "mrp": 10, "selling_price": 10 }],
                "payment_mode": "upi", "payment_reference": reference }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let sale: Uuid =
        sqlx::query_scalar("SELECT id FROM pharmacy_pos_sales WHERE payment_reference = $1")
            .bind(&reference)
            .fetch_one(db)
            .await
            .expect("sale");
    let pos_line = sqlx::query(
        "INSERT INTO pharmacy_pos_sale_items (tenant_id, pos_sale_id, drug_name, quantity, mrp, \
                                              selling_price, line_total) \
         VALUES ($1, $2, 'Typed', 1, 10, 10, 10)",
    )
    .bind(d.tenant)
    .bind(sale)
    .execute(db)
    .await;
    let err = pos_line.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(err.contains(PICK_FROM_CATALOGUE), "{err}");

    // A typed order line: unpriced it may be written; priced, or handed out,
    // it may not.
    let order = d.order(None, drug, 1).await;
    let typed: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, unit_price, \
                                           total_price) VALUES ($1, $2, 'Typed', 1, 0, 0) \
         RETURNING id",
    )
    .bind(d.tenant)
    .bind(order)
    .fetch_one(db)
    .await
    .expect("an unpriced typed line may be ordered");
    let more = sqlx::query("UPDATE pharmacy_order_items SET quantity_dispensed = 1 WHERE id = $1")
        .bind(typed)
        .execute(db)
        .await;
    let err = more.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(
        err.contains(PICK_FROM_CATALOGUE),
        "dispensed quantity cannot rise: {err}"
    );
    let priced = sqlx::query(
        "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, unit_price, \
                                           total_price) VALUES ($1, $2, 'Typed', 1, 5, 5)",
    )
    .bind(d.tenant)
    .bind(order)
    .execute(db)
    .await;
    let err = priced.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(err.contains("carries no price"), "{err}");

    // A historic priced, dispensed typed line (written before the triggers)
    // can still be cancelled and soft-deleted.
    let mut tx = db.begin().await.expect("tx");
    sqlx::query("SET LOCAL session_replication_role = replica")
        .execute(&mut *tx)
        .await
        .expect("history is written as it was");
    let historic: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, unit_price, \
                                           total_price, quantity_dispensed) \
         VALUES ($1, $2, 'Old typed', 2, 7, 14, 2) RETURNING id",
    )
    .bind(d.tenant)
    .bind(order)
    .fetch_one(&mut *tx)
    .await
    .expect("historic");
    tx.commit().await.expect("commit");
    sqlx::query(
        "UPDATE pharmacy_order_items SET removed_at = now(), remove_reason = 'cancelled', \
                                         unit_price = 0, total_price = 0 WHERE id = $1",
    )
    .bind(historic)
    .execute(db)
    .await
    .expect("a historic line can be cancelled");
    sqlx::query("DELETE FROM pharmacy_order_items WHERE id = $1")
        .bind(historic)
        .execute(db)
        .await
        .expect("and soft-deleted");
}

#[tokio::test]
async fn pick_and_verify_leave_a_buy_outside_line_out() {
    let d = dispense_world::desk().await;
    let drug = d.drug(None, false).await;
    let store = d.pack_store(&[drug]).await;
    let order = d.order(None, drug, 2).await;
    let lonely = d.order(None, drug, 1).await;
    sqlx::query("UPDATE pharmacy_order_items SET removed_at = now() WHERE order_id = $1")
        .bind(lonely)
        .execute(&d.app.db)
        .await
        .expect("only an outside line left");
    for o in [order, lonely] {
        sqlx::query(
            "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, \
                                               unit_price, total_price, buy_outside) \
             VALUES ($1, $2, 'Zincovit', 1, 0, 0, true)",
        )
        .bind(d.tenant)
        .bind(o)
        .execute(&d.app.db)
        .await
        .expect("outside line");
    }
    sqlx::query("UPDATE pharmacy_orders SET store_location_id = $2 WHERE id = ANY($1)")
        .bind(vec![order, lonely])
        .bind(store)
        .execute(&d.app.db)
        .await
        .expect("to the pack store");

    let (status, body) = d.claim(lonely, json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains(NOTHING_SOLD_HERE), "{body}");

    let (status, body) = d.claim(order, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let picks: Value = d
        .pharmacist
        .client
        .get(
            d.app
                .url(&format!("/api/pharmacy/fulfilment/{order}/pick-list")),
        )
        .send()
        .await
        .expect("pick list")
        .json()
        .await
        .expect("pick json");
    let names: Vec<&str> = picks
        .as_array()
        .map(|p| p.iter().filter_map(|l| l["drug_name"].as_str()).collect())
        .unwrap_or_default();
    assert!(
        !names.contains(&"Zincovit"),
        "not on the pick list: {picks}"
    );
    assert_eq!(names.len(), 1, "{picks}");

    let outside = line_id(&d, order, "Zincovit").await;
    let (status, body) = d
        .fulfil(
            order,
            "verify",
            json!({ "order_item_id": outside, "note": "ticked by eye" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.to_string().contains("bought outside"), "{body}");

    // Checking the stocked line alone leaves nothing unverified.
    let stocked: Uuid = sqlx::query_scalar(
        "SELECT id FROM pharmacy_order_items WHERE order_id = $1 AND NOT buy_outside",
    )
    .bind(order)
    .fetch_one(&d.app.db)
    .await
    .expect("stocked line");
    let (status, body) = d
        .fulfil(
            order,
            "verify",
            json!({ "order_item_id": stocked, "note": "barcode worn, checked by eye" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["outstanding_lines"], 0, "{body}");
}

#[tokio::test]
async fn a_catalogue_item_needs_its_schedule() {
    let d = dispense_world::desk().await;
    let t = dispense_world::tag();
    let item = |schedule: Option<&str>| {
        json!({ "code": format!("SCH-{t}-{}", schedule.unwrap_or("none")),
                "name": format!("Scheduled {t}"), "base_price": 2,
                "drug_schedule": schedule })
    };
    let (status, body) = send(&d, "POST", "/api/pharmacy/catalog", item(None)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.to_string().contains("schedule"), "{body}");
    let (status, body) = send(&d, "POST", "/api/pharmacy/catalog", item(Some("Q"))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let (status, body) = send(&d, "POST", "/api/pharmacy/catalog", item(Some("OTC"))).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}
