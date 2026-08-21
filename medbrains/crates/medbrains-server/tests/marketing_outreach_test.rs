mod common;

use uuid::Uuid;

/// Create a cohort to hang runs off. Enquiry-kind, so no clinical permission
/// is involved in the fixture.
async fn a_cohort(app: &common::TestApp, csrf: &str) -> Uuid {
    let resp = app
        .client
        .post(app.url("/api/marketing/cohorts"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "name": format!("cohort-{}", &Uuid::new_v4().to_string()[..8]),
            "criteria": { "source": "test" },
        }))
        .send()
        .await
        .expect("create cohort");
    assert_eq!(resp.status(), reqwest::StatusCode::OK, "create cohort");
    let body: serde_json::Value = resp.json().await.expect("cohort json");
    body["id"].as_str().unwrap_or_default().parse().expect("cohort id")
}

/// The person who wrote a campaign cannot approve it.
///
/// NMC advertising rules and the Drugs and Magic Remedies Act make this a
/// second pair of eyes rather than a formality. The database has a CHECK on
/// approved_by <> created_by, but a constraint violation reaching an operator
/// as "violates check constraint mkt_outreach_runs_separate_approver" teaches
/// them nothing — so the handler refuses first, with a reason.
///
/// The test logs in as admin throughout, which is the strongest possible
/// version of the check: admin is super_admin and bypasses every permission,
/// so the refusal here is the separation of duties itself and not a missing
/// grant.
#[tokio::test]
async fn the_author_of_a_campaign_cannot_approve_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cohort = a_cohort(&app, &csrf).await;

    let created: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/outreach"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "cohort_id": cohort,
            "channel": "whatsapp",
            "body_preview": "Your annual review is due.",
        }))
        .send()
        .await
        .expect("create run")
        .json()
        .await
        .expect("run json");
    let run_id = created["id"].as_str().unwrap_or_default();
    assert_eq!(created["status"].as_str(), Some("draft"), "runs start as drafts");

    let submitted = app
        .client
        .post(app.url(&format!("/api/marketing/outreach/{run_id}/submit")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("submit");
    assert_eq!(submitted.status(), reqwest::StatusCode::OK, "submit");

    // Same identity that created it. Must be refused even though this caller
    // bypasses every permission check in the system.
    let approved = app
        .client
        .post(app.url(&format!("/api/marketing/outreach/{run_id}/approve")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("approve");
    assert_eq!(
        approved.status(),
        reqwest::StatusCode::CONFLICT,
        "the author must not be able to approve their own campaign"
    );
}

/// An SMS run without a DLT template id is refused at creation.
///
/// TRAI requires every commercial template to be pre-registered. An SMS sent
/// on an unregistered one does not bounce — the carrier drops it silently, so
/// the hospital believes the cohort was reminded and nobody was. The module
/// cannot prevent that failure downstream, so it refuses at the only point
/// where somebody can still fix it.
#[tokio::test]
async fn an_sms_run_without_a_dlt_template_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cohort = a_cohort(&app, &csrf).await;

    let resp = app
        .client
        .post(app.url("/api/marketing/outreach"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "cohort_id": cohort,
            "channel": "sms",
            "body_preview": "Your annual review is due.",
        }))
        .send()
        .await
        .expect("create sms run");
    assert_eq!(resp.status(), reqwest::StatusCode::BAD_REQUEST, "sms needs a DLT id");

    // The same run with a template id is accepted, so the refusal is about the
    // missing id and not about SMS being unsupported.
    let ok = app
        .client
        .post(app.url("/api/marketing/outreach"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "cohort_id": cohort,
            "channel": "sms",
            "dlt_template_id": "1207161234567890123",
            "body_preview": "Your annual review is due.",
        }))
        .send()
        .await
        .expect("create sms run with template");
    assert_eq!(ok.status(), reqwest::StatusCode::OK, "with a DLT id it is accepted");
}

/// A draft cannot skip review.
///
/// Approval is a state machine because the failure it guards against is a
/// wording error reaching a whole cohort. A draft that could be approved
/// directly would let the author move it two steps alone.
#[tokio::test]
async fn a_draft_cannot_be_approved_without_being_submitted() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cohort = a_cohort(&app, &csrf).await;

    let created: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/outreach"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "cohort_id": cohort, "channel": "call" }))
        .send()
        .await
        .expect("create run")
        .json()
        .await
        .expect("run json");
    let run_id = created["id"].as_str().unwrap_or_default();

    let approved = app
        .client
        .post(app.url(&format!("/api/marketing/outreach/{run_id}/approve")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("approve");
    assert_eq!(
        approved.status(),
        reqwest::StatusCode::CONFLICT,
        "a draft is not awaiting approval"
    );
}
