//! Two patient-safety gates (RFCs/COMPLIANCE-GAP-2026-10.md #4 and #5).
//!
//! CSSD: an expired pack, a pack from a load whose indicator failed, and a pack
//! from an unreleased load never leave CSSD; a whole load can be recalled, after
//! which none of its packs can be issued and the ones already out are flagged
//! for retrieval.
//!
//! OT: surgery is consented by a signed consent linked to THIS booking — a
//! signed consent for another operation does not clear it — plus an
//! anaesthesia consent when an anaesthetist is on the case.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn admin_ids(app: &common::TestApp) -> (Uuid, Uuid) {
    sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin")
}

async fn patient(app: &common::TestApp, tenant: Uuid, tag: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Safety', 'Patient', 'female', '9000000002') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-SG-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// A load with one pack; `status`, indicator result and expiry offset vary.
async fn load_with_pack(
    app: &common::TestApp,
    tenant: Uuid,
    sterilizer: Uuid,
    name: &str,
    status: &str,
    indicator_pass: Option<bool>,
    expiry_days: i32,
) -> (Uuid, Uuid) {
    let load: Uuid = sqlx::query_scalar(
        "INSERT INTO cssd_sterilization_loads (tenant_id, load_number, sterilizer_id, method, status) \
         VALUES ($1, $2, $3, 'steam', $4::load_status) RETURNING id",
    )
    .bind(tenant)
    .bind(name)
    .bind(sterilizer)
    .bind(status)
    .fetch_one(&app.db)
    .await
    .expect("load");
    if let Some(pass) = indicator_pass {
        sqlx::query(
            "INSERT INTO cssd_indicator_results (tenant_id, load_id, indicator_type, result_pass) \
             VALUES ($1, $2, 'biological', $3)",
        )
        .bind(tenant)
        .bind(load)
        .bind(pass)
        .execute(&app.db)
        .await
        .expect("indicator");
    }
    let pack: Uuid = sqlx::query_scalar(
        "INSERT INTO cssd_load_items (tenant_id, load_id, quantity, pack_expiry_date) \
         VALUES ($1, $2, 2, CURRENT_DATE + $3) RETURNING id",
    )
    .bind(tenant)
    .bind(load)
    .bind(expiry_days)
    .fetch_one(&app.db)
    .await
    .expect("pack");
    (load, pack)
}

#[tokio::test]
async fn cssd_refuses_unsafe_packs_and_recalls_a_whole_load() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, _) = admin_ids(&app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let sterilizer: Uuid = sqlx::query_scalar(
        "INSERT INTO cssd_sterilizers (tenant_id, name) VALUES ($1, $2) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("AC-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("sterilizer");

    let issue = |pack: Option<Uuid>| {
        let mut body = json!({ "issued_to_department": "OT-1" });
        if let Some(p) = pack {
            body["load_item_id"] = json!(p);
        }
        app.client
            .post(app.url("/api/cssd/issuances"))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };

    let (_, expired) = load_with_pack(
        &app,
        tenant,
        sterilizer,
        &format!("E-{tag}"),
        "completed",
        Some(true),
        -1,
    )
    .await;
    let (_, failed_bi) = load_with_pack(
        &app,
        tenant,
        sterilizer,
        &format!("F-{tag}"),
        "completed",
        Some(false),
        30,
    )
    .await;
    let (_, running) = load_with_pack(
        &app,
        tenant,
        sterilizer,
        &format!("R-{tag}"),
        "running",
        None,
        30,
    )
    .await;
    let (good_load, good) = load_with_pack(
        &app,
        tenant,
        sterilizer,
        &format!("G-{tag}"),
        "completed",
        Some(true),
        30,
    )
    .await;

    let resp = issue(None).await.expect("issue");
    assert_eq!(
        resp.status(),
        StatusCode::BAD_REQUEST,
        "a pack without its load"
    );
    for (pack, words) in [
        (expired, "expired"),
        (failed_bi, "failed sterilisation indicator"),
        (running, "not finished its cycle"),
    ] {
        let resp = issue(Some(pack)).await.expect("issue");
        assert_eq!(resp.status(), StatusCode::CONFLICT, "{words}");
        let text = resp.text().await.expect("body");
        assert!(text.contains(words), "{words}: {text}");
    }
    let blocked: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE action = 'cssd.issue.blocked' AND entity_id = $1",
    )
    .bind(expired)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(blocked, 1, "the refusal is audited");

    let resp = issue(Some(good)).await.expect("issue");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "a released, in-date pack issues"
    );

    let resp = app
        .client
        .post(app.url(&format!("/api/cssd/loads/{good_load}/recall")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "biological indicator failed on re-read" }))
        .send()
        .await
        .expect("recall");
    assert_eq!(resp.status(), StatusCode::OK);
    let recall: Value = resp.json().await.expect("recall json");
    assert!(recall["load"]["recalled_at"].is_string());
    let out = recall["issuances"].as_array().expect("issuances");
    assert_eq!(out.len(), 1, "the issued pack is listed for retrieval");
    assert_eq!(out[0]["issued_to_department"], "OT-1");
    assert_eq!(out[0]["is_recalled"], true);

    let resp = issue(Some(good)).await.expect("issue");
    assert_eq!(
        resp.status(),
        StatusCode::CONFLICT,
        "nothing leaves a recalled load"
    );
    assert!(resp.text().await.expect("body").contains("recalled"));
}

#[tokio::test]
async fn ot_needs_a_consent_linked_to_the_booked_operation() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin) = admin_ids(&app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let patient_id = patient(&app, tenant, &tag).await;
    let other_patient = patient(&app, tenant, &format!("{tag}b")).await;
    let room: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, 'Safety OT', $2) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SG-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("room");
    let booking: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
             anesthetist_id, scheduled_date, scheduled_start, scheduled_end, procedure_name) \
         VALUES ($1, $2, $3, $4, $4, CURRENT_DATE, now(), now() + INTERVAL '2 hours', \
                 'Left total knee replacement') RETURNING id",
    )
    .bind(tenant)
    .bind(patient_id)
    .bind(room)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("booking");
    let consent = |pid: Uuid, name: &'static str, kind: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO procedure_consents (tenant_id, patient_id, procedure_name, \
                     consent_type, doctor_id, status, signed_at) \
                 VALUES ($1, $2, $3, $4, $5, 'signed', now()) RETURNING id",
            )
            .bind(tenant)
            .bind(pid)
            .bind(name)
            .bind(kind)
            .bind(admin)
            .fetch_one(&db)
            .await
            .expect("consent")
        }
    };
    let mark_consented = || {
        app.client
            .put(app.url(&format!("/api/ot/bookings/{booking}")))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "consent_obtained": true }))
            .send()
    };
    let link = |consent_id: Uuid| {
        app.client
            .post(app.url(&format!("/api/ot/bookings/{booking}/consents")))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "consent_id": consent_id }))
            .send()
    };

    // A signed consent for a different operation does not clear this one.
    consent(patient_id, "Right cataract extraction", "surgery").await;
    let resp = mark_consented().await.expect("update");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    assert!(
        resp.text()
            .await
            .expect("body")
            .contains("No signed surgical consent")
    );

    // Another patient's consent cannot be linked.
    let foreign = consent(other_patient, "Left total knee replacement", "surgery").await;
    let resp = link(foreign).await.expect("link");
    assert_eq!(resp.status(), StatusCode::CONFLICT);

    // The surgical consent for this operation, linked: anaesthesia still missing.
    let surgical = consent(patient_id, "Left total knee replacement", "surgery").await;
    let resp = link(surgical).await.expect("link");
    assert_eq!(resp.status(), StatusCode::OK);
    let status: Value = resp.json().await.expect("json");
    assert!(
        status["block_reason"]
            .as_str()
            .is_some_and(|r| r.contains("anaesthesia")),
        "{status}"
    );
    assert_eq!(
        mark_consented().await.expect("update").status(),
        StatusCode::BAD_REQUEST
    );

    let consented = || {
        sqlx::query_scalar::<_, bool>("SELECT consent_obtained FROM ot_bookings WHERE id = $1")
            .bind(booking)
            .fetch_one(&app.db)
    };
    assert!(
        !consented().await.expect("flag"),
        "half the consent is not consent"
    );

    let anaesthesia = consent(patient_id, "General anaesthesia", "anesthesia").await;
    assert_eq!(
        link(anaesthesia).await.expect("link").status(),
        StatusCode::OK
    );
    // Linking the last missing consent is what marks the booking consented;
    // nobody has to tick it by hand afterwards.
    assert!(
        consented().await.expect("flag"),
        "linking completed the consent"
    );
    let resp = mark_consented().await.expect("update");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "consent complete for this operation"
    );

    let linked: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE action = 'ot.consent.linked' AND entity_id = $1",
    )
    .bind(booking)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(linked, 2);
}

/// Unlinking needs a reason and stops once surgery has started; emergency
/// implied consent is for emergency bookings only, needs a fresh password, and
/// one doctor cannot certify twice — surgery stays blocked until a second does.
#[tokio::test]
async fn ot_unlink_and_two_doctor_emergency_consent() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin) = admin_ids(&app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let patient_id = patient(&app, tenant, &format!("{tag}e")).await;
    let room: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, 'Emergency OT', $2) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("EM-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("room");
    let book = |priority: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
                     scheduled_date, scheduled_start, scheduled_end, procedure_name, priority) \
                 VALUES ($1, $2, $3, $4, CURRENT_DATE, now(), now() + INTERVAL '2 hours', \
                         'Exploratory laparotomy', $5::ot_case_priority) RETURNING id",
            )
            .bind(tenant)
            .bind(patient_id)
            .bind(room)
            .bind(admin)
            .bind(priority)
            .fetch_one(&db)
            .await
            .expect("booking")
        }
    };
    let post = |path: String, body: Value| {
        app.client
            .post(app.url(&path))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };

    // Unlink: reason required; refused once the case is in progress.
    let elective = book("elective").await;
    let consent: Uuid = sqlx::query_scalar(
        "INSERT INTO procedure_consents (tenant_id, patient_id, procedure_name, consent_type, \
             doctor_id, status, signed_at, ot_booking_id) \
         VALUES ($1, $2, 'Exploratory laparotomy', 'surgery', $3, 'signed', now(), $4) RETURNING id",
    )
    .bind(tenant)
    .bind(patient_id)
    .bind(admin)
    .bind(elective)
    .fetch_one(&app.db)
    .await
    .expect("consent");
    let unlink = format!("/api/ot/bookings/{elective}/consents/{consent}/unlink");
    let resp = post(unlink.clone(), json!({ "reason": " " }))
        .await
        .expect("unlink");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    sqlx::query("UPDATE ot_bookings SET status = 'in_progress' WHERE id = $1")
        .bind(elective)
        .execute(&app.db)
        .await
        .expect("start");
    let resp = post(unlink.clone(), json!({ "reason": "wrong form" }))
        .await
        .expect("unlink");
    assert_eq!(
        resp.status(),
        StatusCode::CONFLICT,
        "not after surgery started"
    );
    sqlx::query("UPDATE ot_bookings SET status = 'confirmed' WHERE id = $1")
        .bind(elective)
        .execute(&app.db)
        .await
        .expect("reset");
    let resp = post(unlink, json!({ "reason": "wrong form" }))
        .await
        .expect("unlink");
    assert_eq!(resp.status(), StatusCode::OK);
    let status: Value = resp.json().await.expect("json");
    assert!(
        status["block_reason"].is_string(),
        "unlinked: consent missing again"
    );

    // Emergency implied consent.
    let resp = post(
        format!("/api/ot/bookings/{elective}/emergency-consent"),
        json!({ "reason": "x" }),
    )
    .await
    .expect("certify");
    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "step-up is required first"
    );

    let stepped = post(
        "/api/auth/step-up".to_owned(),
        json!({ "password": "admin123" }),
    )
    .await
    .expect("step-up");
    assert!(stepped.status().is_success());

    let resp = post(
        format!("/api/ot/bookings/{elective}/emergency-consent"),
        json!({ "reason": "unconscious, bleeding" }),
    )
    .await
    .expect("certify");
    assert_eq!(
        resp.status(),
        StatusCode::CONFLICT,
        "elective bookings do not qualify"
    );

    let emergency = book("emergency").await;
    let path = format!("/api/ot/bookings/{emergency}/emergency-consent");
    let resp = post(
        path.clone(),
        json!({ "reason": "ruptured spleen, no relative reachable" }),
    )
    .await
    .expect("certify");
    assert_eq!(resp.status(), StatusCode::OK);
    let status: Value = resp.json().await.expect("json");
    assert!(status["emergency"]["first_doctor_name"].is_string());
    assert!(
        status["block_reason"].is_string(),
        "one doctor is not enough"
    );

    let resp = post(path, json!({})).await.expect("certify again");
    assert_eq!(
        resp.status(),
        StatusCode::CONFLICT,
        "the same doctor cannot certify twice"
    );

    let first: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log \
         WHERE action = 'ot.consent.emergency_first' AND entity_id = $1",
    )
    .bind(emergency)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(first, 1);
}
