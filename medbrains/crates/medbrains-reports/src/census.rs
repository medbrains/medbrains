//! The IPD census: per day, admissions, discharges, deaths and stays open.

use medbrains_core::analytics::IpdCensusRow;
use medbrains_server_core::error::AppError;

/// The census for each day from `from` to `to` (dates as the report runner
/// passes them), in one query whose work is the stays plus the days.
pub(crate) async fn ipd_census_rows(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    from: &str,
    to: &str,
) -> Result<Vec<IpdCensusRow>, AppError> {
    // A sweep: each stay is a +1 on its admission day and a -1 on its
    // discharge day, and the census is their running sum, so the work is the
    // stays plus the days. Joining every day to every stay overlapping it was
    // days x stays. A stay discharged before its admission date is left out,
    // as the join left it out.
    sqlx::query_as::<_, IpdCensusRow>(
        "WITH a AS ( \
           SELECT admitted_at::date AS ad, discharged_at::date AS dd, discharge_type \
             FROM admissions \
            WHERE (discharged_at IS NULL OR discharged_at::date >= admitted_at::date) \
              AND admitted_at::date <= $2::date \
              AND (discharged_at IS NULL OR discharged_at::date >= $1::date) \
         ), ev AS ( \
           SELECT ad AS day, 1 AS adm, 0 AS dis, 0 AS dth, 1 AS delta FROM a \
           UNION ALL \
           SELECT dd, 0, 1, (discharge_type = 'death')::int, -1 FROM a WHERE dd IS NOT NULL \
         ), per_day AS ( \
           SELECT GREATEST(day, $1::date) AS date, \
                  COUNT(*) FILTER (WHERE adm = 1 AND day >= $1::date) AS adm, \
                  COUNT(*) FILTER (WHERE dis = 1 AND day >= $1::date) AS dis, \
                  COUNT(*) FILTER (WHERE dth = 1 AND day >= $1::date) AS dth, \
                  SUM(delta) AS delta \
             FROM ev WHERE day <= $2::date GROUP BY 1 \
         ) \
         SELECT d::date AS date, COALESCE(p.adm, 0)::bigint AS admissions, \
           COALESCE(p.dis, 0)::bigint AS discharges, COALESCE(p.dth, 0)::bigint AS deaths, \
           SUM(COALESCE(p.delta, 0)) OVER (ORDER BY d)::bigint AS active \
         FROM generate_series($1::date, $2::date, '1 day') d \
         LEFT JOIN per_day p ON p.date = d::date \
         ORDER BY d LIMIT 5000",
    )
    .bind(from)
    .bind(to)
    .fetch_all(&mut **tx)
    .await
    .map_err(AppError::from)
}
