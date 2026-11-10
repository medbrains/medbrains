//! The dashboard's plain count tiles read the As of day, not today — the
//! founder picked 15 Jan 2026 and "Today's OPD" went on showing today.

use crate::common;

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A day in the 1970s nobody else's rows land on.
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 1800).unwrap_or(0);
    NaiveDate::from_ymd_opt(1971, 1, 1).unwrap_or_default() + Duration::days(offset)
}

/// Given on a quiet day 3 OPD visits, a ₹1,500 invoice, and an admission
/// that came in that morning and went home the next day, When the dashboard
/// is read as of that day, Then Today's OPD is 3, Revenue is 1500.00, Active
/// admissions counts the patient in the bed, each tile names the day — and a
/// live read (no date) does not.
#[tokio::test]
async fn count_tiles_are_read_for_the_as_of_day() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let day = quiet_day();
    let (tenant, doctor): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'AsOf', 'Probe', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-ASOF-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("6{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_date) \
         SELECT $1, $2, 'opd', $3 FROM generate_series(1, 3) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(day)
    .fetch_all(&app.db)
    .await
    .expect("visits")
    .into_iter()
    .next()
    .expect("a visit");
    // Created mid-day in the hospital's own zone.
    let noon = "timezone((SELECT COALESCE(timezone, 'UTC') FROM tenants WHERE id = $1), \
                $2::date + time '12:00')";
    sqlx::query(&format!(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, \
                               total_amount, created_at) \
         VALUES ($1, $3, $4, $5, 1500, {noon})"
    ))
    .bind(tenant)
    .bind(day)
    .bind(format!(
        "INV-ASOF-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(patient)
    .bind(encounter)
    .execute(&app.db)
    .await
    .expect("invoice");
    sqlx::query(&format!(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                                 status, admitted_at, discharged_at) \
         VALUES ($1, $3, $4, $5, 'discharged', {noon}, {noon} + interval '1 day')"
    ))
    .bind(tenant)
    .bind(day)
    .bind(encounter)
    .bind(patient)
    .bind(doctor)
    .execute(&app.db)
    .await
    .expect("admission");

    let dashboard: Uuid = sqlx::query_scalar(
        "SELECT id FROM dashboards WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("a dashboard");
    let mut ids = Vec::new();
    for source in [
        json!({"type": "sql_count", "table": "encounters",
               "filter": "encounter_type = 'opd' AND encounter_date = tenant_local_date(tenant_id, now())"}),
        json!({"type": "module_query", "module": "billing", "query": "today_revenue"}),
        json!({"type": "sql_count", "table": "admissions", "filter": "status = 'admitted'"}),
        json!({"type": "sql_count", "table": "patients"}),
    ] {
        // Hidden, so the probe never shows on anyone's dashboard.
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO dashboard_widgets (tenant_id, dashboard_id, widget_type, title, \
                                            data_source, is_visible) \
             VALUES ($1, $2, 'stat_card', 'As-of probe', $3, false) RETURNING id",
        )
        .bind(tenant)
        .bind(dashboard)
        .bind(source)
        .fetch_one(&app.db)
        .await
        .expect("widget");
        ids.push(id);
    }

    let read = |as_of: Option<NaiveDate>| {
        let body = json!({ "widget_ids": ids, "as_of": as_of });
        let req = app
            .client
            .post(app.url("/api/dashboard/widget-data/batch"))
            .header("x-csrf-token", &csrf)
            .json(&body);
        async move {
            let resp = req.send().await.expect("batch");
            assert_eq!(resp.status(), StatusCode::OK);
            resp.json::<Vec<Value>>().await.expect("json")
        }
    };
    let data = |answers: &[Value], id: Uuid| {
        answers
            .iter()
            .find(|a| a["widget_id"] == json!(id))
            .map(|a| a["data"].clone())
            .unwrap_or(Value::Null)
    };

    let past = read(Some(day)).await;
    let [opd, revenue, admitted, patients] =
        [ids[0], ids[1], ids[2], ids[3]].map(|id| data(&past, id));
    assert_eq!(opd["value"], json!(3), "{opd}");
    assert_eq!(revenue["value"], json!("1500.00"), "{revenue}");
    assert_eq!(
        admitted["value"],
        json!(1),
        "in a bed at the end of the day: {admitted}"
    );
    assert!(patients["value"].as_i64().is_some(), "{patients}");
    for tile in [&opd, &revenue, &admitted, &patients] {
        assert_eq!(tile["as_of"], json!(day), "the tile names its day: {tile}");
    }

    let next = read(Some(day + Duration::days(1))).await;
    assert_eq!(
        data(&next, ids[2])["value"],
        json!(0),
        "went home the next day"
    );

    let live = read(None).await;
    assert!(
        data(&live, ids[0]).get("as_of").is_none(),
        "a live count has no day"
    );
    assert_eq!(data(&live, ids[1])["as_of"], Value::Null);
}
