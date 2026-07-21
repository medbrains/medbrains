mod common;

use reqwest::StatusCode;
use uuid::Uuid;

/// Register a throwaway patient and return the tenant id (for the catalog query).
async fn tenant_id(app: &common::TestApp, csrf: &str) -> Uuid {
    let p: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "first_name": "Pos",
            "last_name": "Guard",
            "gender": "male",
            "phone": "9990002001",
        }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("patient json");
    Uuid::parse_str(p["tenant_id"].as_str().expect("tenant_id")).expect("tenant uuid")
}

/// Pick one catalog item — controlled/scheduled or plain OTC — for this tenant.
async fn catalog_item(app: &common::TestApp, tenant: Uuid, controlled: bool) -> (Uuid, String) {
    let mut tx = app.db.begin().await.expect("tx");
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant)
        .await
        .expect("tenant ctx");
    let sql = if controlled {
        "SELECT id, name FROM pharmacy_catalog \
         WHERE coalesce(is_controlled, false) = true AND deleted_at IS NULL LIMIT 1"
    } else {
        "SELECT id, name FROM pharmacy_catalog \
         WHERE coalesce(is_controlled, false) = false \
           AND (drug_schedule IS NULL OR drug_schedule NOT IN ('H', 'H1', 'X', 'NDPS')) \
           AND deleted_at IS NULL LIMIT 1"
    };
    let row: (Uuid, String) = sqlx::query_as(sql)
        .fetch_one(&mut *tx)
        .await
        .expect("a matching catalog item");
    tx.commit().await.expect("commit");
    row
}

async fn pos_sale(
    app: &common::TestApp,
    csrf: &str,
    item_id: Uuid,
    drug_name: &str,
) -> reqwest::Response {
    app.client
        .post(app.url("/api/pharmacy/pos/sales"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "items": [{
                "catalog_item_id": item_id,
                "drug_name": drug_name,
                "quantity": 1,
                "gst_rate": 12,
                "mrp": 10,
                "selling_price": 10,
            }],
            "payment_mode": "cash",
        }))
        .send()
        .await
        .expect("pos sale request")
}

/// A POS / OTC walk-in sale carries no prescription, NDPS register entry, or
/// dual-lock, so a scheduled / controlled drug (#4473/#4474) must NOT be sold
/// there — while a plain OTC drug isn't blocked by that guard.
#[tokio::test]
async fn controlled_drug_cannot_be_sold_over_the_counter() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_id(&app, &csrf).await;

    // Controlled drug: the POS sale is refused.
    let (ctrl_id, ctrl_name) = catalog_item(&app, tenant, true).await;
    let blocked = pos_sale(&app, &csrf, ctrl_id, &ctrl_name).await;
    assert_eq!(
        blocked.status(),
        StatusCode::BAD_REQUEST,
        "a controlled/scheduled drug must not be sold over the counter"
    );
    let body: serde_json::Value = blocked.json().await.expect("conflict json");
    let msg = serde_json::to_string(&body).unwrap_or_default().to_lowercase();
    assert!(
        msg.contains("over the counter") || msg.contains("controlled"),
        "the block should name the controlled-drug reason: {body}"
    );

    // Specificity: a plain OTC drug must NOT trip the controlled-drug guard.
    // (It may still fail for an unrelated reason like stock, but never with the
    // controlled-drug block.)
    let (otc_id, otc_name) = catalog_item(&app, tenant, false).await;
    let otc = pos_sale(&app, &csrf, otc_id, &otc_name).await;
    let otc_status = otc.status();
    let otc_body: serde_json::Value = otc.json().await.unwrap_or_default();
    let otc_msg = serde_json::to_string(&otc_body).unwrap_or_default().to_lowercase();
    assert!(
        !otc_msg.contains("over the counter"),
        "an OTC drug must not hit the controlled-drug block (status {otc_status}): {otc_body}"
    );
}
