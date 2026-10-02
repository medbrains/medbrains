//! Management KPIs read a past day against what was usual for it, through the
//! dashboard's own batch call — the path the management dashboard takes.

mod common;

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A day nobody else's data lands on: a random date in the five years from
/// `year`. Each test takes its own years, so one test's visits never fall in
/// another's 28-day window.
fn quiet_day(year: i32) -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 1800).unwrap_or(0);
    NaiveDate::from_ymd_opt(year, 2, 1).unwrap_or_default() + Duration::days(offset)
}

/// Given 5 OPD visits on a day, 3 on the same weekday a week earlier and 1
/// two weeks earlier, and two tokens waiting 10 and 20 minutes, When the
/// management dashboard reads that day, Then visits are 5 against a usual
/// 1.0 (the two quiet weeks count as zero), and the median wait is 15 min.
#[tokio::test]
async fn opd_kpis_are_read_against_the_usual_day() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let day = quiet_day(2005);
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Kpi', 'Probe', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-KPI-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    for (weeks_back, visits) in [(0, 5), (1, 3), (2, 1)] {
        sqlx::query(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_date) \
             SELECT $1, $2, 'opd', $3 FROM generate_series(1, $4)",
        )
        .bind(tenant)
        .bind(patient)
        .bind(day - Duration::weeks(weeks_back))
        .bind(visits)
        .execute(&app.db)
        .await
        .expect("visits");
    }
    for (seq, wait) in [(1, 10), (2, 20)] {
        sqlx::query(
            "INSERT INTO tokens (tenant_id, module, number, seq, token_date, status, \
                                 created_at, called_at) \
             VALUES ($1, 'opd', $2, $3, $4, 'completed', \
                     $4::timestamp + INTERVAL '10 hours', \
                     $4::timestamp + INTERVAL '10 hours' + make_interval(mins => $5))",
        )
        .bind(tenant)
        .bind(format!("KPI-{seq}"))
        .bind(seq)
        .bind(day)
        .bind(wait)
        .execute(&app.db)
        .await
        .expect("token");
    }

    let widget = |code: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT w.id FROM dashboard_widgets w JOIN dashboards d ON d.id = w.dashboard_id \
                 WHERE d.tenant_id = $1 AND d.code = 'role-admin' AND w.deleted_at IS NULL \
                   AND w.data_source->'params'->>'code' = $2",
            )
            .bind(tenant)
            .bind(code)
            .fetch_one(&db)
            .await
            .expect("a seeded management KPI widget")
        }
    };
    let ids = [widget("opd_visits").await, widget("opd_wait_minutes").await];
    let resp = app
        .client
        .post(app.url("/api/dashboard/widget-data/batch"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "widget_ids": ids, "as_of": day }))
        .send()
        .await
        .expect("batch");
    assert_eq!(resp.status(), StatusCode::OK);
    let answers: Vec<Value> = resp.json().await.expect("json");
    let data = |id: Uuid| {
        answers
            .iter()
            .find(|a| a["widget_id"] == json!(id))
            .map(|a| a["data"].clone())
            .unwrap_or(Value::Null)
    };

    let visits = data(ids[0]);
    assert_eq!(visits["value"], json!(5.0), "{visits}");
    assert_eq!(
        visits["baselines"]["weekday"],
        json!(1.0),
        "(3 + 1 + 0 + 0) / 4"
    );
    assert_eq!(visits["baselines"]["yesterday"], json!(0.0));
    assert_eq!(visits["so_far"], json!(false), "a past day is read whole");
    assert_eq!(visits["series"].as_array().map(Vec::len), Some(29));

    let wait = data(ids[1]);
    assert_eq!(wait["value"], json!(15.0), "{wait}");
    assert_eq!(wait["better"], json!("lower"));
    assert_eq!(
        wait["baselines"]["weekday"],
        Value::Null,
        "no tokens before: unknown, not 0"
    );
}

/// Given on a quiet day four visits by one doctor — one with a coded
/// diagnosis, two with complete notes, one closed — and one visit with no
/// doctor recorded, When management reads that day, Then the week's rates are
/// 20% coded, 40% noted and 80% left open, and the table leads with the
/// visit nobody is accountable for, then the doctor's 25% / 50% / 3 open.
#[tokio::test]
async fn documentation_is_read_by_rate_and_by_doctor() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let day = quiet_day(2011);
    let (tenant, doctor): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Doc', 'Probe', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-DOC-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let visit = |by: Option<Uuid>, status: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO encounters \
                   (tenant_id, patient_id, encounter_type, encounter_date, doctor_id, status) \
                 VALUES ($1, $2, 'opd', $3, $4, $5::encounter_status) RETURNING id",
            )
            .bind(tenant)
            .bind(patient)
            .bind(day)
            .bind(by)
            .bind(status)
            .fetch_one(&db)
            .await
            .expect("visit")
        }
    };
    let coded = visit(Some(doctor), "completed").await;
    let noted = visit(Some(doctor), "open").await;
    let half_noted = visit(Some(doctor), "open").await;
    visit(Some(doctor), "open").await;
    visit(None, "open").await;
    sqlx::query(
        "INSERT INTO diagnoses (tenant_id, encounter_id, description, icd_code) \
         VALUES ($1, $2, 'Acute pharyngitis', 'CA02')",
    )
    .bind(tenant)
    .bind(coded)
    .execute(&app.db)
    .await
    .expect("diagnosis");
    for (encounter, examination) in [
        (coded, "Throat red"),
        (noted, "Chest clear"),
        (half_noted, ""),
    ] {
        sqlx::query(
            "INSERT INTO consultations \
               (tenant_id, encounter_id, doctor_id, chief_complaint, examination) \
             VALUES ($1, $2, $3, 'Fever', $4)",
        )
        .bind(tenant)
        .bind(encounter)
        .bind(doctor)
        .bind(examination)
        .execute(&app.db)
        .await
        .expect("consultation");
    }

    let widget = |query: &'static str, code: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT w.id FROM dashboard_widgets w JOIN dashboards d ON d.id = w.dashboard_id \
                 WHERE d.tenant_id = $1 AND d.code = 'role-admin' AND w.deleted_at IS NULL \
                   AND w.data_source->>'query' = $2 \
                   AND COALESCE(w.data_source->'params'->>'code', '') = $3",
            )
            .bind(tenant)
            .bind(query)
            .bind(code)
            .fetch_one(&db)
            .await
            .expect("a seeded management widget")
        }
    };
    let ids = [
        widget("kpi", "coded_diagnosis_pct").await,
        widget("kpi", "complete_note_pct").await,
        widget("kpi", "visits_left_open_pct").await,
        widget("doctor_documentation", "").await,
    ];
    let answers: Vec<Value> = app
        .client
        .post(app.url("/api/dashboard/widget-data/batch"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "widget_ids": ids, "as_of": day }))
        .send()
        .await
        .expect("batch")
        .json()
        .await
        .expect("json");
    let data = |id: Uuid| {
        answers
            .iter()
            .find(|a| a["widget_id"] == json!(id))
            .map(|a| a["data"].clone())
            .unwrap_or(Value::Null)
    };

    assert_eq!(data(ids[0])["value"], json!(20.0), "1 of 5 coded");
    assert_eq!(
        data(ids[1])["value"],
        json!(40.0),
        "a complaint without an examination is not a note"
    );
    assert_eq!(data(ids[2])["value"], json!(80.0), "4 of 5 never closed");
    assert_eq!(data(ids[2])["better"], json!("lower"));

    let table = data(ids[3]);
    let rows = table["items"].as_array().cloned().unwrap_or_default();
    assert_eq!(
        rows.first().map(|r| r["doctor"].clone()),
        Some(json!("No doctor recorded")),
        "{table}"
    );
    let theirs = rows
        .iter()
        .find(|r| r["visits"] == json!(4))
        .cloned()
        .unwrap_or(Value::Null);
    assert_eq!(
        (
            theirs["coded_pct"].clone(),
            theirs["note_pct"].clone(),
            theirs["left_open"].clone()
        ),
        (json!(25), json!(50), json!(3)),
        "{table}"
    );
}

/// Given on a quiet day: two OPD visits, one invoiced two hours after it was
/// opened; two lab results, verified 30 and 180 minutes after collection
/// against a 60-minute target; a bed turned around in 45 minutes; pharmacy
/// tokens waiting 5 and 15 minutes — When management reads that day, Then
/// half the visits have no bill, billing lags 2 h, the lab's median is
/// 105 min with half within target, beds take 45 min and pharmacy 10 min.
#[tokio::test]
async fn department_efficiency_is_read_against_the_usual_day() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let day = quiet_day(2017);
    let (tenant, user): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    // `$day + hours` as the hospital's own clock time.
    let at = |hours: f64| {
        format!(
            "(('{day}'::timestamp + make_interval(secs => {})) AT TIME ZONE \
             (SELECT COALESCE(timezone, 'UTC') FROM tenants WHERE id = '{tenant}'))",
            hours * 3600.0
        )
    };
    let exec = |sql: String| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(&sql)
                .fetch_one(&db)
                .await
                .unwrap_or_else(|e| unreachable!("{e}: {sql}"))
        }
    };
    let patient = exec(format!(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ('{tenant}', 'UH-EFF-{}', 'Eff', 'Probe', 'other', '6{}') RETURNING id",
        &Uuid::new_v4().simple().to_string()[..8],
        &Uuid::new_v4().as_u128().to_string()[..9]
    ))
    .await;
    let visit = |hours: f64| {
        exec(format!(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_date, \
               created_at) VALUES ('{tenant}', '{patient}', 'opd', '{day}', {}) RETURNING id",
            at(hours)
        ))
    };
    let billed = visit(9.0).await;
    visit(10.0).await;
    exec(format!(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, status, \
           issued_at) VALUES ('{tenant}', 'INV-EFF-{}', '{patient}', '{billed}', 'issued', {}) \
         RETURNING id",
        &Uuid::new_v4().simple().to_string()[..10],
        at(11.0)
    ))
    .await;
    for minutes in [30.0, 180.0] {
        exec(format!(
            "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
               collected_at, verified_at, expected_tat_minutes) \
             SELECT '{tenant}', '{billed}', '{patient}', id, '{user}', {}, {}, 60 \
               FROM lab_test_catalog WHERE tenant_id = '{tenant}' LIMIT 1 RETURNING id",
            at(10.0),
            at(10.0 + minutes / 60.0)
        ))
        .await;
    }
    exec(format!(
        "INSERT INTO bed_turnaround_log (tenant_id, bed_id, vacated_at, ready_at) \
         SELECT '{tenant}', id, {}, {} FROM locations \
          WHERE tenant_id = '{tenant}' AND level::text = 'bed' LIMIT 1 RETURNING id",
        at(12.0),
        at(12.75)
    ))
    .await;
    for (seq, wait) in [(1, 5.0), (2, 15.0)] {
        exec(format!(
            "INSERT INTO tokens (tenant_id, module, number, seq, token_date, status, \
               created_at, called_at) \
             VALUES ('{tenant}', 'pharmacy', 'PH-EFF-{seq}', {seq}, '{day}', 'completed', {}, {}) \
             RETURNING id",
            at(14.0),
            at(14.0 + wait / 60.0)
        ))
        .await;
    }

    let codes = [
        "opd_unbilled_pct",
        "billing_lag_hours",
        "lab_tat_minutes",
        "lab_within_target_pct",
        "bed_turnaround_minutes",
        "pharmacy_wait_minutes",
    ];
    let mut ids = Vec::new();
    for code in codes {
        ids.push(
            sqlx::query_scalar::<_, Uuid>(
                "SELECT w.id FROM dashboard_widgets w JOIN dashboards d ON d.id = w.dashboard_id \
                 WHERE d.tenant_id = $1 AND d.code = 'role-admin' AND w.deleted_at IS NULL \
                   AND w.data_source->'params'->>'code' = $2",
            )
            .bind(tenant)
            .bind(code)
            .fetch_one(&app.db)
            .await
            .expect("a seeded efficiency widget"),
        );
    }
    let answers: Vec<Value> = app
        .client
        .post(app.url("/api/dashboard/widget-data/batch"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "widget_ids": ids, "as_of": day }))
        .send()
        .await
        .expect("batch")
        .json()
        .await
        .expect("json");
    let value = |i: usize| {
        answers
            .iter()
            .find(|a| a["widget_id"] == json!(ids[i]))
            .map(|a| a["data"]["value"].clone())
            .unwrap_or(Value::Null)
    };
    let expected = [50.0, 2.0, 105.0, 50.0, 45.0, 10.0];
    for (i, want) in expected.iter().enumerate() {
        let got = value(i).as_f64().unwrap_or(f64::NAN);
        assert!((got - want).abs() < 1e-6, "{}: {got} ≠ {want}", codes[i]);
    }
}
