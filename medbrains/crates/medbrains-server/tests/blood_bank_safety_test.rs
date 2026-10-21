//! The blood bank's statutory gates, through the real API.
//!
//! D&C Rules Part XII-B / NACO: no unit leaves quarantine until HIV, HBsAg,
//! HCV, syphilis and malaria are all non-reactive; a reactive result is final.
//! NBTC: a deferred donor, or one inside the 90/120-day whole-blood interval,
//! is not bled. AABB/NABH: a red-cell unit is issued on a compatible
//! crossmatch for that patient and unit, or as emergency O-negative by a
//! holder of the override, with a reason, on the audit log. IPSG-1: the
//! wristband is checked against the unit's patient before it is hung.

use crate::common;

use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

const MARKERS: [&str; 5] = ["hiv", "hbsag", "hcv", "syphilis", "malaria"];

async fn call(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    method: Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn ok(app: &common::TestApp, csrf: &str, method: Method, path: &str, body: Value) -> Value {
    let (status, v) = call(app, &app.client, csrf, method, path, body).await;
    assert!(status.is_success(), "{path} → {status}: {v}");
    v
}

fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_owned()
}

async fn admin_tenant(app: &common::TestApp) -> (Uuid, Uuid) {
    sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin")
}

async fn donor(app: &common::TestApp, csrf: &str, group: &str, gender: &str) -> String {
    let d = ok(
        app,
        csrf,
        Method::POST,
        "/api/blood-bank/donors",
        json!({ "donor_number": format!("BBS-{}", tag()), "first_name": "Safety",
                "last_name": "Donor", "blood_group": group, "gender": gender,
                "date_of_birth": "1990-01-01" }),
    )
    .await;
    d["id"].as_str().expect("donor id").to_owned()
}

async fn donation(app: &common::TestApp, csrf: &str, donor_id: &str) -> String {
    let d = ok(
        app,
        csrf,
        Method::POST,
        &format!("/api/blood-bank/donors/{donor_id}/donations"),
        json!({ "bag_number": format!("BBS-BAG-{}", tag()), "volume_ml": 450,
                "weight_kg": 60.0, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72 }),
    )
    .await;
    d["id"].as_str().expect("donation id").to_owned()
}

async fn component(
    app: &common::TestApp,
    csrf: &str,
    donation_id: &str,
    group: &str,
    ct: &str,
) -> Value {
    let expiry = (chrono::Utc::now() + chrono::Duration::days(30)).to_rfc3339();
    ok(
        app,
        csrf,
        Method::POST,
        "/api/blood-bank/components",
        json!({ "donation_id": donation_id, "component_type": ct,
                "bag_number": format!("BBS-C-{}", tag()), "blood_group": group,
                "volume_ml": 250, "expiry_at": expiry }),
    )
    .await
}

async fn record_tti(
    app: &common::TestApp,
    csrf: &str,
    donation_id: &str,
    results: &[(&str, &str)],
) -> (StatusCode, Value) {
    let body = json!({ "results": results.iter()
        .map(|(m, r)| json!({ "marker": m, "result": r, "method": "ELISA" }))
        .collect::<Vec<_>>() });
    call(
        app,
        &app.client,
        csrf,
        Method::POST,
        &format!("/api/blood-bank/donations/{donation_id}/tti"),
        body,
    )
    .await
}

async fn set_status(app: &common::TestApp, csrf: &str, id: &str, status: &str) -> StatusCode {
    call(
        app,
        &app.client,
        csrf,
        Method::PUT,
        &format!("/api/blood-bank/components/{id}/status"),
        json!({ "status": status }),
    )
    .await
    .0
}

/// A screened, released unit of the given group and type.
async fn cleared_unit(app: &common::TestApp, csrf: &str, group: &str, ct: &str) -> String {
    let donor_id = donor(app, csrf, group, "male").await;
    let donation_id = donation(app, csrf, &donor_id).await;
    let all: Vec<(&str, &str)> = MARKERS.iter().map(|m| (*m, "non_reactive")).collect();
    assert!(
        record_tti(app, csrf, &donation_id, &all)
            .await
            .0
            .is_success()
    );
    let unit = component(app, csrf, &donation_id, group, ct).await;
    let id = unit["id"].as_str().expect("component id").to_owned();
    assert_eq!(
        set_status(app, csrf, &id, "available").await,
        StatusCode::OK
    );
    id
}

async fn audited(app: &common::TestApp, action: &str, entity: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = $1 AND entity_id::text = $2 \
           AND created_at > now() - interval '10 minutes'",
    )
    .bind(action)
    .bind(entity)
    .fetch_one(&app.db)
    .await
    .expect("audit count")
}

async fn patient(app: &common::TestApp, tenant: Uuid, group: &str) -> (Uuid, String) {
    let uhid = format!("UH-BBS-{}", tag());
    let id = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, blood_group) \
         VALUES ($1, $2, 'Safety', 'Patient', 'female', '9000000077', $3::blood_group) RETURNING id",
    )
    .bind(tenant)
    .bind(&uhid)
    .bind(group)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    (id, uhid)
}

async fn two_verifiers(app: &common::TestApp, tenant: Uuid, admin: Uuid) -> Uuid {
    sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND is_active AND id <> $2 LIMIT 1",
    )
    .bind(tenant)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("a second active user")
}

fn issue_body(patient: Uuid, unit: &str, a: Uuid, b: Uuid) -> Value {
    json!({ "patient_id": patient, "component_id": unit,
            "patient_verified_by": a, "product_verified_by": b })
}

async fn crossmatch(app: &common::TestApp, csrf: &str, patient: Uuid, group: &str, unit: &str) {
    let xm = ok(
        app,
        csrf,
        Method::POST,
        "/api/blood-bank/crossmatch",
        json!({ "patient_id": patient, "blood_group": group }),
    )
    .await;
    ok(
        app,
        csrf,
        Method::PUT,
        &format!(
            "/api/blood-bank/crossmatch/{}",
            xm["id"].as_str().expect("xm id")
        ),
        json!({ "status": "compatible", "result": "compatible", "component_id": unit }),
    )
    .await;
}

#[tokio::test]
async fn a_unit_is_released_only_when_all_five_markers_are_non_reactive() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let donor_id = donor(&app, &csrf, "o_positive", "male").await;
    let donation_id = donation(&app, &csrf, &donor_id).await;
    let unit = component(&app, &csrf, &donation_id, "o_positive", "prbc").await;
    let id = unit["id"].as_str().expect("id").to_owned();
    assert_eq!(unit["tti_status"], "pending");

    assert_eq!(
        set_status(&app, &csrf, &id, "available").await,
        StatusCode::CONFLICT,
        "unscreened"
    );
    assert_eq!(
        audited(&app, "blood_bank.release_refused", &id).await,
        1,
        "the refusal is audited"
    );

    let four: Vec<(&str, &str)> = MARKERS[..4].iter().map(|m| (*m, "non_reactive")).collect();
    let (_, panel) = record_tti(&app, &csrf, &donation_id, &four).await;
    assert_eq!(panel["status"], "incomplete");
    assert_eq!(panel["outstanding"], json!(["malaria"]));
    assert_eq!(
        set_status(&app, &csrf, &id, "available").await,
        StatusCode::CONFLICT,
        "four of five"
    );

    let (_, panel) = record_tti(&app, &csrf, &donation_id, &[("malaria", "indeterminate")]).await;
    assert_eq!(
        panel["status"], "incomplete",
        "indeterminate is not non-reactive"
    );
    let (_, panel) = record_tti(&app, &csrf, &donation_id, &[("malaria", "non_reactive")]).await;
    assert_eq!(
        panel["status"], "cleared",
        "a re-test replaces an indeterminate"
    );
    assert_eq!(
        set_status(&app, &csrf, &id, "available").await,
        StatusCode::OK
    );
}

#[tokio::test]
async fn a_reactive_marker_quarantines_defers_the_donor_and_is_final() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let donor_id = donor(&app, &csrf, "b_positive", "female").await;
    let donation_id = donation(&app, &csrf, &donor_id).await;
    let unit = component(&app, &csrf, &donation_id, "b_positive", "prbc").await;
    let id = unit["id"].as_str().expect("id").to_owned();

    let (status, panel) = record_tti(&app, &csrf, &donation_id, &[("hbsag", "reactive")]).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(panel["status"], "reactive");
    let (unit_status, deferred): (String, bool) = sqlx::query_as(
        "SELECT c.status::text, d.is_deferred FROM blood_components c \
           JOIN blood_donations dn ON dn.id = c.donation_id JOIN blood_donors d ON d.id = dn.donor_id \
          WHERE c.id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("unit + donor");
    assert_eq!(unit_status, "quarantined");
    assert!(deferred, "the donor is deferred");

    let (status, _) = record_tti(&app, &csrf, &donation_id, &[("hbsag", "non_reactive")]).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a reactive result cannot be cleared"
    );
    assert_eq!(
        audited(&app, "blood_bank.tti_overwrite_refused", &donation_id).await,
        1
    );
    assert_eq!(
        set_status(&app, &csrf, &id, "available").await,
        StatusCode::CONFLICT
    );

    // The deferral holds at the next collection.
    let (status, _) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        &format!("/api/blood-bank/donors/{donor_id}/donations"),
        json!({ "bag_number": format!("BBS-BAG-{}", tag()), "volume_ml": 450,
                "weight_kg": 60.0, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72 }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "a deferred donor is not bled");

    // Nor is a TTI-reactive donor reinstated from the deferral screen.
    let (status, _) = call(
        &app,
        &app.client,
        &csrf,
        Method::PUT,
        &format!("/api/blood-bank/donors/{donor_id}/deferral"),
        json!({ "deferred": false, "reason": "looks fine" }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "reactive donors stay deferred"
    );
}

#[tokio::test]
async fn whole_blood_is_not_collected_inside_the_minimum_interval() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let man = donor(&app, &csrf, "a_positive", "male").await;
    donation(&app, &csrf, &man).await;
    let (status, body) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        &format!("/api/blood-bank/donors/{man}/donations"),
        json!({ "bag_number": format!("BBS-BAG-{}", tag()), "volume_ml": 450,
                "weight_kg": 60.0, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72 }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "same day: {body}");
    assert_eq!(audited(&app, "blood_bank.donation_refused", &man).await, 1);

    // A woman who declared a donation 100 days ago waits 120; at 130 she may give.
    let woman = donor(&app, &csrf, "a_positive", "female").await;
    let set_last = |days: i32| {
        sqlx::query("UPDATE blood_donors SET last_donation_date = CURRENT_DATE - $2::int WHERE id = $1::uuid")
            .bind(woman.clone())
            .bind(days)
    };
    set_last(100).execute(&app.db).await.expect("last donation");
    let path = format!("/api/blood-bank/donors/{woman}/donations");
    let bag = || {
        json!({ "bag_number": format!("BBS-BAG-{}", tag()), "volume_ml": 450,
                "weight_kg": 60.0, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72 })
    };
    assert_eq!(
        call(&app, &app.client, &csrf, Method::POST, &path, bag())
            .await
            .0,
        StatusCode::CONFLICT
    );
    set_last(130).execute(&app.db).await.expect("last donation");
    assert_eq!(
        call(&app, &app.client, &csrf, Method::POST, &path, bag())
            .await
            .0,
        StatusCode::OK
    );
}

#[tokio::test]
async fn issue_needs_a_crossmatch_or_an_audited_emergency_o_negative_release() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin) = admin_tenant(&app).await;
    let other = two_verifiers(&app, tenant, admin).await;
    let (pt, _) = patient(&app, tenant, "a_positive").await;

    let o_pos = cleared_unit(&app, &csrf, "o_positive", "prbc").await;
    let (status, body) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        issue_body(pt, &o_pos, admin, other),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "no crossmatch: {body}");
    assert_eq!(audited(&app, "blood_bank.issue_refused", &o_pos).await, 1);

    let mut emergency = issue_body(pt, &o_pos, admin, other);
    emergency["emergency_release"] = json!(true);
    emergency["emergency_reason"] = json!("Massive PPH, Dr Rao, group pending");
    let (status, _) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        emergency,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "emergency release is O-negative only"
    );

    let o_neg = cleared_unit(&app, &csrf, "o_negative", "prbc").await;
    let mut no_reason = issue_body(pt, &o_neg, admin, other);
    no_reason["emergency_release"] = json!(true);
    let (status, _) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        no_reason,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "a reason is mandatory");

    let mut released = issue_body(pt, &o_neg, admin, other);
    released["emergency_release"] = json!(true);
    released["emergency_reason"] = json!("Massive PPH, Dr Rao, group pending");
    let record = ok(
        &app,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        released,
    )
    .await;
    assert_eq!(record["emergency_release"], true);
    let record_id = record["id"].as_str().expect("record id");
    assert_eq!(
        audited(
            &app,
            "blood_bank.emergency_uncrossmatched_release",
            record_id
        )
        .await,
        1
    );

    // The ordinary path: a compatible crossmatch for this patient and unit.
    crossmatch(&app, &csrf, pt, "a_positive", &o_pos).await;
    let record = ok(
        &app,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        issue_body(pt, &o_pos, admin, other),
    )
    .await;
    assert!(
        record["crossmatch_id"].is_string(),
        "the crossmatch is recorded on the issue"
    );

    // Plasma is issued on ABO group, not crossmatched.
    let ffp = cleared_unit(&app, &csrf, "a_positive", "ffp").await;
    ok(
        &app,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        issue_body(pt, &ffp, admin, other),
    )
    .await;

    // Without the override permission, asking for it is a 403 — never a release.
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("department");
    let t = tag();
    let (username, password) = (format!("bbt_{t}"), format!("Bbt#{t}Aa9"));
    ok(
        &app,
        &csrf,
        Method::POST,
        "/api/setup/users",
        json!({
        "username": username, "email": format!("{username}@example.test"), "password": password,
        "full_name": format!("Tech {t}"), "role": "blood_bank_tech", "department_ids": [dept] }),
    )
    .await;
    sqlx::query(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', '[]'::jsonb, \
           'denied', jsonb_build_array('blood_bank.transfusion.emergency_release')) \
         WHERE username = $1",
    )
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("deny the override");
    let tech = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = tech
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let tech_csrf = login["csrf_token"].as_str().unwrap_or("").to_owned();
    let o_neg2 = cleared_unit(&app, &csrf, "o_negative", "prbc").await;
    let mut asked = issue_body(pt, &o_neg2, admin, other);
    asked["emergency_release"] = json!(true);
    asked["emergency_reason"] = json!("trauma bay");
    let (status, _) = call(
        &app,
        &tech,
        &tech_csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        asked,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn the_wristband_must_be_the_unit_patients_before_the_unit_is_hung() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin) = admin_tenant(&app).await;
    let other = two_verifiers(&app, tenant, admin).await;
    let (pt, uhid) = patient(&app, tenant, "a_positive").await;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(tenant)
    .bind(pt)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(pt)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("admission");

    let unit = cleared_unit(&app, &csrf, "o_positive", "prbc").await;
    let bag: String =
        sqlx::query_scalar("SELECT bag_number FROM blood_components WHERE id = $1::uuid")
            .bind(&unit)
            .fetch_one(&app.db)
            .await
            .expect("bag");
    let hang = |wristband: &str| {
        json!({
        "product_type": "prbc", "bag_number": bag, "blood_group": "O+", "volume_ml": 250,
        "expiry_date": (chrono::Utc::now() + chrono::Duration::days(20)).date_naive().to_string(),
        "crossmatch_compatible": true, "consent_on_file": true,
        "product_verified_by_id": other, "wristband_uhid": wristband })
    };
    let path = format!("/api/ipd/admissions/{admission}/transfusions");

    let (status, _) = call(&app, &app.client, &csrf, Method::POST, &path, hang(&uhid)).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a unit the bank never issued is not hung"
    );

    crossmatch(&app, &csrf, pt, "a_positive", &unit).await;
    ok(
        &app,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        issue_body(pt, &unit, admin, other),
    )
    .await;

    let (status, _) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        &path,
        hang("UH-SOMEONE-ELSE"),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "wrong wristband");
    assert_eq!(
        audited(
            &app,
            "blood_bank.bedside_wrong_patient",
            &admission.to_string()
        )
        .await,
        1
    );
    let (status, _) = call(&app, &app.client, &csrf, Method::POST, &path, hang(" ")).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "no wristband scanned");

    let started = ok(&app, &csrf, Method::POST, &path, hang(&uhid.to_lowercase())).await;
    assert!(started["transfusion_start_time"].is_string());
}

#[tokio::test]
async fn screening_at_the_couch_and_a_manual_deferral_gate_the_collection() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let d = donor(&app, &csrf, "o_positive", "female").await;
    let path = format!("/api/blood-bank/donors/{d}/donations");
    let collect = |weight: f64, hb: f64, ml: i32| {
        json!({ "bag_number": format!("BBS-BAG-{}", tag()), "volume_ml": ml,
                "weight_kg": weight, "hemoglobin_g_dl": hb, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72 })
    };
    let (app_ref, csrf_ref) = (&app, csrf.as_str());
    let path_ref = path.as_str();
    let post = move |body: Value| {
        call(
            app_ref,
            &app_ref.client,
            csrf_ref,
            Method::POST,
            path_ref,
            body,
        )
    };

    let (status, body) = post(collect(60.0, 12.0, 450)).await;
    assert_eq!(status, StatusCode::CONFLICT, "Hb 12.0: {body}");
    assert_eq!(
        post(collect(50.0, 13.0, 450)).await.0,
        StatusCode::CONFLICT,
        "50 kg, 450 ml"
    );
    let unmeasured = json!({ "bag_number": format!("BBS-BAG-{}", tag()), "volume_ml": 350 });
    assert_eq!(
        post(unmeasured).await.0,
        StatusCode::CONFLICT,
        "not measured"
    );

    let deferral = format!("/api/blood-bank/donors/{d}/deferral");
    let until = (chrono::Utc::now() + chrono::Duration::days(30))
        .date_naive()
        .to_string();
    let deferral_ref = deferral.as_str();
    let put = move |body: Value| {
        call(
            app_ref,
            &app_ref.client,
            csrf_ref,
            Method::PUT,
            deferral_ref,
            body,
        )
    };
    assert_eq!(
        put(json!({ "deferred": true, "until": until, "reason": " " }))
            .await
            .0,
        StatusCode::BAD_REQUEST,
        "a reason is required"
    );
    let (status, deferred) =
        put(json!({ "deferred": true, "until": until, "reason": "Tattoo 2 months ago" })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(deferred["is_deferred"], true);
    assert_eq!(
        post(collect(60.0, 13.5, 450)).await.0,
        StatusCode::CONFLICT,
        "deferred"
    );
    assert_eq!(audited(&app, "blood_bank.donor_deferred", &d).await, 1);

    let (status, _) = put(json!({ "deferred": false, "reason": "MO review: fit" })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(audited(&app, "blood_bank.donor_reinstated", &d).await, 1);
    assert_eq!(
        post(collect(50.0, 13.0, 350)).await.0,
        StatusCode::OK,
        "50 kg, 350 ml"
    );
}

#[tokio::test]
async fn red_cells_are_not_issued_on_a_group_discrepancy() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin) = admin_tenant(&app).await;
    let other = two_verifiers(&app, tenant, admin).await;
    let (pt, _) = patient(&app, tenant, "a_positive").await;
    let unit = cleared_unit(&app, &csrf, "o_positive", "prbc").await;
    // The sample groups as B+, the record says A+.
    crossmatch(&app, &csrf, pt, "b_positive", &unit).await;
    let (status, body) = call(
        &app,
        &app.client,
        &csrf,
        Method::POST,
        "/api/blood-bank/transfusions",
        issue_body(pt, &unit, admin, other),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "discrepancy: {body}");
    assert_eq!(
        audited(&app, "blood_bank.group_discrepancy", &unit).await,
        1
    );
}

#[tokio::test]
async fn apheresis_needs_a_platelet_count_and_respects_the_weekly_cap() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let d = donor(&app, &csrf, "b_positive", "male").await;
    let path = format!("/api/blood-bank/donors/{d}/donations");
    let pheresis = |platelets: Option<f64>| {
        json!({ "bag_number": format!("BBS-APH-{}", tag()), "donation_type": "apheresis_platelets",
                "volume_ml": 250, "weight_kg": 65.0, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72,
                "platelet_count": platelets })
    };
    let (app_ref, csrf_ref, path_ref) = (&app, csrf.as_str(), path.as_str());
    let post = move |body: Value| {
        call(
            app_ref,
            &app_ref.client,
            csrf_ref,
            Method::POST,
            path_ref,
            body,
        )
    };
    assert_eq!(
        post(pheresis(None)).await.0,
        StatusCode::CONFLICT,
        "no count"
    );
    assert_eq!(
        post(pheresis(Some(140.0))).await.0,
        StatusCode::CONFLICT,
        "140"
    );
    assert_eq!(audited(&app, "blood_bank.donation_refused", &d).await, 2);

    // Two apheresis donations already this week (older than 48 h): the third is refused.
    let donor_id: Uuid = d.parse().expect("uuid");
    for days in [3, 5] {
        sqlx::query(
            "INSERT INTO blood_donations (tenant_id, donor_id, bag_number, donation_type, \
               volume_ml, donated_at) \
             SELECT tenant_id, id, $2, 'apheresis_platelets', 250, now() - make_interval(days => $3) \
               FROM blood_donors WHERE id = $1",
        )
        .bind(donor_id)
        .bind(format!("BBS-OLD-{}", tag()))
        .bind(days)
        .execute(&app.db)
        .await
        .expect("prior apheresis");
    }
    assert_eq!(
        post(pheresis(Some(220.0))).await.0,
        StatusCode::CONFLICT,
        "third this week"
    );
}
