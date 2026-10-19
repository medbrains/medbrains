//! The release register: one row per imported package (edition + date),
//! carrying its status and progress while the import runs.

use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::rf2::ReleaseIdentity;

/// Attribution required by clause 8.3 of the SNOMED CT Affiliate Licence,
/// shown wherever SNOMED CT content is.
pub const LICENCE_NOTICE: &str = "This material includes SNOMED Clinical Terms® (SNOMED CT®) \
which is used by permission of the International Health Terminology Standards Development \
Organisation (IHTSDO). All rights reserved. SNOMED CT®, was originally created by The College \
of American Pathologists. 'SNOMED' and 'SNOMED CT' are registered trademarks of the IHTSDO.";

/// An import that has not reported progress for this long is taken to have
/// died with its process (a restart mid-import) and is marked failed.
const STALE_MINUTES: i32 = 30;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SnomedRelease {
    pub id: Uuid,
    pub edition: String,
    pub version_date: NaiveDate,
    pub module_ids: Vec<String>,
    pub source: String,
    pub file_name: Option<String>,
    /// `queued` | `importing` | `closure` | `completed` | `failed`.
    pub status: String,
    pub phase: Option<String>,
    pub rows_processed: i64,
    pub concept_count: i64,
    pub description_count: i64,
    pub relationship_count: i64,
    pub refset_member_count: i64,
    pub closure_count: Option<i64>,
    pub skipped_files: Vec<String>,
    pub error: Option<String>,
    pub imported_by: Option<Uuid>,
    pub imported_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub imported_at: Option<DateTime<Utc>>,
}

const SELECT: &str = "SELECT r.id, r.edition, r.version_date, r.module_ids, r.source, \
        r.file_name, r.status, r.phase, r.rows_processed, r.concept_count, \
        r.description_count, r.relationship_count, r.refset_member_count, r.closure_count, \
        r.skipped_files, r.error, r.imported_by, r.imported_by_name, \
        r.created_at, r.started_at, r.imported_at \
   FROM snomed_release r";

/// Newest first. A deployment loads a handful of releases a year.
pub async fn list(pool: &PgPool) -> Result<Vec<SnomedRelease>, sqlx::Error> {
    sqlx::query_as::<_, SnomedRelease>(&format!("{SELECT} ORDER BY r.created_at DESC LIMIT 100"))
        .fetch_all(pool)
        .await
}

pub async fn get(pool: &PgPool, id: Uuid) -> Result<Option<SnomedRelease>, sqlx::Error> {
    sqlx::query_as::<_, SnomedRelease>(&format!("{SELECT} WHERE r.id = $1"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// The completed releases, newest first — what the store currently holds.
pub async fn loaded(pool: &PgPool) -> Result<Vec<SnomedRelease>, sqlx::Error> {
    sqlx::query_as::<_, SnomedRelease>(&format!(
        "{SELECT} WHERE r.status = 'completed' ORDER BY r.version_date DESC LIMIT 50"
    ))
    .fetch_all(pool)
    .await
}

pub async fn is_loaded(pool: &PgPool) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM snomed_release WHERE status = 'completed')")
        .fetch_one(pool)
        .await
}

/// What happened when a package was offered for import.
#[derive(Debug)]
pub enum Claim {
    /// A new (or previously failed) release row, now queued.
    Queued(SnomedRelease),
    /// This edition and date is already loaded; nothing to do.
    AlreadyImported(SnomedRelease),
    /// Another import is running; one at a time.
    Busy,
}

#[derive(Debug)]
pub struct ClaimInput<'a> {
    pub identity: &'a ReleaseIdentity,
    pub source: &'a str,
    pub file_name: &'a str,
    pub skipped: &'a [String],
    pub imported_by: Uuid,
    pub imported_by_name: &'a str,
}

/// Queue a release for import, idempotently: the same edition and date is
/// never loaded twice, a failed one is retried in place, and a second
/// concurrent import is refused (enforced by a partial unique index).
pub async fn claim(pool: &PgPool, input: &ClaimInput<'_>) -> Result<Claim, sqlx::Error> {
    sqlx::query(
        "UPDATE snomed_release SET status = 'failed', error = 'Interrupted: the server stopped \
         during the import. Start it again.', updated_at = now() \
         WHERE status IN ('queued', 'importing', 'closure') \
           AND updated_at < now() - make_interval(mins => $1)",
    )
    .bind(STALE_MINUTES)
    .execute(pool)
    .await?;

    let id: Result<Option<Uuid>, sqlx::Error> = sqlx::query_scalar(
        "INSERT INTO snomed_release (edition, version_date, source, file_name, skipped_files, \
                                     imported_by, imported_by_name, status) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued') \
         ON CONFLICT (edition, version_date) DO UPDATE \
            SET status = 'queued', source = EXCLUDED.source, file_name = EXCLUDED.file_name, \
                skipped_files = EXCLUDED.skipped_files, imported_by = EXCLUDED.imported_by, \
                imported_by_name = EXCLUDED.imported_by_name, error = NULL, phase = NULL, rows_processed = 0, updated_at = now() \
          WHERE snomed_release.status = 'failed' \
         RETURNING id",
    )
    .bind(&input.identity.edition)
    .bind(input.identity.version_date)
    .bind(input.source)
    .bind(input.file_name)
    .bind(input.skipped)
    .bind(input.imported_by)
    .bind(input.imported_by_name)
    .fetch_optional(pool)
    .await;

    let id = match id {
        Ok(id) => id,
        Err(sqlx::Error::Database(e)) if e.constraint() == Some("uq_snomed_release_one_active") => {
            return Ok(Claim::Busy);
        }
        Err(e) => return Err(e),
    };
    if let Some(id) = id {
        return get(pool, id)
            .await?
            .map(Claim::Queued)
            .ok_or(sqlx::Error::RowNotFound);
    }
    let existing = sqlx::query_as::<_, SnomedRelease>(&format!(
        "{SELECT} WHERE r.edition = $1 AND r.version_date = $2"
    ))
    .bind(&input.identity.edition)
    .bind(input.identity.version_date)
    .fetch_one(pool)
    .await?;
    Ok(if existing.status == "completed" {
        Claim::AlreadyImported(existing)
    } else {
        Claim::Busy
    })
}

pub async fn set_phase(
    pool: &PgPool,
    id: Uuid,
    status: &str,
    phase: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE snomed_release SET status = $2, phase = $3, updated_at = now(), \
                started_at = COALESCE(started_at, now()) WHERE id = $1",
    )
    .bind(id)
    .bind(status)
    .bind(phase)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn add_rows(pool: &PgPool, id: Uuid, rows: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE snomed_release SET rows_processed = rows_processed + $2, updated_at = now() \
         WHERE id = $1",
    )
    .bind(id)
    .bind(rows)
    .execute(pool)
    .await
    .map(|_| ())
}

/// Row counts loaded from this package, by component.
#[derive(Debug, Default, Clone, Copy)]
pub struct Counts {
    pub concepts: i64,
    pub descriptions: i64,
    pub relationships: i64,
    pub refset_members: i64,
}

pub async fn complete(
    pool: &PgPool,
    id: Uuid,
    counts: Counts,
    module_ids: &[String],
    closure_count: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE snomed_release SET status = 'completed', phase = NULL, error = NULL, \
                concept_count = $2, description_count = $3, relationship_count = $4, \
                refset_member_count = $5, module_ids = $6, closure_count = $7, \
                imported_at = now(), updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .bind(counts.concepts)
    .bind(counts.descriptions)
    .bind(counts.relationships)
    .bind(counts.refset_members)
    .bind(module_ids)
    .bind(closure_count)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn fail(pool: &PgPool, id: Uuid, error: &str) -> Result<(), sqlx::Error> {
    let error: String = error.chars().take(1000).collect();
    sqlx::query(
        "UPDATE snomed_release SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .bind(error)
    .execute(pool)
    .await
    .map(|_| ())
}
