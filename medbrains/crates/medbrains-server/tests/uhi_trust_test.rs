//! UHI provider (HSPA) trust, through the real registry lookup and the
//! gateway's own signature — no key overrides:
//! - a search the gateway fans out carries only the gateway's signature, over
//!   a body it re-serialised, and is answered to the gateway's on_search;
//! - every other call is the app's, looked up in the registry with the full
//!   body NHA's registry filters on, and answered only under the subscriber
//!   URL the registry has for it;
//! - a registry that refuses *us* is our fault (503), never "not registered";
//! - a 200 that carries a NACK is a failed delivery;
//! - onboarding follows NHA's order, and UHI stays off without an HFR ID.

use crate::uhi_world;

use axum::http::StatusCode;
use medbrains_crypto::beckn::{SignatureHeader, generate, public_key_of};
use medbrains_outbox::HandlerError;
use medbrains_server::routes::uhi::protocol::{AMBULANCE_DOMAIN, CONSULTATION_DOMAIN};
use serde_json::{Value, json};
use uhi_world::{LOOKUP, World, world, world_with};
use uuid::Uuid;

use uhi_world::SERIAL;

fn txn() -> String {
    Uuid::new_v4().to_string()
}

fn ambulance_search(w: &World, id: &str) -> Value {
    w.message(AMBULANCE_DOMAIN, "search", id, json!({ "intent": {} }))
}

async fn put_settings(w: &World, body: Value) -> reqwest::Response {
    w.app
        .client
        .put(w.app.url("/api/uhi/settings"))
        .header("x-csrf-token", &w.csrf)
        .json(&body)
        .send()
        .await
        .expect("save")
}

/// Given a search the gateway forwards — re-serialised, with only
/// X-Gateway-Authorization — When it arrives, Then it is ACKed (v2.0.2 ACK
/// with `error: {}`) and answered to `/api/v1/uhi/on_search`; the same in
/// Proxy-Authorization is accepted; a gateway signature made with any other
/// key is refused and nothing is queued; under the earlier NHA-ABDM/UHI
/// contract the answer goes to `/api/v1/on_search`.
#[tokio::test]
async fn a_gateway_search_is_trusted_on_the_gateways_signature() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let id = txn();
    let (status, ack) = w
        .send("search", &ambulance_search(&w, &id), None, true)
        .await;
    assert_eq!(status, StatusCode::OK, "{ack}");
    assert_eq!(
        ack,
        json!({ "message": { "ack": { "status": "ACK" } }, "error": {} })
    );
    let on_search = w.deliver(&id, "on_search").await;
    assert_eq!(on_search.path, "/api/v1/uhi/on_search");
    assert!(
        on_search.headers.contains_key("digest"),
        "v2.0.2 sends Digest"
    );

    let proxied = txn();
    let (status, _) = w
        .forward(
            "search",
            &ambulance_search(&w, &proxied),
            &w.gateway,
            "proxy-authorization",
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(w.outbox_count(&proxied).await, 1);

    let forged = txn();
    let impostor = generate();
    let (status, nack) = w
        .forward(
            "search",
            &ambulance_search(&w, &forged),
            &impostor,
            "x-gateway-authorization",
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(nack["error"]["code"], "UHI-1405");
    assert_eq!(nack["error"]["type"], "CONTEXT-ERROR");
    assert_eq!(w.outbox_count(&forged).await, 0);

    sqlx::query("UPDATE uhi_subscriptions SET gateway_spec = 's2' WHERE tenant_id = $1")
        .bind(w.tenant)
        .execute(&w.app.db)
        .await
        .expect("s2");
    let earlier = txn();
    let (status, ack) = w
        .send("search", &ambulance_search(&w, &earlier), None, true)
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ack, json!({ "message": { "ack": { "status": "ACK" } } }));
    let on_search = w.deliver(&earlier, "on_search").await;
    assert_eq!(on_search.path, "/api/v1/on_search");
    assert!(
        !on_search.headers.contains_key("digest"),
        "NHA-ABDM/UHI signs only"
    );
    let unproxied = txn();
    let (status, _) = w
        .forward(
            "search",
            &ambulance_search(&w, &unproxied),
            &w.gateway,
            "proxy-authorization",
        )
        .await;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "s2 knows only X-Gateway-Authorization"
    );
}

/// Given a direct call from the app, When it is checked, Then the registry
/// is asked with subscriber_id, pub_key_id, type EUA, domain, city, country
/// and the app's subscriber_url, signed with our key; the answer goes to the
/// app. A record that is not SUBSCRIBED, or past valid_until, is refused.
#[tokio::test]
async fn a_direct_call_is_checked_against_the_full_registry_record() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let id = txn();
    w.call("search", &ambulance_search(&w, &id)).await;
    let lookup = w
        .calls()
        .into_iter()
        .find(|c| c.path == LOOKUP)
        .expect("the registry is asked");
    assert_eq!(
        lookup.body,
        json!({ "subscriber_id": "eua.test", "pub_key_id": "eua.k1", "type": "EUA",
                "domain": AMBULANCE_DOMAIN, "city": "std:080", "country": "IND",
                "subscriber_url": w.eua_uri() })
    );
    let ours = lookup.headers["authorization"].to_str().expect("signed");
    SignatureHeader::parse(ours)
        .expect("header")
        .verify(&lookup.raw, &w.public_key, chrono::Utc::now().timestamp())
        .expect("the lookup is signed with our registered key");
    assert_eq!(w.deliver(&id, "on_search").await.path, "/eua/on_search");

    for (field, value) in [
        ("status", json!("UNSUBSCRIBED")),
        ("valid_until", json!("2025-01-01T00:00:00")),
    ] {
        let w = world().await;
        w.net().registry[0][field] = value;
        let id = txn();
        let (status, nack) = w
            .send("search", &ambulance_search(&w, &id), Some(&w.eua), false)
            .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{field}: {nack}");
        assert_eq!(nack["error"]["code"], "UHI-1406");
        assert_eq!(w.outbox_count(&id).await, 0);
    }
}

/// Given a registry that refuses our own signature (401), our key (403) or
/// is down (500), When a call needs a lookup, Then it is answered 503
/// CORE-ERROR — the caller is never told it is not registered. A registry
/// that does not know the signer (404) is 401 UHI-1406.
#[tokio::test]
async fn a_registry_that_refuses_us_is_our_fault_not_the_callers() {
    let _serial = SERIAL.lock().await;
    for (registry, expected) in [
        (Some(401), StatusCode::SERVICE_UNAVAILABLE),
        (Some(403), StatusCode::SERVICE_UNAVAILABLE),
        (Some(500), StatusCode::SERVICE_UNAVAILABLE),
        (Some(404), StatusCode::UNAUTHORIZED),
    ] {
        let w = world().await;
        w.net().registry_status = registry;
        let (status, nack) = w
            .send("search", &ambulance_search(&w, &txn()), Some(&w.eua), false)
            .await;
        assert_eq!(status, expected, "registry {registry:?}: {nack}");
        let kind = if expected.is_server_error() {
            "CORE-ERROR"
        } else {
            "CONTEXT-ERROR"
        };
        assert_eq!(nack["error"]["type"], kind);
    }
}

/// Given a registered app that names someone else's address as its
/// consumer_uri, When it calls, Then it is refused and nothing is queued;
/// and a queued answer whose URL was changed to point elsewhere is not sent.
#[tokio::test]
async fn callbacks_go_only_to_the_apps_registered_address() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let id = txn();
    let mut hijack = ambulance_search(&w, &id);
    hijack["context"]["consumer_uri"] = json!(format!("{}/attacker", w.mock));
    let (status, nack) = w.send("search", &hijack, Some(&w.eua), false).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{nack}");
    assert_eq!(
        w.outbox_count(&id).await,
        0,
        "nothing is sent to the stranger"
    );

    let id = txn();
    w.call("search", &ambulance_search(&w, &id)).await;
    let (event_id, _) = w.queued(&id, "on_search").await;
    sqlx::query(
        "UPDATE outbox_events SET payload = jsonb_set(payload, '{url}', to_jsonb($2::text)) \
          WHERE id = $1",
    )
    .bind(event_id)
    .bind(format!("{}/attacker/on_search", w.mock))
    .execute(&w.app.db)
    .await
    .expect("tamper");
    let sent = w.try_deliver(&id, "on_search").await;
    assert!(matches!(sent, Err(HandlerError::Permanent(_))), "{sent:?}");
    assert!(
        w.calls().iter().all(|c| !c.path.starts_with("/attacker")),
        "the stranger never hears from us"
    );
}

/// Given an app that answers our on_search with HTTP 200 and a NACK, When
/// the callback runs, Then it is a permanent failure, not "delivered".
#[tokio::test]
async fn a_nack_inside_a_200_is_a_failed_delivery() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.net().nack_paths.push("/eua/on_search".to_owned());
    let id = txn();
    w.call("search", &ambulance_search(&w, &id)).await;
    let sent = w.try_deliver(&id, "on_search").await;
    match sent {
        Err(HandlerError::Permanent(why)) => assert!(why.contains("UHI-1404"), "{why}"),
        other => panic!("a NACK must not read as delivered: {other:?}"),
    }
}

/// Settings follow NHA's order and the rules for who may join: services
/// UHI does not support from a provider are not offered; UHI does not
/// switch on without a campus HFR ID; a key from NHA's header utility can be
/// imported, and a non-key is refused.
#[tokio::test]
async fn onboarding_offers_only_live_services_and_needs_an_hfr_id() {
    let _serial = SERIAL.lock().await;
    let w = world_with(false).await;
    let view: Value = w
        .app
        .client
        .get(w.app.url("/api/uhi/settings"))
        .send()
        .await
        .expect("view")
        .json()
        .await
        .expect("json");
    assert_eq!(
        view["available_services"],
        json!(["physical_consultation", "blood_bank", "ambulance"])
    );
    assert_eq!(view["online_payment"], false);
    let base = json!({ "environment": "sandbox", "subscriber_id": w.subscriber,
        "unique_key_id": "hspa.k1", "city_code": "std:080", "is_active": true });
    let mut tele = base.clone();
    tele["services"] = json!(["teleconsultation"]);
    tele["is_active"] = json!(false);
    assert_eq!(
        put_settings(&w, tele).await.status(),
        StatusCode::BAD_REQUEST
    );
    let mut no_campus = base.clone();
    no_campus["services"] = json!(["ambulance"]);
    let refused = put_settings(&w, no_campus).await;
    assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
    assert!(refused.text().await.unwrap_or_default().contains("HFR"));

    let pair = generate();
    let keys = |body: Value| {
        w.app
            .client
            .post(w.app.url("/api/uhi/settings/keys"))
            .header("x-csrf-token", &w.csrf)
            .json(&body)
            .send()
    };
    let imported: Value = keys(json!({ "private_key": pair.private_key }))
        .await
        .expect("import")
        .json()
        .await
        .expect("json");
    assert_eq!(
        imported["signing_public_key"],
        public_key_of(&pair.private_key).expect("public")
    );
    let bad = keys(json!({ "private_key": "not a key" }))
        .await
        .expect("bad");
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);

    // A consultation search is answered only for the live service.
    let id = txn();
    let online = w.message(
        CONSULTATION_DOMAIN,
        "search",
        &id,
        json!({ "intent": { "fulfillment": { "type": "Online" } } }),
    );
    w.call("search", &online).await;
    assert_eq!(
        w.outbox_count(&id).await,
        0,
        "teleconsultation stays hidden"
    );
}
