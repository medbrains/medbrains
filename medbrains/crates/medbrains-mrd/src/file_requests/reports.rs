//! What the records room measures and plans from file requests.
//!
//! * The back-scanning order: patients coming in the next days whose paper
//!   file has never been scanned, soonest first. Scanning these first means
//!   the next visit opens on a digital record instead of a fetched folder.
//! * Delivery times: registration to file delivered, median and 90th
//!   percentile, for the hospital, per OPD and per runner. Registration is the
//!   visit's creation, not the request's, so a pre-pulled file is measured
//!   from when the patient arrived.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The planning window, and its bounds.
const DEFAULT_DAYS: i32 = 7;
const MAX_DAYS: i32 = 30;
/// Files listed at once: a day of scanning, several times over.
const BACKSCAN_LIMIT: i64 = 200;
/// The longest delivery-time range, in days.
const MAX_RANGE_DAYS: i64 = 366;

#[derive(Debug, Deserialize)]
pub struct BackscanQuery {
    pub days: Option<i32>,
}

/// One file to scan, with the visit that makes it urgent.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BackscanItem {
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub medical_record_id: Uuid,
    pub record_number: String,
    pub location_label: Option<String>,
    pub next_visit_at: DateTime<Utc>,
    pub upcoming_visits: i64,
}

/// `GET /api/mrd/file-requests/backscan` — files to scan first.
pub async fn list_backscan_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<BackscanQuery>,
) -> Result<Json<Vec<BackscanItem>>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::VIEW)?;
    let permitted = crate::access::list_filter(&state, &claims, None).await?;
    let days = q.days.unwrap_or(DEFAULT_DAYS).clamp(1, MAX_DAYS);
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as::<_, BackscanItem>(
        "SELECT a.patient_id, btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, \
                p.uhid, f.record_id AS medical_record_id, r.record_number, f.location_label, \
                MIN((a.appointment_date + a.slot_start)::timestamptz) AS next_visit_at, \
                COUNT(*) AS upcoming_visits \
           FROM appointments a \
           JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
          CROSS JOIN LATERAL public.mrd_current_file(a.tenant_id, a.patient_id) f \
           JOIN mrd_medical_records r ON r.id = f.record_id \
          WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
            AND a.appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int \
            AND a.status IN ('scheduled', 'confirmed') \
            AND ($3::uuid[] IS NULL OR a.patient_id = ANY($3)) \
            AND NOT EXISTS (SELECT 1 FROM case_sheet_scans s \
                             WHERE s.tenant_id = a.tenant_id AND s.patient_id = a.patient_id \
                               AND s.status <> 'failed') \
            AND NOT EXISTS (SELECT 1 FROM document_ingestion_items i \
                             WHERE i.tenant_id = a.tenant_id \
                               AND i.linked_medical_record_id = f.record_id \
                               AND i.status IN ('linked', 'filed')) \
          GROUP BY a.patient_id, p.first_name, p.last_name, p.uhid, f.record_id, \
                   r.record_number, f.location_label \
          ORDER BY next_visit_at LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(days)
    .bind(permitted.as_deref())
    .bind(BACKSCAN_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct DeliveryTimesQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

/// Registration-to-delivery minutes for one group: the hospital (`all`), an
/// OPD (`department`) or a runner (`runner`).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeliveryTimeRow {
    pub grouping: String,
    pub id: Option<Uuid>,
    pub name: Option<String>,
    pub deliveries: i64,
    pub median_minutes: Option<f64>,
    pub p90_minutes: Option<f64>,
}

/// `GET /api/mrd/file-requests/delivery-times?from=&to=` — the KPI, all
/// three groupings in one query.
pub async fn delivery_times(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DeliveryTimesQuery>,
) -> Result<Json<Vec<DeliveryTimeRow>>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::VIEW)?;
    if q.to < q.from || (q.to - q.from).num_days() > MAX_RANGE_DAYS {
        return Err(AppError::BadRequest(
            "Choose a date range of up to a year, from before to.".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as::<_, DeliveryTimeRow>(
        "WITH t AS ( \
           SELECT f.department_id, f.delivered_by, \
                  EXTRACT(EPOCH FROM f.delivered_at - e.created_at) / 60.0 AS minutes \
             FROM mrd_file_requests f \
             JOIN encounters e ON e.id = f.encounter_id AND e.tenant_id = f.tenant_id \
            WHERE f.tenant_id = $1 AND f.status = 'delivered' AND f.deleted_at IS NULL \
              AND f.visit_date BETWEEN $2 AND $3) \
         SELECT CASE WHEN GROUPING(t.department_id) = 0 THEN 'department' \
                     WHEN GROUPING(t.delivered_by) = 0 THEN 'runner' ELSE 'all' END AS grouping, \
                COALESCE(t.department_id, t.delivered_by) AS id, \
                CASE WHEN GROUPING(t.department_id) = 0 THEN MAX(d.name) \
                     WHEN GROUPING(t.delivered_by) = 0 THEN MAX(u.full_name) END AS name, \
                COUNT(*) AS deliveries, \
                (percentile_cont(0.5) WITHIN GROUP (ORDER BY t.minutes))::float8 AS median_minutes, \
                (percentile_cont(0.9) WITHIN GROUP (ORDER BY t.minutes))::float8 AS p90_minutes \
           FROM t \
           LEFT JOIN departments d ON d.id = t.department_id \
           LEFT JOIN users u ON u.id = t.delivered_by \
          GROUP BY GROUPING SETS ((), (t.department_id), (t.delivered_by)) \
          ORDER BY 1, 6 DESC NULLS LAST \
          LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(q.from)
    .bind(q.to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
