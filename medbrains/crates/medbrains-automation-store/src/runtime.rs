//! What a run reads and writes while it is happening: watermarks, settings,
//! and the files it downloads.
//!
//! Each of these is bound to one tenant when it is built, and the binding is
//! the point. r8r's own traits know nothing about tenants — they are written
//! for a single-instance engine — so the tenant has to be closed over here, at
//! the one place that can still see it.

use async_trait::async_trait;
use medbrains_automation::prelude::{
    BinaryMeta, BinaryRef, BinaryStore, CoreError, EngineResult as CoreResult, NoVariables,
    StateStore, StaticVariables, Variables,
};
use medbrains_automation::TenantStores;
use serde_json::{Map, Value};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::scope_to_tenant;

/// The stores one hospital's runs use.
#[derive(Debug, Clone)]
pub struct Stores {
    pool: PgPool,
}

impl Stores {
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Stores { pool }
    }
}

#[async_trait]
impl TenantStores for Stores {
    fn state(&self, tenant_id: Uuid) -> Arc<dyn StateStore> {
        Arc::new(TenantState {
            pool: self.pool.clone(),
            tenant_id,
        })
    }

    /// Read now rather than mid-run, so a workflow cannot see a setting change
    /// halfway through and take two different branches on the same value.
    ///
    /// A failed read yields no variables rather than aborting: every
    /// `{{ vars.X }}` then resolves to nothing, which shows in the execution
    /// log as an obviously empty URL — visible, and far less confusing than a
    /// run that dies before its first node with a database error.
    async fn variables(&self, tenant_id: Uuid) -> Arc<dyn Variables> {
        match read_variables(&self.pool, tenant_id).await {
            Ok(values) => Arc::new(StaticVariables::new(values)),
            Err(error) => {
                tracing::error!(%error, tenant = %tenant_id, "could not read variables");
                Arc::new(NoVariables)
            }
        }
    }

    fn binaries(&self, tenant_id: Uuid) -> Arc<dyn BinaryStore> {
        Arc::new(TenantBinaries {
            pool: self.pool.clone(),
            tenant_id,
        })
    }
}

// ------------------------------------------------------------------- state

#[derive(Debug)]
struct TenantState {
    pool: PgPool,
    tenant_id: Uuid,
}

#[async_trait]
impl StateStore for TenantState {
    async fn load(&self, workflow_id: &str) -> CoreResult<Map<String, Value>> {
        let workflow = parse_id(workflow_id)?;
        let mut tx = self.pool.begin().await.map_err(engine_error)?;
        scope_to_tenant(&mut tx, &self.tenant_id)
            .await
            .map_err(engine_error)?;

        let rows: Vec<(String, Value)> = sqlx::query_as(
            "SELECT key, value FROM public.automation_state
              WHERE tenant_id = $1 AND workflow_id = $2",
        )
        .bind(self.tenant_id)
        .bind(workflow)
        .fetch_all(&mut *tx)
        .await
        .map_err(engine_error)?;

        Ok(rows.into_iter().collect())
    }

    async fn commit(&self, workflow_id: &str, values: Map<String, Value>) -> CoreResult<()> {
        if values.is_empty() {
            return Ok(());
        }
        let workflow = parse_id(workflow_id)?;
        let mut tx = self.pool.begin().await.map_err(engine_error)?;
        scope_to_tenant(&mut tx, &self.tenant_id)
            .await
            .map_err(engine_error)?;

        // Bounded loop (Power of 10 rule 2): the engine caps how many values a
        // workflow may remember.
        for (key, value) in values {
            sqlx::query(
                "INSERT INTO public.automation_state (tenant_id, workflow_id, key, value)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (tenant_id, workflow_id, key)
                 DO UPDATE SET value = $4, updated_at = now()",
            )
            .bind(self.tenant_id)
            .bind(workflow)
            .bind(&key)
            .bind(&value)
            .execute(&mut *tx)
            .await
            .map_err(engine_error)?;
        }

        // One transaction for the whole set, so a run cannot leave half its
        // watermarks advanced. Half-advanced is how records get skipped.
        tx.commit().await.map_err(engine_error)
    }
}

// --------------------------------------------------------------- variables

async fn read_variables(pool: &PgPool, tenant_id: Uuid) -> crate::Result<Map<String, Value>> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let rows: Vec<(String, Value)> =
        sqlx::query_as("SELECT key, value FROM public.automation_variables WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_all(&mut *tx)
            .await?;

    Ok(rows.into_iter().collect())
}

// ---------------------------------------------------------------- binaries

#[derive(Debug)]
struct TenantBinaries {
    pool: PgPool,
    tenant_id: Uuid,
}

#[async_trait]
impl BinaryStore for TenantBinaries {
    async fn put(
        &self,
        execution_id: &str,
        meta: &BinaryMeta,
        bytes: Vec<u8>,
    ) -> CoreResult<BinaryRef> {
        let execution = parse_id(execution_id)?;
        let size = bytes.len();

        let mut tx = self.pool.begin().await.map_err(engine_error)?;
        scope_to_tenant(&mut tx, &self.tenant_id)
            .await
            .map_err(engine_error)?;

        let (id,): (Uuid,) = sqlx::query_as(
            "INSERT INTO public.automation_binaries
               (tenant_id, execution_id, file_name, mime_type, size_bytes, bytes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        )
        .bind(self.tenant_id)
        .bind(execution)
        .bind(meta.file_name.as_deref())
        .bind(&meta.mime_type)
        .bind(i64::try_from(size).unwrap_or(i64::MAX))
        .bind(&bytes)
        .fetch_one(&mut *tx)
        .await
        .map_err(engine_error)?;

        tx.commit().await.map_err(engine_error)?;

        Ok(BinaryRef {
            id: id.to_string(),
            file_name: meta.file_name.clone(),
            mime_type: meta.mime_type.clone(),
            size,
        })
    }

    async fn get(&self, id: &str) -> CoreResult<Vec<u8>> {
        let file = parse_id(id)?;
        let mut tx = self.pool.begin().await.map_err(engine_error)?;
        scope_to_tenant(&mut tx, &self.tenant_id)
            .await
            .map_err(engine_error)?;

        // The tenant is in the WHERE as well as the RLS context. Belt and
        // braces on the query that hands back a scanned discharge summary.
        let row: Option<(Vec<u8>,)> = sqlx::query_as(
            "SELECT bytes FROM public.automation_binaries
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(file)
        .bind(self.tenant_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(engine_error)?;

        row.map(|(bytes,)| bytes).ok_or_else(|| {
            CoreError::Node(format!(
                "`{id}` is no longer here — it may belong to a run that has \
                 been pruned from the history"
            ))
        })
    }

    async fn forget(&self, execution_id: &str) -> CoreResult<usize> {
        let execution = parse_id(execution_id)?;
        let mut tx = self.pool.begin().await.map_err(engine_error)?;
        scope_to_tenant(&mut tx, &self.tenant_id)
            .await
            .map_err(engine_error)?;

        let removed = sqlx::query(
            "DELETE FROM public.automation_binaries
              WHERE tenant_id = $1 AND execution_id = $2",
        )
        .bind(self.tenant_id)
        .bind(execution)
        .execute(&mut *tx)
        .await
        .map_err(engine_error)?
        .rows_affected();

        tx.commit().await.map_err(engine_error)?;
        Ok(usize::try_from(removed).unwrap_or(0))
    }
}

// ----------------------------------------------------------------- helpers

/// r8r identifies workflows and runs with opaque strings; MedBrains uses uuids.
///
/// A string that is not one cannot name a row here, and saying so is better
/// than a query that quietly matches nothing.
fn parse_id(value: &str) -> CoreResult<Uuid> {
    Uuid::parse_str(value)
        .map_err(|_| CoreError::Node(format!("`{value}` is not a MedBrains identifier")))
}

fn engine_error(error: impl std::fmt::Display) -> CoreError {
    CoreError::Node(format!("automation storage: {error}"))
}
