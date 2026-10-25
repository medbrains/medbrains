//! A hospital brings its past in from the system it used before.
//!
//! Nothing is imported until go-live is set. A dry run checks a batch and
//! writes nothing; a batch with one record dated after go-live, or naming a
//! department that does not exist, is refused whole, with every problem named
//! by record and field. A clean batch lands dated when it happened — visits,
//! results, dispenses, bills and claims — without the side effects a live
//! entry has: a critical result raises no alert, a dispense moves no stock.
//! The same batch sent again adds nothing, the audit log names the batch, and
//! a user without the permission is refused.

use crate::common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: &Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(body)
        .send()
        .await
        .expect("post");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn records(
    t: &str,
    dept: &str,
    doctor: &str,
    test: &str,
    drug: &str,
    at: chrono::DateTime<Utc>,
) -> Vec<Value> {
    let ts = |h: i64| (at + Duration::hours(h)).to_rfc3339();
    vec![
        json!({ "kind": "patient", "external_id": format!("P{t}"), "first_name": "Meena", "last_name": "Raman",
                "gender": "female", "date_of_birth": "1975-03-02", "phone": "9000012345", "registered_at": ts(0) }),
        json!({ "kind": "visit", "external_id": format!("V{t}"), "patient": format!("P{t}"), "department": dept,
                "doctor": doctor, "visited_at": ts(1), "chief_complaint": "Fever",
                "vitals": { "temperature": 38.6, "pulse": 104, "systolic_bp": 128, "diastolic_bp": 82, "spo2": 97 },
                "diagnoses": [{ "icd_code": "1D20", "icd_system": "icd11", "description": "Dengue without warning signs", "is_primary": true }] }),
        json!({ "kind": "lab_order", "external_id": format!("L{t}"), "patient": format!("P{t}"), "visit": format!("V{t}"),
                "test": test, "ordered_at": ts(1), "collected_at": ts(2), "reported_at": ts(4),
                "results": [{ "parameter_name": "Potassium", "value": "6.9", "unit": "mmol/L", "flag": "critical_high" }] }),
        json!({ "kind": "dispense", "external_id": format!("D{t}"), "patient": format!("P{t}"), "visit": format!("V{t}"),
                "dispensed_at": ts(2), "items": [{ "drug": drug, "quantity": 10, "unit_price": "2.00" }] }),
        json!({ "kind": "invoice", "external_id": format!("B{t}"), "patient": format!("P{t}"), "visit": format!("V{t}"),
                "invoiced_at": ts(2), "items": [
                    { "charge_code": "CONSULT", "description": "OPD consultation", "source": "opd", "quantity": 1, "unit_price": "600" },
                    { "charge_code": drug, "description": "Pharmacy", "source": "pharmacy", "quantity": 10, "unit_price": "2.00", "tax_percent": "12" } ],
                "payments": [{ "amount": "300", "mode": "upi", "paid_at": ts(2), "reference": "UPI123" }] }),
        json!({ "kind": "claim", "external_id": format!("C{t}"), "invoice": format!("B{t}"), "insurance_provider": "Demo Insurer",
                "claim_type": "reimbursement", "status": "claim_submitted", "claim_amount": "322.40", "submitted_at": ts(5) }),
    ]
}

#[tokio::test]
async fn a_hospital_imports_its_history_before_go_live() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let t = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(doctor.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");
    let dept: String = sqlx::query_scalar(
        "SELECT d.code FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.deleted_at IS NULL AND d.is_active ORDER BY d.code LIMIT 1",
    ).fetch_one(&app.db).await.expect("department");
    let (s, lab) = post(
        &app,
        &csrf,
        "/api/lab/catalog",
        &json!({ "code": format!("HK{t}"), "name": "Potassium", "price": 180 }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{lab}");
    let (s, drug) = post(
        &app,
        &csrf,
        "/api/pharmacy/catalog",
        &json!({ "code": format!("HD{t}"), "name": "Paracetamol", "base_price": 2 }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{drug}");
    let (lab, drug) = (format!("HK{t}"), format!("HD{t}"));
    let at = Utc::now() - Duration::days(40);
    let batch = |dry_run: bool, recs: Vec<Value>| json!({ "label": format!("Old HIS {t}"), "dry_run": dry_run, "records": recs });
    let good = records(&t, &dept, &username, &lab, &drug, at);

    // A hospital may change go-live later; this test owns it for its run.
    let go_live = Utc::now() - Duration::days(1);
    let (s, _) = app
        .client
        .put(app.url("/api/history-import/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "go_live_at": go_live }))
        .send()
        .await
        .map(|r| (r.status(), ()))
        .expect("settings");
    assert_eq!(s, StatusCode::OK);

    // Dry run: every record checks out, nothing is written.
    let (s, dry) = post(
        &app,
        &csrf,
        "/api/history-import/batches",
        &batch(true, good.clone()),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{dry}");
    assert_eq!(
        (dry["applied"].as_bool(), dry["status"].as_str()),
        (Some(false), Some("validated")),
        "{dry}"
    );
    let visits = || {
        let db = app.db.clone();
        let ext = format!("V{t}");
        async move {
            sqlx::query_scalar::<_, i64>(
                "SELECT count(*) FROM history_import_records WHERE external_id = $1",
            )
            .bind(ext)
            .fetch_one(&db)
            .await
            .expect("count")
        }
    };
    assert_eq!(visits().await, 0, "a dry run writes nothing");

    // One record after go-live and one unknown department: refused whole, every problem named.
    let mut bad = good.clone();
    bad[1]["visited_at"] = json!((Utc::now() - Duration::hours(2)).to_rfc3339());
    bad[1]["department"] = json!("NO-SUCH-DEPT");
    let (_, refused) = post(
        &app,
        &csrf,
        "/api/history-import/batches",
        &batch(false, bad),
    )
    .await;
    assert_eq!(refused["status"], "refused", "{refused}");
    let fields: Vec<&str> = refused["problems"]
        .as_array()
        .map(|p| p.iter().filter_map(|x| x["field"].as_str()).collect())
        .unwrap_or_default();
    assert!(
        fields.contains(&"visited_at") && fields.contains(&"department"),
        "{refused}"
    );
    assert_eq!(refused["problems"][0]["record"], 2, "{refused}");
    assert_eq!(visits().await, 0, "a refused batch writes nothing");

    // Committed: dated when it happened, and no live side effects.
    let (_, done) = post(
        &app,
        &csrf,
        "/api/history-import/batches",
        &batch(false, good.clone()),
    )
    .await;
    assert_eq!(done["applied"], true, "{done}");
    let enc: (chrono::DateTime<Utc>, String) = sqlx::query_as(
        "SELECT e.created_at, e.status::text FROM encounters e JOIN history_import_records r ON r.target_id = e.id \
          WHERE r.external_id = $1",
    ).bind(format!("V{t}")).fetch_one(&app.db).await.expect("visit");
    assert!(
        (enc.0 - (at + Duration::hours(1))).num_seconds().abs() < 2,
        "dated when it happened"
    );
    let order: Uuid =
        sqlx::query_scalar("SELECT target_id FROM history_import_records WHERE external_id = $1")
            .bind(format!("L{t}"))
            .fetch_one(&app.db)
            .await
            .expect("order");
    let alerts: i64 =
        sqlx::query_scalar("SELECT count(*) FROM lab_critical_alerts WHERE order_id = $1")
            .bind(order)
            .fetch_one(&app.db)
            .await
            .expect("alerts");
    assert_eq!(alerts, 0, "a historical critical value raises no alert");
    let stock: i32 =
        sqlx::query_scalar("SELECT current_stock FROM pharmacy_catalog WHERE code = $1")
            .bind(&drug)
            .fetch_one(&app.db)
            .await
            .expect("stock");
    assert_eq!(stock, 0, "a historical dispense moves no stock");
    let bill: (String, String, String) = sqlx::query_as(
        "SELECT i.status::text, i.total_amount::text, i.paid_amount::text FROM invoices i \
           JOIN history_import_records r ON r.target_id = i.id WHERE r.external_id = $1",
    )
    .bind(format!("B{t}"))
    .fetch_one(&app.db)
    .await
    .expect("bill");
    assert_eq!(bill.0, "partially_paid");
    assert!(
        bill.1.starts_with("622.4") && bill.2.starts_with("300"),
        "600 + 20 + 12% GST on 20: {bill:?}"
    );
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'history_import.commit' AND entity_id = $1",
    )
    .bind(
        done["batch_id"]
            .as_str()
            .and_then(|s| s.parse::<Uuid>().ok()),
    )
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1, "the audit log names the batch");

    // Sent again: everything is skipped.
    let (_, again) = post(
        &app,
        &csrf,
        "/api/history-import/batches",
        &batch(false, good),
    )
    .await;
    assert_eq!(again["applied"], true, "{again}");
    assert!(
        again["tallies"]
            .as_array()
            .is_some_and(|ts| ts.iter().all(|t| t["added"] == 0 && t["skipped"] == 1)),
        "{again}"
    );

    // Without the permission: refused.
    let resp = doctor
        .client
        .post(app.url("/api/history-import/batches"))
        .header("x-csrf-token", &doctor.csrf)
        .json(&json!({ "label": "x", "records": [] }))
        .send()
        .await
        .expect("doctor");
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

/// A history import must not freeze the hospital: a sign-in (an audited
/// write, on the same audit chain) completes promptly while a large batch is
/// still being imported.
#[tokio::test]
async fn a_sign_in_is_not_held_up_by_a_running_import() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let t = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(doctor.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");
    let dept: String = sqlx::query_scalar(
        "SELECT d.code FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.deleted_at IS NULL AND d.is_active ORDER BY d.code LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let go_live = Utc::now() - Duration::days(1);
    let resp = app
        .client
        .put(app.url("/api/history-import/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "go_live_at": go_live }))
        .send()
        .await
        .expect("settings");
    assert_eq!(resp.status(), StatusCode::OK);
    let at = Utc::now() - Duration::days(60);
    let mut records = Vec::new();
    for i in 0..1000 {
        let when = (at + Duration::minutes(i)).to_rfc3339();
        records.push(
            json!({ "kind": "patient", "external_id": format!("LP{t}{i}"), "first_name": "Ravi",
            "last_name": "Kumar", "gender": "male", "phone": "9000012345", "registered_at": when }),
        );
        records.push(json!({ "kind": "visit", "external_id": format!("LV{t}{i}"), "patient": format!("LP{t}{i}"),
            "department": dept, "doctor": username, "visited_at": when }));
    }
    let batch = json!({ "label": format!("Load {t}"), "records": records });
    let (client, url, token) = (
        app.client.clone(),
        app.url("/api/history-import/batches"),
        csrf.clone(),
    );
    let import = tokio::spawn(async move {
        client
            .post(url)
            .header("x-csrf-token", token)
            .json(&batch)
            .send()
            .await
            .map(|r| r.status())
    });

    // Let the import get going, then sign in as another user while it runs.
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
    let started = std::time::Instant::now();
    let other = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login = other
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": "admin", "password": "admin123" }))
        .send()
        .await
        .expect("login");
    let took = started.elapsed();
    let import_still_running = !import.is_finished();
    assert_eq!(login.status(), StatusCode::OK);
    assert!(
        took < std::time::Duration::from_secs(1),
        "sign-in took {took:?} while an import ran"
    );
    assert!(
        import_still_running,
        "the batch finished before the sign-in; the test proves nothing"
    );
    assert_eq!(import.await.expect("join").expect("import"), StatusCode::OK);
}
