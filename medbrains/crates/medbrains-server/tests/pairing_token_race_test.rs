//! A pairing token pairs one device, even when several present it at once.
//!
//! The token was read without a lock, so two requests in flight could both see
//! it unused and both be paired.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// Given one pairing token, When eight devices present it at the same moment,
/// Then exactly one is paired.
#[tokio::test]
async fn one_pairing_token_pairs_one_device_under_a_race() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let minted: serde_json::Value = app
        .client
        .post(app.url("/api/admin/device-pairing-tokens"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "intended_device_label": "Race", "intended_app_variant": "tv" }))
        .send()
        .await
        .expect("mint")
        .json()
        .await
        .expect("mint json");
    let token = minted["token"].as_str().expect("token").to_owned();
    let token_id: Uuid = minted["id"].as_str().and_then(|id| id.parse().ok()).expect("id");

    let pair = |n: usize| {
        let client = reqwest::Client::new();
        let url = app.url("/api/device-pairing/pair");
        let body = json!({
            "token": token,
            "label": format!("race-{n}"),
            "public_key_pem": format!("-----BEGIN PUBLIC KEY-----\nrace{n}{token_id}\n-----END PUBLIC KEY-----"),
        });
        async move { client.post(url).json(&body).send().await.expect("pair").status() }
    };
    let statuses = futures::future::join_all((0..8).map(pair)).await;

    let paired: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM paired_devices WHERE paired_via_token_id = $1")
            .bind(token_id)
            .fetch_one(&app.db)
            .await
            .expect("paired");
    let ok = statuses.iter().filter(|s| **s == StatusCode::OK).count();
    assert_eq!((ok, paired), (1, 1), "{statuses:?}");
}
