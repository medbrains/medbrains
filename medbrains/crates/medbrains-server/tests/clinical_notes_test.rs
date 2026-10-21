//! The case sheet: a note is a draft, then signed and frozen; revised only
//! within the grace period (the signed version kept), added to after it;
//! marked in error, never removed (RFC-MODULE-clinical-notes, phase 1).

use crate::common;

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
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value",
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
    // A consultation recorded before the case sheet existed.
    sqlx::query(
        "INSERT INTO consultations (tenant_id, encounter_id, doctor_id, hpi, past_medical_history) \
         SELECT e.tenant_id, e.id, u.id, 'Cough for three weeks', \
                '[{\"condition\": \"Diabetes\", \"status\": \"controlled\"}]'::jsonb \
           FROM encounters e JOIN users u ON u.username = 'admin' WHERE e.id = $1::uuid",
    )
    .bind(&encounter)
    .execute(&app.db)
    .await
    .expect("legacy consultation");

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

/// An admission's case sheet: a consultation is an outpatient note and is
/// refused on a ward; a signed round reaches the older ward-notes read; its
/// first signature bills the round once, and a revision does not bill again.
#[tokio::test]
async fn a_ward_round_is_a_signed_progress_note_billed_once() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    // The visit becomes an admission — the case sheet keys on the encounter.
    let admission: Uuid = sqlx::query_scalar(
        "WITH e AS (UPDATE encounters SET encounter_type = 'ipd' WHERE id = $1::uuid \
                    RETURNING id, tenant_id, patient_id, department_id) \
         INSERT INTO admissions (tenant_id, encounter_id, patient_id, department_id, \
                                 admitting_doctor, status, admitted_at) \
         SELECT e.tenant_id, e.id, e.patient_id, e.department_id, u.id, 'admitted', now() \
           FROM e JOIN users u ON u.username = 'admin' RETURNING id",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("admission");
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT tenant_id, 'billing', 'auto_charge_ipd_doctor_round', 'true'::jsonb \
           FROM users WHERE username = 'admin' \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value",
    )
    .execute(&app.db)
    .await
    .expect("billing on");
    let notes = format!("/api/encounters/{encounter}/clinical-notes");

    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &notes,
        json!({ "note_type_code": "consultation" }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "no consultation note on a ward"
    );

    let (status, round) = call(
        &app,
        &csrf,
        "POST",
        &notes,
        json!({ "note_type_code": "progress",
        "sections": [{ "code": "subjective", "text": "Afebrile overnight" }] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{round}");
    let id = round["id"].as_str().expect("note id").to_owned();
    call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/revise"),
        json!({}),
    )
    .await;
    let (status, second) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{second}");

    let charges: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM invoice_items WHERE source_id = $1::uuid AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("charges");
    assert_eq!(
        charges, 1,
        "the round is billed once; a revision is the same round"
    );

    let (status, legacy) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/ipd/admissions/{admission}/progress-notes"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{legacy}");
    let row = legacy
        .as_array()
        .expect("rows")
        .iter()
        .find(|r| r["id"] == json!(id))
        .expect("listed");
    assert_eq!(row["note_type"], "doctor_round");
    assert_eq!(row["subjective"], "Afebrile overnight");
}

/// Given a doctor leaves a note unsigned, Then it is on their unsigned list
/// and the visit's MRD case sheet is not complete; once signed, it leaves the
/// list and the case sheet reads signed.
#[tokio::test]
async fn an_unsigned_note_is_on_the_authors_list_and_holds_up_the_mrd_packet() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let (_, note) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/encounters/{encounter}/clinical-notes"),
        json!({ "note_type_code": "consultation",
                "sections": [{ "code": "subjective", "text": "Headache for two days" }] }),
    )
    .await;
    let id = note["id"].as_str().expect("note id").to_owned();

    let (status, list) = call(
        &app,
        &csrf,
        "GET",
        "/api/clinical-notes/mine/unsigned",
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert!(
        list.as_array()
            .expect("list")
            .iter()
            .any(|n| n["id"] == json!(id)),
        "the draft is on the author's unsigned list"
    );

    let (status, packet) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/mrd/case-sheets/from-opd/{encounter}"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{packet}");
    let packet_id = packet["id"].as_str().expect("packet id").to_owned();
    let unsigned_item = |completeness: &Value| {
        completeness["items"]
            .as_array()
            .expect("items")
            .iter()
            .find(|i| i["code"] == "unsigned_notes")
            .expect("unsigned_notes item")
            .clone()
    };
    let (_, before) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/mrd/case-sheets/{packet_id}/completeness"),
        Value::Null,
    )
    .await;
    assert_eq!(unsigned_item(&before)["status"], "missing", "{before}");

    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{id}/sign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (_, after) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/mrd/case-sheets/{packet_id}/completeness"),
        Value::Null,
    )
    .await;
    assert_eq!(unsigned_item(&after)["status"], "ok", "{after}");
    let (_, list) = call(
        &app,
        &csrf,
        "GET",
        "/api/clinical-notes/mine/unsigned",
        Value::Null,
    )
    .await;
    assert!(
        !list
            .as_array()
            .expect("list")
            .iter()
            .any(|n| n["id"] == json!(id)),
        "a signed note leaves the list"
    );
}

/// A signed-in doctor in General Medicine: their id, client and CSRF token.
async fn doctor(app: &common::TestApp, admin_csrf: &str) -> (String, reqwest::Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("cosign_{tag}"), format!("Cosign#{tag}Aa9"));
    let dept: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, user) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Dr {tag}"),
            "role": "doctor", "department_ids": [dept],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{user}");
    let client = reqwest::Client::builder()
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
    let csrf = login["csrf_token"].as_str().unwrap_or("").to_owned();
    (
        user["id"].as_str().expect("user id").to_owned(),
        client,
        csrf,
    )
}

async fn call_as(
    app: &common::TestApp,
    (client, csrf): (&reqwest::Client, &str),
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let url = app.url(path);
    let req = if method == "GET" {
        client.get(url)
    } else {
        client.post(url)
    };
    send(csrf, req.json(&body)).await
}

/// Given a resident whose notes the consultant countersigns, When the
/// resident signs, Then the note waits on the consultant and holds up the MRD
/// packet; countersigned, the packet clears; returned with a comment, the
/// note is the resident's draft again; the resident cannot countersign.
#[tokio::test]
async fn a_residents_signed_note_waits_on_the_consultants_countersign() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (resident_id, resident, resident_csrf) = doctor(&app, &csrf).await;
    let (consultant_id, consultant, consultant_csrf) = doctor(&app, &csrf).await;
    let as_resident = (&resident, resident_csrf.as_str());
    let as_consultant = (&consultant, consultant_csrf.as_str());
    let (status, body) = call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/setup/users/{resident_id}/supervisor"),
        json!({ "supervisor_id": consultant_id }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, _) = call(
        &app,
        &csrf,
        "PUT",
        &format!("/api/setup/users/{consultant_id}/supervisor"),
        json!({ "supervisor_id": resident_id }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "no mutual countersigning");

    let encounter = encounter(&app, &csrf).await;
    let write_and_sign = |text: &'static str| {
        let path = format!("/api/encounters/{encounter}/clinical-notes");
        let app = &app;
        async move {
            let (status, note) = call_as(
                app,
                as_resident,
                "POST",
                &path,
                json!({ "note_type_code": "consultation",
                        "sections": [{ "code": "subjective", "text": text }] }),
            )
            .await;
            assert_eq!(status, StatusCode::OK, "{note}");
            let id = note["id"].as_str().expect("note id").to_owned();
            let (status, signed) = call_as(
                app,
                as_resident,
                "POST",
                &format!("/api/clinical-notes/{id}/sign"),
                json!({}),
            )
            .await;
            assert_eq!(status, StatusCode::OK, "{signed}");
            (id, signed)
        }
    };
    let (id, signed) = write_and_sign("Fever for three days").await;
    assert_eq!(signed["cosign_status"], "pending", "{signed}");

    let (_, pending) = call_as(
        &app,
        as_consultant,
        "GET",
        "/api/clinical-notes/countersign/pending",
        Value::Null,
    )
    .await;
    assert!(
        pending
            .as_array()
            .expect("pending")
            .iter()
            .any(|n| n["id"] == json!(id)),
        "on the consultant's list: {pending}"
    );
    let (status, _) = call_as(
        &app,
        as_resident,
        "POST",
        &format!("/api/clinical-notes/{id}/countersign"),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "the author cannot countersign"
    );

    let (_, packet) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/mrd/case-sheets/from-opd/{encounter}"),
        json!({}),
    )
    .await;
    let completeness = format!(
        "/api/mrd/case-sheets/{}/completeness",
        packet["id"].as_str().expect("packet id")
    );
    let unsigned = |c: &Value| {
        c["items"]
            .as_array()
            .expect("items")
            .iter()
            .find(|i| i["code"] == "unsigned_notes")
            .expect("unsigned_notes item")["status"]
            .clone()
    };
    let (_, before) = call(&app, &csrf, "GET", &completeness, Value::Null).await;
    assert_eq!(
        unsigned(&before),
        "missing",
        "awaiting countersign holds the packet"
    );

    let (status, done) = call_as(
        &app,
        as_consultant,
        "POST",
        &format!("/api/clinical-notes/{id}/countersign"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["cosign_status"], "countersigned");
    let (_, after) = call(&app, &csrf, "GET", &completeness, Value::Null).await;
    assert_eq!(unsigned(&after), "ok", "{after}");

    let (second, _) = write_and_sign("Cough, no fever").await;
    let (status, _) = call_as(
        &app,
        as_consultant,
        "POST",
        &format!("/api/clinical-notes/{second}/return"),
        json!({ "comment": "" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a return says why");
    let (status, returned) = call_as(
        &app,
        as_consultant,
        "POST",
        &format!("/api/clinical-notes/{second}/return"),
        json!({ "comment": "Record the chest findings" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{returned}");
    assert_eq!(returned["status"], "draft");
    assert_eq!(returned["cosign_status"], "returned");
    assert_eq!(returned["cosign_comment"], "Record the chest findings");
}

/// Given a patient with three notes, one entered in error and one with an
/// addendum, When the record is reviewed, Then the newest care comes first,
/// each addendum follows its note, the struck note shows only when asked
/// for, and a page continues after the note it ended on.
#[tokio::test]
async fn chart_review_reads_the_record_newest_care_first() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let notes = format!("/api/encounters/{encounter}/clinical-notes");
    let mut signed = Vec::new();
    for (hours_ago, text) in [
        (3, "Fever"),
        (2, "Wrong patient's history"),
        (1, "Afebrile"),
    ] {
        let (_, note) = call(
            &app,
            &csrf,
            "POST",
            &notes,
            json!({ "note_type_code": "consultation",
                    "sections": [{ "code": "subjective", "text": text }] }),
        )
        .await;
        let id = note["id"].as_str().expect("note id").to_owned();
        let (status, _) = call(
            &app,
            &csrf,
            "POST",
            &format!("/api/clinical-notes/{id}/sign"),
            json!({}),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        sqlx::query(
            "UPDATE clinical_notes SET service_at = now() - make_interval(hours => $2), \
                    locked_at = now() - interval '1 minute' WHERE id = $1::uuid",
        )
        .bind(&id)
        .bind(hours_ago)
        .execute(&app.db)
        .await
        .expect("backdate");
        signed.push(id);
    }
    let (first, struck, last) = (&signed[0], &signed[1], &signed[2]);
    let (status, _) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{struck}/entered-in-error"),
        json!({ "reason": "Wrong patient" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (_, addendum) = call(
        &app,
        &csrf,
        "POST",
        &notes,
        json!({ "note_type_code": "consultation", "amends_note_id": first,
                "sections": [{ "code": "addendum", "title": "Addendum", "text": "CXR normal" }] }),
    )
    .await;
    let addendum = addendum["id"].as_str().expect("addendum id").to_owned();

    let patient: Uuid = sqlx::query_scalar("SELECT patient_id FROM encounters WHERE id = $1::uuid")
        .bind(&encounter)
        .fetch_one(&app.db)
        .await
        .expect("patient");
    let chart = format!("/api/patients/{patient}/clinical-notes");
    let ids = |page: &Value| -> Vec<String> {
        page["notes"]
            .as_array()
            .expect("notes")
            .iter()
            .map(|n| n["id"].as_str().expect("id").to_owned())
            .collect()
    };

    let (status, page) = call(&app, &csrf, "GET", &chart, Value::Null).await;
    assert_eq!(status, StatusCode::OK, "{page}");
    assert_eq!(
        ids(&page),
        vec![last.clone(), first.clone(), addendum.clone()],
        "newest care first, the addendum after its note, the struck note left out"
    );
    assert_eq!(page["visits"][0]["encounter_id"], json!(encounter));
    assert!(
        page["facets"]
            .as_array()
            .expect("facets")
            .iter()
            .any(|f| f["kind"] == "note_type" && f["value"] == "consultation"),
        "{page}"
    );

    let (_, in_error) = call(
        &app,
        &csrf,
        "GET",
        &format!("{chart}?status=entered_in_error"),
        Value::Null,
    )
    .await;
    assert_eq!(ids(&in_error), vec![struck.clone()]);

    let newest = &page["notes"][0];
    let next = format!(
        "{chart}?before_at={}&before_id={last}",
        newest["service_at"]
            .as_str()
            .expect("service_at")
            .replace('+', "%2B")
    );
    let (_, older) = call(&app, &csrf, "GET", &next, Value::Null).await;
    assert_eq!(
        ids(&older),
        vec![first.clone(), addendum],
        "the page continues after it"
    );
}

/// Given a visit with a case-sheet packet, When its notes are printed, Then
/// the print is filed on the packet's datewise notes page; a visit with no
/// packet files nothing and says so.
#[tokio::test]
async fn a_printed_case_sheet_is_filed_on_the_packets_notes_page() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let encounter_id: Uuid = encounter.parse().expect("uuid");
    let (status, packet) = call(
        &app,
        &csrf,
        "POST",
        &format!("/api/mrd/case-sheets/from-opd/{encounter}"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{packet}");
    let packet_id: Uuid = packet["id"]
        .as_str()
        .expect("packet")
        .parse()
        .expect("uuid");
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM encounters WHERE id = $1")
        .bind(encounter_id)
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let output: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs (tenant_id, module_code, source_table, source_id, \
           document_number, title, category, status) \
         VALUES ($1, 'clinical_notes', 'encounters', $2, $3, 'Case Sheet', \
           'custom'::document_template_category, 'generated'::document_output_status) \
         RETURNING id",
    )
    .bind(tenant)
    .bind(encounter_id)
    .bind(format!(
        "CS-NOTES-TEST-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .fetch_one(&app.db)
    .await
    .expect("document output");

    let mut tx = app.db.begin().await.expect("tx");
    let filed = medbrains_clinical_notes::print::file_to_mrd(&mut tx, tenant, encounter_id, output)
        .await
        .expect("filed");
    let other =
        medbrains_clinical_notes::print::file_to_mrd(&mut tx, tenant, Uuid::new_v4(), output)
            .await
            .expect("no packet");
    tx.commit().await.expect("commit");
    assert!(filed, "the visit's packet takes the print");
    assert!(!other, "a visit with no packet files nothing");

    let (page_output, page_status): (Option<Uuid>, String) = sqlx::query_as(
        "SELECT document_output_id, status FROM mrd_case_sheet_pages \
          WHERE packet_id = $1 AND page_code = 'opd-datewise-soap'",
    )
    .bind(packet_id)
    .fetch_one(&app.db)
    .await
    .expect("notes page");
    assert_eq!(page_output, Some(output));
    assert_eq!(page_status, "printed");

    // Medical records find the packet: the list bound the permitted-patient
    // set to a single-uuid filter and answered 500 to every call.
    let (status, packets) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/mrd/case-sheets?packet_type=opd&encounter_id={encounter}"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{packets}");
    assert_eq!(packets[0]["id"], json!(packet_id));
}

/// Given a visit with a signed note, its addendum, a note entered in error
/// and a draft, When it is read as FHIR, Then the three that are the record
/// come back as Compositions — typed by LOINC, attested by the signer, the
/// addendum appending its note, the struck one entered-in-error, the text
/// escaped XHTML — and the draft does not exist to a reader.
#[tokio::test]
async fn the_visit_reads_as_fhir_compositions() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let notes = format!("/api/encounters/{encounter}/clinical-notes");
    let write = |text: &'static str, amends: Option<String>| {
        let notes = notes.clone();
        let (app, csrf) = (&app, &csrf);
        async move {
            let mut body = json!({ "note_type_code": "consultation",
                                   "sections": [{ "code": "subjective", "text": text }] });
            if let Some(parent) = amends {
                body = json!({ "note_type_code": "consultation", "amends_note_id": parent,
                               "sections": [{ "code": "addendum", "text": text }] });
            }
            let (status, note) = call(app, csrf, "POST", &notes, body).await;
            assert_eq!(status, StatusCode::OK, "{note}");
            note["id"].as_str().expect("id").to_owned()
        }
    };
    let sign = |id: String| {
        let (app, csrf) = (&app, &csrf);
        async move {
            let (status, _) = call(
                app,
                csrf,
                "POST",
                &format!("/api/clinical-notes/{id}/sign"),
                json!({}),
            )
            .await;
            assert_eq!(status, StatusCode::OK);
        }
    };
    let main = write("<p>BP &lt;140 &amp; stable</p>", None).await;
    sign(main.clone()).await;
    sqlx::query(
        "UPDATE clinical_notes SET locked_at = now() - interval '1 minute' WHERE id = $1::uuid",
    )
    .bind(&main)
    .execute(&app.db)
    .await
    .expect("grace over");
    let addendum = write("CXR normal", Some(main.clone())).await;
    sign(addendum.clone()).await;
    let struck = write("Wrong patient", None).await;
    sign(struck.clone()).await;
    call(
        &app,
        &csrf,
        "POST",
        &format!("/api/clinical-notes/{struck}/entered-in-error"),
        json!({ "reason": "Wrong patient" }),
    )
    .await;
    let draft = write("Not yet signed", None).await;

    let (status, bundle) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/fhir/Composition?encounter={encounter}"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{bundle}");
    assert_eq!(bundle["resourceType"], "Bundle");
    let by_id = |id: &str| -> Value {
        bundle["entry"]
            .as_array()
            .expect("entries")
            .iter()
            .map(|e| e["resource"].clone())
            .find(|r| r["id"] == json!(id))
            .unwrap_or(Value::Null)
    };
    assert_eq!(bundle["total"], 3, "the draft is not the record: {bundle}");
    let first = by_id(&main);
    assert_eq!(first["resourceType"], "Composition");
    assert_eq!(first["status"], "final");
    assert_eq!(first["type"]["coding"][0]["code"], "34108-1", "{first}");
    assert_eq!(first["attester"][0]["mode"], "legal");
    assert_eq!(
        first["encounter"]["reference"],
        format!("Encounter/{encounter}")
    );
    let div = first["section"][0]["text"]["div"].as_str().expect("div");
    assert!(div.contains("BP &lt;140 &amp; stable"), "{div}");
    assert_eq!(
        by_id(&addendum)["relatesTo"][0],
        json!({ "code": "appends", "targetReference": { "reference": format!("Composition/{main}") } })
    );
    assert_eq!(by_id(&struck)["status"], "entered-in-error");

    let (status, one) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/fhir/Composition/{main}"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{one}");
    assert_eq!(one["id"], json!(main));
    let (status, _) = call(
        &app,
        &csrf,
        "GET",
        &format!("/api/fhir/Composition/{draft}"),
        Value::Null,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a draft does not exist to a reader"
    );
}

/// Given a hospital that requires registration first, When a note is
/// started on an OPD visit that holds no queue token, Then it is refused;
/// a registered visit takes notes as before.
#[tokio::test]
async fn an_unregistered_opd_visit_opens_no_case_sheet_under_the_lock() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let registered = encounter(&app, &csrf).await;
    let unregistered: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id) \
         SELECT e.tenant_id, e.patient_id, 'opd', 'open', e.department_id \
           FROM encounters e WHERE e.id = $1::uuid RETURNING id",
    )
    .bind(&registered)
    .fetch_one(&app.db)
    .await
    .expect("unregistered visit");
    let lock = |on: bool| {
        let db = app.db.clone();
        async move {
            sqlx::query(
                "INSERT INTO tenant_settings (tenant_id, category, key, value) \
                 SELECT tenant_id, 'mrd', 'require_opd_registration', to_jsonb($1) \
                   FROM users WHERE username = 'admin' \
                 ON CONFLICT (tenant_id, category, key) DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value",
            )
            .bind(on)
            .execute(&db)
            .await
            .expect("lock setting");
        }
    };
    let start = |visit: String| {
        let (app, csrf) = (&app, &csrf);
        async move {
            call(
                app,
                csrf,
                "POST",
                &format!("/api/encounters/{visit}/clinical-notes"),
                json!({ "note_type_code": "consultation" }),
            )
            .await
        }
    };
    lock(true).await;
    let refused = start(unregistered.to_string()).await;
    let allowed = start(registered).await;
    lock(false).await;
    assert_eq!(refused.0, StatusCode::CONFLICT, "{}", refused.1);
    assert_eq!(allowed.0, StatusCode::OK, "{}", allowed.1);
}

fn section<'a>(note: &'a Value, code: &str) -> &'a Value {
    note["sections"]
        .as_array()
        .and_then(|all| all.iter().find(|s| s["code"] == code))
        .expect("section")
}

/// Given AI-drafted text the doctor explicitly accepts into the plan (#4895),
/// Then that section is marked AI-assisted and the audit log names who
/// accepted it; an ordinary autosave marks nothing and writes no such row.
#[tokio::test]
async fn accepted_ai_text_is_marked_and_audited_with_who_accepted_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
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
    let draft = format!("/api/clinical-notes/{id}/draft");

    let (status, typed) = call(&app, &csrf, "PUT", &draft, soap("Fever two days", "Rest")).await;
    assert_eq!(status, StatusCode::OK, "{typed}");
    assert!(
        section(&typed, "plan").get("ai_assisted").is_none(),
        "typed text is not AI"
    );

    let accept = json!({ "sections": [
        { "code": "plan", "text": "Paracetamol 500 mg if fever", "ai_accepted": true },
    ]});
    let (status, accepted) = call(&app, &csrf, "PUT", &draft, accept).await;
    assert_eq!(status, StatusCode::OK, "{accepted}");
    assert_eq!(section(&accepted, "plan")["ai_assisted"], true);
    assert!(
        section(&accepted, "subjective")
            .get("ai_assisted")
            .is_none()
    );

    let note_id = Uuid::parse_str(&id).expect("uuid");
    let rows: Vec<(Option<Uuid>, Value)> = sqlx::query_as(
        "SELECT user_id, new_values FROM audit_log \
          WHERE entity_id = $1 AND action = 'ai_content_accepted'",
    )
    .bind(note_id)
    .fetch_all(&app.db)
    .await
    .expect("audit rows");
    assert_eq!(
        rows.len(),
        1,
        "one acceptance, one row; the plain autosave wrote none"
    );
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    assert_eq!(rows[0].0, Some(admin), "the row names who accepted it");
    assert_eq!(rows[0].1["sections"], json!(["plan"]));
    assert_eq!(rows[0].1["ai_generated"], true);
}
