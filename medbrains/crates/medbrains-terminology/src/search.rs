//! Term search over the description table.
//!
//! Ranking, best first: the whole term equals the query, then the term
//! starts with it, then it contains every word in order; within a band,
//! shorter terms first (a short term is the general concept, a long one a
//! qualified variant). One concept appears once, represented by its best
//! matching term. The trigram index answers the `ILIKE`; the candidate set
//! is cut to [`CANDIDATES`] before de-duplication so a common word cannot
//! make one search sort the whole table.

use serde::Serialize;
use sqlx::PgPool;

use crate::ids::{PREFERRED, SYNONYM};
use crate::sctid::parse_sctid;

/// Licence clause 2.2.4: no bulk extraction. No endpoint returns more.
pub const MAX_RESULTS: i64 = 50;
const CANDIDATES: i64 = 500;
/// Trigram search needs three characters to use its index.
pub const MIN_QUERY_CHARS: usize = 3;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SnomedConceptHit {
    /// SCTID as a string — it exceeds JavaScript's safe integer range.
    pub concept_id: String,
    /// In the requested language when the release has one, else English.
    pub preferred_term: Option<String>,
    pub fsn: Option<String>,
    pub semantic_tag: Option<String>,
    pub active: bool,
    /// The description that matched, when it differs from the preferred term.
    pub matched_term: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SearchParams {
    pub q: String,
    pub limit: i64,
    pub active_only: bool,
    pub semantic_tag: Option<String>,
    pub refset: Option<i64>,
    /// ISO 639-1 code; English is always searched too, as the fallback.
    pub lang: String,
}

/// `%` and `_` in the user's text are literal, not wildcards.
fn like_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        if matches!(ch, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

/// `heart attack` → `%heart%attack%`.
pub fn contains_pattern(q: &str) -> String {
    let words: Vec<String> = q.split_whitespace().map(like_escape).collect();
    format!("%{}%", words.join("%"))
}

const PREFERRED_IN_LANG: &str = "LEFT JOIN LATERAL ( \
        SELECT d2.term FROM snomed_description d2 \
          JOIN snomed_refset_member m2 ON m2.referenced_component_id = d2.id \
               AND m2.active AND m2.acceptability_id = $PREF \
         WHERE d2.concept_id = c.id AND d2.active AND d2.type_id = $SYN \
           AND d2.language_code = $LANG AND $LANG <> 'en' \
         ORDER BY d2.id LIMIT 1) lp ON true";

fn preferred_in_lang(pref: u8, syn: u8, lang: u8) -> String {
    PREFERRED_IN_LANG
        .replace("$PREF", &format!("${pref}"))
        .replace("$SYN", &format!("${syn}"))
        .replace("$LANG", &format!("${lang}"))
}

pub async fn search(pool: &PgPool, p: &SearchParams) -> Result<Vec<SnomedConceptHit>, sqlx::Error> {
    let q = p.q.trim();
    let limit = p.limit.clamp(1, MAX_RESULTS);
    if let Some(id) = parse_sctid(q) {
        return by_id(pool, id, &p.lang).await;
    }
    if q.chars().count() < MIN_QUERY_CHARS {
        return Ok(Vec::new());
    }
    let sql = format!(
        "WITH hits AS ( \
            SELECT d.concept_id, d.term, \
                   CASE WHEN lower(d.term) = lower($1) THEN 0 \
                        WHEN d.term ILIKE $2 THEN 1 ELSE 2 END AS band \
              FROM snomed_description d \
              JOIN snomed_concept c ON c.id = d.concept_id \
             WHERE d.term ILIKE $3 \
               AND d.language_code IN ($4, 'en') \
               AND (NOT $5 OR (d.active AND c.active)) \
               AND ($6::text IS NULL OR c.semantic_tag = $6) \
               AND ($7::bigint IS NULL OR EXISTS ( \
                    SELECT 1 FROM snomed_refset_member m \
                     WHERE m.refset_id = $7 AND m.referenced_component_id = c.id AND m.active)) \
             ORDER BY band, length(d.term) \
             LIMIT {CANDIDATES}), \
         best AS ( \
            SELECT DISTINCT ON (concept_id) concept_id, term, band FROM hits \
             ORDER BY concept_id, band, length(term)) \
         SELECT c.id::text AS concept_id, \
                COALESCE(lp.term, c.preferred_term, c.fsn) AS preferred_term, \
                c.fsn, c.semantic_tag, c.active, \
                NULLIF(b.term, COALESCE(lp.term, c.preferred_term)) AS matched_term \
           FROM best b JOIN snomed_concept c ON c.id = b.concept_id \
           {lateral} \
          ORDER BY b.band, length(b.term), c.id \
          LIMIT $8",
        lateral = preferred_in_lang(9, 10, 4),
    );
    sqlx::query_as::<_, SnomedConceptHit>(&sql)
        .bind(q)
        .bind(format!("{}%", like_escape(q)))
        .bind(contains_pattern(q))
        .bind(&p.lang)
        .bind(p.active_only)
        .bind(p.semantic_tag.as_deref())
        .bind(p.refset)
        .bind(limit)
        .bind(PREFERRED)
        .bind(SYNONYM)
        .fetch_all(pool)
        .await
}

/// A typed or pasted SCTID finds its concept directly.
async fn by_id(pool: &PgPool, id: i64, lang: &str) -> Result<Vec<SnomedConceptHit>, sqlx::Error> {
    let sql = format!(
        "SELECT c.id::text AS concept_id, COALESCE(lp.term, c.preferred_term, c.fsn) AS preferred_term, \
                c.fsn, c.semantic_tag, c.active, NULL::text AS matched_term \
           FROM snomed_concept c {lateral} WHERE c.id = $1",
        lateral = preferred_in_lang(3, 4, 2),
    );
    sqlx::query_as::<_, SnomedConceptHit>(&sql)
        .bind(id)
        .bind(lang)
        .bind(PREFERRED)
        .bind(SYNONYM)
        .fetch_all(pool)
        .await
}

/// `sub` is `sup` or one of its descendants (`sub << sup`).
pub async fn is_a(pool: &PgPool, sub: i64, sup: i64) -> Result<bool, sqlx::Error> {
    if sub == sup {
        return Ok(true);
    }
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM snomed_transitive_closure \
                         WHERE subtype_id = $1 AND supertype_id = $2)",
    )
    .bind(sub)
    .bind(sup)
    .fetch_one(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::{contains_pattern, like_escape};

    #[test]
    fn user_text_cannot_inject_wildcards() {
        assert_eq!(like_escape("50%_x\\"), "50\\%\\_x\\\\");
        assert_eq!(contains_pattern("  heart   attack "), "%heart%attack%");
    }
}
