//! Undoing a merge needs access to both records, as the merge itself does.
//!
//! A merge folds one patient into another; undoing it splits a record back out.
//! A caller who could reach only one side would be handed the other one, so
//! `POST /api/patients/unmerge/{id}` checks both patients and refuses as 404,
//! the same answer as a merge that does not exist.

use crate::common;
use crate::psych_support::{doctor, on_care_team, patient, send, tenant};

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// Admin merges `merged` into `survivor`; returns the merge-history id.
async fn merged(app: &common::TestApp, csrf: &str, survivor: Uuid, merged: Uuid) -> String {
    let (status, body) = send(
        csrf,
        app.client
            .post(app.url("/api/patients/merge"))
            .json(&json!({
                "surviving_patient_id": survivor,
                "merged_patient_id": merged,
                "merge_reason": "Same person registered twice",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["id"].as_str().expect("history id").to_owned()
}

async fn still_merged(app: &common::TestApp, history: &str) -> bool {
    sqlx::query_scalar("SELECT unmerged_at IS NULL FROM patient_merge_history WHERE id = $1::uuid")
        .bind(history)
        .fetch_one(&app.db)
        .await
        .expect("history row")
}

/// Given a merge of two patients, When a doctor who reaches only the surviving
/// record asks to undo it, Then it answers 404 and the merge stands; When a
/// doctor on the care team of both asks, Then it is undone.
#[tokio::test]
async fn an_unmerge_needs_both_records() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let (survivor, duplicate) = (patient(&app, tenant).await, patient(&app, tenant).await);
    let history = merged(&app, &csrf, survivor, duplicate).await;
    let path = format!("/api/patients/unmerge/{history}");

    let one_side = doctor(&app, &csrf).await;
    on_care_team(&app, tenant, survivor, one_side.id).await;
    let (status, body) = send(&one_side.csrf, one_side.client.post(app.url(&path))).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    assert!(
        still_merged(&app, &history).await,
        "a refused unmerge changes nothing"
    );

    let stranger = doctor(&app, &csrf).await;
    let (status, _) = send(&stranger.csrf, stranger.client.post(app.url(&path))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let both = doctor(&app, &csrf).await;
    on_care_team(&app, tenant, survivor, both.id).await;
    on_care_team(&app, tenant, duplicate, both.id).await;
    let (status, body) = send(&both.csrf, both.client.post(app.url(&path))).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(!still_merged(&app, &history).await);
}
