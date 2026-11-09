//! The database the research DB tests run against.

#![allow(clippy::panic)]

/// A migrated database: `RESEARCH_TEST_DATABASE_URL`, else `DATABASE_URL` (what
/// CI sets). `None` locally when neither is set; in CI (`CI` set) a missing
/// database fails the test instead of skipping it, so the tests cannot go quiet.
pub(crate) async fn database() -> Option<sqlx::PgPool> {
    let url = std::env::var("RESEARCH_TEST_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok();
    let Some(url) = url else {
        assert!(
            std::env::var_os("CI").is_none(),
            "CI must set DATABASE_URL for the research database tests"
        );
        return None;
    };
    let db = sqlx::PgPool::connect(&url)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    medbrains_db_migrations::run(&db)
        .await
        .unwrap_or_else(|e| panic!("migrate: {e}"));
    Some(db)
}
