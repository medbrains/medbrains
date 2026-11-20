//! Typed actions through the kernel broker (`docs/architecture/ACTIONS.md`), as
//! a person and as the assistant acting for one. Each test runs in a hospital of
//! its own, so a switched-off brick or a stray patient touches no other test.

use crate::common;

use medbrains_kernel::action::{ActionError, Invoker, Refusal};
use medbrains_kernel::{ActingAgent, Actor, ActorKind, Claims};
use medbrains_server::actions::{run_action, run_action_owned};
use medbrains_server::error::AppError;
use serde_json::{Value, json};
use uuid::Uuid;

/// A hospital of its own and one doctor in it; `opd_off` switches the EMR off.
async fn hospital(app: &common::TestApp, opd_off: bool) -> (Uuid, Uuid) {
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Action Hospital', 'multi_specialty') RETURNING id",
    )
    .bind(format!("AC{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    if opd_off {
        sqlx::query(
            "INSERT INTO module_config (tenant_id, code, name, status) \
             VALUES ($1, 'opd', 'OPD / Outpatient', 'disabled')",
        )
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("emr off");
    }
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
         SELECT $1, $2, $2 || '@actions.example.org', 'Action Doctor', 'doctor', password_hash \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(tenant)
    .bind(format!("act_{}", tag.to_lowercase()))
    .fetch_one(&app.db)
    .await
    .expect("doctor");
    (tenant, user)
}

/// A doctor's claims holding exactly `permissions`.
fn claims(tenant_id: Uuid, user: Uuid, permissions: &[&str]) -> Claims {
    Claims {
        sub: user,
        tenant_id,
        role: "doctor".to_owned(),
        permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 0,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

/// A patient registered in `tenant`.
async fn patient(app: &common::TestApp, tenant: Uuid, uhid: &str, phone: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Asha', 'Sample', 'female'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(uhid)
    .bind(phone)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// Run `id` as the person in `who`.
async fn run(
    app: &common::TestApp,
    who: &Claims,
    id: &str,
    input: Value,
) -> Result<Value, ActionError<AppError>> {
    run_action(&app.state, who, Invoker::Person, id, input).await
}

/// The ids in a list answer.
fn ids(rows: &Value) -> Vec<String> {
    rows.as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|r| r["id"].as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

#[tokio::test]
async fn find_matches_name_phone_and_uhid_in_this_hospital_only() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, false).await;
    let (other, _) = hospital(&app, false).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let phone = format!("98{}", &Uuid::new_v4().as_u128().to_string()[..8]);
    let asha = patient(&app, tenant, &format!("UH-AC-{tag}"), &phone)
        .await
        .to_string();
    patient(&app, other, &format!("UH-AO-{tag}"), &phone).await;
    let desk = claims(tenant, user, &["patients.find"]);

    let spaced = format!("+91 {} {}", &phone[..5], &phone[5..]);
    for query in [
        "asha sample",
        "sample ash",
        spaced.as_str(),
        &format!("uh-ac-{tag}"),
    ] {
        let rows = run(&app, &desk, "patients.find", json!({ "query": query }))
            .await
            .expect("find");
        assert_eq!(
            ids(&rows),
            vec![asha.clone()],
            "{query}: only this hospital's Asha"
        );
    }
}

#[tokio::test]
async fn summary_masks_the_fields_the_reader_may_not_see() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, false).await;
    let phone = format!("98{}", &Uuid::new_v4().as_u128().to_string()[..8]);
    let seen = patient(
        &app,
        tenant,
        &format!("UH-SM-{}", Uuid::new_v4().simple()),
        &phone,
    )
    .await;
    let unseen = patient(
        &app,
        tenant,
        &format!("UH-SN-{}", Uuid::new_v4().simple()),
        &phone,
    )
    .await;
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'attending_physician', 'user', $3::text, $3)",
    )
    .bind(tenant)
    .bind(seen)
    .bind(user)
    .execute(&app.db)
    .await
    .expect("attending");
    sqlx::query(
        "UPDATE users SET access_matrix = '{\"field_access\": {\"patients.phone\": \"mask\"}}' \
          WHERE id = $1",
    )
    .bind(user)
    .execute(&app.db)
    .await
    .expect("mask phone");
    let doctor = claims(tenant, user, &["patients.view"]);

    let one = run(
        &app,
        &doctor,
        "patients.summary",
        json!({ "patient_id": seen }),
    )
    .await
    .expect("summary");
    assert_eq!(one["first_name"], "Asha");
    assert_eq!(one["total_visits"], 0);
    let shown = one["phone"].as_str().expect("phone");
    assert_ne!(shown, phone, "a masked phone never leaves the server whole");
    assert!(shown.ends_with(&phone[phone.len() - 4..]), "{shown}");

    let other = run(
        &app,
        &doctor,
        "patients.summary",
        json!({ "patient_id": unseen }),
    )
    .await;
    assert!(
        matches!(other, Err(ActionError::Failed(AppError::NotFound))),
        "{other:?}"
    );
}

#[tokio::test]
async fn queue_today_lists_todays_rows_only() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, false).await;
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, 'GEN-MED', 'General Medicine', 'clinical') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let asha = patient(&app, tenant, "UH-QT-1", "9800000001").await;
    let queued: Vec<(Uuid, chrono::NaiveDate)> = sqlx::query_as(
        "WITH e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
                    SELECT $1, $2, 'opd' FROM generate_series(1, 2) RETURNING id), \
              n AS (SELECT id, row_number() OVER () AS n FROM e) \
         INSERT INTO opd_queues (tenant_id, encounter_id, department_id, token_number, status, queue_date) \
         SELECT $1, id, $3, n, 'waiting'::queue_status, \
                (timezone(COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC'), now()))::date \
                  - (n - 1)::int \
           FROM n RETURNING id, queue_date",
    )
    .bind(tenant)
    .bind(asha)
    .bind(department)
    .fetch_all(&app.db)
    .await
    .expect("queue: one today, one yesterday");
    let desk = claims(tenant, user, &["opd.queue.list", "patients.view"]);

    let rows = run(
        &app,
        &desk,
        "opd.queue.today",
        json!({ "department_id": department }),
    )
    .await
    .expect("queue");
    let today = queued
        .iter()
        .max_by_key(|(_, day)| *day)
        .map(|(id, _)| id.to_string());
    assert_eq!(
        ids(&rows),
        Vec::from_iter(today),
        "today's row, not yesterday's"
    );
    assert_eq!(rows[0]["patient_name"], "Asha Sample");
    let all = run(&app, &desk, "opd.queue.today", json!({}))
        .await
        .expect("queue");
    assert_eq!(ids(&all).len(), 1);
}

#[tokio::test]
async fn a_caller_without_the_permission_is_refused_and_the_refusal_audited() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, false).await;
    let nobody = claims(tenant, user, &["patients.view"]);

    let got = run(&app, &nobody, "patients.find", json!({ "query": "asha" })).await;
    assert!(
        matches!(got, Err(ActionError::Refused(Refusal::Denied))),
        "{got:?}"
    );
    let outcome: Option<String> = sqlx::query_scalar(
        "SELECT new_values->>'outcome' FROM audit_log \
          WHERE tenant_id = $1 AND user_id = $2 AND action = 'patients.find'",
    )
    .bind(tenant)
    .bind(user)
    .fetch_optional(&app.db)
    .await
    .expect("audit");
    assert_eq!(outcome.as_deref(), Some("deny"));
}

#[tokio::test]
async fn a_switched_off_brick_is_refused() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, true).await;
    let desk = claims(tenant, user, &["opd.queue.list"]);

    let got = run(&app, &desk, "opd.queue.today", json!({})).await;
    assert!(
        matches!(got, Err(ActionError::Refused(Refusal::ModuleOff))),
        "{got:?}"
    );
    let unknown = run(&app, &desk, "opd.nothing", json!({})).await;
    assert!(matches!(
        unknown,
        Err(ActionError::Failed(AppError::NotFound))
    ));
}

#[tokio::test]
async fn the_assistant_reads_for_a_person_and_the_audit_names_both() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, false).await;
    let run_id = Uuid::new_v4();
    let mut desk = claims(tenant, user, &["patients.find"]);
    desk.act = Some(ActingAgent {
        kind: ActorKind::AiAgent,
        agent: "assistant".to_owned(),
        model: "test".to_owned(),
        run_id,
        conversation_id: None,
    });
    let assistant = Invoker::Assistant {
        on_behalf_of: Actor::from_claims(&desk),
    };

    let rows = run_action(
        &app.state,
        &desk,
        assistant,
        "patients.find",
        json!({ "query": "asha" }),
    )
    .await
    .expect("an assistant read runs");
    assert_eq!(rows, json!([]));
    let row: (
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = sqlx::query_as(
        "SELECT new_values->>'invoker', new_values->>'acting_user', new_values->>'on_behalf_of', \
                new_values->'agent'->>'run_id' \
           FROM audit_log WHERE tenant_id = $1 AND action = 'patients.find' \
            AND new_values->>'outcome' = 'allow'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("one allow row");
    let user = user.to_string();
    assert_eq!(
        row,
        (
            Some("assistant".into()),
            None,
            Some(user),
            Some(run_id.to_string())
        )
    );
}

#[tokio::test]
async fn the_assistants_runner_refuses_a_switched_off_brick_and_audits_it() {
    let app = common::spawn_app().await;
    let (tenant, user) = hospital(&app, true).await;
    let mut desk = claims(tenant, user, &["opd.queue.list"]);
    desk.act = Some(ActingAgent {
        kind: ActorKind::AiAgent,
        agent: "assistant".to_owned(),
        model: "test".to_owned(),
        run_id: Uuid::new_v4(),
        conversation_id: None,
    });
    let assistant = Invoker::Assistant {
        on_behalf_of: Actor::from_claims(&desk),
    };

    let got = run_action_owned(
        app.state.clone(),
        desk,
        assistant,
        "opd.queue.today",
        json!({}),
    )
    .await;
    assert!(
        matches!(got, Err(ActionError::Refused(Refusal::ModuleOff))),
        "{got:?}"
    );
    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT new_values->>'invoker', new_values->>'outcome' FROM audit_log \
          WHERE tenant_id = $1 AND action = 'opd.queue.today'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("one refusal row");
    assert_eq!(row, (Some("assistant".into()), Some("module_off".into())));
}
