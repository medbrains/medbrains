//! Sticky notes: private until shared, readable by whom they are shared with,
//! editable only by the author, and gone once they clear themselves.

mod common;
mod notes_support;

use notes_support::{department, ids, nurse};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Given a note shared to Ward A's board, When a colleague on Ward A, a nurse
/// on Ward B and the colleague-it-was-handed-to read their notes, Then each
/// sees exactly what was shared with them — and only the author may edit it.
#[tokio::test]
async fn a_note_is_seen_only_where_it_was_shared() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let tag = &Uuid::new_v4().simple().to_string()[..6];
    let (ward_a, ward_b) = (
        department(&app, &format!("a{tag}")).await,
        department(&app, &format!("b{tag}")).await,
    );
    let (author, _) = nurse(&app, &admin, ward_a).await;
    let (colleague, _) = nurse(&app, &admin, ward_a).await;
    let (outsider, outsider_id) = nurse(&app, &admin, ward_b).await;

    let (status, created) = author
        .send(author.client.post(app.url("/api/notes")).json(&json!({
            "body": "Crash cart check due at 18:00", "colour": "yellow", "pinned": true, "expires_at": null
        })))
        .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let note = created["id"].as_str().expect("id").to_owned();

    let (_, before) = colleague
        .send(colleague.client.get(app.url("/api/notes")))
        .await;
    let ward_board = |view: &Value| {
        view["boards"].as_array().and_then(|b| {
            b.iter()
                .find(|x| x["department_id"] == json!(ward_a))
                .map(|x| ids(&x["notes"]))
        })
    };
    assert_eq!(ward_board(&before), Some(vec![]), "private until shared");

    let (status, _) = author
        .send(
            author
                .client
                .put(app.url(&format!("/api/notes/{note}/shares")))
                .json(&json!({
                    "department_ids": [ward_a], "user_ids": [outsider_id]
                })),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let (_, seen) = colleague
        .send(colleague.client.get(app.url("/api/notes")))
        .await;
    assert_eq!(
        ward_board(&seen),
        Some(vec![note.clone()]),
        "on the ward board"
    );

    let (_, out) = outsider
        .send(outsider.client.get(app.url("/api/notes")))
        .await;
    assert_eq!(
        ids(&out["shared_with_me"]),
        vec![note.clone()],
        "handed to the outsider"
    );
    assert!(
        ward_board(&out).is_none(),
        "the outsider has no Ward A board"
    );

    let (status, _) = colleague
        .send(
            colleague
                .client
                .put(app.url(&format!("/api/notes/{note}")))
                .json(&json!({
                    "body": "changed", "colour": "blue", "pinned": false, "expires_at": null
                })),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "only the author edits");

    let board_share = seen["boards"]
        .as_array()
        .and_then(|b| b.iter().find(|x| x["department_id"] == json!(ward_a)))
        .and_then(|b| b["notes"][0]["share_id"].as_str())
        .expect("board share id")
        .to_owned();
    let (status, _) = colleague
        .send(
            colleague
                .client
                .delete(app.url(&format!("/api/notes/shares/{board_share}"))),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a nurse cannot clear another's note off the board"
    );

    let dismiss = out["shared_with_me"][0]["share_id"]
        .as_str()
        .expect("share")
        .to_owned();
    let (status, _) = outsider
        .send(
            outsider
                .client
                .delete(app.url(&format!("/api/notes/shares/{dismiss}"))),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::NO_CONTENT,
        "the recipient may dismiss it"
    );
    let (_, after) = outsider
        .send(outsider.client.get(app.url("/api/notes")))
        .await;
    assert!(ids(&after["shared_with_me"]).is_empty());
}

/// A note set to clear itself is gone once its time passes, and a clear-by
/// time already in the past is refused rather than silently saved.
#[tokio::test]
async fn a_note_clears_itself_when_its_time_passes() {
    let app = common::spawn_app().await;
    let admin = app.login_admin().await;
    let ward = department(&app, &Uuid::new_v4().simple().to_string()[..6]).await;
    let (author, _) = nurse(&app, &admin, ward).await;

    let (status, _) = author
        .send(author.client.post(app.url("/api/notes")).json(&json!({
            "body": "Dr Rao on leave", "colour": "pink", "pinned": false,
            "expires_at": "2000-01-01T00:00:00Z"
        })))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (_, created) = author
        .send(author.client.post(app.url("/api/notes")).json(&json!({
            "body": "Dr Rao on leave", "colour": "pink", "pinned": false,
            "expires_at": "2999-01-01T00:00:00Z"
        })))
        .await;
    let note = created["id"].as_str().expect("id").to_owned();
    let (_, view) = author.send(author.client.get(app.url("/api/notes"))).await;
    assert_eq!(ids(&view["mine"]), vec![note.clone()]);

    // Time passes.
    sqlx::query(
        "UPDATE sticky_notes SET expires_at = now() - interval '1 minute' WHERE id = $1::uuid",
    )
    .bind(&note)
    .execute(&app.db)
    .await
    .expect("age the note");
    let (_, later) = author.send(author.client.get(app.url("/api/notes"))).await;
    assert!(
        ids(&later["mine"]).is_empty(),
        "a cleared note no longer shows"
    );
}
