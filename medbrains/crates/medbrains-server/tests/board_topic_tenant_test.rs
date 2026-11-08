//! The live notification socket keeps hospitals apart and checks the account.
//!
//! Board signals were published to `board:<surface>` for every hospital on the
//! server, so a bypass-role session at hospital A heard hospital B's lab board.
//! The socket also opened on a decoded token alone, so a deactivated account
//! kept its stream.

use crate::common;

use futures::StreamExt;
use reqwest::StatusCode;
use serde_json::{Value, json};
use std::time::Duration;
use uuid::Uuid;

type Socket =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// The next JSON frame within `within`, or `None`.
async fn next_frame(socket: &mut Socket, within: Duration) -> Option<Value> {
    tokio::time::timeout(within, async {
        while let Some(Ok(message)) = socket.next().await {
            if let Ok(text) = message.to_text()
                && let Ok(frame) = serde_json::from_str::<Value>(text)
            {
                return Some(frame);
            }
        }
        None
    })
    .await
    .ok()
    .flatten()
}

/// Sign `username` in and return its access token.
async fn token_for(app: &common::TestApp, username: &str, password: &str) -> String {
    let resp = reqwest::Client::new()
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    assert_eq!(resp.status(), StatusCode::OK);
    resp.cookies()
        .find(|c| c.name() == "access_token")
        .map(|c| c.value().to_owned())
        .expect("access token cookie")
}

/// The socket URL for `token`.
fn socket_url(app: &common::TestApp, token: &str) -> String {
    format!("ws://{}/api/ws/notifications?token={token}", app.addr)
}

/// Given a super admin's socket at hospital A, a lab signal at hospital B
/// reaches nothing, and one at hospital A arrives.
#[tokio::test]
async fn a_bypass_session_hears_only_its_own_hospitals_boards() {
    let app = common::spawn_app().await;
    let home: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other', 'multi_specialty') \
         RETURNING id",
    )
    .bind(format!(
        "BT{}",
        &Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    ))
    .fetch_one(&app.db)
    .await
    .expect("other tenant");

    let token = token_for(&app, "admin", "admin123").await;
    let (mut socket, _) = tokio_tungstenite::connect_async(socket_url(&app, &token))
        .await
        .expect("socket");
    // Publish only once the socket has really subscribed to its own board.
    let own_board = medbrains_server_core::notification_hub::board_topic(home, "lab");
    tokio::time::timeout(Duration::from_secs(5), async {
        while app.state.notifications.receiver_count(&own_board).await == 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("the socket subscribed to its own lab board");

    let theirs = Uuid::new_v4();
    medbrains_notifications::publish_surface_board_signal(
        &app.state,
        other,
        "lab",
        "lab.sample",
        "lab_order",
        theirs,
    );
    assert!(
        next_frame(&mut socket, Duration::from_millis(800))
            .await
            .is_none(),
        "another hospital's board signal reached this socket"
    );

    let ours = Uuid::new_v4();
    medbrains_notifications::publish_surface_board_signal(
        &app.state,
        home,
        "lab",
        "lab.sample",
        "lab_order",
        ours,
    );
    let frame = next_frame(&mut socket, Duration::from_secs(5))
        .await
        .expect("own board signal");
    assert_eq!(frame["entity_id"], ours.to_string());
}

/// A nurse made through the setup screen; returns (username, token).
async fn nurse(app: &common::TestApp) -> (String, String) {
    let csrf = app.login_admin().await;
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("ws{tag}"), format!("Socket#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "username": username, "email": format!("{username}@example.test"),
                       "password": password, "full_name": "Socket Test", "role": "nurse" }),
        )
        .send()
        .await
        .expect("provision");
    assert_eq!(resp.status(), StatusCode::OK);
    let token = token_for(app, &username, &password).await;
    (username, token)
}

/// Change the nurse's row with `set`, then try to open a socket with the
/// token minted before the change.
async fn opens_after(app: &common::TestApp, set: &str) -> bool {
    let (username, token) = nurse(app).await;
    let (live, _) = tokio_tungstenite::connect_async(socket_url(app, &token))
        .await
        .expect("an active account's socket opens");
    drop(live);
    sqlx::query(&format!("UPDATE users SET {set} WHERE username = $1"))
        .bind(&username)
        .execute(&app.db)
        .await
        .expect("change the account");
    tokio_tungstenite::connect_async(socket_url(app, &token))
        .await
        .is_ok()
}

/// Given an account deactivated after it signed in, its token no longer
/// opens the socket.
#[tokio::test]
async fn a_deactivated_account_cannot_open_the_socket() {
    let app = common::spawn_app().await;
    assert!(!opens_after(&app, "is_active = false").await);
}

/// Given an account deleted after it signed in, its token no longer opens the
/// socket.
#[tokio::test]
async fn a_deleted_account_cannot_open_the_socket() {
    let app = common::spawn_app().await;
    assert!(!opens_after(&app, "deleted_at = now()").await);
}

/// Given an account whose permissions changed after it signed in, the old
/// token no longer opens the socket.
#[tokio::test]
async fn a_stale_permission_version_cannot_open_the_socket() {
    let app = common::spawn_app().await;
    assert!(!opens_after(&app, "perm_version = perm_version + 1").await);
}

/// Given an open socket, when its account is deactivated, the socket is closed
/// within one re-check interval.
#[tokio::test]
async fn an_open_socket_closes_when_its_account_is_deactivated() {
    let app = common::spawn_app().await;
    app.state
        .notifications
        .set_recheck_interval(Duration::from_millis(300));
    let (username, token) = nurse(&app).await;
    let (mut socket, _) = tokio_tungstenite::connect_async(socket_url(&app, &token))
        .await
        .expect("socket");
    sqlx::query("UPDATE users SET is_active = false WHERE username = $1")
        .bind(&username)
        .execute(&app.db)
        .await
        .expect("deactivate");
    let closed = tokio::time::timeout(Duration::from_secs(5), async {
        while let Some(Ok(_)) = socket.next().await {}
    })
    .await;
    app.state
        .notifications
        .set_recheck_interval(Duration::from_secs(300));
    assert!(
        closed.is_ok(),
        "the socket stayed open after the account was deactivated"
    );
}
