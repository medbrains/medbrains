//! `bulk_check`'s grouping: a mixed list becomes one [`reachable`] query per
//! (kind, relation), the same query `check` runs for one record, so a list is
//! answered by exactly the rules that answer the record it lists (rule 10).

use std::collections::HashMap;

use uuid::Uuid;

use super::reachable;
use crate::{AuthzContext, AuthzError, relations::Relation};

/// [`reachable`] for a mixed list of `(kind, relation, id)`: one query per
/// (kind, relation) pair, all in the caller's transaction.
pub(super) async fn reachable_all(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ctx: &AuthzContext,
    items: &[(String, Relation, Uuid)],
) -> Result<HashMap<(String, Relation, Uuid), bool>, AuthzError> {
    let mut groups: HashMap<(&str, Relation), Vec<Uuid>> = HashMap::new();
    for (kind, relation, id) in items {
        groups
            .entry((kind.as_str(), *relation))
            .or_default()
            .push(*id);
    }
    let mut answers = HashMap::with_capacity(items.len());
    // ponytail: one query per kind; a list mixes two or three kinds at most.
    for ((kind, relation), ids) in groups {
        let reached = reachable(tx, ctx, kind, relation, &ids).await?;
        answers.extend(
            ids.into_iter()
                .map(|id| ((kind.to_owned(), relation, id), reached.contains(&id))),
        );
    }
    Ok(answers)
}
