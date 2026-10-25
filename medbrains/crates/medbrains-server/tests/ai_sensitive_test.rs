//! Restricted clinical classes never reach the model, and stored AI prompts
//! do not outlive their retention window.

use crate::common;

use medbrains_server::middleware::auth::{ActingAgent, ActorKind, Claims};
use medbrains_server::routes;
use uuid::Uuid;

async fn admin_agent(app: &common::TestApp) -> Claims {
    let (tenant_id, sub, role, perm_version): (Uuid, Uuid, String, i32) = sqlx::query_as(
        "SELECT tenant_id, id, role::text, perm_version FROM users WHERE username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("admin");
    Claims {
        sub,
        tenant_id,
        role,
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version,
        paired_device_id: None,
        act: Some(ActingAgent {
            kind: ActorKind::AiAgent,
            agent: "clinical_assistant".to_owned(),
            model: "test".to_owned(),
            run_id: Uuid::new_v4(),
            conversation_id: None,
        }),
        exp: usize::MAX,
    }
}

#[tokio::test]
async fn restricted_records_are_not_even_fetched_for_the_model() {
    let app = common::spawn_app().await;
    let claims = admin_agent(&app).await;
    let router = routes::build_router(app.state.clone());
    for path in [
        "/api/specialty/psychiatry/patients",
        "/api/emergency/mlc",
        "/api/regulatory/pcpndt-forms",
    ] {
        let told = medbrains_ai::call_api_as_agent(router.clone(), &app.state, &claims, path)
            .await
            .expect("dispatch");
        assert!(told.starts_with("Not shared with the AI"), "{path}: {told}");
    }
}

#[tokio::test]
async fn a_patients_hiv_and_psychiatric_entries_are_withheld_from_the_model() {
    let app = common::spawn_app().await;
    let claims = admin_agent(&app).await;
    let mut session = medbrains_ai::session_for(&app.state, &claims, None, None)
        .await
        .expect("session");
    let chart = r#"{"problems":[{"icd_code":"I10","description":"Essential hypertension"},
        {"icd_code":"F31.2","description":"Bipolar affective disorder"}],
        "labs":[{"parameter_name":"HIV-1/2 ELISA","value":"Reactive"},
                {"parameter_name":"Creatinine","value":"1.4"}],
        "notes":"Counselled at ICTC"}"#;
    let out = session.redact(chart).expect("redact");
    let sent = out.for_model();
    for gone in ["Bipolar", "F31", "HIV", "Reactive", "ICTC"] {
        assert!(!sent.contains(gone), "{gone} reached the model: {sent}");
    }
    assert!(
        sent.contains("Essential hypertension") && sent.contains("Creatinine"),
        "{sent}"
    );
}

#[tokio::test]
async fn stored_ai_prompts_expire_and_their_map_goes_with_them() {
    let app = common::spawn_app().await;
    let claims = admin_agent(&app).await;
    let conversation: Uuid = sqlx::query_scalar(
        "INSERT INTO ai_conversations (tenant_id, owner_user_id, title, pseudonym_map, last_message_at) \
         VALUES ($1, $2, 'About [PATIENT_1]', \
                 '{\"entries\":[{\"placeholder\":\"[PATIENT_1]\",\"original\":\"Kavitha\",\"kind\":\"Patient\"}]}', \
                 now() - interval '200 days') RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&app.db)
    .await
    .expect("conversation");
    sqlx::query(
        "INSERT INTO ai_messages (tenant_id, conversation_id, role, content, created_at) \
         VALUES ($1, $2, 'user', 'Does [PATIENT_1] need dialysis?', now() - interval '200 days')",
    )
    .bind(claims.tenant_id)
    .bind(conversation)
    .execute(&app.db)
    .await
    .expect("message");

    medbrains_server::services::retention::run_retention_pass(&app.db)
        .await
        .expect("retention");

    let content: String =
        sqlx::query_scalar("SELECT content FROM ai_messages WHERE conversation_id = $1")
            .bind(conversation)
            .fetch_one(&app.db)
            .await
            .expect("content");
    assert_eq!(content, "[expired under the AI retention limit]");
    let map: serde_json::Value =
        sqlx::query_scalar("SELECT pseudonym_map FROM ai_conversations WHERE id = $1")
            .bind(conversation)
            .fetch_one(&app.db)
            .await
            .expect("map");
    assert_eq!(
        map,
        serde_json::json!({}),
        "the map that re-identifies it survived"
    );
}
