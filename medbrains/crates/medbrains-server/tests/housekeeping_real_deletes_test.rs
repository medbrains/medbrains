//! Housekeeping tables really delete. The retention purge and the widget
//! catalogue sync DELETE from them; under the soft-delete guardrail those
//! deletes kept every row forever.

use crate::common;

/// The tables the retention purge and the catalogue sync delete from.
const HOUSEKEEPING: [&str; 6] = [
    "refresh_tokens",
    "outbox_events",
    "outbox_dlq",
    "job_queue",
    "camp_sync_events",
    "widget_templates",
];

/// Given the housekeeping tables, Then none carries the soft-delete guardrail,
/// and a DELETE on one removes the row rather than marking it.
#[tokio::test]
async fn housekeeping_deletes_remove_the_row() {
    let app = common::spawn_app().await;
    let guarded: Vec<String> = sqlx::query_scalar(
        "SELECT c.relname::text FROM pg_trigger t \
         JOIN pg_class c ON c.oid = t.tgrelid \
         JOIN pg_proc p ON p.oid = t.tgfoid \
         WHERE p.proname = 'soft_delete_guardrail' AND c.relname = ANY($1)",
    )
    .bind(HOUSEKEEPING)
    .fetch_all(&app.db)
    .await
    .expect("triggers");
    assert!(guarded.is_empty(), "still soft-deleting: {guarded:?}");

    let id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO widget_templates \
           (tenant_id, name, widget_type, default_config, default_source, is_system) \
         VALUES (NULL, 'housekeeping probe', 'stat_card', '{}', '{}', false) RETURNING id",
    )
    .fetch_one(&app.db)
    .await
    .expect("insert");
    sqlx::query("DELETE FROM widget_templates WHERE id = $1")
        .bind(id)
        .execute(&app.db)
        .await
        .expect("delete");
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM widget_templates WHERE id = $1")
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("count");
    assert_eq!(left, 0, "the row is gone, not marked deleted");
}
