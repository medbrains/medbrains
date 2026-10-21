//! Frontline staff do their own job without a manager's rights, and nothing
//! more: leave is filed for the caller and never approved by them; a
//! housekeeper and a technician finish only their own work; the gate guard
//! records entry and exit but cannot revoke a pass; revoking a device's sync
//! key needs the revoke right; the lab's delivery channels are configuration,
//! not an order-list right; a missing device answers 404; and security
//! incidents live in one register.

use crate::common;

use reqwest::{Client, RequestBuilder, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

struct Staff {
    client: Client,
    csrf: String,
    user_id: Uuid,
}

/// A signed-in user of `role`, provisioned by the admin, with `denied`
/// subtracted from the role's permissions before login.
async fn staff(app: &common::TestApp, admin_csrf: &str, role: &str, denied: &[&str]) -> Staff {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("f{role}_{tag}"), format!("Frontline#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Frontline {role}"),
            "role": role,
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let user_id: Uuid = sqlx::query_scalar(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', '[]'::jsonb, 'denied', $2::jsonb), \
                perm_version = perm_version + 1 \
          WHERE username = $1 RETURNING id",
    )
    .bind(&username)
    .bind(json!(denied))
    .fetch_one(&app.db)
    .await
    .expect("user");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    Staff {
        client,
        csrf,
        user_id,
    }
}

async fn send(csrf: &str, req: RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// Links `user` to a new employee record and returns its id.
async fn employee(app: &common::TestApp, user: Uuid) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name, user_id) \
         VALUES ($1, $2, 'Frontline', $3) RETURNING id",
    )
    .bind(tenant(app).await)
    .bind(format!("FL-{tag}"))
    .bind(user)
    .fetch_one(&app.db)
    .await
    .expect("employee")
}

fn leave(employee_id: Option<Uuid>) -> Value {
    json!({
        "employee_id": employee_id,
        "leave_type": "casual",
        "start_date": "2031-03-02",
        "end_date": "2031-03-03",
        "days": 2,
    })
}

/// Given two nurses and a leave approver without `hr.leave.manage`,
/// When a nurse applies naming her colleague, Then the leave is hers;
/// When the approver files for someone else or approves their own leave,
/// Then both are refused, and their list holds no stranger's leave.
#[tokio::test]
async fn leave_is_filed_for_the_caller_and_never_approved_by_them() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let a = staff(&app, &admin, "nurse", &[]).await;
    let b = staff(&app, &admin, "nurse", &[]).await;
    let (ea, eb) = (
        employee(&app, a.user_id).await,
        employee(&app, b.user_id).await,
    );

    let (status, filed) = send(
        &a.csrf,
        a.client
            .post(app.url("/api/hr/me/leaves"))
            .json(&leave(Some(eb))),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{filed}");
    assert_eq!(
        filed["employee_id"],
        json!(ea),
        "the body's employee_id must be ignored"
    );

    let (status, mine) = send(&a.csrf, a.client.get(app.url("/api/hr/me/leaves"))).await;
    assert_eq!(status, StatusCode::OK, "{mine}");
    let mine = mine.as_array().cloned().unwrap_or_default();
    assert!(mine.iter().any(|l| l["id"] == filed["id"]));
    assert!(mine.iter().all(|l| l["employee_id"] == json!(ea)));

    let (status, _) = send(&a.csrf, a.client.get(app.url("/api/hr/leaves"))).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a nurse does not list everyone's leave"
    );

    let m = staff(&app, &admin, "facilities_manager", &["hr.leave.manage"]).await;
    employee(&app, m.user_id).await;
    let (status, body) = send(
        &m.csrf,
        m.client
            .post(app.url("/api/hr/leaves"))
            .json(&leave(Some(eb))),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "filing for another needs hr.leave.manage: {body}"
    );

    let (status, listed) = send(&m.csrf, m.client.get(app.url("/api/hr/leaves"))).await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert!(
        !listed
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .any(|l| l["id"] == filed["id"]),
        "an approver outside the department does not see this nurse's leave"
    );

    let (status, own) = send(
        &m.csrf,
        m.client
            .post(app.url("/api/hr/me/leaves"))
            .json(&leave(None)),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{own}");
    let own_id = own["id"].as_str().unwrap_or_default();
    let (status, body) = send(
        &m.csrf,
        m.client
            .put(app.url(&format!("/api/hr/leaves/{own_id}/action")))
            .json(&json!({ "action": "approve" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "self-approval must be refused: {body}"
    );
}

/// Given a doctor who heads a department and a nurse in it, When the nurse
/// applies, Then the head forwards it (`approve_hod`) but cannot give final
/// approval, a doctor heading another department cannot touch it, and HR
/// approves it; the head sees it in their team queue.
#[tokio::test]
async fn the_department_head_forwards_and_hr_approves() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let tid = tenant(&app).await;
    let head = staff(&app, &admin, "doctor", &[]).await;
    let other_head = staff(&app, &admin, "doctor", &[]).await;
    let nurse = staff(&app, &admin, "nurse", &[]).await;
    let hr = staff(&app, &admin, "hr_officer", &[]).await;
    let dept = |head_employee: Uuid| {
        let db = app.db.clone();
        async move {
            let code = format!("FL-{}", &Uuid::new_v4().simple().to_string()[..6]).to_uppercase();
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO departments (tenant_id, code, name, department_type, head_employee_id) \
                 VALUES ($1, $2, $2, 'clinical', $3) RETURNING id",
            )
            .bind(tid)
            .bind(code)
            .bind(head_employee)
            .fetch_one(&db)
            .await
            .expect("department")
        }
    };
    let ward = dept(employee(&app, head.user_id).await).await;
    dept(employee(&app, other_head.user_id).await).await;
    let nurse_employee = employee(&app, nurse.user_id).await;
    sqlx::query("UPDATE employees SET department_id = $2 WHERE id = $1")
        .bind(nurse_employee)
        .bind(ward)
        .execute(&app.db)
        .await
        .expect("assign department");

    let (status, filed) = send(
        &nurse.csrf,
        nurse
            .client
            .post(app.url("/api/hr/me/leaves"))
            .json(&leave(None)),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{filed}");
    let action = |who: &Staff, verb: &str| {
        who.client
            .put(app.url(&format!(
                "/api/hr/leaves/{}/action",
                filed["id"].as_str().unwrap_or_default()
            )))
            .json(&json!({ "action": verb }))
    };

    let (status, queue) = send(
        &head.csrf,
        head.client.get(app.url("/api/hr/me/team-leaves")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{queue}");
    assert_eq!(queue["is_department_head"], json!(true));
    assert!(
        queue["leaves"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .any(|l| l["id"] == filed["id"])
    );

    let (status, body) = send(&other_head.csrf, action(&other_head, "approve_hod")).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "another department's head: {body}"
    );
    let (status, body) = send(&head.csrf, action(&head, "approve")).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "final approval is HR's: {body}"
    );
    let (status, body) = send(&head.csrf, action(&head, "approve_hod")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["status"], json!("pending_admin"));
    let (status, body) = send(&head.csrf, action(&head, "approve_hod")).await;
    assert_eq!(status, StatusCode::CONFLICT, "already forwarded: {body}");
    let (status, body) = send(&hr.csrf, action(&hr, "approve")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["status"], json!("approved"));
}

/// Given a housekeeper, When she completes a task assigned to someone else,
/// Then it is refused; When she starts an unassigned task, Then it becomes
/// hers and she may complete it, but not verify it.
#[tokio::test]
async fn a_housekeeper_completes_only_her_own_task() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let h = staff(&app, &admin, "housekeeping_staff", &[]).await;
    let tid = tenant(&app).await;
    let task = |assigned: Option<String>| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO cleaning_tasks (tenant_id, area_type, task_date, assigned_to) \
                 VALUES ($1, 'ward', CURRENT_DATE, $2) RETURNING id",
            )
            .bind(tid)
            .bind(assigned)
            .fetch_one(&db)
            .await
            .expect("task")
        }
    };
    let theirs = task(Some(Uuid::new_v4().to_string())).await;
    let open = task(None).await;
    let status_of = |id: Uuid, status: &str| {
        h.client
            .put(app.url(&format!("/api/housekeeping/tasks/{id}/status")))
            .json(&json!({ "status": status }))
    };

    let (status, body) = send(&h.csrf, status_of(theirs, "completed")).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");

    let (status, body) = send(&h.csrf, status_of(open, "in_progress")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["assigned_to"],
        json!(h.user_id.to_string()),
        "starting claims the task"
    );

    let (status, body) = send(&h.csrf, status_of(open, "completed")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(&h.csrf, status_of(open, "verified")).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "verifying is the supervisor's: {body}"
    );
}

/// Given a biomedical engineer, When he completes a work order assigned to
/// someone else or cancels his own, Then both are refused; his own he completes.
#[tokio::test]
async fn a_technician_completes_only_his_assigned_work_order() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let t = staff(&app, &admin, "biomed_engineer", &[]).await;
    let tid = tenant(&app).await;
    let admin_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let order = |assignee: Uuid| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO fms_work_orders (tenant_id, work_order_number, description, assigned_to) \
                 VALUES ($1, $2, 'Leaking tap, ward 3', $3) RETURNING id",
            )
            .bind(tid)
            .bind(format!("WO-FL-{}", &Uuid::new_v4().simple().to_string()[..8]))
            .bind(assignee)
            .fetch_one(&db)
            .await
            .expect("work order")
        }
    };
    let (theirs, mine) = (order(admin_id).await, order(t.user_id).await);
    let set = |id: Uuid, status: &str| {
        t.client
            .put(app.url(&format!("/api/facilities/work-orders/{id}/status")))
            .json(&json!({ "status": status }))
    };

    let (status, body) = send(&t.csrf, set(theirs, "completed")).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    let (status, body) = send(&t.csrf, set(mine, "cancelled")).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "cancelling is the manager's: {body}"
    );
    let (status, body) = send(&t.csrf, set(mine, "completed")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// Given a security guard, When she checks a valid pass in and out, Then both
/// are recorded; When she tries to revoke it, Then it is refused; a revoked
/// pass cannot be checked in at all.
#[tokio::test]
async fn the_gate_guard_records_visits_but_cannot_revoke_passes() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let g = staff(&app, &admin, "security_guard", &[]).await;
    let tid = tenant(&app).await;
    let registration: Uuid = sqlx::query_scalar(
        "INSERT INTO visitor_registrations (tenant_id, visitor_name) VALUES ($1, 'Lakshmi') RETURNING id",
    )
    .bind(tid)
    .fetch_one(&app.db)
    .await
    .expect("registration");
    let pass = |status: &str| {
        let db = app.db.clone();
        let status = status.to_owned();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO visitor_passes (tenant_id, registration_id, pass_number, valid_until, status) \
                 VALUES ($1, $2, $3, now() + interval '2 hours', $4::visitor_pass_status) RETURNING id",
            )
            .bind(tid)
            .bind(registration)
            .bind(format!("VP-FL-{}", &Uuid::new_v4().simple().to_string()[..8]))
            .bind(status)
            .fetch_one(&db)
            .await
            .expect("pass")
        }
    };
    let (valid, revoked) = (pass("active").await, pass("revoked").await);
    let log = |id: Uuid, verb: &str| format!("/api/front-office/visitor-logs/{id}/{verb}");

    let (status, body) = send(&g.csrf, g.client.post(app.url(&log(valid, "check-in")))).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(&g.csrf, g.client.put(app.url(&log(valid, "check-out")))).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(
        &g.csrf,
        g.client
            .put(app.url(&format!("/api/front-office/passes/{valid}/revoke")))
            .json(&json!({ "reason": "test" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    let (status, body) = send(&g.csrf, g.client.post(app.url(&log(revoked, "check-in")))).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a revoked pass does not let anyone in: {body}"
    );
}

/// Revoking a sync key is the revoke right, not the enrolment right.
#[tokio::test]
async fn revoking_a_node_key_needs_the_revoke_right() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let enrol_only = staff(
        &app,
        &admin,
        "biomed_engineer",
        &["devices.pairing.paired.revoke"],
    )
    .await;
    let path = app.url(&format!(
        "/api/device-pairing/paired/{}/node-key",
        Uuid::new_v4()
    ));
    let (status, body) = send(&enrol_only.csrf, enrol_only.client.delete(&path)).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");

    let revoker = staff(&app, &admin, "biomed_engineer", &[]).await;
    let (status, body) = send(&revoker.csrf, revoker.client.delete(&path)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// A nurse reads lab orders; that does not let her switch on WhatsApp delivery.
#[tokio::test]
async fn lab_report_delivery_config_is_not_an_order_list_right() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let n = staff(&app, &admin, "nurse", &[]).await;
    let url = app.url("/api/lab/report-delivery-config");
    let (status, body) = send(&n.csrf, n.client.get(&url)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(
        &n.csrf,
        // A complete, valid config: the refusal must come from the permission,
        // not from a malformed body.
        n.client.put(&url).json(&json!({
            "sms_enabled": true, "whatsapp_enabled": false, "email_enabled": false,
            "auto_dispatch": false, "default_method": "sms",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");

    // The admin may set it, but not to a default channel that is switched off.
    let (status, body) = send(
        &admin,
        app.client.put(&url).json(&json!({
            "sms_enabled": false, "whatsapp_enabled": false, "email_enabled": false,
            "auto_dispatch": false, "default_method": "sms",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let (status, body) = send(
        &admin,
        app.client.put(&url).json(&json!({
            "sms_enabled": true, "whatsapp_enabled": false, "email_enabled": false,
            "auto_dispatch": false, "default_method": "sms",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// A ward nurse draws samples: collecting is `lab.samples.collect`, not result
/// entry. For an order she cannot reach the answer is "not found", never the
/// permission refusal she got when collection rode on `lab.results.create`.
#[tokio::test]
async fn a_nurse_is_not_refused_sample_collection_by_permission() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let n = staff(&app, &admin, "nurse", &[]).await;
    let (status, body) = send(
        &n.csrf,
        n.client
            .put(app.url(&format!("/api/lab/orders/{}/collect", Uuid::new_v4())))
            .json(&json!({ "patient_identifier": "UHID-0001" })),
    )
    .await;
    assert_ne!(status, StatusCode::FORBIDDEN, "{body}");

    let desk = staff(&app, &admin, "receptionist", &[]).await;
    let (status, body) = send(
        &desk.csrf,
        desk.client
            .put(app.url(&format!("/api/lab/orders/{}/collect", Uuid::new_v4())))
            .json(&json!({ "patient_identifier": "UHID-0001" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
}

#[tokio::test]
async fn a_missing_device_is_not_found() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (status, body) = send(
        &csrf,
        app.client
            .get(app.url(&format!("/api/bme/equipment/{}", Uuid::new_v4()))),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
}

/// One register: what the screen reports is what the list shows, and the
/// retired `/api/security-incidents` family is gone.
#[tokio::test]
async fn security_incidents_live_in_one_register() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (status, created) = send(
        &csrf,
        app.client
            .post(app.url("/api/security/incidents"))
            .json(&json!({
                "category": "theft",
                "description": "Wallet reported missing from ward 3 locker",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let (status, list) = send(&csrf, app.client.get(app.url("/api/security/incidents"))).await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert!(
        list.as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .any(|i| i["id"] == created["id"])
    );

    let (status, _) = send(
        &csrf,
        app.client
            .post(app.url("/api/security-incidents"))
            .json(&json!({ "title": "dup" })),
    )
    .await;
    assert!(
        status == StatusCode::NOT_FOUND || status == StatusCode::METHOD_NOT_ALLOWED,
        "the duplicate register must be gone, got {status}"
    );
}
