//! A critical lab value nobody acknowledges: escalated by tier until somebody
//! does, never marked escalated when no phone could be reached, and the
//! lab-to-clinician phone call documented on the alert.

use crate::common;

use medbrains_server::services::critical_alert_escalation::escalate_unacknowledged;
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

struct World {
    tenant: Uuid,
    alert: Uuid,
    doctor: Uuid,
    head: Uuid,
}

/// An overdue critical potassium in a department of its own, ordered by a
/// doctor with no phone, whose department head has one.
async fn world(app: &common::TestApp) -> World {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let user = |name: &'static str, phone: Option<&'static str>| {
        let tag = tag.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO users (tenant_id, username, email, full_name, role, phone) \
                 VALUES ($1, $2, $3, $4, 'doctor', $5) RETURNING id",
            )
            .bind(tenant)
            .bind(format!("{name}{tag}").to_lowercase())
            .bind(format!("{name}{tag}@h.test").to_lowercase())
            .bind(name)
            .bind(phone)
            .fetch_one(&app.db)
            .await
            .expect("user")
        }
    };
    let doctor = user("orderer", None).await;
    let head = user("hod", Some("9876505555")).await;
    let employee: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name, user_id) \
         VALUES ($1, $2, 'Head', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("HOD-{tag}"))
    .bind(head)
    .fetch_one(&app.db)
    .await
    .expect("employee");
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type, head_employee_id) \
         VALUES ($1, $2, $3, 'clinical', $4) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CV{tag}"))
    .bind(format!("Critical ward {tag}"))
    .bind(employee)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Crit', 'Value', 'female', '9000000002') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-CV-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
         VALUES ($1, $2, 'opd', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(department)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    let test: Uuid = sqlx::query_scalar("SELECT id FROM lab_test_catalog LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded test");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(test)
    .bind(doctor)
    .fetch_one(&app.db)
    .await
    .expect("order");
    let result: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value) \
         VALUES ($1, $2, 'Potassium', '6.9') RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .fetch_one(&app.db)
    .await
    .expect("result");
    let alert: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_critical_alerts \
         (tenant_id, order_id, result_id, patient_id, parameter_name, value, flag, notified_to, \
          created_at) \
         VALUES ($1, $2, $3, $4, 'Potassium', '6.9', 'critical_high'::lab_result_flag, $5, \
                 now() - interval '30 minutes') RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .bind(result)
    .bind(patient)
    .bind(doctor)
    .fetch_one(&app.db)
    .await
    .expect("alert");
    World {
        tenant,
        alert,
        doctor,
        head,
    }
}

async fn state(app: &common::TestApp, alert: Uuid) -> (i16, bool, Option<String>) {
    sqlx::query_as(
        "SELECT escalation_tier, escalated_at IS NOT NULL, escalation_blocked_reason \
           FROM lab_critical_alerts WHERE id = $1",
    )
    .bind(alert)
    .fetch_one(&app.db)
    .await
    .expect("alert state")
}

async fn age(app: &common::TestApp, alert: Uuid) {
    sqlx::query(
        "UPDATE lab_critical_alerts SET escalation_attempted_at = now() - interval '30 minutes' \
          WHERE id = $1",
    )
    .bind(alert)
    .execute(&app.db)
    .await
    .expect("age");
}

async fn texts_to(app: &common::TestApp, alert: Uuid) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT payload->>'to' FROM outbox_events \
          WHERE aggregate_type = 'lab_critical_alert' AND aggregate_id = $1 ORDER BY payload->>'to'",
    )
    .bind(alert)
    .fetch_all(&app.db)
    .await
    .expect("texts")
}

fn sms(on: bool) -> common::TestSecrets {
    common::TestSecrets::default().with("TWILIO_ACCOUNT_SID", if on { "ACtest" } else { "" })
}

#[tokio::test]
async fn a_critical_value_escalates_by_tier_and_never_fakes_an_escalation() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let w = world(&app).await;
    let (on, off) = (sms(true), sms(false));

    // ── No phone on file: not escalated, the department head told in-app ──
    escalate_unacknowledged(&app.db, &on).await.expect("pass");
    let (tier, escalated, blocked) = state(&app, w.alert).await;
    assert_eq!(
        (tier, escalated),
        (0, false),
        "an escalation nobody received is not one"
    );
    assert!(blocked.is_some_and(|b| b.contains("no phone")));
    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE user_id = $1 AND entity_id = $2 \
           AND title = 'Critical value escalation not sent'",
    )
    .bind(w.head)
    .bind(w.alert)
    .fetch_one(&app.db)
    .await
    .expect("head notified");
    assert_eq!(
        told, 1,
        "the department head hears the escalation could not be sent"
    );
    assert!(texts_to(&app, w.alert).await.is_empty());

    // ── A phone, but no SMS set up: still blocked, and said ──
    sqlx::query("UPDATE users SET phone = '9876504444' WHERE id = $1")
        .bind(w.doctor)
        .execute(&app.db)
        .await
        .expect("doctor phone");
    age(&app, w.alert).await;
    escalate_unacknowledged(&app.db, &off).await.expect("pass");
    let (tier, escalated, blocked) = state(&app, w.alert).await;
    assert_eq!((tier, escalated), (0, false));
    assert_eq!(
        blocked.as_deref(),
        Some("Escalation not sent: SMS is not set up")
    );

    // ── SMS set up: tier 1 texts the doctor ──
    age(&app, w.alert).await;
    escalate_unacknowledged(&app.db, &on).await.expect("pass");
    assert_eq!(state(&app, w.alert).await, (1, true, None));
    assert_eq!(
        texts_to(&app, w.alert).await,
        vec!["+919876504444".to_owned()]
    );

    // ── Still unacknowledged: tier 2 adds the department head ──
    age(&app, w.alert).await;
    escalate_unacknowledged(&app.db, &on).await.expect("pass");
    assert_eq!(
        state(&app, w.alert).await.0,
        2,
        "it repeats until acknowledged"
    );
    let to = texts_to(&app, w.alert).await;
    assert!(
        to.contains(&"+919876505555".to_owned()),
        "tier 2 reaches the head: {to:?}"
    );

    // ── The read-back calls are documented, append-only ──
    let call = |body: serde_json::Value| {
        app.client
            .post(app.url(&format!("/api/lab/critical-alerts/{}/phone-call", w.alert)))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    let bad = call(json!({ "received_by": "Dr Rao", "attempts": 0, "readback_value": "6.9" }))
        .await
        .expect("bad call");
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);
    let wrong: serde_json::Value =
        call(json!({ "received_by": "Dr Rao", "attempts": 1, "readback_value": "9.6" }))
            .await
            .expect("wrong call")
            .json()
            .await
            .expect("call json");
    assert_eq!(
        wrong["readback_confirmed"], false,
        "the server decides the read-back"
    );
    let right: serde_json::Value =
        call(json!({ "received_by": "Dr Rao, ward 4", "attempts": 2, "readback_value": " 6.9 " }))
            .await
            .expect("call")
            .json()
            .await
            .expect("call json");
    assert_eq!(right["readback_confirmed"], true);
    let calls: Vec<(Uuid, String, bool)> = sqlx::query_as(
        "SELECT called_by, received_by, readback_confirmed FROM lab_critical_calls \
          WHERE alert_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(w.alert)
    .bind(w.tenant)
    .fetch_all(&app.db)
    .await
    .expect("calls");
    assert_eq!(
        calls.len(),
        2,
        "a second call is a second row, not an overwrite"
    );
    assert_eq!((calls[1].1.as_str(), calls[1].2), ("Dr Rao, ward 4", true));
    let rewrite = sqlx::query(
        "UPDATE lab_critical_calls SET received_by = 'someone else' WHERE alert_id = $1",
    )
    .bind(w.alert)
    .execute(&app.db)
    .await;
    assert!(rewrite.is_err(), "a call record cannot be edited");

    // Acknowledged: the pass leaves it alone.
    sqlx::query("UPDATE lab_critical_alerts SET acknowledged_at = now() WHERE id = $1")
        .bind(w.alert)
        .execute(&app.db)
        .await
        .expect("ack");
    age(&app, w.alert).await;
    escalate_unacknowledged(&app.db, &on).await.expect("pass");
    assert_eq!(
        state(&app, w.alert).await.0,
        2,
        "an acknowledged value stops escalating"
    );
}
