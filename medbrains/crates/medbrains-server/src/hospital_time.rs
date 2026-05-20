use chrono::NaiveDate;
use sqlx::{Executor, Postgres};
use uuid::Uuid;

use crate::error::AppError;

pub async fn tenant_local_today<'e, E>(executor: E, tenant_id: Uuid) -> Result<NaiveDate, AppError>
where
    E: Executor<'e, Database = Postgres>,
{
    let today = sqlx::query_scalar::<_, NaiveDate>(
        "SELECT (timezone(COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC'), now()))::date",
    )
    .bind(tenant_id)
    .fetch_one(executor)
    .await?;

    Ok(today)
}
