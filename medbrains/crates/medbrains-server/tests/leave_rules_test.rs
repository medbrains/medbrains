//! HR leave rules, phase 2: the server counts leave days (weekly offs and
//! holidays out, maternity in calendar days), refuses overlapping leave and
//! leave larger than the balance, draws the balance on final approval under a
//! row lock, gives it back on cancel, and keeps the holiday list behind
//! `hr.holiday.manage`.

use std::time::Duration;

use crate::common::{self, TestApp};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

struct Hr {
    app: TestApp,
    csrf: String,
    tenant: Uuid,
}

async fn hr() -> Hr {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    Hr { app, csrf, tenant }
}

impl Hr {
    async fn employee(&self) -> Uuid {
        let code = format!("LR{}", &Uuid::new_v4().simple().to_string()[..10]);
        sqlx::query_scalar(
            "INSERT INTO employees (tenant_id, employee_code, first_name, last_name) \
             VALUES ($1, $2, 'Rules', 'Test') RETURNING id",
        )
        .bind(self.tenant)
        .bind(&code)
        .fetch_one(&self.app.db)
        .await
        .expect("employee")
    }

    async fn balance(&self, employee: Uuid, leave_type: &str, year: i32, balance: f64) {
        sqlx::query(
            "INSERT INTO leave_balances (tenant_id, employee_id, leave_type, year, opening, balance) \
             VALUES ($1, $2, $3::leave_type, $4, $5::numeric, $5::numeric)",
        )
        .bind(self.tenant)
        .bind(employee)
        .bind(leave_type)
        .bind(year)
        .bind(balance)
        .execute(&self.app.db)
        .await
        .expect("balance");
    }

    async fn balance_of(&self, employee: Uuid, leave_type: &str, year: i32) -> (f64, f64) {
        sqlx::query_as(
            "SELECT balance::float8, used::float8 FROM leave_balances \
             WHERE employee_id = $1 AND leave_type = $2::leave_type AND year = $3",
        )
        .bind(employee)
        .bind(leave_type)
        .bind(year)
        .fetch_one(&self.app.db)
        .await
        .expect("balance row")
    }

    async fn send(&self, method: reqwest::Method, path: &str, body: &Value) -> (StatusCode, Value) {
        let resp = self
            .app
            .client
            .request(method, self.app.url(path))
            .header("x-csrf-token", &self.csrf)
            .json(body)
            .send()
            .await
            .expect("request");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    async fn post(&self, path: &str, body: &Value) -> (StatusCode, Value) {
        self.send(reqwest::Method::POST, path, body).await
    }

    async fn put(&self, path: &str, body: &Value) -> (StatusCode, Value) {
        self.send(reqwest::Method::PUT, path, body).await
    }

    async fn request_leave(
        &self,
        employee: Uuid,
        leave_type: &str,
        dates: (&str, &str),
    ) -> (StatusCode, Value) {
        let body = json!({ "employee_id": employee, "leave_type": leave_type,
                           "start_date": dates.0, "end_date": dates.1 });
        self.post("/api/hr/leaves", &body).await
    }

    /// Takes holidays off these dates, so reruns start clean.
    async fn clear_holidays(&self, from: &str, to: &str) {
        sqlx::query(
            "UPDATE hr_holidays SET deleted_at = now() \
             WHERE tenant_id = $1 AND holiday_date BETWEEN $2::date AND $3::date \
               AND deleted_at IS NULL",
        )
        .bind(self.tenant)
        .bind(from)
        .bind(to)
        .execute(&self.app.db)
        .await
        .expect("clear holidays");
    }

    async fn pending_leave(&self, employee: Uuid, dates: (&str, &str), days: f64) -> Uuid {
        sqlx::query_scalar(
            "INSERT INTO leave_requests \
             (tenant_id, employee_id, leave_type, start_date, end_date, days, status) \
             VALUES ($1, $2, 'casual', $3::date, $4::date, $5::numeric, 'pending_admin') RETURNING id",
        )
        .bind(self.tenant)
        .bind(employee)
        .bind(dates.0)
        .bind(dates.1)
        .bind(days)
        .fetch_one(&self.app.db)
        .await
        .expect("leave")
    }
}

fn message(body: &Value) -> String {
    body.to_string()
}

/// A decimal as the API sends it (a string such as "4.0") or a number.
fn days(v: &Value) -> Option<f64> {
    v.as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| v.as_f64())
}

/// Given casual balance 2 and a 3-working-day request (Mon–Wed), When it is
/// submitted, Then 409 "2 days available, you asked for 3" and nothing is created.
#[tokio::test]
async fn a_request_larger_than_the_balance_is_refused_early() {
    let hr = hr().await;
    hr.clear_holidays("2032-11-08", "2032-11-10").await;
    let emp = hr.employee().await;
    hr.balance(emp, "casual", 2032, 2.0).await;

    let (status, body) = hr
        .request_leave(emp, "casual", ("2032-11-08", "2032-11-10"))
        .await;

    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        message(&body).contains("2 days available, you asked for 3"),
        "{body}"
    );
    let filed: i64 =
        sqlx::query_scalar("SELECT count(*) FROM leave_requests WHERE employee_id = $1")
            .bind(emp)
            .fetch_one(&hr.app.db)
            .await
            .expect("count");
    assert_eq!(filed, 0);
}

/// Given Sunday as the weekly off, Wednesday 3 Nov 2032 a national holiday and
/// Thursday a restricted one, When casual leave is asked for Mon–Fri, Then it
/// takes 4 days (the preview agrees); and maternity leave over Mon–Sun, which
/// holds the Sunday and the holiday, takes all 7 calendar days.
#[tokio::test]
async fn days_are_working_days_but_maternity_counts_calendar_days() {
    let hr = hr().await;
    let (status, _) = hr
        .put("/api/hr/weekly-offs", &json!({ "weekly_offs": [0] }))
        .await;
    assert_eq!(status, StatusCode::OK);
    hr.clear_holidays("2032-11-01", "2032-11-07").await;
    for (date, kind) in [("2032-11-03", "national"), ("2032-11-04", "restricted")] {
        let (status, body) = hr
            .post(
                "/api/hr/holidays",
                &json!({ "holiday_date": date, "name": "Test day", "kind": kind }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }

    let (status, preview) = hr
        .send(
            reqwest::Method::GET,
            "/api/hr/leaves/preview?leave_type=casual&start_date=2032-11-01&end_date=2032-11-05",
            &Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{preview}");
    assert_eq!(days(&preview["days"]), Some(4.0), "{preview}");
    assert_eq!(
        preview["holidays"].as_array().map(Vec::len),
        Some(2),
        "{preview}"
    );

    let casual = hr.employee().await;
    hr.balance(casual, "casual", 2032, 10.0).await;
    let (status, leave) = hr
        .request_leave(casual, "casual", ("2032-11-01", "2032-11-05"))
        .await;
    assert_eq!(status, StatusCode::OK, "{leave}");
    assert_eq!(days(&leave["days"]), Some(4.0), "{leave}");

    let mother = hr.employee().await;
    hr.balance(mother, "maternity", 2032, 182.0).await;
    let (status, leave) = hr
        .request_leave(mother, "maternity", ("2032-11-01", "2032-11-07"))
        .await;
    assert_eq!(status, StatusCode::OK, "{leave}");
    assert_eq!(days(&leave["days"]), Some(7.0), "{leave}");
}

/// Given approved leave 4–6 Nov, When the same employee asks for 5–7 Nov,
/// Then 409 naming 4–6 Nov.
#[tokio::test]
async fn overlapping_leave_is_refused_with_the_clashing_dates() {
    let hr = hr().await;
    let emp = hr.employee().await;
    hr.balance(emp, "casual", 2026, 10.0).await;
    sqlx::query(
        "INSERT INTO leave_requests (tenant_id, employee_id, leave_type, start_date, end_date, days, status) \
         VALUES ($1, $2, 'casual', '2026-11-04', '2026-11-06', 3, 'approved')",
    )
    .bind(hr.tenant)
    .bind(emp)
    .execute(&hr.app.db)
    .await
    .expect("approved leave");

    let (status, body) = hr
        .request_leave(emp, "casual", ("2026-11-05", "2026-11-07"))
        .await;

    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(message(&body).contains("4 Nov 2026 – 6 Nov 2026"), "{body}");
}

/// A half day spanning two dates is refused.
#[tokio::test]
async fn a_half_day_over_two_dates_is_refused() {
    let hr = hr().await;
    let emp = hr.employee().await;
    hr.balance(emp, "casual", 2032, 10.0).await;
    let body = json!({ "employee_id": emp, "leave_type": "casual", "is_half_day": true,
                       "start_date": "2032-11-09", "end_date": "2032-11-10" });
    let (status, body) = hr.post("/api/hr/leaves", &body).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
}

/// Given a casual balance of 3 and two pending 2-day leaves, When two
/// approvals run at the same moment, Then exactly one succeeds and the
/// balance is never overspent. The test holds the balance row so both
/// approvals are in flight before either reads it.
#[tokio::test]
async fn concurrent_approvals_cannot_overspend_the_balance() {
    let hr = hr().await;
    let emp = hr.employee().await;
    hr.balance(emp, "casual", 2033, 3.0).await;
    let first = hr
        .pending_leave(emp, ("2033-03-01", "2033-03-02"), 2.0)
        .await;
    let second = hr
        .pending_leave(emp, ("2033-03-07", "2033-03-08"), 2.0)
        .await;

    let mut hold = hr.app.db.begin().await.expect("tx");
    sqlx::query("SELECT 1 FROM leave_balances WHERE employee_id = $1 FOR UPDATE")
        .bind(emp)
        .execute(&mut *hold)
        .await
        .expect("hold");

    let approve = |id: Uuid| {
        let req = hr
            .app
            .client
            .put(hr.app.url(&format!("/api/hr/leaves/{id}/action")))
            .header("x-csrf-token", &hr.csrf)
            .json(&json!({ "action": "approve" }));
        tokio::spawn(async move { req.send().await.map(|r| r.status()) })
    };
    let (a, b) = (approve(first), approve(second));

    let mut waiting = 0_i64;
    for _ in 0..100 {
        waiting = sqlx::query_scalar(
            "SELECT count(*) FROM pg_stat_activity \
             WHERE wait_event_type = 'Lock' AND query ILIKE '%leave_balances%'",
        )
        .fetch_one(&hr.app.db)
        .await
        .expect("waiting");
        if waiting >= 2 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(waiting, 2, "both approvals wait on the balance row");
    hold.commit().await.expect("release");

    let mut statuses = vec![
        a.await.expect("join").expect("send"),
        b.await.expect("join").expect("send"),
    ];
    statuses.sort();
    assert_eq!(statuses, vec![StatusCode::OK, StatusCode::CONFLICT]);
    assert_eq!(hr.balance_of(emp, "casual", 2033).await, (1.0, 2.0));
}

/// Given an approved 3-day leave, When it is cancelled, Then the balance is
/// restored by 3 and both events are in the audit log; a second cancel is refused.
#[tokio::test]
async fn cancelling_approved_leave_gives_the_balance_back() {
    let hr = hr().await;
    hr.clear_holidays("2033-06-06", "2033-06-08").await;
    let emp = hr.employee().await;
    hr.balance(emp, "casual", 2033, 5.0).await;
    let (status, leave) = hr
        .request_leave(emp, "casual", ("2033-06-06", "2033-06-08"))
        .await;
    assert_eq!(status, StatusCode::OK, "{leave}");
    let id = leave["id"].as_str().expect("id").to_owned();

    let (status, body) = hr
        .put(
            &format!("/api/hr/leaves/{id}/action"),
            &json!({ "action": "approve" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(hr.balance_of(emp, "casual", 2033).await, (2.0, 3.0));

    let (status, body) = hr
        .put(&format!("/api/hr/leaves/{id}/cancel"), &Value::Null)
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(hr.balance_of(emp, "casual", 2033).await, (5.0, 0.0));

    let actions: Vec<String> = sqlx::query_scalar(
        "SELECT action FROM audit_log WHERE entity_id = $1::uuid ORDER BY created_at",
    )
    .bind(&id)
    .fetch_all(&hr.app.db)
    .await
    .expect("audit");
    assert_eq!(actions, vec!["leave.decision", "leave.cancel"]);

    let (status, _) = hr
        .put(&format!("/api/hr/leaves/{id}/cancel"), &Value::Null)
        .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "cancelled leave gives back nothing twice"
    );
    assert_eq!(hr.balance_of(emp, "casual", 2033).await, (5.0, 0.0));
}

/// Without `hr.holiday.manage` a holiday cannot be added; the HR officer who
/// holds it can.
#[tokio::test]
async fn only_hr_holiday_manage_adds_holidays() {
    let hr = hr().await;
    hr.clear_holidays("2034-01-26", "2034-01-26").await;
    let body = json!({ "holiday_date": "2034-01-26", "name": "Republic Day", "kind": "national" });
    for (denied, expected) in [(true, StatusCode::FORBIDDEN), (false, StatusCode::OK)] {
        let deny: &[&str] = if denied { &["hr.holiday.manage"] } else { &[] };
        let staff = common::provision_staff(&hr.app, &hr.csrf, "hr_officer", deny).await;
        let resp = staff
            .client
            .post(hr.app.url("/api/hr/holidays"))
            .header("x-csrf-token", &staff.csrf)
            .json(&body)
            .send()
            .await
            .expect("post");
        assert_eq!(resp.status(), expected, "denied={denied}");
    }
}

/// The HRMS balance pull adds the days MedBrains' own approvals drew on top
/// of the HRMS's figures, so a later pull does not erase them.
#[tokio::test]
async fn an_hrms_balance_pull_keeps_medbrains_draws() {
    let hr = hr().await;
    let code = format!("HX{}", &Uuid::new_v4().simple().to_string()[..10]);
    let emp: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name) VALUES ($1, $2, 'Sync') RETURNING id",
    )
    .bind(hr.tenant)
    .bind(&code)
    .fetch_one(&hr.app.db)
    .await
    .expect("employee");
    sqlx::query(
        "INSERT INTO leave_requests (tenant_id, employee_id, leave_type, start_date, end_date, days, \
                                     status, balance_deducted) \
         VALUES ($1, $2, 'casual', '2034-02-01', '2034-02-02', 2, 'approved', 2)",
    )
    .bind(hr.tenant)
    .bind(emp)
    .execute(&hr.app.db)
    .await
    .expect("drawn leave");
    let doc = json!({ "employee_code": code, "leave_type": "casual", "year": 2034,
                      "opening": 12, "earned": 0, "used": 1, "balance": 11 });
    let sql = medbrains_hrms_gateway::upserts::upsert_sql("leave_balances", &doc).expect("sql");
    for _ in 0..2 {
        sqlx::query(sql)
            .bind(hr.tenant)
            .bind(&doc)
            .bind(Uuid::nil())
            .execute(&hr.app.db)
            .await
            .expect("upsert");
    }
    assert_eq!(hr.balance_of(emp, "casual", 2034).await, (9.0, 3.0));
}
