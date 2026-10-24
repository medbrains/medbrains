//! Who may call our ABDM callbacks (audit §3.7). The gateway's signing keys
//! belong to the shared realm that signs every ABDM client's token, so a
//! valid signature is not enough: the token must be the gateway's own. It is
//! checked before the `X-HIP-ID` is looked up, so a stranger learns nothing
//! about which HFR IDs this server hosts.
//!
//! Also: a session the gateway revoked early is renewed once and the call
//! retried, and every session request carries `grantType`.

use crate::abdm_hip_world::{SANDBOX_ISSUER, gateway_claims, gateway_jwt, jwt, world};

use axum::http::StatusCode;
use medbrains_abdm::gateway::{CB_CONSENT_NOTIFY, CB_DISCOVER, CONSENT_ON_NOTIFY_PATH};
use openssl::{pkey::PKey, rsa::Rsa};
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn discover(address: &str) -> Value {
    json!({ "transactionId": format!("txn-{}", Uuid::new_v4()), "patient": { "id": address,
        "name": "Priya Varude", "gender": "F", "yearOfBirth": 1989, "verifiedIdentifiers": [] } })
}

/// Given tokens signed with the gateway realm's own key, When they are not
/// the gateway's (another integrator's session, a replayed link token, a
/// foreign issuer), Then every one is 401; the gateway's RS512 token is
/// accepted; and an unknown HFR ID is only told apart after verification.
#[tokio::test]
async fn only_the_gateways_own_token_opens_a_callback() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let key = &w.gateway_key;

    let integrator = jwt(
        "RS256",
        json!({ "iss": SANDBOX_ISSUER, "clientId": "SBX_000135", "azp": "SBX_000135",
                "typ": "Bearer", "realm_access": { "roles": ["hip", "hiu", "phr"] } }),
        key,
    );
    let link_token = jwt(
        "RS512",
        json!({ "hipId": w.hip_id, "abhaAddress": w.address, "sub": w.address }),
        key,
    );
    let foreign = jwt(
        "RS256",
        json!({ "iss": "https://evil.example/auth/realms/central-registry", "clientId": "gateway" }),
        key,
    );
    let refresh = jwt(
        "RS256",
        json!({ "iss": SANDBOX_ISSUER, "clientId": "gateway", "typ": "Refresh" }),
        key,
    );
    for (who, token) in [
        ("another integrator", &integrator),
        ("a link token", &link_token),
        ("a foreign issuer", &foreign),
        ("a refresh token", &refresh),
    ] {
        assert_eq!(
            w.callback_as(CB_DISCOVER, token, &w.hip_id, discover(&w.address))
                .await,
            StatusCode::UNAUTHORIZED,
            "{who} must not pass as the gateway"
        );
    }

    let rs512 = jwt("RS512", gateway_claims(), key);
    assert_eq!(
        w.callback_as(CB_DISCOVER, &rs512, &w.hip_id, discover(&w.address))
            .await,
        StatusCode::ACCEPTED,
        "the gateway's RS512 key is one of its published keys"
    );

    let forged = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    let forged = gateway_jwt(&forged.private_key_to_pem_pkcs8().expect("pem"));
    let unknown = format!("IN{}", &Uuid::new_v4().simple().to_string()[..10]);
    for hip_id in [w.hip_id.as_str(), unknown.as_str()] {
        assert_eq!(
            w.callback_as(CB_DISCOVER, &forged, hip_id, discover(&w.address))
                .await,
            StatusCode::UNAUTHORIZED,
            "an unverified caller gets the same answer for every HFR ID"
        );
    }
    assert_eq!(
        w.callback_as(
            CB_DISCOVER,
            &gateway_jwt(key),
            &unknown,
            discover(&w.address)
        )
        .await,
        StatusCode::NOT_FOUND,
        "only the gateway learns that an HFR ID is not ours"
    );
}

/// Given a gateway session ABDM revoked before our cache expired, When the
/// next acknowledgement is refused with 401, Then we sign in again (with
/// `grantType: client_credentials`) and the acknowledgement is sent again.
#[tokio::test]
async fn a_revoked_session_is_renewed_once_and_the_call_retried() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let notify = |consent: &str| {
        json!({ "notification": { "status": "DENIED", "consentId": consent,
            "consentDetail": { "hip": { "id": w.hip_id } } } })
    };
    assert_eq!(
        w.callback(CB_CONSENT_NOTIFY, &w.gateway_key, notify("warm-up"))
            .await,
        StatusCode::ACCEPTED
    );
    let sessions = w.count("/sessions");
    let acks = w.count(CONSENT_ON_NOTIFY_PATH);
    w.refuse_once
        .lock()
        .expect("refuse")
        .insert(CONSENT_ON_NOTIFY_PATH.to_owned());

    assert_eq!(
        w.callback(CB_CONSENT_NOTIFY, &w.gateway_key, notify("after-revoke"))
            .await,
        StatusCode::ACCEPTED,
        "the retry succeeded, so the callback is not a failure"
    );
    assert_eq!(
        w.count(CONSENT_ON_NOTIFY_PATH),
        acks + 2,
        "refused once, sent again"
    );
    assert!(w.count("/sessions") > sessions, "signed in again");
    assert_eq!(w.last("/sessions").body["grantType"], "client_credentials");
    assert_eq!(
        w.last(CONSENT_ON_NOTIFY_PATH).body["acknowledgement"]["consentId"],
        "after-revoke"
    );
}
