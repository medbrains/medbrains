//! AI notes from dictation, slice 1 (RFCs/modules/RFC-MODULE-ai-dictation.md).
//!
//! A fake whisper server and a fake local model stand in for the hospital's
//! machines; every scenario runs the real server end to end.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::Json;
use axum::routing::post;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

const TRANSCRIPT: &str = "Fever and sore throat for three days. Throat is congested. \
    Acute pharyngitis. Amoxicillin 500 milligrams three times a day for five days. \
    Review in five days.";

/// The draft the fake model returns through the extractor's `submit` tool.
fn model_draft(medicine: &str) -> Value {
    json!({
        "complaint": "Fever and sore throat for three days",
        "history": "",
        "examination": "Throat congested",
        "diagnoses": [{ "description": "Acute pharyngitis", "icd10_code": "J02.9" }],
        "plan": "Review in five days",
        "medicines": [{ "name": medicine, "dose": "500 mg", "frequency": "three times a day",
                        "duration": "5 days", "route": "oral" }],
    })
}

/// Serve `router` on a free local port; the address it answers on.
async fn serve(router: axum::Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move {
        let _ = axum::serve(listener, router).await;
    });
    format!("http://{addr}")
}

/// An address nothing listens on: a machine that is down.
async fn dead_address() -> String {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
    let addr = listener.local_addr().expect("addr");
    drop(listener);
    format!("http://{addr}")
}

/// A whisper.cpp server that hears `text`, counting calls.
async fn fake_whisper(text: &'static str, hits: Arc<AtomicUsize>) -> String {
    serve(axum::Router::new().route(
        "/inference",
        post(move || {
            let hits = Arc::clone(&hits);
            async move {
                hits.fetch_add(1, Ordering::SeqCst);
                Json(json!({ "text": text }))
            }
        }),
    ))
    .await
}

/// An OpenAI-compatible cloud transcription service, counting calls.
async fn fake_cloud(hits: Arc<AtomicUsize>) -> String {
    serve(axum::Router::new().route(
        "/v1/audio/transcriptions",
        post(move || {
            let hits = Arc::clone(&hits);
            async move {
                hits.fetch_add(1, Ordering::SeqCst);
                Json(json!({ "text": "cloud heard this" }))
            }
        }),
    ))
    .await
}

/// A local model (Ollama's OpenAI-compatible chat) that always submits `draft`.
async fn fake_model(draft: Value) -> String {
    serve(axum::Router::new().route(
        "/v1/chat/completions",
        post(move || {
            let draft = draft.clone();
            async move {
                Json(json!({
                    "id": "chatcmpl-1", "object": "chat.completion", "created": 0,
                    "model": "llama3.2", "system_fingerprint": "fp_ollama",
                    "choices": [{ "index": 0, "finish_reason": "tool_calls", "message": {
                        "role": "assistant", "content": "",
                        "tool_calls": [{ "id": "call_1", "index": 0, "type": "function",
                            "function": { "name": "submit", "arguments": draft.to_string() } }] } }],
                    "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 },
                }))
            }
        }),
    ))
    .await
}

async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// Point the hospital's dictation at these machines.
async fn configure(app: &common::TestApp, config: Value) {
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT tenant_id, 'dictation', 'config', $1 FROM users WHERE username = 'admin' \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
    )
    .bind(config)
    .execute(&app.db)
    .await
    .expect("dictation config");
}

/// A new patient and an OPD visit for them; (patient, encounter).
async fn visit(app: &common::TestApp, csrf: &str) -> (Uuid, String) {
    let tenant = admin_tenant(app).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Dictation', 'Patient', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-DIC-{tag}"))
    .bind(format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let resp = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_id": patient, "department_id": department }))
        .send()
        .await
        .expect("visit");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("visit json");
    let encounter = body["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned();
    (patient, encounter)
}

/// Upload a recording as `client`.
async fn dictate(
    app: &common::TestApp,
    client: &reqwest::Client,
    csrf: &str,
    encounter: &str,
) -> (StatusCode, Value) {
    let resp = client
        .post(app.url(&format!(
            "/api/opd/encounters/{encounter}/dictations?duration_ms=42000&source=uploaded"
        )))
        .header("x-csrf-token", csrf)
        .header("content-type", "audio/webm;codecs=opus")
        .body(vec![0x1a_u8, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])
        .send()
        .await
        .expect("dictate");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn send_json(
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("post");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Audit rows whose recorded values mention `needle`.
async fn audit_mentions(app: &common::TestApp, needle: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM audit_log \
          WHERE coalesce(old_values::text, '') || coalesce(new_values::text, '') LIKE '%' || $1 || '%'",
    )
    .bind(needle)
    .fetch_one(&app.db)
    .await
    .expect("audit search")
}

async fn audio_rows(app: &common::TestApp, session: &str) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM dictation_audio WHERE session_id = $1::uuid")
        .bind(session)
        .fetch_one(&app.db)
        .await
        .expect("audio rows")
}

/// The local machines answer: a model and a whisper server that heard `TRANSCRIPT`.
async fn local_machines(app: &common::TestApp, medicine: &str) -> Arc<AtomicUsize> {
    let hits = Arc::new(AtomicUsize::new(0));
    let stt = fake_whisper(TRANSCRIPT, Arc::clone(&hits)).await;
    let llm = fake_model(model_draft(medicine)).await;
    configure(app, json!({ "stt_url": stt, "llm_url": llm })).await;
    hits
}

/// Given the hospital's whisper server and model are up, When the doctor
/// dictates and accepts the plan as drafted, edits the assessment and rejects
/// the rest, Then only the accepted text reaches their note (AI-assisted), each
/// decision is logged with its edit size, the recording is deleted, the
/// transcript stays as provenance and the audit chain records the dictation.
#[tokio::test]
async fn dictation_drafts_the_note_and_saving_deletes_the_recording() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (_, encounter) = visit(&app, &csrf).await;

    let (status, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(status, StatusCode::OK, "{session}");
    assert_eq!(session["status"], "drafted", "{session}");
    assert_eq!(session["transcript"], TRANSCRIPT);
    assert_eq!(session["stt_adapter"], "local");
    let sections = session["draft"]["sections"].as_array().expect("sections");
    let codes: Vec<&str> = sections.iter().filter_map(|s| s["code"].as_str()).collect();
    assert_eq!(codes, ["subjective", "objective", "assessment", "plan"]);
    assert!(
        sections[2]["text"]
            .as_str()
            .unwrap_or_default()
            .contains("suggested ICD-10 J02.9, verify")
    );
    let id = session["id"].as_str().expect("id").to_owned();
    assert_eq!(
        audio_rows(&app, &id).await,
        1,
        "held until the note is saved"
    );

    // The doctor saves the accepted text through the normal draft path.
    let (status, note) = send_json(
        &app,
        &csrf,
        &format!("/api/encounters/{encounter}/clinical-notes"),
        json!({ "note_type_code": "consultation" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{note}");
    let note_id = note["id"].as_str().expect("note").to_owned();
    let resp = app
        .client
        .put(app.url(&format!("/api/clinical-notes/{note_id}/draft")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "sections": [
            { "code": "plan", "text": "<p>Review in five days</p>", "ai_accepted": true },
            { "code": "assessment", "text": "<p>Acute tonsillopharyngitis</p>", "ai_accepted": true },
        ]}))
        .send()
        .await
        .expect("save draft");
    assert_eq!(resp.status(), StatusCode::OK);

    let (status, summary) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/dictations/{id}/review"),
        json!({
            "note_id": note_id,
            "sections": [
                { "code": "plan", "decision": "accepted", "text": "Review in five days" },
                { "code": "assessment", "decision": "accepted", "text": "Acute tonsillopharyngitis" },
                { "code": "subjective", "decision": "rejected" },
                { "code": "objective", "decision": "rejected" },
            ],
            "medicines": [{ "index": 0, "decision": "rejected" }],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{summary}");
    assert_eq!(
        summary,
        json!({ "status": "saved", "accepted": 1, "edited": 1, "rejected": 3 })
    );

    assert_eq!(
        audio_rows(&app, &id).await,
        0,
        "the recording is deleted at save"
    );
    let (transcript, saved_note, saved): (Option<String>, Option<Uuid>, bool) = sqlx::query_as(
        "SELECT c.transcript, s.note_id, s.saved_at IS NOT NULL AND s.audio_deleted_at IS NOT NULL \
           FROM dictation_sessions s LEFT JOIN dictation_content c ON c.session_id = s.id \
          WHERE s.id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("session");
    assert_eq!(
        transcript.as_deref(),
        Some(TRANSCRIPT),
        "kept with the note"
    );
    assert_eq!(saved_note.map(|n| n.to_string()), Some(note_id.clone()));
    assert!(saved);

    let outcomes: Vec<(String, String, i32)> = sqlx::query_as(
        "SELECT item_key, outcome, edit_distance FROM ai_suggestion_outcomes \
          WHERE source_id = $1::uuid ORDER BY kind, item_key",
    )
    .bind(&id)
    .fetch_all(&app.db)
    .await
    .expect("outcomes");
    let assessment = outcomes
        .iter()
        .find(|o| o.0 == "assessment")
        .expect("assessment");
    assert_eq!(assessment.1, "edited");
    assert!(assessment.2 > 0, "the edit size is recorded");
    assert!(
        outcomes
            .iter()
            .any(|o| o.0 == "plan" && o.1 == "accepted" && o.2 == 0)
    );
    assert_eq!(outcomes.len(), 5, "four sections and one medicine");

    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'dictation_used' AND entity_id = $1::uuid",
    )
    .bind(&note_id)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1);
    assert_eq!(
        audit_mentions(&app, "Throat is congested").await,
        0,
        "the transcript never reaches the audit log"
    );
    assert_eq!(
        audit_mentions(&app, "Throat congested").await,
        0,
        "nor does a rejected draft section"
    );

    // A review is final: a second one is refused, not double-counted.
    let (status, _) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/dictations/{id}/review"),
        json!({ "note_id": note_id, "sections": [] }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
}

/// Given the whisper server is down, When the doctor dictates, Then the
/// session says speech-to-text is unavailable, offers no draft, keeps the
/// recording for a retry, and a retry once it is back drafts the note.
#[tokio::test]
async fn speech_to_text_down_says_so_and_retry_recovers() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let llm = fake_model(model_draft("Paracetamol")).await;
    configure(
        &app,
        json!({ "stt_url": dead_address().await, "llm_url": llm }),
    )
    .await;
    let (_, encounter) = visit(&app, &csrf).await;

    let (status, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(status, StatusCode::OK, "{session}");
    assert_eq!(session["status"], "stt_failed");
    assert_eq!(session["failure"], "stt_unreachable");
    assert!(session["draft"].is_null(), "never an empty draft");
    assert!(
        session["message"]
            .as_str()
            .unwrap_or_default()
            .contains("Type the note as usual")
    );
    let id = session["id"].as_str().expect("id").to_owned();
    assert_eq!(
        audio_rows(&app, &id).await,
        1,
        "kept so the doctor can retry"
    );

    local_machines(&app, "Paracetamol").await;
    let (status, retried) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/dictations/{id}/retry"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{retried}");
    assert_eq!(retried["status"], "drafted");
}

/// Given the model is down, When the doctor dictates, Then the transcript is
/// shown with a plain "could not be drafted" message and no draft.
#[tokio::test]
async fn model_down_keeps_the_transcript_and_offers_no_draft() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let stt = fake_whisper(TRANSCRIPT, Arc::new(AtomicUsize::new(0))).await;
    configure(
        &app,
        json!({ "stt_url": stt, "llm_url": dead_address().await }),
    )
    .await;
    let (_, encounter) = visit(&app, &csrf).await;

    let (status, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(status, StatusCode::OK, "{session}");
    assert_eq!(session["status"], "llm_failed");
    assert_eq!(session["transcript"], TRANSCRIPT);
    assert!(session["draft"].is_null());
    assert!(
        session["message"]
            .as_str()
            .unwrap_or_default()
            .contains("could not be drafted")
    );
}

/// Given the cloud service is configured but not enabled and the local server
/// is down, When the doctor dictates, Then the cloud is never called.
#[tokio::test]
async fn a_disabled_cloud_adapter_is_never_called() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cloud_hits = Arc::new(AtomicUsize::new(0));
    let cloud = fake_cloud(Arc::clone(&cloud_hits)).await;
    configure(
        &app,
        json!({ "stt_url": dead_address().await, "cloud_enabled": false, "cloud_url": cloud,
                "cloud_api_key_secret": "stt-key" }),
    )
    .await;
    let (_, encounter) = visit(&app, &csrf).await;

    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(session["status"], "stt_failed", "{session}");
    assert_eq!(session["stt_adapter"], "local");
    assert_eq!(
        cloud_hits.load(Ordering::SeqCst),
        0,
        "no recording left the hospital"
    );
}

/// Given the doctor rejects every section and medicine, When they finish,
/// Then nothing reaches a note, the session is closed as rejected, every
/// suggestion is logged rejected, and the recording and transcript are gone.
#[tokio::test]
async fn rejecting_everything_files_nothing_and_deletes_the_recording() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (_, encounter) = visit(&app, &csrf).await;
    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    let id = session["id"].as_str().expect("id").to_owned();

    // Keeping text without naming the note it went into is refused.
    let (status, _) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/dictations/{id}/review"),
        json!({ "note_id": null, "sections": [{ "code": "plan", "decision": "accepted", "text": "x" }] }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, summary) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/dictations/{id}/review"),
        json!({ "note_id": null, "sections": [], "medicines": [] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{summary}");
    assert_eq!(
        summary,
        json!({ "status": "rejected", "accepted": 0, "edited": 0, "rejected": 5 })
    );
    let notes: i64 =
        sqlx::query_scalar("SELECT count(*) FROM clinical_notes WHERE encounter_id = $1::uuid")
            .bind(&encounter)
            .fetch_one(&app.db)
            .await
            .expect("notes");
    assert_eq!(notes, 0, "nothing is filed automatically");
    assert_eq!(audio_rows(&app, &id).await, 0);
    let transcript: Option<String> =
        sqlx::query_scalar("SELECT transcript FROM dictation_content WHERE session_id = $1::uuid")
            .bind(&id)
            .fetch_optional(&app.db)
            .await
            .expect("content")
            .flatten();
    assert!(transcript.is_none(), "no note, so no provenance to keep");
    assert_eq!(audit_mentions(&app, "Throat is congested").await, 0);
}

/// Given a penicillin-allergic patient, When the dictation drafts amoxicillin
/// and the doctor accepts it, Then the draft is only a suggestion: prescribing
/// it still meets the allergy check, which refuses it without a reason.
#[tokio::test]
async fn a_dictated_medicine_still_meets_the_allergy_check() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Amoxicillin").await;
    let (patient, encounter) = visit(&app, &csrf).await;
    let (status, allergy) = send_json(
        &app,
        &csrf,
        &format!("/api/patients/{patient}/allergies"),
        json!({ "allergy_type": "drug", "allergen_name": "Penicillin" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{allergy}");

    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    let medicine = &session["draft"]["medicines"][0];
    assert_eq!(medicine["name"], "Amoxicillin", "{session}");
    let prescriptions: i64 =
        sqlx::query_scalar("SELECT count(*) FROM prescriptions WHERE encounter_id = $1::uuid")
            .bind(&encounter)
            .fetch_one(&app.db)
            .await
            .expect("prescriptions");
    assert_eq!(prescriptions, 0, "dictation never writes a prescription");

    let (status, _) = send_json(
        &app,
        &csrf,
        "/api/auth/step-up",
        json!({ "password": "admin123" }),
    )
    .await;
    assert!(status.is_success());
    let (status, refused) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/encounters/{encounter}/prescriptions"),
        json!({ "items": [{ "drug_name": medicine["name"], "dosage": medicine["dose"],
                            "frequency": "TDS", "duration": medicine["duration"], "route": "oral" }] }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    assert!(refused.to_string().contains("allergy"), "{refused}");
}

/// Given a doctor with no access to a patient, When they dictate on that
/// patient's visit, Then the answer is 404 (not an existence oracle) and no
/// session is made; a nurse without the permission gets 403.
#[tokio::test]
async fn dictation_needs_the_permission_and_access_to_the_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (patient, encounter) = visit(&app, &csrf).await;

    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let (status, _) = dictate(&app, &doctor.client, &doctor.csrf, &encounter).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let made: i64 =
        sqlx::query_scalar("SELECT count(*) FROM dictation_sessions WHERE patient_id = $1")
            .bind(patient)
            .fetch_one(&app.db)
            .await
            .expect("sessions");
    assert_eq!(made, 0);

    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let (status, _) = dictate(&app, &nurse.client, &nurse.csrf, &encounter).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

/// Given a recording left unsaved for over 24 hours, When the purge pass runs,
/// Then the recording and the unsaved transcript are deleted and the session
/// is marked abandoned.
#[tokio::test]
async fn an_abandoned_recording_is_deleted_after_24_hours() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (_, encounter) = visit(&app, &csrf).await;
    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    let id = session["id"].as_str().expect("id").to_owned();
    sqlx::query(
        "UPDATE dictation_sessions SET created_at = now() - interval '25 hours' WHERE id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await
    .expect("age it");

    let audited_before: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'dictation_recordings_purged'",
    )
    .fetch_one(&app.db)
    .await
    .expect("audit");
    let pass =
        medbrains_dictation::purge::purge_expired(&app.db, medbrains_dictation::purge::HOLD_HOURS)
            .await
            .expect("purge");
    assert!(pass.held >= 1 && pass.purged >= 1, "{pass:?}");
    assert_eq!(audio_rows(&app, &id).await, 0);
    let audited_after: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'dictation_recordings_purged'",
    )
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert!(
        audited_after > audited_before,
        "each tenant's purge is audited"
    );
    let (status, transcript): (String, Option<String>) = sqlx::query_as(
        "SELECT s.status, c.transcript FROM dictation_sessions s \
           LEFT JOIN dictation_content c ON c.session_id = s.id WHERE s.id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("session");
    assert_eq!(status, "abandoned");
    assert!(transcript.is_none());
}

/// Given an admin, When they turn the cloud service on over plain http, Then
/// it is refused; the local defaults are what a new hospital reads.
#[tokio::test]
async fn settings_refuse_an_unencrypted_cloud_and_default_to_local() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    sqlx::query(
        "UPDATE tenant_settings SET deleted_at = now() \
          WHERE category = 'dictation' AND key = 'config' AND deleted_at IS NULL",
    )
    .execute(&app.db)
    .await
    .expect("clear");
    let defaults: Value = app
        .client
        .get(app.url("/api/admin/dictation/settings"))
        .send()
        .await
        .expect("get")
        .json()
        .await
        .expect("json");
    assert_eq!(defaults["cloud_enabled"], false);
    assert_eq!(defaults["stt_url"], "http://127.0.0.1:8178");

    let mut cloud = defaults.clone();
    cloud["cloud_enabled"] = json!(true);
    cloud["cloud_url"] = json!("http://stt.example.com");
    cloud["cloud_api_key_secret"] = json!("stt-key");
    let resp = app
        .client
        .put(app.url("/api/admin/dictation/settings"))
        .header("x-csrf-token", &csrf)
        .json(&cloud)
        .send()
        .await
        .expect("put");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

/// PUT the dictation settings as the admin; the status.
async fn save_settings(app: &common::TestApp, csrf: &str, body: Value) -> StatusCode {
    app.client
        .put(app.url("/api/admin/dictation/settings"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("put")
        .status()
}

/// Given an admin with the general settings permission, When they write
/// `dictation/config` through the generic settings API, Then it is refused:
/// only the dictation endpoint (validated, guarded, audited) writes it.
#[tokio::test]
async fn the_generic_settings_route_cannot_write_dictation() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let resp = app
        .client
        .put(app.url("/api/setup/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "category": "dictation", "key": "config",
                       "value": { "stt_url": "http://evil.example" } }))
        .send()
        .await
        .expect("put");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

/// Given an admin, When the cloud key secret names a server secret, or a
/// local service points outside the hospital, Then the settings are refused;
/// and a value written past the endpoint is ignored for the local defaults.
#[tokio::test]
async fn settings_refuse_server_secrets_and_outside_addresses() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let base = json!({ "stt_url": "http://127.0.0.1:8178", "llm_url": "http://127.0.0.1:11434",
                       "llm_model": "llama3.2", "cloud_enabled": true,
                       "cloud_url": "https://stt.example.com", "cloud_model": null });
    for secret in ["JWT_PRIVATE_KEY_PEM", "DATABASE_URL", "tenants/x/../jwt"] {
        let mut body = base.clone();
        body["cloud_api_key_secret"] = json!(secret);
        assert_eq!(
            save_settings(&app, &csrf, body).await,
            StatusCode::BAD_REQUEST,
            "{secret}"
        );
    }
    for url in [
        "http://169.254.169.254",
        "http://stt.example.com",
        "http://8.8.8.8:8178",
    ] {
        let mut body = base.clone();
        body["cloud_enabled"] = json!(false);
        body["stt_url"] = json!(url);
        assert_eq!(
            save_settings(&app, &csrf, body).await,
            StatusCode::BAD_REQUEST,
            "{url}"
        );
    }

    // A bad value stored behind the endpoint's back reads as the defaults.
    configure(&app, json!({ "stt_url": "http://evil.example", "cloud_enabled": true,
                            "cloud_url": "http://evil.example", "cloud_api_key_secret": "JWT_PRIVATE_KEY_PEM" }))
        .await;
    let read: Value = app
        .client
        .get(app.url("/api/admin/dictation/settings"))
        .send()
        .await
        .expect("get")
        .json()
        .await
        .expect("json");
    assert_eq!(read["cloud_enabled"], false);
    assert_eq!(read["stt_url"], "http://127.0.0.1:8178");
}

/// Given a speech server that answers with a redirect, When the doctor
/// dictates, Then the redirect is not followed: the recording never reaches
/// the other host and the dictation fails plainly.
#[tokio::test]
async fn a_redirect_is_never_followed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let elsewhere_hits = Arc::new(AtomicUsize::new(0));
    let elsewhere = fake_whisper(TRANSCRIPT, Arc::clone(&elsewhere_hits)).await;
    let target = format!("{elsewhere}/inference");
    let redirecting = serve(axum::Router::new().route(
        "/inference",
        post(move || {
            let target = target.clone();
            async move {
                (
                    StatusCode::TEMPORARY_REDIRECT,
                    [(axum::http::header::LOCATION, target)],
                )
            }
        }),
    ))
    .await;
    configure(&app, json!({ "stt_url": redirecting })).await;
    let (_, encounter) = visit(&app, &csrf).await;
    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(session["status"], "stt_failed", "{session}");
    assert_eq!(session["failure"], "stt_refused");
    assert_eq!(elsewhere_hits.load(Ordering::SeqCst), 0);
}

/// Given a doctor whose last dictation is still processing, When they
/// dictate again, Then it is refused with 409 rather than run alongside.
#[tokio::test]
async fn one_dictation_at_a_time() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (patient, encounter) = visit(&app, &csrf).await;
    sqlx::query(
        "INSERT INTO dictation_sessions (tenant_id, encounter_id, patient_id, doctor_id, source, \
                audio_bytes, duration_ms, started_at, status) \
         SELECT tenant_id, $1::uuid, $2, id, 'recorded', 1, 0, now(), 'processing' \
           FROM users WHERE username = 'admin'",
    )
    .bind(&encounter)
    .bind(patient)
    .execute(&app.db)
    .await
    .expect("processing");
    let (status, body) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    sqlx::query("UPDATE dictation_sessions SET status = 'stt_failed' WHERE patient_id = $1")
        .bind(patient)
        .execute(&app.db)
        .await
        .expect("release");
}

/// Given a transcript far longer than any consultation, Then the session
/// fails as too long and the recording is deleted.
#[tokio::test]
async fn a_transcript_too_long_fails_and_deletes_the_recording() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let long: &'static str = Box::leak("word ".repeat(30_000).into_boxed_str());
    let stt = fake_whisper(long, Arc::new(AtomicUsize::new(0))).await;
    configure(
        &app,
        json!({ "stt_url": stt, "llm_url": dead_address().await }),
    )
    .await;
    let (_, encounter) = visit(&app, &csrf).await;
    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(session["failure"], "transcript_too_long", "{session}");
    let id = session["id"].as_str().expect("id").to_owned();
    assert_eq!(audio_rows(&app, &id).await, 0);
}

/// Given the hospital has turned AI off, When the doctor dictates, Then the
/// transcript is shown, nothing is drafted and the model is never asked.
#[tokio::test]
async fn ai_turned_off_transcribes_but_drafts_nothing() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT tenant_id, 'ai', 'config', '{\"assistant_enabled\": false}'::jsonb \
           FROM users WHERE username = 'admin' \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = tenant_settings.value || EXCLUDED.value, deleted_at = NULL",
    )
    .execute(&app.db)
    .await
    .expect("ai off");
    let (_, encounter) = visit(&app, &csrf).await;
    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    sqlx::query(
        "UPDATE tenant_settings SET value = value - 'assistant_enabled' \
          WHERE category = 'ai' AND key = 'config'",
    )
    .execute(&app.db)
    .await
    .expect("ai back on");
    assert_eq!(session["failure"], "ai_disabled", "{session}");
    assert_eq!(session["transcript"], TRANSCRIPT);
    assert!(session["draft"].is_null());
}

/// Given a visit that is closed, When the doctor dictates on it, Then it is
/// refused with 409 and no session is made.
#[tokio::test]
async fn a_closed_visit_takes_no_dictation() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (patient, encounter) = visit(&app, &csrf).await;
    sqlx::query("UPDATE encounters SET status = 'completed' WHERE id = $1::uuid")
        .bind(&encounter)
        .execute(&app.db)
        .await
        .expect("close");
    let (status, body) = dictate(&app, &app.client, &csrf, &encounter).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    let made: i64 =
        sqlx::query_scalar("SELECT count(*) FROM dictation_sessions WHERE patient_id = $1")
            .bind(patient)
            .fetch_one(&app.db)
            .await
            .expect("sessions");
    assert_eq!(made, 0);
}

/// Given a config bundle that carries `dictation/config` (or `abdm`), When an
/// admin imports it, dry run or not, Then the import is refused and nothing
/// is written; and an export never carries those categories.
#[tokio::test]
async fn a_config_import_cannot_write_dictation() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    for (category, dry_run) in [("dictation", false), ("dictation", true), ("abdm", false)] {
        let resp = app
            .client
            .post(app.url("/api/setup/config-import"))
            .header("x-csrf-token", &csrf)
            .json(&json!({
                "dry_run": dry_run,
                "bundle": {
                    "bundle_version": 1,
                    "exported_at": "2026-11-08T00:00:00Z",
                    "settings": [{ "category": category, "key": "config",
                                   "value": { "stt_url": "http://evil.example" } }],
                    "document_templates": [],
                },
            }))
            .send()
            .await
            .expect("import");
        assert_eq!(
            resp.status(),
            StatusCode::BAD_REQUEST,
            "{category} dry_run={dry_run}"
        );
    }
    let stored: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tenant_settings \
          WHERE category = 'dictation' AND value::text LIKE '%evil.example%' AND deleted_at IS NULL",
    )
    .fetch_one(&app.db)
    .await
    .expect("settings");
    assert_eq!(stored, 0);

    configure(&app, json!({ "stt_url": "http://127.0.0.1:8178" })).await;
    let bundle: Value = app
        .client
        .get(app.url("/api/setup/config-export"))
        .send()
        .await
        .expect("export")
        .json()
        .await
        .expect("json");
    let categories: Vec<&str> = bundle["settings"]
        .as_array()
        .expect("settings")
        .iter()
        .filter_map(|s| s["category"].as_str())
        .collect();
    assert!(!categories.contains(&"dictation") && !categories.contains(&"abdm"));
}

/// Given a logged AI suggestion outcome, When anyone changes what it records
/// or removes it physically, Then the database refuses; a soft delete, which
/// names who and why on the row, is the only change allowed.
#[tokio::test]
async fn an_ai_suggestion_outcome_cannot_be_changed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    local_machines(&app, "Paracetamol").await;
    let (_, encounter) = visit(&app, &csrf).await;
    let (_, session) = dictate(&app, &app.client, &csrf, &encounter).await;
    let id = session["id"].as_str().expect("id").to_owned();
    let (status, _) = send_json(
        &app,
        &csrf,
        &format!("/api/opd/dictations/{id}/review"),
        json!({ "note_id": null, "sections": [], "medicines": [] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let changed = sqlx::query(
        "UPDATE ai_suggestion_outcomes SET outcome = 'accepted', final_text = 'x' \
          WHERE source_id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await;
    assert!(changed.is_err(), "changing an outcome is refused");

    let mut tx = app.db.begin().await.expect("tx");
    sqlx::query("SELECT set_config('app.allow_physical_delete', 'true', true)")
        .execute(&mut *tx)
        .await
        .expect("allow");
    let removed = sqlx::query("DELETE FROM ai_suggestion_outcomes WHERE source_id = $1::uuid")
        .bind(&id)
        .execute(&mut *tx)
        .await;
    assert!(removed.is_err(), "a physical delete is refused");
    drop(tx);

    let soft = sqlx::query(
        "UPDATE ai_suggestion_outcomes SET deleted_at = now(), delete_reason = 'test' \
          WHERE source_id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await
    .expect("a soft delete is allowed");
    assert!(soft.rows_affected() > 0);
}
