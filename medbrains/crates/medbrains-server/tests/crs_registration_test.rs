//! Civil registration of births and deaths (migration 1315).
//!
//! Every birth and death the hospital records -- in the labour room, the
//! birth register, the death summary (MCCD) or the death register -- is one
//! event owed to the registrar within 21 days, whichever books it is in.

use crate::common;
use crate::notifiable_detection_test::{Hospital, hospital};

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn events(h: &Hospital, app: &common::TestApp) -> Vec<Value> {
    serde_json::from_value(h.call(app, Method::GET, "/api/mrd/crs", Value::Null).await)
        .unwrap_or_default()
}

fn of(events: &[Value], patient: &Value) -> Vec<Value> {
    events
        .iter()
        .filter(|e| e["patient_id"] == patient["id"])
        .cloned()
        .collect()
}

/// Given a death written in the death summary and again in the death
/// register, Then it is one event due 21 days later; its report says the
/// cause was medically certified; and recording its registration closes it
/// and marks the death register reported -- with both steps disclosed.
#[tokio::test]
async fn a_death_in_two_books_is_one_report_due_in_21_days() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let patient = h.patient(&app, "9990001001").await;
    let admission = h.admit(&app, &patient).await;
    let admission_id = admission["admission"]["id"].as_str().expect("admission");
    h.call(
        &app,
        Method::POST,
        &format!("/api/ipd/admissions/{admission_id}/death-summary"),
        json!({ "date_of_death": "2026-10-01", "time_of_death": "04:30:00",
                "cause_of_death_primary": "Septic shock",
                "cause_of_death_underlying": "Lobar pneumonia", "form_type": "form_4" }),
    )
    .await;
    h.call(
        &app,
        Method::POST,
        "/api/mrd/deaths",
        json!({ "patient_id": patient["id"], "admission_id": admission_id,
                "register_number": "DR-1", "death_date": "2026-10-01" }),
    )
    .await;

    let mine = of(&events(&h, &app).await, &patient);
    assert_eq!(mine.len(), 1, "one death, however many books: {mine:?}");
    assert_eq!(mine[0]["due_on"], "2026-10-22");
    assert_eq!(mine[0]["mccd_form"], "form_4");
    assert_eq!(mine[0]["in_death_register"], true);
    let id = mine[0]["id"].as_str().expect("event").to_owned();

    let form = h
        .call(
            &app,
            Method::GET,
            &format!("/api/mrd/crs/{id}/form"),
            Value::Null,
        )
        .await;
    let value = |label: &str| {
        form["fields"]
            .as_array()
            .and_then(|f| f.iter().find(|x| x["label"] == label))
            .map(|x| x["value"].clone())
            .unwrap_or(Value::Null)
    };
    assert_eq!(value("Date of death"), "01/10/2026");
    assert_eq!(
        value("Was the cause of death medically certified?"),
        "Yes (MCCD Form 4)"
    );
    assert_eq!(
        value("Name of disease or actual cause of death"),
        "Lobar pneumonia"
    );

    let path = format!("/api/mrd/crs/{id}");
    let early = json!({ "crs_registration_number": "D-2026-1", "registered_on": "2026-09-30" });
    let resp = h
        .client
        .put(app.url(&path))
        .header("x-csrf-token", &h.csrf)
        .json(&early)
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let done = h
        .call(
            &app,
            Method::PUT,
            &path,
            json!({ "crs_registration_number": "D-2026-1", "registered_on": "2026-10-05" }),
        )
        .await;
    assert_eq!(done["status"], "registered");

    let reported: bool = sqlx::query_scalar(
        "SELECT reported_to_municipality FROM mrd_death_register WHERE tenant_id = $1",
    )
    .bind(h.tenant)
    .fetch_one(&app.db)
    .await
    .expect("register");
    assert!(reported);
    let disclosed: Vec<String> = sqlx::query_scalar(
        "SELECT new_values->>'stage' FROM audit_log WHERE tenant_id = $1 \
            AND action = 'statutory_disclosure' AND entity_type = 'crs_events' \
          ORDER BY created_at",
    )
    .bind(h.tenant)
    .fetch_all(&app.db)
    .await
    .expect("audit");
    assert_eq!(disclosed, vec!["prepared", "submitted"]);
}

/// Given twins of one sex in the birth register and the same baby in the
/// labour room, Then the labour-room record matches one register entry, not
/// both: two births, not one and not three.
#[tokio::test]
async fn a_baby_in_two_books_is_one_birth_and_twins_stay_two() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let mother = h.patient(&app, "9990001002").await;
    for n in ["BR-1", "BR-2"] {
        h.call(
            &app,
            Method::POST,
            "/api/mrd/births",
            json!({ "patient_id": mother["id"], "register_number": n,
                    "birth_date": "2026-10-20", "baby_gender": "female",
                    "baby_weight_grams": 2400 }),
        )
        .await;
    }
    let registration: Uuid = sqlx::query_scalar(
        "INSERT INTO maternity_registrations (tenant_id, patient_id, registration_number, \
                                              lmp_date, edd_date) \
         VALUES ($1, $2::uuid, 'MAT-CRS', DATE '2026-01-20', DATE '2026-10-27') RETURNING id",
    )
    .bind(h.tenant)
    .bind(mother["id"].as_str())
    .fetch_one(&app.db)
    .await
    .expect("registration");
    let labor: Uuid = sqlx::query_scalar(
        "INSERT INTO labor_records (tenant_id, registration_id, delivery_type) \
         VALUES ($1, $2, 'lscs_emergency') RETURNING id",
    )
    .bind(h.tenant)
    .bind(registration)
    .fetch_one(&app.db)
    .await
    .expect("labor");
    sqlx::query(
        "INSERT INTO newborn_records (tenant_id, labor_id, birth_date, date_of_birth, gender, \
                                      weight_gm, mother_id) \
         VALUES ($1, $2, TIMESTAMPTZ '2026-10-20 10:00+05:30', DATE '2026-10-20', 'female', \
                 2400, $3::uuid)",
    )
    .bind(h.tenant)
    .bind(labor)
    .bind(mother["id"].as_str())
    .execute(&app.db)
    .await
    .expect("newborn");

    let births = of(&events(&h, &app).await, &mother);
    assert_eq!(births.len(), 2, "twins are two births: {births:?}");
    let matched = births
        .iter()
        .filter(|b| b["from_maternity"] == true && b["in_birth_register"] == true)
        .count();
    assert_eq!(
        matched, 1,
        "the labour-room baby matched one register entry"
    );
    assert!(births.iter().all(|b| b["due_on"] == "2026-11-10"));

    let id = births
        .iter()
        .find(|b| b["from_maternity"] == true)
        .and_then(|b| b["id"].as_str())
        .expect("matched birth");
    let form = h
        .call(
            &app,
            Method::GET,
            &format!("/api/mrd/crs/{id}/form"),
            Value::Null,
        )
        .await;
    let value = |label: &str| {
        form["fields"]
            .as_array()
            .and_then(|f| f.iter().find(|x| x["label"] == label))
            .map(|x| x["value"].clone())
            .unwrap_or(Value::Null)
    };
    assert_eq!(value("Method of delivery"), "Caesarean");
    assert_eq!(value("Birth weight (kg)"), "2.40");
    assert_eq!(value("Duration of pregnancy (weeks)"), "39");
    assert_eq!(value("Name of the child (if named)"), Value::Null);
}
