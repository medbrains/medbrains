//! Psychiatric records under Mental Healthcare Act 2017 s.23.
//!
//! A restricted psychiatric record is open to its treating psychiatrist,
//! to holders of `specialty.psychiatry.restricted.view`, and to a
//! break-glass session that names psychiatry — and to nobody else, however
//! close to the patient's general care they are. The same rule tombstones
//! mental-health diagnoses on the generic patient screens.

use crate::common;
use crate::psych_support::{Doctor, doctor, enrol, on_care_team, patient, send, tenant};

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn listed(app: &common::TestApp, who: &Client, record: &str) -> bool {
    let resp = who
        .get(app.url("/api/specialty/psychiatry/patients"))
        .send()
        .await
        .expect("list");
    assert_eq!(resp.status(), StatusCode::OK);
    let rows: Vec<Value> = resp.json().await.expect("rows");
    rows.iter().any(|r| r["id"] == record)
}

async fn status_of(app: &common::TestApp, who: &Client, path: &str) -> StatusCode {
    who.get(app.url(path)).send().await.expect("get").status()
}

/// Given a restricted record whose treating psychiatrist is S, When D — on
/// the patient's care team but not S — lists or opens it, Then it is absent
/// and answers 404 (enrolment itself is the confidential fact). S sees it.
/// When the record is unrestricted, D sees it too.
#[tokio::test]
async fn a_restricted_record_reaches_only_its_treating_psychiatrist() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let psychiatrist = doctor(&app, &csrf).await;
    let other = doctor(&app, &csrf).await;
    on_care_team(&app, tenant, patient, psychiatrist.id).await;
    on_care_team(&app, tenant, patient, other.id).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let one = format!("/api/specialty/psychiatry/patients/{record}");
    let child = format!("{one}/assessments");

    assert!(
        !listed(&app, &other.client, &record).await,
        "not in D's list"
    );
    assert_eq!(
        status_of(&app, &other.client, &one).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        status_of(&app, &other.client, &child).await,
        StatusCode::NOT_FOUND
    );

    assert!(
        listed(&app, &psychiatrist.client, &record).await,
        "in S's list"
    );
    assert_eq!(
        status_of(&app, &psychiatrist.client, &one).await,
        StatusCode::OK
    );
    assert_eq!(
        status_of(&app, &psychiatrist.client, &child).await,
        StatusCode::OK
    );

    let (status, body) = send(
        &psychiatrist.csrf,
        psychiatrist
            .client
            .put(app.url(&one))
            .json(&json!({ "is_restricted": false })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(
        listed(&app, &other.client, &record).await,
        "unrestricted: the care team sees it"
    );
    assert_eq!(status_of(&app, &other.client, &one).await, StatusCode::OK);
}

/// Unrestricted is not public: without a care relationship to the patient
/// the record is still not found.
#[tokio::test]
async fn an_unrestricted_record_still_needs_the_care_team() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let psychiatrist = doctor(&app, &csrf).await;
    let stranger = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let one = format!("/api/specialty/psychiatry/patients/{record}");
    let (status, _) = send(
        &csrf,
        app.client
            .put(app.url(&one))
            .json(&json!({ "is_restricted": false })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    assert!(!listed(&app, &stranger.client, &record).await);
    assert_eq!(
        status_of(&app, &stranger.client, &one).await,
        StatusCode::NOT_FOUND
    );
}

async fn break_glass(app: &common::TestApp, who: &Doctor, patient: Uuid, modules: &[&str]) {
    let (status, _) = send(
        &who.csrf,
        who.client
            .post(app.url("/api/auth/step-up"))
            .json(&json!({ "password": who.password })),
    )
    .await;
    assert!(status.is_success(), "step-up: {status}");
    let (status, body) = send(
        &who.csrf,
        who.client.post(app.url("/api/break-glass")).json(&json!({
            "patient_id": patient,
            "reason": "Agitated in ER, need psychiatric history",
            "expires_in_minutes": 30,
            "requested_modules": modules,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// A general break-glass into the chart does not open the psychiatric
/// record; one that names psychiatry does, and the read is logged as a
/// break-glass read so it lands in the review rollup.
#[tokio::test]
async fn break_glass_must_name_psychiatry_and_is_audited() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let psychiatrist = doctor(&app, &csrf).await;
    let er = doctor(&app, &csrf).await;
    let record = enrol(&app, &csrf, patient, psychiatrist.id).await;
    let one = format!("/api/specialty/psychiatry/patients/{record}");

    break_glass(&app, &er, patient, &[]).await;
    assert_eq!(
        status_of(&app, &er.client, &one).await,
        StatusCode::NOT_FOUND,
        "chart break-glass is not psychiatric break-glass"
    );

    break_glass(&app, &er, patient, &["psychiatry"]).await;
    assert_eq!(status_of(&app, &er.client, &one).await, StatusCode::OK);
    assert!(listed(&app, &er.client, &record).await);

    let logged: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM access_log WHERE user_id = $1 AND patient_id = $2 \
           AND module = 'psychiatry' AND action = 'break_glass_view'",
    )
    .bind(er.id)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("access log");
    assert!(logged >= 1, "the break-glass read is on the record");
}

async fn diagnosis(
    app: &common::TestApp,
    tenant: Uuid,
    encounter: Uuid,
    by: Uuid,
    code: &str,
    text: &str,
) {
    sqlx::query(
        "INSERT INTO diagnoses (tenant_id, encounter_id, icd_system, icd_code, description, \
                                recorded_by) \
         VALUES ($1, $2, 'icd10', $3, $4, $5)",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(code)
    .bind(text)
    .bind(by)
    .execute(&app.db)
    .await
    .expect("diagnosis");
}

/// Given a schizophrenia diagnosis on a restricted psychiatric patient, When
/// a care-team doctor outside psychiatry opens the timeline or the diagnosis
/// list, Then the entry is a tombstone — present, content withheld — while
/// the diabetes beside it shows. The treating psychiatrist sees both.
#[tokio::test]
async fn mental_health_diagnoses_are_tombstoned_on_generic_screens() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let psychiatrist = doctor(&app, &csrf).await;
    let physician = doctor(&app, &csrf).await;
    on_care_team(&app, tenant, patient, psychiatrist.id).await;
    on_care_team(&app, tenant, patient, physician.id).await;
    enrol(&app, &csrf, patient, psychiatrist.id).await;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    diagnosis(
        &app,
        tenant,
        encounter,
        psychiatrist.id,
        "F20.0",
        "Paranoid schizophrenia",
    )
    .await;
    diagnosis(
        &app,
        tenant,
        encounter,
        physician.id,
        "E11.9",
        "Type 2 diabetes",
    )
    .await;

    for path in [
        format!("/api/patients/{patient}/clinical-timeline"),
        format!("/api/opd/patients/{patient}/diagnoses"),
    ] {
        let resp = physician
            .client
            .get(app.url(&path))
            .send()
            .await
            .expect("get");
        assert_eq!(resp.status(), StatusCode::OK, "{path}");
        let text = resp.text().await.expect("body");
        assert!(!text.contains("schizophrenia"), "{path} leaked: {text}");
        assert!(!text.contains("F20"), "{path} leaked the code");
        assert!(
            text.contains("Restricted entry"),
            "{path} must tombstone, not drop"
        );
        assert!(
            text.contains("Type 2 diabetes"),
            "{path} hid routine content"
        );

        let text = psychiatrist
            .client
            .get(app.url(&path))
            .send()
            .await
            .expect("get")
            .text()
            .await
            .expect("body");
        assert!(
            text.contains("Paranoid schizophrenia"),
            "{path}: the treating team sees it"
        );
    }
}
