//! Durable `SpiceDB` backend.
//!
//! `relation_tuples` is the write-ahead/outbox store. `SpiceDB` is the
//! graph index used for fast relationship checks. Writes first land in
//! Postgres, then are pushed to `SpiceDB` immediately and retried by the
//! worker if the sidecar is temporarily unavailable.

use std::time::Duration;

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_authz::{
    AuthzBackend, AuthzContext, AuthzError, RelationTuple, Subject, backend_pg::PgAuthzBackend,
    relations::Relation,
};

use crate::backend_spicedb::SpiceDbBackend;
use crate::combine::{combined_bulk_check, combined_check, combined_list_accessible};

const OUTBOX_BATCH_PER_TENANT: i64 = 100;
const OUTBOX_IDLE_SLEEP: Duration = Duration::from_secs(5);
const OUTBOX_ACTIVE_SLEEP: Duration = Duration::from_millis(500);

#[derive(Debug, Clone)]
struct StoredTuple {
    tuple_id: Uuid,
    tenant_id: Uuid,
    object_type: String,
    object_id: Uuid,
    relation: String,
    subject_type: String,
    subject_id: String,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    status: String,
}

type StoredTupleRow = (
    Uuid,
    Uuid,
    String,
    Uuid,
    String,
    String,
    String,
    Option<chrono::DateTime<chrono::Utc>>,
    String,
);

#[derive(Debug)]
pub struct DurableSpiceDbBackend {
    pg: PgAuthzBackend,
    pool: PgPool,
    spicedb: SpiceDbBackend,
}

impl DurableSpiceDbBackend {
    pub fn new(pool: PgPool, spicedb: SpiceDbBackend) -> Self {
        Self {
            pg: PgAuthzBackend::new(pool.clone()),
            pool,
            spicedb,
        }
    }
}

#[async_trait]
impl AuthzBackend for DurableSpiceDbBackend {
    fn backend_name(&self) -> &'static str {
        "spicedb+outbox"
    }

    async fn check(
        &self,
        ctx: &AuthzContext,
        relation: Relation,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<bool, AuthzError> {
        combined_check(
            &self.spicedb,
            &self.pg,
            &self.pool,
            ctx,
            (relation, object_type, object_id),
        )
        .await
    }

    async fn expand(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        self.pg.expand(ctx, object_type, object_id).await
    }

    async fn list_accessible(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        relation: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        combined_list_accessible(
            &self.spicedb,
            &self.pg,
            &self.pool,
            ctx,
            object_type,
            relation,
        )
        .await
    }

    async fn bulk_check(
        &self,
        ctx: &AuthzContext,
        items: &[(String, Relation, Uuid)],
    ) -> Result<std::collections::HashMap<(String, Relation, Uuid), bool>, AuthzError> {
        combined_bulk_check(&self.spicedb, &self.pg, &self.pool, ctx, items).await
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
        let tuple_id = self
            .pg
            .write_tuple(
                ctx,
                object_type,
                object_id,
                relation,
                subject.clone(),
                expires_at,
                reason,
            )
            .await?;

        if matches!(subject, Subject::Role(_)) {
            mark_tuple_sync(
                &self.pool,
                ctx.tenant_id,
                tuple_id,
                "skipped",
                Some("role-subject SpiceDB grants require role#member modeling".to_owned()),
            )
            .await?;
            return Ok(tuple_id);
        }

        match self
            .spicedb
            .write_tuple(
                ctx,
                object_type,
                object_id,
                relation,
                subject,
                expires_at,
                None,
            )
            .await
        {
            Ok(_) => {
                mark_tuple_sync(&self.pool, ctx.tenant_id, tuple_id, "applied", None).await?;
            }
            Err(e) => {
                let error = e.to_string();
                tracing::warn!(error = %error, tuple_id = %tuple_id,
                    "rebac: SpiceDB write failed; queued in relation_tuples outbox");
                mark_tuple_sync(&self.pool, ctx.tenant_id, tuple_id, "failed", Some(error)).await?;
            }
        }

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
        // Postgres `relation_tuples` is the durable source of truth; SpiceDB is
        // the queryable projection. Write PG first (real tuple id), then push
        // the raw relation to SpiceDB best-effort — the outbox/backfill retries
        // on failure. Mirrors `write_tuple`.
        let tuple_id = self
            .pg
            .grant_raw(
                ctx,
                object_type,
                object_id,
                relation_name,
                subject.clone(),
                expires_at,
                reason,
            )
            .await?;

        if matches!(subject, Subject::Role(_)) {
            mark_tuple_sync(
                &self.pool,
                ctx.tenant_id,
                tuple_id,
                "skipped",
                Some("role-subject SpiceDB grants require role#member modeling".to_owned()),
            )
            .await?;
            return Ok(tuple_id);
        }

        match self
            .spicedb
            .write_raw(object_type, object_id, relation_name, subject, expires_at)
            .await
        {
            Ok(()) => {
                mark_tuple_sync(&self.pool, ctx.tenant_id, tuple_id, "applied", None).await?;
            }
            Err(e) => {
                let error = e.to_string();
                tracing::warn!(error = %error, tuple_id = %tuple_id,
                    "rebac: SpiceDB raw write failed; queued in relation_tuples outbox");
                mark_tuple_sync(&self.pool, ctx.tenant_id, tuple_id, "failed", Some(error)).await?;
            }
        }

        Ok(tuple_id)
    }

    async fn revoke_tuple(&self, ctx: &AuthzContext, tuple_id: Uuid) -> Result<(), AuthzError> {
        let tuple = load_tuple_by_id(&self.pool, ctx.tenant_id, tuple_id).await?;
        // Revokes and queues the SpiceDB delete in one statement, so there is no
        // moment where the tuple is revoked but not yet pending.
        self.pg.revoke_tuple(ctx, tuple_id).await?;

        let Some(tuple) = tuple else {
            return Ok(());
        };
        apply_tuple_to_spicedb(&self.pool, &self.spicedb, tuple).await
    }

    async fn revoke_specific(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
        relation: Relation,
        subject: Subject,
    ) -> Result<(), AuthzError> {
        let (subject_type, subject_id) = serialize_subject(&subject);
        let tuple_id = load_tuple_id_by_coordinates(
            &self.pool,
            ctx.tenant_id,
            object_type,
            object_id,
            relation,
            subject_type,
            &subject_id,
        )
        .await?;

        revoke_tuple_by_coordinates(
            &self.pool,
            ctx,
            object_type,
            object_id,
            relation,
            subject_type,
            &subject_id,
        )
        .await?;

        match self
            .spicedb
            .revoke_specific(object_type, object_id, relation, subject)
            .await
        {
            Ok(()) => {
                if let Some(id) = tuple_id {
                    mark_tuple_sync(&self.pool, ctx.tenant_id, id, "applied", None).await?;
                }
                Ok(())
            }
            Err(e) => {
                if let Some(id) = tuple_id {
                    mark_tuple_sync(&self.pool, ctx.tenant_id, id, "failed", Some(e.to_string()))
                        .await?;
                }
                Ok(())
            }
        }
    }
}

/// Retry worker for pending `relation_tuples` rows.
pub async fn run_spicedb_outbox_worker(pool: PgPool, spicedb: SpiceDbBackend) {
    loop {
        match drain_spicedb_outbox_once(&pool, &spicedb, OUTBOX_BATCH_PER_TENANT).await {
            Ok(0) => tokio::time::sleep(OUTBOX_IDLE_SLEEP).await,
            Ok(count) => {
                tracing::debug!(count, "rebac: SpiceDB outbox drain complete");
                tokio::time::sleep(OUTBOX_ACTIVE_SLEEP).await;
            }
            Err(e) => {
                tracing::warn!(error = %e, "rebac: SpiceDB outbox drain failed");
                tokio::time::sleep(OUTBOX_IDLE_SLEEP).await;
            }
        }
    }
}

async fn drain_spicedb_outbox_once(
    pool: &PgPool,
    spicedb: &SpiceDbBackend,
    batch_per_tenant: i64,
) -> Result<usize, AuthzError> {
    let tenants: Vec<(Uuid,)> =
        sqlx::query_as("SELECT id FROM tenants WHERE is_active = true ORDER BY id")
            .fetch_all(pool)
            .await?;

    let mut applied = 0usize;
    for (tenant_id,) in tenants {
        let rows = load_pending_rows(pool, tenant_id, batch_per_tenant).await?;
        for row in rows {
            apply_tuple_to_spicedb(pool, spicedb, row).await?;
            applied += 1;
        }
    }
    Ok(applied)
}

async fn load_pending_rows(
    pool: &PgPool,
    tenant_id: Uuid,
    limit: i64,
) -> Result<Vec<StoredTuple>, AuthzError> {
    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, tenant_id).await?;
    let rows: Vec<StoredTupleRow> = sqlx::query_as(
        "SELECT tuple_id, tenant_id, object_type, object_id, relation,
                subject_type, subject_id, expires_at, status
         FROM relation_tuples
         WHERE tenant_id = $1
           AND spicedb_sync_status IN ('pending', 'failed')
           AND spicedb_next_attempt_at <= now()
         ORDER BY spicedb_next_attempt_at ASC, granted_at ASC
         LIMIT $2",
    )
    .bind(tenant_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(rows
        .into_iter()
        .map(
            |(
                tuple_id,
                row_tenant_id,
                object_type,
                object_id,
                relation,
                subject_type,
                subject_id,
                expires_at,
                status,
            )| StoredTuple {
                tuple_id,
                tenant_id: row_tenant_id,
                object_type,
                object_id,
                relation,
                subject_type,
                subject_id,
                expires_at,
                status,
            },
        )
        .collect())
}

async fn apply_tuple_to_spicedb(
    pool: &PgPool,
    spicedb: &SpiceDbBackend,
    tuple: StoredTuple,
) -> Result<(), AuthzError> {
    let Some(subject) = parse_subject(&tuple.subject_type, &tuple.subject_id) else {
        mark_tuple_sync(
            pool,
            tuple.tenant_id,
            tuple.tuple_id,
            "skipped",
            Some(format!(
                "unknown subject: {}:{}",
                tuple.subject_type, tuple.subject_id
            )),
        )
        .await?;
        return Ok(());
    };

    if matches!(subject, Subject::Role(_)) {
        mark_tuple_sync(
            pool,
            tuple.tenant_id,
            tuple.tuple_id,
            "skipped",
            Some("role-subject SpiceDB grants require role#member modeling".to_owned()),
        )
        .await?;
        return Ok(());
    }

    let ctx = AuthzContext {
        tenant_id: tuple.tenant_id,
        user_id: Uuid::nil(),
        role: "system".to_owned(),
        department_ids: Vec::new(),
        is_bypass: true,
    };

    // A relation the Rust enum does not model (`dept_member`, `ward_member`, …)
    // is a schema relation written by `grant_raw`; it is synced by name. It used
    // to be skipped, which left a revoked raw grant in SpiceDB for good.
    let (ot, oid, rel) = (
        tuple.object_type.as_str(),
        tuple.object_id,
        tuple.relation.as_str(),
    );
    let result = match (Relation::from_code(rel), tuple.status == "revoked") {
        (Some(relation), true) => spicedb.revoke_specific(ot, oid, relation, subject).await,
        (None, true) => spicedb.revoke_raw(ot, oid, rel, subject).await,
        (Some(relation), false) => spicedb
            .write_tuple(&ctx, ot, oid, relation, subject, tuple.expires_at, None)
            .await
            .map(|_| ()),
        (None, false) => {
            spicedb
                .write_raw(ot, oid, rel, subject, tuple.expires_at)
                .await
        }
    };

    match result {
        Ok(()) => mark_tuple_sync(pool, tuple.tenant_id, tuple.tuple_id, "applied", None).await?,
        Err(e) => {
            mark_tuple_sync(
                pool,
                tuple.tenant_id,
                tuple.tuple_id,
                "failed",
                Some(e.to_string()),
            )
            .await?;
        }
    }
    Ok(())
}

async fn load_tuple_by_id(
    pool: &PgPool,
    tenant_id: Uuid,
    tuple_id: Uuid,
) -> Result<Option<StoredTuple>, AuthzError> {
    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, tenant_id).await?;
    let row: Option<StoredTupleRow> = sqlx::query_as(
        "SELECT tuple_id, tenant_id, object_type, object_id, relation,
                subject_type, subject_id, expires_at, status
         FROM relation_tuples
         WHERE tenant_id = $1 AND tuple_id = $2",
    )
    .bind(tenant_id)
    .bind(tuple_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(row.map(
        |(
            tuple_id,
            row_tenant_id,
            object_type,
            object_id,
            relation,
            subject_type,
            subject_id,
            expires_at,
            status,
        )| StoredTuple {
            tuple_id,
            tenant_id: row_tenant_id,
            object_type,
            object_id,
            relation,
            subject_type,
            subject_id,
            expires_at,
            status,
        },
    ))
}

#[allow(clippy::too_many_arguments)]
async fn load_tuple_id_by_coordinates(
    pool: &PgPool,
    tenant_id: Uuid,
    object_type: &str,
    object_id: Uuid,
    relation: Relation,
    subject_type: &str,
    subject_id: &str,
) -> Result<Option<Uuid>, AuthzError> {
    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, tenant_id).await?;
    let tuple_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT tuple_id
         FROM relation_tuples
         WHERE tenant_id = $1
           AND object_type = $2
           AND object_id = $3
           AND relation = $4
           AND subject_type = $5
           AND subject_id = $6
           AND status = 'active'
         ORDER BY granted_at DESC
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(object_type)
    .bind(object_id)
    .bind(relation.as_code())
    .bind(subject_type)
    .bind(subject_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(tuple_id)
}

#[allow(clippy::too_many_arguments)]
async fn revoke_tuple_by_coordinates(
    pool: &PgPool,
    ctx: &AuthzContext,
    object_type: &str,
    object_id: Uuid,
    relation: Relation,
    subject_type: &str,
    subject_id: &str,
) -> Result<(), AuthzError> {
    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, ctx.tenant_id).await?;
    sqlx::query(
        "UPDATE relation_tuples
         SET status = 'revoked',
             revoked_at = now(),
             revoked_by = $1,
             spicedb_sync_status = 'pending',
             spicedb_next_attempt_at = now(),
             spicedb_last_error = NULL
         WHERE tenant_id = $2
           AND object_type = $3
           AND object_id = $4
           AND relation = $5
           AND subject_type = $6
           AND subject_id = $7
           AND status = 'active'",
    )
    .bind(ctx.user_id)
    .bind(ctx.tenant_id)
    .bind(object_type)
    .bind(object_id)
    .bind(relation.as_code())
    .bind(subject_type)
    .bind(subject_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

pub(crate) async fn mark_tuple_sync(
    pool: &PgPool,
    tenant_id: Uuid,
    tuple_id: Uuid,
    status: &str,
    error: Option<String>,
) -> Result<(), AuthzError> {
    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, tenant_id).await?;
    sqlx::query(
        "UPDATE relation_tuples
         SET spicedb_sync_status = $1,
             spicedb_synced_at = CASE
                 WHEN $1 IN ('applied', 'skipped') THEN now()
                 ELSE spicedb_synced_at
             END,
             spicedb_last_error = $2,
             spicedb_attempts = CASE
                 WHEN $1 = 'applied' THEN spicedb_attempts
                 ELSE spicedb_attempts + 1
             END,
             spicedb_next_attempt_at = CASE
                 WHEN $1 = 'failed' THEN now() + interval '30 seconds'
                 ELSE now()
             END
         WHERE tenant_id = $3 AND tuple_id = $4",
    )
    .bind(status)
    .bind(error.map(|msg| truncate_error(&msg)))
    .bind(tenant_id)
    .bind(tuple_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

pub(crate) async fn set_tenant_ctx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<(), AuthzError> {
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
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
        "role" => Subject::Role(id.to_owned()),
        "department" => Subject::Department(Uuid::parse_str(id).ok()?),
        "group" => Subject::Group(Uuid::parse_str(id).ok()?),
        "tuple_set" => Subject::TupleSet(id.to_owned()),
        _ => return None,
    })
}

fn truncate_error(msg: &str) -> String {
    const MAX_ERROR_CHARS: usize = 1000;
    msg.chars().take(MAX_ERROR_CHARS).collect()
}
