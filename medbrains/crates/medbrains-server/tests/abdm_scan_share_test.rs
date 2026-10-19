//! ABDM Scan & Share against a stand-in gateway: JWT required, one token per
//! share, a verified ABHA matches its patient, a new patient is registered
//! from a share, unattended shares expire on read, and the permissions.

mod abdm_hip_world;
mod common;

use abdm_hip_world::{World, world};
use axum::http::StatusCode;
use medbrains_abdm::scan_share::{CB_PROFILE_SHARE, ON_SHARE_PATH};
use openssl::{pkey::PKey, rsa::Rsa};
use serde_json::{Map, Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A registration counter (a Reception station) with a fresh code.
async fn counter(w: &World) -> (Uuid, String) {
    let code = format!("REG-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let id = sqlx::query_scalar(
        "INSERT INTO stations (tenant_id, code, name, station_type) \
         SELECT tenant_id, $1, 'Registration 1', 'reception' FROM users WHERE username = 'admin' \
         RETURNING id",
    )
    .bind(&code)
    .fetch_one(&w.app.db)
    .await
    .expect("station");
    (id, code)
}

fn new_abha() -> (String, String) {
    let n = Uuid::new_v4().as_u128();
    (
        format!("91{:012}", n % 1_000_000_000_000),
        format!("anil.{}@sbx", n % 1_000_000),
    )
}

fn body(code: &str, number: &str, address: &str) -> Value {
    json!({
        "intent": "PROFILE_SHARE",
        "metaData": { "context": code },
        "profile": { "patient": {
            "abhaNumber": number, "abhaAddress": address, "name": "Anil Kumar Rao",
            "gender": "M", "dayOfBirth": "5", "monthOfBirth": "6", "yearOfBirth": "1980",
            "phoneNumber": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "address": { "line": "4 Station Road", "district": "Pune", "state": "Maharashtra",
                         "pincode": "411001" },
        } },
    })
}

/// The share callback with a chosen `REQUEST-ID`, signed with `key`.
async fn share(w: &World, key: &[u8], request_id: &str, body: &Value) -> StatusCode {
    let jwt =
        medbrains_crypto::jws::sign_rs256(Map::new(), std::time::Duration::from_secs(60), key)
            .expect("sign");
    let resp = reqwest::Client::new()
        .post(w.app.url(CB_PROFILE_SHARE))
        .bearer_auth(jwt)
        .header("REQUEST-ID", request_id)
        .header("X-HIP-ID", &w.hip_id)
        .json(body)
        .send()
        .await
        .expect("share");
    StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, sqlx::FromRow)]
struct Row {
    id: Uuid,
    status: String,
    token_number: Option<String>,
    patient_id: Option<Uuid>,
    token_id: Option<Uuid>,
}

async fn rows(w: &World, address: &str) -> Vec<Row> {
    sqlx::query_as(
        "SELECT id, status, token_number, patient_id, token_id FROM abdm_profile_shares \
          WHERE abha_address = $1 ORDER BY created_at",
    )
    .bind(address)
    .fetch_all(&w.app.db)
    .await
    .expect("shares")
}

async fn post(w: &World, path: &str, body: &Value) -> reqwest::Response {
    w.app
        .client
        .post(w.app.url(path))
        .header("x-csrf-token", &w.csrf)
        .json(body)
        .send()
        .await
        .expect("post")
}

/// Given a share signed with a key that is not the gateway's, Then it is 401
/// and nothing is stored. Given a new ABHA shared at a counter, Then a token
/// is issued in that counter's registration queue and `on-share` carries it;
/// the same request again, or the same ABHA scanning again while waiting,
/// gets the same token.
#[tokio::test]
async fn a_share_gets_one_token_and_on_share_carries_it() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (station, code) = counter(&w).await;
    let (number, address) = new_abha();
    let share_body = body(&code, &number, &address);
    let request = Uuid::new_v4().to_string();
    let forged = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    let forged = forged.private_key_to_pem_pkcs8().expect("pem");
    let refused = share(&w, &forged, &request, &share_body).await;
    assert_eq!(refused, StatusCode::UNAUTHORIZED);
    assert!(
        rows(&w, &address).await.is_empty(),
        "a forged share stores nothing"
    );
    let request = Uuid::new_v4().to_string();
    assert_eq!(
        share(&w, &w.gateway_key, &request, &share_body).await,
        StatusCode::ACCEPTED
    );
    let first = rows(&w, &address).await;
    assert_eq!(first.len(), 1);
    assert_eq!(first[0].status, "waiting");
    assert_eq!(first[0].patient_id, None, "a new ABHA matches nobody");
    let token = first[0].token_number.clone().expect("token number");
    let answer = w.last(ON_SHARE_PATH);
    assert_eq!(
        answer.body["acknowledgement"]["profile"]["tokenNumber"],
        token.as_str()
    );
    assert_eq!(
        answer.body["acknowledgement"]["profile"]["context"],
        code.as_str()
    );
    assert_eq!(answer.body["acknowledgement"]["status"], "SUCCESS");
    let hip = answer.headers.get("x-hip-id").and_then(|v| v.to_str().ok());
    assert_eq!(hip, Some(w.hip_id.as_str()));
    let (module, scope_id): (String, Option<Uuid>) =
        sqlx::query_as("SELECT module, scope_id FROM tokens WHERE id = $1")
            .bind(first[0].token_id.expect("token id"))
            .fetch_one(&w.app.db)
            .await
            .expect("token");
    assert_eq!((module.as_str(), scope_id), ("registration", Some(station)));

    assert_eq!(
        share(&w, &w.gateway_key, &request, &share_body).await,
        StatusCode::ACCEPTED
    );
    assert_eq!(
        share(&w, &w.gateway_key, &Uuid::new_v4().to_string(), &share_body).await,
        StatusCode::ACCEPTED
    );
    let again = w.last(ON_SHARE_PATH);
    assert_eq!(
        again.body["acknowledgement"]["profile"]["tokenNumber"],
        token.as_str()
    );
    assert_eq!(
        rows(&w, &address).await.len(),
        1,
        "no second share, no second token"
    );
    let tokens: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tokens WHERE entity_type = 'abdm_profile_share' AND entity_id = $1",
    )
    .bind(first[0].id)
    .fetch_one(&w.app.db)
    .await
    .expect("count");
    assert_eq!(tokens, 1);
}

/// Given the ABHA verified-linked to a patient here, Then the share and its
/// token name that patient, and the desk's queue shows their UHID.
#[tokio::test]
async fn a_known_abha_matches_its_patient() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, code) = counter(&w).await;
    let status = share(
        &w,
        &w.gateway_key,
        &Uuid::new_v4().to_string(),
        &body(&code, "", &w.address),
    )
    .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let row = rows(&w, &w.address).await.pop().expect("share");
    assert_eq!(row.patient_id, Some(w.patient_id));
    let token_patient: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM tokens WHERE id = $1")
            .bind(row.token_id.expect("token"))
            .fetch_one(&w.app.db)
            .await
            .expect("token");
    assert_eq!(token_patient, Some(w.patient_id));
    let queue: Value = w
        .app
        .client
        .get(w.app.url("/api/abdm/scan-share/queue"))
        .send()
        .await
        .expect("queue")
        .json()
        .await
        .expect("json");
    let mine = queue
        .as_array()
        .and_then(|q| q.iter().find(|s| s["id"] == row.id.to_string()))
        .expect("listed");
    assert_eq!(mine["patient_uhid"], w.uhid.as_str());
    let opened = post(
        &w,
        &format!("/api/abdm/scan-share/{}/complete", row.id),
        &json!({ "patient_id": w.patient_id }),
    )
    .await;
    assert_eq!(opened.status().as_u16(), 200);
    assert_eq!(
        rows(&w, &w.address).await.pop().expect("share").status,
        "linked"
    );
}

/// Given a new patient's share, When the desk records it as verified and
/// registers the patient with it, Then the ABHA is linked as verified by
/// Scan & Share, the share is "registered" and its token names the patient;
/// another patient is refused.
#[tokio::test]
async fn a_new_patient_is_registered_from_a_share() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, code) = counter(&w).await;
    let (number, address) = new_abha();
    let shared = body(&code, &number, &address);
    assert_eq!(
        share(&w, &w.gateway_key, &Uuid::new_v4().to_string(), &shared).await,
        StatusCode::ACCEPTED
    );
    let row = rows(&w, &address).await.pop().expect("share");
    let step: Value = post(
        &w,
        &format!("/api/abdm/scan-share/{}/verification", row.id),
        &json!({}),
    )
    .await
    .json()
    .await
    .expect("step");
    assert_eq!(step["stage"], "verified");
    assert_eq!(step["profile"]["first_name"], "Anil");
    assert!(step["already_linked"].is_null());

    let wrong = post(
        &w,
        &format!("/api/abdm/scan-share/{}/complete", row.id),
        &json!({ "patient_id": w.patient_id }),
    )
    .await;
    assert_eq!(
        wrong.status().as_u16(),
        400,
        "only the patient the ABHA was linked to"
    );

    let patient: Value = post(&w, "/api/patients", &json!({
        "first_name": "Anil", "last_name": "Rao", "gender": "male", "date_of_birth": "1980-06-05",
        "phone": shared["profile"]["patient"]["phoneNumber"],
        "abha_number": number, "abha_verification_id": step["id"],
    }))
    .await
    .json()
    .await
    .expect("patient");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("id")).expect("uuid");
    let method: Option<String> = sqlx::query_scalar(
        "SELECT verification_method FROM patient_abha_links WHERE patient_id = $1 AND verified_at IS NOT NULL",
    )
    .bind(patient_id)
    .fetch_one(&w.app.db)
    .await
    .expect("link");
    assert_eq!(method.as_deref(), Some("scan_share"));

    let done = post(
        &w,
        &format!("/api/abdm/scan-share/{}/complete", row.id),
        &json!({ "patient_id": patient_id }),
    )
    .await;
    assert_eq!(done.status().as_u16(), 200);
    let after = rows(&w, &address).await.pop().expect("share");
    assert_eq!(
        (after.status.as_str(), after.patient_id),
        ("registered", Some(patient_id))
    );
    let token_patient: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM tokens WHERE id = $1")
            .bind(after.token_id.expect("token"))
            .fetch_one(&w.app.db)
            .await
            .expect("token");
    assert_eq!(token_patient, Some(patient_id));
}

/// Given a share left waiting past its expiry, When the desk reads the
/// queue, Then it is expired; dismissing it cancels its token.
#[tokio::test]
async fn an_unattended_share_expires_and_can_be_dismissed() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, code) = counter(&w).await;
    let (number, address) = new_abha();
    assert_eq!(
        share(
            &w,
            &w.gateway_key,
            &Uuid::new_v4().to_string(),
            &body(&code, &number, &address)
        )
        .await,
        StatusCode::ACCEPTED
    );
    let row = rows(&w, &address).await.pop().expect("share");
    sqlx::query(
        "UPDATE abdm_profile_shares SET expires_at = now() - interval '1 minute' WHERE id = $1",
    )
    .bind(row.id)
    .execute(&w.app.db)
    .await
    .expect("age");
    assert_eq!(
        rows(&w, &address).await[0].status,
        "waiting",
        "nothing expires on its own"
    );
    let listed = w
        .app
        .client
        .get(w.app.url("/api/abdm/scan-share/queue"))
        .send()
        .await
        .expect("queue");
    assert_eq!(listed.status().as_u16(), 200);
    assert_eq!(rows(&w, &address).await[0].status, "expired");

    let dismissed = post(
        &w,
        &format!("/api/abdm/scan-share/{}/dismiss", row.id),
        &json!({}),
    )
    .await;
    assert_eq!(dismissed.status().as_u16(), 200);
    assert_eq!(rows(&w, &address).await[0].status, "dismissed");
    let token_status: String = sqlx::query_scalar("SELECT status FROM tokens WHERE id = $1")
        .bind(row.token_id.expect("token"))
        .fetch_one(&w.app.db)
        .await
        .expect("token");
    assert_eq!(token_status, "cancelled");
    let again = post(
        &w,
        &format!("/api/abdm/scan-share/{}/dismiss", row.id),
        &json!({}),
    )
    .await;
    assert_eq!(again.status().as_u16(), 409);
}

/// Given staff without `abdm.scanshare.view`, Then the queue and its actions
/// are 403; the desk sees the queue but not the counters' QR codes, which an
/// administrator does, naming the HIP ID and the counter.
#[tokio::test]
async fn the_screens_need_their_permissions() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (station, code) = counter(&w).await;
    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let r = nurse
        .client
        .get(w.app.url("/api/abdm/scan-share/queue"))
        .send()
        .await
        .expect("get");
    assert_eq!(r.status().as_u16(), 403);
    let r = nurse
        .client
        .post(
            w.app
                .url(&format!("/api/abdm/scan-share/{}/dismiss", Uuid::new_v4())),
        )
        .header("x-csrf-token", &nurse.csrf)
        .send()
        .await
        .expect("dismiss");
    assert_eq!(r.status().as_u16(), 403);

    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let r = desk
        .client
        .get(w.app.url("/api/abdm/scan-share/queue"))
        .send()
        .await
        .expect("queue");
    assert_eq!(r.status().as_u16(), 200);
    let r = desk
        .client
        .get(w.app.url("/api/abdm/scan-share/counters"))
        .send()
        .await
        .expect("qr");
    assert_eq!(r.status().as_u16(), 403);

    let counters: Value = w
        .app
        .client
        .get(w.app.url("/api/abdm/scan-share/counters"))
        .send()
        .await
        .expect("counters")
        .json()
        .await
        .expect("json");
    let mine = counters["counters"]
        .as_array()
        .and_then(|c| c.iter().find(|c| c["station_id"] == station.to_string()))
        .expect("listed");
    let payload = mine["qr_codes"]
        .as_array()
        .and_then(|q| q.iter().find(|q| q["hip_id"] == w.hip_id.as_str()))
        .and_then(|q| q["payload"].as_str())
        .expect("payload");
    assert!(
        payload.contains(&format!("hip-id={}", w.hip_id)),
        "{payload}"
    );
    assert!(payload.contains(&format!("counter-id={code}")), "{payload}");
}
