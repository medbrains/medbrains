//! An insurance claim carries its money: the bill it claims against, what the
//! payer will not pay, and what is left for the patient — kept true as the
//! payer answers and as the patient pays. And the billing gates match the act:
//! taking an instalment is a payment; setting an exchange rate is its own grant.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Decimals serialise as strings or numbers depending on the feature set.
fn money(v: &Value) -> f64 {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(f64::NAN)
}

async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// An issued bill of 1000 on which the patient has paid 100 at the counter.
async fn issued_invoice(app: &common::TestApp, tenant: Uuid, tag: &str) -> (Uuid, Uuid) {
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Claim', 'Patient', 'male', '9000000002') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-IC-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, subtotal, \
                               total_amount, paid_amount) \
         VALUES ($1, $2, $3, 'issued', 1000.00, 1000.00, 100.00) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-IC-{tag}"))
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    (patient, invoice)
}

#[tokio::test]
async fn a_claim_records_the_bill_the_deductions_and_the_patient_share() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let (patient, invoice) = issued_invoice(&app, tenant, &tag).await;
    let policy: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_insurance (tenant_id, patient_id, insurance_provider, policy_number, \
                                        valid_from, valid_until) \
         VALUES ($1, $2, 'Star Health', $3, current_date, current_date + 365) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(format!("POL-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("policy");

    // Raised with a pre-authorisation of 600: the patient's share is the rest
    // of the bill less what they already paid.
    let (status, claim) = send(
        &csrf,
        app.client
            .post(app.url("/api/billing/insurance-claims"))
            .json(&json!({
                "invoice_id": invoice,
                "patient_id": patient,
                "insurance_provider": "Star Health",
                "policy_number": format!("POL-{tag}"),
                "claim_type": "cashless",
                "pre_auth_amount": 600,
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{claim}");
    assert_eq!(money(&claim["total_bill_amount"]), 1000.0);
    assert_eq!(money(&claim["patient_payable"]), 300.0);
    assert_eq!(money(&claim["deductions"]), 0.0);
    assert_eq!(claim["insurance_id"], json!(policy));
    let id = claim["id"].as_str().expect("id").to_owned();

    // The insurer approves 800: 200 disallowed; the patient owes 100 more.
    let (status, claim) = send(
        &csrf,
        app.client
            .put(app.url(&format!("/api/billing/insurance-claims/{id}")))
            .json(&json!({ "status": "claim_approved", "approved_amount": 800 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{claim}");
    assert_eq!(money(&claim["deductions"]), 200.0);
    assert_eq!(money(&claim["patient_payable"]), 100.0);

    // The patient pays that 100 at the counter: nothing is left to collect.
    sqlx::query("UPDATE invoices SET paid_amount = 200.00 WHERE id = $1")
        .bind(invoice)
        .execute(&app.db)
        .await
        .expect("pay");
    let (status, claim) = send(
        &csrf,
        app.client
            .get(app.url(&format!("/api/billing/insurance-claims/{id}"))),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{claim}");
    assert_eq!(money(&claim["patient_payable"]), 0.0);
}

/// A receptionist, optionally with some of their role's permissions denied.
async fn receptionist(
    app: &common::TestApp,
    admin_csrf: &str,
    denied: &[&str],
) -> (Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("icm_{tag}"), format!("Claim#{tag}Aa9"));
    let dept: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, body) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": "Front Desk",
            "role": "receptionist",
            "department_ids": [dept],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    sqlx::query(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', '[]'::jsonb, 'denied', $2::jsonb), \
                perm_version = perm_version + 1 \
          WHERE username = $1",
    )
    .bind(&username)
    .bind(json!(denied))
    .execute(&app.db)
    .await
    .expect("deny");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    (
        client,
        login["csrf_token"].as_str().unwrap_or("").to_owned(),
    )
}

#[tokio::test]
async fn exchange_rates_read_with_billing_and_set_only_with_their_grant() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (desk, csrf) = receptionist(&app, &admin_csrf, &[]).await;

    // The desk bills foreign patients, so it reads the rate...
    let (status, body) = send(&csrf, desk.get(app.url("/api/billing/exchange-rates"))).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // ...but setting one is tariff work the desk does not hold.
    let (status, body) = send(
        &csrf,
        desk.post(app.url("/api/billing/exchange-rates"))
            .json(&json!({
                "from_currency": "USD",
                "rate": 83.5,
                "effective_date": "2026-10-12",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
}

#[tokio::test]
async fn paying_an_instalment_needs_the_payment_grant_not_invoice_update() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let (_, invoice) = issued_invoice(&app, tenant, &tag).await;
    let plan: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_installments (tenant_id, invoice_id, total_amount, \
                                           installment_count, installment_amount) \
         VALUES ($1, $2, 900, 1, 900) RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .fetch_one(&app.db)
    .await
    .expect("plan");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_installment_items (tenant_id, installment_id, installment_number, \
                                                due_date, amount) \
         VALUES ($1, $2, 1, current_date, 900) RETURNING id",
    )
    .bind(tenant)
    .bind(plan)
    .fetch_one(&app.db)
    .await
    .expect("item");
    let path = format!("/api/billing/installments/{plan}/items/{item}/pay");

    // Still holds invoice update, but may not take money.
    let (desk, csrf) = receptionist(&app, &admin_csrf, &["billing.payments.create"]).await;
    let (status, body) = send(
        &csrf,
        desk.post(app.url(&path)).json(&json!({ "mode": "cash" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");

    // A card payment needs its reference.
    let (status, body) = send(
        &admin_csrf,
        app.client
            .post(app.url(&path))
            .json(&json!({ "mode": "card" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    // Taken: a payment row, the bill's paid amount, a receipt, the item paid.
    let (status, body) = send(
        &admin_csrf,
        app.client
            .post(app.url(&path))
            .json(&json!({ "mode": "upi", "reference_number": "UTR123456" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["item"]["status"], "paid");
    assert_eq!(body["item"]["payment_id"], body["payment"]["id"]);
    assert_eq!(money(&body["payment"]["amount"]), 900.0);
    assert_eq!(body["payment"]["mode"], "upi");
    assert_eq!(body["receipt"]["payment_id"], body["payment"]["id"]);
    // The same payment-received event a counter payment raises.
    let payment_id = body["payment"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    assert_eq!(
        app.outbox_rows("billing.payment.received", &payment_id)
            .await
            .len(),
        1,
        "instalment payment must raise billing.payment.received"
    );
    let (paid, inv_status): (f64, String) =
        sqlx::query_as("SELECT paid_amount::float8, status::text FROM invoices WHERE id = $1")
            .bind(invoice)
            .fetch_one(&app.db)
            .await
            .expect("invoice");
    assert_eq!(paid, 1000.0);
    assert_eq!(inv_status, "paid");

    // Paying it twice is refused, not double-counted.
    let (status, body) = send(
        &admin_csrf,
        app.client
            .post(app.url(&path))
            .json(&json!({ "mode": "upi", "reference_number": "UTR123456" })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
}
