//! Counting a hospital's coded records by SNOMED CT hierarchy.
//!
//! "How many diagnoses are diabetes?" means the concept *or any of its
//! descendants* — type 2, gestational, with complications. That is one join
//! to the closure table, an index probe per coded record, never a recursive
//! walk per row.
//!
//! The coded records are `diagnoses.snomed_code`. A diagnosis coded only in
//! ICD-10/11 is out of scope: it would need an ICD↔SNOMED map refset, which
//! the store does not load yet. The counts say how many such records exist so
//! the gap is visible, not silent.
//!
//! Every query runs inside the caller's tenant-scoped transaction: the
//! diagnoses are RLS-protected; the terminology tables are shared.

use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::ids::{INFERRED, IS_A};

/// Every live diagnosis of the tenant with a well-formed SNOMED code, and the
/// patient it belongs to. A malformed code is NULL rather than a cast error.
const CODED: &str = "coded AS ( \
    SELECT d.id, e.patient_id, \
           CASE WHEN d.snomed_code ~ '^[1-9][0-9]{5,17}$' THEN d.snomed_code::bigint END AS sctid \
      FROM diagnoses d JOIN encounters e ON e.id = d.encounter_id \
     WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
       AND d.snomed_code IS NOT NULL)";

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SnomedConceptCount {
    pub concept_id: String,
    /// Diagnoses coded with the concept or a descendant.
    pub records: i64,
    /// Distinct patients among them.
    pub patients: i64,
    /// All diagnoses carrying any SNOMED code.
    pub coded_records: i64,
    /// SNOMED-coded diagnoses whose code is not in the loaded release.
    pub unknown_codes: i64,
    /// Diagnoses with an ICD code and no SNOMED code — not counted above.
    pub icd_only_records: i64,
}

pub async fn count_under(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    concept: i64,
) -> Result<SnomedConceptCount, sqlx::Error> {
    sqlx::query_as::<_, SnomedConceptCount>(&format!(
        "WITH {CODED}, \
         flagged AS ( \
            SELECT c.id, c.patient_id, \
                   (c.sctid = $2 OR EXISTS (SELECT 1 FROM snomed_transitive_closure t \
                                             WHERE t.subtype_id = c.sctid AND t.supertype_id = $2)) AS hit, \
                   NOT EXISTS (SELECT 1 FROM snomed_concept k WHERE k.id = c.sctid) AS unknown \
              FROM coded c) \
         SELECT $2::text AS concept_id, \
                count(*) FILTER (WHERE hit) AS records, \
                count(DISTINCT patient_id) FILTER (WHERE hit) AS patients, \
                count(*) AS coded_records, \
                count(*) FILTER (WHERE unknown) AS unknown_codes, \
                (SELECT count(*) FROM diagnoses d \
                  WHERE d.tenant_id = $1 AND d.deleted_at IS NULL \
                    AND d.snomed_code IS NULL AND d.icd_code IS NOT NULL) AS icd_only_records \
           FROM flagged"
    ))
    .bind(tenant_id)
    .bind(concept)
    .fetch_one(&mut **tx)
    .await
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SnomedRollupRow {
    pub concept_id: String,
    pub preferred_term: Option<String>,
    pub semantic_tag: Option<String>,
    pub records: i64,
    pub patients: i64,
}

/// The children of `parent` (the root gives the top-level categories), each
/// with the records coded at or below it. A record under two categories
/// (polyhierarchy) counts in both; within one category it counts once.
/// Children with no records are left out. At most 200 categories.
pub async fn rollup(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    parent: i64,
) -> Result<Vec<SnomedRollupRow>, sqlx::Error> {
    sqlx::query_as::<_, SnomedRollupRow>(&format!(
        "WITH {CODED}, \
         children AS ( \
            SELECT r.source_id AS id FROM snomed_relationship r \
             WHERE r.destination_id = $2 AND r.type_id = $3 AND r.characteristic_type_id = $4 \
               AND r.active \
             LIMIT 200), \
         hits AS ( \
            SELECT ch.id AS category_id, c.id, c.patient_id \
              FROM coded c JOIN children ch ON ch.id = c.sctid \
            UNION \
            SELECT ch.id, c.id, c.patient_id \
              FROM coded c \
              JOIN snomed_transitive_closure t ON t.subtype_id = c.sctid \
              JOIN children ch ON ch.id = t.supertype_id) \
         SELECT k.id::text AS concept_id, k.preferred_term, k.semantic_tag, \
                count(*) AS records, count(DISTINCT h.patient_id) AS patients \
           FROM hits h JOIN snomed_concept k ON k.id = h.category_id \
          GROUP BY k.id, k.preferred_term, k.semantic_tag \
          ORDER BY records DESC, k.preferred_term"
    ))
    .bind(tenant_id)
    .bind(parent)
    .bind(IS_A)
    .bind(INFERRED)
    .fetch_all(&mut **tx)
    .await
}
