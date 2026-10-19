//! Ranked test search for every picker that orders a lab test.
//!
//! One query, bounded. Exact code / LOINC / short name first, then a prefix
//! of the code or name, then a word or synonym prefix ("sugar" → Fasting
//! Blood Sugar), then anything containing the term, then a fuzzy name match
//! for typos. Retired tests are never offered.

use medbrains_core::lab::LabTestCatalog;
use uuid::Uuid;

/// Most rows a picker is ever sent.
pub(crate) const SEARCH_LIMIT_MAX: i64 = 50;
const SEARCH_LIMIT_DEFAULT: i64 = 25;

// ponytail: sequential scan over one tenant's catalogue — a few hundred to a
// few thousand rows. Add a trigram index on lower(name) if it ever grows past that.
const SEARCH_SQL: &str = "\
WITH p AS ( \
  SELECT lower(btrim($2)) AS q, \
         replace(replace(replace(lower(btrim($2)), '\\', '\\\\'), '%', '\\%'), '_', '\\_') AS e \
) \
SELECT c.* FROM lab_test_catalog c, p \
WHERE c.tenant_id = $1 AND c.deleted_at IS NULL AND c.is_active \
  AND ( lower(c.code) LIKE '%' || p.e || '%' \
     OR lower(c.name) LIKE '%' || p.e || '%' \
     OR lower(c.loinc_code) = p.q \
     OR EXISTS (SELECT 1 FROM unnest(c.synonyms) s WHERE lower(s) LIKE p.e || '%') \
     OR (length(p.q) >= 4 AND word_similarity(p.q, lower(c.name)) > 0.5) ) \
ORDER BY \
  CASE \
    WHEN lower(c.code) = p.q OR lower(c.loinc_code) = p.q \
      OR EXISTS (SELECT 1 FROM unnest(c.synonyms) s WHERE lower(s) = p.q) THEN 0 \
    WHEN lower(c.code) LIKE p.e || '%' OR lower(c.name) LIKE p.e || '%' THEN 1 \
    WHEN ' ' || regexp_replace(lower(c.name), '[^a-z0-9]+', ' ', 'g') LIKE '% ' || p.e || '%' \
      OR EXISTS (SELECT 1 FROM unnest(c.synonyms) s WHERE lower(s) LIKE p.e || '%') THEN 2 \
    WHEN lower(c.code) LIKE '%' || p.e || '%' OR lower(c.name) LIKE '%' || p.e || '%' THEN 3 \
    ELSE 4 \
  END, \
  length(c.name), c.name \
LIMIT $3";

/// Clamp a requested page size to what a picker may be sent.
pub(crate) fn search_limit(requested: Option<i64>) -> i64 {
    requested.map_or(SEARCH_LIMIT_DEFAULT, |n| n.clamp(1, SEARCH_LIMIT_MAX))
}

pub(crate) async fn search_catalog(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    term: &str,
    limit: i64,
) -> Result<Vec<LabTestCatalog>, sqlx::Error> {
    sqlx::query_as::<_, LabTestCatalog>(SEARCH_SQL)
        .bind(tenant_id)
        .bind(term)
        .bind(limit)
        .fetch_all(&mut **tx)
        .await
}

#[cfg(test)]
mod tests {
    use super::{SEARCH_LIMIT_MAX, search_limit};

    #[test]
    fn page_size_is_clamped() {
        assert_eq!(search_limit(None), 25);
        assert_eq!(search_limit(Some(0)), 1);
        assert_eq!(search_limit(Some(10_000)), SEARCH_LIMIT_MAX);
    }
}
