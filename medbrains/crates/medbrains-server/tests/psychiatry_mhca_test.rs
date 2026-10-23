//! Mental Healthcare Act 2017 as the server enforces it: admissions checked
//! against their section, restraint against s.97, ECT against s.94/95, the
//! advance directive's "honour unless" route through the Board, PHQ-9 item 9
//! opening a suicide-risk review, and mental-health care contexts held back
//! from ABDM unless the hospital and the patient both allow it.

use crate::common;
use crate::psych_support::{doctor, enrol, on_care_team, patient_born, send, tenant};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    send(csrf, app.client.post(app.url(path)).json(&body)).await
}

fn hours_ago(h: i64) -> String {
    (chrono::Utc::now() - chrono::Duration::hours(h)).to_rfc3339()
}

/// Given a 40-year-old man with no nominated representative, When he is
/// admitted under s.89, Then it is refused naming the missing representative.
/// With a representative (written consent) and a psychiatrist plus a medical
/// practitioner examining within 7 days, Then it is admitted for 30 days and
/// the Board report falls due in 7. A second admission while it is open is a
/// conflict.
#[tokio::test]
async fn supported_admission_meets_section_89_or_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient_born(&app, tenant, "1986-01-01", "male").await;
    let psychiatrist = doctor(&app, &csrf).await;
    let gp = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let admit = format!("/api/specialty/psychiatry/patients/{record}/admissions");
    let body = json!({
        "category": "supported",
        "applicant": "nominated_representative",
        "criteria": ["self_harm"],
        "least_restrictive_certified": true,
        "needs_high_support": true,
        "examinations": [
            { "user_id": psychiatrist.id, "role": "psychiatrist", "examined_at": hours_ago(20) },
            { "user_id": gp.id, "role": "medical_practitioner", "examined_at": hours_ago(30) },
        ],
    });

    let (status, err) = post(&app, &csrf, &admit, body.clone()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert!(
        err.to_string().contains("nominated representative"),
        "{err}"
    );

    let reps = format!("/api/specialty/psychiatry/patients/{record}/nominated-representatives");
    let (status, err) = post(
        &app,
        &csrf,
        &reps,
        json!({
            "full_name": "Sita Rao", "relationship": "sister", "basis": "relative",
            "written_consent_received": false,
        }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "consent in writing is required: {err}"
    );
    let (status, rep) = post(
        &app,
        &csrf,
        &reps,
        json!({
            "full_name": "Sita Rao", "relationship": "sister", "basis": "relative",
            "written_consent_received": true,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rep}");

    let (status, adm) = post(&app, &csrf, &admit, body.clone()).await;
    assert_eq!(status, StatusCode::OK, "{adm}");
    let admitted =
        chrono::DateTime::parse_from_rfc3339(adm["admitted_at"].as_str().unwrap_or_default())
            .expect("admitted_at");
    let ends =
        chrono::DateTime::parse_from_rfc3339(adm["period_ends_at"].as_str().unwrap_or_default())
            .expect("period_ends_at");
    let due = chrono::DateTime::parse_from_rfc3339(
        adm["board_report_due_at"].as_str().unwrap_or_default(),
    )
    .expect("board due");
    assert_eq!((ends - admitted).num_days(), 30);
    assert_eq!((due - admitted).num_days(), 7, "a man: seven days");

    let (status, _) = post(&app, &csrf, &admit, body).await;
    assert_eq!(status, StatusCode::CONFLICT, "one open admission at a time");

    // Reporting it to the Board files the notice with the others.
    let id = adm["id"].as_str().expect("id");
    let (status, reported) = post(
        &app,
        &csrf,
        &format!("/api/specialty/psychiatry/admissions/{id}/board-report"),
        json!({ "reference_number": "MHRB/2026/17" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{reported}");
    let notices: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM psych_mhrb_notifications WHERE psych_patient_id = $1::uuid \
           AND reference_number = 'MHRB/2026/17'",
    )
    .bind(&record)
    .fetch_one(&app.db)
    .await
    .expect("notices");
    assert_eq!(notices, 1);
}

/// A minor cannot be an independent patient (s.86), and ECT during an s.94
/// emergency is refused.
#[tokio::test]
async fn minors_and_emergencies_are_held_to_their_sections() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let child = patient_born(&app, tenant, "2014-06-01", "female").await;
    let psychiatrist = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, child, psychiatrist.id).await;
    let admit = format!("/api/specialty/psychiatry/patients/{record}/admissions");
    let (status, err) = post(
        &app,
        &csrf,
        &admit,
        json!({
            "category": "independent", "applicant": "self",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert!(err.to_string().contains("s.87"), "{err}");

    let (status, adm) = post(&app, &csrf, &admit, json!({
        "category": "emergency", "applicant": "medical_practitioner", "criteria": ["harm_to_others"],
    })).await;
    assert_eq!(status, StatusCode::OK, "{adm}");
    let (status, err) = post(
        &app,
        &csrf,
        &format!("/api/specialty/psychiatry/patients/{record}/ect"),
        json!({ "session_number": 1, "laterality": "bilateral" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert!(err.to_string().contains("s.94"), "{err}");
}

/// s.97: seclusion is refused outright; restraint needs its method and the
/// last-resort attestation; the representative's notice is recorded once.
#[tokio::test]
async fn restraint_follows_section_97() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient_born(&app, tenant, "1979-03-03", "male").await;
    let psychiatrist = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let path = format!("/api/specialty/psychiatry/patients/{record}/restraints");
    let ok = json!({
        "restraint_type": "physical", "reason": "Assaulting staff", "method": "Four-point soft",
        "last_resort_confirmed": true, "review_due_hours": 2,
    });
    let mut seclusion = ok.clone();
    seclusion["restraint_type"] = json!("seclusion");
    let (status, err) = post(&app, &csrf, &path, seclusion).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(err.to_string().contains("s.97"), "{err}");
    let mut no_attest = ok.clone();
    no_attest["last_resort_confirmed"] = json!(false);
    assert_eq!(
        post(&app, &csrf, &path, no_attest).await.0,
        StatusCode::BAD_REQUEST
    );

    let (status, row) = post(&app, &csrf, &path, ok).await;
    assert_eq!(status, StatusCode::OK, "{row}");
    let informed = format!(
        "/api/specialty/psychiatry/restraints/{}/nominated-rep-informed",
        row["id"].as_str().expect("id")
    );
    assert_eq!(
        post(&app, &csrf, &informed, json!({})).await.0,
        StatusCode::OK
    );
    assert_eq!(
        post(&app, &csrf, &informed, json!({})).await.0,
        StatusCode::CONFLICT
    );

    let month = chrono::Utc::now().format("%Y-%m-01").to_string();
    let resp = app
        .client
        .get(app.url(&format!(
            "/api/specialty/psychiatry/restraint-report?month={month}"
        )))
        .send()
        .await
        .expect("report");
    assert_eq!(resp.status(), StatusCode::OK);
    let rows: Vec<Value> = resp.json().await.expect("rows");
    assert!(
        rows.iter().any(|r| r["id"] == row["id"]),
        "in the monthly report"
    );
}

/// The directive stands while an application to the Board is pending, and
/// stops governing only when the Board cancels it.
#[tokio::test]
async fn an_advance_directive_is_honoured_unless_the_board_decides_otherwise() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient_born(&app, tenant, "1990-09-09", "female").await;
    let psychiatrist = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let (status, ad) = post(
        &app,
        &csrf,
        &format!("/api/specialty/psychiatry/patients/{record}/advance-directives"),
        json!({ "made_by": "patient", "treatment_refusals": "No ECT" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{ad}");
    let ad_id = ad["id"].as_str().expect("id");
    let (status, ch) = post(
        &app,
        &csrf,
        &format!("/api/specialty/psychiatry/advance-directives/{ad_id}/challenges"),
        json!({ "applicant_role": "mental_health_professional", "grounds": ["lacked_capacity"],
                "details": "Made during an acute manic episode" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{ch}");
    let still: String =
        sqlx::query_scalar("SELECT status FROM psych_advance_directives WHERE id = $1::uuid")
            .bind(ad_id)
            .fetch_one(&app.db)
            .await
            .expect("status");
    assert_eq!(still, "active", "pending does not suspend the directive");

    let (status, _) = post(
        &app,
        &csrf,
        &format!(
            "/api/specialty/psychiatry/directive-challenges/{}/decision",
            ch["id"].as_str().expect("id")
        ),
        json!({ "status": "cancelled", "board_reference": "MHRB/AD/3" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let now: String =
        sqlx::query_scalar("SELECT status FROM psych_advance_directives WHERE id = $1::uuid")
            .bind(ad_id)
            .fetch_one(&app.db)
            .await
            .expect("status");
    assert_eq!(now, "cancelled_by_board");
}

/// PHQ-9 is scored on the server; a positive item 9 is pending review, tells
/// the treating psychiatrist, heads the worklist, and clears when reviewed.
#[tokio::test]
async fn a_positive_phq9_item_9_opens_a_safety_review() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient_born(&app, tenant, "1995-05-05", "male").await;
    let psychiatrist = doctor(&app, &csrf).await;
    on_care_team(&app, tenant, patient, psychiatrist.id).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let path = format!("/api/specialty/psychiatry/patients/{record}/screenings");
    assert_eq!(
        post(
            &app,
            &csrf,
            &path,
            json!({ "instrument": "phq9", "answers": [0, 1] })
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let (status, s) = post(
        &app,
        &csrf,
        &path,
        json!({ "instrument": "phq9", "answers": [2, 2, 1, 2, 1, 1, 1, 0, 1] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{s}");
    assert_eq!(s["total"], 11);
    assert_eq!(s["severity"], "moderate");
    assert_eq!(s["item9_positive"], true);
    assert_eq!(s["safety_review_status"], "pending");

    let told: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND kind = 'psych_safety'",
    )
    .bind(psychiatrist.id)
    .fetch_one(&app.db)
    .await
    .expect("notifications");
    assert_eq!(told, 1, "the treating psychiatrist is told at once");

    let pending: Vec<Value> = psychiatrist
        .client
        .get(app.url("/api/specialty/psychiatry/safety-reviews/pending"))
        .send()
        .await
        .expect("pending")
        .json()
        .await
        .expect("json");
    assert!(
        pending.iter().any(|p| p["screening_id"] == s["id"]),
        "on the worklist"
    );

    let review = format!(
        "/api/specialty/psychiatry/screenings/{}/safety-review",
        s["id"].as_str().expect("id")
    );
    let (status, done) = send(&psychiatrist.csrf, psychiatrist.client.post(app.url(&review))
        .json(&json!({ "outcome": "moderate", "note": "Passive ideation, no plan. Safety plan agreed." }))).await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["safety_review_status"], "completed");

    let (status, gad) = post(
        &app,
        &csrf,
        &path,
        json!({ "instrument": "gad7", "answers": [3, 3, 3, 3, 3, 0, 0] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(gad["severity"], "severe");
    assert_eq!(gad["safety_review_status"], "not_required");
}

/// A visit with a mental-health diagnosis is not shareable through ABDM by
/// default; turning the hospital setting on is not enough; the patient's
/// consent to the category is also needed. Other visits are unaffected.
#[tokio::test]
async fn mental_health_care_contexts_stay_out_of_abdm_by_default() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient_born(&app, tenant, "1984-02-02", "female").await;
    let psychiatrist = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let visit = |code: &'static str| {
        let db = app.db.clone();
        async move {
            let e: Uuid = sqlx::query_scalar(
                "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id")
                .bind(tenant).bind(patient).fetch_one(&db).await.expect("encounter");
            sqlx::query("INSERT INTO diagnoses (tenant_id, encounter_id, icd_system, icd_code, description) \
                         VALUES ($1, $2, 'icd10', $3, 'dx')")
                .bind(tenant).bind(e).bind(code).execute(&db).await.expect("diagnosis");
            e
        }
    };
    let psych_visit = visit("F33.1").await;
    let flu_visit = visit("J11.1").await;
    let shareable = |e: Uuid| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, bool>("SELECT public.abdm_mental_health_shareable($1, $2, $3)")
                .bind(tenant)
                .bind(patient)
                .bind(e)
                .fetch_one(&db)
                .await
                .expect("shareable")
        }
    };
    assert!(shareable(flu_visit).await, "ordinary care is unaffected");
    assert!(!shareable(psych_visit).await, "excluded by default");

    let (status, _) = send(
        &csrf,
        app.client
            .put(app.url("/api/abdm/settings/mental-health-sharing"))
            .json(&json!({ "enabled": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        !shareable(psych_visit).await,
        "the hospital alone cannot consent for the patient"
    );

    let (status, row) = send(
        &csrf,
        app.client
            .put(app.url(&format!(
                "/api/specialty/psychiatry/patients/{record}/abdm-consent"
            )))
            .json(&json!({ "consented": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{row}");
    assert!(
        shareable(psych_visit).await,
        "hospital setting + patient consent"
    );

    let _ = send(
        &csrf,
        app.client
            .put(app.url("/api/abdm/settings/mental-health-sharing"))
            .json(&json!({ "enabled": false })),
    )
    .await;
    assert!(!shareable(psych_visit).await);
}
