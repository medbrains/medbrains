//! ABDM Milestone 2 (HIP) against a stand-in gateway and HIU, so the whole
//! flow is proven before NHA hands over keys: a finalised record becomes a
//! care context; HIP-initiated linking sends the right headers, link token
//! and contexts; every callback needs the gateway's JWT and names its
//! hospital by `X-HIP-ID`; discovery finds the patient by ABHA; a consented
//! health-information request reaches the HIU as a Fidelius-encrypted NRCeS
//! bundle it can decrypt; staff without the permissions are refused.

use crate::abdm_hip_world;
use crate::common;

use abdm_hip_world::{Call, world};
use axum::http::StatusCode;
use openssl::{pkey::PKey, rsa::Rsa};
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Given a patient with a verified ABHA and a campus with an HFR ID, When an
/// OPD consultation is closed, Then a care context is captured and queued;
/// "Link now" asks ABDM for a link token, the token's callback links the
/// context with it, and ABDM's verdict marks it linked.
#[tokio::test]
async fn a_closed_consultation_is_captured_and_linked_hip_initiated() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let (id, status, _) = w.context(&reference).await;
    assert_eq!(status, "not_linked");
    let queued = w
        .app
        .outbox_rows("abdm.care_context.link", &id.to_string())
        .await;
    assert_eq!(queued.len(), 1, "linking is queued once");
    w.close_consultation().await; // a second record for the same patient
    sqlx::query("UPDATE encounters SET status = 'completed' WHERE id = $1")
        .bind(Uuid::parse_str(&reference[4..]).expect("id"))
        .execute(&w.app.db)
        .await
        .expect("again");
    let captured: i64 =
        sqlx::query_scalar("SELECT count(*) FROM abdm_care_contexts WHERE reference_number = $1")
            .bind(&reference)
            .fetch_one(&w.app.db)
            .await
            .expect("count");
    assert_eq!(captured, 1, "finalising again does not capture twice");

    let linked: Value = w
        .app
        .client
        .post(w.app.url(&format!("/api/abdm/care-contexts/{id}/link")))
        .header("x-csrf-token", &w.csrf)
        .send()
        .await
        .expect("link")
        .json()
        .await
        .expect("json");
    assert_eq!(linked["link_status"], "linking", "{linked}");
    let token_call = w.last(medbrains_abdm::gateway::GENERATE_LINK_TOKEN_PATH);
    let h = |c: &Call, n: &str| {
        c.headers
            .get(n)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned)
    };
    assert_eq!(
        h(&token_call, "authorization").as_deref(),
        Some("Bearer session-token")
    );
    assert_eq!(h(&token_call, "x-cm-id").as_deref(), Some("sbx"));
    assert_eq!(h(&token_call, "x-hip-id"), Some(w.hip_id.clone()));
    assert!(h(&token_call, "timestamp").is_some_and(|t| t.ends_with('Z')));
    assert_eq!(token_call.body["abhaAddress"], w.address.as_str());
    assert!(
        token_call.body["abhaNumber"].is_u64(),
        "ABHA number is sent as a number"
    );
    assert_eq!(token_call.body["yearOfBirth"], 1989);
    assert_eq!(token_call.body["gender"], "F");

    let request_id = h(&token_call, "request-id").expect("request id");
    let token = "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjQxMDI0NDQ4MDB9.sig";
    let status = w
        .callback(
            medbrains_abdm::gateway::CB_ON_GENERATE_TOKEN,
            &w.gateway_key,
            json!({ "abhaAddress": w.address, "linkToken": token, "response": { "requestId": request_id } }),
        )
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let stored: Option<String> =
        sqlx::query_scalar("SELECT linking_token FROM patient_abha_links WHERE patient_id = $1")
            .bind(w.patient_id)
            .fetch_one(&w.app.db)
            .await
            .expect("token");
    assert!(
        stored.is_some_and(|s| !s.contains(token)),
        "the link token is stored sealed"
    );
    let link = w.last(medbrains_abdm::gateway::LINK_CARE_CONTEXT_PATH);
    assert_eq!(h(&link, "x-link-token").as_deref(), Some(token));
    let entries = link.body["patient"].as_array().expect("patient[]");
    assert!(
        entries
            .iter()
            .all(|p| p["referenceNumber"] == w.uhid.as_str() && p["hiType"] == "OPConsultation")
    );
    let refs: Vec<&str> = entries
        .iter()
        .flat_map(|p| p["careContexts"].as_array().into_iter().flatten())
        .filter_map(|c| c["referenceNumber"].as_str())
        .collect();
    assert!(refs.contains(&reference.as_str()), "{refs:?}");
    assert_eq!(
        entries[0]["count"],
        entries[0]["careContexts"].as_array().map_or(0, Vec::len)
    );

    let link_request = h(&link, "request-id").expect("request id");
    let status = w
        .callback(
            medbrains_abdm::gateway::CB_ON_LINK_CARE_CONTEXT,
            &w.gateway_key,
            json!({ "abhaAddress": w.address, "status": "SUCCESS", "response": { "requestId": link_request } }),
        )
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let (_, status, via) = w.context(&reference).await;
    assert_eq!(
        (status.as_str(), via.as_deref()),
        ("linked", Some("hip_initiated"))
    );
}

/// Given the patient's PHR app, When it discovers through the gateway with a
/// valid JWT, Then the patient is found by ABHA address with their records;
/// a forged JWT is 401; the OTP sent to the registered mobile links them.
#[tokio::test]
async fn discovery_finds_the_patient_by_abha_and_links_with_the_otp() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let discover = json!({ "transactionId": "txn-d", "patient": { "id": w.address, "name": "Priya Varude",
        "gender": "F", "yearOfBirth": 1989, "verifiedIdentifiers": [] } });
    let forged = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    let forged = forged.private_key_to_pem_pkcs8().expect("pem");
    let path = medbrains_abdm::gateway::CB_DISCOVER;
    assert_eq!(
        w.callback(path, &forged, discover.clone()).await,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        w.callback(path, &w.gateway_key, discover).await,
        StatusCode::ACCEPTED
    );
    let answer = w.last(medbrains_abdm::gateway::ON_DISCOVER_PATH).body;
    assert_eq!(answer["transactionId"], "txn-d");
    assert_eq!(answer["matchedBy"][0], "ABHA_ADDRESS");
    assert_eq!(answer["patient"][0]["referenceNumber"], w.uhid.as_str());
    assert!(answer.to_string().contains(&reference));

    let unknown = json!({ "transactionId": "txn-x", "patient": { "id": "nobody@sbx", "name": "No One",
        "gender": "M", "yearOfBirth": 1970, "verifiedIdentifiers": [] } });
    assert_eq!(
        w.callback(path, &w.gateway_key, unknown).await,
        StatusCode::ACCEPTED
    );
    let answer = w.last(medbrains_abdm::gateway::ON_DISCOVER_PATH).body;
    assert_eq!(
        answer["error"]["code"], "ABDM-1010",
        "no one else's records: {answer}"
    );

    let init = json!({ "transactionId": "txn-d", "abhaAddress": w.address, "patient": [{
        "referenceNumber": w.uhid, "hiType": "OPConsultation", "count": 1,
        "careContexts": [{ "referenceNumber": reference }] }] });
    assert_eq!(
        w.callback(medbrains_abdm::gateway::CB_LINK_INIT, &w.gateway_key, init)
            .await,
        StatusCode::ACCEPTED
    );
    let link_ref =
        w.last(medbrains_abdm::gateway::ON_LINK_INIT_PATH).body["link"]["referenceNumber"]
            .as_str()
            .expect("link ref")
            .to_owned();
    let sms = w.app.outbox_rows("sms.abdm_link_otp", "").await;
    let otp: String = sms
        .last()
        .and_then(|p| p["body"].as_str())
        .expect("otp sms")
        .chars()
        .take(6)
        .collect();
    let confirm =
        |token: &str| json!({ "confirmation": { "linkRefNumber": link_ref, "token": token } });
    let path = medbrains_abdm::gateway::CB_LINK_CONFIRM;
    assert_eq!(
        w.callback(path, &w.gateway_key, confirm("000000")).await,
        StatusCode::ACCEPTED
    );
    assert_eq!(
        w.last(medbrains_abdm::gateway::ON_LINK_CONFIRM_PATH).body["error"]["code"],
        "ABDM-1035"
    );
    assert_eq!(
        w.callback(path, &w.gateway_key, confirm(&otp)).await,
        StatusCode::ACCEPTED
    );
    let (_, status, via) = w.context(&reference).await;
    assert_eq!(
        (status.as_str(), via.as_deref()),
        ("linked", Some("user_initiated"))
    );
}

/// Given a consent the patient granted, When the HIU asks for the records,
/// Then the push carries an OPConsultRecord bundle the HIU decrypts with its
/// own key, ABDM is told it was transferred, and the transfer is recorded.
#[tokio::test]
async fn a_consented_request_reaches_the_hiu_encrypted() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let consent_id = Uuid::new_v4().to_string();
    let notify = json!({ "notification": { "status": "GRANTED", "consentId": consent_id, "consentDetail": {
        "consentId": consent_id, "patient": { "id": w.address }, "hip": { "id": w.hip_id },
        "hiu": { "id": "HIU-1" }, "purpose": { "code": "CAREMGT", "text": "Care Management" },
        "hiTypes": ["OPConsultation"],
        "careContexts": [{ "patientReference": w.uhid, "careContextReference": reference }],
        "permission": { "accessMode": "VIEW", "dateRange": { "from": "2000-01-01T00:00:00.000Z",
            "to": "2100-01-01T00:00:00.000Z" }, "dataEraseAt": "2100-01-01T00:00:00.000Z" } } } });
    let path = medbrains_abdm::gateway::CB_CONSENT_NOTIFY;
    assert_eq!(
        w.callback(path, &w.gateway_key, notify).await,
        StatusCode::ACCEPTED
    );
    let ack = w.last(medbrains_abdm::gateway::CONSENT_ON_NOTIFY_PATH).body;
    assert_eq!(ack["acknowledgement"]["status"], "OK", "{ack}");

    let hiu = medbrains_crypto::fidelius::generate().expect("hiu keys");
    let txn = format!("txn-{}", Uuid::new_v4());
    let request = json!({ "transactionId": txn, "hiRequest": { "consent": { "id": consent_id },
        "dateRange": { "from": "2000-01-01T00:00:00.000Z", "to": "2100-01-01T00:00:00.000Z" },
        "dataPushUrl": format!("{}/hiu/push", w.mock),
        "keyMaterial": { "cryptoAlg": "ECDH", "curve": "Curve25519", "nonce": hiu.nonce,
            "dhPublicKey": { "expiry": "2100-01-01T00:00:00.000Z", "parameters": "Curve25519/32byte random key",
                             "keyValue": hiu.public_key } } } });
    let path = medbrains_abdm::gateway::CB_HI_REQUEST;
    assert_eq!(
        w.callback(path, &w.gateway_key, request).await,
        StatusCode::ACCEPTED
    );
    assert_eq!(
        w.last(medbrains_abdm::gateway::HI_ON_REQUEST_PATH).body["hiRequest"]["sessionStatus"],
        "ACKNOWLEDGED"
    );
    let push = w.last("/hiu/push").body;
    let entry = &push["entries"][0];
    assert_eq!(entry["careContextReference"], reference.as_str());
    let km = &push["keyMaterial"];
    let plain = medbrains_crypto::fidelius::decrypt(
        entry["content"].as_str().expect("content"),
        &hiu,
        km["dhPublicKey"]["keyValue"].as_str().expect("hip key"),
        km["nonce"].as_str().expect("hip nonce"),
    )
    .expect("the HIU can decrypt it");
    let bundle: Value = serde_json::from_str(&plain).expect("a FHIR bundle");
    assert_eq!(bundle["type"], "document");
    assert_eq!(
        bundle["entry"][0]["resource"]["meta"]["profile"][0],
        "https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"
    );
    assert!(
        plain.contains("Viral fever"),
        "the record's content travels"
    );
    let notice = w.last(medbrains_abdm::gateway::HI_NOTIFY_PATH).body;
    assert_eq!(
        notice["notification"]["statusNotification"]["sessionStatus"],
        "TRANSFERRED"
    );
    let status: String = sqlx::query_scalar(
        "SELECT status FROM abdm_health_transfers WHERE transaction_id = $1 \
          AND patient_id = $2",
    )
    .bind(&txn)
    .bind(w.patient_id)
    .fetch_one(&w.app.db)
    .await
    .expect("transfer");
    assert_eq!(status, "transferred");
}

/// Given staff without the ABDM records permissions, Then the patient's
/// records and the sharing summary are 403, and so is "Link now" for staff
/// who may only view; an administrator sees both.
#[tokio::test]
async fn the_records_screens_need_their_permissions() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let reference = w.close_consultation().await;
    let (id, _, _) = w.context(&reference).await;
    let records = format!("/api/abdm/patients/{}/records", w.patient_id);
    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    for path in [records.as_str(), "/api/abdm/sharing/summary"] {
        let r = desk.client.get(w.app.url(path)).send().await.expect("get");
        assert_eq!(r.status().as_u16(), 403, "{path}");
    }
    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let r = nurse
        .client
        .post(w.app.url(&format!("/api/abdm/care-contexts/{id}/link")))
        .header("x-csrf-token", &nurse.csrf)
        .send()
        .await
        .expect("link");
    assert_eq!(r.status().as_u16(), 403, "viewing does not grant linking");

    let mine: Value = w
        .app
        .client
        .get(w.app.url(&records))
        .send()
        .await
        .expect("records")
        .json()
        .await
        .expect("json");
    assert_eq!(mine["abha_verified"], true);
    assert!(mine["blocked_reason"].is_null(), "{mine}");
    assert!(mine["care_contexts"].to_string().contains(&reference));
    let summary = w
        .app
        .client
        .get(w.app.url("/api/abdm/sharing/summary"))
        .send()
        .await
        .expect("summary");
    assert_eq!(summary.status().as_u16(), 200);
}
