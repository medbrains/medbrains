//! A counter's business day: it cannot be closed while a drawer is open, a
//! count that differs from what the drawers should hold needs a reason, a
//! closed day takes no new drawer, the cashier who closes it cannot reopen
//! it, and a supervisor's reopen lets it be counted and closed again.

use crate::common;

use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn call(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    method: Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn money(v: &Value) -> f64 {
    v.as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| v.as_f64())
        .unwrap_or(f64::NAN)
}

/// A fresh pharmacist, signed in on their own client.
async fn pharmacist(app: &common::TestApp, admin_csrf: &str, tenant: Uuid) -> (Client, String) {
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("department");
    let t = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let (username, password) = (format!("ph_{t}"), format!("Ph#{t}Aa9"));
    let (status, body) = call(
        app,
        &app.client,
        admin_csrf,
        Method::POST,
        "/api/setup/users",
        json!({ "username": username, "email": format!("{username}@example.test"),
                "password": password, "full_name": format!("Pharmacist {t}"),
                "role": "pharmacist", "department_ids": [dept] }),
    )
    .await;
    assert!(status.is_success(), "create pharmacist: {status} {body}");
    let client = Client::builder().cookie_store(true).build().expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    (client, login["csrf_token"].as_str().unwrap_or("").to_owned())
}

#[tokio::test]
async fn a_counter_day_closes_once_counted_explained_and_reopens_only_by_a_supervisor() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let counter: Uuid = sqlx::query_scalar(
        "INSERT INTO store_locations (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CTR-{tag}"))
    .bind(format!("Counter {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("counter");
    let (ph, ph_csrf) = pharmacist(&app, &admin, tenant).await;

    // The shift: ₹500 float, ₹250 cash taken at the counter.
    let (status, drawer) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/cash-drawers",
        json!({ "pharmacy_location_id": counter, "opening_float": 500 })).await;
    assert!(status.is_success(), "open drawer: {status} {drawer}");
    let drawer_id = drawer["id"].as_str().unwrap_or_default().to_owned();
    let business_date = sqlx::query_scalar::<_, chrono::NaiveDate>(
        "SELECT business_date FROM pharmacy_cash_drawers WHERE id = $1::uuid",
    )
    .bind(&drawer_id)
    .fetch_one(&app.db)
    .await
    .expect("business date")
    .to_string();
    sqlx::query(
        "INSERT INTO pharmacy_payment_transactions (tenant_id, payment_mode, amount, shift_id) \
         VALUES ($1, 'cash', 250, $2)",
    )
    .bind(tenant)
    .bind(&drawer_id)
    .execute(&app.db)
    .await
    .expect("cash taken");
    let close_body = |counts: Value, reason: Option<&str>| {
        json!({ "pharmacy_location_id": counter, "business_date": business_date,
                "denominations": counts, "variance_reason": reason })
    };

    // A drawer still open: the day cannot be counted yet.
    let (status, body) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/day-close",
        close_body(json!({ "500": 1, "100": 2, "50": 1 }), None)).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");

    let (status, _) = call(&app, &ph, &ph_csrf, Method::PUT,
        &format!("/api/pharmacy/cash-drawers/{drawer_id}/close"),
        json!({ "actual_close_amount": 750 })).await;
    assert!(status.is_success());

    let report: Value = ph
        .get(app.url(&format!(
            "/api/pharmacy/day-close/report?pharmacy_location_id={counter}&business_date={business_date}"
        )))
        .send()
        .await
        .expect("report")
        .json()
        .await
        .expect("report json");
    assert!((money(&report["report"]["summary"]["expected_cash"]) - 750.0).abs() < 0.001, "{report}");
    assert!((money(&report["report"]["tenders"][0]["collected"]) - 250.0).abs() < 0.001);
    assert!(report["close_refusal"].is_null(), "the cashier who worked it may close it: {report}");

    // ₹700 counted against ₹750: a short count needs its reason.
    let short = json!({ "500": 1, "100": 2 });
    let (status, _) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/day-close",
        close_body(short.clone(), None)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, closed) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/day-close",
        close_body(short, Some("₹50 change given twice"))).await;
    assert!(status.is_success(), "{closed}");
    assert_eq!(closed["status"], "closed");
    assert!((money(&closed["variance"]) + 50.0).abs() < 0.001, "{closed}");
    let close_id = closed["id"].as_str().unwrap_or_default().to_owned();

    // Closed means closed: no second close, no new drawer dated to it.
    let (status, _) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/day-close",
        close_body(json!({ "500": 1 }), Some("again please"))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, _) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/cash-drawers",
        json!({ "pharmacy_location_id": counter, "opening_float": 100 })).await;
    assert_eq!(status, StatusCode::CONFLICT);

    // The cashier cannot undo their own close; a supervisor can, with a reason.
    let reopen = format!("/api/pharmacy/day-close/{close_id}/reopen");
    let (status, _) =
        call(&app, &ph, &ph_csrf, Method::POST, &reopen, json!({ "reason": "recount" })).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) =
        call(&app, &app.client, &admin, Method::POST, &reopen, json!({ "reason": "no" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, reopened) = call(&app, &app.client, &admin, Method::POST, &reopen,
        json!({ "reason": "The ₹50 was found in the till drawer" })).await;
    assert!(status.is_success(), "{reopened}");
    assert_eq!(reopened["status"], "reopened");

    // Counted again, exactly this time, on the same record.
    let (status, again) = call(&app, &ph, &ph_csrf, Method::POST, "/api/pharmacy/day-close",
        close_body(json!({ "500": 1, "100": 2, "50": 1 }), None)).await;
    assert!(status.is_success(), "{again}");
    assert_eq!(again["id"].as_str(), Some(close_id.as_str()));
    assert!(money(&again["variance"]).abs() < 0.001);

    let days: Value = ph
        .get(app.url("/api/pharmacy/day-close"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    let ours = days
        .as_array()
        .and_then(|d| d.iter().find(|r| r["close_id"].as_str() == Some(close_id.as_str())))
        .cloned()
        .unwrap_or(Value::Null);
    assert_eq!(ours["status"], "closed", "{days}");

    // Leave no closed counter behind for the next suite's drawer picker.
    sqlx::query("DELETE FROM store_locations WHERE id = $1")
        .bind(counter)
        .execute(&app.db)
        .await
        .expect("remove the test counter");
}
