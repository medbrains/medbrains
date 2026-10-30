//! The permission refusal comes first on admin routes.
//!
//! Found by the generated permission-denial suite (`make e2e-rbac-generate`):
//! a `Json<T>` extractor ran before `require_permission`, so a caller who may
//! not use the route got 415/422 instead of 403, and the message simulator
//! answered 404 before asking who was calling. A refusal that depends on the
//! body is not a refusal.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

const WEBHOOKS_MANAGE: &str = "admin.webhooks.manage";
const SIMULATOR_VIEW: &str = "admin.notifications.simulator.view";
const PAIRED_REVOKE: &str = "devices.pairing.paired.revoke";

async fn send(
    staff: &common::Staff,
    req: reqwest::RequestBuilder,
) -> (StatusCode, serde_json::Value) {
    let resp = req
        .header("x-csrf-token", &staff.csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or_default())
}

fn assert_refused(status: StatusCode, body: &serde_json::Value, what: &str) {
    assert_eq!(status, StatusCode::FORBIDDEN, "{what}: {body}");
    assert_eq!(body["error"], "forbidden", "{what}: a permission refusal");
}

async fn webhook_writes_refuse_before_reading_the_body(app: &common::TestApp, csrf: &str) {
    let desk = common::provision_staff(app, csrf, "receptionist", &[]).await;
    let url = app.url("/api/admin/webhooks");
    let valid = json!({
        "name": "Partner", "url": "https://partner.example.com/hook",
        "event_types": ["pharmacy.stock.low"],
    });

    for (what, body) in [
        ("a valid body", valid.clone()),
        ("a body that does not parse", json!({ "name": 1 })),
    ] {
        let (status, answer) = send(&desk, desk.client.post(&url).json(&body)).await;
        assert_refused(status, &answer, &format!("create with {what}"));
        let put = desk
            .client
            .put(app.url(&format!("/api/admin/webhooks/{}", Uuid::new_v4())))
            .json(&body);
        let (status, answer) = send(&desk, put).await;
        assert_refused(status, &answer, &format!("update with {what}"));
    }

    let admin =
        common::provision_staff_with(app, csrf, "receptionist", &[WEBHOOKS_MANAGE], &[]).await;
    let (status, answer) = send(&admin, admin.client.post(&url).json(&valid)).await;
    assert_eq!(status, StatusCode::OK, "granted: {answer}");
    let (status, _) = send(&admin, admin.client.post(&url).json(&json!({ "name": 1 }))).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "granted, bad body: told what is wrong"
    );
}

/// 403 to the unpermitted whether or not the simulator is on; to the
/// permitted, the inbox when it is on and 404 when it is off. The flag comes
/// from the environment (a dev `.env` turns it on), so the test reads it too.
async fn the_message_simulator_refuses_before_saying_it_is_off(app: &common::TestApp, csrf: &str) {
    let url = app.url("/api/admin/message-simulator/messages?recipient=9876500000");

    let desk = common::provision_staff(app, csrf, "receptionist", &[]).await;
    let (status, answer) = send(&desk, desk.client.get(&url)).await;
    assert_refused(status, &answer, "simulator without the permission");

    let tester =
        common::provision_staff_with(app, csrf, "receptionist", &[SIMULATOR_VIEW], &[]).await;
    let (status, _) = send(&tester, tester.client.get(&url)).await;
    let on = std::env::var("MEDBRAINS_NOTIFY_SIMULATOR").is_ok_and(|v| v == "true");
    let expected = if on {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    };
    assert_eq!(status, expected, "permitted, simulator on = {on}");
}

async fn revoking_a_device_refuses_with_or_without_a_body(app: &common::TestApp, csrf: &str) {
    let url = app.url(&format!("/api/admin/paired-devices/{}", Uuid::new_v4()));

    let desk = common::provision_staff(app, csrf, "receptionist", &[]).await;
    let (status, answer) = send(&desk, desk.client.delete(&url)).await;
    assert_refused(status, &answer, "revoke with no body");
    let with_body = desk.client.delete(&url).json(&json!({ "reason": "lost" }));
    let (status, answer) = send(&desk, with_body).await;
    assert_refused(status, &answer, "revoke with a body");

    // Granted: the reason is optional, so no body reaches the lookup — an
    // unknown device is 404, not 415.
    let biomed =
        common::provision_staff_with(app, csrf, "receptionist", &[PAIRED_REVOKE], &[]).await;
    let (status, _) = send(&biomed, biomed.client.delete(&url)).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "granted, no body");
    let (status, _) = send(
        &biomed,
        biomed
            .client
            .delete(&url)
            .json(&json!({ "reason": "lost" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "granted, with a reason");
}

/// One server for all three: each `spawn_app` re-seeds the tenant's roles,
/// and three at once queue behind each other's role upserts.
#[tokio::test]
async fn admin_routes_refuse_before_anything_else() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    webhook_writes_refuse_before_reading_the_body(&app, &csrf).await;
    the_message_simulator_refuses_before_saying_it_is_off(&app, &csrf).await;
    revoking_a_device_refuses_with_or_without_a_body(&app, &csrf).await;
}
