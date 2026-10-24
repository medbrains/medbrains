//! The HIP's consent obligations (audit §3.4, official sandbox docs
//! "Storing Consent Artefacts" and the M2 error table): a gateway retry of a
//! health-information request is acknowledged again and never sent twice;
//! expired key material is refused; a failed transfer names every care
//! context as ERRORED; a revoked consent's artefact is deleted.

use crate::abdm_hip_world::{World, world};

use axum::http::StatusCode;
use medbrains_abdm::gateway::{
    CB_CONSENT_NOTIFY, CB_HI_REQUEST, HI_NOTIFY_PATH, HI_ON_REQUEST_PATH,
};
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const PUSH: &str = "/hiu/push";

/// Grant a consent covering a fresh consultation; returns (consent, reference).
async fn granted(w: &World) -> (String, String) {
    let reference = w.close_consultation().await;
    let consent_id = Uuid::new_v4().to_string();
    let notify = json!({ "notification": { "status": "GRANTED", "consentId": consent_id,
        "signature": "sig", "consentDetail": {
        "consentId": consent_id, "patient": { "id": w.address }, "hip": { "id": w.hip_id },
        "hiu": { "id": "HIU-1" }, "purpose": { "code": "CAREMGT", "text": "Care Management" },
        "hiTypes": ["OPConsultation"],
        "careContexts": [{ "patientReference": w.uhid, "careContextReference": reference }],
        "permission": { "accessMode": "VIEW", "dateRange": { "from": "2000-01-01T00:00:00.000Z",
            "to": "2100-01-01T00:00:00.000Z" }, "dataEraseAt": "2100-01-01T00:00:00.000Z" } } } });
    assert_eq!(
        w.callback(CB_CONSENT_NOTIFY, &w.gateway_key, notify).await,
        StatusCode::ACCEPTED
    );
    (consent_id, reference)
}

fn request(w: &World, consent_id: &str, txn: &str, key_expiry: &str) -> Value {
    let hiu = medbrains_crypto::fidelius::generate().expect("hiu keys");
    json!({ "transactionId": txn, "hiRequest": { "consent": { "id": consent_id },
        "dateRange": { "from": "2000-01-01T00:00:00.000Z", "to": "2100-01-01T00:00:00.000Z" },
        "dataPushUrl": format!("{}{PUSH}", w.mock),
        "keyMaterial": { "cryptoAlg": "ECDH", "curve": "Curve25519", "nonce": hiu.nonce,
            "dhPublicKey": { "expiry": key_expiry, "parameters": "Curve25519/32byte random key",
                             "keyValue": hiu.public_key } } } })
}

const LATER: &str = "2100-01-01T00:00:00.000Z";

/// Given a delivered transfer, When the gateway retries the same
/// transaction, Then it is acknowledged again and nothing is pushed twice.
#[tokio::test]
async fn a_retried_request_is_acknowledged_again_and_sent_once() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (consent_id, _) = granted(&w).await;
    let txn = format!("txn-{}", Uuid::new_v4());
    for _ in 0..2 {
        assert_eq!(
            w.callback(
                CB_HI_REQUEST,
                &w.gateway_key,
                request(&w, &consent_id, &txn, LATER)
            )
            .await,
            StatusCode::ACCEPTED
        );
        let ack = w.last(HI_ON_REQUEST_PATH).body;
        assert_eq!(ack["hiRequest"]["sessionStatus"], "ACKNOWLEDGED", "{ack}");
        assert_eq!(ack["hiRequest"]["transactionId"], txn.as_str());
    }
    let pushed = w
        .calls
        .lock()
        .expect("calls")
        .iter()
        .filter(|c| c.path == PUSH && c.body["transactionId"] == txn.as_str())
        .count();
    assert_eq!(pushed, 1, "a retry is never a second disclosure");
}

/// Given the HIU's key has expired, When it asks for records, Then the
/// request is ERRORED with ABDM-1010 and nothing is pushed.
#[tokio::test]
async fn expired_key_material_is_refused() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (consent_id, _) = granted(&w).await;
    let txn = format!("txn-{}", Uuid::new_v4());
    let before = w.count(PUSH);
    let stale = request(&w, &consent_id, &txn, "2001-01-01T00:00:00.000Z");
    assert_eq!(
        w.callback(CB_HI_REQUEST, &w.gateway_key, stale).await,
        StatusCode::ACCEPTED
    );
    let ack = w.last(HI_ON_REQUEST_PATH).body;
    assert_eq!(ack["hiRequest"]["sessionStatus"], "ERRORED", "{ack}");
    assert_eq!(ack["error"]["code"], "ABDM-1010");
    assert_eq!(w.count(PUSH), before);
}

/// Given the HIU refuses the push, When the transfer fails, Then the notify
/// is FAILED and lists the consented care context as ERRORED.
#[tokio::test]
async fn a_failed_transfer_names_each_care_context() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (consent_id, reference) = granted(&w).await;
    w.refuse_once
        .lock()
        .expect("refuse")
        .insert(PUSH.to_owned());
    let txn = format!("txn-{}", Uuid::new_v4());
    assert_eq!(
        w.callback(
            CB_HI_REQUEST,
            &w.gateway_key,
            request(&w, &consent_id, &txn, LATER)
        )
        .await,
        StatusCode::ACCEPTED
    );
    let status = &w.last(HI_NOTIFY_PATH).body["notification"]["statusNotification"];
    assert_eq!(status["sessionStatus"], "FAILED", "{status}");
    assert_eq!(
        status["statusResponses"][0]["careContextReference"],
        reference.as_str()
    );
    assert_eq!(status["statusResponses"][0]["hiStatus"], "ERRORED");
}

/// Given a granted consent, When the patient revokes it, Then the artefact
/// is deleted with its content cleared, and a later request is refused.
#[tokio::test]
async fn a_revoked_consent_is_deleted() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (consent_id, _) = granted(&w).await;
    let revoke = json!({ "notification": { "status": "REVOKED", "consentId": consent_id,
        "consentDetail": { "hip": { "id": w.hip_id } } } });
    assert_eq!(
        w.callback(CB_CONSENT_NOTIFY, &w.gateway_key, revoke).await,
        StatusCode::ACCEPTED
    );
    let (deleted, refs, signature): (bool, Vec<String>, Option<String>) = sqlx::query_as(
        "SELECT deleted_at IS NOT NULL, care_context_refs, signature \
           FROM abdm_consent_artefacts WHERE consent_id = $1",
    )
    .bind(&consent_id)
    .fetch_one(&w.app.db)
    .await
    .expect("artefact");
    assert!(deleted, "a revoked artefact is deleted");
    assert!(
        refs.is_empty() && signature.is_none(),
        "its content is cleared"
    );

    let txn = format!("txn-{}", Uuid::new_v4());
    assert_eq!(
        w.callback(
            CB_HI_REQUEST,
            &w.gateway_key,
            request(&w, &consent_id, &txn, LATER)
        )
        .await,
        StatusCode::ACCEPTED
    );
    let ack = w.last(HI_ON_REQUEST_PATH).body;
    assert_eq!(ack["hiRequest"]["sessionStatus"], "ERRORED");
    assert_eq!(ack["error"]["code"], "ABDM-1062");
}
