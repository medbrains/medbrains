//! Live AI whispers reach only the people who may see the patient, always name
//! the patient, and an outage is "couldn't check" — never a quiet stream.

use crate::common;

use std::sync::Arc;

use async_trait::async_trait;
use medbrains_authz::{AuthzBackend, AuthzContext, AuthzError, Relation, RelationTuple, Subject};
use medbrains_server::middleware::auth::Claims;
use medbrains_server::middleware::authorization::authz_context;
use uuid::Uuid;

/// An authorization backend that cannot answer — an outage, not a refusal.
struct Down;

fn down<T>() -> Result<T, AuthzError> {
    Err(AuthzError::Other("authz backend unreachable".to_owned()))
}

#[async_trait]
impl AuthzBackend for Down {
    async fn check(
        &self,
        _: &AuthzContext,
        _: Relation,
        _: &str,
        _: Uuid,
    ) -> Result<bool, AuthzError> {
        down()
    }
    async fn expand(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        down()
    }
    async fn list_accessible(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        down()
    }
    async fn write_tuple(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
        _: Relation,
        _: Subject,
        _: Option<chrono::DateTime<chrono::Utc>>,
        _: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        down()
    }
    async fn grant_raw(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
        _: &str,
        _: Subject,
        _: Option<chrono::DateTime<chrono::Utc>>,
        _: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        down()
    }
    async fn revoke_tuple(&self, _: &AuthzContext, _: Uuid) -> Result<(), AuthzError> {
        down()
    }
}

async fn patient_with_critical_value(
    app: &common::TestApp,
    tenant: Uuid,
    orderer: Uuid,
    name: (&str, &str),
) -> (Uuid, String) {
    let uhid = format!("UH-WH-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, $3, $4, 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(&uhid)
    .bind(name.0)
    .bind(name.1)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
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
    .bind(orderer)
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
    sqlx::query(
        "INSERT INTO lab_critical_alerts \
         (tenant_id, order_id, result_id, patient_id, parameter_name, value, flag) \
         VALUES ($1, $2, $3, $4, 'Potassium', '6.9', 'critical_high'::lab_result_flag)",
    )
    .bind(tenant)
    .bind(order)
    .bind(result)
    .bind(patient)
    .execute(&app.db)
    .await
    .expect("alert");
    (patient, uhid)
}

async fn claims_of(app: &common::TestApp, user: Uuid) -> Claims {
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
        act: None,
        exp: usize::MAX,
    }
}

async fn whispers_reach_only_their_patient(app: common::TestApp) {
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let csrf = app.login_admin().await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let since = chrono::Utc::now() - chrono::Duration::seconds(1);
    let (mine, my_uhid) =
        patient_with_critical_value(&app, tenant, admin, ("Kavitha", "Subramanian")).await;
    let (theirs, their_uhid) =
        patient_with_critical_value(&app, tenant, admin, ("Rajesh", "Kumar")).await;

    // The doctor cares for one of the two.
    let claims = claims_of(&app, doctor.user_id).await;
    app.state
        .authz
        .write_tuple(
            &authz_context(&claims),
            "patient",
            mine,
            Relation::Viewer,
            Subject::User(doctor.user_id),
            None,
            Some("test: under this doctor's care".to_owned()),
        )
        .await
        .expect("grant");

    let got = medbrains_ai::fetch_new_whispers(&app.state, &claims, since)
        .await
        .expect("poll");
    let about: Vec<String> = got
        .iter()
        .filter_map(|w| w.payload["patientId"].as_str().map(str::to_owned))
        .collect();
    assert!(
        about.contains(&mine.to_string()),
        "the doctor's own patient's value is missing"
    );
    assert!(
        !about.contains(&theirs.to_string()),
        "a critical value for a patient the doctor may not see reached them"
    );
    let text =
        serde_json::to_string(&got.iter().map(|w| &w.payload).collect::<Vec<_>>()).expect("json");
    assert!(
        !text.contains("Rajesh") && !text.contains(&their_uhid),
        "leaked: {text}"
    );
    let mine_whisper = got
        .iter()
        .find(|w| w.payload["patientId"] == serde_json::json!(mine))
        .expect("mine");
    let title = mine_whisper.payload["title"].as_str().unwrap_or_default();
    assert!(
        title.contains("Kavitha Subramanian") && title.contains(&my_uhid),
        "the whisper does not name its patient: {title}"
    );

    // Another tenant's session sees neither (tenant predicate + RLS).
    let mut other = claims_of(&app, doctor.user_id).await;
    other.tenant_id = Uuid::new_v4();
    let none = medbrains_ai::fetch_new_whispers(&app.state, &other, since)
        .await
        .expect("poll");
    assert!(
        none.iter().all(|w| w.payload["patientId"].is_null()),
        "a critical value crossed tenants"
    );

    // An outage is an error — the stream turns it into "couldn't check" — and
    // never an empty, healthy-looking poll.
    let mut broken = app.state.clone();
    broken.authz = Arc::new(Down);
    let outage = medbrains_ai::fetch_new_whispers(&broken, &claims, since).await;
    assert!(
        outage.is_err(),
        "an unanswerable visible set was read as 'no alerts'"
    );
}

#[tokio::test]
async fn whispers_reach_only_their_patient_as_owner() {
    whispers_reach_only_their_patient(common::spawn_app().await).await;
}

#[tokio::test]
async fn whispers_reach_only_their_patient_as_request_role() {
    whispers_reach_only_their_patient(common::spawn_app_as_request_role().await).await;
}

/// One assistant conversation is about one patient: a thread grounded on one
/// patient is refused when continued from another patient's screen, so its
/// history can never ground an answer shown there.
#[tokio::test]
async fn a_conversation_does_not_follow_the_clinician_to_another_patient() {
    let app = common::spawn_app().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let (first, _) = patient_with_critical_value(&app, tenant, admin, ("Meena", "Iyer")).await;
    let (second, _) = patient_with_critical_value(&app, tenant, admin, ("Arun", "Prakash")).await;
    // A keyless local provider, so the turn is refused before any model call.
    let previous: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'ai' AND key = 'config'",
    )
    .bind(tenant)
    .fetch_optional(&app.db)
    .await
    .expect("settings");
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'ai', 'config', '{\"provider\":\"ollama\"}') \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("ai config");
    let conversation: Uuid = sqlx::query_scalar(
        "INSERT INTO ai_conversations (tenant_id, owner_user_id, title, patient_id) \
         VALUES ($1, $2, 'About the first patient', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(admin)
    .bind(first)
    .fetch_one(&app.db)
    .await
    .expect("conversation");

    let csrf = app.login_admin().await;
    let resp = app
        .client
        .post(app.url("/api/ai/chat"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "conversation_id": conversation,
            "message": "What should I do next?",
            "context": { "patient_id": second },
        }))
        .send()
        .await
        .expect("chat");
    let status = resp.status();

    match previous {
        Some(value) => sqlx::query(
            "UPDATE tenant_settings SET value = $2 WHERE tenant_id = $1 AND category = 'ai' AND key = 'config'",
        )
        .bind(tenant)
        .bind(value)
        .execute(&app.db)
        .await
        .map(|_| ()),
        None => sqlx::query(
            "DELETE FROM tenant_settings WHERE tenant_id = $1 AND category = 'ai' AND key = 'config'",
        )
        .bind(tenant)
        .execute(&app.db)
        .await
        .map(|_| ()),
    }
    .expect("restore ai config");

    assert_eq!(
        status,
        reqwest::StatusCode::CONFLICT,
        "a thread crossed patients"
    );
    let about: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM ai_conversations WHERE id = $1")
            .bind(conversation)
            .fetch_one(&app.db)
            .await
            .expect("conversation");
    assert_eq!(about, Some(first));
    let stored: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM ai_messages WHERE conversation_id = $1")
            .bind(conversation)
            .fetch_one(&app.db)
            .await
            .expect("messages");
    assert_eq!(
        stored, 0,
        "the refused turn was stored in the other patient's thread"
    );
}
