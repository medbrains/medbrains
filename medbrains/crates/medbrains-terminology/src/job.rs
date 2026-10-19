//! Running an import: extract, load each file, derive terms, rebuild the
//! closure, record the outcome. Runs as a background task; every step
//! reports progress on the release row, which is what the screen polls.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use sqlx::PgPool;
use uuid::Uuid;

use crate::closure::{derive_concept_terms, rebuild_closure};
use crate::load::load_file;
use crate::package::{PackageLayout, extract};
use crate::release::{self, Counts};
use crate::rf2::Rf2Kind;

/// Where a package's files are unpacked while it imports.
pub fn work_dir(release_id: Uuid) -> PathBuf {
    std::env::temp_dir()
        .join("medbrains-snomed")
        .join(release_id.to_string())
}

/// A package queued for import.
#[derive(Debug)]
pub struct ImportJob {
    pub release_id: Uuid,
    pub zip_path: PathBuf,
    pub layout: PackageLayout,
    /// Delete the zip afterwards (an upload's temp file — never a file from
    /// the operator's import directory).
    pub remove_zip: bool,
    pub max_unpacked_bytes: u64,
}

/// Run the job to completion, recording failure on the release row. Never
/// panics and never returns an error: there is nobody to return it to.
pub async fn run(pool: &PgPool, job: &ImportJob) {
    let dir = work_dir(job.release_id);
    let outcome = import(pool, job, &dir).await;
    if let Err(error) = outcome {
        tracing::warn!(release_id = %job.release_id, %error, "SNOMED CT import failed");
        if let Err(e) = release::fail(pool, job.release_id, &error).await {
            tracing::error!(release_id = %job.release_id, error = %e, "could not record import failure");
        }
    }
    if let Err(e) = tokio::fs::remove_dir_all(&dir).await {
        tracing::debug!(error = %e, "SNOMED CT work dir already gone");
    }
    if job.remove_zip {
        if let Err(e) = tokio::fs::remove_file(&job.zip_path).await {
            tracing::warn!(error = %e, "could not remove uploaded SNOMED CT package");
        }
    }
}

async fn import(pool: &PgPool, job: &ImportJob, dir: &Path) -> Result<(), String> {
    let id = job.release_id;
    release::set_phase(pool, id, "importing", "Unpacking the release")
        .await
        .map_err(|e| e.to_string())?;
    let (zip, layout, dest, limit) = (
        job.zip_path.clone(),
        job.layout.clone(),
        dir.to_path_buf(),
        job.max_unpacked_bytes,
    );
    let files = tokio::task::spawn_blocking(move || extract(&zip, &layout, &dest, limit))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let mut counts = Counts::default();
    let mut modules = BTreeSet::new();
    for (path, kind) in &files {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        release::set_phase(pool, id, "importing", &format!("Loading {name}"))
            .await
            .map_err(|e| e.to_string())?;
        let rows = load_file(pool, id, *kind, path, &mut modules)
            .await
            .map_err(|e| e.to_string())? as i64;
        match kind {
            Rf2Kind::Concept => counts.concepts += rows,
            Rf2Kind::Description => counts.descriptions += rows,
            Rf2Kind::Relationship => counts.relationships += rows,
            Rf2Kind::SimpleRefset | Rf2Kind::LanguageRefset => counts.refset_members += rows,
        }
    }

    release::set_phase(pool, id, "closure", "Deriving preferred terms")
        .await
        .map_err(|e| e.to_string())?;
    derive_concept_terms(pool)
        .await
        .map_err(|e| e.to_string())?;
    release::set_phase(pool, id, "closure", "Computing the IS-A transitive closure")
        .await
        .map_err(|e| e.to_string())?;
    let pairs = rebuild_closure(pool).await.map_err(|e| e.to_string())?;
    let modules: Vec<String> = modules.into_iter().collect();
    release::complete(pool, id, counts, &modules, pairs)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!(release_id = %id, pairs, "SNOMED CT release imported");
    Ok(())
}
