//! A pharmacy supplies another: what the transfer screen counts as on hand is
//! what the dispatch takes — pharmacy batches, first expiry first — and the
//! receiving pharmacy gets the same batches. Expired stock never travels.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let url = app.url(path);
    let req = match method {
        "PUT" => app.client.put(url),
        _ => app.client.post(url),
    };
    let resp = req
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn store(app: &common::TestApp, csrf: &str, label: &str) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let (status, body) = send(
        app,
        csrf,
        "POST",
        "/api/procurement/store-locations",
        json!({ "code": format!("{label}{tag}").to_uppercase(), "name": format!("{label} pharmacy {tag}"), "location_type": "pharmacy" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("store id")
}

async fn on_hand(app: &common::TestApp, store: Uuid, item: Uuid) -> Vec<(String, i32)> {
    sqlx::query_as(
        "SELECT batch_number, quantity_on_hand FROM pharmacy_batches \
          WHERE store_location_id = $1 AND catalog_item_id = $2 AND deleted_at IS NULL \
          ORDER BY expiry_date",
    )
    .bind(store)
    .bind(item)
    .fetch_all(&app.db)
    .await
    .expect("batches")
}

/// Given the hub holding a batch expiring in 2030 (4) and one in 2031 (5),
/// and an expired one (9), When it transfers 6 to a ward pharmacy, Then the
/// 2030 batch goes first (4) and 2 come from 2031; the expired batch is
/// untouched; and the ward receives exactly those two batches.
#[tokio::test]
async fn a_transfer_moves_pharmacy_batches_first_expiry_first() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (hub, ward) = (
        store(&app, &csrf, "HUB").await,
        store(&app, &csrf, "WRD").await,
    );
    let item: Uuid = sqlx::query_scalar(
        "SELECT c.id FROM pharmacy_catalog c JOIN users u ON u.tenant_id = c.tenant_id \
          WHERE u.username = 'admin' AND c.is_active AND NOT c.is_controlled LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("a catalogue item");
    let tag = &Uuid::new_v4().simple().to_string()[..6];
    for (batch, expiry, qty) in [
        ("LATE", "2031-06-30", 5),
        ("EARLY", "2030-01-31", 4),
        ("OLD", "2020-01-31", 9),
    ] {
        sqlx::query(
            "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, store_location_id, \
               batch_number, expiry_date, quantity_received, quantity_on_hand, purchase_rate) \
             SELECT tenant_id, $1, $2, $3, $4::date, $5, $5, 2 FROM pharmacy_catalog WHERE id = $1",
        )
        .bind(item)
        .bind(hub)
        .bind(format!("{batch}-{tag}"))
        .bind(expiry)
        .bind(qty)
        .execute(&app.db)
        .await
        .expect("batch");
    }

    let (status, transfer) = send(
        &app,
        &csrf,
        "POST",
        "/api/pharmacy/transfers",
        json!({ "from_location_id": hub, "to_location_id": ward,
                "items": [{ "catalog_item_id": item, "quantity": 6 }] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{transfer}");
    let id = transfer["id"].as_str().expect("transfer id");
    for step in ["approve", "dispatch", "receive"] {
        let method = if step == "approve" { "PUT" } else { "POST" };
        let (status, body) = send(
            &app,
            &csrf,
            method,
            &format!("/api/pharmacy/transfers/{id}/{step}"),
            json!({}),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{step}: {body}");
    }

    assert_eq!(
        on_hand(&app, hub, item).await,
        vec![
            (format!("OLD-{tag}"), 9),
            (format!("EARLY-{tag}"), 0),
            (format!("LATE-{tag}"), 3)
        ],
        "the early batch empties first; the expired one never moves"
    );
    assert_eq!(
        on_hand(&app, ward, item).await,
        vec![(format!("EARLY-{tag}"), 4), (format!("LATE-{tag}"), 2)],
        "the ward holds the same batches the hub gave up"
    );
}
