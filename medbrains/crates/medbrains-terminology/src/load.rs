//! Stream one RF2 Snapshot file into its table.
//!
//! Memory stays flat whatever the file size: lines are read one at a time
//! (each capped at [`MAX_LINE`]), validated, and sent to a `COPY` in 1 MiB
//! chunks. The copy lands in a temporary staging table, and one set-based
//! upsert moves it into place — newer `effectiveTime` wins, so loading the
//! same package twice, or an extension over its edition, is idempotent.

use std::collections::BTreeSet;
use std::path::Path;

use sqlx::PgPool;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use uuid::Uuid;

use crate::release;
use crate::rf2::{Rf2Error, Rf2Kind, check_header, push_copy_row};

/// RF2 terms are at most 4,096 characters; a longer line is not RF2.
const MAX_LINE: u64 = 64 * 1024;
const CHUNK_BYTES: usize = 1024 * 1024;
const PROGRESS_EVERY: u64 = 50_000;

#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("{file}: {source}")]
    Rf2 { file: String, source: Rf2Error },
    #[error("{file}: line {line} is longer than {MAX_LINE} bytes")]
    LineTooLong { file: String, line: u64 },
    #[error("{file}: the file is empty")]
    Empty { file: String },
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
}

struct Target {
    table: &'static str,
    columns: &'static str,
    updates: &'static str,
}

const fn target(kind: Rf2Kind) -> Target {
    match kind {
        Rf2Kind::Concept => Target {
            table: "snomed_concept",
            columns: "id, effective_time, active, module_id, definition_status_id",
            updates: "effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, \
                      module_id = EXCLUDED.module_id, \
                      definition_status_id = EXCLUDED.definition_status_id",
        },
        Rf2Kind::Description => Target {
            table: "snomed_description",
            columns: "id, effective_time, active, module_id, concept_id, language_code, type_id, \
                      term, case_significance_id",
            updates: "effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, \
                      module_id = EXCLUDED.module_id, concept_id = EXCLUDED.concept_id, \
                      language_code = EXCLUDED.language_code, type_id = EXCLUDED.type_id, \
                      term = EXCLUDED.term, case_significance_id = EXCLUDED.case_significance_id",
        },
        Rf2Kind::Relationship => Target {
            table: "snomed_relationship",
            columns: "id, effective_time, active, module_id, source_id, destination_id, \
                      relationship_group, type_id, characteristic_type_id, modifier_id",
            updates: "effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, \
                      module_id = EXCLUDED.module_id, source_id = EXCLUDED.source_id, \
                      destination_id = EXCLUDED.destination_id, \
                      relationship_group = EXCLUDED.relationship_group, \
                      type_id = EXCLUDED.type_id, \
                      characteristic_type_id = EXCLUDED.characteristic_type_id, \
                      modifier_id = EXCLUDED.modifier_id",
        },
        Rf2Kind::SimpleRefset => Target {
            table: "snomed_refset_member",
            columns: "id, effective_time, active, module_id, refset_id, referenced_component_id",
            updates: "effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, \
                      module_id = EXCLUDED.module_id, refset_id = EXCLUDED.refset_id, \
                      referenced_component_id = EXCLUDED.referenced_component_id",
        },
        Rf2Kind::LanguageRefset => Target {
            table: "snomed_refset_member",
            columns: "id, effective_time, active, module_id, refset_id, referenced_component_id, \
                      acceptability_id",
            updates: "effective_time = EXCLUDED.effective_time, active = EXCLUDED.active, \
                      module_id = EXCLUDED.module_id, refset_id = EXCLUDED.refset_id, \
                      referenced_component_id = EXCLUDED.referenced_component_id, \
                      acceptability_id = EXCLUDED.acceptability_id",
        },
    }
}

/// Load `path` as `kind`. Returns the data rows read; adds every `moduleId`
/// seen to `modules`.
pub async fn load_file(
    pool: &PgPool,
    release_id: Uuid,
    kind: Rf2Kind,
    path: &Path,
    modules: &mut BTreeSet<String>,
) -> Result<u64, LoadError> {
    let file = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_owned();
    let mut reader = BufReader::new(tokio::fs::File::open(path).await?);
    let t = target(kind);

    let mut tx = pool.begin().await?;
    sqlx::query(&format!(
        "CREATE TEMP TABLE snomed_stage (LIKE {} INCLUDING DEFAULTS) ON COMMIT DROP",
        t.table
    ))
    .execute(&mut *tx)
    .await?;
    let mut copy = tx
        .copy_in_raw(&format!("COPY snomed_stage ({}) FROM STDIN", t.columns))
        .await?;

    let mut line = String::new();
    let mut chunk = String::with_capacity(CHUNK_BYTES + MAX_LINE as usize);
    let mut line_no = 0u64;
    let mut rows = 0u64;
    loop {
        line.clear();
        let read = (&mut reader)
            .take(MAX_LINE + 1)
            .read_line(&mut line)
            .await?;
        if read == 0 {
            break;
        }
        line_no += 1;
        if read as u64 > MAX_LINE {
            return Err(LoadError::LineTooLong {
                file,
                line: line_no,
            });
        }
        if line_no == 1 {
            check_header(kind, &line).map_err(|source| LoadError::Rf2 {
                file: file.clone(),
                source,
            })?;
            continue;
        }
        if line.trim().is_empty() {
            continue;
        }
        let module =
            push_copy_row(kind, line_no, &line, &mut chunk).map_err(|source| LoadError::Rf2 {
                file: file.clone(),
                source,
            })?;
        if !modules.contains(module) {
            modules.insert(module.to_owned());
        }
        rows += 1;
        if chunk.len() >= CHUNK_BYTES {
            copy.send(chunk.as_bytes()).await?;
            chunk.clear();
        }
        if rows % PROGRESS_EVERY == 0 {
            release::add_rows(pool, release_id, PROGRESS_EVERY as i64).await?;
        }
    }
    if line_no == 0 {
        return Err(LoadError::Empty { file });
    }
    if !chunk.is_empty() {
        copy.send(chunk.as_bytes()).await?;
    }
    copy.finish().await?;

    sqlx::query(&format!(
        "INSERT INTO {table} ({cols}) \
         SELECT DISTINCT ON (id) {cols} FROM snomed_stage ORDER BY id, effective_time DESC \
         ON CONFLICT (id) DO UPDATE SET {updates} \
         WHERE {table}.effective_time <= EXCLUDED.effective_time",
        table = t.table,
        cols = t.columns,
        updates = t.updates,
    ))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    release::add_rows(pool, release_id, (rows % PROGRESS_EVERY) as i64).await?;
    Ok(rows)
}
