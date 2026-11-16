//! A core brick switched off is off at the API too, not only in the menu: its routes answer 403,
//! a public route of the same app still answers, and the Modules screen's server refuses to
//! switch off a brick another switched-on brick needs. The module-status cache shows a change at
//! once after an invalidation, inside its 30 s lifetime. With the EMR (`opd`) off, the outpatient
//! desk answers 403 while an IPD encounter still charts through the shared clinical-visit routes.

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

/// Sets the tenant's `opd` row straight in `module_config` (the Modules screen would refuse while
/// a specialty brick needs it) and drops the cached statuses so the gate sees it at once.
async fn set_opd(app: &common::TestApp, tenant: Uuid, status: &str) {
    let done = sqlx::query(
        "UPDATE module_config SET status = $2::module_status \
         WHERE tenant_id = $1 AND code = 'opd' AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(status)
    .execute(&app.db)
    .await
    .expect("set opd");
    assert_eq!(done.rows_affected(), 1, "the tenant has one opd row");
    invalidate_modules(tenant);
}

/// An IPD encounter for a fresh patient, made the way the IPD crate makes one.
async fn ipd_encounter(app: &common::TestApp, tenant: Uuid) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Ward', 'Only', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-BG-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("ipd encounter")
}

/// Decision recorded in docs/DECISIONS.md: the EMR off closes the outpatient desk, not the chart.
/// IPD and ER chart on the same encounters through `/api/opd/encounters/{id}/…`.
#[tokio::test]
async fn opd_off_closes_the_desk_but_an_ipd_encounter_still_charts() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of_admin(&app).await;
    let encounter = ipd_encounter(&app, tenant).await;
    let before: String = sqlx::query_scalar(
        "SELECT status::text FROM module_config WHERE tenant_id = $1 AND code = 'opd'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("opd status");

    set_opd(&app, tenant, "disabled").await;
    let mut desk = Vec::new();
    for path in [
        "/api/opd/queue",
        "/api/opd/queue/wait-estimate",
        "/api/opd/docket",
        "/api/opd/reminders",
        "/api/opd/encounters",
    ] {
        desk.push((path, app.get(&app.client, path).await.status()));
    }
    let vitals = app
        .client
        .post(app.url(&format!("/api/opd/encounters/{encounter}/vitals")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "pulse": 88, "systolic_bp": 128, "diastolic_bp": 82, "spo2": 97 }))
        .send()
        .await
        .expect("vitals request")
        .status();
    let read_vitals = app
        .get(
            &app.client,
            &format!("/api/opd/encounters/{encounter}/vitals"),
        )
        .await
        .status();
    let prescriptions = app
        .get(
            &app.client,
            &format!("/api/opd/encounters/{encounter}/prescriptions"),
        )
        .await
        .status();
    // Put it back before asserting, so a failure cannot leave other tests without the EMR.
    set_opd(&app, tenant, &before).await;

    for (path, status) in desk {
        assert_eq!(status, StatusCode::FORBIDDEN, "{path} is the OPD desk");
    }
    assert!(
        vitals.is_success(),
        "IPD vitals must still record: {vitals}"
    );
    assert_eq!(read_vitals, StatusCode::OK, "IPD vitals must still read");
    assert_eq!(
        prescriptions,
        StatusCode::OK,
        "IPD prescriptions must still read"
    );
}
