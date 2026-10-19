//! Post-load derivations, all set-based and run once per import — never per
//! query:
//! * each concept's FSN, semantic tag and English preferred term;
//! * the transitive closure of active inferred IS-A relationships.

use sqlx::PgPool;

use crate::ids::{FSN, GB_ENGLISH, INFERRED, IS_A, PREFERRED, SYNONYM, US_ENGLISH};

/// SNOMED CT's deepest chain is ~30 levels. Hitting this bound means a
/// cycle in IS-A — a malformed release — and the import fails rather than
/// looping.
const MAX_DEPTH: u32 = 64;

#[derive(Debug, thiserror::Error)]
pub enum ClosureError {
    #[error("the IS-A hierarchy is deeper than {MAX_DEPTH} levels — the release looks malformed")]
    TooDeep,
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
}

/// Fill `fsn`, `semantic_tag` and `preferred_term` on every concept. The
/// English preferred term prefers the US English language refset, then GB,
/// then any other English one (an extension's own); with none, the FSN
/// without its tag.
pub async fn derive_concept_terms(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE snomed_concept c \
            SET fsn = f.term, \
                semantic_tag = substring(f.term from '\\(([^()]+)\\)\\s*$') \
           FROM (SELECT DISTINCT ON (concept_id) concept_id, term \
                   FROM snomed_description \
                  WHERE active AND type_id = $1 \
                  ORDER BY concept_id, (language_code = 'en') DESC, effective_time DESC) f \
          WHERE f.concept_id = c.id AND c.fsn IS DISTINCT FROM f.term",
    )
    .bind(FSN)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE snomed_concept c SET preferred_term = p.term \
           FROM (SELECT DISTINCT ON (d.concept_id) d.concept_id, d.term \
                   FROM snomed_description d \
                   JOIN snomed_refset_member m \
                     ON m.referenced_component_id = d.id AND m.active AND m.acceptability_id = $2 \
                  WHERE d.active AND d.type_id = $1 AND d.language_code = 'en' \
                  ORDER BY d.concept_id, (m.refset_id = $3) DESC, (m.refset_id = $4) DESC, \
                           m.refset_id) p \
          WHERE p.concept_id = c.id AND c.preferred_term IS DISTINCT FROM p.term",
    )
    .bind(SYNONYM)
    .bind(PREFERRED)
    .bind(US_ENGLISH)
    .bind(GB_ENGLISH)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE snomed_concept SET preferred_term = regexp_replace(fsn, '\\s*\\([^()]+\\)\\s*$', '') \
          WHERE preferred_term IS NULL AND fsn IS NOT NULL",
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}

/// Rebuild the closure from scratch, semi-naively: start from the direct
/// IS-A edges, then repeatedly extend only the pairs found in the previous
/// round by one more edge, until a round adds nothing. Each round is one
/// set-based statement; the loop is bounded by [`MAX_DEPTH`].
///
/// Runs in one transaction, so searches keep reading the previous closure
/// until the new one is complete. Returns the number of pairs.
pub async fn rebuild_closure(pool: &PgPool) -> Result<i64, ClosureError> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM snomed_transitive_closure")
        .execute(&mut *tx)
        .await?;
    // Parameters cannot go into CREATE TABLE AS, so the temp tables are
    // declared first and filled by plain INSERTs.
    sqlx::raw_sql(
        "CREATE TEMP TABLE snomed_isa (sub bigint NOT NULL, sup bigint NOT NULL) ON COMMIT DROP; \
         CREATE TEMP TABLE snomed_delta (subtype_id bigint, supertype_id bigint) ON COMMIT DROP; \
         CREATE TEMP TABLE snomed_delta_next (subtype_id bigint, supertype_id bigint) \
             ON COMMIT DROP",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO snomed_isa (sub, sup) \
         SELECT DISTINCT source_id, destination_id FROM snomed_relationship \
          WHERE active AND type_id = $1 AND characteristic_type_id = $2 \
            AND source_id <> destination_id",
    )
    .bind(IS_A)
    .bind(INFERRED)
    .execute(&mut *tx)
    .await?;
    sqlx::query("CREATE INDEX ON snomed_isa (sub)")
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO snomed_delta SELECT sub, sup FROM snomed_isa")
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO snomed_transitive_closure (subtype_id, supertype_id) \
         SELECT subtype_id, supertype_id FROM snomed_delta",
    )
    .execute(&mut *tx)
    .await?;

    let mut depth = 0;
    loop {
        let added = sqlx::query(
            "WITH ins AS ( \
                INSERT INTO snomed_transitive_closure (subtype_id, supertype_id) \
                SELECT DISTINCT d.subtype_id, i.sup FROM snomed_delta d \
                  JOIN snomed_isa i ON i.sub = d.supertype_id \
                 WHERE d.subtype_id <> i.sup \
                ON CONFLICT DO NOTHING \
                RETURNING subtype_id, supertype_id) \
             INSERT INTO snomed_delta_next SELECT subtype_id, supertype_id FROM ins",
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if added == 0 {
            break;
        }
        depth += 1;
        if depth >= MAX_DEPTH {
            return Err(ClosureError::TooDeep);
        }
        sqlx::query("TRUNCATE snomed_delta")
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO snomed_delta SELECT * FROM snomed_delta_next")
            .execute(&mut *tx)
            .await?;
        sqlx::query("TRUNCATE snomed_delta_next")
            .execute(&mut *tx)
            .await?;
    }
    let pairs: i64 = sqlx::query_scalar("SELECT count(*) FROM snomed_transitive_closure")
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(pairs)
}
