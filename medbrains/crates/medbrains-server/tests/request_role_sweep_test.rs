//! The remaining bare-pool reads, proven on `medbrains_app`, the role
//! production requests move to (row level security applies to it). Each of
//! these found nothing there before migration 1207 and the sweep that moved
//! tenant-known reads onto the tenant's connection.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const FUNCTIONS: &[&str] = &[
    "app_ccavenue_pending_tenants",
    "app_invitation_tenant",
    "app_email_verification_tenant",
    "app_refresh_token_tenant",
    "app_admin_email_registered",
];

/// Every pre-auth function from 1207 is the app's to call, and nobody else's.
#[tokio::test]
async fn the_1207_functions_are_granted_to_the_app_only() {
    let app = common::spawn_app().await;
    let open_to_public: Vec<String> = sqlx::query_scalar(
        "SELECT p.proname::text FROM pg_proc p, aclexplode(p.proacl) a \
          WHERE p.proname = ANY($1) AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'",
    )
    .bind(FUNCTIONS)
    .fetch_all(&app.db)
    .await
    .expect("acl");
    assert!(open_to_public.is_empty(), "{open_to_public:?}");
    for name in FUNCTIONS {
        let granted: Option<bool> = sqlx::query_scalar(
            "SELECT bool_and(has_function_privilege('medbrains_app', p.oid, 'EXECUTE')) \
               FROM pg_proc p WHERE p.proname = $1",
        )
        .bind(name)
        .fetch_one(&app.db)
        .await
        .expect("privilege");
        assert_eq!(granted, Some(true), "{name}");
    }
}

async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant")
}

async fn pending_ccavenue_txn(app: &common::TestApp, tenant_id: Uuid) -> (Uuid, String) {
    let order = format!("ccav_{}", Uuid::new_v4().simple());
    let id = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions (tenant_id, gateway, gateway_order_id, amount, status) \
         VALUES ($1, 'ccavenue', $2, 250.00, 'pending_gateway') RETURNING id",
    )
    .bind(tenant_id)
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("pending txn");
    (id, order)
}

async fn txn_status(app: &common::TestApp, id: Uuid) -> String {
    sqlx::query_scalar("SELECT status FROM payment_gateway_transactions WHERE id = $1")
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("txn status")
}

/// Given a hospital waiting on two CCAvenue payments, When CCAvenue's
/// encrypted notice for the older one arrives as the request role, Then that
/// payment is captured and the other is left pending.
#[tokio::test]
async fn a_ccavenue_notice_settles_the_order_it_names() {
    let app = common::spawn_app_as_request_role().await;
    let tenant_id = admin_tenant(&app).await;
    let working_key = "0123456789abcdef0123456789abcdef";
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'payments', 'ccavenue_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
    )
    .bind(tenant_id)
    .bind(json!({ "working_key": working_key }))
    .execute(&app.db)
    .await
    .expect("working key");
    let (named, order) = pending_ccavenue_txn(&app, tenant_id).await;
    let (other, _) = pending_ccavenue_txn(&app, tenant_id).await;

    // CCAvenue's encResp: AES-256-CBC under the working key, IV its first 16
    // bytes, base64. The handler decrypts without padding, so pad with '&'.
    let mut plain = format!("order_id={order}&order_status=Success&tracking_id=T{order}");
    while plain.len() % 16 != 0 {
        plain.push('&');
    }
    let enc_resp: String = sqlx::query_scalar(
        "SELECT replace(encode(encrypt_iv(convert_to($1, 'UTF8'), convert_to($2, 'UTF8'), \
                substring(convert_to($2, 'UTF8') from 1 for 16), 'aes-cbc/pad:none'), 'base64'), \
                E'\\n', '')",
    )
    .bind(&plain)
    .bind(working_key)
    .fetch_one(&app.db)
    .await
    .expect("encrypt");

    let resp = app
        .client
        .post(app.url("/api/webhooks/ccavenue"))
        .json(&json!({ "encResp": enc_resp }))
        .send()
        .await
        .expect("webhook");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"], "ok", "{body}");
    assert_eq!(txn_status(&app, named).await, "captured");
    assert_eq!(
        txn_status(&app, other).await,
        "pending_gateway",
        "the notice named one order; the hospital's other pending payment is untouched"
    );
}

/// Given an issued bill, When billing splits it into instalments as the
/// request role, Then the plan is created, listed, read and an instalment
/// waived — each read was empty on the bare pool.
#[tokio::test]
async fn instalments_work_on_the_request_role() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let tenant_id = admin_tenant(&app).await;
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Meena', 'Instalment', 'female', '9990004004') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UHI{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, subtotal, total_amount) \
         VALUES ($1, $2, $3, 'issued', 900.00, 900.00) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("INV-RR-{tag}"))
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("invoice");

    let plan: Value = app
        .client
        .post(app.url("/api/billing/installments"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "invoice_id": invoice, "installment_count": 3 }))
        .send()
        .await
        .expect("create plan")
        .json()
        .await
        .expect("plan json");
    let plan_id = plan["id"].as_str().unwrap_or_else(|| panic!("plan created: {plan}"));

    let listed: Value = app
        .get(&app.client, &format!("/api/billing/installments?invoice_id={invoice}"))
        .await
        .json()
        .await
        .expect("list json");
    assert_eq!(listed.as_array().map(Vec::len), Some(1), "{listed}");
    assert_eq!(listed[0]["pending_count"], 3, "{listed}");

    let one: Value = app
        .get(&app.client, &format!("/api/billing/installments/{plan_id}"))
        .await
        .json()
        .await
        .expect("get json");
    let item = one["items"][0]["id"].as_str().unwrap_or_else(|| panic!("items: {one}"));

    let waived = app
        .client
        .post(app.url(&format!("/api/billing/installments/{plan_id}/items/{item}/waive")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("waive");
    assert_eq!(waived.status(), StatusCode::OK);
    let waived: Value = waived.json().await.expect("waive json");
    assert_eq!(waived["status"], "waived", "{waived}");
}

/// Given a signed-in user, When the access token is refreshed as the request
/// role, Then a new session is issued — not a 401 that signs everybody out.
#[tokio::test]
async fn a_refresh_token_is_honoured_on_the_request_role() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let resp = app
        .client
        .post(app.url("/api/auth/refresh"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("refresh");
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
}

/// Given a live invitation, When the invitee opens the link as the request
/// role, Then they see who it is for, not "invalid or expired".
#[tokio::test]
async fn an_invitation_link_opens_on_the_request_role() {
    let app = common::spawn_app_as_request_role().await;
    let tenant_id = admin_tenant(&app).await;
    let raw = Uuid::new_v4().simple().to_string();
    let email = format!("invitee-{}@example.test", &raw[..8]);
    sqlx::query(
        "INSERT INTO user_invitations (tenant_id, email, role, token_hash, expires_at) \
         VALUES ($1, $2, 'nurse', encode(sha256(convert_to($3, 'UTF8')), 'hex'), now() + interval '1 day')",
    )
    .bind(tenant_id)
    .bind(&email)
    .bind(&raw)
    .execute(&app.db)
    .await
    .expect("invitation");

    let resp = app
        .get(&app.client, &format!("/api/public/invitations/{raw}"))
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["email"], email.as_str());
}
