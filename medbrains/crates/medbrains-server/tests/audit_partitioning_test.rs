//! Audit tables partition by month (#302): converting a table keeps every
//! row, its RLS policy, grants, indexes and triggers; rows land in their own
//! month; re-running is harmless; and the daily job skips months a table
//! already covers under another name instead of failing.

use crate::common;

use uuid::Uuid;

#[tokio::test]
async fn a_table_converts_to_monthly_partitions_without_losing_anything() {
    let app = common::spawn_app().await;
    let t = format!("zz_part_{}", &Uuid::new_v4().simple().to_string()[..8]);
    let run = |sql: String| {
        let db = app.db.clone();
        async move { sqlx::raw_sql(&sql).execute(&db).await.expect(&sql) }
    };
    run(format!(
        "CREATE TABLE {t} (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, \
           note text, created_at timestamptz NOT NULL DEFAULT now()); \
         CREATE INDEX {t}_tenant ON {t} (tenant_id, created_at DESC); \
         ALTER TABLE {t} ENABLE ROW LEVEL SECURITY; \
         CREATE POLICY {t}_tenant ON {t} USING (tenant_id = ANY (app_visible_tenants())); \
         GRANT SELECT, INSERT ON {t} TO medbrains_app; \
         CREATE TRIGGER {t}_guard BEFORE DELETE ON {t} FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail(); \
         INSERT INTO {t} (tenant_id, note, created_at) VALUES \
           (gen_random_uuid(), 'old', now() - interval '3 months'), \
           (gen_random_uuid(), 'now', now());"
    ))
    .await;

    let grants = || {
        sqlx::query_scalar::<_, Vec<String>>(
            "SELECT coalesce(array_agg(grantee || ':' || privilege_type ORDER BY 1), '{}') \
               FROM information_schema.role_table_grants WHERE table_name = $1",
        )
        .bind(&t)
        .fetch_one(&app.db)
    };
    let grants_before = grants().await.expect("grants");
    let done: String = sqlx::query_scalar("SELECT partition_table_monthly($1, 'created_at')")
        .bind(&t)
        .fetch_one(&app.db)
        .await
        .expect("convert");
    assert!(done.contains("2 rows"), "{done}");

    let (kind, rls): (String, bool) =
        sqlx::query_as("SELECT relkind::text, relrowsecurity FROM pg_class WHERE relname = $1")
            .bind(&t)
            .fetch_one(&app.db)
            .await
            .expect("parent");
    assert_eq!((kind.as_str(), rls), ("p", true));
    let homes: Vec<String> = sqlx::query_scalar(&format!(
        "SELECT tableoid::regclass::text FROM {t} ORDER BY created_at"
    ))
    .fetch_all(&app.db)
    .await
    .expect("rows");
    let old_month: String =
        sqlx::query_scalar("SELECT to_char(now() - interval '3 months', 'YYYYMM')")
            .fetch_one(&app.db)
            .await
            .expect("month");
    assert_eq!(
        homes[0],
        format!("{t}_p{old_month}"),
        "each row sits in its own month"
    );
    let carried: (i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT count(*) FROM pg_policies WHERE tablename = $1), \
                (SELECT count(*) FROM pg_indexes WHERE tablename = $1 AND indexname = $1 || '_tenant'), \
                (SELECT count(*) FROM pg_trigger WHERE tgrelid = $1::regclass AND tgname = $1 || '_guard')",
    )
    .bind(&t)
    .fetch_one(&app.db)
    .await
    .expect("carried");
    assert_eq!(carried, (1, 1, 1), "policy, index and trigger carried over");
    assert_eq!(
        grants().await.expect("grants"),
        grants_before,
        "the same grants"
    );
    let pkey: String = sqlx::query_scalar(
        "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'",
    )
    .bind(&t)
    .fetch_one(&app.db)
    .await
    .expect("pk");
    assert_eq!(pkey, "PRIMARY KEY (id, created_at)");
    let leftover: Option<String> =
        sqlx::query_scalar("SELECT relname::text FROM pg_class WHERE relname = $1")
            .bind(format!("{t}_unpartitioned"))
            .fetch_optional(&app.db)
            .await
            .expect("leftover");
    assert!(leftover.is_none(), "the old table is gone");

    let again: String = sqlx::query_scalar("SELECT partition_table_monthly($1, 'created_at')")
        .bind(&t)
        .fetch_one(&app.db)
        .await
        .expect("again");
    assert!(again.ends_with("already partitioned"));

    // Registered with the daily job, months it already has are skipped.
    run(format!(
        "INSERT INTO partition_config (table_name, partition_column, premake) VALUES ('{t}', 'created_at', 3)"
    ))
    .await;
    sqlx::query("SELECT ensure_partitions_with_rls()")
        .execute(&app.db)
        .await
        .expect("daily job runs over existing months");

    run(format!(
        "DELETE FROM partition_config WHERE table_name = '{t}'; DROP TABLE {t};"
    ))
    .await;
}
