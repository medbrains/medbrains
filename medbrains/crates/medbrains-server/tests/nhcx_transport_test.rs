//! NHCX transport, end to end against a stand-in gateway.
//!
//! A claim submitted with the settings saved reaches the gateway as a JWE that
//! only the payer's key opens, with the HCX routing headers in its protected
//! header; the payer's answer, encrypted to our certificate and carrying a
//! valid gateway JWT, lands on the claim; a callback with a forged JWT is
//! refused and changes nothing.

use crate::common;
use crate::nhcx_support;

use std::time::Duration;

use axum::http::StatusCode;
use medbrains_core::nhcx::NhcxOperation;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use nhcx_support::{gateway_jwt, key_pair};

#[tokio::test]
async fn a_claim_goes_to_nhcx_encrypted_and_the_payers_answer_lands_on_it() {
    let nhcx = nhcx_support::onboard().await;
    let (app, csrf, tenant, tag) = (&nhcx.app, &nhcx.csrf, nhcx.tenant, &nhcx.tag);
    let (hospital, hospital_cert) = (&nhcx.hospital, &nhcx.hospital_cert);
    let (hospital_code, payer_code) = (&nhcx.hospital_code, &nhcx.payer_code);

    let view: Value = app
        .client
        .get(app.url("/api/integrations/nhcx/settings"))
        .send()
        .await
        .expect("get settings")
        .json()
        .await
        .expect("json");
    assert_eq!(view["has_private_key"], json!(true));
    assert!(
        view.get("private_key_pem").is_none(),
        "the private key is never returned"
    );
    assert!(
        !view.to_string().contains("mock-secret"),
        "nor the client secret"
    );

    let claim_id = seed_claim(app, tenant, tag).await;
    let submitted = app
        .client
        .post(app.url(&format!(
            "/api/billing/insurance-claims/{claim_id}/submit-to-nhcx"
        )))
        .header("x-csrf-token", csrf)
        .json(&json!({ "recipient_code": payer_code, "use": "claim" }))
        .send()
        .await
        .expect("submit");
    assert_eq!(
        submitted.status(),
        StatusCode::OK,
        "{}",
        submitted.text().await.unwrap_or_default()
    );
    let submitted: Value = submitted.json().await.expect("json");
    let correlation_id = submitted["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();

    // The correlation id was saved on the claim in the same transaction.
    let (saved_correlation, status): (Option<Uuid>, Option<String>) = sqlx::query_as(
        "SELECT nhcx_correlation_id, nhcx_status FROM insurance_claims WHERE id = $1",
    )
    .bind(claim_id)
    .fetch_one(&app.db)
    .await
    .expect("claim");
    assert_eq!(
        saved_correlation.map(|c| c.to_string()),
        Some(correlation_id.clone())
    );
    assert_eq!(status.as_deref(), Some("queued"));

    // Run the outbox event exactly as the worker would.
    let (path, body) = nhcx.send(NhcxOperation::Claim, &correlation_id).await;
    let http = nhcx
        .received
        .lock()
        .expect("lock")
        .last()
        .map(|r| r.1.clone())
        .expect("headers");
    let header = |name: &str| {
        http.get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned)
    };
    assert_eq!(path, "claim/submit");
    assert_eq!(
        header("authorization").as_deref(),
        Some("Bearer mock-session")
    );
    assert_eq!(
        header("bearer_auth").as_deref(),
        Some("Bearer mock-session"),
        "NHA's gateway reads bearer_auth"
    );
    assert_eq!(header("accept").as_deref(), Some("application/json"));
    let jwe = body["payload"]
        .as_str()
        .expect("the body is {payload: <JWE>}");
    assert!(
        medbrains_crypto::jwe::decrypt_hcx(jwe, hospital.private_pem.as_bytes()).is_err(),
        "only the payer can read it"
    );
    let (headers, bundle) = nhcx.open_as_payer(&body);
    assert_eq!(headers["x-hcx-sender_code"], json!(hospital_code));
    assert_eq!(headers["x-hcx-recipient_code"], json!(payer_code));
    assert_eq!(headers["x-hcx-correlation_id"], json!(correlation_id));
    // NHA envelope: a request seeds its thread from its own call id, says
    // request.initiated, carries its step code and an IST timestamp.
    assert_eq!(headers["x-hcx-api_call_id"], json!(correlation_id));
    assert_eq!(headers["x-hcx-status"], json!("request.initiated"));
    assert_eq!(headers["x-hcx-workflow_id"], json!("15"));
    assert_eq!(headers["x-hcx-use_case"], json!("New"));
    assert!(headers.contains_key("x-hcx-request_id"));
    let timestamp = headers["x-hcx-timestamp"].as_str().unwrap_or_default();
    assert!(timestamp.ends_with("+05:30"), "IST, got {timestamp}");
    assert_eq!(
        bundle["resourceType"],
        json!("Bundle"),
        "the plaintext is the bundle, no inner JWS"
    );
    assert_eq!(claim_status(app, claim_id).await.as_deref(), Some("sent"));

    // The payer answers through the gateway.
    let mut routing = Map::new();
    routing.insert("x-hcx-sender_code".into(), json!(payer_code));
    routing.insert("x-hcx-recipient_code".into(), json!(hospital_code));
    routing.insert("x-hcx-correlation_id".into(), json!(correlation_id));
    routing.insert("x-hcx-api_call_id".into(), json!(Uuid::new_v4()));
    routing.insert("x-hcx-status".into(), json!("response.complete"));
    let answer = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "ClaimResponse", "outcome": "complete",
        "total": [{ "category": { "coding": [{ "code": "benefit" }] }, "amount": { "value": 4500 } }]
    }}]});
    let reply = medbrains_crypto::jwe::encrypt_hcx(&answer, &routing, hospital_cert.as_bytes())
        .expect("encrypt reply");
    let callback = app.url("/api/integrations/nhcx/hcx/v1/claim/on_submit");
    let gateway_client = reqwest::Client::new();

    // A forged token, and a real token without NHCX's claims, are refused —
    // answered 202 with the reason, so NHCX does not retry, and logged.
    let unclaimed = medbrains_crypto::jws::sign_rs256(
        Map::new(),
        Duration::from_secs(300),
        nhcx.gateway.private_pem.as_bytes(),
    )
    .expect("jwt without iss/sub/jti");
    for token in [gateway_jwt(&key_pair()), unclaimed] {
        let refused = gateway_client
            .post(&callback)
            .bearer_auth(token)
            .json(&json!({ "payload": reply }))
            .send()
            .await
            .expect("forged callback");
        assert_eq!(refused.status(), StatusCode::ACCEPTED);
        let receipt: Value = refused.json().await.expect("receipt");
        assert_eq!(receipt["error"]["code"], json!("ERR_INVALID_SIGNATURE"));
    }
    assert_eq!(
        claim_status(app, claim_id).await.as_deref(),
        Some("sent"),
        "nothing changed"
    );
    let refusals: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM nhcx_callback_log WHERE tenant_id = $1 \
            AND correlation_id = $2::uuid \
            AND verification_status = 'refused_token' AND raw_envelope IS NULL",
    )
    .bind(nhcx.tenant)
    .bind(&correlation_id)
    .fetch_one(&app.db)
    .await
    .expect("log");
    assert_eq!(
        refusals, 2,
        "refusals are logged, their bodies are not kept"
    );

    let jwt = nhcx.gateway_jwt();
    let accepted = gateway_client
        .post(&callback)
        .bearer_auth(&jwt)
        .json(&json!({ "payload": reply }))
        .send()
        .await
        .expect("callback");
    assert_eq!(accepted.status(), StatusCode::ACCEPTED);
    let ack: Value = accepted.json().await.expect("ack");
    assert_eq!(ack["correlation_id"], json!(correlation_id));
    assert_eq!(ack["result"]["entity_type"], json!("claim"));
    assert_eq!(ack["result"]["protocol_status"], json!("request.queued"));
    assert_eq!(ack["error"]["code"], json!(""));
    // DD/MM/YYYY HH:mm:ss:SSS
    assert_eq!(ack["timestamp"].as_str().map(str::len), Some(23));

    // The same token again is a replay.
    let replay = gateway_client
        .post(&callback)
        .bearer_auth(&jwt)
        .json(&json!({ "payload": reply }))
        .send()
        .await
        .expect("replay");
    let receipt: Value = replay.json().await.expect("receipt");
    assert_eq!(
        receipt["error"]["message"],
        json!("the gateway token was used before")
    );

    let (status, outcome, approved): (
        Option<String>,
        Option<String>,
        Option<rust_decimal::Decimal>,
    ) = sqlx::query_as(
        "SELECT nhcx_status, nhcx_outcome, approved_amount FROM insurance_claims WHERE id = $1",
    )
    .bind(claim_id)
    .fetch_one(&app.db)
    .await
    .expect("claim");
    assert_eq!(status.as_deref(), Some("response.complete"));
    assert_eq!(outcome.as_deref(), Some("complete"));
    assert_eq!(approved, Some(rust_decimal::Decimal::from(4500)));
    let decision: Option<String> =
        sqlx::query_scalar("SELECT nhcx_decision FROM insurance_claims WHERE id = $1")
            .bind(claim_id)
            .fetch_one(&app.db)
            .await
            .expect("decision");
    assert_eq!(decision.as_deref(), Some("approved"));
}

async fn claim_status(app: &common::TestApp, claim_id: Uuid) -> Option<String> {
    sqlx::query_scalar("SELECT nhcx_status FROM insurance_claims WHERE id = $1")
        .bind(claim_id)
        .fetch_one(&app.db)
        .await
        .expect("claim status")
}

async fn seed_claim(app: &common::TestApp, tenant: Uuid, tag: &str) -> Uuid {
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Nhcx', 'Patient', 'female'::gender, '9000000103') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-NHCX-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, subtotal, total_amount) \
         VALUES ($1, $2, $3, 5000, 5000) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-NHCX-{tag}"))
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    sqlx::query(
        "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, unit_price, \
             total_price, source) \
         VALUES ($1, $2, 'X', 'Room rent', 5000, 5000, 'manual')",
    )
    .bind(tenant)
    .bind(invoice)
    .execute(&app.db)
    .await
    .expect("item");
    sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, status) \
         VALUES ($1, $2, $3, 'Mock Payer', 'claim_submitted') RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("claim")
}
