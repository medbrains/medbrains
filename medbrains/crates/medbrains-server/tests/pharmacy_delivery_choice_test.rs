//! A patient asking for a refill chooses home delivery. A patient who has
//! earned it pays at the door and the delivery opens when the pharmacist
//! approves; a pay-first patient gets a payment link and the delivery opens
//! only once the payment arrives. A controlled medicine is never offered.
//! Each patient follows only their own deliveries, and only they see the
//! code to hand the runner.

mod common;
mod delivery_choice_world;

use delivery_choice_world::{
    WEBHOOK_SECRET, approve, choice, delivery_of, drug, earn_cash_on_delivery, make_payment_link,
    new_patient, patient_token, portal, prescription, setup, staff,
};
use hmac::{Hmac, Mac};
use reqwest::StatusCode;
use serde_json::{Value, json};
use sha2::Sha256;
use uuid::Uuid;

#[tokio::test]
async fn a_trusted_patient_pays_at_the_door_and_follows_it_home() {
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let (patient, phone) = new_patient(&app, &setup).await;
    let plain = drug(&app, &setup, "Deliverol 500", false).await;
    earn_cash_on_delivery(&app, &setup, patient, plain).await;
    let rx = prescription(&app, &setup, patient, plain, "Deliverol 500", 2).await;
    let token = patient_token(&app, &setup, &phone).await;

    let (status, offer) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{rx}/delivery-options"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{offer}");
    assert_eq!(offer["available"], json!(true), "{offer}");
    assert!(
        offer["payments"]
            .as_array()
            .is_some_and(|p| p.contains(&json!("cash_on_delivery"))),
        "{offer}"
    );
    assert!(
        offer["addresses"][0]["address"]
            .as_str()
            .is_some_and(|a| a.contains("Lake Road")),
        "{offer}"
    );

    let (status, request) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{rx}/refill-request"),
        Some(choice("cash_on_delivery")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{request}");
    let request_id = request["id"].as_str().unwrap_or_default().to_owned();
    let (_, tracked) = portal(
        &app,
        &token,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(tracked["stage"], json!("requested"), "{tracked}");

    // The pharmacist approves: the delivery is there, to the patient's address.
    let order = approve(&app, &setup, &rx).await;
    let (delivery, address, payment, state) =
        delivery_of(&app, &request_id).await.expect("a delivery");
    assert_eq!(
        (address.as_str(), payment.as_str(), state.as_str()),
        ("12 Lake Road, Karaikudi", "cash_on_delivery", "arranged")
    );
    let (_, tracked) = portal(
        &app,
        &token,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(tracked["stage"], json!("being_prepared"), "{tracked}");
    assert!(
        tracked["amount_due"]
            .as_str()
            .is_some_and(|d| d.parse::<f64>().unwrap_or(0.0) > 0.0),
        "{tracked}"
    );

    // Given to a runner, dispensed, sent out.
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (status, runner) = staff(&app, &setup, "POST", "/api/setup/users", json!({
        "username": format!("dcr_{tag}"), "email": format!("dcr_{tag}@example.test"),
        "password": format!("Run#{tag}Aa9"), "full_name": "Ravi Runner", "role": "delivery_runner" })).await;
    assert_eq!(status, StatusCode::OK, "{runner}");
    let (status, body) = staff(
        &app,
        &setup,
        "POST",
        &format!("/api/pharmacy/deliveries/{delivery}/assign"),
        json!({ "mode": "runner", "runner_id": runner["id"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = staff(
        &app,
        &setup,
        "PUT",
        &format!("/api/pharmacy/orders/{order}/dispense"),
        json!({ "unpaid_override_reason": "cash on delivery" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = staff(
        &app,
        &setup,
        "POST",
        &format!("/api/pharmacy/deliveries/{delivery}/dispatch"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // On its way: the runner's first name and the code — nothing else of the runner's.
    let (_, tracked) = portal(
        &app,
        &token,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(tracked["stage"], json!("out_for_delivery"), "{tracked}");
    assert_eq!(tracked["carrier"], json!("Ravi"), "{tracked}");
    let code = tracked["handover_code"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    assert_eq!(code.len(), 6, "{tracked}");
    let texted: String = sqlx::query_scalar(
        "SELECT payload->>'body' FROM outbox_events WHERE event_type = 'sms.pharmacy_delivery_code' \
            AND aggregate_id = $1",
    )
    .bind(delivery)
    .fetch_one(&app.db)
    .await
    .expect("the code is texted too");
    assert!(texted.contains(&code));

    // Another patient: not in their list, and 404 by id.
    let (_, other_phone) = new_patient(&app, &setup).await;
    let other = patient_token(&app, &setup, &other_phone).await;
    let (status, _) = portal(
        &app,
        &other,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, theirs) = portal(&app, &other, "/api/portal/deliveries", None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(!theirs.to_string().contains(&code), "{theirs}");

    // Handed over: the code goes away.
    let (status, body) = staff(
        &app,
        &setup,
        "POST",
        &format!("/api/pharmacy/deliveries/{delivery}/complete"),
        json!({ "code": code, "cash_collected": tracked["amount_due"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (_, tracked) = portal(
        &app,
        &token,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(tracked["stage"], json!("delivered"), "{tracked}");
    assert_eq!(tracked["handover_code"], Value::Null);
}

#[tokio::test]
async fn a_pay_first_patient_gets_a_link_and_it_goes_once_paid() {
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let (patient, phone) = new_patient(&app, &setup).await;
    let plain = drug(&app, &setup, "Payfirstol 250", false).await;
    let rx = prescription(&app, &setup, patient, plain, "Payfirstol 250", 2).await;
    let token = patient_token(&app, &setup, &phone).await;

    let (_, offer) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{rx}/delivery-options"),
        None,
    )
    .await;
    assert_eq!(
        offer["payments"],
        json!(["prepaid"]),
        "a new patient pays first: {offer}"
    );
    let path = format!("/api/portal/prescriptions/{rx}/refill-request");
    let (status, _) = portal(&app, &token, &path, Some(choice("cash_on_delivery"))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, request) = portal(&app, &token, &path, Some(choice("prepaid"))).await;
    assert_eq!(status, StatusCode::OK, "{request}");
    let request_id = request["id"].as_str().unwrap_or_default().to_owned();

    // Approved: no delivery yet — a payment link is asked for.
    approve(&app, &setup, &rx).await;
    assert!(delivery_of(&app, &request_id).await.is_none());
    let txn: Uuid = sqlx::query_scalar(
        "SELECT payment_txn_id FROM prescription_refill_requests WHERE id = $1::uuid",
    )
    .bind(&request_id)
    .fetch_one(&app.db)
    .await
    .expect("a payment transaction");
    // The shared Razorpay client makes the link for the bill's balance.
    let asked = make_payment_link(&app, &setup, txn).await;
    assert_eq!(asked["reference_id"], json!(txn.to_string()), "{asked}");
    assert!(asked["amount"].as_i64().is_some_and(|p| p > 0), "{asked}");
    assert_eq!(asked["customer"]["contact"], json!("9000000002"), "{asked}");
    let link = format!("plink_{}", txn.simple());
    let url = format!("https://rzp.test/i/{}", txn.simple());
    let (_, tracked) = portal(
        &app,
        &token,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(tracked["stage"], json!("awaiting_payment"), "{tracked}");
    assert_eq!(tracked["payment_url"], json!(url), "{tracked}");

    // Razorpay says the link was paid.
    let body = json!({ "event": "payment_link.paid", "payload": {
        "payment_link": { "entity": { "id": link, "status": "paid" } },
        "payment": { "entity": { "id": format!("pay_{}", &link[6..]), "method": "upi" } } } })
    .to_string();
    let mut mac = Hmac::<Sha256>::new_from_slice(WEBHOOK_SECRET.as_bytes()).expect("hmac");
    mac.update(body.as_bytes());
    let resp = reqwest::Client::new()
        .post(app.url("/api/webhooks/razorpay"))
        .header(
            "X-Razorpay-Signature",
            hex::encode(mac.finalize().into_bytes()),
        )
        .header(
            "X-Razorpay-Event-Id",
            format!("evt_{}", Uuid::new_v4().simple()),
        )
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .expect("webhook");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );

    let (_, _, payment, state) = delivery_of(&app, &request_id)
        .await
        .expect("opened once paid");
    assert_eq!((payment.as_str(), state.as_str()), ("prepaid", "arranged"));
    let (_, tracked) = portal(
        &app,
        &token,
        &format!("/api/portal/deliveries/{request_id}"),
        None,
    )
    .await;
    assert_eq!(tracked["stage"], json!("being_prepared"), "{tracked}");
    assert_eq!(tracked["payment_url"], Value::Null);
    // The paid link was this delivery's alone: no UHI booking is confirmed by it.
    assert!(
        app.outbox_rows("uhi.payment_captured", &txn.to_string())
            .await
            .is_empty()
    );
}

#[tokio::test]
async fn a_controlled_medicine_is_never_offered() {
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let (patient, phone) = new_patient(&app, &setup).await;
    let narcotic = drug(&app, &setup, "Tramadol 50 mg", true).await;
    let rx = prescription(&app, &setup, patient, narcotic, "Tramadol 50 mg", 0).await;
    let token = patient_token(&app, &setup, &phone).await;

    let (status, offer) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{rx}/delivery-options"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{offer}");
    assert_eq!(offer["available"], json!(false));
    assert!(
        offer["reason"]
            .as_str()
            .is_some_and(|r| r.contains("Tramadol")),
        "{offer}"
    );
    let (status, body) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{rx}/refill-request"),
        Some(choice("prepaid")),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body.to_string().contains("controlled"), "{body}");
    let asked: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM prescription_refill_requests WHERE prescription_id = $1::uuid",
    )
    .bind(&rx)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(asked, 0, "nothing is requested when delivery is refused");
}
