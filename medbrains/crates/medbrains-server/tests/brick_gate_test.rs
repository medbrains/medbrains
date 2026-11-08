//! A core brick switched off is off at the API too, not only in the menu: its routes answer 403,
//! a public route of the same app still answers, and the Modules screen's server refuses to
//! switch off a brick another switched-on brick needs. The module-status cache shows a change at
//! once after an invalidation, inside its 30 s lifetime.

use crate::common;

use medbrains_authz::decision::Outcome;
use medbrains_server_core::middleware::entitlement::{invalidate_modules, module_entitlement};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// Sets a brick's status through the Modules screen's endpoint; returns its status and body.
async fn switch(
    app: &common::TestApp,
    csrf: &str,
    code: &str,
    status: &str,
) -> (StatusCode, String) {
    let resp = app
        .client
        .put(app.url(&format!("/api/setup/modules/{code}")))
        .header("x-csrf-token", csrf)
        .json(&json!({ "status": status }))
        .send()
        .await
        .expect("module switch");
    (resp.status(), resp.text().await.unwrap_or_default())
}

/// The signed-in admin's tenant.
async fn tenant_of_admin(app: &common::TestApp) -> Uuid {
    let me: serde_json::Value = app
        .get(&app.client, "/api/auth/me")
        .await
        .json()
        .await
        .expect("me");
    me["tenant_id"]
        .as_str()
        .and_then(|t| t.parse().ok())
        .expect("tenant id")
}

#[tokio::test]
async fn pharmacy_off_refuses_its_api_but_not_the_public_storefront() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of_admin(&app).await;
    let code: String = sqlx::query_scalar("SELECT code FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("tenant code");
    let about = format!("/api/store/{code}/about");
    let guest = reqwest::Client::new();
    let public_before = app.get(&guest, &about).await.status();

    assert_eq!(
        switch(&app, &csrf, "pharmacy", "disabled").await.0,
        StatusCode::OK
    );
    let orders = app.get(&app.client, "/api/pharmacy/orders").await.status();
    let catalog = app.get(&app.client, "/api/pharmacy/catalog").await.status();
    let public_after = app.get(&guest, &about).await.status();
    let menu: serde_json::Value = app
        .get(&app.client, "/api/auth/me")
        .await
        .json()
        .await
        .expect("me");
    // Put it back before asserting, so a failure here cannot leave other tests without pharmacy.
    assert_eq!(
        switch(&app, &csrf, "pharmacy", "enabled").await.0,
        StatusCode::OK
    );

    assert_eq!(
        orders,
        StatusCode::FORBIDDEN,
        "a switched-off brick's API must refuse"
    );
    assert_ne!(
        catalog,
        StatusCode::FORBIDDEN,
        "the drug catalog serves prescribing everywhere"
    );
    assert_eq!(
        public_after, public_before,
        "a public route is the handler's call, not the gate's"
    );
    assert!(
        menu["disabled_modules"]
            .as_array()
            .is_some_and(|d| d.contains(&json!("pharmacy")))
    );
    let back = app.get(&app.client, "/api/pharmacy/orders").await.status();
    assert_ne!(
        back,
        StatusCode::FORBIDDEN,
        "switched back on, the change shows at once"
    );
}

#[tokio::test]
async fn registration_cannot_go_off_while_pharmacy_is_on() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    assert_eq!(
        switch(&app, &csrf, "pharmacy", "enabled").await.0,
        StatusCode::OK
    );

    let (status, body) = switch(&app, &csrf, "registration", "disabled").await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.contains("Pharmacy"),
        "the refusal names what needs it: {body}"
    );
    let still: String = sqlx::query_scalar(
        "SELECT status::text FROM module_config WHERE tenant_id = $1 AND code = 'registration'",
    )
    .bind(tenant_of_admin(&app).await)
    .fetch_one(&app.db)
    .await
    .expect("registration row");
    assert_ne!(still, "disabled");
}

#[tokio::test]
async fn an_invalidation_shows_a_change_inside_the_cache_lifetime() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let tenant = tenant_of_admin(&app).await;
    let set = |status: &'static str| {
        sqlx::query(
            "UPDATE module_config SET status = $2::module_status \
             WHERE tenant_id = $1 AND code = 'lab'",
        )
        .bind(tenant)
        .bind(status)
        .execute(&app.db)
    };
    set("enabled").await.expect("enable lab");
    invalidate_modules(tenant);
    assert_eq!(
        module_entitlement(&app.db, tenant, "lab").await,
        Outcome::Allow
    );

    set("disabled").await.expect("disable lab");
    let cached = module_entitlement(&app.db, tenant, "lab").await;
    invalidate_modules(tenant);
    let fresh = module_entitlement(&app.db, tenant, "lab").await;
    set("enabled").await.expect("restore lab");
    invalidate_modules(tenant);

    assert_eq!(
        cached,
        Outcome::Allow,
        "within the lifetime the cache answers"
    );
    assert_eq!(
        fresh,
        Outcome::Deny,
        "after an invalidation the change shows at once"
    );
}
