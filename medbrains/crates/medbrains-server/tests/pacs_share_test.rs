//! A share link opens nothing until its named recipient enters the code sent
//! to them; a forwarded link is useless. A de-identified link shows no name,
//! ID or birth date, and never hands out a whole DICOM file.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const ORTHANC: &str = "http://127.0.0.1:8042";
const DOCTOR_PHONE: &str = "+91 98450 12210";

async fn send(req: reqwest::RequestBuilder, csrf: &str) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// A patient with a phone, and a filed study row for `uid`.
async fn study_row(app: &common::TestApp, uid: &str, phone: &str) -> Uuid {
    let tenant = admin_tenant(app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Ravi', 'Iyer', 'male', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-SH-{tag}"))
    .bind(phone)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    sqlx::query_scalar(
        "INSERT INTO radiology_dicom_studies (tenant_id, patient_id, study_instance_uid, modality) \
         VALUES ($1, $2, $3, 'CT') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(uid)
    .fetch_one(&app.db)
    .await
    .expect("study")
}

fn token_of(link: &Value) -> String {
    link["share_url"]
        .as_str()
        .and_then(|u| u.strip_prefix("/shared-images/"))
        .expect("share url")
        .to_owned()
}

/// The code the outbox was asked to send for this link.
async fn last_code(app: &common::TestApp, link_id: &str) -> String {
    let body: Value = sqlx::query_scalar(
        "SELECT payload FROM outbox_events WHERE aggregate_id = $1::uuid \
           AND event_type LIKE '%.radiology_share_code' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(link_id)
    .fetch_one(&app.db)
    .await
    .expect("code queued");
    let text = body["body"]
        .as_str()
        .or(body["text"].as_str())
        .unwrap_or_default();
    text.split(|c: char| !c.is_ascii_digit())
        .find(|w| w.len() == 6)
        .expect("six digits")
        .to_owned()
}

fn cookie_of(resp: &reqwest::Response) -> String {
    resp.headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|c| c.split(';').next())
        .expect("session cookie")
        .to_owned()
}

#[tokio::test]
async fn a_link_names_its_recipient_and_lasts_a_day_unless_told_otherwise() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let study = study_row(
        &app,
        &format!("1.2.826.0.1.{}", Uuid::new_v4().as_u128()),
        "9845012210",
    )
    .await;
    let share = |body: Value| {
        send(
            app.client
                .post(app.url("/api/radiology/share-links"))
                .json(&body),
            &csrf,
        )
    };

    let (status, _) = share(json!({ "study_id": study, "recipient_name": "Dr Rao" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "nowhere to send the code");
    let (status, _) =
        share(json!({ "study_id": study, "recipient_kind": "patient", "deidentify": true })).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "the patient's own images are not de-identified"
    );

    let (status, link) = share(
        json!({ "study_id": study, "recipient_name": "Dr Rao", "recipient_phone": DOCTOR_PHONE }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{link}");
    let expires: chrono::DateTime<chrono::Utc> = link["expires_at"]
        .as_str()
        .expect("expiry")
        .parse()
        .expect("date");
    let hours = (expires - chrono::Utc::now()).num_minutes() as f64 / 60.0;
    assert!((23.9..=24.0).contains(&hours), "default is a day: {hours}");

    // The patient's own: the code goes to the phone on their record.
    let (status, own) = share(json!({ "study_id": study, "recipient_kind": "patient" })).await;
    assert_eq!(status, StatusCode::OK, "{own}");
    let token = token_of(&own);
    let outsider = reqwest::Client::new();
    let landing: Value = outsider
        .get(app.url(&format!("/api/public/radiology/viewer/{token}")))
        .send()
        .await
        .expect("landing")
        .json()
        .await
        .expect("json");
    assert_eq!(landing["code_sent_to"], "98•••••210", "{landing}");
    assert!(
        !landing.to_string().contains("Iyer"),
        "no PHI before the code"
    );
    let (status, _) = send(
        outsider.post(app.url(&format!("/api/public/radiology/share/{token}/code"))),
        "",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let sent = app
        .outbox_rows("sms.radiology_share_code", "9845012210")
        .await;
    assert!(!sent.is_empty(), "sent to the patient's phone");

    // Five codes an hour, then no more.
    for _ in 0..4 {
        send(
            outsider.post(app.url(&format!("/api/public/radiology/share/{token}/code"))),
            "",
        )
        .await;
    }
    let (status, _) = send(
        outsider.post(app.url(&format!("/api/public/radiology/share/{token}/code"))),
        "",
    )
    .await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
}

#[tokio::test]
async fn a_forwarded_link_opens_nothing_and_a_guessed_code_burns_out() {
    let http = reqwest::Client::new();
    if http.get(format!("{ORTHANC}/system")).send().await.is_err() {
        return;
    }
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'radiology', 'pacs_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = $2, deleted_at = NULL",
    )
    .bind(admin_tenant(&app).await)
    .bind(json!({ "orthanc_url": ORTHANC, "orthanc_username": "", "viewer_type": "ohif" }))
    .execute(&app.db)
    .await
    .expect("config");
    let made: Value = http
        .post(format!("{ORTHANC}/tools/create-dicom"))
        .json(&json!({ "Tags": {
            "PatientID": "UH-SECRET-77", "PatientName": "Iyer^Ravi", "PatientBirthDate": "19800309",
            "PatientSex": "M", "InstitutionName": "City Hospital", "AccessionNumber": "RA99",
            "Modality": "CT", "SOPClassUID": "1.2.840.10008.5.1.4.1.1.2"
        }}))
        .send()
        .await
        .expect("create")
        .json()
        .await
        .expect("json");
    let orthanc_study = made["ParentStudy"].as_str().expect("study").to_owned();
    let study_tags: Value = http
        .get(format!("{ORTHANC}/studies/{orthanc_study}"))
        .send()
        .await
        .expect("study")
        .json()
        .await
        .expect("json");
    let uid = study_tags["MainDicomTags"]["StudyInstanceUID"]
        .as_str()
        .expect("uid")
        .to_owned();
    let study = study_row(&app, &uid, "9845012211").await;

    let (status, link) = send(
        app.client
            .post(app.url("/api/radiology/share-links"))
            .json(&json!({
                "study_id": study, "recipient_name": "Dr Rao", "recipient_phone": DOCTOR_PHONE,
                "deidentify": true,
            })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{link}");
    let token = token_of(&link);
    let link_id = link["id"].as_str().expect("id").to_owned();
    let base = format!("/api/public/radiology/share/{token}");
    let no_redirect = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("client");

    // Forwarded: the page sends you to the code screen, the data refuses.
    let page = no_redirect
        .get(app.url(&format!("{base}/ohif/viewer")))
        .send()
        .await
        .expect("page");
    assert_eq!(page.status(), StatusCode::SEE_OTHER);
    assert_eq!(
        page.headers()["location"],
        format!("/shared-images/{token}").as_str()
    );
    let metadata = app.url(&format!("{base}/dicom-web/studies/{uid}/metadata"));
    assert_eq!(
        no_redirect
            .get(&metadata)
            .send()
            .await
            .expect("meta")
            .status(),
        StatusCode::UNAUTHORIZED
    );

    // Five wrong guesses burn the code; the right one then fails too.
    let code_url = app.url(&format!("{base}/code"));
    let verify = app.url(&format!("{base}/verify"));
    send(no_redirect.post(&code_url), "").await;
    let code = last_code(&app, &link_id).await;
    let wrong = if code == "000000" { "111111" } else { "000000" };
    for _ in 0..5 {
        let (status, _) = send(
            no_redirect.post(&verify).json(&json!({ "code": wrong })),
            "",
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    let (status, _) = send(no_redirect.post(&verify).json(&json!({ "code": code })), "").await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a guessed-at code is spent"
    );

    // A fresh code, entered right, opens the study — de-identified.
    send(no_redirect.post(&code_url), "").await;
    let code = last_code(&app, &link_id).await;
    let verified = no_redirect
        .post(&verify)
        .json(&json!({ "code": code }))
        .send()
        .await
        .expect("verify");
    assert_eq!(verified.status(), StatusCode::OK);
    let cookie = cookie_of(&verified);
    let meta = no_redirect
        .get(&metadata)
        .header("cookie", &cookie)
        .send()
        .await
        .expect("meta");
    assert_eq!(meta.status(), StatusCode::OK);
    let text = meta.text().await.expect("json");
    for gone in ["Iyer", "UH-SECRET-77", "19800309", "City Hospital", "RA99"] {
        assert!(
            !text.contains(gone),
            "{gone} leaked through a de-identified link"
        );
    }
    assert!(text.contains("ANONYMOUS") && text.contains(&uid));
    let instances: Value = http
        .get(format!("{ORTHANC}/studies/{orthanc_study}/instances"))
        .send()
        .await
        .expect("instances")
        .json()
        .await
        .expect("json");
    let series = instances[0]["ParentSeries"].as_str().expect("series");
    let series_uid: Value = http
        .get(format!("{ORTHANC}/series/{series}"))
        .send()
        .await
        .expect("series")
        .json()
        .await
        .expect("json");
    let series_uid = series_uid["MainDicomTags"]["SeriesInstanceUID"]
        .as_str()
        .expect("uid");
    let whole_file = no_redirect
        .get(app.url(&format!(
            "{base}/dicom-web/studies/{uid}/series/{series_uid}"
        )))
        .header("cookie", &cookie)
        .header("accept", "multipart/related; type=\"application/dicom\"")
        .send()
        .await
        .expect("file");
    assert_eq!(
        whole_file.status(),
        StatusCode::FORBIDDEN,
        "a whole DICOM file carries every header"
    );
    let page = no_redirect
        .get(app.url(&format!("{base}/ohif/viewer")))
        .header("cookie", &cookie)
        .send()
        .await
        .expect("page");
    assert_eq!(page.status(), StatusCode::OK);

    // The session is this link's alone.
    let (_, other) = send(
        app.client.post(app.url("/api/radiology/share-links")).json(&json!({
            "study_id": study, "recipient_name": "Dr Iqbal", "recipient_email": "iqbal@example.org",
        })),
        &csrf,
    )
    .await;
    let other_meta = app.url(&format!(
        "/api/public/radiology/share/{}/dicom-web/studies/{uid}/metadata",
        token_of(&other)
    ));
    assert_eq!(
        no_redirect
            .get(&other_meta)
            .header("cookie", &cookie)
            .send()
            .await
            .expect("other")
            .status(),
        StatusCode::UNAUTHORIZED
    );
    let _ = http
        .delete(format!("{ORTHANC}/studies/{orthanc_study}"))
        .send()
        .await;
}
