//! M2 linking robustness (#5711), against the stand-in gateway:
//! - two records saved together ask ABDM for one link token, not two;
//! - ABDM-1026/1038 clear the stored token and ask for a new one, once;
//! - ABDM-2406 queues the link again, in order, instead of dropping it;
//! - a link-init or link-confirm delivered twice (same REQUEST-ID) sends one
//!   OTP SMS and counts one attempt; a repeated HIU on-init is 202, not 404;
//! - HIP callbacks need X-HIP-ID and HIU callbacks X-HIU-ID.

use crate::abdm_hip_world::{World, hiu, world};

use axum::http::StatusCode;
use medbrains_abdm::gateway::{
    self as paths, CB_LINK_CONFIRM, CB_LINK_INIT, CB_ON_GENERATE_TOKEN, CB_ON_LINK_CARE_CONTEXT,
    GENERATE_LINK_TOKEN_PATH, LINK_CARE_CONTEXT_PATH, ON_LINK_CONFIRM_PATH, ON_LINK_INIT_PATH,
};
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const TOKEN: &str = "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjQxMDI0NDQ4MDB9.sig";

async fn link_now(w: &World, id: Uuid) -> Value {
    w.app
        .client
        .post(w.app.url(&format!("/api/abdm/care-contexts/{id}/link")))
        .header("x-csrf-token", &w.csrf)
        .send()
        .await
        .expect("link")
        .json()
        .await
        .expect("json")
}

fn request_id(w: &World, path: &str) -> String {
    w.last(path)
        .headers
        .get("request-id")
        .and_then(|v| v.to_str().ok())
        .expect("request id")
        .to_owned()
}

/// The token ABDM issues for the last token request.
async fn deliver_token(w: &World) {
    let rid = request_id(w, GENERATE_LINK_TOKEN_PATH);
    let body = json!({ "abhaAddress": w.address, "linkToken": TOKEN,
                       "response": { "requestId": rid } });
    assert_eq!(
        w.callback(CB_ON_GENERATE_TOKEN, &w.gateway_key, body).await,
        StatusCode::ACCEPTED
    );
}

/// ABDM's verdict on the last link call: a refusal with `code`.
async fn refuse_link(w: &World, code: &str) {
    let rid = request_id(w, LINK_CARE_CONTEXT_PATH);
    let body = json!({ "error": { "code": code, "message": "refused" },
                       "response": { "requestId": rid } });
    assert_eq!(
        w.callback(CB_ON_LINK_CARE_CONTEXT, &w.gateway_key, body)
            .await,
        StatusCode::ACCEPTED
    );
}

/// (stored token present, rejected at set) for the world's patient.
async fn token_state(w: &World) -> (bool, bool) {
    sqlx::query_as(
        "SELECT linking_token IS NOT NULL, token_rejected_at IS NOT NULL \
           FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(w.patient_id)
    .fetch_one(&w.app.db)
    .await
    .expect("link row")
}

/// Given two records for one patient with no token yet, When both are
/// linked at once, Then ABDM is asked for one token and both wait on it; the
/// token links both in one call.
#[tokio::test]
async fn two_records_saved_together_ask_for_one_token() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (a, b) = (w.close_consultation().await, w.close_consultation().await);
    let ((ia, _, _), (ib, _, _)) = (w.context(&a).await, w.context(&b).await);
    let before = w.count(GENERATE_LINK_TOKEN_PATH);
    tokio::join!(link_now(&w, ia), link_now(&w, ib));
    assert_eq!(
        w.count(GENERATE_LINK_TOKEN_PATH),
        before + 1,
        "one token request"
    );
    let waiting: Vec<Option<Uuid>> = sqlx::query_scalar(
        "SELECT DISTINCT abdm_request_id FROM abdm_care_contexts WHERE id = ANY($1)",
    )
    .bind([ia, ib])
    .fetch_all(&w.app.db)
    .await
    .expect("waiting");
    assert_eq!(
        waiting.len(),
        1,
        "both wait on the same request: {waiting:?}"
    );
    deliver_token(&w).await;
    let sent = w.last(LINK_CARE_CONTEXT_PATH).body.to_string();
    assert!(sent.contains(&a) && sent.contains(&b), "{sent}");
}

/// Given a stored token, When ABDM refuses the link with ABDM-1026, Then the
/// token is cleared and a new one asked for; when the new one is refused too
/// (ABDM-1038), nothing more is asked and the record says why.
#[tokio::test]
async fn a_rejected_token_is_cleared_and_asked_for_once() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    link_now(&w, id).await;
    deliver_token(&w).await;
    assert_eq!(token_state(&w).await, (true, false));
    let asked = w.count(GENERATE_LINK_TOKEN_PATH);

    refuse_link(&w, "ABDM-1026").await;
    assert_eq!(token_state(&w).await, (false, true), "the token is cleared");
    assert_eq!(
        w.count(GENERATE_LINK_TOKEN_PATH),
        asked + 1,
        "a new one, once"
    );
    assert_eq!(w.context(&reference).await.1, "linking");

    deliver_token(&w).await;
    refuse_link(&w, "ABDM-1038").await;
    assert_eq!(token_state(&w).await.0, false);
    assert_eq!(w.count(GENERATE_LINK_TOKEN_PATH), asked + 1, "no loop");
    let (_, status, _) = w.context(&reference).await;
    assert_eq!(status, "failed");
}

/// Given a link ABDM refuses as out of order (ABDM-2406), Then it is queued
/// to run again from the top a minute later, and a redelivery of the same
/// refusal changes nothing.
#[tokio::test]
async fn an_out_of_order_link_is_queued_again() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    link_now(&w, id).await;
    deliver_token(&w).await;
    let rid = request_id(&w, LINK_CARE_CONTEXT_PATH);
    refuse_link(&w, "ABDM-2406").await;
    let queued: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM outbox_events WHERE event_type = 'abdm.care_context.link' \
            AND idempotency_key LIKE 'ccl-2406:%' AND payload::text LIKE '%' || $1 || '%' \
            AND next_retry_at > now()",
    )
    .bind(id.to_string())
    .fetch_one(&w.app.db)
    .await
    .expect("queued");
    assert_eq!(queued, 1);
    assert_eq!(w.context(&reference).await.1, "not_linked");
    let again = json!({ "error": { "code": "ABDM-2406", "message": "refused" },
                        "response": { "requestId": rid } });
    assert_eq!(
        w.callback(CB_ON_LINK_CARE_CONTEXT, &w.gateway_key, again)
            .await,
        StatusCode::ACCEPTED
    );
    assert_eq!(
        w.context(&reference).await.1,
        "not_linked",
        "the repeat changes nothing"
    );
}

/// Given the PHR app's link-init and link-confirm, When the gateway delivers
/// each twice with the same REQUEST-ID, Then one OTP SMS is queued, both
/// answers name the same link, and the repeated confirm is not a wrong OTP.
#[tokio::test]
async fn a_replayed_link_init_sends_no_second_otp() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let txn = format!("txn-{}", Uuid::new_v4());
    let init = json!({ "transactionId": txn, "abhaAddress": w.address, "patient": [{
        "referenceNumber": w.uhid, "hiType": "OPConsultation", "count": 1,
        "careContexts": [{ "referenceNumber": reference }] }] });
    let sms_before = w.app.outbox_rows("sms.abdm_link_otp", "").await.len();
    let rid = Uuid::new_v4().to_string();
    let mut refs = Vec::new();
    for _ in 0..2 {
        let status = w
            .callback_with(CB_LINK_INIT, (&rid, "X-HIP-ID"), init.clone())
            .await;
        assert_eq!(status, StatusCode::ACCEPTED);
        refs.push(w.last(ON_LINK_INIT_PATH).body["link"]["referenceNumber"].clone());
    }
    assert_eq!(refs[0], refs[1], "the same link both times");
    let sms = w.app.outbox_rows("sms.abdm_link_otp", "").await;
    assert_eq!(sms.len(), sms_before + 1, "one OTP SMS");
    let otp: String = sms
        .last()
        .and_then(|p| p["body"].as_str())
        .expect("otp")
        .chars()
        .take(6)
        .collect();
    let confirm = json!({ "confirmation": { "linkRefNumber": refs[0], "token": otp } });
    let rid = Uuid::new_v4().to_string();
    for _ in 0..2 {
        let status = w
            .callback_with(CB_LINK_CONFIRM, (&rid, "X-HIP-ID"), confirm.clone())
            .await;
        assert_eq!(status, StatusCode::ACCEPTED);
        let answer = w.last(ON_LINK_CONFIRM_PATH).body;
        assert!(answer["error"].is_null(), "{answer}");
    }
    assert_eq!(w.context(&reference).await.1, "linked");
}

/// Given an accepted consent request, When ABDM's on-init arrives twice,
/// Then both are 202; and a callback naming its hospital by the other side's
/// header is refused.
#[tokio::test]
async fn a_repeated_on_init_is_acknowledged_and_headers_are_not_interchangeable() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    hiu::with_hpr(&w).await;
    hiu::raise(&w).await;
    let init = w.last(paths::CONSENT_INIT_PATH);
    let body = json!({ "consentRequest": { "id": format!("cr-{}", Uuid::new_v4()) },
                       "response": { "requestId": hiu::header(&init, "request-id") } });
    for _ in 0..2 {
        let status = hiu::hiu_callback(
            &w,
            paths::CB_HIU_CONSENT_ON_INIT,
            &w.gateway_key,
            body.clone(),
        )
        .await;
        assert_eq!(status, StatusCode::ACCEPTED);
    }
    let rid = Uuid::new_v4().to_string();
    let as_hip = w
        .callback_with(paths::CB_HIU_CONSENT_ON_INIT, (&rid, "X-HIP-ID"), body)
        .await;
    assert_eq!(
        as_hip,
        StatusCode::UNAUTHORIZED,
        "an HIU callback needs X-HIU-ID"
    );
    let discover = json!({ "transactionId": "t", "patient": { "id": w.address } });
    let as_hiu = w
        .callback_with(paths::CB_DISCOVER, (&rid, "X-HIU-ID"), discover)
        .await;
    assert_eq!(
        as_hiu,
        StatusCode::UNAUTHORIZED,
        "an HIP callback needs X-HIP-ID"
    );
}
