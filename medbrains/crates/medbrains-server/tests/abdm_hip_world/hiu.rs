//! Steps of the ABDM M3 (HIU) flow the HIU tests share: a doctor with an
//! HPR ID raises a request, ABDM accepts it, the patient grants it, the
//! artefact is fetched and answered with a health-information request, and
//! a mock HIP pushes records encrypted to our key.

use std::{
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex},
};

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use medbrains_abdm::gateway as paths;
use medbrains_crypto::fidelius::{self, KeyMaterial};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::{Call, Hook, World};

type BoxedFuture = Pin<Box<dyn Future<Output = ()> + Send>>;

pub const DOCTOR: &str = "Dr. Asha Rao";
/// The care context the mock HIP's grant covers.
pub const REMOTE_CONTEXT: &str = "OPC-REMOTE-1";

pub fn header(c: &Call, name: &str) -> Option<String> {
    c.headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
}

/// The admin is the requesting doctor: a doctor profile with an HPR ID.
pub async fn with_hpr(w: &World) -> String {
    let n = Uuid::new_v4().as_u128() % 1_000_000_000_000;
    let hpr = format!(
        "71-{:04}-{:04}-{:04}",
        n / 100_000_000,
        (n / 10_000) % 10_000,
        n % 10_000
    );
    sqlx::query(
        "INSERT INTO doctor_profiles (tenant_id, user_id, display_name, hpr_id) \
         SELECT tenant_id, id, $1, $2 FROM users WHERE username = 'admin' \
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET display_name = $1, hpr_id = $2",
    )
    .bind(DOCTOR)
    .bind(&hpr)
    .execute(&w.app.db)
    .await
    .expect("doctor profile");
    hpr
}

async fn signed_callback(url: String, hiu_id: &str, key: &[u8], body: Value) -> StatusCode {
    let jwt =
        medbrains_crypto::jws::sign_rs256(Map::new(), std::time::Duration::from_secs(60), key)
            .expect("sign");
    let resp = reqwest::Client::new()
        .post(url)
        .bearer_auth(jwt)
        .header("REQUEST-ID", Uuid::new_v4().to_string())
        .header("X-HIU-ID", hiu_id)
        .json(&body)
        .send()
        .await
        .expect("callback");
    StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

/// A gateway callback to the HIU side, named by `X-HIU-ID`.
pub async fn hiu_callback(w: &World, path: &str, key: &[u8], body: Value) -> StatusCode {
    signed_callback(w.app.url(path), &w.hip_id, key, body).await
}

/// ABDM answers each call to `trigger` at `callback` before the call
/// returns. Returns the statuses our server gave those answers.
pub fn answer_synchronously(
    w: &World,
    trigger: &str,
    callback: &str,
    answer: impl Fn(&Call) -> Value + Send + Sync + 'static,
) -> Arc<Mutex<Vec<StatusCode>>> {
    let statuses: Arc<Mutex<Vec<StatusCode>>> = Arc::default();
    let (url, hiu_id, key) = (w.app.url(callback), w.hip_id.clone(), w.gateway_key.clone());
    let (seen, answer) = (statuses.clone(), Arc::new(answer));
    let hook: Hook = Arc::new(move |call: Call| -> BoxedFuture {
        let (url, hiu_id, key, seen) = (url.clone(), hiu_id.clone(), key.clone(), seen.clone());
        let body = answer(&call);
        Box::pin(async move {
            let status = signed_callback(url, &hiu_id, &key, body).await;
            seen.lock().expect("statuses").push(status);
        })
    });
    w.on(trigger, hook);
    statuses
}

pub async fn raise(w: &World) -> Value {
    w.app
        .client
        .post(w.app.url(&format!(
            "/api/abdm/patients/{}/consent-requests",
            w.patient_id
        )))
        .header("x-csrf-token", &w.csrf)
        .json(
            &json!({ "purpose_code": "CAREMGT", "hi_types": ["OPConsultation"],
            "date_from": "2020-01-01T00:00:00Z", "date_to": Utc::now().to_rfc3339(),
            "data_erase_at": (Utc::now() + Duration::days(30)).to_rfc3339() }),
        )
        .send()
        .await
        .expect("raise")
        .json()
        .await
        .expect("json")
}

/// Raise and let ABDM accept it; returns ABDM's consent-request id.
pub async fn accepted(w: &World) -> String {
    raise(w).await;
    let init = w.last(paths::CONSENT_INIT_PATH);
    let consent_request = format!("cr-{}", Uuid::new_v4());
    let body = json!({ "consentRequest": { "id": consent_request },
                       "response": { "requestId": header(&init, "request-id") } });
    let status = hiu_callback(w, paths::CB_HIU_CONSENT_ON_INIT, &w.gateway_key, body).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    consent_request
}

pub struct Granted {
    pub consent_request: String,
    pub artefact: String,
    pub hi_request: Call,
}

/// The patient grants by `notify`; ABDM is acknowledged and the artefact
/// fetched. Returns the artefact id.
pub async fn notify_granted(w: &World, consent_request: &str) -> String {
    let artefact = Uuid::new_v4().to_string();
    let notify = json!({ "notification": { "consentRequestId": consent_request, "status": "GRANTED",
                         "consentArtefacts": [{ "id": artefact }] } });
    let status = hiu_callback(w, paths::CB_HIU_CONSENT_NOTIFY, &w.gateway_key, notify).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let ack = w.last(paths::CONSENT_HIU_ON_NOTIFY_PATH).body;
    assert_eq!(
        ack["acknowledgement"][0]["consentId"],
        artefact.as_str(),
        "{ack}"
    );
    let fetch = w.last(paths::CONSENT_FETCH_PATH);
    assert_eq!(fetch.body["consentId"], artefact.as_str());
    assert_eq!(header(&fetch, "x-hiu-id"), Some(w.hip_id.clone()));
    artefact
}

/// ABDM's on-fetch brings the artefact; returns the health-information
/// request it was answered with.
pub async fn on_fetch(w: &World, artefact: &str) -> Call {
    let fetch = w.last(paths::CONSENT_FETCH_PATH);
    let on_fetch = json!({ "consent": { "status": "GRANTED", "signature": "sig", "consentDetail": {
        "consentId": artefact, "hip": { "id": "OTHER-HIP", "name": "City Hospital" },
        "hiu": { "id": w.hip_id }, "patient": { "id": w.address },
        "hiTypes": ["OPConsultation", "Invoice"],
        "careContexts": [{ "patientReference": "P1", "careContextReference": REMOTE_CONTEXT }],
        "permission": { "accessMode": "VIEW", "dateRange": { "from": "2000-01-01T00:00:00.000Z",
            "to": "2100-01-01T00:00:00.000Z" }, "dataEraseAt": "2100-01-01T00:00:00.000Z" } } },
        "response": { "requestId": header(&fetch, "request-id") } });
    let status = hiu_callback(w, paths::CB_HIU_CONSENT_ON_FETCH, &w.gateway_key, on_fetch).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    w.last(paths::HIU_HI_REQUEST_PATH)
}

/// ABDM acknowledges the health-information request as `txn-hiu`.
pub async fn acknowledge(w: &World, hi_request: &Call) {
    let on_request = json!({ "hiRequest": { "transactionId": "txn-hiu", "sessionStatus": "ACKNOWLEDGED" },
                             "response": { "requestId": header(hi_request, "request-id") } });
    let status = hiu_callback(w, paths::CB_HIU_HI_ON_REQUEST, &w.gateway_key, on_request).await;
    assert_eq!(status, StatusCode::ACCEPTED);
}

/// The patient grants; the artefact is fetched and answered with a
/// health-information request; ABDM acknowledges it as `txn-hiu`.
pub async fn granted(w: &World) -> Granted {
    let consent_request = accepted(w).await;
    let artefact = notify_granted(w, &consent_request).await;
    let hi_request = on_fetch(w, &artefact).await;
    acknowledge(w, &hi_request).await;
    Granted {
        consent_request,
        artefact,
        hi_request,
    }
}

/// `plain` encrypted by `hip` to the key our request carried.
pub fn encrypt_to_us(hi_request: &Call, hip: &KeyMaterial, plain: &str) -> String {
    let km = &hi_request.body["hiRequest"]["keyMaterial"];
    let (ours, nonce) = (
        km["dhPublicKey"]["keyValue"].as_str().expect("our key"),
        km["nonce"].as_str().expect("our nonce"),
    );
    fidelius::encrypt(plain, hip, ours, nonce).expect("encrypt")
}

/// The HIP's push of `entries` already built, under `hip`'s key material.
pub async fn push_entries(
    w: &World,
    hi_request: &Call,
    (page, txn): ((i64, i64), &str),
    hip: &KeyMaterial,
    entries: Vec<Value>,
) -> u16 {
    let url = hi_request.body["hiRequest"]["dataPushUrl"]
        .as_str()
        .expect("push url");
    let path = url
        .strip_prefix("https://hospital.test")
        .expect("our public URL");
    let body = json!({ "pageNumber": page.0, "pageCount": page.1, "transactionId": txn, "entries": entries,
        "keyMaterial": { "cryptoAlg": "ECDH", "curve": "Curve25519", "nonce": hip.nonce,
            "dhPublicKey": { "expiry": "2100-01-01T00:00:00.000Z", "parameters": "Curve25519/32byte random key",
                             "keyValue": hip.public_key } } });
    reqwest::Client::new()
        .post(w.app.url(path))
        .json(&body)
        .send()
        .await
        .expect("push")
        .status()
        .as_u16()
}

/// The HIP's push: inline `entries` of (bundle, checksum override).
pub async fn push(
    w: &World,
    g: &Granted,
    page: (i64, i64),
    txn: &str,
    entries: &[(Value, Option<&str>)],
) -> u16 {
    let hip = fidelius::generate().expect("hip keys");
    let entries: Vec<Value> = entries
        .iter()
        .map(|(bundle, sum)| {
            let plain = bundle.to_string();
            let checksum =
                sum.map_or_else(|| fidelius::checksum(&plain).expect("md5"), str::to_owned);
            json!({ "content": encrypt_to_us(&g.hi_request, &hip, &plain),
                    "media": "application/fhir+json", "checksum": checksum,
                    "careContextReference": REMOTE_CONTEXT })
        })
        .collect();
    push_entries(w, &g.hi_request, (page, txn), &hip, entries).await
}

pub fn consult(note: &str) -> Value {
    json!({ "resourceType": "Bundle", "type": "document", "entry": [{ "resource": {
        "resourceType": "Composition", "date": "2024-06-01", "title": note,
        "meta": { "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"] } } }] })
}

pub async fn received(w: &World) -> Value {
    w.app
        .client
        .get(w.app.url(&format!(
            "/api/abdm/patients/{}/received-records",
            w.patient_id
        )))
        .send()
        .await
        .expect("view")
        .json()
        .await
        .expect("json")
}
