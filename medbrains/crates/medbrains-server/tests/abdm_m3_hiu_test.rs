//! ABDM Milestone 3 (HIU) against a stand-in gateway and a mock HIP that
//! encrypts with Fidelius to our key, so the whole flow is proven before NHA
//! hands over keys: a doctor's consent request carries the right purpose,
//! record types and requester; a grant is fetched and answered with a
//! health-information request carrying our key material; a push decrypts to
//! bundles that are kept and notified; a bad checksum is refused; revocation
//! hides and erases; a forged JWT is 401; staff without the permissions 403.

mod abdm_hip_world;
mod common;

use abdm_hip_world::{Call, World, world};
use axum::http::StatusCode;
use chrono::{Duration, Utc};
use medbrains_abdm::gateway as paths;
use openssl::{pkey::PKey, rsa::Rsa};
use serde_json::{Map, Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const DOCTOR: &str = "Dr. Asha Rao";

fn header(c: &Call, name: &str) -> Option<String> {
    c.headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
}

/// The admin is the requesting doctor: a doctor profile with an HPR ID.
async fn with_hpr(w: &World) -> String {
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

/// A gateway callback to the HIU side, named by `X-HIU-ID`.
async fn hiu_callback(w: &World, path: &str, key: &[u8], body: Value) -> StatusCode {
    let jwt =
        medbrains_crypto::jws::sign_rs256(Map::new(), std::time::Duration::from_secs(60), key)
            .expect("sign");
    let resp = reqwest::Client::new()
        .post(w.app.url(path))
        .bearer_auth(jwt)
        .header("REQUEST-ID", Uuid::new_v4().to_string())
        .header("X-HIU-ID", &w.hip_id)
        .json(&body)
        .send()
        .await
        .expect("callback");
    StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

async fn raise(w: &World) -> Value {
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
async fn accepted(w: &World) -> String {
    raise(w).await;
    let init = w.last(paths::CONSENT_INIT_PATH);
    let consent_request = format!("cr-{}", Uuid::new_v4());
    let body = json!({ "consentRequest": { "id": consent_request },
                       "response": { "requestId": header(&init, "request-id") } });
    let status = hiu_callback(w, paths::CB_HIU_CONSENT_ON_INIT, &w.gateway_key, body).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    consent_request
}

struct Granted {
    consent_request: String,
    artefact: String,
    hi_request: Call,
}

/// The patient grants; the artefact is fetched and answered with a
/// health-information request; ABDM acknowledges it as `txn-hiu`.
async fn granted(w: &World) -> Granted {
    let consent_request = accepted(w).await;
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

    let on_fetch = json!({ "consent": { "status": "GRANTED", "signature": "sig", "consentDetail": {
        "consentId": artefact, "hip": { "id": "OTHER-HIP", "name": "City Hospital" },
        "hiu": { "id": w.hip_id }, "patient": { "id": w.address },
        "hiTypes": ["OPConsultation", "Invoice"],
        "careContexts": [{ "patientReference": "P1", "careContextReference": "OPC-REMOTE-1" }],
        "permission": { "accessMode": "VIEW", "dateRange": { "from": "2000-01-01T00:00:00.000Z",
            "to": "2100-01-01T00:00:00.000Z" }, "dataEraseAt": "2100-01-01T00:00:00.000Z" } } },
        "response": { "requestId": header(&fetch, "request-id") } });
    let status = hiu_callback(w, paths::CB_HIU_CONSENT_ON_FETCH, &w.gateway_key, on_fetch).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let hi_request = w.last(paths::HIU_HI_REQUEST_PATH);
    let on_request = json!({ "hiRequest": { "transactionId": "txn-hiu", "sessionStatus": "ACKNOWLEDGED" },
                             "response": { "requestId": header(&hi_request, "request-id") } });
    let status = hiu_callback(w, paths::CB_HIU_HI_ON_REQUEST, &w.gateway_key, on_request).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    Granted {
        consent_request,
        artefact,
        hi_request,
    }
}

/// The HIP's push: `entries` of (bundle, checksum override) encrypted to us.
async fn push(
    w: &World,
    g: &Granted,
    page: (i64, i64),
    txn: &str,
    entries: &[(Value, Option<&str>)],
) -> u16 {
    let km = &g.hi_request.body["hiRequest"]["keyMaterial"];
    let (ours, nonce) = (
        km["dhPublicKey"]["keyValue"].as_str().expect("our key"),
        km["nonce"].as_str().expect("our nonce"),
    );
    let hip = medbrains_crypto::fidelius::generate().expect("hip keys");
    let entries: Vec<Value> = entries
        .iter()
        .map(|(bundle, sum)| {
            let plain = bundle.to_string();
            let checksum = sum.map_or_else(|| medbrains_crypto::fidelius::checksum(&plain).expect("md5"), str::to_owned);
            json!({ "content": medbrains_crypto::fidelius::encrypt(&plain, &hip, ours, nonce).expect("encrypt"),
                    "media": "application/fhir+json", "checksum": checksum,
                    "careContextReference": "OPC-REMOTE-1" })
        })
        .collect();
    let url = g.hi_request.body["hiRequest"]["dataPushUrl"]
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

fn consult(note: &str) -> Value {
    json!({ "resourceType": "Bundle", "type": "document", "entry": [{ "resource": {
        "resourceType": "Composition", "date": "2024-06-01", "title": note,
        "meta": { "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"] } } }] })
}

async fn received(w: &World) -> Value {
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

/// Given a doctor with an HPR ID and a patient with a verified ABHA, When
/// the doctor requests the patient's records, Then ABDM receives the purpose,
/// record types, dates and the doctor's name and HPR ID, as our HIU; and
/// ABDM's on-init moves the request to waiting for the patient.
#[tokio::test]
async fn a_consent_request_carries_purpose_types_and_requester() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let hpr = with_hpr(&w).await;
    let row = raise(&w).await;
    assert_eq!(row["status"], "requested", "{row}");
    let init = w.last(paths::CONSENT_INIT_PATH);
    assert_eq!(header(&init, "x-hiu-id"), Some(w.hip_id.clone()));
    assert!(header(&init, "x-hip-id").is_none());
    let c = &init.body["consent"];
    assert_eq!(c["purpose"]["code"], "CAREMGT");
    assert_eq!(c["purpose"]["text"], "Care Management");
    assert_eq!(c["hiTypes"], json!(["OPConsultation"]));
    assert_eq!(c["patient"]["id"], w.address.as_str());
    assert_eq!(c["hiu"]["id"], w.hip_id.as_str());
    assert_eq!(c["requester"]["name"], DOCTOR);
    assert_eq!(c["requester"]["identifier"]["value"], hpr.as_str());
    assert_eq!(c["permission"]["accessMode"], "VIEW");
    assert!(
        c["permission"]["dataEraseAt"]
            .as_str()
            .is_some_and(|t| t.ends_with('Z'))
    );

    let body = json!({ "consentRequest": { "id": "cr-1" },
                       "response": { "requestId": header(&init, "request-id") } });
    let status = hiu_callback(&w, paths::CB_HIU_CONSENT_ON_INIT, &w.gateway_key, body).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let view = received(&w).await;
    assert_eq!(view["requests"][0]["status"], "awaiting_patient", "{view}");
}

/// Given the patient grants, Then the artefact is fetched and a
/// health-information request goes out with our Fidelius key material and
/// push URL, narrowed to what was asked; the HIP's push decrypts to a bundle
/// that is kept and notified OK; a page with a bad checksum is refused and
/// notified ERRORED; a push under another transaction is 401; and when the
/// patient revokes, the records vanish from the screen and are erased.
#[tokio::test]
async fn a_grant_brings_records_and_revocation_erases_them() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let g = granted(&w).await;
    let hi = &g.hi_request.body["hiRequest"];
    assert_eq!(header(&g.hi_request, "x-hiu-id"), Some(w.hip_id.clone()));
    assert_eq!(hi["consent"]["id"], g.artefact.as_str());
    assert_eq!(hi["keyMaterial"]["cryptoAlg"], "ECDH");
    assert_eq!(hi["keyMaterial"]["curve"], "Curve25519");
    assert!(
        hi["keyMaterial"]["dhPublicKey"]["keyValue"]
            .as_str()
            .is_some_and(|k| !k.is_empty())
    );
    assert!(
        hi["dataPushUrl"]
            .as_str()
            .is_some_and(|u| u.starts_with("https://hospital.test/api/v3/hiu/data/push?ref="))
    );
    assert_ne!(
        hi["dateRange"]["to"], "2100-01-01T00:00:00.000Z",
        "never wider than asked"
    );
    let sealed: Option<String> = sqlx::query_scalar(
        "SELECT key_material_sealed FROM abdm_consent_artefacts WHERE consent_id = $1",
    )
    .bind(&g.artefact)
    .fetch_one(&w.app.db)
    .await
    .expect("key");
    assert!(
        sealed.is_some_and(|s| !s.contains(hi["keyMaterial"]["nonce"].as_str().unwrap_or("-")))
    );

    assert_eq!(
        push(
            &w,
            &g,
            (0, 2),
            "txn-hiu",
            &[(consult("Fever review"), None)]
        )
        .await,
        202
    );
    let notice = w.last(paths::HI_NOTIFY_PATH).body["notification"].clone();
    assert_eq!(notice["notifier"]["type"], "HIU");
    assert_eq!(notice["statusNotification"]["sessionStatus"], "TRANSFERRED");
    assert_eq!(
        notice["statusNotification"]["statusResponses"][0]["hiStatus"],
        "OK"
    );
    let view = received(&w).await;
    let record = &view["records"][0];
    assert_eq!(record["source_hip_name"], "City Hospital", "{view}");
    assert_eq!(record["hi_type"], "OPConsultation");
    assert_eq!(record["title"], "Fever review");
    let id = record["id"].as_str().expect("id").to_owned();
    let one = w
        .app
        .client
        .get(w.app.url(&format!("/api/abdm/received-records/{id}")));
    let one: Value = one
        .send()
        .await
        .expect("record")
        .json()
        .await
        .expect("json");
    assert_eq!(one["bundle"]["type"], "document");

    assert_eq!(
        push(&w, &g, (0, 2), "txn-other", &[(consult("x"), None)]).await,
        401
    );
    let bad = [(
        consult("Tampered"),
        Some("00000000000000000000000000000000"),
    )];
    assert_eq!(push(&w, &g, (1, 2), "txn-hiu", &bad).await, 400);
    let notice = w.last(paths::HI_NOTIFY_PATH).body["notification"].clone();
    assert_eq!(
        notice["statusNotification"]["statusResponses"][0]["hiStatus"],
        "ERRORED"
    );
    let kept: i64 =
        sqlx::query_scalar("SELECT count(*) FROM abdm_received_records WHERE patient_id = $1")
            .bind(w.patient_id)
            .fetch_one(&w.app.db)
            .await
            .expect("count");
    assert_eq!(kept, 1, "the tampered entry is not stored");

    let revoke = json!({ "notification": { "consentRequestId": g.consent_request, "status": "REVOKED",
                         "consentArtefacts": [{ "id": g.artefact }] } });
    let status = hiu_callback(&w, paths::CB_HIU_CONSENT_NOTIFY, &w.gateway_key, revoke).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let view = received(&w).await;
    assert_eq!(view["records"], json!([]), "{view}");
    assert_eq!(view["requests"][0]["status"], "revoked");
    let gone = w
        .app
        .client
        .get(w.app.url(&format!("/api/abdm/received-records/{id}")))
        .send()
        .await
        .expect("get");
    assert_eq!(gone.status().as_u16(), 404);
    let (bundle, reason): (Option<Value>, Option<String>) = sqlx::query_as(
        "SELECT bundle, purge_reason FROM abdm_received_records WHERE id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&w.app.db)
    .await
    .expect("row");
    assert!(bundle.is_none(), "the content itself is erased");
    assert_eq!(reason.as_deref(), Some("revoked"));
}

/// Given a callback signed by anyone but the gateway, or a push naming no
/// artefact of ours, Then both are 401 and nothing changes.
#[tokio::test]
async fn forged_callbacks_and_stray_pushes_are_refused() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let forged = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    let forged = forged.private_key_to_pem_pkcs8().expect("pem");
    let notify = json!({ "notification": { "consentRequestId": "cr-x", "status": "GRANTED",
                         "consentArtefacts": [{ "id": "a-x" }] } });
    let status = hiu_callback(&w, paths::CB_HIU_CONSENT_NOTIFY, &forged, notify).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    for path in [
        paths::HIU_DATA_PUSH_PATH.to_owned(),
        format!("{}?ref={}", paths::HIU_DATA_PUSH_PATH, Uuid::new_v4()),
    ] {
        let r = reqwest::Client::new()
            .post(w.app.url(&path))
            .json(&json!({ "transactionId": "t", "entries": [] }))
            .send()
            .await
            .expect("push");
        assert_eq!(r.status().as_u16(), 401, "{path}");
    }
}

/// Given staff without the HIU permissions, Then requesting is 403 for a
/// nurse (who may view), and viewing is 403 for the front desk.
#[tokio::test]
async fn requesting_and_viewing_need_their_permissions() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let r = nurse
        .client
        .post(w.app.url(&format!(
            "/api/abdm/patients/{}/consent-requests",
            w.patient_id
        )))
        .header("x-csrf-token", &nurse.csrf)
        .json(
            &json!({ "purpose_code": "CAREMGT", "hi_types": ["OPConsultation"],
            "date_from": "2020-01-01T00:00:00Z", "date_to": "2024-01-01T00:00:00Z",
            "data_erase_at": (Utc::now() + Duration::days(30)).to_rfc3339() }),
        )
        .send()
        .await
        .expect("raise");
    assert_eq!(
        r.status().as_u16(),
        403,
        "viewing does not grant requesting"
    );
    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let paths = [
        format!("/api/abdm/patients/{}/received-records", w.patient_id),
        format!("/api/abdm/received-records/{}", Uuid::new_v4()),
    ];
    for path in &paths {
        let r = desk.client.get(w.app.url(path)).send().await.expect("get");
        assert_eq!(r.status().as_u16(), 403, "{path}");
    }
    let r = w
        .app
        .client
        .get(w.app.url(&paths[0]))
        .send()
        .await
        .expect("admin");
    assert_eq!(r.status().as_u16(), 200);
}
