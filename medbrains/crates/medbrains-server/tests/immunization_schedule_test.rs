//! The immunisation schedule on a child's record, the clinic's due list,
//! the hospital's choice of schedule, and reminder SMS.

use crate::common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};

async fn send(
    app: &common::TestApp,
    csrf: &str,
    put: bool,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let req = if put {
        app.client.put(app.url(path))
    } else {
        app.client.post(app.url(path))
    };
    let resp = req
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    (
        status,
        serde_json::from_str(&text).unwrap_or(Value::String(text)),
    )
}

async fn ok(app: &common::TestApp, csrf: &str, put: bool, path: &str, body: Value) -> Value {
    let (status, body) = send(app, csrf, put, path, body).await;
    assert!(status.is_success(), "{path} → {status}: {body}");
    body
}

/// A child born `days` ago; returns (patient id, date of birth).
async fn child(app: &common::TestApp, csrf: &str, days: i64) -> (String, chrono::NaiveDate) {
    let dob = (Utc::now() + Duration::minutes(330)).date_naive() - Duration::days(days);
    let phone = format!("96{}", &uuid::Uuid::new_v4().as_u128().to_string()[..8]);
    let p = ok(
        app,
        csrf,
        false,
        "/api/patients",
        json!({ "first_name": "Vax", "last_name": "Child",
        "gender": "female", "date_of_birth": dob, "phone": phone }),
    )
    .await;
    (p["id"].as_str().expect("id").to_owned(), dob)
}

async fn dose(app: &common::TestApp, csrf: &str, patient: &str, body: Value) {
    ok(
        app,
        csrf,
        false,
        &format!("/api/patients/{patient}/immunizations"),
        body,
    )
    .await;
}

fn find<'a>(schedule: &'a Value, series: &str, label: &str) -> &'a Value {
    schedule["schedule"]["series"]
        .as_array()
        .expect("series")
        .iter()
        .find(|s| s["key"] == series)
        .expect(series)["doses"]
        .as_array()
        .expect("doses")
        .iter()
        .find(|d| d["label"] == label)
        .expect(label)
}

#[tokio::test]
async fn a_childs_schedule_due_list_setting_and_reminders() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    // Reset the hospital to UIP without reminders, whatever earlier runs left.
    ok(&app, &csrf, true, "/api/immunizations/settings",
        json!({ "kind": "uip", "include_je": false, "sms_reminders": false, "remind_days_before": 2 })).await;

    // 80 days old: birth doses from the card, Penta-1 given here at 6 weeks.
    let (patient, dob) = child(&app, &csrf, 80).await;
    for name in ["BCG", "OPV"] {
        dose(
            &app,
            &csrf,
            &patient,
            json!({ "vaccine_name": name, "administered_on": dob, "given_elsewhere": true }),
        )
        .await;
    }
    dose(
        &app,
        &csrf,
        &patient,
        json!({ "vaccine_name": "Pentavalent", "vaccine_key": "penta",
        "administered_on": dob + Duration::days(42), "lot_number": "PV123" }),
    )
    .await;
    let (status, body) = send(&app, &csrf, false, &format!("/api/patients/{patient}/immunizations"),
        json!({ "vaccine_name": "X", "vaccine_key": "not-a-vaccine", "administered_on": dob, "given_elsewhere": true })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    let s: Value = app
        .get(
            &app.client,
            &format!("/api/patients/{patient}/immunization-schedule"),
        )
        .await
        .json()
        .await
        .expect("schedule");
    assert_eq!(s["schedule"]["kind"], "uip");
    assert_eq!(find(&s, "bcg", "BCG")["state"], "given");
    assert_eq!(find(&s, "opv0", "OPV-0")["state"], "given");
    assert_eq!(find(&s, "penta", "Penta-1")["state"], "given");
    assert_eq!(find(&s, "penta", "Penta-2")["state"], "due");
    assert_eq!(
        find(&s, "rota", "Rota-1")["state"],
        "overdue",
        "not given at 6 weeks, more than 4 weeks ago"
    );
    assert_eq!(find(&s, "hepb0", "Hep B-0")["state"], "age_passed");

    // The clinic sees the child's due doses.
    let list: Value = app
        .get(&app.client, "/api/immunizations/due-list?within_days=0")
        .await
        .json()
        .await
        .expect("due");
    let mine: Vec<&Value> = list["rows"]
        .as_array()
        .expect("rows")
        .iter()
        .filter(|r| r["patient_id"] == patient.as_str())
        .collect();
    assert!(
        mine.iter()
            .any(|r| r["dose"] == "Penta-2" && r["state"] == "due"),
        "{mine:?}"
    );
    assert!(
        mine.iter()
            .any(|r| r["dose"] == "Rota-1" && r["state"] == "overdue")
    );

    // Reminders: on, 0 days before; one SMS per due dose, once.
    ok(&app, &csrf, true, "/api/immunizations/settings",
        json!({ "kind": "uip", "include_je": false, "sms_reminders": true, "remind_days_before": 0 })).await;
    medbrains_patients::immunization_schedule::send_due_reminders(&app.db)
        .await
        .expect("pass");
    medbrains_patients::immunization_schedule::send_due_reminders(&app.db)
        .await
        .expect("second pass");
    let sms: Vec<(String, Value)> = sqlx::query_as(
        "SELECT idempotency_key, payload FROM outbox_events WHERE event_type = 'sms.vaccination_reminder' \
          AND aggregate_id = $1::uuid",
    )
    .bind(&patient)
    .fetch_all(&app.db)
    .await
    .expect("sms");
    let keys: Vec<&str> = sms.iter().map(|(k, _)| k.as_str()).collect();
    assert!(keys.iter().any(|k| k.contains("Penta-2")), "{keys:?}");
    assert!(
        !keys.iter().any(|k| k.contains("Rota-1")),
        "overdue doses are for the clinic to call, not an SMS"
    );
    assert_eq!(
        keys.len(),
        keys.iter().collect::<std::collections::HashSet<_>>().len(),
        "sent once"
    );
    assert_eq!(sms[0].1["template_scope"], "vaccination_reminder");

    // Switching to IAP changes the schedule shown.
    ok(&app, &csrf, true, "/api/immunizations/settings",
        json!({ "kind": "iap", "include_je": false, "sms_reminders": false, "remind_days_before": 2 })).await;
    let s: Value = app
        .get(
            &app.client,
            &format!("/api/patients/{patient}/immunization-schedule"),
        )
        .await
        .json()
        .await
        .expect("schedule");
    assert_eq!(s["schedule"]["kind"], "iap");
    assert_eq!(
        find(&s, "dtp", "DTP-1")["state"],
        "given",
        "Pentavalent counts as DTP-1"
    );
    let (status, _) = send(&app, &csrf, true, "/api/immunizations/settings",
        json!({ "kind": "uip", "include_je": false, "sms_reminders": true, "remind_days_before": 99 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    ok(&app, &csrf, true, "/api/immunizations/settings",
        json!({ "kind": "uip", "include_je": false, "sms_reminders": false, "remind_days_before": 2 })).await;
}

#[tokio::test]
async fn the_due_list_and_the_setting_need_their_permissions() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    assert_eq!(
        app.get(&nurse.client, "/api/immunizations/due-list")
            .await
            .status(),
        StatusCode::OK
    );
    assert_eq!(
        app.get(&nurse.client, "/api/immunizations/settings")
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
    let denied =
        common::provision_staff(&app, &csrf, "nurse", &["patients.immunizations.due_list"]).await;
    assert_eq!(
        app.get(&denied.client, "/api/immunizations/due-list")
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
}
