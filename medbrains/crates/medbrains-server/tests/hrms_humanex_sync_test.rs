//! The Humanex HRMS pull (RFC-HRMS-INTEGRATIONS §9), end to end against a
//! stand-in Humanex: settings saved through the screen's endpoint, a pull on
//! demand, rows landing in the HR tables linked to their source, reporting
//! lines and department heads resolved once both sides exist, and a row
//! Humanex sends that we cannot apply kept as an exception rather than
//! failing the pull.

use crate::common;

use axum::{
    Json, Router,
    extract::Path,
    http::{HeaderMap, StatusCode as MockStatus},
    routing::get,
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Tests that save the admin hospital's Humanex settings run one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const KEY: &str = "humanex-test-key";

/// A stand-in Humanex serving one page per paged feed, refusing a wrong key.
async fn spawn_humanex(tag: &str) -> String {
    let (d, e1, e2) = (
        format!("HX{tag}D"),
        format!("HX{tag}E1"),
        format!("HX{tag}E2"),
    );
    let pages = json!({
        "departments": [{ "code": d, "name": "Humanex ward", "department_type": "clinical",
                          "external_ref": format!("dep-{tag}"), "head_employee_code": e1 }],
        "designations": [{ "code": format!("HX{tag}G"), "name": "Staff nurse",
                           "external_ref": format!("des-{tag}") }],
        "employees": [
            { "employee_code": e1, "full_name": "Meera Nair", "employment_type": "permanent",
              "status": "active", "department_code": d, "external_ref": format!("emp1-{tag}") },
            { "employee_code": e2, "full_name": "Arun Kumar", "employment_type": "permanent",
              "status": "active", "department_code": d, "reporting_to_code": e1,
              "external_ref": format!("emp2-{tag}") },
            { "employee_code": format!("HX{tag}BAD"), "full_name": "Bad Row",
              "employment_type": "freelance", "status": "active" }
        ],
    });
    let app = Router::new().route(
        "/sync/v1/{entity}",
        get(move |Path(entity): Path<String>, headers: HeaderMap| {
            let pages = pages.clone();
            async move {
                if headers.get("authorization").and_then(|v| v.to_str().ok())
                    != Some(&format!("Bearer {KEY}"))
                {
                    return (MockStatus::UNAUTHORIZED, Json(json!({})));
                }
                match entity.as_str() {
                    "roster" | "attendance" => (MockStatus::OK, Json(json!([]))),
                    e => {
                        let items = pages.get(e).cloned().unwrap_or_else(|| json!([]));
                        (
                            MockStatus::OK,
                            Json(json!({ "items": items, "next_cursor": null })),
                        )
                    }
                }
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}")
}

async fn admin_id(app: &common::TestApp) -> (Uuid, Uuid) {
    sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("seeded admin")
}

async fn scalar(app: &common::TestApp, tenant: Uuid, sql: &str, code: &str) -> Option<String> {
    let mut tx = app.db.begin().await.expect("tx");
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant)
        .await
        .expect("tenant");
    sqlx::query_scalar(sql)
        .bind(tenant)
        .bind(code)
        .fetch_optional(&mut *tx)
        .await
        .expect("query")
}

#[tokio::test]
async fn a_pull_lands_staff_linked_to_humanex_and_keeps_rows_it_cannot_apply() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin) = admin_id(&app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let base = spawn_humanex(&tag).await;

    let saved = app
        .client
        .put(app.url("/api/hrms/humanex/config"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "base_url": base, "api_key": KEY, "enabled": false,
                       "system_user_id": admin }))
        .send()
        .await
        .expect("save");
    assert_eq!(saved.status(), StatusCode::OK);
    let view = app.get(&app.client, "/api/hrms/humanex/config").await;
    let text = view.text().await.expect("config body");
    assert!(text.contains("\"api_key_set\":true"), "{text}");
    assert!(
        !text.contains(KEY),
        "the key must never go back to a screen: {text}"
    );

    let pulled = app
        .client
        .post(app.url("/api/hrms/humanex/sync"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("sync");
    assert_eq!(pulled.status(), StatusCode::OK);
    let outcomes: Value = pulled.json().await.expect("outcomes");
    let employees = outcomes
        .as_array()
        .and_then(|o| o.iter().find(|e| e["entity"] == "employees"))
        .cloned()
        .unwrap_or_default();
    assert_eq!(employees["upserted"], 2, "{outcomes}");
    assert_eq!(
        employees["failed"], 1,
        "the bad row is kept, not fatal: {outcomes}"
    );

    let source = scalar(
        &app,
        tenant,
        "SELECT external_source FROM employees WHERE tenant_id = $1 AND employee_code = $2",
        &format!("HX{tag}E2"),
    )
    .await;
    assert_eq!(source.as_deref(), Some("humanex"));
    let manager = scalar(
        &app,
        tenant,
        "SELECT m.employee_code FROM employees e JOIN employees m ON m.id = e.reporting_to \
         WHERE e.tenant_id = $1 AND e.employee_code = $2",
        &format!("HX{tag}E2"),
    )
    .await;
    assert_eq!(
        manager,
        Some(format!("HX{tag}E1")),
        "reporting line resolved"
    );
    let head = scalar(
        &app,
        tenant,
        "SELECT e.employee_code FROM departments d JOIN employees e ON e.id = d.head_employee_id \
         WHERE d.tenant_id = $1 AND d.code = $2",
        &format!("HX{tag}D"),
    )
    .await;
    assert_eq!(head, Some(format!("HX{tag}E1")), "department head resolved");

    let status: Value = app
        .get(&app.client, "/api/hrms/humanex/status")
        .await
        .json()
        .await
        .expect("status");
    let rejected = status["recent_exceptions"]
        .as_array()
        .is_some_and(|x| x.iter().any(|r| r["record_key"] == format!("HX{tag}BAD")));
    assert!(rejected, "the unapplied row is on the screen: {status}");

    // A second pull changes nothing it has already applied.
    let again = app
        .client
        .post(app.url("/api/hrms/humanex/sync"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("sync again");
    assert_eq!(again.status(), StatusCode::OK);
    let count = scalar(
        &app,
        tenant,
        "SELECT count(*)::text FROM employees WHERE tenant_id = $1 AND employee_code = $2",
        &format!("HX{tag}E1"),
    )
    .await;
    assert_eq!(count.as_deref(), Some("1"));
}

#[tokio::test]
async fn a_wrong_key_is_reported_on_the_feed_not_hidden() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, admin) = admin_id(&app).await;
    let base = spawn_humanex("WK").await;
    let saved = app
        .client
        .put(app.url("/api/hrms/humanex/config"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "base_url": base, "api_key": "not-the-key", "enabled": false,
                       "system_user_id": admin }),
        )
        .send()
        .await
        .expect("save");
    assert_eq!(saved.status(), StatusCode::OK);
    let outcomes: Value = app
        .client
        .post(app.url("/api/hrms/humanex/sync"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("sync")
        .json()
        .await
        .expect("outcomes");
    let all_failed = outcomes.as_array().is_some_and(|o| {
        !o.is_empty()
            && o.iter()
                .all(|e| e["error"].as_str().is_some_and(|w| w.contains("401")))
    });
    assert!(all_failed, "every feed names the refusal: {outcomes}");
}
