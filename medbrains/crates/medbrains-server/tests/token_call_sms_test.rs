//! The "your token is called" SMS: every queue, DLT-scoped, consent-honouring,
//! and refused visibly when the hospital has no DLT template for it.
//!
//! Run as the owner and again with `TEST_APP_DATABASE_URL` set to the
//! `medbrains_app` role, which row level security applies to.

use crate::common;

use std::sync::Arc;

use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::twilio::SmsSendHandler;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const SCOPE: &str = "sms.token_called";

/// The admin's tenant with the SMS switched on, and a department of this
/// test's own so concurrent suites never share a queue.
async fn tenant_with_sms_on(app: &common::TestApp) -> (Uuid, Uuid) {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'notifications', 'token_call_sms', 'true'::jsonb) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("switch the token-call SMS on");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("TS{suffix}"))
    .bind(format!("Sample room {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department");
    (tenant, department)
}

async fn patient(app: &common::TestApp, tenant: Uuid) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Kavya', 'Iyer', 'female'::gender, '9876500022') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-TS-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// Issue a token in `module` for the patient and call it; the token id.
async fn issue_and_call(
    app: &common::TestApp,
    csrf: &str,
    (module, department, patient): (&str, Uuid, Uuid),
) -> String {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "module": module, "scope": "department", "scope_id": department, "patient_id": patient,
        }))
        .send()
        .await
        .expect("issue");
    assert_eq!(resp.status(), StatusCode::OK, "issue a {module} token");
    let token: Value = resp.json().await.expect("token json");
    let id = token["id"].as_str().expect("token id").to_owned();
    let called = app
        .client
        .post(app.url(&format!("/api/tokens/{id}/call")))
        .header("x-csrf-token", csrf)
        .json(&json!({}))
        .send()
        .await
        .expect("call");
    assert_eq!(called.status(), StatusCode::OK, "call the {module} token");
    id
}

/// Given the SMS on and a patient with a mobile, When a lab, pharmacy, billing
/// or registration desk calls their token, Then one SMS is queued under the DLT
/// scope with the number, the room and the hospital — and not their name.
#[tokio::test]
async fn every_queue_that_calls_a_patient_queues_a_dlt_scoped_sms() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, department) = tenant_with_sms_on(&app).await;
    for module in ["lab", "pharmacy", "billing", "registration"] {
        let patient = patient(&app, tenant).await;
        let id = issue_and_call(&app, &csrf, (module, department, patient)).await;
        let rows = app.outbox_rows(SCOPE, &id).await;
        assert_eq!(rows.len(), 1, "{module}: one call, one SMS");
        let sms = &rows[0];
        assert_eq!(sms["template_scope"], SCOPE, "{module}: {sms}");
        assert_eq!(sms["to"], "+919876500022");
        assert!(sms["variables"]["token"].is_string(), "{sms}");
        assert!(
            sms["variables"]["room"]
                .as_str()
                .is_some_and(|r| r.starts_with("Sample room")),
            "{sms}"
        );
        assert!(sms["variables"]["hospital"].is_string(), "{sms}");
        let text = sms.to_string();
        assert!(
            !text.contains("Kavya") && !text.contains("UH-TS-"),
            "no PHI: {text}"
        );
    }
}

/// Given a patient who withdrew SMS, When their token is called, Then nothing
/// is queued.
#[tokio::test]
async fn a_patient_who_withdrew_sms_is_not_texted() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, department) = tenant_with_sms_on(&app).await;
    let patient = patient(&app, tenant).await;
    let resp = app
        .client
        .put(app.url(&format!("/api/patients/{patient}/contact-consents")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "channel": "sms", "granted": false }))
        .send()
        .await
        .expect("withdraw sms");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );

    let id = issue_and_call(&app, &csrf, ("pharmacy", department, patient)).await;
    assert!(
        app.outbox_rows(SCOPE, &id).await.is_empty(),
        "withdrawn means no text"
    );
}

fn handler_ctx(app: &common::TestApp, tenant: Uuid, secrets: common::TestSecrets) -> HandlerCtx {
    HandlerCtx {
        pool: app.db.clone(),
        tenant_id: tenant,
        event_id: Uuid::new_v4(),
        event_type: SCOPE.to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(secrets),
        http_client: reqwest::Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-token-call-sms-tests"),
        )),
    }
}

async fn status(app: &common::TestApp) -> Value {
    let resp = app
        .client
        .get(app.url("/api/tokens/call-sms/status"))
        .send()
        .await
        .expect("status");
    assert_eq!(resp.status(), StatusCode::OK);
    resp.json().await.expect("status json")
}

/// Given DLT enforced and no template, When the SMS is handled, Then it is
/// refused with a reason naming the scope, and the settings screen shows the
/// template missing and the refusal. Once a template is registered the send
/// passes the DLT gate. One test, because the template is tenant-wide.
#[tokio::test]
async fn without_a_template_the_send_is_refused_and_the_screen_says_so() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, department) = tenant_with_sms_on(&app).await;
    let patient = patient(&app, tenant).await;
    let id = issue_and_call(&app, &csrf, ("lab", department, patient)).await;
    let payload = app.outbox_rows(SCOPE, &id).await.remove(0);

    let before = status(&app).await;
    assert_eq!(before["enabled"], true);
    assert_eq!(before["template_scope"], SCOPE);
    assert!(before["template"].is_null(), "no template yet: {before}");
    assert!(
        before["suggested_pattern"]
            .as_str()
            .is_some_and(|p| p.contains("{#token#}"))
    );

    let handler = SmsSendHandler::with_api_base(SCOPE, "http://127.0.0.1:1");
    let enforced = common::TestSecrets::default().with("DLT_ENFORCE", "true");
    let refused = handler
        .handle(&handler_ctx(&app, tenant, enforced.clone()), &payload)
        .await;
    let Err(HandlerError::Permanent(reason)) = refused else {
        panic!("refused, not sent or retried: {refused:?}");
    };
    assert!(
        reason.contains(SCOPE),
        "the reason names the scope: {reason}"
    );

    // What the worker does with a permanent refusal.
    sqlx::query(
        "INSERT INTO outbox_dlq (original_event_id, tenant_id, event_type, payload, attempts, last_error) \
         VALUES ($1, $2, $3, $4, 1, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(tenant)
    .bind(SCOPE)
    .bind(&payload)
    .bind(&reason)
    .execute(&app.db)
    .await
    .expect("dead-letter the refusal");
    let after = status(&app).await;
    assert!(
        after["refused_last_7_days"]
            .as_i64()
            .is_some_and(|n| n >= 1),
        "{after}"
    );
    assert!(
        after["last_refusal_reason"]
            .as_str()
            .is_some_and(|r| r.contains(SCOPE))
    );

    let template_id = format!("1107{}", &Uuid::new_v4().simple().to_string()[..12]);
    sqlx::query(
        "INSERT INTO dlt_templates (tenant_id, template_id, template_name, category, sender_id, \
            entity_id, body_pattern, variable_count, scope) \
         VALUES ($1, $2, 'Token called', 'transactional', 'MEDBRN', '1101', \
            'Token {#token#} has been called. Please come to {#room#}. - {#hospital#}', 3, $3)",
    )
    .bind(tenant)
    .bind(&template_id)
    .bind(SCOPE)
    .execute(&app.db)
    .await
    .expect("register the template");
    let registered = status(&app).await;
    assert_eq!(
        registered["template"]["template_id"],
        template_id.as_str(),
        "{registered}"
    );

    // Past the DLT gate: the fake provider is unreachable, which is a retry,
    // not a refusal.
    let secrets = enforced
        .with("TWILIO_ACCOUNT_SID", "ACtest")
        .with("TWILIO_AUTH_TOKEN", "t")
        .with("TWILIO_FROM_NUMBER", "+15005550006")
        .with("TWILIO_MESSAGING_SERVICE_SID", "");
    let sent = handler
        .handle(&handler_ctx(&app, tenant, secrets), &payload)
        .await;
    assert!(
        matches!(sent, Err(HandlerError::Transient(_))),
        "past the gate: {sent:?}"
    );

    // Leave the tenant as the next run of this test expects it.
    sqlx::query("DELETE FROM dlt_templates WHERE tenant_id = $1 AND template_id = $2")
        .bind(tenant)
        .bind(&template_id)
        .execute(&app.db)
        .await
        .expect("retire the template");
}
