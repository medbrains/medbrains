//! Postgres implementation of `AuthzBackend`. Reads/writes
//! `relation_tuples` (migration 129) with tenant-context GUC set.

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    AuthzBackend, AuthzContext, AuthzError, RelationTuple, Subject, TupleSource, TupleStatus,
    registry, relations::Relation,
};

/// Ceiling on the reverse index.
///
/// Generous for any real clinic — past this the shape is wrong, not the
/// number: either a tuple explosion, or a list that needs per-record checks
/// instead of set enumeration.
const LIST_ACCESSIBLE_CAP: usize = 50_000;

#[derive(Debug)]
pub struct PgAuthzBackend {
    pool: PgPool,
}

impl PgAuthzBackend {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn set_tenant_ctx(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        tenant_id: Uuid,
    ) -> Result<(), AuthzError> {
        // allow-raw-sql: tenant-context GUC bootstrap, parallel to medbrains-db::pool
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(tenant_id.to_string())
            .execute(&mut **tx)
            .await?;
        Ok(())
    }
}

#[async_trait]
impl AuthzBackend for PgAuthzBackend {
    fn backend_name(&self) -> &'static str {
        "postgres"
    }

    async fn check(
        &self,
        ctx: &AuthzContext,
        relation: Relation,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<bool, AuthzError> {
        if ctx.is_bypass {
            return Ok(true);
        }

        // Validate registry — refuse silently to lookup unregistered types.
        let spec = registry::lookup(object_type)
            .ok_or_else(|| AuthzError::UnknownObjectType(object_type.to_string()))?;
        if !spec.allowed_relations.contains(&relation) {
            return Err(AuthzError::InvalidRelation {
                relation: relation.as_code().to_string(),
                object_type: object_type.to_string(),
            });
        }

        // Implications — for "user has Viewer", any relation that IMPLIES
        // Viewer satisfies (Owner, Editor, AttendingPhysician, Consultant, ...)
        let candidate_relations = candidate_relation_codes(relation);

        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;

        // Single-round-trip resolution: the four subject-match paths (direct
        // user / role / department / group) are OR-ed into one `EXISTS` instead
        // of up to four sequential queries (DSA: batch N round-trips into 1 —
        // see ENGINEERING.md). Semantics are byte-for-byte identical to the previous
        // sequential checks.
        //
        // Multi-hop traversal (department hierarchy, nested groups, tuple-set
        // rewrites) is intentionally NOT added: the SpiceDB schema — the source
        // of truth the durable backend must agree with — models none of them
        // (`department` has only `member: user`, `access_group_members` is flat,
        // and the only `tuple_set` subjects written are the parent pointers
        // below). Adding traversal here would make the PG fallback MORE
        // permissive than SpiceDB, i.e. a security divergence. Caveated tuples
        // are denied (the caveat evaluator is not run in SQL).
        //
        // The one hop the schema does model — the `<parent>->view` arrow (schema.zed: `permission view = … +
        // patient->view`) rides in the same query: the order's parent-pointer
        // tuple names the patient, and the subject match runs against the
        // patient too. NULL when the type has no arrow or `relation` is not
        // view — edit/cancel never traverse it, exactly as in the schema.
        let arrow = view_arrow(object_type, relation);
        let dept_strs: Vec<String> = ctx.department_ids.iter().map(Uuid::to_string).collect();
        let allowed: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                 SELECT 1 FROM relation_tuples rt
                 WHERE rt.tenant_id = $1
                   AND (
                        (rt.object_type = $2 AND rt.object_id = $3)
                     OR (rt.object_type = $9 AND rt.object_id IN (
                            SELECT substr(a.subject_id, length($9) + 2)::uuid
                            FROM relation_tuples a
                            WHERE a.tenant_id = $1
                              AND a.object_type = $2 AND a.object_id = $3
                              AND a.relation = $9
                              AND a.subject_type = 'tuple_set'
                              AND a.subject_id LIKE $9 || ':%'
                              AND a.status = 'active'
                              AND (a.expires_at IS NULL OR a.expires_at > now())
                         ))
                   )
                   AND rt.relation = ANY($4)
                   AND rt.status = 'active'
                   AND (rt.expires_at IS NULL OR rt.expires_at > now())
                   AND rt.caveat IS NULL
                   AND (
                        (rt.subject_type = 'user' AND rt.subject_id = $5)
                     OR (rt.subject_type = 'role' AND rt.subject_id = $6)
                     OR (rt.subject_type = 'department' AND rt.subject_id = ANY($7))
                     OR (rt.subject_type = 'group' AND EXISTS (
                            SELECT 1 FROM access_group_members m
                            WHERE m.tenant_id = rt.tenant_id
                              AND m.user_id = $8
                              AND m.group_id::text = rt.subject_id
                              AND (m.expires_at IS NULL OR m.expires_at > now())
                         ))
                   )
             )",
        )
        .bind(ctx.tenant_id)
        .bind(object_type)
        .bind(object_id)
        .bind(&candidate_relations)
        .bind(ctx.user_id.to_string())
        .bind(&ctx.role)
        .bind(&dept_strs)
        .bind(ctx.user_id)
        .bind(arrow)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(allowed)
    }

    async fn expand(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;

        let rows: Vec<(
            Uuid,
            Uuid,
            String,
            Uuid,
            String,
            String,
            String,
            Option<serde_json::Value>,
            Option<chrono::DateTime<chrono::Utc>>,
            String,
            Uuid,
            chrono::DateTime<chrono::Utc>,
            Option<String>,
            String,
            Option<String>,
        )> = sqlx::query_as(
            "SELECT tuple_id, tenant_id, object_type, object_id, relation,
                    subject_type, subject_id, caveat, expires_at, status,
                    granted_by, granted_at, granted_reason, source, derived_from
             FROM relation_tuples
             WHERE tenant_id = $1 AND object_type = $2 AND object_id = $3
             ORDER BY granted_at ASC",
        )
        .bind(ctx.tenant_id)
        .bind(object_type)
        .bind(object_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .filter_map(|r| {
                let subject = parse_subject(&r.5, &r.6)?;
                Some(RelationTuple {
                    tuple_id: r.0,
                    tenant_id: r.1,
                    object_type: r.2,
                    object_id: r.3,
                    relation: r.4,
                    subject,
                    caveat: r.7,
                    expires_at: r.8,
                    status: parse_status(&r.9),
                    granted_by: r.10,
                    granted_at: r.11,
                    granted_reason: r.12,
                    source: parse_source(&r.13),
                    derived_from: r.14,
                })
            })
            .collect())
    }

    async fn list_accessible(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        relation: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        if ctx.is_bypass {
            // Bypass roles see everything — caller should bypass this fn entirely.
            return Ok(Vec::new());
        }

        let candidate_relations = candidate_relation_codes(relation);

        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;

        let dept_strs: Vec<String> = ctx.department_ids.iter().map(Uuid::to_string).collect();

        // Same arrow as `check`: the objects reached directly, plus those whose
        // parent pointer names a parent reached directly.
        let arrow = view_arrow(object_type, relation);
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            "WITH direct AS (
                 SELECT DISTINCT object_type, object_id FROM relation_tuples
                 WHERE tenant_id = $1
                   AND (object_type = $2 OR object_type = $9)
                   AND relation = ANY($3)
                   AND status = 'active'
                   AND (expires_at IS NULL OR expires_at > now())
                   AND caveat IS NULL
                   AND (
                      (subject_type = 'user' AND subject_id = $4)
                      OR (subject_type = 'role' AND subject_id = $5)
                      OR (subject_type = 'department' AND subject_id = ANY($6))
                      OR (subject_type = 'group' AND subject_id IN (
                           SELECT group_id::text FROM access_group_members
                           WHERE tenant_id = $1 AND user_id = $7
                             AND (expires_at IS NULL OR expires_at > now())
                      ))
                   )
             )
             SELECT object_id FROM direct WHERE object_type = $2
             UNION
             SELECT a.object_id FROM relation_tuples a
             JOIN direct d ON d.object_type = $9
                          AND a.subject_id = $9 || ':' || d.object_id::text
             WHERE a.tenant_id = $1
               AND a.object_type = $2
               AND a.relation = $9
               AND a.subject_type = 'tuple_set'
               AND a.status = 'active'
               AND (a.expires_at IS NULL OR a.expires_at > now())
             LIMIT $8",
        )
        .bind(ctx.tenant_id)
        .bind(object_type)
        .bind(&candidate_relations)
        .bind(ctx.user_id.to_string())
        .bind(&ctx.role)
        .bind(&dept_strs)
        .bind(ctx.user_id)
        // One past the cap, so a full page tells us the set is larger without
        // a second COUNT over the same predicate.
        .bind(i64::try_from(LIST_ACCESSIBLE_CAP + 1).unwrap_or(i64::MAX))
        .bind(arrow)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        // Bounded, and loudly. The caller marshals this set straight back into
        // Postgres as `id = ANY($n)`, so an unbounded answer is the whole
        // visible universe crossing the wire twice to render twenty rows.
        //
        // Not truncated: returning the first N would hand a clinician a
        // partial ward that looks like the whole one. Refusing is the only
        // safe failure — and it forces the real fix (per-record checks, or
        // pushing the page's candidates down) rather than hiding the need.
        if rows.len() > LIST_ACCESSIBLE_CAP {
            tracing::error!(
                object_type,
                cap = LIST_ACCESSIBLE_CAP,
                user = %ctx.user_id,
                "rebac: access set too large to enumerate"
            );
            return Err(AuthzError::AccessSetTooLarge {
                object_type: object_type.to_owned(),
                cap: LIST_ACCESSIBLE_CAP,
            });
        }

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    async fn write_tuple(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
        relation: Relation,
        subject: Subject,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
        reason: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        let spec = registry::lookup(object_type)
            .ok_or_else(|| AuthzError::UnknownObjectType(object_type.to_string()))?;
        if spec.bypass_only {
            return Err(AuthzError::Other(format!(
                "{object_type} is bypass_only — explicit grants forbidden"
            )));
        }
        if !spec.allowed_relations.contains(&relation) {
            return Err(AuthzError::InvalidRelation {
                relation: relation.as_code().to_string(),
                object_type: object_type.to_string(),
            });
        }

        let (subject_type, subject_id) = serialize_subject(&subject);
        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;

        let tuple_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO relation_tuples (
                 tuple_id, tenant_id, object_type, object_id, relation,
                 subject_type, subject_id, expires_at, granted_by,
                 granted_reason, source
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'explicit')",
        )
        .bind(tuple_id)
        .bind(ctx.tenant_id)
        .bind(object_type)
        .bind(object_id)
        .bind(relation.as_code())
        .bind(subject_type)
        .bind(subject_id)
        .bind(expires_at)
        .bind(ctx.user_id)
        .bind(reason)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(tuple_id)
    }

    async fn grant_raw(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
        relation_name: &str,
        subject: Subject,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
        reason: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        // Raw relations (dept_member, ward_member, …) aren't in the `Relation`
        // enum, so skip the enum allowed-relations check; still honour bypass_only.
        let spec = registry::lookup(object_type)
            .ok_or_else(|| AuthzError::UnknownObjectType(object_type.to_string()))?;
        if spec.bypass_only {
            return Err(AuthzError::Other(format!(
                "{object_type} is bypass_only — explicit grants forbidden"
            )));
        }

        let (subject_type, subject_id) = serialize_subject(&subject);
        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;

        let tuple_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO relation_tuples (
                 tuple_id, tenant_id, object_type, object_id, relation,
                 subject_type, subject_id, expires_at, granted_by,
                 granted_reason, source
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'explicit')",
        )
        .bind(tuple_id)
        .bind(ctx.tenant_id)
        .bind(object_type)
        .bind(object_id)
        .bind(relation_name)
        .bind(subject_type)
        .bind(subject_id)
        .bind(expires_at)
        .bind(ctx.user_id)
        .bind(reason)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(tuple_id)
    }

    async fn revoke_tuple(&self, ctx: &AuthzContext, tuple_id: Uuid) -> Result<(), AuthzError> {
        let mut tx = self.pool.begin().await?;
        self.set_tenant_ctx(&mut tx, ctx.tenant_id).await?;
        sqlx::query(
            "UPDATE relation_tuples
             SET status = 'revoked', revoked_at = now(), revoked_by = $1
             WHERE tenant_id = $2 AND tuple_id = $3 AND status = 'active'",
        )
        .bind(ctx.user_id)
        .bind(ctx.tenant_id)
        .bind(tuple_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }
}

fn serialize_subject(s: &Subject) -> (&'static str, String) {
    match s {
        Subject::User(u) => ("user", u.to_string()),
        Subject::Role(r) => ("role", r.clone()),
        Subject::Department(d) => ("department", d.to_string()),
        Subject::Group(g) => ("group", g.to_string()),
        Subject::TupleSet(t) => ("tuple_set", t.clone()),
    }
}

fn parse_subject(kind: &str, id: &str) -> Option<Subject> {
    Some(match kind {
        "user" => Subject::User(Uuid::parse_str(id).ok()?),
        "role" => Subject::Role(id.to_string()),
        "department" => Subject::Department(Uuid::parse_str(id).ok()?),
        "group" => Subject::Group(Uuid::parse_str(id).ok()?),
        "tuple_set" => Subject::TupleSet(id.to_string()),
        _ => return None,
    })
}

fn parse_status(s: &str) -> TupleStatus {
    match s {
        "revoked" => TupleStatus::Revoked,
        "superseded" => TupleStatus::Superseded,
        _ => TupleStatus::Active,
    }
}

fn parse_source(s: &str) -> TupleSource {
    match s {
        "derived" => TupleSource::Derived,
        _ => TupleSource::Explicit,
    }
}

/// The tuple relations that satisfy a check for `relation` — the enum
/// relations implying it, plus the raw membership relations the `SpiceDB`
/// schema folds into `permission view` (`infra/spicedb/schema.zed`:
/// `view = … + dept_member + ward_member + …`, never `edit`). The routes
/// write those as `department#member` subjects (`dept_member` on encounters
/// and admissions, `ward_member` on admissions); without them here the
/// fallback refuses every department-based read `SpiceDB` would allow, and a
/// nurse is told the arrival she just registered does not exist.
pub(crate) fn candidate_relation_codes(relation: Relation) -> Vec<&'static str> {
    let mut codes: Vec<&'static str> = relation.implied_by().iter().map(|r| r.as_code()).collect();
    if relation == Relation::Viewer {
        codes.extend(RAW_VIEW_RELATIONS);
    }
    codes
}

/// Raw relations (no `Relation` variant) that grant `view` in the schema.
pub(crate) const RAW_VIEW_RELATIONS: &[&str] = &["dept_member", "ward_member"];

/// The `<parent>->view` arrows of schema.zed, as (child type, parent type).
/// The parent-pointer relation is named after the parent type and its tuple
/// is `child:<id>#<parent>@tuple_set:<parent>:<parent_id>` — what `SpiceDB`
/// reads as `child:<id>#patient@patient:<parent_id>`.
///
/// ponytail: one hop — no parent listed here has an arrow of its own. A
/// chained arrow needs a recursive CTE here, and a schema change to want it.
const VIEW_ARROWS: &[(&str, &str)] = &[("lab_order", "patient"), ("radiology_order", "patient")];

/// The parent type whose `view` grants `view` on `object_type`, if any.
/// Only `view` traverses the arrow: edit, cancel and results stay with the
/// order's own relations, as in the schema.
fn view_arrow(object_type: &str, relation: Relation) -> Option<&'static str> {
    if relation != Relation::Viewer {
        return None;
    }
    VIEW_ARROWS
        .iter()
        .find(|(child, _)| *child == object_type)
        .map(|(_, parent)| *parent)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_view_traverses_the_order_to_patient_arrow() {
        assert_eq!(view_arrow("lab_order", Relation::Viewer), Some("patient"));
        assert_eq!(
            view_arrow("radiology_order", Relation::Viewer),
            Some("patient")
        );
        assert_eq!(view_arrow("lab_order", Relation::Editor), None);
        assert_eq!(view_arrow("lab_order", Relation::Owner), None);
        assert_eq!(view_arrow("patient", Relation::Viewer), None);
        assert_eq!(view_arrow("pharmacy_order", Relation::Viewer), None);
    }
}
