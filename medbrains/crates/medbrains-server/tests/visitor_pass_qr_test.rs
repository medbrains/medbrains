//! A visitor pass carries a QR of its pass number, and the gate scans it to
//! learn whether the pass lets its holder in now: a fresh pass does, a
//! revoked one says so, and a number no pass has is "not found".

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_pass_prints_a_qr_and_the_gate_scan_follows_its_state() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tag = Uuid::new_v4().simple().to_string()[..6].to_owned();

    let post = |path: &str, body: Value| {
        app.client
            .post(app.url(path))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    let visitor: Value = post(
        "/api/front-office/visitors",
        json!({ "visitor_name": format!("Visitor {tag}"), "phone": "9000000002", "relationship": "Son", "category": "general" }),
    )
    .await
    .expect("visitor")
    .json()
    .await
    .expect("json");
    let pass: Value = post(
        "/api/front-office/passes",
        json!({ "registration_id": visitor["id"], "bed_number": "B-12", "valid_hours": 4 }),
    )
    .await
    .expect("pass")
    .json()
    .await
    .expect("json");
    let pass_id = pass["id"].as_str().expect("pass id").to_owned();
    let number = pass["pass_number"]
        .as_str()
        .expect("pass number")
        .to_owned();

    let printed: Value = app
        .get(
            &app.client,
            &format!("/api/print-data/visitor-pass/{pass_id}"),
        )
        .await
        .json()
        .await
        .expect("print json");
    assert_eq!(
        printed["qr_code_data"],
        number.as_str(),
        "the QR carries the pass number"
    );
    assert!(
        printed["qr_svg"]
            .as_str()
            .is_some_and(|s| s.contains("<svg")),
        "{printed}"
    );
    assert_eq!(printed["visitor_name"], format!("Visitor {tag}"));

    let scan = |code: String| {
        let client = app.client.clone();
        let url = app.url(&format!("/api/front-office/passes/scan?code={code}"));
        async move { client.get(url).send().await.expect("scan") }
    };
    let fresh: Value = scan(number.to_lowercase())
        .await
        .json()
        .await
        .expect("json");
    assert_eq!(
        fresh["valid"], true,
        "a fresh pass lets its holder in: {fresh}"
    );
    assert_eq!(fresh["bed_number"], "B-12");

    let revoked = app
        .client
        .put(app.url(&format!("/api/front-office/passes/{pass_id}/revoke")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "Visiting hours over" }))
        .send()
        .await
        .expect("revoke");
    assert!(revoked.status().is_success());
    let after: Value = scan(number.clone()).await.json().await.expect("json");
    assert_eq!(after["valid"], false);
    assert_eq!(after["reason"], "revoked", "the gate is told why: {after}");

    assert_eq!(
        scan(format!("VP-NONE-{tag}")).await.status(),
        StatusCode::NOT_FOUND
    );
}
