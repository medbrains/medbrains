//! Link completeness (M2): what ABDM's answer to a link says is what the
//! record shows — never "linked" on an answer that did not say so.
//! - ABDM-1056 "already linked" is the outcome wanted: linked.
//! - A `status` without `error` that is not a success ("Counter and Care
//!   context count mismatch", NHA M2 document §1.4) is a failure, in its words.
//! - An answer with neither is unknown, shown as such, never as linked.
//! - A deactivated ABHA (ABDM-1407 and kin) stops linking, says why, and
//!   "Link now" — once the patient has reactivated it — tries again.

use crate::abdm_hip_world::{World, world};

use axum::http::StatusCode;
use medbrains_abdm::gateway::{
    CB_ON_GENERATE_TOKEN, CB_ON_LINK_CARE_CONTEXT, GENERATE_LINK_TOKEN_PATH, LINK_CARE_CONTEXT_PATH,
};
use serde_json::{Value, json};
use uuid::Uuid;

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

/// Where a care context stands, and why.
async fn state(w: &World, reference: &str) -> (String, Option<String>) {
    sqlx::query_as(
        "SELECT link_status, last_error FROM abdm_care_contexts WHERE reference_number = $1",
    )
    .bind(reference)
    .fetch_one(&w.app.db)
    .await
    .expect("care context")
}

/// A record linked as far as ABDM's verdict, which `verdict` then gives.
async fn verdict(w: &World, verdict: Value) -> (String, Option<String>) {
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    link_now(w, id).await;
    let rid = request_id(w, GENERATE_LINK_TOKEN_PATH);
    let token =
        json!({ "abhaAddress": w.address, "linkToken": TOKEN, "response": { "requestId": rid } });
    assert_eq!(
        w.callback(CB_ON_GENERATE_TOKEN, &w.gateway_key, token)
            .await,
        StatusCode::ACCEPTED
    );
    let mut body = verdict;
    body["response"] = json!({ "requestId": request_id(w, LINK_CARE_CONTEXT_PATH) });
    assert_eq!(
        w.callback(CB_ON_LINK_CARE_CONTEXT, &w.gateway_key, body)
            .await,
        StatusCode::ACCEPTED
    );
    state(w, &reference).await
}

#[tokio::test]
async fn already_linked_is_linked_and_a_failed_status_or_silence_is_not() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let already = json!({ "error": { "code": "ABDM-1056", "message": "This care context has been already linked" } });
    assert_eq!(verdict(&w, already).await.0, "linked");

    let (status, error) = verdict(
        &w,
        json!({ "abhaAddress": w.address,
        "status": "Counter and Care context count mismatch" }),
    )
    .await;
    assert_eq!(status, "failed");
    assert!(error.is_some_and(|e| e.contains("count mismatch")));

    let (status, error) = verdict(&w, json!({ "abhaAddress": w.address })).await;
    assert_eq!(
        status, "failed",
        "an answer that says nothing is not a link"
    );
    assert!(error.is_some_and(|e| e.contains("did not say")));
}

#[tokio::test]
async fn a_deactivated_abha_stops_linking_until_staff_retry() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    link_now(&w, id).await;
    let rid = request_id(&w, GENERATE_LINK_TOKEN_PATH);
    let refused = json!({ "error": { "code": "ABDM-1407: ", "message": "The ABHA Number associated with \
        this ABHA Address is currently deactivated. Please reactivate it." }, "response": { "requestId": rid } });
    assert_eq!(
        w.callback(CB_ON_GENERATE_TOKEN, &w.gateway_key, refused)
            .await,
        StatusCode::ACCEPTED
    );
    let (status, error) = state(&w, &reference).await;
    assert_eq!(status, "failed");
    assert!(
        error.as_deref().is_some_and(|e| e.contains("reactivate")),
        "{error:?}"
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
            .is_some_and(|r| r.contains("deactivated")),
        "{records}"
    );

    let asked = w.count(GENERATE_LINK_TOKEN_PATH);
    link_now(&w, id).await;
    assert_eq!(
        w.count(GENERATE_LINK_TOKEN_PATH),
        asked + 1,
        "a staff retry asks ABDM again"
    );
    let cleared: bool = sqlx::query_scalar(
        "SELECT abdm_deactivated_at IS NULL FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL")
        .bind(w.patient_id).fetch_one(&w.app.db).await.expect("link");
    assert!(cleared);
}
