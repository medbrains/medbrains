//! What the sandbox taught OHC care-abdm (MIT, docs/findings.md), held here:
//! - E1: the HIP ID the gateway routes on is the bridge service id
//!   (`<HFR ID>_<n>`); we send it once known and accept it on callbacks.
//! - F9: a link is followed by a context notify about a minute later, and
//!   ABDM-1006 ("not indexed yet") schedules another, later.
//! - E14: ABDM-1027 blocks the ABHA for 24 hours; nothing more is sent for it
//!   and the screen says why.
//! - E10: a repeated callback is acknowledged, not refused.

use crate::abdm_hip_world::{World, gateway_jwt, world};

use axum::http::StatusCode;
use medbrains_abdm::gateway::{
    CB_LINK_CONTEXT_ON_NOTIFY, CB_ON_GENERATE_TOKEN, CB_ON_LINK_CARE_CONTEXT,
    GENERATE_LINK_TOKEN_PATH, LINK_CARE_CONTEXT_PATH,
};
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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
    let call = w.last(path);
    call.headers
        .get("request-id")
        .and_then(|v| v.to_str().ok())
        .expect("request id")
        .to_owned()
}

/// Given a campus whose bridge service id is known, When a record is linked,
/// Then the gateway is called with that id as X-HIP-ID, its callbacks are
/// accepted under it, a repeated verdict is acknowledged, and a context
/// notify is queued about a minute out; ABDM-1006 queues another, SUCCESS
/// records it.
#[tokio::test]
async fn a_link_goes_out_as_the_service_id_and_is_followed_by_a_notify() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let service = format!("{}_1", w.hip_id);
    sqlx::query("UPDATE facilities SET abdm_hip_service_id = $2 WHERE hfr_facility_id = $1")
        .bind(&w.hip_id)
        .bind(&service)
        .execute(&w.app.db)
        .await
        .expect("service id");
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    link_now(&w, id).await;
    let token_call = w.last(GENERATE_LINK_TOKEN_PATH);
    assert_eq!(
        token_call
            .headers
            .get("x-hip-id")
            .and_then(|v| v.to_str().ok()),
        Some(service.as_str()),
        "the service id, never the bare HFR ID"
    );

    let jwt = gateway_jwt(&w.gateway_key);
    let token = "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjQxMDI0NDQ4MDB9.sig";
    let rid = request_id(&w, GENERATE_LINK_TOKEN_PATH);
    let body =
        json!({ "abhaAddress": w.address, "linkToken": token, "response": { "requestId": rid } });
    assert_eq!(
        w.callback_as(CB_ON_GENERATE_TOKEN, &jwt, &service, body)
            .await,
        StatusCode::ACCEPTED,
        "a callback naming the service id finds its hospital"
    );
    let verdict = json!({ "abhaAddress": w.address, "status": "SUCCESS",
        "response": { "requestId": request_id(&w, LINK_CARE_CONTEXT_PATH) } });
    for _ in 0..2 {
        assert_eq!(
            w.callback_as(CB_ON_LINK_CARE_CONTEXT, &jwt, &service, verdict.clone())
                .await,
            StatusCode::ACCEPTED,
            "the verdict, and its repeat"
        );
    }
    let due: Vec<bool> = sqlx::query_scalar(
        "SELECT next_retry_at > now() + interval '30 seconds' FROM outbox_events \
          WHERE event_type = 'abdm.care_context.notify' AND aggregate_id = $1",
    )
    .bind(id)
    .fetch_all(&w.app.db)
    .await
    .expect("notify rows");
    assert_eq!(
        due,
        vec![true],
        "one notify, not sent at once (ABDM-1006 at 0.6 s)"
    );

    let sent = Uuid::new_v4();
    sqlx::query(
        "UPDATE abdm_care_contexts SET notify_request_id = $2, notify_attempts = 1 WHERE id = $1",
    )
    .bind(id)
    .bind(sent)
    .execute(&w.app.db)
    .await
    .expect("as if sent");
    let refused = json!({ "acknowledgement": { "status": "ERRORED" },
        "error": { "code": "ABDM-1006: ", "message": "No links found for the patient in the given HIP" },
        "response": { "requestId": sent } });
    assert_eq!(
        w.callback_as(CB_LINK_CONTEXT_ON_NOTIFY, &jwt, &service, refused)
            .await,
        StatusCode::ACCEPTED
    );
    let retries: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM outbox_events WHERE event_type = 'abdm.care_context.notify' \
          AND aggregate_id = $1",
    )
    .bind(id)
    .fetch_one(&w.app.db)
    .await
    .expect("retries");
    assert_eq!(retries, 2, "ABDM-1006 asks again later");

    let again = Uuid::new_v4();
    sqlx::query("UPDATE abdm_care_contexts SET notify_request_id = $2 WHERE id = $1")
        .bind(id)
        .bind(again)
        .execute(&w.app.db)
        .await
        .expect("as if resent");
    let ok =
        json!({ "acknowledgement": { "status": "SUCCESS" }, "response": { "requestId": again } });
    assert_eq!(
        w.callback_as(CB_LINK_CONTEXT_ON_NOTIFY, &jwt, &service, ok)
            .await,
        StatusCode::ACCEPTED
    );
    let (notified, error): (bool, Option<String>) = sqlx::query_as(
        "SELECT notified_at IS NOT NULL, notify_error FROM abdm_care_contexts WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&w.app.db)
    .await
    .expect("notified");
    assert!(notified && error.is_none(), "{error:?}");
}

/// Given ABDM answers ABDM-1027, Then the ABHA is blocked for a day: the
/// record says so, and "Link now" sends nothing more to ABDM.
#[tokio::test]
async fn abdm_1027_blocks_the_abha_for_a_day() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    link_now(&w, id).await;
    let rid = request_id(&w, GENERATE_LINK_TOKEN_PATH);
    let blocked = json!({ "error": { "code": "ABDM-1027: ",
        "message": "You are blocked. Please try again after 24 hours." },
        "response": { "requestId": rid } });
    assert_eq!(
        w.callback(CB_ON_GENERATE_TOKEN, &w.gateway_key, blocked)
            .await,
        StatusCode::ACCEPTED
    );
    let until: bool = sqlx::query_scalar(
        "SELECT abdm_blocked_until > now() + interval '23 hours' FROM patient_abha_links \
          WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(w.patient_id)
    .fetch_one(&w.app.db)
    .await
    .expect("block");
    assert!(until);

    let asked = w.count(GENERATE_LINK_TOKEN_PATH);
    let again = link_now(&w, id).await;
    assert_eq!(
        w.count(GENERATE_LINK_TOKEN_PATH),
        asked,
        "nothing more is sent: {again}"
    );
    let records: Value = w
        .app
        .client
        .get(
            w.app
                .url(&format!("/api/abdm/patients/{}/records", w.patient_id)),
        )
        .send()
        .await
        .expect("records")
        .json()
        .await
        .expect("json");
    assert!(
        records["blocked_reason"]
            .as_str()
            .is_some_and(|r| r.contains("24 hours")),
        "{records}"
    );
    sqlx::query("UPDATE patient_abha_links SET abdm_blocked_until = NULL WHERE patient_id = $1")
        .bind(w.patient_id)
        .execute(&w.app.db)
        .await
        .expect("lift for other tests");
}
