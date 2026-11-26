//! A payment webhook writes nothing for a notice that nothing can verify.

use crate::common;

use reqwest::StatusCode;

const PROVIDERS: [&str; 4] = ["razorpay", "cashfree", "phonepe", "payu"];

/// Rows filed for notices that matched no hospital.
async fn unmatched(app: &common::TestApp) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM payment_webhook_exceptions WHERE tenant_id IS NULL")
        .fetch_one(&app.db)
        .await
        .expect("count")
}

/// Status of a POST of `body` to `provider`'s webhook.
async fn post(app: &common::TestApp, provider: &str, body: String) -> StatusCode {
    app.client
        .post(app.url(&format!("/api/webhooks/{provider}")))
        .body(body)
        .send()
        .await
        .expect("webhook")
        .status()
}

/// Given an empty body, an oversized one, and one naming no order, When each
/// reaches every provider's webhook, Then the first two are refused (400), the
/// last is answered and ignored, and none of them is written anywhere.
#[tokio::test]
async fn an_unverifiable_notice_writes_nothing() {
    let app = common::spawn_app().await;
    let before = unmatched(&app).await;
    for provider in PROVIDERS {
        assert_eq!(
            post(&app, provider, String::new()).await,
            StatusCode::BAD_REQUEST,
            "{provider} empty"
        );
        let huge = format!(
            "{{\"order_id\":\"order_x\",\"pad\":\"{}\"}}",
            "x".repeat(70 * 1024)
        );
        assert_eq!(
            post(&app, provider, huge).await,
            StatusCode::BAD_REQUEST,
            "{provider} oversized"
        );
        assert_eq!(
            post(&app, provider, "not a notice".to_owned()).await,
            StatusCode::OK,
            "{provider} no order"
        );
    }
    assert_eq!(
        unmatched(&app).await,
        before,
        "an unverified notice was filed"
    );
}
