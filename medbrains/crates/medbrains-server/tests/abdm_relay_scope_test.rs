//! The ABDM callback relay gives each hospital its own callbacks only. The
//! tenant comes from the token, never from the request; another hospital's
//! callback cannot be read or acknowledged (404, as if absent); and staff
//! without the relay permission are refused.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn callback(app: &common::TestApp, tenant: Uuid, kind: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO abdm_gateway_callbacks (tenant_id, callback_type, payload) \
         VALUES ($1, $2, '{\"patient\":\"someone\"}'::jsonb) RETURNING id",
    )
    .bind(tenant)
    .bind(kind)
    .fetch_one(&app.db)
    .await
    .expect("callback")
}

#[tokio::test]
async fn each_hospital_pulls_only_its_own_abdm_callbacks() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let ours: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let t = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let theirs: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other Hospital', 'multi_specialty') RETURNING id",
    )
    .bind(format!("OTH{}", t.to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("other tenant");
    let mine = callback(&app, ours, &format!("ours-{t}")).await;
    let foreign = callback(&app, theirs, &format!("theirs-{t}")).await;

    // Asking for the other hospital by id is ignored: the token decides.
    let listed: Value = app
        .client
        .get(app.url(&format!(
            "/api/abdm/gateway/callbacks/pending?tenant_id={theirs}"
        )))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .unwrap_or(Value::Null);
    let text = listed.to_string();
    assert!(text.contains(&mine.to_string()), "our callback is listed");
    assert!(
        !text.contains(&foreign.to_string()),
        "never another hospital's"
    );

    let ack = |id: Uuid| {
        app.client
            .put(app.url(&format!("/api/abdm/gateway/callbacks/{id}/ack")))
            .header("x-csrf-token", &csrf)
            .json(&json!({}))
            .send()
    };
    assert_eq!(
        ack(foreign).await.expect("ack").status(),
        StatusCode::NOT_FOUND
    );
    let still: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT forwarded_at FROM abdm_gateway_callbacks WHERE id = $1")
            .bind(foreign)
            .fetch_one(&app.db)
            .await
            .expect("foreign row");
    assert!(
        still.is_none(),
        "the other hospital's callback is untouched"
    );
    assert!(ack(mine).await.expect("ack").status().is_success());

    // A nurse holds no relay permission.
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role) \
         SELECT tenant_id, $1, $1 || '@e2e.medbrains.localhost', password_hash, 'Relay Nurse', 'nurse' \
           FROM users WHERE username = 'admin'",
    )
    .bind(format!("relay_nurse_{t}"))
    .execute(&app.db)
    .await
    .expect("nurse");
    let nurse = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login = nurse
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": format!("relay_nurse_{t}"), "password": "admin123" }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), StatusCode::OK);
    let refused = nurse
        .get(app.url("/api/abdm/gateway/callbacks/pending"))
        .send()
        .await
        .expect("list as nurse");
    assert_eq!(refused.status(), StatusCode::FORBIDDEN);
}
