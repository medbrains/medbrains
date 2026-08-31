mod common;

use uuid::Uuid;

/// Calling a patient in OPD must move the token, not only the queue row.
///
/// `opd_queues` is the clinic's own record and no board reads it. The
/// displays, the front-office console and the doctor's worklist all read
/// `tokens`, and the spoken announcement fires only when a token moves to
/// `called`. Advancing the queue row alone left the desk believing a patient
/// had been called while every screen still showed them waiting, and nobody
/// was ever called over the speaker.
#[tokio::test]
async fn calling_in_opd_advances_the_token_the_boards_read() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let department_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("a seeded department");

    let suffix = &Uuid::new_v4().to_string()[..8];
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Queue', 'Caller', 'other'::gender, '9876511111') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH-CALL-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    // Registration is the path that creates both the queue row and its token.
    let registered: serde_json::Value = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "patient_id": patient_id,
            "department_id": department_id,
        }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("register json");

    let queue_id = registered
        .get("queue")
        .and_then(|q| q.get("id"))
        .and_then(serde_json::Value::as_str)
        .map(|s| s.to_owned())
        .or_else(|| {
            registered
                .get("queue_id")
                .and_then(serde_json::Value::as_str)
                .map(ToOwned::to_owned)
        })
        .expect("registration must return the queue entry");

    let before: String = sqlx::query_scalar(
        "SELECT status FROM tokens WHERE tenant_id = $1 AND patient_id = $2 \
           AND module = 'opd' AND token_date = CURRENT_DATE",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("registration must have issued a token");
    assert_eq!(before, "waiting");

    let res = app
        .client
        .put(app.url(&format!("/api/opd/queue/{queue_id}/call")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("call");
    assert!(res.status().is_success(), "call rejected: {:?}", res.status());

    let after: String = sqlx::query_scalar(
        "SELECT status FROM tokens WHERE tenant_id = $1 AND patient_id = $2 \
           AND module = 'opd' AND token_date = CURRENT_DATE",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("read token status");
    assert_eq!(
        after, "called",
        "the queue row moved but the token did not — every board still shows \
         this patient waiting, and nothing announced them"
    );

    let called_at: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT called_at FROM tokens WHERE tenant_id = $1 AND patient_id = $2 \
           AND module = 'opd' AND token_date = CURRENT_DATE",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("read called_at");
    assert!(
        called_at.is_some(),
        "called_at is what the board's waiting-time column subtracts from"
    );
}
