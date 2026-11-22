//! The ER list puts the sickest waiting patient on top: by triage level, a
//! patient nobody has triaged above the two least urgent levels, the longer
//! wait first within a level, and closed visits after everyone still in the
//! department. The wait targets come from one table.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// One ER visit for a new patient: its triage level, how long ago it arrived,
/// and whether it has been discharged.
async fn arrival(
    app: &common::TestApp,
    level: Option<&str>,
    minutes_ago: i32,
    discharged: bool,
) -> String {
    let tag = Uuid::new_v4().simple().to_string();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Order', 'Sample', 'male'::gender, '9000000000' \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("ERO-{}", &tag[..10]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO er_visits (tenant_id, patient_id, visit_number, triage_level, status, arrival_time) \
         SELECT tenant_id, id, $2, $3::triage_level, $4::er_visit_status, \
                now() - make_interval(mins => $5) \
           FROM patients WHERE id = $1 RETURNING id",
    )
    .bind(patient)
    .bind(format!("ERO-{}", &tag[..12]))
    .bind(level)
    .bind(if discharged { "discharged" } else { "triaged" })
    .bind(minutes_ago)
    .fetch_one(&app.db)
    .await
    .expect("visit");
    id.to_string()
}

/// Given seven arrivals, When they are triaged out of arrival order and one is
/// discharged, Then the list returns them by acuity, then by the longer wait,
/// with the discharged one after everyone still in the department; and the
/// targets read as the table says.
#[tokio::test]
async fn the_er_list_is_ordered_by_acuity_then_wait() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let mut label_of = std::collections::HashMap::new();
    for (label, level, minutes_ago, discharged) in [
        ("green", Some("less_urgent"), 70, false),
        ("untriaged", None, 60, false),
        ("yellow-old", Some("urgent"), 50, false),
        ("red-gone", Some("immediate"), 40, true),
        ("yellow-new", Some("urgent"), 30, false),
        ("blue", Some("non_urgent"), 20, false),
        ("red", Some("immediate"), 10, false),
    ] {
        label_of.insert(arrival(&app, level, minutes_ago, discharged).await, label);
    }
    let rows: Value = app
        .client
        .get(app.url("/api/emergency/visits"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let order: Vec<&str> = rows
        .as_array()
        .expect("rows")
        .iter()
        .filter_map(|row| label_of.get(row["id"].as_str()?).copied())
        .collect();
    assert_eq!(
        order,
        [
            "red",
            "yellow-old",
            "yellow-new",
            "untriaged",
            "green",
            "blue",
            "red-gone"
        ],
        "most urgent first, then the longer wait; closed visits last"
    );

    let resp = app
        .client
        .get(app.url("/api/emergency/wait-targets"))
        .send()
        .await
        .expect("targets");
    assert_eq!(resp.status(), StatusCode::OK);
    let targets: Value = resp.json().await.expect("json");
    assert_eq!(
        targets,
        json!({ "immediate": 0, "emergent": 10, "urgent": 60, "less_urgent": 120, "non_urgent": 240 })
    );
}
