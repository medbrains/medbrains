//! "Today" for tokens and queue boards is the hospital's own date. From 00:00
//! to 05:30 IST the UTC date is yesterday's, so a token issued then joined
//! yesterday's queue and a board opened on yesterday's list.

use axum::http::StatusCode;
use chrono::NaiveDate;
use medbrains_server_core::hospital_time::tenant_local_today;
use sqlx::pool::PoolConnection;
use sqlx::{PgConnection, PgPool, Postgres};
use uuid::Uuid;

/// The date asked for, else the hospital's today.
///
/// # Errors
/// 500 when the hospital's date cannot be read; never a silent UTC date.
pub(crate) async fn today(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    asked: Option<NaiveDate>,
) -> Result<NaiveDate, (StatusCode, String)> {
    if let Some(date) = asked {
        return Ok(date);
    }
    tenant_local_today(conn, tenant_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

/// A tenant connection and the hospital's today, for the queue broadcast,
/// which has no caller to answer: `None` when either cannot be had.
pub(crate) async fn conn_and_today(
    db: &PgPool,
    tenant_id: Uuid,
) -> Option<(PoolConnection<Postgres>, NaiveDate)> {
    let mut conn = medbrains_db::pool::tenant_conn(db, &tenant_id).await.ok()?;
    let today = tenant_local_today(&mut *conn, tenant_id).await.ok()?;
    Some((conn, today))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::today;
    use chrono::{Days, Utc};
    use medbrains_db_migrations::testing::{add_tenant, fresh_db};

    /// The hospital's date, not the UTC one, in a zone whose date differs
    /// from UTC's right now (UTC+14 or UTC−12; at any instant one of them
    /// does): the same gap 01:00 IST opens every night.
    #[tokio::test]
    async fn today_is_the_hospitals_date_not_the_utc_one() {
        let test_db = fresh_db().await.expect("test database");
        let db = test_db.owner().await.expect("owner");
        let utc = Utc::now();
        let (zone, local) = if chrono::Timelike::hour(&utc) >= 10 {
            ("Etc/GMT-14", utc.date_naive().checked_add_days(Days::new(1)))
        } else {
            ("Etc/GMT+12", utc.date_naive().checked_sub_days(Days::new(1)))
        };
        let tenant = add_tenant(&db, "TVDATE").await.expect("tenant");
        sqlx::query("UPDATE tenants SET timezone = $2 WHERE id = $1")
            .bind(tenant)
            .bind(zone)
            .execute(&db)
            .await
            .expect("timezone");
        let mut conn = db.acquire().await.expect("conn");
        let got = today(&mut conn, tenant, None).await.expect("today");
        assert_eq!(Some(got), local, "{zone}");
        assert_ne!(got, utc.date_naive(), "the old UTC date");
    }
}
