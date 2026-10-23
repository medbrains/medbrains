//! Settings → ABDM → Bridge (audit rows 58–60): the gateway is told our
//! callback URL, each campus's HFR ID is bound to the bridge in HFR, and the
//! screen shows what the gateway holds — or "unknown" when it cannot be
//! asked, never an empty list that reads as "nothing registered".

use crate::abdm_hip_world::world;
use crate::common;

use axum::http::StatusCode;
use medbrains_abdm::{
    gateway::{BRIDGE_SERVICES_PATH, BRIDGE_URL_PATH},
    registry::HFR_BRIDGE_LINK_PATH,
};
use serde_json::{Value, json};

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn bridge(w: &crate::abdm_hip_world::World) -> Value {
    let r = w
        .app
        .client
        .get(w.app.url("/api/abdm/bridge"))
        .send()
        .await
        .expect("bridge");
    assert_eq!(r.status().as_u16(), 200);
    r.json().await.expect("json")
}

fn campus<'a>(view: &'a Value, hip_id: &str) -> &'a Value {
    view["campuses"]
        .as_array()
        .and_then(|c| c.iter().find(|c| c["hfr_facility_id"] == hip_id))
        .unwrap_or(&Value::Null)
}

/// Given ABDM keys and a campus with an HFR ID, When the gateway cannot be
/// asked, Then the campus is "unknown", not "unbound"; When the bridge is
/// registered, Then the gateway gets the URL, HFR gets the campus as HIP
/// and HIU under our client ID, and the screen shows it bound.
#[tokio::test]
async fn the_bridge_is_registered_and_each_campus_bound() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.reply(
        BRIDGE_SERVICES_PATH,
        StatusCode::INTERNAL_SERVER_ERROR,
        json!({ "message": "down" }),
    );
    let view = bridge(&w).await;
    assert_eq!(view["gateway"]["state"], "unknown", "{view}");
    assert!(
        campus(&view, &w.hip_id)["bound"].is_null(),
        "unknown, not unbound: {view}"
    );

    w.reply(
        HFR_BRIDGE_LINK_PATH,
        StatusCode::OK,
        json!([{ "servicesLinked": { "id": "sbx-client", "types": ["HIP"], "active": true } },
               { "servicesLinked": { "id": "sbx-client", "types": ["HIU"], "active": true } }]),
    );
    let r = w
        .app
        .client
        .post(w.app.url("/api/abdm/bridge/register"))
        .header("x-csrf-token", &w.csrf)
        .json(&json!({ "url": "https://hospital.test/" }))
        .send()
        .await
        .expect("register");
    assert_eq!(r.status().as_u16(), 200);
    let done: Value = r.json().await.expect("json");
    assert_eq!(done["url"]["ok"], true, "{done}");
    assert_eq!(campus(&done, &w.hip_id)["ok"], true, "{done}");
    assert_eq!(w.last(BRIDGE_URL_PATH).body["url"], "https://hospital.test");
    let hfr = w.last(HFR_BRIDGE_LINK_PATH).body;
    assert_eq!(hfr["facilityId"], w.hip_id.as_str());
    assert_eq!(
        hfr["HRP"][0]["bridgeId"], "sbx-client",
        "the bridge is our client ID"
    );
    assert_eq!(hfr["HRP"][0]["type"], "HIP");
    assert_eq!(hfr["HRP"][1]["type"], "HIU");
    assert!(
        hfr["HRP"][0]["hipName"]
            .as_str()
            .is_some_and(|n| n.chars().count() <= 15)
    );

    w.reply(
        BRIDGE_SERVICES_PATH,
        StatusCode::OK,
        json!({ "bridge": { "id": "sbx-client", "url": "https://hospital.test", "active": true,
                            "blocklisted": false },
                "services": [{ "id": w.hip_id, "types": ["HIP", "HIU"], "active": true }] }),
    );
    let view = bridge(&w).await;
    assert_eq!(view["gateway"]["state"], "ok");
    assert_eq!(view["gateway"]["url"], "https://hospital.test");
    assert_eq!(view["bridge_id"], "sbx-client");
    assert_eq!(campus(&view, &w.hip_id)["bound"], true, "{view}");

    let r = w
        .app
        .client
        .post(w.app.url("/api/abdm/bridge/register"))
        .header("x-csrf-token", &w.csrf)
        .json(&json!({ "url": "ftp://hospital.test" }))
        .send()
        .await
        .expect("register");
    assert_eq!(r.status().as_u16(), 400, "only an https callback URL");
}

/// Given staff without the ABDM settings permissions, Then the bridge can be
/// neither seen nor registered.
#[tokio::test]
async fn the_bridge_needs_its_permissions() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let r = desk
        .client
        .get(w.app.url("/api/abdm/bridge"))
        .send()
        .await
        .expect("get");
    assert_eq!(r.status().as_u16(), 403);
    let r = desk
        .client
        .post(w.app.url("/api/abdm/bridge/register"))
        .header("x-csrf-token", &desk.csrf)
        .json(&json!({ "url": "https://hospital.test" }))
        .send()
        .await
        .expect("post");
    assert_eq!(r.status().as_u16(), 403);
    assert_eq!(w.count(BRIDGE_URL_PATH), 0, "nothing reached ABDM");
}
