//! One concept in full, and bounded walks up and down its hierarchy.

use chrono::NaiveDate;
use serde::Serialize;
use sqlx::PgPool;

use crate::ids::{ACCEPTABLE, DEFINED, FSN, INFERRED, IS_A, PREFERRED};
use crate::search::MAX_RESULTS;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SnomedConceptSummary {
    pub concept_id: String,
    pub preferred_term: Option<String>,
    pub semantic_tag: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SnomedDescriptionRow {
    pub description_id: String,
    pub term: String,
    pub language_code: String,
    /// `fsn` | `synonym`.
    pub description_type: String,
    /// `preferred` | `acceptable` in some language refset, else absent.
    pub acceptability: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct ConceptRow {
    concept_id: String,
    active: bool,
    effective_time: NaiveDate,
    module_id: String,
    fully_defined: bool,
    fsn: Option<String>,
    preferred_term: Option<String>,
    semantic_tag: Option<String>,
    children_count: i64,
    descendant_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SnomedConceptDetail {
    pub concept_id: String,
    pub active: bool,
    pub effective_time: NaiveDate,
    pub module_id: String,
    pub fully_defined: bool,
    pub fsn: Option<String>,
    pub preferred_term: Option<String>,
    pub semantic_tag: Option<String>,
    pub descriptions: Vec<SnomedDescriptionRow>,
    pub parents: Vec<SnomedConceptSummary>,
    pub children: Vec<SnomedConceptSummary>,
    pub children_count: i64,
    pub descendant_count: i64,
}

const SUMMARY: &str = "c.id::text AS concept_id, c.preferred_term, c.semantic_tag, c.active";

pub async fn detail(pool: &PgPool, id: i64) -> Result<Option<SnomedConceptDetail>, sqlx::Error> {
    let row = sqlx::query_as::<_, ConceptRow>(
        "SELECT c.id::text AS concept_id, c.active, c.effective_time, c.module_id::text AS module_id, \
                c.definition_status_id = $2 AS fully_defined, c.fsn, c.preferred_term, c.semantic_tag, \
                (SELECT count(*) FROM snomed_relationship r \
                  WHERE r.destination_id = c.id AND r.type_id = $3 AND r.active \
                    AND r.characteristic_type_id = $4) AS children_count, \
                (SELECT count(*) FROM snomed_transitive_closure t \
                  WHERE t.supertype_id = c.id) AS descendant_count \
           FROM snomed_concept c WHERE c.id = $1",
    )
    .bind(id)
    .bind(DEFINED)
    .bind(IS_A)
    .bind(INFERRED)
    .fetch_optional(pool)
    .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let descriptions = sqlx::query_as::<_, SnomedDescriptionRow>(
        "SELECT d.id::text AS description_id, d.term, d.language_code, \
                CASE WHEN d.type_id = $2 THEN 'fsn' ELSE 'synonym' END AS description_type, \
                CASE WHEN bool_or(m.acceptability_id = $3) THEN 'preferred' \
                     WHEN bool_or(m.acceptability_id = $4) THEN 'acceptable' END AS acceptability \
           FROM snomed_description d \
           LEFT JOIN snomed_refset_member m ON m.referenced_component_id = d.id AND m.active \
          WHERE d.concept_id = $1 AND d.active \
          GROUP BY d.id, d.term, d.language_code, d.type_id \
          ORDER BY (d.type_id = $2) DESC, d.language_code, d.term \
          LIMIT 100",
    )
    .bind(id)
    .bind(FSN)
    .bind(PREFERRED)
    .bind(ACCEPTABLE)
    .fetch_all(pool)
    .await?;
    let parents = neighbours(pool, id, Direction::Up).await?;
    let children = neighbours(pool, id, Direction::Down).await?;
    Ok(Some(SnomedConceptDetail {
        concept_id: row.concept_id,
        active: row.active,
        effective_time: row.effective_time,
        module_id: row.module_id,
        fully_defined: row.fully_defined,
        fsn: row.fsn,
        preferred_term: row.preferred_term,
        semantic_tag: row.semantic_tag,
        descriptions,
        parents,
        children,
        children_count: row.children_count,
        descendant_count: row.descendant_count,
    }))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    /// Parents / ancestors.
    Up,
    /// Children / descendants.
    Down,
}

/// Direct parents or children over active inferred IS-A, at most
/// [`MAX_RESULTS`].
async fn neighbours(
    pool: &PgPool,
    id: i64,
    direction: Direction,
) -> Result<Vec<SnomedConceptSummary>, sqlx::Error> {
    let (from, to) = match direction {
        Direction::Up => ("source_id", "destination_id"),
        Direction::Down => ("destination_id", "source_id"),
    };
    sqlx::query_as::<_, SnomedConceptSummary>(&format!(
        "SELECT {SUMMARY} FROM snomed_relationship r JOIN snomed_concept c ON c.id = r.{to} \
          WHERE r.{from} = $1 AND r.type_id = $2 AND r.characteristic_type_id = $3 AND r.active \
          ORDER BY c.preferred_term LIMIT $4"
    ))
    .bind(id)
    .bind(IS_A)
    .bind(INFERRED)
    .bind(MAX_RESULTS)
    .fetch_all(pool)
    .await
}

/// All ancestors or descendants (transitively), at most `limit` (capped at
/// [`MAX_RESULTS`]), with the full count so a screen can say "50 of 1,204".
pub async fn walk(
    pool: &PgPool,
    id: i64,
    direction: Direction,
    limit: i64,
) -> Result<(Vec<SnomedConceptSummary>, i64), sqlx::Error> {
    let (key, other) = match direction {
        Direction::Up => ("subtype_id", "supertype_id"),
        Direction::Down => ("supertype_id", "subtype_id"),
    };
    let rows = sqlx::query_as::<_, SnomedConceptSummary>(&format!(
        "SELECT {SUMMARY} FROM snomed_transitive_closure t JOIN snomed_concept c ON c.id = t.{other} \
          WHERE t.{key} = $1 ORDER BY c.preferred_term LIMIT $2"
    ))
    .bind(id)
    .bind(limit.clamp(1, MAX_RESULTS))
    .fetch_all(pool)
    .await?;
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM snomed_transitive_closure WHERE {key} = $1"
    ))
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok((rows, total))
}
