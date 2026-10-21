//! Expired stock is listed apart from "expiring soon", and the bulk write-off
//! never destroys a controlled drug.
//!
//! The near-expiry report had no lower bound, so a batch past its date was
//! offered as merely "expiring soon" — stock that may not be dispensed at all.
//! And the bulk write-off zeroed controlled (NDPS) drugs too, whose
//! destruction the NDPS Act requires on the register with a second witness.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn get(app: &common::TestApp, path: &str) -> Vec<Value> {
    app.client
        .get(app.url(path))
        .send()
        .await
        .expect("get")
        .json()
        .await
        .expect("json")
}

/// Given a controlled and an ordinary drug, each with an expired batch, When
/// the pharmacist looks at stock, Then both are listed as expired and neither
/// as expiring soon; And the bulk write-off destroys the ordinary batch only,
/// saying one controlled batch is left for the NDPS register.
#[tokio::test]
async fn expired_stock_is_its_own_list_and_controlled_drugs_are_never_bulk_destroyed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id: Uuid =
        sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("a seeded tenant");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_owned();

    let mut batches = Vec::new();
    for (label, controlled) in [("Ordinary", false), ("Controlled", true)] {
        let item: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_catalog (tenant_id, code, name, current_stock, is_active, \
             is_controlled) VALUES ($1, $2, $3, 10, true, $4) RETURNING id",
        )
        .bind(tenant_id)
        .bind(format!("EXP-{label}-{suffix}"))
        .bind(format!("{label} {suffix}"))
        .bind(controlled)
        .fetch_one(&app.db)
        .await
        .expect("catalogue item");
        let batch: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_batches \
             (tenant_id, catalog_item_id, batch_number, expiry_date, quantity_on_hand) \
             VALUES ($1, $2, $3, CURRENT_DATE - 3, 10) RETURNING id",
        )
        .bind(tenant_id)
        .bind(item)
        .bind(format!("B-{label}-{suffix}"))
        .fetch_one(&app.db)
        .await
        .expect("expired batch");
        batches.push((label, batch));
    }
    let batch_numbers = [
        format!("B-Ordinary-{suffix}"),
        format!("B-Controlled-{suffix}"),
    ];

    let soon = get(&app, "/api/pharmacy/batches/near-expiry?days=90").await;
    assert!(
        soon.iter()
            .all(|r| !batch_numbers
                .contains(&r["batch_number"].as_str().unwrap_or_default().to_owned())),
        "an expired batch is not 'expiring soon'"
    );
    let expired = get(&app, "/api/pharmacy/batches/expired").await;
    let listed: Vec<&Value> = expired
        .iter()
        .filter(|r| {
            batch_numbers.contains(&r["batch_number"].as_str().unwrap_or_default().to_owned())
        })
        .collect();
    assert_eq!(listed.len(), 2, "both are listed as expired");
    assert!(
        listed.iter().any(|r| r["is_controlled"] == true),
        "the controlled one is marked"
    );

    let resp = app
        .client
        .post(app.url("/api/pharmacy/batches/write-off-expired"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "method": "incineration", "witness_name": "Test Witness" }))
        .send()
        .await
        .expect("write-off");
    assert_eq!(resp.status(), StatusCode::OK);
    let result: Value = resp.json().await.expect("write-off json");
    assert!(
        result["controlled_held"].as_i64().unwrap_or(0) >= 1,
        "{result}"
    );

    for (label, batch) in batches {
        let left: i32 =
            sqlx::query_scalar("SELECT quantity_on_hand FROM pharmacy_batches WHERE id = $1")
                .bind(batch)
                .fetch_one(&app.db)
                .await
                .expect("batch");
        match label {
            "Controlled" => assert_eq!(left, 10, "a controlled drug is never bulk destroyed"),
            _ => assert_eq!(left, 0, "the ordinary batch is written off"),
        }
    }
}
