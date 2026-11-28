//! The drug-drug interactions among a patient's active drugs, in one query.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

/// One interacting pair of a patient's active drugs, in the order the
/// drugs were listed, with the interaction that names them.
#[derive(Debug, sqlx::FromRow)]
pub(super) struct InteractingPair {
    pub(super) drug_a: String,
    pub(super) drug_b: String,
    pub(super) id: Uuid,
    pub(super) severity: String,
    pub(super) description: Option<String>,
    pub(super) management: Option<String>,
}

/// Every pair of `names` that `drug_interactions` lists (either way round,
/// case-insensitively), one interaction per pair, in one query. It was one
/// query per pair: 190 round trips for a patient on 20 drugs, inside the
/// request's transaction.
pub(super) async fn interacting_pairs(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    names: &[&str],
) -> Result<Vec<InteractingPair>, AppError> {
    if names.len() < 2 {
        return Ok(Vec::new());
    }
    Ok(sqlx::query_as::<_, InteractingPair>(
        "WITH d AS (SELECT name, lower(name) AS key, ord \
                      FROM unnest($1::text[]) WITH ORDINALITY AS d(name, ord)), \
              di AS (SELECT id, lower(drug_a_name) AS a, lower(drug_b_name) AS b, \
                            severity, description, management \
                       FROM drug_interactions \
                      WHERE deleted_at IS NULL \
                        AND (lower(drug_a_name) IN (SELECT key FROM d) \
                             OR lower(drug_b_name) IN (SELECT key FROM d))) \
         SELECT DISTINCT ON (x.ord, y.ord) x.name AS drug_a, y.name AS drug_b, \
                di.id, di.severity, di.description, di.management \
           FROM d x JOIN d y ON x.ord < y.ord \
           JOIN di ON (di.a = x.key AND di.b = y.key) OR (di.a = y.key AND di.b = x.key) \
          ORDER BY x.ord, y.ord, di.id",
    )
    .bind(names)
    .fetch_all(&mut **tx)
    .await?)
}
