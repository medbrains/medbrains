//! Early-warning scores computed from every charted vitals reading.
//!
//! A reading is scored with the tool that fits the patient — NEWS2 for an
//! adult, PEWS on the child's age chart, MEOWS for a pregnant woman — and
//! the score, its band and the next due time are stored with it. A missing
//! parameter makes the score incomplete, never normal. An urgent score opens
//! one escalation per patient that the attending doctor hears about; a worse
//! score supersedes it; it needs an acknowledgement with a response, and an
//! unacknowledged one goes further when its window passes and not before.
//! Scale 2 is a doctor's prescription; the policy is an administrator's and
//! refuses unsafe settings.

use crate::common::{self, Staff, TestApp};

use chrono::{DateTime, Utc};
use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// The tests share the hospital's early-warning policy; one at a time.
pub(crate) static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub(crate) struct Ward {
    pub(crate) encounter: Uuid,
    pub(crate) admission: Uuid,
}

/// An admitted patient born `born` ago (a Postgres interval), with `staff`
/// on the case: the first is the primary nurse, the second the attending.
pub(crate) async fn admit(app: &TestApp, born: &str, nurse: &Staff, doctor: &Staff) -> Ward {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let (encounter, admission): (Uuid, Uuid) = sqlx::query_as(
        "WITH p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, \
                        date_of_birth) \
                    VALUES ($1, $2, 'Ews', 'Patient', 'female'::gender, '9000001236', \
                            (now() - $3::interval)::date) RETURNING id), \
              e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, doctor_id) \
                    SELECT $1, p.id, 'ipd', 'open', $5 FROM p RETURNING id, patient_id), \
              a AS (INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                        attending_doctor_id, primary_nurse_id, status, admitted_at) \
                    SELECT $1, e.id, e.patient_id, $5, $5, $4, 'admitted', now() FROM e \
                    RETURNING id, encounter_id) \
         SELECT encounter_id, id FROM a",
    )
    .bind(tenant)
    .bind(format!("UH-EWS-{tag}"))
    .bind(born)
    .bind(nurse.user_id)
    .bind(doctor.user_id)
    .fetch_one(&app.db)
    .await
    .expect("admission");
    for who in [nurse.user_id, doctor.user_id] {
        sqlx::query(
            "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                    subject_type, subject_id, granted_by) \
             VALUES ($1, 'encounter', $2, 'attending_physician', 'user', $3::text, $3)",
        )
        .bind(tenant)
        .bind(encounter)
        .bind(who)
        .execute(&app.db)
        .await
        .expect("encounter grant");
    }
    Ward {
        encounter,
        admission,
    }
}

pub(crate) async fn send(
    s: &Staff,
    app: &TestApp,
    (method, path): (Method, &str),
    body: &Value,
) -> (StatusCode, Value) {
    let res = s
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", &s.csrf)
        .json(body)
        .send()
        .await
        .expect("request");
    let status = res.status();
    (status, res.json().await.unwrap_or(Value::Null))
}

/// A complete adult set, all in the white zone.
pub(crate) fn normal(encounter: Uuid) -> Value {
    json!({
        "encounter_id": encounter, "respiratory_rate": 16, "spo2": 97, "temperature": 37.0,
        "systolic_bp": 120, "diastolic_bp": 76, "pulse": 72, "consciousness": "A",
        "oxygen_device": "room_air",
    })
}

pub(crate) fn with(mut v: Value, extra: &Value) -> Value {
    for (k, x) in extra.as_object().expect("object") {
        v[k] = x.clone();
    }
    v
}

pub(crate) async fn chart(nurse: &Staff, app: &TestApp, body: &Value) -> Value {
    let (status, row) = send(nurse, app, (Method::POST, "/api/nurse/vitals"), body).await;
    assert_eq!(status, StatusCode::OK, "{row}");
    row["ews"].clone()
}

pub(crate) fn minutes_until(v: &Value) -> i64 {
    let due: DateTime<Utc> = v["next_due_at"]
        .as_str()
        .expect("due")
        .parse()
        .expect("time");
    (due - Utc::now()).num_minutes()
}

#[tokio::test]
async fn an_adult_reading_is_scored_and_an_urgent_score_escalates_once_until_acknowledged() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let w = admit(&app, "45 years", &nurse, &doctor).await;

    let ews = chart(&nurse, &app, &normal(w.encounter)).await;
    assert_eq!(
        (
            ews["tool"].as_str(),
            ews["total"].as_i64(),
            ews["band"].as_str()
        ),
        (Some("news2"), Some(0), Some("routine"))
    );
    assert_eq!(ews["incomplete"], false);
    assert!(
        (715..=720).contains(&minutes_until(&ews)),
        "NEWS2 0: 12-hourly, {ews}"
    );
    assert!(ews["escalation_id"].is_null());

    // RR 22 (2) + pulse 115 (2) + oxygen (2) = 6: urgent.
    let urgent = with(
        normal(w.encounter),
        &json!({"respiratory_rate": 22, "pulse": 115, "oxygen_device": "nasal_prongs"}),
    );
    let ews = chart(&nurse, &app, &urgent).await;
    assert_eq!(
        (ews["total"].as_i64(), ews["band"].as_str()),
        (Some(6), Some("urgent"))
    );
    assert!((55..=60).contains(&minutes_until(&ews)), "5-6: hourly");
    let first = ews["escalation_id"]
        .as_str()
        .expect("escalation")
        .to_owned();
    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE entity_id = $1::uuid AND user_id = $2",
    )
    .bind(&first)
    .bind(doctor.user_id)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(told, 1, "the attending doctor is told");

    // The next urgent set joins the open escalation; nobody is told twice.
    let again = chart(&nurse, &app, &urgent).await;
    assert_eq!(again["escalation_id"].as_str(), Some(first.as_str()));
    let told_again: i64 =
        sqlx::query_scalar("SELECT count(*) FROM notifications WHERE entity_id = $1::uuid")
            .bind(&first)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(told_again, 1);

    // Worse: new confusion makes it 9, an emergency that supersedes.
    let worse = chart(
        &nurse,
        &app,
        &with(urgent.clone(), &json!({"consciousness": "C"})),
    )
    .await;
    assert_eq!(worse["band"], "emergency");
    let second = worse["escalation_id"]
        .as_str()
        .expect("escalation")
        .to_owned();
    assert_ne!(second, first);
    let old: String = sqlx::query_scalar("SELECT status FROM ews_escalations WHERE id = $1::uuid")
        .bind(&first)
        .fetch_one(&app.db)
        .await
        .expect("old");
    assert_eq!(old, "superseded");

    let ack = format!("/api/nurse/ews/escalations/{second}/acknowledge");
    let (status, _) = send(
        &doctor,
        &app,
        (Method::PUT, &ack),
        &json!({"response_action": "bedside_review", "response_note": ""}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a response is required");
    let (status, row) = send(&doctor, &app, (Method::PUT, &ack),
        &json!({"response_action": "rapid_response_called", "response_note": "RRT at bedside, ABG sent"})).await;
    assert_eq!(status, StatusCode::OK, "{row}");
    assert_eq!(
        (row["status"].as_str(), row["response_action"].as_str()),
        (Some("acknowledged"), Some("rapid_response_called"))
    );
    let (status, _) = send(
        &doctor,
        &app,
        (Method::PUT, &ack),
        &json!({"response_action": "bedside_review", "response_note": "again"}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "acknowledged once");
    let (status, list) = send(
        &nurse,
        &app,
        (Method::GET, "/api/nurse/ews/escalations?status=all"),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        list.as_array()
            .expect("rows")
            .iter()
            .any(|r| r["admission_id"] == json!(w.admission))
    );
}

#[tokio::test]
async fn a_missing_parameter_makes_the_score_incomplete_never_normal() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let w = admit(&app, "60 years", &nurse, &doctor).await;
    let mut body = normal(w.encounter);
    body.as_object_mut().expect("obj").remove("consciousness");
    let ews = chart(&nurse, &app, &body).await;
    assert_eq!(ews["incomplete"], true);
    assert_eq!(ews["missing"], json!(["consciousness"]));
    assert!(
        minutes_until(&ews) <= 60,
        "an incomplete 0 is not left for 12 hours"
    );
    let stored: (bool, Vec<String>) = sqlx::query_as(
        "SELECT ews_incomplete, ews_missing FROM vitals WHERE encounter_id = $1 ORDER BY recorded_at DESC LIMIT 1",
    )
    .bind(w.encounter)
    .fetch_one(&app.db)
    .await
    .expect("stored");
    assert_eq!(stored, (true, vec!["consciousness".to_owned()]));
}

#[tokio::test]
async fn an_unacknowledged_escalation_goes_further_only_when_its_window_passes() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let w = admit(&app, "70 years", &nurse, &doctor).await;
    let urgent = with(
        normal(w.encounter),
        &json!({"respiratory_rate": 22, "pulse": 115, "oxygen_device": "mask"}),
    );
    let ews = chart(&nurse, &app, &urgent).await;
    let id: Uuid = ews["escalation_id"]
        .as_str()
        .expect("id")
        .parse()
        .expect("uuid");
    let state = || async {
        sqlx::query_as::<_, (i32, DateTime<Utc>)>(
            "SELECT level, next_escalation_at FROM ews_escalations WHERE id = $1",
        )
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("state")
    };
    let (level, next) = state().await;
    let window = (next - Utc::now()).num_minutes();
    assert_eq!(level, 0);
    assert!(
        (29..=30).contains(&window),
        "urgent waits 30 minutes, {window}"
    );

    medbrains_nursing::nurse_ews_overdue::escalate_due(&app.db)
        .await
        .expect("pass");
    assert_eq!(state().await.0, 0, "not before its window");

    sqlx::query(
        "UPDATE ews_escalations SET next_escalation_at = now() - interval '1 minute' WHERE id = $1",
    )
    .bind(id)
    .execute(&app.db)
    .await
    .expect("time passes");
    medbrains_nursing::nurse_ews_overdue::escalate_due(&app.db)
        .await
        .expect("pass");
    let (level, next) = state().await;
    assert_eq!(level, 1);
    assert!(
        (next - Utc::now()).num_minutes() >= 29,
        "and waits another window"
    );
    let reminders: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE entity_id = $1 AND user_id = $2 AND title LIKE 'Not yet acknowledged%'",
    )
    .bind(id)
    .bind(doctor.user_id)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(reminders, 1);
}

#[tokio::test]
async fn children_get_pews_by_age_and_pregnant_women_get_meows() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;

    let child = admit(&app, "3 years", &nurse, &doctor).await;
    // 1-4 years: RR 42 yellow (1), HR 152 orange (2), SpO2 93 yellow (1),
    // nasal 1 L/min (2), mild distress (1), CRT 2 s (0), SBP 100 white (0) = 7.
    let ews = chart(
        &nurse,
        &app,
        &json!({
            "encounter_id": child.encounter, "respiratory_rate": 42, "pulse": 152, "spo2": 93,
            "oxygen_device": "nasal_prongs", "oxygen_flow_lpm": 1.0, "respiratory_distress": "mild",
            "capillary_refill_seconds": 2.0, "systolic_bp": 100,
        }),
    )
    .await;
    assert_eq!(
        (ews["tool"].as_str(), ews["age_band"].as_str()),
        (Some("pews"), Some("1-4y"))
    );
    assert_eq!(
        (
            ews["total"].as_i64(),
            ews["band"].as_str(),
            ews["incomplete"].as_bool()
        ),
        (Some(7), Some("urgent"), Some(false))
    );

    let mother = admit(&app, "28 years", &nurse, &doctor).await;
    sqlx::query(
        "INSERT INTO maternity_registrations (tenant_id, patient_id, registration_number, lmp_date, edd_date) \
         SELECT tenant_id, patient_id, 'MR-' || left(gen_random_uuid()::text, 8), CURRENT_DATE - 200, \
                CURRENT_DATE + 80 FROM encounters WHERE id = $1",
    )
    .bind(mother.encounter)
    .execute(&app.db)
    .await
    .expect("pregnant");
    // One yellow (pulse 105) watches more closely; a second (DBP 95) triggers.
    let one = chart(
        &nurse,
        &app,
        &with(normal(mother.encounter), &json!({"pulse": 105})),
    )
    .await;
    assert_eq!(
        (one["tool"].as_str(), one["band"].as_str()),
        (Some("meows"), Some("low"))
    );
    let two = chart(
        &nurse,
        &app,
        &with(
            normal(mother.encounter),
            &json!({"pulse": 105, "diastolic_bp": 95}),
        ),
    )
    .await;
    assert_eq!(two["band"], "urgent");
    assert!(two["escalation_id"].is_string());
}
