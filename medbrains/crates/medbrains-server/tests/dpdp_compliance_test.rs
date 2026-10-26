//! The DPDP / CERT-In compliance pack: the privacy officers and their
//! publication, the policy pack under maker-checker, breach drills, and the
//! gaps the dashboard shows — with the permissions each step needs.

use crate::common::{self, Staff, TestApp};

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// The tests share the hospital's officers and policies; one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn send(
    s: &Staff,
    app: &TestApp,
    (method, path): (Method, &str),
    body: &Value,
) -> (StatusCode, Value) {
    let res = s
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", &s.csrf)
        .json(body)
        .send()
        .await
        .expect("request");
    let status = res.status();
    (status, res.json().await.unwrap_or(Value::Null))
}

fn admin(app: &TestApp, csrf: &str) -> Staff {
    Staff {
        client: app.client.clone(),
        csrf: csrf.to_owned(),
        user_id: Uuid::nil(),
    }
}

async fn gap_codes(s: &Staff, app: &TestApp) -> Vec<String> {
    let (status, d) = send(
        s,
        app,
        (Method::GET, "/api/regulatory/dpdp/dashboard"),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{d}");
    d["gaps"]
        .as_array()
        .expect("gaps")
        .iter()
        .map(|g| g["code"].as_str().unwrap_or_default().to_owned())
        .collect()
}

/// Start each test from a hospital with no pack, so the gaps are its own.
async fn clear(app: &TestApp) {
    for t in [
        "privacy_officers",
        "compliance_policies",
        "compliance_drills",
    ] {
        sqlx::query(&format!(
            "UPDATE {t} SET deleted_at = now(), delete_reason = 'test reset' \
              WHERE deleted_at IS NULL AND tenant_id = (SELECT tenant_id FROM users WHERE username = 'admin')"
        ))
        .execute(&app.db)
        .await
        .expect("reset");
    }
}

fn officer(name: &str) -> Value {
    json!({ "name": name, "designation": "Grievance Officer", "email": "privacy@hospital.example",
            "phone": "+91 44 4000 1234", "hours": "Mon-Sat 9:00-17:00" })
}

#[tokio::test]
async fn officers_are_named_then_published_and_only_the_right_roles_may() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    clear(&app).await;
    let quality = common::provision_staff(&app, &csrf, "quality_officer", &[]).await;
    let auditor = common::provision_staff(&app, &csrf, "audit_officer", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;

    let codes = gap_codes(&quality, &app).await;
    assert!(
        codes.contains(&"contact_not_set".to_owned())
            && codes.contains(&"certin_poc_not_set".to_owned()),
        "{codes:?}"
    );

    let path = "/api/regulatory/dpdp/officers/grievance_officer";
    let (status, _) = send(
        &quality,
        &app,
        (Method::PUT, path),
        &json!({ "name": "A", "designation": "x", "email": "nope", "phone": "1" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, rows) = send(&quality, &app, (Method::PUT, path), &officer("Priya Raman")).await;
    assert_eq!(status, StatusCode::OK, "{rows}");
    assert!(rows[0]["published_at"].is_null(), "set is not published");
    assert!(
        gap_codes(&quality, &app)
            .await
            .contains(&"contact_not_published".to_owned())
    );

    let (status, _) = send(
        &quality,
        &app,
        (Method::PUT, &format!("{path}/publish")),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (_, notice) = send(
        &quality,
        &app,
        (Method::GET, "/api/regulatory/dpdp/public-notice"),
        &Value::Null,
    )
    .await;
    assert_eq!(notice["grievance_officer"]["name"], "Priya Raman");
    let codes = gap_codes(&quality, &app).await;
    assert!(
        !codes.iter().any(|c| c.starts_with("contact_")),
        "{codes:?}"
    );

    // A change unpublishes until someone confirms it again.
    let (_, rows) = send(&quality, &app, (Method::PUT, path), &officer("Priya R.")).await;
    assert!(rows[0]["published_at"].is_null());
    let (_, notice) = send(
        &quality,
        &app,
        (Method::GET, "/api/regulatory/dpdp/public-notice"),
        &Value::Null,
    )
    .await;
    assert!(
        notice["grievance_officer"].is_null(),
        "an unconfirmed contact is not shown to patients"
    );

    let (status, _) = send(
        &auditor,
        &app,
        (Method::GET, "/api/regulatory/dpdp/officers"),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "the audit officer reads");
    let (status, _) = send(&auditor, &app, (Method::PUT, path), &officer("X Y")).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "but does not change");
    let (status, _) = send(
        &desk,
        &app,
        (Method::GET, "/api/regulatory/dpdp/dashboard"),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn a_policy_is_drafted_from_its_template_and_published_only_by_someone_else() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    clear(&app).await;
    let quality = common::provision_staff(&app, &csrf, "quality_officer", &[]).await;
    let boss = admin(&app, &csrf);
    send(
        &quality,
        &app,
        (
            Method::PUT,
            "/api/regulatory/dpdp/officers/grievance_officer",
        ),
        &officer("Priya Raman"),
    )
    .await;

    let start = json!({ "kind": "privacy_notice", "language": "en" });
    let (status, draft) = send(
        &quality,
        &app,
        (Method::POST, "/api/regulatory/dpdp/policies"),
        &start,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{draft}");
    let body = draft["body"].as_str().expect("body");
    assert!(
        body.contains("review with counsel") && body.contains("Priya Raman"),
        "{body}"
    );
    assert_eq!(
        (draft["version"].as_i64(), draft["status"].as_str()),
        (Some(1), Some("draft"))
    );
    let (status, _) = send(
        &quality,
        &app,
        (Method::POST, "/api/regulatory/dpdp/policies"),
        &start,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "one open draft at a time");

    let id = draft["id"].as_str().expect("id").to_owned();
    let (status, _) = send(
        &quality,
        &app,
        (
            Method::PUT,
            &format!("/api/regulatory/dpdp/policies/{id}/submit"),
        ),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let approve = format!("/api/regulatory/dpdp/policies/{id}/approve");
    let (status, _) = send(&quality, &app, (Method::PUT, &approve), &Value::Null).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "quality drafts; an administrator approves"
    );
    let (status, why) = send(&boss, &app, (Method::PUT, &approve), &Value::Null).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the template's review note is still in: {why}"
    );
    let (status, _) = send(
        &boss,
        &app,
        (
            Method::PUT,
            &format!("/api/regulatory/dpdp/policies/{id}/return"),
        ),
        &json!({ "reason": "Counsel reviewed: remove the note and name the DPO" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let reviewed = "# Demo Hospital — Privacy notice\n\nReviewed by counsel on 20 October 2026. \
        Grievance officer: Priya Raman, privacy@hospital.example.";
    let (status, _) = send(
        &quality,
        &app,
        (Method::PUT, &format!("/api/regulatory/dpdp/policies/{id}")),
        &json!({ "title": "Privacy notice to patients", "body": reviewed }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    send(
        &quality,
        &app,
        (
            Method::PUT,
            &format!("/api/regulatory/dpdp/policies/{id}/submit"),
        ),
        &Value::Null,
    )
    .await;
    let (status, published) = send(&boss, &app, (Method::PUT, &approve), &Value::Null).await;
    assert_eq!(status, StatusCode::OK, "{published}");
    assert_eq!(published["status"], "published");
    assert!(
        !gap_codes(&quality, &app)
            .await
            .contains(&"notice_not_published".to_owned())
    );

    // The next version starts from the published text; publishing it retires v1.
    let (_, v2) = send(
        &boss,
        &app,
        (Method::POST, "/api/regulatory/dpdp/policies"),
        &start,
    )
    .await;
    assert_eq!(
        (v2["version"].as_i64(), v2["body"].as_str()),
        (Some(2), published["body"].as_str())
    );
    let v2id = v2["id"].as_str().expect("id").to_owned();
    send(
        &boss,
        &app,
        (
            Method::PUT,
            &format!("/api/regulatory/dpdp/policies/{v2id}/submit"),
        ),
        &Value::Null,
    )
    .await;
    let (status, _) = send(
        &boss,
        &app,
        (
            Method::PUT,
            &format!("/api/regulatory/dpdp/policies/{v2id}/approve"),
        ),
        &Value::Null,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "even an administrator never approves their own draft"
    );

    // Returned with a reason, edited, back to draft.
    let (_, ret) = send(
        &quality,
        &app,
        (Method::POST, "/api/regulatory/dpdp/policies"),
        &json!({ "kind": "retention_schedule", "language": "en" }),
    )
    .await;
    let rid = ret["id"].as_str().expect("id").to_owned();
    send(
        &quality,
        &app,
        (
            Method::PUT,
            &format!("/api/regulatory/dpdp/policies/{rid}/submit"),
        ),
        &Value::Null,
    )
    .await;
    let back = format!("/api/regulatory/dpdp/policies/{rid}/return");
    let (status, _) = send(&boss, &app, (Method::PUT, &back), &json!({ "reason": "" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, returned) = send(
        &boss,
        &app,
        (Method::PUT, &back),
        &json!({ "reason": "Add the state rule for MLC records" }),
    )
    .await;
    assert_eq!(
        (status, returned["status"].as_str()),
        (StatusCode::OK, Some("returned"))
    );
    let (status, edited) = send(&quality, &app, (Method::PUT, &format!("/api/regulatory/dpdp/policies/{rid}")),
        &json!({ "title": "Data retention schedule", "body": "Retention schedule text, revised after review." })).await;
    assert_eq!(
        (status, edited["status"].as_str()),
        (StatusCode::OK, Some("draft"))
    );
}

#[tokio::test]
async fn a_breach_drill_clears_the_gap_until_the_next_is_due() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    clear(&app).await;
    let quality = common::provision_staff(&app, &csrf, "quality_officer", &[]).await;
    assert!(
        gap_codes(&quality, &app)
            .await
            .contains(&"drill_never".to_owned())
    );
    let path = "/api/regulatory/dpdp/drills";
    let (status, _) = send(&quality, &app, (Method::POST, path), &json!({ "held_on": "2099-01-01", "format": "tabletop", "scenario": "Ransomware", "findings": "None" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "recorded after it is held");
    let (status, rows) = send(&quality, &app, (Method::POST, path), &json!({ "held_on": "2026-10-01", "format": "tabletop",
        "scenario": "Ransomware on the lab server", "findings": "CERT-In form took 2 hours to find; saved a copy" })).await;
    assert_eq!(status, StatusCode::OK, "{rows}");
    assert_eq!(
        rows[0]["next_due_on"], "2027-10-01",
        "a year later by default"
    );
    let codes = gap_codes(&quality, &app).await;
    assert!(!codes.iter().any(|c| c.starts_with("drill_")), "{codes:?}");
}
