//! A claim is never "queued to NHCX" by a hospital that cannot send to NHCX.
//!
//! Without an NHCX participant code nothing can reach a payer, so the desk is
//! told to use the payer's portal instead of seeing "Queued" for a claim that
//! would silently go nowhere.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn without_nhcx_onboarding_nothing_is_queued() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    sqlx::query(
        "UPDATE tenants SET abdm_hcx_sender_code = NULL \
         WHERE id = (SELECT tenant_id FROM users WHERE username = 'admin')",
    )
    .execute(&app.db)
    .await
    .expect("clear participant code");
    let queued_before: i64 =
        sqlx::query_scalar("SELECT count(*) FROM outbox_events WHERE event_type LIKE 'nhcx.%'")
            .fetch_one(&app.db)
            .await
            .expect("count");

    let id = Uuid::new_v4();
    let attempts = [
        (
            format!("/api/billing/insurance-claims/{id}/submit-to-nhcx"),
            json!({ "recipient_code": "payer-001" }),
        ),
        (
            format!("/api/insurance/prior-auths/{id}/submit-to-nhcx"),
            json!({ "recipient_code": "payer-001" }),
        ),
        (
            "/api/insurance/verifications/nhcx".to_owned(),
            json!({ "recipient_code": "payer-001", "patient_id": id }),
        ),
    ];
    for (path, body) in attempts {
        let resp = app
            .client
            .post(app.url(&path))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
            .await
            .expect("request");
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE, "{path}");
    }

    let queued_after: i64 =
        sqlx::query_scalar("SELECT count(*) FROM outbox_events WHERE event_type LIKE 'nhcx.%'")
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(queued_before, queued_after, "nothing may be queued");
}
