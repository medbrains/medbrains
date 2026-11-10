//! The AI assistant acts for the clinician, never as them.
//!
//! A read the assistant makes runs with the user's authority — nothing more —
//! and every audit and access row it produces names the assistant as well as
//! the user (RFC-AUTHZ-2026-001 §2A.5). A person's own read does not. A refusal
//! for the user is a refusal for the agent, and the agent cannot write.

use crate::common;

use medbrains_server::middleware::auth::{ActingAgent, ActorKind, Claims, encode_jwt};
use medbrains_server::routes;
use reqwest::StatusCode;
use tower::ServiceExt as _;
use uuid::Uuid;

async fn claims_for(app: &common::TestApp, user: Uuid, run_id: Uuid) -> Claims {
    let (tenant_id, role, perm_version): (Uuid, String, i32) =
        sqlx::query_as("SELECT tenant_id, role::text, perm_version FROM users WHERE id = $1")
            .bind(user)
            .fetch_one(&app.db)
            .await
            .expect("user");
    Claims {
        sub: user,
        tenant_id,
        role,
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version,
        paired_device_id: None,
        act: Some(ActingAgent {
            kind: ActorKind::AiAgent,
            agent: "clinical_assistant".to_owned(),
            model: "test-model".to_owned(),
            run_id,
            conversation_id: None,
        }),
        exp: usize::try_from(chrono::Utc::now().timestamp() + 600).unwrap_or(usize::MAX),
    }
}

/// Rows are written after the response, on a spawned task: wait for them.
async fn count_eventually(app: &common::TestApp, sql: &str, key: String, at_least: i64) -> i64 {
    let mut n = 0;
    for _ in 0..50 {
        n = sqlx::query_scalar::<_, i64>(sql)
            .bind(&key)
            .fetch_one(&app.db)
            .await
            .expect("count");
        if n >= at_least {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    n
}

async fn the_assistant_is_on_the_trail(app: common::TestApp) {
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'UH-AI-' || $2, 'Lakshmi', 'Narayanan', 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(&tag)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let router = routes::build_router(app.state.clone());
    let path = format!("/api/patients/{patient}");

    // 1. The assistant reads the chart: allowed (the admin may), and marked.
    let run = Uuid::new_v4();
    let claims = claims_for(&app, admin, run).await;
    let answer = medbrains_ai::call_api_as_agent(router.clone(), &app.state, &claims, &path)
        .await
        .expect("dispatch");
    assert!(answer.starts_with("HTTP 200"), "{answer}");
    let audit = count_eventually(
        &app,
        "SELECT COUNT(*) FROM audit_log WHERE acting_agent->>'run_id' = $1 \
           AND acting_agent->>'kind' = 'ai_agent' AND entity_type = 'patients'",
        run.to_string(),
        1,
    )
    .await;
    assert!(
        audit >= 1,
        "the assistant's read is not on the audit trail as the assistant's"
    );
    let access = count_eventually(
        &app,
        "SELECT COUNT(*) FROM access_log WHERE acting_agent->>'run_id' = $1",
        run.to_string(),
        1,
    )
    .await;
    assert!(
        access >= 1,
        "the patient's access history does not name the assistant"
    );
    let principal: Uuid = sqlx::query_scalar(
        "SELECT user_id FROM access_log WHERE acting_agent->>'run_id' = $1 LIMIT 1",
    )
    .bind(run.to_string())
    .fetch_one(&app.db)
    .await
    .expect("principal");
    assert_eq!(
        principal, admin,
        "the accountable user must stay the principal"
    );

    // 2. The same read by the person is not marked.
    app.login_admin().await;
    let resp = app.get(&app.client, &path).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let human = count_eventually(
        &app,
        "SELECT COUNT(*) FROM access_log WHERE patient_id = $1::uuid AND acting_agent IS NULL",
        patient.to_string(),
        1,
    )
    .await;
    assert!(
        human >= 1,
        "a person's own read was not logged as theirs alone"
    );

    // 3. Refused for the user is refused for the agent, and the refusal names it.
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(
        &app,
        &csrf,
        "receptionist",
        &[medbrains_core::permissions::patients::VIEW],
    )
    .await;
    let denied_run = Uuid::new_v4();
    let clerk_claims = claims_for(&app, clerk.user_id, denied_run).await;
    let answer = medbrains_ai::call_api_as_agent(router.clone(), &app.state, &clerk_claims, &path)
        .await
        .expect("dispatch");
    assert!(
        answer.starts_with("HTTP 403"),
        "the agent exceeded the user: {answer}"
    );
    assert!(
        !answer.contains("Lakshmi"),
        "a refusal leaked the record: {answer}"
    );
    let refused = count_eventually(
        &app,
        "SELECT COUNT(*) FROM audit_log WHERE action = 'denied' AND acting_agent->>'run_id' = $1",
        denied_run.to_string(),
        1,
    )
    .await;
    assert!(refused >= 1, "the agent's refused read is not on the trail");

    // 4. The agent cannot write, even where the user could.
    let write_run = Uuid::new_v4();
    let token = encode_jwt(
        &claims_for(&app, admin, write_run).await,
        &app.state.jwt_encoding_key,
    )
    .expect("token");
    let write = axum::http::Request::builder()
        .method(axum::http::Method::PUT)
        .uri(&path)
        .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(axum::http::header::CONTENT_TYPE, "application/json")
        .body(axum::body::Body::from(r#"{"first_name":"Changed"}"#))
        .expect("request");
    let resp = router.oneshot(write).await.expect("infallible");
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    let name: String = sqlx::query_scalar("SELECT first_name FROM patients WHERE id = $1")
        .bind(patient)
        .fetch_one(&app.db)
        .await
        .expect("name");
    assert_eq!(name, "Lakshmi", "the agent changed a record");
    let attempt = count_eventually(
        &app,
        "SELECT COUNT(*) FROM audit_log WHERE action = 'agent_write_refused' \
           AND acting_agent->>'run_id' = $1",
        write_run.to_string(),
        1,
    )
    .await;
    assert_eq!(attempt, 1, "the refused agent write is not on the trail");
}

#[tokio::test]
async fn the_assistant_is_on_the_trail_as_owner() {
    the_assistant_is_on_the_trail(common::spawn_app().await).await;
}

#[tokio::test]
async fn the_assistant_is_on_the_trail_as_request_role() {
    the_assistant_is_on_the_trail(common::spawn_app_as_request_role().await).await;
}
