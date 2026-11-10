//! A hospital fills the onboarding workbook and uploads it. A dry run changes
//! nothing and names every problem by sheet, row and column; one bad row
//! keeps the whole upload out; a clean upload creates departments, wards,
//! beds on the bed board and staff (welcomed by email, no password); the same
//! workbook again changes nothing new; and the download gives it all back.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

fn workbook(t: &str, dry_run: bool, bad_role: bool) -> Value {
    json!({
        "dry_run": dry_run,
        "departments": [
            { "row": 2, "code": format!("MED{t}"), "name": "General Medicine", "type": "clinical" },
            { "row": 3, "code": format!("CAR{t}"), "name": "Cardiology", "type": "clinical",
              "parent_code": format!("MED{t}") },
        ],
        "wards": [
            { "row": 2, "code": format!("W{t}"), "name": "Medical Ward", "ward_type": "general",
              "gender": "Any", "department_code": format!("MED{t}") },
        ],
        "beds": [
            { "row": 2, "code": format!("B{t}1"), "ward_code": format!("W{t}"), "room": format!("R{t}") },
            { "row": 3, "code": format!("B{t}2"), "ward_code": format!("W{t}"), "room": format!("R{t}") },
        ],
        "staff": [
            { "row": 2, "username": format!("dr{t}"), "full_name": "Dr Kavya Iyer",
              "email": format!("kavya.{t}@example.test"), "role": if bad_role { "surgeon" } else { "doctor" },
              "departments": format!("CAR{t}, MED{t}"), "registration_number": "TN-12345",
              "specialization": "Cardiology", "consultation_fee": "600" },
            { "row": 3, "username": format!("ns{t}"), "full_name": "Nurse Ravi",
              "email": format!("ravi.{t}@example.test"), "role": "nurse",
              "departments": format!("MED{t}") },
        ],
    })
}

async fn upload(app: &common::TestApp, csrf: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/setup/workbook/import"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("upload");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn tally(result: &Value, sheet: &str) -> (u64, u64) {
    let s = result["sheets"].as_array().and_then(|a| a.iter().find(|s| s["sheet"] == sheet));
    s.map_or((0, 0), |s| (s["added"].as_u64().unwrap_or(0), s["updated"].as_u64().unwrap_or(0)))
}

#[tokio::test]
async fn a_hospital_sets_itself_up_from_the_workbook() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let t = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let count = |sql: &'static str| {
        let db = app.db.clone();
        let code = t.clone();
        async move {
            sqlx::query_scalar::<_, i64>(sql).bind(tenant).bind(code).fetch_one(&db).await.expect("count")
        }
    };

    // One bad cell: named precisely, and nothing at all is written.
    let (status, result) = upload(&app, &csrf, workbook(&t, false, true)).await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["applied"], false);
    let problem = &result["problems"][0];
    assert_eq!((problem["sheet"].as_str(), problem["row"].as_u64(), problem["column"].as_str()),
               (Some("Staff"), Some(2), Some("Role")), "{result}");
    let dept_sql = "SELECT COUNT(*) FROM departments WHERE tenant_id = $1 AND code LIKE '%' || $2";
    assert_eq!(count(dept_sql).await, 0, "a refused upload writes nothing");

    // A clean dry run says what would happen, and still writes nothing.
    let (_, result) = upload(&app, &csrf, workbook(&t, true, false)).await;
    assert_eq!(result["applied"], false);
    assert!(result["problems"].as_array().is_some_and(Vec::is_empty), "{result}");
    assert_eq!(tally(&result, "Beds"), (2, 0));
    assert_eq!(count(dept_sql).await, 0, "a dry run writes nothing");

    // Applied.
    let (_, result) = upload(&app, &csrf, workbook(&t, false, false)).await;
    assert_eq!(result["applied"], true, "{result}");
    assert_eq!(tally(&result, "Departments"), (2, 0));
    assert_eq!(tally(&result, "Staff"), (2, 0));
    assert_eq!(result["welcomed"], 2);
    assert_eq!(count(dept_sql).await, 2);
    let board = "SELECT COUNT(*) FROM bed_states s JOIN locations l ON l.id = s.location_id \
                  WHERE s.tenant_id = $1 AND l.code LIKE 'B' || $2 || '%'";
    assert_eq!(count(board).await, 2, "imported beds are on the bed board");
    let (role, fee, has_password): (String, Option<String>, bool) = sqlx::query_as(
        "SELECT role::text, consultation_fee::text, password_hash IS NOT NULL FROM users \
          WHERE tenant_id = $1 AND username = $2",
    )
    .bind(tenant)
    .bind(format!("dr{}", t.to_lowercase()))
    .fetch_one(&app.db)
    .await
    .expect("doctor");
    assert_eq!(role, "doctor");
    assert_eq!(fee.as_deref().map(|f| f.trim_end_matches('0').trim_end_matches('.')), Some("600"));
    assert!(!has_password, "no password ever comes from a spreadsheet");
    assert!(!app.outbox_rows("email.welcome", &format!("ravi.{}", t.to_lowercase())).await.is_empty());

    // The same workbook again: nothing new.
    let (_, again) = upload(&app, &csrf, workbook(&t, false, false)).await;
    assert_eq!(again["applied"], true);
    assert_eq!(tally(&again, "Departments"), (0, 2));
    assert_eq!(tally(&again, "Beds"), (0, 2));
    assert_eq!(again["welcomed"], 0);

    // The download gives it back in the same columns.
    let book: Value = app.get(&app.client, "/api/setup/workbook").await.json().await.expect("export");
    let ward = book["wards"].as_array().and_then(|w| w.iter().find(|w| w["code"] == format!("W{t}")));
    assert_eq!(ward.map(|w| w["department_code"].clone()), Some(json!(format!("MED{t}"))));
    let doctor = book["staff"].as_array().and_then(|s| s.iter().find(|s| s["username"] == format!("dr{}", t.to_lowercase())));
    assert_eq!(doctor.map(|d| d["departments"].clone()), Some(json!(format!("CAR{t}, MED{t}"))));
}
