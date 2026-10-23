//! NHCX conformance against NHA's own package (docs.abdm.gov.in,
//! `nha-in/nhcx-package`): the payer's sample answers land as NHA means
//! them (a query is never an approval, a rejection is recorded), a payment
//! posts money only on its settled notice, the envelope carries NHA's
//! fields, retries go under fresh ids, and every delivery — refused ones
//! too — is answered 202 with NHCX's receipt.

use crate::nhcx_support;

use axum::http::StatusCode;
use medbrains_core::nhcx::NhcxOperation;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use nhcx_support::claim_seed::seed_claim;
use nhcx_support::seed::{get_json, post, seed_insured_patient, seed_preauth};
use nhcx_support::{Delivery, Nhcx};

/// One hospital's NHCX settings are shared; run one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn nha(json: &str) -> Value {
    serde_json::from_str(json).expect("NHA sample")
}

macro_rules! sample {
    ($file:literal) => {
        nha(include_str!(concat!(
            "../../medbrains-nhcx-callback/nha_samples/",
            $file
        )))
    };
}

/// A pre-auth submitted and sent; returns (pre-auth, correlation id).
async fn sent_preauth(n: &Nhcx) -> (Uuid, String) {
    let (patient, policy, _) = seed_insured_patient(n).await;
    let (pa, _) = seed_preauth(n, patient, policy).await;
    let resp = post(
        n,
        &format!("/api/insurance/prior-auths/{pa}/submit-to-nhcx"),
        &json!({ "recipient_code": n.payer_code, "request_stage": "initial" }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let correlation = resp.json::<Value>().await.expect("json")["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();
    (pa, correlation)
}

async fn answer(n: &Nhcx, path: &str, correlation: &str, workflow: &str, sample: &Value) {
    let d = Delivery {
        workflow: Some(workflow),
        ..Delivery::new(path, correlation, sample)
    };
    let (status, receipt) = n.deliver(&d).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(receipt["error"]["code"], json!(""), "{receipt}");
}

#[tokio::test]
async fn nhas_preauth_answers_land_as_nha_means_them() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let cases = [
        (
            "24",
            sample!("C5-queried-wf24.json"),
            "pending_info",
            "queried",
            None,
        ),
        (
            "23",
            sample!("C5-rejected-wf23.json"),
            "denied",
            "rejected",
            None,
        ),
        (
            "21",
            sample!("C5-approved-wf21.json"),
            "approved",
            "approved",
            Some("150000.00"),
        ),
    ];
    for (workflow, payload, status, decision, approved) in cases {
        let (pa, correlation) = sent_preauth(&n).await;
        n.send(NhcxOperation::Preauth, &correlation).await;
        answer(&n, "preauth/on_submit", &correlation, workflow, &payload).await;
        let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
        assert_eq!(view["status"], json!(status), "under {workflow}");
        assert_eq!(view["nhcx_decision"], json!(decision), "under {workflow}");
        assert_eq!(view["approved_amount"], json!(approved), "under {workflow}");
        if workflow == "23" {
            assert_eq!(
                view["sla"]["state"],
                json!("met"),
                "a rejection stops the clock"
            );
        }
        if workflow == "21" {
            // A late acknowledgement does not reopen the decision.
            let late = sample!("C5-received-wf20.json");
            answer(&n, "preauth/on_submit", &correlation, "20", &late).await;
            let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
            assert_eq!(view["status"], json!("approved"));
            assert_eq!(view["nhcx_decision"], json!("approved"));
        }
    }
}

/// A final claim sent to the payer; returns (claim, correlation id).
async fn sent_claim(n: &Nhcx) -> (Uuid, String) {
    let (patient, policy, _) = seed_insured_patient(n).await;
    nhcx_support::seed::hospital_hfr_id(n).await;
    let seeded = seed_claim(n, patient, policy).await;
    nhcx_support::claim_seed::finalise_discharge_summary(n, seeded.admission).await;
    let correlation = nhcx_support::claim_seed::submit_final_claim(n, seeded.claim).await;
    n.send(NhcxOperation::Claim, &correlation).await;
    (seeded.claim, correlation)
}

async fn claim_row(n: &Nhcx, claim: Uuid) -> (String, Option<String>, Option<Decimal>) {
    sqlx::query_as(
        "SELECT status, nhcx_decision, approved_amount FROM insurance_claims WHERE id = $1",
    )
    .bind(claim)
    .fetch_one(&n.app.db)
    .await
    .expect("claim")
}

#[tokio::test]
async fn nhas_claim_query_is_not_an_approval_and_its_rejection_is_recorded() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (claim, correlation) = sent_claim(&n).await;
    answer(
        &n,
        "claim/on_submit",
        &correlation,
        "27",
        &sample!("C7-queried-wf27.json"),
    )
    .await;
    let (status, decision, approved) = claim_row(&n, claim).await;
    assert_eq!(status, "claim_submitted", "a query decides nothing");
    assert_eq!(decision.as_deref(), Some("queried"));
    assert_eq!(approved, None);

    let rejected = sample!("C7-rejected-wf291.json");
    answer(&n, "claim/on_submit", &correlation, "291", &rejected).await;
    let (status, decision, _) = claim_row(&n, claim).await;
    assert_eq!(status, "claim_rejected");
    assert_eq!(decision.as_deref(), Some("rejected"));
}

#[tokio::test]
async fn an_answer_that_does_not_say_where_it_stands_is_not_success() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (pa, correlation) = sent_preauth(&n).await;
    n.send(NhcxOperation::Preauth, &correlation).await;
    let queried = sample!("preauth-queried.json");
    let d = Delivery {
        status: None,
        ..Delivery::new("preauth/on_submit", &correlation, &queried)
    };
    assert_eq!(n.deliver(&d).await.0, StatusCode::ACCEPTED);
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["nhcx_status"], json!("unknown"));
    assert_eq!(
        view["nhcx_decision"],
        json!("unknown"),
        "partial, no step, no reason"
    );
    assert_eq!(
        view["status"],
        json!("submitted"),
        "nothing approved, nothing refused"
    );
    assert_eq!(view["approved_amount"], json!(null));
}

/// NHA's C9 notice under step `workflow`, on its own thread.
async fn notice(n: &Nhcx, workflow: &str) -> (StatusCode, Value) {
    let payload = sample!("C9-notice-wf30.json");
    let correlation = Uuid::new_v4().to_string();
    let d = Delivery {
        workflow: Some(workflow),
        status: Some("request.initiated"),
        ..Delivery::new("paymentnotice/request", &correlation, &payload)
    };
    n.deliver(&d).await
}

#[tokio::test]
async fn three_payment_notices_post_the_money_once_on_the_settled_one() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (patient, policy, _) = seed_insured_patient(&n).await;
    let seeded = seed_claim(&n, patient, policy).await;
    // The claim the C9 sample pays, approved at its benefit, sent to this payer.
    sqlx::query(
        "UPDATE insurance_claims SET claim_number = 'NM-26-0SE00002L', approved_amount = 150000, \
                nhcx_recipient_code = $1, status = 'claim_approved' WHERE id = $2",
    )
    .bind(&n.payer_code)
    .bind(seeded.claim)
    .execute(&n.app.db)
    .await
    .expect("claim");
    let settled = || async {
        sqlx::query_scalar::<_, Option<Decimal>>(
            "SELECT settled_amount FROM insurance_claims WHERE id = $1",
        )
        .bind(seeded.claim)
        .fetch_one(&n.app.db)
        .await
        .expect("settled")
    };
    for step in ["30", "31"] {
        assert_eq!(notice(&n, step).await.0, StatusCode::ACCEPTED);
        assert_eq!(settled().await, None, "{step} moves no money");
    }
    notice(&n, "33").await;
    assert_eq!(
        settled().await,
        Some(Decimal::from(150_000)),
        "net 135,000 + TDS 15,000"
    );
    notice(&n, "33").await;
    assert_eq!(
        settled().await,
        Some(Decimal::from(150_000)),
        "a repeat posts nothing"
    );

    let rows = get_json(
        &n,
        &format!(
            "/api/billing/insurance-claims/{}/nhcx/payments",
            seeded.claim
        ),
    )
    .await;
    let mine: Vec<(String, String)> = rows
        .as_array()
        .expect("rows")
        .iter()
        .map(|p| {
            (
                p["stage"].as_str().unwrap_or("").to_owned(),
                p["status"].as_str().unwrap_or("").to_owned(),
            )
        })
        .collect();
    let posted = mine.iter().filter(|(_, s)| s == "posted").count();
    let advice = mine.iter().filter(|(_, s)| s == "advice").count();
    assert_eq!((posted, advice), (1, 3), "{mine:?}");
    let tds: i64 = sqlx::query_scalar("SELECT count(*) FROM tds_deductions WHERE invoice_id = $1")
        .bind(seeded.invoice)
        .fetch_one(&n.app.db)
        .await
        .expect("tds");
    assert_eq!(tds, 1);
}

fn last_headers(n: &Nhcx) -> serde_json::Map<String, Value> {
    let body = n
        .received
        .lock()
        .expect("lock")
        .last()
        .expect("a POST")
        .2
        .clone();
    n.open_as_payer(&body).0
}

#[tokio::test]
async fn a_retry_goes_under_fresh_ids_and_the_payer_answering_it_still_lands() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (pa, correlation) = sent_preauth(&n).await;
    n.gateway_down
        .store(true, std::sync::atomic::Ordering::SeqCst);
    let first = n
        .send_attempt(NhcxOperation::Preauth, &correlation, 1)
        .await;
    assert!(first.is_err(), "503 is retried");
    let h1 = last_headers(&n);
    assert_eq!(h1["x-hcx-correlation_id"], json!(correlation));
    assert_eq!(
        h1["x-hcx-api_call_id"],
        json!(correlation),
        "correlation = api call id"
    );
    assert_eq!(h1["x-hcx-workflow_id"], json!("12"));
    assert_eq!(h1["x-hcx-ben-abha-id"].as_str().map(str::len), Some(17));
    let second = n
        .send_attempt(NhcxOperation::Preauth, &correlation, 2)
        .await;
    assert!(second.is_err());
    let h2 = last_headers(&n);
    let retry = h2["x-hcx-correlation_id"]
        .as_str()
        .expect("retry id")
        .to_owned();
    assert_ne!(retry, correlation, "a retired correlation is never reused");
    assert_eq!(h2["x-hcx-api_call_id"], json!(retry));
    assert_eq!(
        h2["x-hcx-request_id"], h1["x-hcx-request_id"],
        "same originating request"
    );
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["nhcx_status"], json!("queued"));

    // The first try had arrived after all: the payer answers the retry.
    answer(
        &n,
        "preauth/on_submit",
        &retry,
        "21",
        &sample!("C5-approved-wf21.json"),
    )
    .await;
    let last = n
        .send_attempt(NhcxOperation::Preauth, &correlation, 10)
        .await;
    assert!(last.is_err());
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["status"], json!("approved"));
    assert_ne!(
        view["nhcx_status"],
        json!("send_failed"),
        "an answered send is not failed"
    );

    // Another that never gets through is marked failed, not left waiting.
    let (pa, correlation) = sent_preauth(&n).await;
    let gave_up = n
        .send_attempt(NhcxOperation::Preauth, &correlation, 10)
        .await;
    assert!(gave_up.is_err());
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["nhcx_status"], json!("send_failed"));
    let reason = view["nhcx_disposition"].as_str().unwrap_or_default();
    assert!(reason.contains("after 10 tries"), "{reason}");
}

/// Post a plain JSON body to a callback path with a valid gateway token.
async fn deliver_plain(n: &Nhcx, path: &str, body: &Value) -> (StatusCode, Value) {
    let resp = reqwest::Client::new()
        .post(n.app.url(&format!("/api/integrations/nhcx/hcx/v1/{path}")))
        .bearer_auth(n.gateway_jwt())
        .json(body)
        .send()
        .await
        .expect("post");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn an_undelivered_request_reported_on_v1_error_is_shown_as_undelivered() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (pa, correlation) = sent_preauth(&n).await;
    n.send(NhcxOperation::Preauth, &correlation).await;
    let report = json!({
        "type": "ProtocolResponse",
        "x-hcx-sender_code": "nhcx-gateway@hcx",
        "x-hcx-recipient_code": n.hospital_code,
        "x-hcx-api_call_id": Uuid::new_v4(),
        "x-hcx-correlation_id": correlation,
        "x-hcx-workflow_id": "12",
        "x-hcx-status": "response.error",
        "x-hcx-error_details": { "code": "ERR_DELIVERY_FAILED",
            "message": "Recipient endpoint unreachable after five attempts" }
    });
    let (status, receipt) = deliver_plain(&n, "error", &report).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(receipt["result"]["entity_type"], json!("error"));
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["nhcx_status"], json!("undelivered"));
    assert_eq!(
        view["nhcx_disposition"],
        json!("Recipient endpoint unreachable after five attempts")
    );

    // A report naming nothing we know is still answered 202.
    let (status, _) = deliver_plain(&n, "error", &json!({ "anything": true })).await;
    assert_eq!(status, StatusCode::ACCEPTED);
}

#[tokio::test]
async fn a_callback_from_outside_the_allow_list_or_without_a_gateway_key_is_refused_unread() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (pa, correlation) = sent_preauth(&n).await;
    n.send(NhcxOperation::Preauth, &correlation).await;
    let approved = sample!("C5-approved-wf21.json");

    sqlx::query(
        "UPDATE nhcx_settings SET callback_ip_allowlist = '{3.109.99.210}' WHERE tenant_id = $1",
    )
    .bind(n.tenant)
    .execute(&n.app.db)
    .await
    .expect("allow-list");
    let (status, receipt) = n
        .deliver(&Delivery::new("preauth/on_submit", &correlation, &approved))
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(receipt["error"]["code"], json!("ERR_INVALID_SIGNATURE"));

    sqlx::query(
        "UPDATE nhcx_settings SET callback_ip_allowlist = '{}', gateway_jwt_public_key_pem = NULL \
          WHERE tenant_id = $1",
    )
    .bind(n.tenant)
    .execute(&n.app.db)
    .await
    .expect("no key");
    let (_, receipt) = n
        .deliver(&Delivery::new("preauth/on_submit", &correlation, &approved))
        .await;
    assert_eq!(receipt["error"]["code"], json!("ERR_SERVICE_UNAVAILABLE"));
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["status"], json!("submitted"), "nothing was applied");
    let status = get_json(&n, "/api/integrations/nhcx/status").await;
    assert!(
        status["missing"]
            .as_array()
            .expect("missing")
            .iter()
            .any(|m| m.as_str().is_some_and(|m| m.contains("gateway public key"))),
        "{status}"
    );
}
