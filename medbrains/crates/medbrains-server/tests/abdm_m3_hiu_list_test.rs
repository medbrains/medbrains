//! ABDM M3 (HIU) consent list (#5714, HIU_FLOW_104, 106, 301): every row
//! names the ABHA number and address; once ABDM sends the artefact, the scope
//! shown is the one the patient granted, not the one asked for; a request
//! nobody answered reads Expired at its expiry without waiting for ABDM, and
//! ABDM's later word still applies; the hospital-wide list filters by status
//! and needs its own permission.

use crate::abdm_hip_world;
use crate::common;

use abdm_hip_world::{
    World,
    hiu::{
        accept_last, accepted, hiu_callback, notify_granted, on_fetch_granting, raise_for, with_hpr,
    },
    world,
};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use medbrains_abdm::gateway as paths;
use serde_json::{Value, json};

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn list(w: &World, query: &str) -> Value {
    let r = w
        .app
        .client
        .get(
            w.app
                .url(&format!("/api/abdm/consent-requests?limit=200{query}")),
        )
        .send()
        .await
        .expect("list");
    assert_eq!(r.status().as_u16(), 200);
    r.json().await.expect("json")
}

/// The row for ABDM's consent-request id `cr`, from the hospital-wide list.
async fn row_of(w: &World, query: &str, cr: &str) -> Option<Value> {
    let id: uuid::Uuid =
        sqlx::query_scalar("SELECT id FROM abdm_consent_requests WHERE consent_request_id = $1")
            .bind(cr)
            .fetch_one(&w.app.db)
            .await
            .expect("request");
    let page = list(w, query).await;
    page["data"]
        .as_array()
        .expect("data")
        .iter()
        .find(|r| r["id"] == id.to_string())
        .cloned()
}

fn at(v: &Value) -> DateTime<Utc> {
    v.as_str().expect("time").parse().expect("rfc3339")
}

/// Given a request for OP consultations and prescriptions, When the patient
/// grants only OP consultations for 2022, Then the list shows the ABHA
/// number and address, the asked scope until the artefact arrives, and then
/// the granted scope — with the grant time — beside the asked one.
#[tokio::test]
async fn the_list_shows_the_abha_and_the_scope_granted() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    raise_for(&w, &["OPConsultation", "Prescription"]).await;
    let cr = accept_last(&w).await;
    let artefact = notify_granted(&w, &cr).await;
    let row = row_of(&w, "", &cr).await.expect("listed");
    assert_eq!(row["abha_address"], w.address.as_str(), "{row}");
    assert!(
        row["abha_number"].as_str().is_some_and(|n| !n.is_empty()),
        "{row}"
    );
    assert_eq!(row["uhid"], w.uhid.as_str());
    assert_eq!(row["status"], "granted");
    assert!(row["granted_at"].is_string());
    assert_eq!(
        row["granted_hi_types"],
        Value::Null,
        "not known before on-fetch"
    );

    let permission = json!({ "accessMode": "VIEW", "dateRange": { "from": "2022-01-01T00:00:00.000Z",
        "to": "2022-12-31T00:00:00.000Z" }, "dataEraseAt": "2030-01-01T00:00:00.000Z" });
    on_fetch_granting(&w, &artefact, &["OPConsultation"], permission).await;
    let row = row_of(&w, "&status=granted", &cr).await.expect("listed");
    assert_eq!(row["granted_hi_types"], json!(["OPConsultation"]), "{row}");
    assert_eq!(row["hi_types"], json!(["OPConsultation", "Prescription"]));
    assert_eq!(at(&row["granted_from"]), at(&json!("2022-01-01T00:00:00Z")));
    assert_eq!(at(&row["granted_to"]), at(&json!("2022-12-31T00:00:00Z")));
}

/// Given a request the patient never answered, When its expiry passes, Then
/// it lists as Expired at the expiry time — under the expired filter and not
/// the waiting one — while the stored status is untouched; and a later
/// answer from ABDM still applies.
#[tokio::test]
async fn an_unanswered_request_expires_at_its_expiry_without_abdm() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let cr = accepted(&w).await;
    let expiry: DateTime<Utc> = sqlx::query_scalar(
        "UPDATE abdm_consent_requests SET requested_at = now() - interval '10 minutes', \
                data_erase_at = date_trunc('second', now()) - interval '1 minute' \
          WHERE consent_request_id = $1 RETURNING data_erase_at",
    )
    .bind(&cr)
    .fetch_one(&w.app.db)
    .await
    .expect("expire");
    let row = row_of(&w, "&status=expired", &cr)
        .await
        .expect("listed as expired");
    assert_eq!(row["status"], "expired", "{row}");
    assert_eq!(
        at(&row["status_at"]),
        expiry,
        "the expiry is the time shown"
    );
    assert!(row_of(&w, "&status=awaiting_patient", &cr).await.is_none());
    let stored: String = sqlx::query_scalar(
        "SELECT status FROM abdm_consent_requests WHERE consent_request_id = $1",
    )
    .bind(&cr)
    .fetch_one(&w.app.db)
    .await
    .expect("status");
    assert_eq!(stored, "awaiting_patient", "derived on read, never written");

    let denied = json!({ "notification": { "consentRequestId": cr, "status": "DENIED",
                         "consentArtefacts": [] } });
    let status = hiu_callback(&w, paths::CB_HIU_CONSENT_NOTIFY, &w.gateway_key, denied).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let row = row_of(&w, "", &cr).await.expect("listed");
    assert_eq!(row["status"], "denied", "ABDM's answer wins: {row}");
}

/// Given staff without `abdm.consent.list`, Then the hospital-wide list is
/// 403 — for a nurse who may view a patient's requests, and for the front
/// desk; an unknown status is 400.
#[tokio::test]
async fn the_hospital_wide_list_needs_its_permission() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    for role in ["nurse", "receptionist"] {
        let staff = common::provision_staff(&w.app, &w.csrf, role, &[]).await;
        let r = staff
            .client
            .get(w.app.url("/api/abdm/consent-requests"))
            .send()
            .await
            .expect("get");
        assert_eq!(r.status().as_u16(), 403, "{role}");
    }
    let r = w
        .app
        .client
        .get(w.app.url("/api/abdm/consent-requests?status=pending"))
        .send()
        .await
        .expect("get");
    assert_eq!(r.status().as_u16(), 400);
}
