//! Every user learns whether the hospital restricts copying.
//!
//! The DLP guard read `security.restrict_copy` from the settings endpoint,
//! which is admin-only for that category: every other user was refused, the
//! guard treated the refusal as "off", and copying was never restricted for
//! the staff it exists for. `/auth/me`, which every user loads, carries it.

use crate::common;

use serde_json::{Value, json};

#[tokio::test]
async fn auth_me_says_whether_copying_is_restricted() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let me = || async {
        app.client
            .get(app.url("/api/auth/me"))
            .send()
            .await
            .expect("me")
            .json::<Value>()
            .await
            .expect("me json")
    };
    let put = |value: Value| {
        app.client
            .put(app.url("/api/setup/settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "category": "security", "key": "restrict_copy", "value": value }))
            .send()
    };

    let before = me().await["restrict_copy"]
        .as_bool()
        .expect("restrict_copy is present");
    put(json!(true)).await.expect("turn on");
    assert_eq!(
        me().await["restrict_copy"],
        true,
        "on for the hospital, on for the user"
    );
    put(json!(false)).await.expect("turn off");
    assert_eq!(me().await["restrict_copy"], false);
    put(json!(before)).await.expect("restore");
}
