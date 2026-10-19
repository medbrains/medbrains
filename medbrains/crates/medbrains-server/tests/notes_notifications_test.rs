//! Notifications flowing into sticky notes: pinned or made automatically,
//! read-only, never shared, and cleared when the item behind them is resolved.

mod common;
mod notes_support;

use notes_support::{Staff, department, nurse};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A notification addressed to `user`, written the way producers write them.
async fn notify(
    app: &common::TestApp,
    user: Uuid,
    kind: &str,
    category: &str,
    entity: (&str, Uuid),
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT tenant_id, id, $2, 'Critical lab value', 'Potassium 6.8 mmol/L', $3, $4, $5, '/lab' \
         FROM users WHERE id = $1 RETURNING id",
    )
    .bind(user)
    .bind(kind)
    .bind(category)
    .bind(entity.0)
    .bind(entity.1)
    .fetch_one(&app.db)
    .await
    .expect("notification")
}

async fn mine(app: &common::TestApp, staff: &Staff) -> Vec<Value> {
    let (status, view) = staff.send(staff.client.get(app.url("/api/notes"))).await;
    assert_eq!(status, StatusCode::OK, "{view}");
    view["mine"].as_array().cloned().unwrap_or_default()
}

async fn pin(app: &common::TestApp, staff: &Staff, notification: Uuid) -> (StatusCode, Value) {
    let url = app.url(&format!("/api/notes/from-notification/{notification}"));
    staff.send(staff.client.post(url)).await
}

/// Given a critical-value notification for Nurse A, When she pins it twice
/// and Nurse B tries to pin it, Then A has exactly one read-only note that
/// cannot be shared but can be dismissed, and B is told it does not exist.
#[tokio::test]
async fn a_pinned_notification_is_one_read_only_note_for_its_owner() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let ward = department(&app, &Uuid::new_v4().simple().to_string()[..6]).await;
    let (a, a_id) = nurse(&app, &admin, ward).await;
    let (b, _) = nurse(&app, &admin, ward).await;
    let n = notify(&app, a_id, "danger", "Lab", ("lab_order", Uuid::new_v4())).await;

    let (status, first) = pin(&app, &a, n).await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    let (status, again) = pin(&app, &a, n).await;
    assert_eq!(status, StatusCode::OK, "pinning again is not an error");
    assert_eq!(first["id"], again["id"], "one note per notification");
    let (status, _) = pin(&app, &b, n).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "someone else's notification");
    assert!(mine(&app, &b).await.is_empty(), "B sees nothing of A's");

    let notes = mine(&app, &a).await;
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0]["is_system"], json!(true));
    assert_eq!(notes[0]["source_url"], json!("/lab"));
    assert!(
        notes[0]["body"]
            .as_str()
            .is_some_and(|t| t.contains("Potassium 6.8"))
    );

    let note = first["id"].as_str().expect("id").to_owned();
    let (status, _) = a
        .send(a.client.put(app.url(&format!("/api/notes/{note}"))).json(&json!({
            "body": "Potassium normal", "colour": "yellow", "pinned": false, "expires_at": null
        })))
        .await;
    assert_eq!(status, StatusCode::CONFLICT, "the text is the system's");
    let (status, _) = a
        .send(
            a.client
                .put(app.url(&format!("/api/notes/{note}/shares")))
                .json(&json!({
                    "department_ids": [ward], "user_ids": []
                })),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a critical value is not for the ward board"
    );
    let (status, _) = a
        .send(a.client.delete(app.url(&format!("/api/notes/{note}"))))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT, "dismissible");
    assert!(mine(&app, &a).await.is_empty());
}

/// Given a nurse who chose "urgent", When an urgent and a routine lab
/// notification arrive, Then only the urgent one is already in her notes —
/// and a kind not on the list is refused.
#[tokio::test]
async fn a_chosen_kind_of_notification_becomes_a_note_on_arrival() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let ward = department(&app, &Uuid::new_v4().simple().to_string()[..6]).await;
    let (a, a_id) = nurse(&app, &admin, ward).await;
    let prefs = app.url("/api/notes/preferences");

    let (status, _) = a
        .send(a.client.put(&prefs).json(&json!({ "kinds": ["gossip"] })))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, saved) = a
        .send(a.client.put(&prefs).json(&json!({ "kinds": ["urgent"] })))
        .await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    let (_, read) = a.send(a.client.get(&prefs)).await;
    assert_eq!(read["kinds"], json!(["urgent"]));

    notify(&app, a_id, "danger", "Lab", ("lab_order", Uuid::new_v4())).await;
    notify(&app, a_id, "info", "Lab", ("lab_order", Uuid::new_v4())).await;
    let notes = mine(&app, &a).await;
    assert_eq!(notes.len(), 1, "only the urgent one: {notes:?}");
    assert_eq!(notes[0]["is_system"], json!(true));
    assert_eq!(
        notes[0]["can_auto_resolve"],
        json!(true),
        "a critical value resolves"
    );
}

/// Given a note pinned from "access request waiting for review", When the
/// request is approved, Then the note shows as resolved automatically; and a
/// note with nothing to resolve cannot be switched to auto-resolve.
#[tokio::test]
async fn an_auto_resolving_note_clears_when_its_source_is_resolved() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let ward = department(&app, &Uuid::new_v4().simple().to_string()[..6]).await;
    let (a, a_id) = nurse(&app, &admin, ward).await;
    let request: Uuid = sqlx::query_scalar(
        "INSERT INTO iam_access_requests \
           (tenant_id, requester_id, target_user_id, requested_permissions, reason) \
         SELECT tenant_id, id, id, '{lab.results.view}', 'night cover' FROM users WHERE id = $1 \
         RETURNING id",
    )
    .bind(a_id)
    .fetch_one(&app.db)
    .await
    .expect("access request");
    let n = notify(&app, a_id, "info", "Access", ("access_request", request)).await;
    let (_, pinned) = pin(&app, &a, n).await;
    let note = pinned["id"].as_str().expect("id").to_owned();

    let open = mine(&app, &a).await;
    assert_eq!(open[0]["auto_resolve"], json!(true));
    assert!(open[0]["resolved_at"].is_null(), "still pending review");

    sqlx::query(
        "UPDATE iam_access_requests SET status = 'approved', reviewed_at = now() \
         WHERE id = $1",
    )
    .bind(request)
    .execute(&app.db)
    .await
    .expect("approve");
    let after = mine(&app, &a).await;
    assert!(
        after[0]["resolved_at"].is_string(),
        "resolved automatically: {after:?}"
    );

    let (_, manual) = a
        .send(a.client.post(app.url("/api/notes")).json(&json!({
            "body": "Call pharmacy", "colour": "yellow", "pinned": false, "expires_at": null
        })))
        .await;
    let manual = manual["id"].as_str().expect("id");
    let (status, _) = a
        .send(
            a.client
                .put(app.url(&format!("/api/notes/{manual}/auto-resolve")))
                .json(&json!({ "auto_resolve": true })),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT, "nothing behind it to resolve");
    let (status, _) = a
        .send(
            a.client
                .put(app.url(&format!("/api/notes/{note}/auto-resolve")))
                .json(&json!({ "auto_resolve": false })),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
}
