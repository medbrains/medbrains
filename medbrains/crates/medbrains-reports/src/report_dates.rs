//! The dates a report covers when the reader does not say.

use medbrains_core::analytics::DateRangeQuery;
use medbrains_server_core::{error::AppError, hospital_time::tenant_local_today};
use sqlx::PgConnection;
use uuid::Uuid;

/// The caller's dates, else the 30 days ending on the hospital's own today.
///
/// Reports bucket rows by `created_at::date` in the hospital's zone (the report
/// transaction carries its `TimeZone`). Ending the default on the UTC date cut
/// all of today's rows from 00:00 to 05:30 in India, so a report opened after
/// local midnight showed an empty day.
pub(crate) async fn default_range(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    params: &DateRangeQuery,
) -> Result<(String, String), AppError> {
    let today = tenant_local_today(&mut *conn, tenant_id).await?;
    let month_ago = today - chrono::Duration::days(30);
    let to = params.to.clone().unwrap_or_else(|| today.to_string());
    let from = params.from.clone().unwrap_or_else(|| month_ago.to_string());
    Ok((from, to))
}
