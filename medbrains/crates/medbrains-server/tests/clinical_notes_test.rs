//! The case sheet: a note is a draft, then signed and frozen; revised only
//! within the grace period (the signed version kept), added to after it;
//! marked in error, never removed (RFC-MODULE-clinical-notes, phase 1).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn encounter(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Case', 'Sheet', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-CN-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned()
}

async fn call(
    app: &common::TestApp,
    csrf: &str,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let url = app.url(path);
    let req = match method {
        "PUT" => app.client.put(url),
        "GET" => app.client.get(url),
        _ => app.client.post(url),
    };
    send(csrf, req.json(&body)).await
}

fn soap(subjective: &str, plan: &str) -> Value {
    json!({ "sections": [
        { "code": "subjective", "title": "Subjective", "text": subjective },
        { "code": "plan", "title": "Plan", "text": plan },
    ]})
}

async fn set_grace(app: &common::TestApp, minutes: i64) {
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT tenant_id, 'clinical_notes', 'grace_minutes', to_jsonb($1::bigint) \
           FROM users WHERE username = 'admin' \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(minutes)
    .execute(&app.db)
    .await
    .expect("grace setting");
}

/// Given a consultation note written and signed, Then it is frozen with its
/// fingerprint and the visit's consultation row shows it; revising within
/// the grace keeps the signed version; once the grace is over only an
/// addendum adds to it; marked in error it stays, with the reason.
#[tokio::test]
async fn a_note_is_signed_revised_in_grace_added_to_and_marked_in_error() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    set_grace(&app, 30).await;
    let encounter = encounter(&app, &csrf).await;
    let notes = format!("/api/encounters/{encounter}/clinical-notes");

    let (status, note) = call(
        &app,
        &csrf,
        "POST",
        &notes,
        json!({ "note_type_code": "consultation" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{note}");
    let id = note["id"].as_str().expect("note id").to_owned();
    assert_eq!(note["status"], "draft");

    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "an empty note is not signed"
    );

    let (status, saved) = call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/clinical-notes/{id}/draft"),
        soap("Cough for three weeks", "Chest X-ray"),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    let (status, signed) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    assert_eq!(signed["status"], "signed");
    assert_eq!(signed["revisable"], true, "inside the grace period");

    let projected: Option<String> = sqlx::query_scalar(
        "SELECT chief_complaint FROM consultations WHERE encounter_id = $1::uuid AND deleted_at IS NULL",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("consultation row");
    assert_eq!(
        projected.as_deref(),
        Some("Cough for three weeks"),
        "older screens read the note"
    );

    let (status, _) = call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/clinical-notes/{id}/draft"),
        soap("changed", ""),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "a signed note is not a draft");
    let frozen = sqlx::query("UPDATE note_versions SET sections = '[]' WHERE note_id = $1::uuid")
        .bind(&id)
        .execute(&app.db)
        .await;
    assert!(
        frozen.is_err(),
        "the database itself refuses to change a signed version"
    );

    let (status, revised) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/revise"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{revised}");
    assert_eq!(
        (
            revised["status"].as_str(),
            revised["current_version"].as_i64()
        ),
        (Some("draft"), Some(2))
    );
    call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/clinical-notes/{id}/draft"),
        soap("Cough for three weeks", "Chest X-ray; salbutamol"),
    )
    .await;
    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let versions: Vec<(i32, bool)> = sqlx::query_as(
        "SELECT version, frozen FROM note_versions WHERE note_id = $1::uuid ORDER BY version",
    )
    .bind(&id)
    .fetch_all(&app.db)
    .await
    .expect("versions");
    assert_eq!(
        versions,
        vec![(1, true), (2, true)],
        "the first signed text is kept"
    );

    sqlx::query(
        "UPDATE clinical_notes SET locked_at = now() - interval '1 minute' WHERE id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await
    .expect("grace over");
    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/revise"),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "after the grace only an addendum"
    );

    let (status, addendum) = call(
        &app,
        &csrf,
        "POST",
        &notes,
        json!({ "note_type_code": "consultation", "amends_note_id": id,
                "sections": [{ "code": "addendum", "title": "Addendum", "text": "CXR normal" }] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{addendum}");
    assert_eq!(addendum["amends_note_id"].as_str(), Some(id.as_str()));

    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/entered-in-error"),
        json!({ "reason": " " }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "in error says why");
    let (status, struck) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/entered-in-error"),
        json!({ "reason": "Wrong patient" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{struck}");
    let (_, sheet) = call(&app, &csrf, "GET", &notes, Value::Null).await;
    let first = sheet
        .as_array()
        .expect("notes")
        .iter()
        .find(|n| n["id"] == json!(id))
        .expect("still on the sheet");
    assert_eq!(first["status"], "entered_in_error");
    assert_eq!(first["entered_in_error_reason"], "Wrong patient");
}

/// Care written up more than a day later is a late entry: it must say why.
#[tokio::test]
async fn a_late_entry_says_why() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let (_, note) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/encounters/{encounter}/clinical-notes"),
        json!({ "note_type_code": "progress",
                "service_at": (chrono::Utc::now() - chrono::Duration::hours(30)).to_rfc3339() }),
    )
    .await;
    let id = note["id"].as_str().expect("note id").to_owned();
    call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/clinical-notes/{id}/draft"),
        soap("Stable overnight", ""),
    )
    .await;
    let (status, refused) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    let (status, signed) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({ "late_entry_reason": "Night emergency; written next morning" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    assert_eq!(
        signed["late_entry_reason"],
        "Night emergency; written next morning"
    );
}

/// Given history already taken on the visit, When the doctor starts a
/// consultation note, Then it opens with that history; saving the history
/// leaves the plan alone; a draft does not reach the visit's consultation
/// row, and signing puts the history and the examination there.
#[tokio::test]
async fn history_ros_and_examination_are_sections_of_the_signed_note() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/opd/encounters/{encounter}/consultation"),
        json!({ "hpi": "Cough for three weeks",
                "past_medical_history": [{ "condition": "Diabetes", "status": "controlled" }] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, note) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/encounters/{encounter}/clinical-notes"),
        json!({ "note_type_code": "consultation" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{note}");
    let id = note["id"].as_str().expect("note id").to_owned();
    let history = note["sections"]
        .as_array()
        .expect("sections")
        .iter()
        .find(|s| s["code"] == "history")
        .expect("history section")
        .clone();
    assert_eq!(
        history["data"]["hpi"], "Cough for three weeks",
        "the note opens with the history taken"
    );

    call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/clinical-notes/{id}/draft"),
        json!({ "sections": [{ "code": "plan", "text": "Chest X-ray" }] }),
    )
    .await;
    let (status, saved) = call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/clinical-notes/{id}/draft"),
        json!({ "sections": [
            { "code": "history", "data": { "hpi": "Cough for three weeks, worse at night" } },
            { "code": "examination", "data": { "exam": { "respiratory": "Bilateral wheeze" },
                                               "general_appearance": "Comfortable" } },
        ]}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    let plan = saved["sections"]
        .as_array()
        .expect("sections")
        .iter()
        .find(|s| s["code"] == "plan")
        .expect("plan")
        .clone();
    assert_eq!(
        plan["text"], "Chest X-ray",
        "saving the history leaves the plan alone"
    );

    let row = || async {
        sqlx::query_as::<_, (Option<String>, Option<Value>)>(
            "SELECT hpi, physical_examination FROM consultations \
              WHERE encounter_id = $1::uuid AND deleted_at IS NULL",
        )
        .bind(&encounter)
        .fetch_one(&app.db)
        .await
        .expect("consultation row")
    };
    assert_eq!(
        row().await.0.as_deref(),
        Some("Cough for three weeks"),
        "a draft is the author's"
    );

    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (hpi, exam) = row().await;
    assert_eq!(
        hpi.as_deref(),
        Some("Cough for three weeks, worse at night")
    );
    assert_eq!(exam.expect("exam")["respiratory"], "Bilateral wheeze");
}
