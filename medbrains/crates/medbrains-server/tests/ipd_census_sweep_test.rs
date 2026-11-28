//! The IPD census, now a sweep over admission and discharge events, gives the
//! numbers the day-by-stay join gave, day for day.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;

/// The census query as it was before the sweep, kept here as the reference.
const JOIN_CENSUS: &str = "WITH dates AS ( \
       SELECT d::date AS date FROM generate_series($1::date, $2::date, '1 day') d \
     ) \
     SELECT dates.date::text, \
       COALESCE(SUM(CASE WHEN a.admitted_at::date = dates.date THEN 1 ELSE 0 END), 0)::bigint, \
       COALESCE(SUM(CASE WHEN a.discharged_at::date = dates.date THEN 1 ELSE 0 END), 0)::bigint, \
       COALESCE(SUM(CASE WHEN a.discharged_at::date = dates.date AND a.discharge_type = 'death' THEN 1 ELSE 0 END), 0)::bigint, \
       COALESCE(SUM(CASE WHEN a.admitted_at::date <= dates.date AND (a.discharged_at IS NULL OR a.discharged_at::date > dates.date) THEN 1 ELSE 0 END), 0)::bigint \
     FROM dates \
     LEFT JOIN admissions a ON a.admitted_at::date <= dates.date AND (a.discharged_at IS NULL OR a.discharged_at::date >= dates.date) \
     GROUP BY dates.date ORDER BY dates.date";

#[tokio::test]
async fn the_sweep_gives_the_joins_numbers_day_for_day() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    // 400 stays across early 2033 (a year no other test admits into), at
    // 06:00 UTC so the date is the same in any hospital zone: some open, some
    // starting before the range, deaths, same-day stays, and every 29th
    // discharged before it was admitted (bad data the join leaves out).
    sqlx::query(
        "WITH u AS (SELECT id, tenant_id FROM users WHERE username = 'admin'), \
              s AS (SELECT n, TIMESTAMPTZ '2033-01-10 06:00:00+00' + make_interval(days => (n * 37) % 100) AS adm \
                      FROM generate_series(1, 400) AS n), \
              p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                    SELECT u.tenant_id, 'UH-CEN-' || gen_random_uuid(), 'Census', 'Stay', \
                           'other'::gender, '9000000004' FROM u, s RETURNING id), \
              ps AS (SELECT p.id, s.* FROM (SELECT id, row_number() OVER () AS n FROM p) p JOIN s USING (n)), \
              e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
                    SELECT u.tenant_id, ps.id, 'ipd' FROM u, ps RETURNING id, patient_id) \
         INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                                 status, admitted_at, discharged_at, discharge_type) \
         SELECT u.tenant_id, e.id, e.patient_id, u.id, 'admitted', ps.adm, \
                CASE WHEN ps.n % 7 = 0 THEN NULL \
                     WHEN ps.n % 29 = 0 THEN ps.adm - interval '2 days' \
                     ELSE ps.adm + make_interval(days => ps.n % 13) END, \
                CASE WHEN ps.n % 7 = 0 THEN NULL WHEN ps.n % 11 = 0 THEN 'death' \
                     WHEN ps.n % 17 = 0 THEN 'deceased' ELSE 'normal' END::discharge_type \
           FROM u, e JOIN ps ON ps.id = e.patient_id",
    )
    .execute(&app.db)
    .await
    .expect("400 stays");

    let (from, to) = ("2033-02-01", "2033-04-30");
    let resp = app
        .get(
            &app.client,
            &format!("/api/analytics/ipd/census?from={from}&to={to}"),
        )
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let rows: Value = resp.json().await.expect("json");
    let got: Vec<(String, i64, i64, i64, i64)> = rows
        .as_array()
        .expect("rows")
        .iter()
        .map(|r| {
            let n = |k: &str| r[k].as_i64().unwrap_or(-1);
            let date = r["date"].as_str().unwrap_or_default().to_owned();
            (
                date,
                n("admissions"),
                n("discharges"),
                n("deaths"),
                n("active"),
            )
        })
        .collect();
    let want: Vec<(String, i64, i64, i64, i64)> = sqlx::query_as(JOIN_CENSUS)
        .bind(from)
        .bind(to)
        .fetch_all(&app.db)
        .await
        .expect("reference census");
    assert_eq!(got.len(), 89, "one row per day");
    assert_eq!(got, want);
    assert!(
        got.iter().any(|r| r.3 > 0) && got.iter().all(|r| r.4 > 0),
        "{got:?}"
    );
}
