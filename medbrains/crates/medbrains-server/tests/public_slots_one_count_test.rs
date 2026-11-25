//! A doctor's public slots show the same availability, counted in one query
//! for the day instead of one per slot.

use crate::{common, query_count};

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn twelve_slots_answer_with_the_same_counts_in_one_query() {
    let app = common::spawn_app().await;
    let code = format!(
        "PS{}",
        Uuid::new_v4().simple().to_string()[..10].to_uppercase()
    );
    // A hospital of its own, bookable, with one doctor on Wednesdays 09:00-12:00
    // in 15-minute slots of two patients each.
    let doctor: Uuid = sqlx::query_scalar(
        "WITH t AS (INSERT INTO tenants (code, name, hospital_type) \
                    VALUES ($1, 'Slots Hospital', 'multi_specialty') RETURNING id), \
              s AS (INSERT INTO tenant_settings (tenant_id, category, key, value) \
                    SELECT id, 'appointments', 'public_booking_enabled', 'true'::jsonb FROM t), \
              u AS (INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
                    SELECT t.id, lower($1) || '_dr', $1 || '@slots.example.org', 'Slot Doctor', 'doctor', \
                           a.password_hash FROM t, users a WHERE a.username = 'admin' \
                    RETURNING id, tenant_id), \
              d AS (INSERT INTO departments (tenant_id, code, name, department_type) \
                    SELECT tenant_id, 'GEN', 'General', 'clinical' FROM u RETURNING id), \
              ds AS (INSERT INTO doctor_schedules (tenant_id, doctor_id, department_id, day_of_week, \
                       start_time, end_time, slot_duration_mins, max_patients) \
                     SELECT u.tenant_id, u.id, d.id, 3, '09:00', '12:00', 15, 2 FROM u, d), \
              p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                    SELECT tenant_id, $1 || '-p', 'Slot', 'Patient', 'other'::gender, '9000000005' \
                      FROM u RETURNING id, tenant_id) \
         INSERT INTO appointments (tenant_id, patient_id, doctor_id, department_id, \
                                   appointment_date, slot_start, slot_end, status, created_by) \
         SELECT u.tenant_id, p.id, u.id, d.id, DATE '2030-01-02', v.st::time, \
                (v.st::time + interval '15 minutes'), v.status::appointment_status, u.id \
           FROM u, p, d, (VALUES ('09:00', 'scheduled'), ('09:00', 'scheduled'), \
                                 ('09:30', 'scheduled'), ('10:00', 'cancelled')) AS v(st, status) \
         RETURNING doctor_id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("a bookable doctor with four bookings");

    // 2030-01-02 is a Wednesday.
    let resp = app
        .client
        .get(app.url(&format!(
            "/api/public/appointments/slots?tenant_code={code}&doctor_id={doctor}&date=2030-01-02"
        )))
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), StatusCode::OK);
    let statements = query_count::of(&resp).expect("statement count");
    let slots: Value = resp.json().await.expect("json");
    let shown: Vec<(String, i64)> = slots
        .as_array()
        .expect("slots")
        .iter()
        .map(|s| {
            let start = s["start_time"].as_str().unwrap_or_default().to_owned();
            (start, s["booked_count"].as_i64().unwrap_or(-1))
        })
        .collect();
    // 09:00 is full (two of two) and not offered; 09:30 has one; a cancelled
    // booking at 10:00 does not count.
    assert_eq!(shown.len(), 11, "{shown:?}");
    assert!(
        !shown.iter().any(|(t, _)| t.starts_with("09:00")),
        "{shown:?}"
    );
    assert!(shown.contains(&("09:30:00".to_owned(), 1)), "{shown:?}");
    assert!(shown.contains(&("10:00:00".to_owned(), 0)), "{shown:?}");
    assert!(
        statements < 12,
        "{statements} statements for a day of 12 slots"
    );
}
