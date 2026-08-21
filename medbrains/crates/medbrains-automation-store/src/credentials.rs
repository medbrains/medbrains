//! Credentials, stored sealed.
//!
//! The `data` column is ciphertext produced by the engine before it arrives
//! here. Nothing in this crate holds the key, so a bug in the storage layer
//! cannot leak a token, and reading the table directly yields nothing useful.

use crate::{Result, scope_to_tenant};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// A credential as the API describes it — no secret values.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialSummary {
    pub id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<CredentialSummary>> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let rows = sqlx::query(
        "SELECT id, name, type, created_at, updated_at
           FROM public.automation_credentials
          WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    rows.iter().map(summary_from_row).collect()
}

/// The sealed blob, for the engine to open. Returns the credential type too,
/// because the engine needs to know how to attach it to a request.
pub async fn sealed(
    pool: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<(CredentialSummary, String)>> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let row = sqlx::query(
        "SELECT id, name, type, created_at, updated_at, data
           FROM public.automation_credentials
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    row.map(|row| Ok((summary_from_row(&row)?, row.try_get("data")?))).transpose()
}

pub async fn insert(
    pool: &PgPool,
    tenant_id: Uuid,
    created_by: Uuid,
    name: &str,
    type_name: &str,
    sealed_data: &str,
) -> Result<Uuid> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO public.automation_credentials (tenant_id, name, type, data, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(tenant_id)
    .bind(name)
    .bind(type_name)
    .bind(sealed_data)
    .bind(created_by)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(id)
}

pub async fn update(
    pool: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
    name: &str,
    sealed_data: &str,
) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let affected = sqlx::query(
        "UPDATE public.automation_credentials
            SET name = $3, data = $4, updated_at = now()
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .bind(name)
    .bind(sealed_data)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

pub async fn delete(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let affected =
        sqlx::query("DELETE FROM public.automation_credentials WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

fn summary_from_row(row: &sqlx::postgres::PgRow) -> Result<CredentialSummary> {
    Ok(CredentialSummary {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        type_name: row.try_get("type")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}
