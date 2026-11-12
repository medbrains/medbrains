//! Payer split (#294): non-payables go to the patient by themselves, the
//! insurer's share carries co-pay and deductible, the desk can move a line
//! only with a reason, the split is written onto the claim, and a settled
//! claim's split no longer moves.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn the_desk_splits_a_bill_between_insurer_and_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Split', 'Patient', 'female'::gender, '9000000294') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-PS-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let bill = |n: &str| {
        sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO invoices (tenant_id, invoice_number, patient_id, subtotal, total_amount) \
             VALUES ($1, $2, $3, $4, $4) RETURNING id",
        )
        .bind(tenant)
        .bind(format!("INV-PS-{tag}-{n}"))
        .bind(patient)
        .bind(rust_decimal::Decimal::from(if n == "A" { 6900 } else { 400 }))
        .fetch_one(&app.db)
    };
    let invoice = bill("A").await.expect("invoice");
    let self_pay = bill("B").await.expect("invoice");
    let mut items = Vec::new();
    for (inv, desc, amount) in [
        (invoice, "Room rent — semi-private", 6000),
        (invoice, "Admission kit", 500),
        (invoice, "CBC", 400),
        (self_pay, "CBC", 400),
    ] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, unit_price, total_price, source) \
             VALUES ($1, $2, 'X', $3, $4, $4, 'manual') RETURNING id",
        )
        .bind(tenant)
        .bind(inv)
        .bind(desc)
        .bind(rust_decimal::Decimal::from(amount))
        .fetch_one(&app.db)
        .await
        .expect("item");
        items.push(id);
    }
    let claim: Uuid = sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, tpa_name, \
             co_pay_percent, deductible_amount, status) \
         VALUES ($1, $2, $3, 'Star Health', 'Medi Assist', 10, 1000, 'claim_submitted') RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("claim");

    let get = |id: Uuid| {
        let url = app.url(&format!("/api/billing/invoices/{id}/payer-split"));
        let client = app.client.clone();
        async move {
            client
                .get(url)
                .send()
                .await
                .expect("get")
                .json::<Value>()
                .await
                .expect("json")
        }
    };
    let s = get(invoice).await;
    assert_eq!(s["third_party"]["name"], "Star Health · TPA Medi Assist");
    assert_eq!(s["lines"][1]["payer"], "patient", "{s}");
    assert!(
        s["lines"][1]["reason"]
            .as_str()
            .expect("reason")
            .contains("IRDAI")
    );
    assert_eq!(s["third_party_gross"], "6400.00");
    assert_eq!(s["copay"], "640.00");
    assert_eq!(s["deductible"], "1000.00");
    assert_eq!(s["third_party_net"], "4760.00");
    assert_eq!(s["patient_total"], "2140.00");

    let move_line = |item: Uuid, body: Value| {
        app.client
            .put(app.url(&format!(
                "/api/billing/invoices/{invoice}/items/{item}/payer"
            )))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    let res = move_line(items[1], json!({ "payer": "third_party" }))
        .await
        .expect("put");
    assert_eq!(res.status(), 400, "a move needs a reason");
    let moved: Value = move_line(
        items[1],
        json!({ "payer": "third_party", "reason": "Policy covers the kit" }),
    )
    .await
    .expect("put")
    .json()
    .await
    .expect("json");
    assert_eq!(moved["lines"][1]["payer"], "third_party");
    assert_eq!(moved["lines"][1]["automatic"], false);
    assert_eq!(moved["third_party_gross"], "6900.00");

    let applied: Value = app
        .client
        .post(app.url(&format!(
            "/api/billing/invoices/{invoice}/payer-split/apply"
        )))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("apply")
        .json()
        .await
        .expect("json");
    let (claimed, payable): (rust_decimal::Decimal, rust_decimal::Decimal) =
        sqlx::query_as("SELECT claim_amount, patient_payable FROM insurance_claims WHERE id = $1")
            .bind(claim)
            .fetch_one(&app.db)
            .await
            .expect("claim");
    assert_eq!(
        claimed.to_string(),
        applied["third_party_net"].as_str().expect("net")
    );
    assert_eq!(payable, rust_decimal::Decimal::from(690 + 1000));

    sqlx::query("UPDATE insurance_claims SET status = 'settled' WHERE id = $1")
        .bind(claim)
        .execute(&app.db)
        .await
        .expect("settle");
    let res = move_line(
        items[0],
        json!({ "payer": "patient", "reason": "Not covered" }),
    )
    .await
    .expect("put");
    assert_eq!(res.status(), 409, "a settled claim's split is fixed");

    let s = get(self_pay).await;
    assert!(s["third_party"].is_null());
    assert_eq!(s["patient_total"], "400.00");
}
