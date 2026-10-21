//! Home delivery: controlled drugs never go out and cold-chain drugs never by
//! courier; cash on delivery is earned by paid deliveries; a prepaid parcel
//! leaves only when the bill is settled; the runner hands it over against the
//! code texted to the patient, and sees only their own deliveries.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    client: &Client,
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn drug(
    app: &common::TestApp,
    tenant: Uuid,
    name: &str,
    controlled: bool,
    cold: bool,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, is_controlled, needs_cold_chain, \
                                       current_stock, base_price) \
         VALUES ($1, $2, $3, $4, $5, 500, 10) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("DL-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(name)
    .bind(controlled)
    .bind(cold)
    .fetch_one(&app.db)
    .await
    .expect("drug")
}

async fn order(app: &common::TestApp, csrf: &str, patient: Uuid, drug: Uuid, name: &str) -> Uuid {
    let (status, body) = send(&app.client, app, csrf, "/api/pharmacy/orders", json!({
        "patient_id": patient, "dispensing_type": "prescription",
        "safety_override_reason": "delivery test",
        "items": [{ "catalog_item_id": drug, "drug_name": name, "quantity": 2, "unit_price": 10 }],
    })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["order"]["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("order id")
}

fn arrange(order: Uuid, mode: &str, payment: &str, runner: Option<&str>) -> Value {
    json!({ "order_id": order, "mode": mode, "payment": payment, "address": "12 Lake Road, Karaikudi",
            "contact_phone": "9000000001", "runner_id": runner,
            "courier_name": if mode == "courier" { Some("BlueDart") } else { None } })
}

#[tokio::test]
async fn deliveries_follow_the_rules_to_the_door() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, address) \
         VALUES ($1, $2, 'Home', 'Delivery', 'female', $3, \
                 '{\"line1\": \"12 Lake Road\", \"city\": \"Karaikudi\", \"postal_code\": \"630001\"}') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-DL-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let plain = drug(&app, tenant, "Deliverol 500", false, false).await;
    let narcotic = drug(&app, tenant, "Morphine 10 mg", true, false).await;
    let insulin = drug(&app, tenant, "Insulin glargine", false, true).await;

    // Controlled drugs are collected; cold chain goes with a runner only.
    let controlled_order = order(&app, &csrf, patient, narcotic, "Morphine 10 mg").await;
    let (status, body) = send(
        &app.client,
        &app,
        &csrf,
        "/api/pharmacy/deliveries",
        arrange(controlled_order, "runner", "prepaid", None),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    let cold_order = order(&app, &csrf, patient, insulin, "Insulin glargine").await;
    let (status, _) = send(
        &app.client,
        &app,
        &csrf,
        "/api/pharmacy/deliveries",
        arrange(cold_order, "courier", "prepaid", None),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // The options prefill the address and say why cash on delivery isn't offered yet.
    let plain_order = order(&app, &csrf, patient, plain, "Deliverol 500").await;
    let options: Value = app
        .client
        .get(app.url(&format!(
            "/api/pharmacy/orders/{plain_order}/delivery-options"
        )))
        .send()
        .await
        .expect("options")
        .json()
        .await
        .expect("json");
    assert!(
        options["address"]
            .as_str()
            .is_some_and(|a| a.contains("Lake Road")),
        "{options}"
    );
    assert_eq!(options["pincode"], json!("630001"));
    assert_eq!(options["cash_on_delivery"], json!(false), "{options}");
    let (status, _) = send(
        &app.client,
        &app,
        &csrf,
        "/api/pharmacy/deliveries",
        arrange(plain_order, "runner", "cash_on_delivery", None),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "a new patient pays first");

    // Two paid deliveries on record earn it.
    for _ in 0..2 {
        let past = order(&app, &csrf, patient, plain, "Deliverol 500").await;
        sqlx::query(
            "INSERT INTO pharmacy_deliveries (tenant_id, order_id, patient_id, mode, address, \
                 contact_phone, payment, status, arranged_by) \
             SELECT $1, $2, $3, 'runner', 'x', 'x', 'prepaid', 'delivered', id FROM users \
              WHERE username = 'admin'",
        )
        .bind(tenant)
        .bind(past)
        .bind(patient)
        .execute(&app.db)
        .await
        .expect("history");
    }

    // A runner, who sees only their own.
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("run_{tag}"), format!("Run#{tag}Aa9"));
    let (status, runner) = send(
        &app.client,
        &app,
        &csrf,
        "/api/setup/users",
        json!({
        "username": username, "email": format!("{username}@example.test"), "password": password,
        "full_name": "Ravi Runner", "role": "delivery_runner" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{runner}");
    let runner_id = runner["id"].as_str().unwrap_or_default().to_owned();

    let (status, delivery) = send(
        &app.client,
        &app,
        &csrf,
        "/api/pharmacy/deliveries",
        arrange(plain_order, "runner", "cash_on_delivery", Some(&runner_id)),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{delivery}");
    let id = delivery["id"].as_str().unwrap_or_default().to_owned();
    assert!(
        delivery["amount_due"]
            .as_str()
            .is_some_and(|d| d.parse::<f64>().unwrap_or(0.0) > 0.0),
        "{delivery}"
    );
    assert!(
        delivery.get("otp_hash").is_none(),
        "the code's hash never leaves the server"
    );

    // Not before it's dispensed.
    let (status, _) = send(
        &app.client,
        &app,
        &csrf,
        &format!("/api/pharmacy/deliveries/{id}/dispatch"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    let dispensed = app
        .client
        .put(app.url(&format!("/api/pharmacy/orders/{plain_order}/dispense")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "unpaid_override_reason": "cash on delivery" }))
        .send()
        .await
        .expect("dispense");
    assert_eq!(
        dispensed.status(),
        StatusCode::OK,
        "{}",
        dispensed.text().await.unwrap_or_default()
    );
    let (status, out) = send(
        &app.client,
        &app,
        &csrf,
        &format!("/api/pharmacy/deliveries/{id}/dispatch"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{out}");
    let text: String = sqlx::query_scalar(
        "SELECT payload->>'body' FROM outbox_events WHERE event_type = 'sms.pharmacy_delivery_code' \
            AND aggregate_id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("the patient is texted a code");
    let code = text
        .split_whitespace()
        .find_map(|w| {
            let digits: String = w.chars().filter(char::is_ascii_digit).collect();
            (digits.len() == 6).then_some(digits)
        })
        .expect("a six-digit code");

    // The runner, at the door.
    let runner_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = runner_client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let runner_csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    let mine: Value = runner_client
        .get(app.url("/api/pharmacy/deliveries"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let ids: Vec<&str> = mine["deliveries"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|d| d["id"].as_str())
        .collect();
    assert_eq!(
        ids,
        vec![id.as_str()],
        "a runner sees only their own: {mine}"
    );

    let path = format!("/api/pharmacy/deliveries/{id}/complete");
    let (status, _) = send(
        &runner_client,
        &app,
        &runner_csrf,
        &path,
        json!({ "code": "000000", "cash_collected": 30 }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a wrong code");
    let (status, _) = send(
        &runner_client,
        &app,
        &runner_csrf,
        &path,
        json!({ "code": code }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "cash on delivery records the cash"
    );
    let (status, done) = send(
        &runner_client,
        &app,
        &runner_csrf,
        &path,
        json!({ "code": code, "cash_collected": 30 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["status"], json!("delivered"));

    // The cold-chain order goes with the runner, prepaid — and waits for payment.
    let (status, cold) = send(
        &app.client,
        &app,
        &csrf,
        "/api/pharmacy/deliveries",
        arrange(cold_order, "runner", "prepaid", Some(&runner_id)),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{cold}");
    let cold_id = cold["id"].as_str().unwrap_or_default();
    app.client
        .put(app.url(&format!("/api/pharmacy/orders/{cold_order}/dispense")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "unpaid_override_reason": "test" }))
        .send()
        .await
        .expect("dispense");
    let (status, body) = send(
        &app.client,
        &app,
        &csrf,
        &format!("/api/pharmacy/deliveries/{cold_id}/dispatch"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("still owed"), "{body}");
    // Called off instead.
    let (status, _) = send(
        &app.client,
        &app,
        &csrf,
        &format!("/api/pharmacy/deliveries/{cold_id}/cancel"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
}
