//! NHCX final claims, Tasks and payment notices, end to end against a
//! stand-in gateway.
//!
//! A final claim goes as a ClaimBundle with `use = claim` built from the
//! final bill — each line with its quantity and amount, the bill's split, the
//! finalised discharge summary and the pre-auth number — and the payer's
//! adjudication reads back line by line with its deductions. Status, cancel
//! and reprocess are Tasks whose answers land on the claim; cancelling needs
//! `insurance.nhcx.cancel`. A payment notice settles each claim it names
//! once, records the TDS, is acknowledged once, and is matched — not settled
//! again — when the bank statement shows the transfer. A payment other than
//! the approved amount is flagged, and one naming no claim waits for finance.

mod common;
mod nhcx_support;

use axum::http::StatusCode;
use base64::Engine;
use medbrains_core::nhcx::NhcxOperation;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use nhcx_support::claim_seed::{
    ClaimSeed, adjudicated_claim, finalise_discharge_summary, payment_notice, seed_claim,
    submit_final_claim,
};
use nhcx_support::seed::{get_json, hospital_hfr_id, post, resources, seed_insured_patient};

/// The tests share one hospital's NHCX settings; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn dec(s: &str) -> Decimal {
    s.parse().expect("decimal")
}

/// A claim whose final claim has been sent and adjudicated: 27,000 of 30,000.
async fn adjudicated(n: &nhcx_support::Nhcx) -> ClaimSeed {
    let (patient, policy, _) = seed_insured_patient(n).await;
    hospital_hfr_id(n).await;
    let seeded = seed_claim(n, patient, policy).await;
    finalise_discharge_summary(n, seeded.admission).await;
    let correlation = submit_final_claim(n, seeded.claim).await;
    n.send(NhcxOperation::Claim, &correlation).await;
    let status = n
        .callback("claim/on_submit", &correlation, &adjudicated_claim())
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    seeded
}

async fn claim_money(n: &nhcx_support::Nhcx, claim: Uuid) -> (Option<Decimal>, String) {
    sqlx::query_as("SELECT settled_amount, status FROM insurance_claims WHERE id = $1")
        .bind(claim)
        .fetch_one(&n.app.db)
        .await
        .expect("claim")
}

#[tokio::test]
async fn a_final_claim_goes_from_the_bill_and_its_adjudication_lands_line_by_line() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (patient, policy, _) = seed_insured_patient(&n).await;
    hospital_hfr_id(&n).await;
    let seeded = seed_claim(&n, patient, policy).await;

    let early = post(
        &n,
        &format!(
            "/api/billing/insurance-claims/{}/submit-to-nhcx",
            seeded.claim
        ),
        &json!({ "recipient_code": n.payer_code, "use": "claim" }),
    )
    .await;
    assert_eq!(
        early.status(),
        StatusCode::BAD_REQUEST,
        "no final claim before the discharge summary is finalised"
    );

    finalise_discharge_summary(&n, seeded.admission).await;
    let correlation = submit_final_claim(&n, seeded.claim).await;
    let (path, body) = n.send(NhcxOperation::Claim, &correlation).await;
    assert_eq!(path, "claim/submit");
    let (_, bundle) = n.open_as_payer(&body);
    let claim = resources(&bundle, "Claim").next().expect("claim");
    assert_eq!(claim["use"], json!("claim"));
    let items = claim["item"].as_array().expect("items");
    assert_eq!(items.len(), 2, "every bill line");
    assert_eq!(items[0]["productOrService"]["text"], json!("Room rent"));
    assert_eq!(
        items[0]["productOrService"]["coding"][0]["code"],
        json!("RR-1")
    );
    assert_eq!(items[0]["quantity"]["value"], json!(3));
    assert_eq!(items[0]["unitPrice"]["value"], json!(3000.0));
    assert_eq!(items[0]["net"]["value"], json!(9000.0));
    assert_eq!(items[1]["net"]["value"], json!(21000.0));
    assert_eq!(
        claim["total"]["value"],
        json!(30000.0),
        "the amount claimed"
    );
    assert_eq!(claim["insurance"][0]["preAuthRef"], json!(["AUTH-77"]));
    let info = claim["supportingInfo"].as_array().expect("supporting info");
    let summary = info
        .iter()
        .find(|i| i["category"]["coding"][0]["code"] == json!("HDS"))
        .expect("the discharge summary goes");
    assert_eq!(
        summary["valueAttachment"]["contentType"],
        json!("application/pdf")
    );
    let pdf = base64::engine::general_purpose::STANDARD
        .decode(summary["valueAttachment"]["data"].as_str().expect("data"))
        .expect("base64");
    assert!(pdf.starts_with(b"%PDF"), "the summary goes as a PDF");
    assert!(
        info.iter().any(|i| i["valueString"]
            .as_str()
            .is_some_and(|s| s.contains("discount INR 500"))),
        "the bill's split goes as information"
    );
    let (_, status) = claim_money(&n, seeded.claim).await;
    assert_eq!(status, "claim_submitted");

    let answered = n
        .callback("claim/on_submit", &correlation, &adjudicated_claim())
        .await;
    assert_eq!(answered, StatusCode::ACCEPTED);
    let view = get_json(
        &n,
        &format!("/api/billing/insurance-claims/{}/nhcx", seeded.claim),
    )
    .await;
    let adj = &view["adjudication"];
    assert_eq!(adj["submitted"], json!("30000"));
    assert_eq!(adj["approved"], json!("27000"));
    assert_eq!(adj["deducted"], json!("3000"));
    assert_eq!(adj["lines"][0]["deducted"], json!("3000"));
    assert_eq!(
        adj["lines"][0]["reasons"],
        json!(["Room rent above the policy limit"])
    );
    assert_eq!(
        adj["lines"][1]["reasons"],
        json!([]),
        "covered is not a reason"
    );
    assert_eq!(view["claim_items"][0]["description"], json!("Room rent"));
    let (approved, status): (Option<Decimal>, String) =
        sqlx::query_as("SELECT approved_amount, status FROM insurance_claims WHERE id = $1")
            .bind(seeded.claim)
            .fetch_one(&n.app.db)
            .await
            .expect("claim");
    assert_eq!(approved, Some(dec("27000")));
    assert_eq!(status, "claim_approved");
}

#[tokio::test]
async fn status_reprocess_and_cancel_go_as_tasks_and_their_answers_land_on_the_claim() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let seeded = adjudicated(&n).await;
    let base = format!("/api/billing/insurance-claims/{}/nhcx", seeded.claim);

    let resp = post(&n, &format!("{base}/status"), &json!({})).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let correlation = resp.json::<Value>().await.expect("json")["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();
    let (path, body) = n.send(NhcxOperation::Status, &correlation).await;
    assert_eq!(path, "hcx/status");
    let (_, bundle) = n.open_as_payer(&body);
    let task = resources(&bundle, "Task").next().expect("task");
    assert_eq!(task["code"]["coding"][0]["code"], json!("status"));
    assert_eq!(task["input"][0]["valueString"], json!(seeded.claim_number));

    let answer = json!({ "resourceType": "Bundle", "entry": [
        { "resource": { "resourceType": "Task", "status": "completed" } },
        { "resource": { "resourceType": "ClaimResponse", "use": "claim", "outcome": "complete",
            "total": [nhcx_support::claim_seed::amount("submitted", 30000),
                      nhcx_support::claim_seed::amount("benefit", 28000)] } }
    ]});
    assert_eq!(
        n.callback("hcx/on_status", &correlation, &answer).await,
        StatusCode::ACCEPTED
    );
    let view = get_json(&n, &base).await;
    assert_eq!(view["tasks"][0]["kind"], json!("status"));
    assert_eq!(
        view["tasks"][0]["result"]["task_status"],
        json!("completed")
    );
    assert_eq!(view["adjudication"]["approved"], json!("28000"));

    let short = post(&n, &format!("{base}/reprocess"), &json!({ "reason": "x" })).await;
    assert_eq!(
        short.status(),
        StatusCode::BAD_REQUEST,
        "a reason is required"
    );
    let resp = post(
        &n,
        &format!("{base}/reprocess"),
        &json!({ "reason": "Room rent bills attached; the room was a general ward." }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let correlation = resp.json::<Value>().await.expect("json")["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();
    let (path, body) = n.send(NhcxOperation::Reprocess, &correlation).await;
    assert_eq!(path, "claim/reprocess");
    let (_, bundle) = n.open_as_payer(&body);
    let task = resources(&bundle, "Task").next().expect("task");
    assert_eq!(task["code"]["coding"][0]["code"], json!("reprocess"));

    let resp = post(
        &n,
        &format!("{base}/cancel"),
        &json!({ "reason": "Patient chose to pay in cash." }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let correlation = resp.json::<Value>().await.expect("json")["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();
    let (path, body) = n.send(NhcxOperation::Cancel, &correlation).await;
    assert_eq!(path, "claim/cancel");
    let (_, bundle) = n.open_as_payer(&body);
    let task = resources(&bundle, "Task").next().expect("task");
    assert_eq!(task["code"]["coding"][0]["code"], json!("cancel"));
    assert_eq!(
        task["reasonCode"]["text"],
        json!("Patient chose to pay in cash.")
    );
    let done = json!({ "resourceType": "Task", "status": "completed" });
    assert_eq!(
        n.callback("claim/on_cancel", &correlation, &done).await,
        StatusCode::ACCEPTED
    );
    let (_, status) = claim_money(&n, seeded.claim).await;
    assert_eq!(status, "cancelled");
    let again = post(
        &n,
        &format!("{base}/reprocess"),
        &json!({ "reason": "Second thoughts" }),
    )
    .await;
    assert_eq!(
        again.status(),
        StatusCode::CONFLICT,
        "a cancelled claim is closed"
    );
}

#[tokio::test]
async fn a_payment_notice_settles_the_claim_once_records_tds_and_is_acknowledged() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let seeded = adjudicated(&n).await;
    let utr = format!("UTR{}", n.tag.to_uppercase());
    let notice = payment_notice(
        &utr,
        &[
            (&seeded.claim_number, 27000, 2700),
            ("NOT-OURS-1", 5000, 500),
        ],
    );
    let correlation = Uuid::new_v4().to_string();
    let api_call = Uuid::new_v4();
    let status = n
        .callback_with("paymentnotice/request", &correlation, api_call, &notice)
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);

    let (settled, claim_status) = claim_money(&n, seeded.claim).await;
    assert_eq!(settled, Some(dec("27000")), "gross: paid plus TDS");
    assert_eq!(claim_status, "settled");
    let (tds, rate, base, section): (Decimal, Decimal, Decimal, String) = sqlx::query_as(
        "SELECT tds_amount, tds_rate, base_amount, tds_section FROM tds_deductions \
          WHERE invoice_id = $1 AND deleted_at IS NULL",
    )
    .bind(seeded.invoice)
    .fetch_one(&n.app.db)
    .await
    .expect("the TDS is recorded on the claim's invoice");
    assert_eq!((tds, rate, base), (dec("2700"), dec("10"), dec("27000")));
    assert_eq!(section, "194J");
    let paid: Decimal = sqlx::query_scalar("SELECT paid_amount FROM invoices WHERE id = $1")
        .bind(seeded.invoice)
        .fetch_one(&n.app.db)
        .await
        .expect("invoice");
    assert_eq!(
        paid,
        Decimal::ZERO,
        "insurer money settles on the claim, not the bill"
    );

    let (path, body) = n.send(NhcxOperation::PaymentAck, &correlation).await;
    assert_eq!(path, "paymentnotice/on_request");
    let (headers, ack) = n.open_as_payer(&body);
    assert_eq!(headers["x-hcx-correlation_id"], json!(correlation));
    assert_eq!(headers["x-hcx-status"], json!("response.complete"));
    let task = resources(&ack, "Task").next().expect("task");
    assert_eq!(
        task["output"][0]["valueCodeableConcept"]["coding"][0]["code"],
        json!("paymentack")
    );

    // The gateway delivers the same notice again.
    let status = n
        .callback_with("paymentnotice/request", &correlation, api_call, &notice)
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let (settled, _) = claim_money(&n, seeded.claim).await;
    assert_eq!(settled, Some(dec("27000")), "settled once");
    let counts: (i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT count(*) FROM tds_deductions WHERE invoice_id = $1), \
                (SELECT count(*) FROM nhcx_payment_notices WHERE request_api_call_id = $2), \
                (SELECT count(*) FROM outbox_events WHERE event_type = 'nhcx.payment_ack' \
                    AND payload->>'correlation_id' = $3)",
    )
    .bind(seeded.invoice)
    .bind(api_call)
    .bind(&correlation)
    .fetch_one(&n.app.db)
    .await
    .expect("counts");
    assert_eq!(
        counts,
        (1, 1, 1),
        "one TDS row, one notice, one acknowledgement"
    );

    let open = get_json(&n, "/api/insurance/nhcx/payments").await;
    let open = open.as_array().expect("rows");
    assert!(
        open.iter()
            .any(|p| p["claim_reference"] == json!("NOT-OURS-1")
                && p["status"] == json!("unmatched")),
        "a payment naming no claim here waits for finance"
    );
    assert!(
        !open
            .iter()
            .any(|p| p["insurance_claim_id"] == json!(seeded.claim)),
        "a payment that matches is not on the follow-up list"
    );
    let mine = get_json(
        &n,
        &format!(
            "/api/billing/insurance-claims/{}/nhcx/payments",
            seeded.claim
        ),
    )
    .await;
    assert_eq!(mine[0]["payment_reference"], json!(utr));
    assert_eq!(mine[0]["net_amount"], json!("24300.00"));
    assert_eq!(mine[0]["is_mismatch"], json!(false));

    // The bank statement shows the transfer: matched, not settled again.
    sqlx::query(
        "INSERT INTO bank_transactions (tenant_id, bank_name, account_number, transaction_date, \
             credit_amount, reference_number) \
         VALUES ($1, 'Test Bank', '0001', current_date, 28800, $2)",
    )
    .bind(n.tenant)
    .bind(&utr)
    .execute(&n.app.db)
    .await
    .expect("bank credit");
    let resp = post(&n, "/api/billing/bank-transactions/auto-match", &json!({})).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let (recon, claim_id): (String, Option<Uuid>) = sqlx::query_as(
        "SELECT recon_status::text, matched_claim_id FROM bank_transactions \
          WHERE tenant_id = $1 AND reference_number = $2",
    )
    .bind(n.tenant)
    .bind(&utr)
    .fetch_one(&n.app.db)
    .await
    .expect("bank row");
    assert_eq!(
        recon, "discrepancy",
        "the credit carries 4,500 for the unmatched claim"
    );
    assert_eq!(claim_id, Some(seeded.claim));
    let (settled, _) = claim_money(&n, seeded.claim).await;
    assert_eq!(
        settled,
        Some(dec("27000")),
        "the bank match does not settle twice"
    );
}

#[tokio::test]
async fn a_payment_other_than_approved_is_flagged_and_finance_posts_an_unmatched_one() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let seeded = adjudicated(&n).await;
    let notice = payment_notice("UTRMISMATCH1", &[("PAYER-REF-9", 20000, 2000)]);
    let status = n
        .callback_with(
            "paymentnotice/request",
            &Uuid::new_v4().to_string(),
            Uuid::new_v4(),
            &notice,
        )
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let open = get_json(&n, "/api/insurance/nhcx/payments").await;
    let row = open
        .as_array()
        .expect("rows")
        .iter()
        .find(|p| p["claim_reference"] == json!("PAYER-REF-9"))
        .expect("the unmatched payment")
        .clone();
    assert_eq!(row["status"], json!("unmatched"));
    let (settled, _) = claim_money(&n, seeded.claim).await;
    assert_eq!(settled, None, "nothing settles until finance posts it");

    let id = row["id"].as_str().expect("id");
    let resp = post(
        &n,
        &format!("/api/insurance/nhcx/payments/{id}/post"),
        &json!({ "insurance_claim_id": seeded.claim }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let posted: Value = resp.json().await.expect("json");
    assert_eq!(posted["status"], json!("posted"));
    assert_eq!(
        posted["is_mismatch"],
        json!(true),
        "20,000 paid against 27,000 approved"
    );
    let (settled, status) = claim_money(&n, seeded.claim).await;
    assert_eq!(settled, Some(dec("20000")));
    assert_eq!(status, "partially_settled");
    let again = post(
        &n,
        &format!("/api/insurance/nhcx/payments/{id}/post"),
        &json!({ "insurance_claim_id": seeded.claim }),
    )
    .await;
    assert_eq!(again.status(), StatusCode::CONFLICT, "posted once");
}

#[tokio::test]
async fn staff_without_the_nhcx_claim_and_payment_permissions_are_refused() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (patient, policy, _) = seed_insured_patient(&n).await;
    let seeded = seed_claim(&n, patient, policy).await;
    let clerk = common::provision_staff(
        &n.app,
        &n.csrf,
        "billing_clerk",
        &[
            "insurance.nhcx.submit",
            "insurance.nhcx.view",
            "insurance.nhcx.cancel",
            "insurance.nhcx.payments",
        ],
    )
    .await;
    let claim = format!("/api/billing/insurance-claims/{}", seeded.claim);
    let reason = json!({ "reason": "Duplicate claim" });
    let attempts: Vec<(reqwest::Method, String, Option<Value>)> = vec![
        (reqwest::Method::GET, format!("{claim}/nhcx"), None),
        (
            reqwest::Method::POST,
            format!("{claim}/nhcx/status"),
            Some(json!({})),
        ),
        (
            reqwest::Method::POST,
            format!("{claim}/nhcx/cancel"),
            Some(reason.clone()),
        ),
        (
            reqwest::Method::POST,
            format!("{claim}/nhcx/reprocess"),
            Some(reason),
        ),
        (reqwest::Method::GET, format!("{claim}/nhcx/payments"), None),
        (
            reqwest::Method::GET,
            "/api/insurance/nhcx/payments".into(),
            None,
        ),
        (
            reqwest::Method::GET,
            "/api/insurance/nhcx/searches".into(),
            None,
        ),
        (
            reqwest::Method::POST,
            "/api/insurance/nhcx/search".into(),
            Some(
                json!({ "recipient_code": n.payer_code, "from_date": "2026-10-01",
                         "to_date": "2026-10-19" }),
            ),
        ),
        (
            reqwest::Method::POST,
            format!("/api/insurance/nhcx/payments/{}/post", Uuid::new_v4()),
            Some(json!({ "insurance_claim_id": seeded.claim })),
        ),
        (
            reqwest::Method::POST,
            format!("/api/insurance/prior-auths/{}/nhcx/status", Uuid::new_v4()),
            Some(json!({})),
        ),
    ];
    for (method, path, body) in attempts {
        let mut req = clerk
            .client
            .request(method, n.app.url(&path))
            .header("x-csrf-token", &clerk.csrf);
        if let Some(b) = body {
            req = req.json(&b);
        }
        let resp = req.send().await.expect("request");
        assert_eq!(resp.status(), StatusCode::FORBIDDEN, "{path}");
    }
    let mine: i64 =
        sqlx::query_scalar("SELECT count(*) FROM nhcx_tasks WHERE insurance_claim_id = $1")
            .bind(seeded.claim)
            .fetch_one(&n.app.db)
            .await
            .expect("count");
    assert_eq!(mine, 0, "nothing was asked of the payer");
}
