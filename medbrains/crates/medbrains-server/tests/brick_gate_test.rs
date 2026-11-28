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

/// A hospital of its own with the EMR (`opd`) switched off, and its admin signed in.
async fn emr_off_hospital(app: &common::TestApp) -> (reqwest::Client, String, Uuid) {
    hospital_with(app, &[("opd", "disabled")]).await
}

/// A hospital of its own holding exactly these `module_config` rows, and its admin signed in.
///
/// Its own tenant so no other test that runs at the same time on the shared admin tenant sees
/// its switches. The rows are written straight; a new tenant has no cached statuses to
/// invalidate. A brick left out has no row, as on a hospital that never set it up.
async fn hospital_with(
    app: &common::TestApp,
    bricks: &[(&str, &str)],
) -> (reqwest::Client, String, Uuid) {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("BG{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Ward Only Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    for (brick, status) in bricks {
        sqlx::query(
            "INSERT INTO module_config (tenant_id, code, name, status) \
             VALUES ($1, $2, $2, $3::module_status)",
        )
        .bind(tenant)
        .bind(brick)
        .bind(status)
        .execute(&app.db)
        .await
        .expect("module row");
    }
    let username = format!("bgadmin_{}", suffix.to_lowercase());
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
         SELECT $1, $2, $2 || '@brick-gate.example.org', 'Ward Admin', 'hospital_admin', \
                password_hash FROM users WHERE username = 'admin'",
    )
    .bind(tenant)
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("admin");
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: serde_json::Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": "admin123", "hospital_code": code }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().expect("csrf").to_owned();
    (client, csrf, tenant)
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
    let (client, csrf, tenant) = emr_off_hospital(&app).await;
    let encounter = ipd_encounter(&app, tenant).await;

    for path in [
        "/api/opd/queue",
        "/api/opd/queue/wait-estimate",
        "/api/opd/docket",
        "/api/opd/reminders",
        "/api/opd/encounters",
    ] {
        let status = app.get(&client, path).await.status();
        assert_eq!(status, StatusCode::FORBIDDEN, "{path} is the OPD desk");
    }
    let vitals = client
        .post(app.url(&format!("/api/opd/encounters/{encounter}/vitals")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "pulse": 88, "systolic_bp": 128, "diastolic_bp": 82, "spo2": 97 }))
        .send()
        .await
        .expect("vitals request")
        .status();
    assert!(
        vitals.is_success(),
        "IPD vitals must still record: {vitals}"
    );
    let read = app
        .get(&client, &format!("/api/opd/encounters/{encounter}/vitals"))
        .await
        .status();
    assert_eq!(read, StatusCode::OK, "IPD vitals must still read");
    let prescriptions = app
        .get(
            &client,
            &format!("/api/opd/encounters/{encounter}/prescriptions"),
        )
        .await
        .status();
    assert_eq!(
        prescriptions,
        StatusCode::OK,
        "IPD prescriptions must still read"
    );
}

/// Sets a brick's status as `client`, with any extra body fields; returns the status and body.
async fn switch_as(
    app: &common::TestApp,
    client: &reqwest::Client,
    csrf: &str,
    code: &str,
    body: serde_json::Value,
) -> (StatusCode, String) {
    let resp = client
        .put(app.url(&format!("/api/setup/modules/{code}")))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("module switch");
    (resp.status(), resp.text().await.unwrap_or_default())
}

/// The codes of a hospital's live `module_config` rows in `status`, in order.
async fn codes_in(app: &common::TestApp, tenant: Uuid, status: &str) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT code FROM module_config WHERE tenant_id = $1 AND status = $2::module_status \
         AND deleted_at IS NULL ORDER BY code",
    )
    .bind(tenant)
    .bind(status)
    .fetch_all(&app.db)
    .await
    .expect("module rows")
}

/// The Registration + OPD hospital: Maternity and the other bricks that need IPD were never set
/// up (no row), yet a missing row counts as on and they answer their API. The refusal names
/// them as such, and `together` writes them an explicit `disabled` row, so IPD can go off and
/// nothing goes dark unannounced.
#[tokio::test]
async fn ipd_off_names_the_never_set_up_bricks_and_together_switches_them_off_too() {
    let app = common::spawn_app().await;
    let rows = [
        ("registration", "enabled"),
        ("opd", "enabled"),
        ("ipd", "enabled"),
    ];
    let (client, csrf, tenant) = hospital_with(&app, &rows).await;

    let off = json!({ "status": "disabled" });
    let (status, body) = switch_as(&app, &client, &csrf, "ipd", off).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.contains("Maternity (on, never set up)"), "{body}");
    assert!(!body.contains("(switched on)"), "{body}");
    assert_eq!(codes_in(&app, tenant, "disabled").await, [] as [&str; 0]);

    let both = json!({ "status": "disabled", "together": true });
    let (status, body) = switch_as(&app, &client, &csrf, "ipd", both).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        codes_in(&app, tenant, "enabled").await,
        ["opd", "registration"]
    );
    let off = codes_in(&app, tenant, "disabled").await;
    for code in ["ipd", "maternity", "nursing", "ot"] {
        assert!(
            off.iter().any(|c| c == code),
            "{code} has no disabled row: {off:?}"
        );
    }
}

/// A refusal tells a brick this hospital switched on from one that is on because nobody set it
/// up, names both, and `together` takes both along.
#[tokio::test]
async fn ipd_off_marks_switched_on_and_never_set_up_bricks_apart() {
    let app = common::spawn_app().await;
    let rows = [
        ("registration", "enabled"),
        ("ipd", "enabled"),
        ("nursing", "enabled"),
        ("ot", "available"),
        ("diet", "disabled"),
    ];
    let (client, csrf, tenant) = hospital_with(&app, &rows).await;

    let off = json!({ "status": "disabled" });
    let (status, body) = switch_as(&app, &client, &csrf, "ipd", off).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    for named in [
        "Nursing Station (switched on)",
        "Operation Theatre (on, never set up)",
        "Maternity (on, never set up)",
    ] {
        assert!(body.contains(named), "{named} missing: {body}");
    }
    assert!(!body.contains("Diet"), "Diet is off: {body}");

    let both = json!({ "status": "disabled", "together": true });
    let (status, body) = switch_as(&app, &client, &csrf, "ipd", both).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let off = codes_in(&app, tenant, "disabled").await;
    for code in ["diet", "ipd", "maternity", "nursing", "ot"] {
        assert!(
            off.iter().any(|c| c == code),
            "{code} has no disabled row: {off:?}"
        );
    }
    assert_eq!(codes_in(&app, tenant, "enabled").await, ["registration"]);
}

/// The Modules screen lists every brick the server serves, the ones a hospital never set up
/// included, by what the module check answers; and one with no row can be switched off from it,
/// which writes the explicit row. A Registration + OPD hospital reaches that from the screen.
#[tokio::test]
async fn modules_list_shows_bricks_with_no_row_and_switches_one_off() {
    let app = common::spawn_app().await;
    let rows = [("registration", "enabled"), ("opd", "enabled")];
    let (client, csrf, tenant) = hospital_with(&app, &rows).await;
    let listed = |code: &'static str| {
        let client = client.clone();
        let app = &app;
        async move {
            let list: Vec<serde_json::Value> = app
                .get(&client, "/api/setup/modules")
                .await
                .json()
                .await
                .expect("modules");
            list.into_iter().find(|m| m["code"] == code).expect(code)
        }
    };

    let dental = listed("dental").await;
    assert_eq!(
        (dental["status"].as_str(), dental["on"].as_bool()),
        (Some("available"), Some(true))
    );
    assert_eq!(
        listed("companion").await["on"],
        false,
        "an add-on with no row is off"
    );

    let off = json!({ "status": "disabled" });
    let (status, body) = switch_as(&app, &client, &csrf, "dental", off).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(codes_in(&app, tenant, "disabled").await, ["dental"]);
    let dental = listed("dental").await;
    assert_eq!(
        (dental["status"].as_str(), dental["on"].as_bool()),
        (Some("disabled"), Some(false))
    );
}
