//! A setting that was deleted and is saved again is live again. The upsert
//! used to update the soft-deleted row's value and leave it deleted, so the
//! save "worked" and every reader that honours soft-delete still saw nothing.

use crate::common;

use serde_json::{Value, json};

#[tokio::test]
async fn saving_a_deleted_setting_brings_it_back() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let key = format!("k_{}", uuid::Uuid::new_v4().simple());
    let put = |value: Value| {
        app.client
            .put(app.url("/api/setup/settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "category": "regression_test", "key": key, "value": value }))
            .send()
    };
    let read = || async {
        let rows: Value = app
            .client
            .get(app.url("/api/setup/settings?category=regression_test"))
            .send()
            .await
            .expect("get")
            .json()
            .await
            .expect("json");
        rows.as_array()
            .and_then(|r| r.iter().find(|row| row["key"] == key.as_str()).cloned())
    };

    assert!(
        put(json!("first"))
            .await
            .expect("put")
            .status()
            .is_success()
    );
    // The DELETE trigger turns this into a soft delete.
    sqlx::query("DELETE FROM tenant_settings WHERE category = 'regression_test' AND key = $1")
        .bind(&key)
        .execute(&app.db)
        .await
        .expect("delete");
    assert!(read().await.is_none(), "a deleted setting is not listed");

    assert!(
        put(json!("second"))
            .await
            .expect("put")
            .status()
            .is_success()
    );
    let row = read().await.expect("the saved setting is live again");
    assert_eq!(row["value"], "second");
    let deleted: bool = sqlx::query_scalar(
        "SELECT deleted_at IS NOT NULL FROM tenant_settings \
          WHERE category = 'regression_test' AND key = $1",
    )
    .bind(&key)
    .fetch_one(&app.db)
    .await
    .expect("row");
    assert!(!deleted);
}
