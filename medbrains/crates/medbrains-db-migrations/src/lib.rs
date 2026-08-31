//! Embedded SQL migrations, held apart from `medbrains-db` on purpose.
//!
//! `sqlx::migrate!` reads the migration directory at **compile time**, so
//! whichever crate holds it must recompile whenever a `.sql` file is added.
//! That crate used to be `medbrains-db`, which 109 other crates depend on.
//!
//! Measured over six months: `medbrains-db` saw 1,145 edits, of which
//! **854 were migrations and 21 were Rust**. Every one of those 854 SQL
//! files rebuilt 991 lines of unchanged Rust and 109 crates behind it —
//! 69% of the workspace's total rebuild cost, for changes that touched no
//! code at all.
//!
//! Here, a new migration rebuilds this crate and `medbrains-server`. Two
//! crates instead of 110.
//!
//! **Keep this crate's dependency list empty and keep its dependents few.**
//! Anything that depends on it inherits a rebuild on every migration, which
//! is the exact cost this split exists to remove. Import it only where
//! migrations are actually executed.

/// Run the embedded migrations against `pool`.
///
/// Returns `MigrateError` rather than `medbrains-db`'s `DbError`: depending
/// on that crate for an error type would re-couple the two and undo the
/// point of the split.
pub async fn run(pool: &sqlx::PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("src/migrations").run(pool).await?;
    tracing::info!("Database migrations applied");
    Ok(())
}
