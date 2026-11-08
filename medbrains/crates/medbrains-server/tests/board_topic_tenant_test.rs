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
    // Let the subscription register before anything is published.
    tokio::time::sleep(Duration::from_millis(300)).await;

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

/// Given an account deactivated after it signed in, its token no longer
/// opens the socket.
#[tokio::test]
async fn a_deactivated_account_cannot_open_the_socket() {
    let app = common::spawn_app().await;
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
    let token = token_for(&app, &username, &password).await;
    let (live, _) = tokio_tungstenite::connect_async(socket_url(&app, &token))
        .await
        .expect("an active account's socket opens");
    drop(live);

    sqlx::query("UPDATE users SET is_active = false WHERE username = $1")
        .bind(&username)
        .execute(&app.db)
        .await
        .expect("deactivate");
    let refused = tokio_tungstenite::connect_async(socket_url(&app, &token)).await;
    assert!(
        refused.is_err(),
        "a deactivated account's token opened the socket"
    );
}
