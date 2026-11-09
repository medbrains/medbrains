//! The database the research DB tests run against.

#![allow(clippy::panic)]

/// A migrated, seeded database: `RESEARCH_TEST_DATABASE_URL`, else `DATABASE_URL` (what
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
    // Seed before planting: the seed creates the first hospital and its admin
    // only on an empty database, so a test hospital planted first leaves the
    // server tests that share this database with no admin to sign in as.
    medbrains_seed::run_seed(&db)
        .await
        .unwrap_or_else(|e| panic!("seed: {e}"));
    Some(db)
}
