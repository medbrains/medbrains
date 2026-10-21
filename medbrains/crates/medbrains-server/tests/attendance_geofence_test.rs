//! Attendance geofencing (#4850): a self-service start of shift carries the
//! device's location, judged against the campus fence. Flag keeps an outside
//! punch for HR; block refuses it, and refuses a punch with no location; a
//! fix looser than the fence is uncertain — flagged, never refused; an inside
//! punch is clean; the punch is dated by the hospital's clock; and only the
//! geofence permission may draw the fence or change the mode.

use crate::common;

use chrono::{Duration, NaiveDate, Timelike, Utc};
use reqwest::{RequestBuilder, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// The fence and mode are tenant-wide; tests in this file take turns.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Sunrise Hospital, Chennai, with a 300 m fence.
const CAMPUS: (f64, f64) = (13.0827, 80.2707);
const RADIUS_M: i32 = 300;
/// ~6 km south of the campus.
const HOME: (f64, f64) = (13.0287, 80.2707);

async fn send(csrf: &str, req: RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

struct World {
    hr: common::Staff,
    nurse: common::Staff,
    employee: Uuid,
}

/// One fenced campus in the tenant, drawn by HR through the settings API,
/// the mode set to `mode`, and a nurse with an employee record.
async fn world(app: &common::TestApp, mode: &str) -> World {
    let admin = app.login_admin().await;
    let tenant_id = tenant(app).await;
    sqlx::query("UPDATE facilities SET geofence_radius_m = NULL WHERE tenant_id = $1")
        .bind(tenant_id)
        .execute(&app.db)
        .await
        .expect("clear fences");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let campus: Uuid = sqlx::query_scalar(
        "INSERT INTO facilities (tenant_id, code, name, facility_type) \
         VALUES ($1, $2, 'Sunrise Hospital', 'main_hospital') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("GF-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("campus");

    let hr = common::provision_staff(app, &admin, "hr_officer", &[]).await;
    let (status, body) = send(
        &hr.csrf,
        hr.client
            .put(app.url(&format!("/api/hr/attendance/geofence/campuses/{campus}")))
            .json(&json!({ "latitude": CAMPUS.0, "longitude": CAMPUS.1, "radius_m": RADIUS_M })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(
        &hr.csrf,
        hr.client
            .put(app.url("/api/hr/attendance/geofence/mode"))
            .json(&json!({ "mode": mode })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let nurse = common::provision_staff(app, &admin, "nurse", &[]).await;
    let employee: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name, user_id) \
         VALUES ($1, $2, 'Geofence', $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("GF-{tag}"))
    .bind(nurse.user_id)
    .fetch_one(&app.db)
    .await
    .expect("employee");
    World {
        hr,
        nurse,
        employee,
    }
}

async fn start(app: &common::TestApp, w: &World, body: &Value) -> (StatusCode, Value) {
    send(
        &w.nurse.csrf,
        w.nurse
            .client
            .post(app.url("/api/hr/my-shift/start"))
            .json(body),
    )
    .await
}

fn at((lat, lng): (f64, f64), accuracy_m: f64) -> Value {
    json!({ "latitude": lat, "longitude": lng, "accuracy_m": accuracy_m })
}

async fn punches(app: &common::TestApp, employee: Uuid) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM attendance_records WHERE employee_id = $1")
        .bind(employee)
        .fetch_one(&app.db)
        .await
        .expect("count")
}

/// Given flag mode, When a nurse starts her shift 6 km from the campus,
/// Then the shift starts, the punch keeps where it was made, and HR's
/// flagged filter shows it.
#[tokio::test]
async fn flag_mode_keeps_an_outside_punch_and_marks_it_for_hr() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "flag").await;

    let (status, body) = start(&app, &w, &at(HOME, 15.0)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let loc = &body["session"]["check_in_location"];
    assert_eq!(loc["place"], "outside", "{loc}");
    assert_eq!(loc["inside"], false);
    assert_eq!(loc["flagged"], true);
    assert_eq!(loc["facility_name"], "Sunrise Hospital");
    let distance = loc["distance_m"].as_f64().unwrap_or_default();
    assert!((5900.0..6100.0).contains(&distance), "{distance}");
    assert_eq!(body["session"]["geofence_flagged"], true);
    assert_eq!(body["punch"], *loc, "the widget is told the same verdict");

    let (status, list) = send(
        &w.hr.csrf,
        w.hr.client.get(app.url(&format!(
            "/api/hr/attendance?employee_id={}&flagged=true",
            w.employee
        ))),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert_eq!(list.as_array().map(Vec::len), Some(1), "{list}");
}

/// Given block mode, When a nurse starts her shift from home, Then she is
/// refused with how far away she is, and no attendance is written.
#[tokio::test]
async fn block_mode_refuses_a_punch_from_outside() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "block").await;

    let (status, body) = start(&app, &w, &at(HOME, 15.0)).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert_eq!(
        body["detail"], "You are 6.0 km from Sunrise Hospital. Clock in on site.",
        "{body}"
    );
    assert_eq!(punches(&app, w.employee).await, 0);
}

/// Given block mode, When the browser sends no location (access denied),
/// Then the start is refused and the nurse is told to allow location.
#[tokio::test]
async fn block_mode_refuses_a_punch_without_a_location() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "block").await;

    let (status, body) = start(&app, &w, &json!({})).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(
        body["detail"]
            .as_str()
            .is_some_and(|d| d.starts_with("Allow location access")),
        "{body}"
    );
    assert_eq!(punches(&app, w.employee).await, 0);
}

/// Given block mode, When the fix is ±900 m against a 300 m fence, Then the
/// shift starts — a weak signal is not refused — and the punch is flagged
/// as uncertain.
#[tokio::test]
async fn a_fix_looser_than_the_fence_is_flagged_not_blocked() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "block").await;

    let (status, body) = start(&app, &w, &at(CAMPUS, 900.0)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let loc = &body["session"]["check_in_location"];
    assert_eq!(loc["place"], "uncertain", "{loc}");
    assert_eq!(
        loc["inside"],
        Value::Null,
        "uncertain is neither in nor out"
    );
    assert_eq!(loc["flagged"], true);
}

/// Given block mode, When the nurse starts and ends her shift on site,
/// Then both punches are kept, inside, and nothing is flagged.
#[tokio::test]
async fn an_inside_punch_is_clean() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "block").await;

    // ~40 m north of the centre.
    let (status, body) = start(&app, &w, &at((13.08306, 80.2707), 20.0)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let loc = &body["session"]["check_in_location"];
    assert_eq!(loc["place"], "inside", "{loc}");
    assert_eq!(loc["inside"], true);
    assert_eq!(loc["flagged"], false);
    assert_eq!(body["session"]["geofence_flagged"], false);

    let (status, body) = send(
        &w.nurse.csrf,
        w.nurse
            .client
            .post(app.url("/api/hr/my-shift/end"))
            .json(&at(CAMPUS, 20.0)),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["punch"]["place"], "inside", "{body}");
    let (out, flagged): (Value, bool) = sqlx::query_as(
        "SELECT check_out_location, geofence_flagged FROM attendance_records \
         WHERE employee_id = $1",
    )
    .bind(w.employee)
    .fetch_one(&app.db)
    .await
    .expect("record");
    assert_eq!(out["inside"], true, "{out}");
    assert!(!flagged);
}

/// Given a hospital whose day differs from UTC's, When a nurse starts her
/// shift, Then the attendance is dated by the hospital's calendar.
#[tokio::test]
async fn the_punch_is_dated_by_the_hospitals_clock() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "flag").await;
    let tenant_id = tenant(&app).await;

    // Pick a zone whose date is not UTC's right now: UTC+14 late in the UTC
    // day, UTC-12 early in it.
    let now = Utc::now();
    let (zone, offset_h) = if now.hour() >= 10 {
        ("Pacific/Kiritimati", 14)
    } else {
        ("Etc/GMT+12", -12)
    };
    let previous: Option<String> = sqlx::query_scalar(
        "UPDATE tenants t SET timezone = $2 FROM tenants o \
                            WHERE t.id = $1 AND o.id = t.id RETURNING o.timezone",
    )
    .bind(tenant_id)
    .bind(zone)
    .fetch_one(&app.db)
    .await
    .expect("set zone");

    let (status, body) = start(&app, &w, &at(CAMPUS, 20.0)).await;

    sqlx::query("UPDATE tenants SET timezone = $2 WHERE id = $1")
        .bind(tenant_id)
        .bind(previous)
        .execute(&app.db)
        .await
        .expect("restore zone");

    assert_eq!(status, StatusCode::OK, "{body}");
    let local = (now + Duration::hours(offset_h)).date_naive();
    assert_ne!(local, now.date_naive(), "the zone was chosen to differ");
    let dated: NaiveDate =
        sqlx::query_scalar("SELECT attendance_date FROM attendance_records WHERE employee_id = $1")
            .bind(w.employee)
            .fetch_one(&app.db)
            .await
            .expect("record");
    assert_eq!(dated, local);
}

/// Given a nurse without the geofence permission, When she reads the
/// settings or changes the mode, Then both are refused.
#[tokio::test]
async fn the_settings_need_the_geofence_permission() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let w = world(&app, "flag").await;

    let (status, _) = send(
        &w.nurse.csrf,
        w.nurse.client.get(app.url("/api/hr/attendance/geofence")),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = send(
        &w.nurse.csrf,
        w.nurse
            .client
            .put(app.url("/api/hr/attendance/geofence/mode"))
            .json(&json!({ "mode": "off" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, settings) = send(
        &w.hr.csrf,
        w.hr.client.get(app.url("/api/hr/attendance/geofence")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{settings}");
    assert_eq!(settings["mode"], "flag", "the nurse's change did not land");
}
