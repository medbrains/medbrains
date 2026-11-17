//! How the durable store and the SpiceDB index are read together.
//!
//! `relation_tuples` is the source of truth and SpiceDB an index built from it
//! (RFC-AUTHZ §5.2). A grant reaches the index after Postgres, and so does a
//! revocation. A SpiceDB "yes" is therefore only trusted while no revocation
//! that could reach the caller is still waiting to be applied there; while one
//! is, Postgres alone answers. A Postgres fault is a fault (`Err`, i.e. unknown),
//! never a yes. A SpiceDB fault falls back to Postgres, which is complete for
//! every grant it holds.

use std::collections::{HashMap, HashSet};

use sqlx::PgPool;
use uuid::Uuid;

use medbrains_authz::{AuthzBackend, AuthzContext, AuthzError, backend_pg::PgAuthzBackend, relations::Relation};

use crate::backend_durable_spicedb::set_tenant_ctx;

/// Answer one check from the index and the durable store together.
///
/// Postgres "yes" stands on its own. An index "yes" that Postgres does not
/// share stands only when no revocation for the caller is pending in the index.
pub(crate) async fn combined_check(
    index: &dyn AuthzBackend,
    pg: &PgAuthzBackend,
    pool: &PgPool,
    ctx: &AuthzContext,
    (relation, object_type, object_id): (Relation, &str, Uuid),
) -> Result<bool, AuthzError> {
    if ctx.is_bypass {
        return Ok(true);
    }
    match index.check(ctx, relation, object_type, object_id).await {
        Ok(true) if !revocation_pending(pool, ctx).await? => Ok(true),
        Ok(_) => pg.check(ctx, relation, object_type, object_id).await,
        Err(e) => {
            tracing::warn!(error = %e, object_type, object_id = %object_id,
                "rebac: SpiceDB check failed; using relation_tuples fallback");
            pg.check(ctx, relation, object_type, object_id).await
        }
    }
}

/// The objects the caller may reach: Postgres's list, plus the index's extras
/// unless a revocation for the caller is still pending in the index.
pub(crate) async fn combined_list_accessible(
    index: &dyn AuthzBackend,
    pg: &PgAuthzBackend,
    pool: &PgPool,
    ctx: &AuthzContext,
    object_type: &str,
    relation: Relation,
) -> Result<Vec<Uuid>, AuthzError> {
    if ctx.is_bypass {
        return Ok(Vec::new());
    }
    let mut out = pg.list_accessible(ctx, object_type, relation).await?;
    let mut seen: HashSet<Uuid> = out.iter().copied().collect();
    let extra: Vec<Uuid> = match index.list_accessible(ctx, object_type, relation).await {
        Ok(ids) => ids.into_iter().filter(|id| seen.insert(*id)).collect(),
        Err(e) => {
            tracing::warn!(error = %e, object_type,
                "rebac: SpiceDB lookup failed; relation_tuples fallback used");
            Vec::new()
        }
    };
    if !extra.is_empty() && !revocation_pending(pool, ctx).await? {
        out.extend(extra);
    }
    Ok(out)
}

/// Many checks in one round trip each, with the same rule as `combined_check`.
pub(crate) async fn combined_bulk_check(
    index: &dyn AuthzBackend,
    pg: &PgAuthzBackend,
    pool: &PgPool,
    ctx: &AuthzContext,
    items: &[(String, Relation, Uuid)],
) -> Result<HashMap<(String, Relation, Uuid), bool>, AuthzError> {
    let mut out = pg.bulk_check(ctx, items).await?;
    if ctx.is_bypass {
        return Ok(out);
    }
    let index_only: Vec<(String, Relation, Uuid)> = match index.bulk_check(ctx, items).await {
        Ok(spice) => spice
            .into_iter()
            .filter(|(key, allowed)| *allowed && out.get(key) != Some(&true))
            .map(|(key, _)| key)
            .collect(),
        Err(e) => {
            tracing::warn!(error = %e, "rebac: SpiceDB bulk_check failed");
            Vec::new()
        }
    };
    if !index_only.is_empty() && !revocation_pending(pool, ctx).await? {
        for key in index_only {
            out.insert(key, true);
        }
    }
    Ok(out)
}

/// Whether a revocation that could reach this caller has not yet been
/// confirmed in SpiceDB.
///
/// Matches revocations of the caller's own tuples and of every group-like
/// subject (department, access group, tuple set), because the caller's
/// memberships are resolved inside SpiceDB and cannot be ruled out here.
/// Uses the outbox's partial index, so it costs one index probe.
// ponytail: department/group revocations pause index-only answers for the whole
// tenant until the outbox drains; narrow by membership if that ever bites.
async fn revocation_pending(pool: &PgPool, ctx: &AuthzContext) -> Result<bool, AuthzError> {
    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, ctx.tenant_id).await?;
    let pending = sqlx::query_scalar!(
        r#"SELECT EXISTS (
             SELECT 1 FROM relation_tuples
             WHERE tenant_id = $1
               AND status = 'revoked'
               AND spicedb_sync_status IN ('pending', 'failed')
               AND (subject_type <> 'user' OR subject_id = $2)
           ) AS "pending!""#,
        ctx.tenant_id,
        ctx.user_id.to_string(),
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(pending)
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]
mod tests {
    //! The engine pair against a real Postgres, with an in-memory index standing
    //! in for SpiceDB. An index that has not yet applied a delete is exactly what
    //! SpiceDB is while it is unreachable or slow.
    //!
    //! ```text
    //! DATABASE_URL=… cargo test -p medbrains-authz-spicedb -- --ignored
    //! ```
    use super::*;
    use crate::backend_durable_spicedb::mark_tuple_sync;
    use medbrains_authz::Subject;
    use medbrains_authz::backend_test::InMemoryBackend;
    use sqlx::postgres::PgPoolOptions;

    /// A hospital and one doctor, as the caller.
    async fn doctor(pool: &PgPool) -> AuthzContext {
        let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
        let tenant_id: Uuid = sqlx::query_scalar(
            "INSERT INTO tenants (code, name, hospital_type) \
             VALUES ($1, 'Authz pair test', 'multi_specialty') RETURNING id",
        )
        .bind(format!("AZP{code}"))
        .fetch_one(pool)
        .await
        .expect("tenant");
        let mut tx = pool.begin().await.unwrap();
        set_tenant_ctx(&mut tx, tenant_id).await.unwrap();
        let user_id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (tenant_id, username, email, full_name, role) \
             VALUES ($1, $2, $3, 'Test doctor', 'doctor') RETURNING id",
        )
        .bind(tenant_id)
        .bind(format!("u{code}"))
        .bind(format!("{code}@authz.test"))
        .fetch_one(&mut *tx)
        .await
        .expect("user");
        tx.commit().await.unwrap();
        AuthzContext {
            tenant_id,
            user_id,
            role: "doctor".to_owned(),
            department_ids: Vec::new(),
            is_bypass: false,
        }
    }

    async fn allowed(index: &InMemoryBackend, pool: &PgPool, ctx: &AuthzContext, id: Uuid) -> bool {
        let pg = PgAuthzBackend::new(pool.clone());
        let one = combined_check(index, &pg, pool, ctx, (Relation::Viewer, "patient", id))
            .await
            .unwrap();
        let key = ("patient".to_owned(), Relation::Viewer, id);
        let bulk = combined_bulk_check(index, &pg, pool, ctx, std::slice::from_ref(&key))
            .await
            .unwrap()
            .get(&key)
            .copied()
            .unwrap_or(false);
        let listed = combined_list_accessible(index, &pg, pool, ctx, "patient", Relation::Viewer)
            .await
            .unwrap()
            .contains(&id);
        assert_eq!(one, bulk, "check and bulk_check disagree");
        assert_eq!(one, listed, "check and list_accessible disagree");
        one
    }

    #[tokio::test]
    #[ignore = "needs-pg"]
    async fn a_revocation_not_yet_in_spicedb_never_answers_yes() {
        let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
        let pool = PgPool::connect(&url).await.expect("database");
        let ctx = doctor(&pool).await;
        let pg = PgAuthzBackend::new(pool.clone());
        let index = InMemoryBackend::new();
        let me = Subject::User(ctx.user_id);
        let patient = Uuid::new_v4();

        // A grant in both engines.
        let tuple = pg
            .write_tuple(&ctx, "patient", patient, Relation::Viewer, me.clone(), None, None)
            .await
            .unwrap();
        mark_tuple_sync(&pool, ctx.tenant_id, tuple, "applied", None).await.unwrap();
        let mirrored = index
            .write_tuple(&ctx, "patient", patient, Relation::Viewer, me.clone(), None, None)
            .await
            .unwrap();
        assert!(allowed(&index, &pool, &ctx, patient).await);

        // Revoked while SpiceDB is unreachable: Postgres has it, the delete is queued.
        pg.revoke_tuple(&ctx, tuple).await.unwrap();
        mark_tuple_sync(&pool, ctx.tenant_id, tuple, "failed", Some("unreachable".to_owned()))
            .await
            .unwrap();
        assert!(
            index.check(&ctx, Relation::Viewer, "patient", patient).await.unwrap(),
            "the stand-in must still hold the stale grant"
        );
        assert!(
            !allowed(&index, &pool, &ctx, patient).await,
            "a revoked grant was allowed while its SpiceDB delete was pending"
        );

        // The outbox lands the delete: both engines say no.
        index.revoke_tuple(&ctx, mirrored).await.unwrap();
        mark_tuple_sync(&pool, ctx.tenant_id, tuple, "applied", None).await.unwrap();
        assert!(!allowed(&index, &pool, &ctx, patient).await);

        // Nothing pending: a relation only SpiceDB evaluates (dept_member and the
        // like) is honoured again, and a Postgres yes stands without the index.
        let index_only = Uuid::new_v4();
        index
            .write_tuple(&ctx, "patient", index_only, Relation::Viewer, me.clone(), None, None)
            .await
            .unwrap();
        assert!(allowed(&index, &pool, &ctx, index_only).await);
        let pg_only = Uuid::new_v4();
        pg.write_tuple(&ctx, "patient", pg_only, Relation::Viewer, me, None, None)
            .await
            .unwrap();
        assert!(allowed(&index, &pool, &ctx, pg_only).await);

        // A Postgres fault is unknown, never a yes, even when the index says yes.
        let gone = PgPoolOptions::new()
            .connect_lazy("postgres://nobody@127.0.0.1:1/none")
            .expect("lazy pool");
        gone.close().await;
        let broken = PgAuthzBackend::new(gone.clone());
        assert!(
            combined_check(&index, &broken, &gone, &ctx, (Relation::Viewer, "patient", index_only))
                .await
                .is_err(),
            "a fault in the durable store was answered as a decision"
        );
    }
}
