//! The HR leave calendar loads one date window in one call, with the
//! employee's remaining balance for each leave's type and year.

use crate::common;

use serde_json::Value;
use uuid::Uuid;

/// Given leave in March and leave in June for one employee with a casual
/// balance of 7.5 for 2026, When HR lists 2026-03-09..2026-03-15, Then only
/// the March leave (which overlaps the window's start) comes back, carrying
/// the employee's name and a remaining balance equal to the balance row.
#[tokio::test]
async fn the_window_returns_overlapping_leave_with_its_balance() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let code = format!("LC{}", &Uuid::new_v4().simple().to_string()[..8]);
    let employee: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name, last_name) \
         VALUES ($1, $2, 'Window', 'Test') RETURNING id",
    )
    .bind(tenant)
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("employee");
    sqlx::query(
        "INSERT INTO leave_balances (tenant_id, employee_id, leave_type, year, opening, balance) \
         VALUES ($1, $2, 'casual', 2026, 12, 7.5)",
    )
    .bind(tenant)
    .bind(employee)
    .execute(&app.db)
    .await
    .expect("balance");
    let mut ids = Vec::new();
    for (start, end) in [("2026-03-05", "2026-03-10"), ("2026-06-01", "2026-06-02")] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO leave_requests \
             (tenant_id, employee_id, leave_type, start_date, end_date, days, status) \
             VALUES ($1, $2, 'casual', $3::date, $4::date, 1, 'pending_hod') RETURNING id",
        )
        .bind(tenant)
        .bind(employee)
        .bind(start)
        .bind(end)
        .fetch_one(&app.db)
        .await
        .expect("leave");
        ids.push(id.to_string());
    }

    let resp = app
        .client
        .get(app.url(&format!(
            "/api/hr/leaves?employee_id={employee}&from=2026-03-09&to=2026-03-15"
        )))
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), reqwest::StatusCode::OK);
    let rows: Vec<Value> = resp.json().await.expect("json");

    let returned: Vec<&str> = rows.iter().filter_map(|r| r["id"].as_str()).collect();
    assert_eq!(
        returned,
        vec![ids[0].as_str()],
        "only the overlapping leave: {rows:?}"
    );
    let row = &rows[0];
    assert_eq!(row["employee_name"], "Window Test");
    let balance: f64 = row["remaining_balance"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| row["remaining_balance"].as_f64())
        .expect("remaining_balance present");
    assert!(
        (balance - 7.5).abs() < f64::EPSILON,
        "balance row is 7.5: {row}"
    );
}
