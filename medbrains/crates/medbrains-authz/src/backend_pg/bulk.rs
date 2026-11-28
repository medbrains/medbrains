//! Many access checks answered by one SQL statement.
//!
//! A patient page asks up to ~100 questions and a list page ~300. The trait's
//! default `bulk_check` asked each in its own transaction; this answers all of
//! them in one: the items are unnested into rows and each row runs the same
//! `EXISTS` the single check always ran.

use std::collections::HashMap;

use uuid::Uuid;

use super::{PgAuthzBackend, candidate_relation_codes, view_arrow};
use crate::{AuthzContext, AuthzError, registry, relations::Relation};

/// One item of a bulk check, keyed the way callers look answers up.
type Key = (String, Relation, Uuid);

impl PgAuthzBackend {
    /// Answer every item, or fail as a whole.
    ///
    /// A bypass role is allowed everything, unregistered, as `check` always
    /// was. Otherwise an unknown object type or a relation the type does not
    /// take fails the call before any SQL runs, and so does a fault: no item is
    /// ever reported denied because the question could not be answered.
    pub(super) async fn bulk_check_all(
        &self,
        ctx: &AuthzContext,
        items: &[Key],
    ) -> Result<HashMap<Key, bool>, AuthzError> {
        if ctx.is_bypass || items.is_empty() {
            return Ok(items.iter().map(|k| (k.clone(), ctx.is_bypass)).collect());
        }
        for (object_type, relation, _) in items {
            validate(object_type, *relation)?;
        }
        let rows = self.resolve(ctx, items).await?;
        let mut answers: Vec<Option<bool>> = vec![None; items.len()];
        for (n, allowed) in rows {
            if let Some(slot) = usize::try_from(n - 1).ok().and_then(|i| answers.get_mut(i)) {
                *slot = Some(allowed);
            }
        }
        items
            .iter()
            .zip(answers)
            .map(|(k, a)| {
                a.map(|allowed| (k.clone(), allowed))
                    .ok_or_else(|| AuthzError::Other(format!("access check unanswered: {k:?}")))
            })
            .collect()
    }

    /// The statement: one row per item, `(ordinal, allowed)`.
    ///
    /// Per item, exactly the rules the single check has always applied:
    /// tuples on the object itself, or — for `view` on a type with a
    /// `<parent>->view` arrow (`view_arrow`) — on the parent its active
    /// parent-pointer tuple names; a relation that implies the asked one
    /// (`candidate_relation_codes`, passed comma-joined because Postgres
    /// arrays must be rectangular); active, unexpired and uncaveated (the
    /// caveat evaluator is not run in SQL, so a caveated tuple denies); and a
    /// subject that is the user, their role, one of their departments, or an
    /// access group they are an unexpired member of.
    ///
    /// No multi-hop traversal (department hierarchy, nested groups): the
    /// `SpiceDB` schema models none, and adding it here would make this
    /// fallback more permissive than the source of truth.
    async fn resolve(
        &self,
        ctx: &AuthzContext,
        items: &[Key],
    ) -> Result<Vec<(i64, bool)>, AuthzError> {
        let types: Vec<&str> = items.iter().map(|(t, _, _)| t.as_str()).collect();
        let ids: Vec<Uuid> = items.iter().map(|(_, _, id)| *id).collect();
        let arrows: Vec<Option<&str>> = items.iter().map(|(t, r, _)| view_arrow(t, *r)).collect();
        let relations: Vec<String> = items
            .iter()
            .map(|(_, r, _)| candidate_relation_codes(*r).join(","))
            .collect();
        let dept_strs: Vec<String> = ctx.department_ids.iter().map(Uuid::to_string).collect();

        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;
        let rows: Vec<(i64, bool)> = sqlx::query_as(
            "SELECT i.n, EXISTS (
                 SELECT 1 FROM relation_tuples rt
                 WHERE rt.tenant_id = $1
                   AND (
                        (rt.object_type = i.object_type AND rt.object_id = i.object_id)
                     OR (rt.object_type = i.arrow AND rt.object_id IN (
                            SELECT substr(a.subject_id, length(i.arrow) + 2)::uuid
                            FROM relation_tuples a
                            WHERE a.tenant_id = $1
                              AND a.object_type = i.object_type AND a.object_id = i.object_id
                              AND a.relation = i.arrow
                              AND a.subject_type = 'tuple_set'
                              AND a.subject_id LIKE i.arrow || ':%'
                              AND a.status = 'active'
                              AND (a.expires_at IS NULL OR a.expires_at > now())
                         ))
                   )
                   AND rt.relation = ANY(string_to_array(i.relations, ','))
                   AND rt.status = 'active'
                   AND (rt.expires_at IS NULL OR rt.expires_at > now())
                   AND rt.caveat IS NULL
                   AND (
                        (rt.subject_type = 'user' AND rt.subject_id = $6)
                     OR (rt.subject_type = 'role' AND rt.subject_id = $7)
                     OR (rt.subject_type = 'department' AND rt.subject_id = ANY($8))
                     OR (rt.subject_type = 'group' AND EXISTS (
                            SELECT 1 FROM access_group_members m
                            WHERE m.tenant_id = rt.tenant_id
                              AND m.user_id = $9
                              AND m.group_id::text = rt.subject_id
                              AND m.deleted_at IS NULL
                              AND (m.expires_at IS NULL OR m.expires_at > now())
                         ))
                   )
             )
             FROM unnest($2::text[], $3::uuid[], $4::text[], $5::text[]) WITH ORDINALITY
                  AS i(object_type, object_id, arrow, relations, n)",
        )
        .bind(ctx.tenant_id)
        .bind(&types)
        .bind(&ids)
        .bind(&arrows)
        .bind(&relations)
        .bind(ctx.user_id.to_string())
        .bind(&ctx.role)
        .bind(&dept_strs)
        .bind(ctx.user_id)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(rows)
    }
}

/// Refuse an unregistered object type, or a relation its type does not take,
/// rather than look either up.
fn validate(object_type: &str, relation: Relation) -> Result<(), AuthzError> {
    let spec = registry::lookup(object_type)
        .ok_or_else(|| AuthzError::UnknownObjectType(object_type.to_owned()))?;
    if spec.allowed_relations.contains(&relation) {
        Ok(())
    } else {
        Err(AuthzError::InvalidRelation {
            relation: relation.as_code().to_owned(),
            object_type: object_type.to_owned(),
        })
    }
}
