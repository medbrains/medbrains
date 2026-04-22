use axum::{
    Extension, Json,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, header},
    response::IntoResponse,
};
use medbrains_core::analytics::{
    BedOccupancyRow, ClinicalIndicatorRow, DateRangeQuery, DeptRevenueRow,
    DoctorRevenueRow, ErVolumeRow, ExportQuery, IpdCensusRow, LabTatRow,
    OpdFootfallRow, OtUtilizationRow, PharmacySalesRow,
};
use medbrains_core::permissions;
use serde::Serialize;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

fn default_range(params: &DateRangeQuery) -> (String, String) {
    let to = params.to.clone().unwrap_or_else(|| {
        chrono::Utc::now().format("%Y-%m-%d").to_string()
    });
    let from = params.from.clone().unwrap_or_else(|| {
        (chrono::Utc::now() - chrono::Duration::days(30)).format("%Y-%m-%d").to_string()
    });
    (from, to)
}

// ── 1. Department Revenue ──────────────────────────────────
pub async fn dept_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<DeptRevenueRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, DeptRevenueRow>(
        "SELECT COALESCE(d.name, 'Unassigned') AS department_name, \
         SUM(ii.total_price)::float8 AS revenue, \
         COUNT(DISTINCT i.id)::bigint AS invoice_count \
         FROM invoices i \
         JOIN invoice_items ii ON ii.invoice_id = i.id \
         LEFT JOIN encounters e ON e.id = i.encounter_id \
         LEFT JOIN departments d ON d.id = e.department_id \
         WHERE i.created_at::date >= $1::date AND i.created_at::date <= $2::date \
         GROUP BY d.name ORDER BY revenue DESC",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 2. Doctor Revenue ──────────────────────────────────────
pub async fn doctor_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<DoctorRevenueRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, DoctorRevenueRow>(
        "SELECT COALESCE(u.full_name, 'Unknown') AS doctor_name, \
         COALESCE(d.name, 'Unassigned') AS department_name, \
         SUM(i.total_amount)::float8 AS revenue, \
         COUNT(DISTINCT i.patient_id)::bigint AS patient_count \
         FROM invoices i \
         JOIN encounters e ON e.id = i.encounter_id \
         LEFT JOIN users u ON u.id = e.doctor_id \
         LEFT JOIN departments d ON d.id = e.department_id \
         WHERE i.created_at::date >= $1::date AND i.created_at::date <= $2::date \
           AND e.doctor_id IS NOT NULL \
         GROUP BY u.full_name, d.name ORDER BY revenue DESC",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 3. IPD Census ──────────────────────────────────────────
pub async fn ipd_census(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<IpdCensusRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, IpdCensusRow>(
        "WITH dates AS ( \
           SELECT d::date AS date FROM generate_series($1::date, $2::date, '1 day') d \
         ) \
         SELECT dates.date, \
           COALESCE(SUM(CASE WHEN a.admitted_at::date = dates.date THEN 1 ELSE 0 END), 0)::bigint AS admissions, \
           COALESCE(SUM(CASE WHEN a.discharged_at::date = dates.date THEN 1 ELSE 0 END), 0)::bigint AS discharges, \
           COALESCE(SUM(CASE WHEN a.discharged_at::date = dates.date AND a.discharge_type = 'death' THEN 1 ELSE 0 END), 0)::bigint AS deaths, \
           COALESCE(SUM(CASE WHEN a.admitted_at::date <= dates.date AND (a.discharged_at IS NULL OR a.discharged_at::date > dates.date) THEN 1 ELSE 0 END), 0)::bigint AS active \
         FROM dates \
         LEFT JOIN admissions a ON a.admitted_at::date <= dates.date AND (a.discharged_at IS NULL OR a.discharged_at::date >= dates.date) \
         GROUP BY dates.date ORDER BY dates.date",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 4. Lab TAT ─────────────────────────────────────────────
pub async fn lab_tat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<LabTatRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, LabTatRow>(
        "SELECT tc.name AS test_name, COUNT(lo.id)::bigint AS order_count, \
         AVG(EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60)::float8 AS avg_tat_mins, \
         PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60)::float8 AS p90_tat_mins, \
         MIN(EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60)::float8 AS min_tat_mins, \
         MAX(EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60)::float8 AS max_tat_mins \
         FROM lab_orders lo JOIN lab_test_catalog tc ON tc.id = lo.test_id \
         WHERE lo.completed_at IS NOT NULL AND lo.created_at::date >= $1::date AND lo.created_at::date <= $2::date \
         GROUP BY tc.name ORDER BY avg_tat_mins DESC",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 5. Pharmacy Sales ──────────────────────────────────────
pub async fn pharmacy_sales(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<PharmacySalesRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, PharmacySalesRow>(
        "SELECT poi.drug_name, pc.category, \
         SUM(poi.quantity)::bigint AS quantity_sold, SUM(poi.total_price)::float8 AS total_revenue \
         FROM pharmacy_orders po \
         JOIN pharmacy_order_items poi ON poi.order_id = po.id \
         LEFT JOIN pharmacy_catalog pc ON pc.id = poi.catalog_item_id \
         WHERE po.status = 'dispensed' AND po.created_at::date >= $1::date AND po.created_at::date <= $2::date \
         GROUP BY poi.drug_name, pc.category ORDER BY total_revenue DESC",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6. OT Utilization ──────────────────────────────────────
pub async fn ot_utilization(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<OtUtilizationRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, OtUtilizationRow>(
        "SELECT r.name AS room_name, COUNT(b.id)::bigint AS total_bookings, \
         COUNT(b.id) FILTER (WHERE b.status = 'completed')::bigint AS completed, \
         COUNT(b.id) FILTER (WHERE b.status = 'cancelled')::bigint AS cancelled, \
         COALESCE(AVG(EXTRACT(EPOCH FROM (b.actual_end - b.actual_start)) / 60) \
           FILTER (WHERE b.actual_start IS NOT NULL AND b.actual_end IS NOT NULL), 0)::float8 AS avg_duration_mins, \
         CASE WHEN COUNT(b.id) = 0 THEN 0.0 \
           ELSE (COUNT(b.id) FILTER (WHERE b.status = 'completed')::float8 / COUNT(b.id)::float8 * 100.0) \
         END AS utilization_pct \
         FROM ot_rooms r \
         LEFT JOIN ot_bookings b ON b.ot_room_id = r.id AND b.scheduled_date >= $1::date AND b.scheduled_date <= $2::date \
         WHERE r.is_active = true GROUP BY r.name ORDER BY total_bookings DESC",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 7. ER Volume ───────────────────────────────────────────
pub async fn er_volume(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<ErVolumeRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, ErVolumeRow>(
        "SELECT arrival_time::date AS date, COUNT(*)::bigint AS total_visits, \
         COUNT(*) FILTER (WHERE triage_level = 'immediate')::bigint AS immediate, \
         COUNT(*) FILTER (WHERE triage_level = 'emergent')::bigint AS emergent, \
         COUNT(*) FILTER (WHERE triage_level = 'urgent')::bigint AS urgent, \
         COUNT(*) FILTER (WHERE triage_level = 'less_urgent')::bigint AS less_urgent, \
         COUNT(*) FILTER (WHERE triage_level = 'non_urgent')::bigint AS non_urgent, \
         COALESCE(AVG(door_to_doctor_mins), 0)::float8 AS avg_door_to_doctor_mins \
         FROM er_visits \
         WHERE arrival_time::date >= $1::date AND arrival_time::date <= $2::date \
         GROUP BY arrival_time::date ORDER BY date",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 8. Clinical Indicators ─────────────────────────────────
pub async fn clinical_indicators(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<ClinicalIndicatorRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, ClinicalIndicatorRow>(
        "WITH monthly AS ( \
           SELECT to_char(a.admitted_at, 'YYYY-MM') AS period, \
             COUNT(*) FILTER (WHERE a.discharged_at IS NOT NULL) AS total_discharged, \
             COUNT(*) FILTER (WHERE a.discharge_type = 'death') AS deaths, \
             AVG(EXTRACT(EPOCH FROM (COALESCE(a.discharged_at, now()) - a.admitted_at)) / 86400) AS avg_los, \
             COUNT(DISTINCT ise.patient_id) AS infections, \
             COUNT(DISTINCT re.patient_id) AS readmits \
           FROM admissions a \
           LEFT JOIN infection_surveillance_events ise ON ise.patient_id = a.patient_id \
             AND ise.infection_date >= a.admitted_at AND ise.infection_date <= COALESCE(a.discharged_at, now()) \
           LEFT JOIN admissions re ON re.patient_id = a.patient_id AND re.id <> a.id \
             AND re.admitted_at BETWEEN a.discharged_at AND a.discharged_at + INTERVAL '30 days' \
           WHERE a.admitted_at::date >= $1::date AND a.admitted_at::date <= $2::date \
           GROUP BY to_char(a.admitted_at, 'YYYY-MM') \
         ) \
         SELECT period, \
           CASE WHEN total_discharged = 0 THEN 0.0 ELSE (deaths::float8 / total_discharged::float8 * 100.0) END AS mortality_rate, \
           CASE WHEN total_discharged = 0 THEN 0.0 ELSE (infections::float8 / total_discharged::float8 * 100.0) END AS infection_rate, \
           CASE WHEN total_discharged = 0 THEN 0.0 ELSE (readmits::float8 / total_discharged::float8 * 100.0) END AS readmission_rate, \
           COALESCE(avg_los, 0)::float8 AS avg_los_days \
         FROM monthly ORDER BY period",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9. OPD Footfall ────────────────────────────────────────
pub async fn opd_footfall(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<OpdFootfallRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, OpdFootfallRow>(
        "SELECT e.encounter_date AS date, COALESCE(d.name, 'Unassigned') AS department_name, \
         COUNT(*)::bigint AS visit_count, \
         COUNT(*) FILTER (WHERE NOT EXISTS ( \
           SELECT 1 FROM encounters e2 WHERE e2.patient_id = e.patient_id \
             AND e2.encounter_type = 'opd' AND e2.encounter_date < e.encounter_date \
         ))::bigint AS new_patients, \
         COUNT(*) FILTER (WHERE EXISTS ( \
           SELECT 1 FROM encounters e2 WHERE e2.patient_id = e.patient_id \
             AND e2.encounter_type = 'opd' AND e2.encounter_date < e.encounter_date \
         ))::bigint AS follow_ups \
         FROM encounters e LEFT JOIN departments d ON d.id = e.department_id \
         WHERE e.encounter_type = 'opd' AND e.encounter_date >= $1::date AND e.encounter_date <= $2::date \
         GROUP BY e.encounter_date, d.name ORDER BY date, department_name",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 10. Bed Occupancy ──────────────────────────────────────
pub async fn bed_occupancy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BedOccupancyRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, BedOccupancyRow>(
        "SELECT w.name AS ward_name, w.total_beds::bigint, \
         COUNT(bs.id) FILTER (WHERE bs.status = 'occupied')::bigint AS occupied, \
         (w.total_beds - COUNT(bs.id) FILTER (WHERE bs.status = 'occupied'))::bigint AS vacant, \
         CASE WHEN w.total_beds = 0 THEN 0.0 \
           ELSE (COUNT(bs.id) FILTER (WHERE bs.status = 'occupied')::float8 / w.total_beds::float8 * 100.0) \
         END AS occupancy_pct \
         FROM wards w \
         LEFT JOIN ward_bed_mappings wbm ON wbm.ward_id = w.id \
         LEFT JOIN bed_states bs ON bs.location_id = wbm.bed_location_id \
         WHERE w.is_active = true GROUP BY w.id, w.name, w.total_beds ORDER BY occupancy_pct DESC",
    )
    .fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 11. Export CSV ─────────────────────────────────────────
fn rows_to_csv<T: Serialize>(rows: &[T]) -> String {
    if rows.is_empty() { return String::from("(no data)\n"); }
    let values: Vec<serde_json::Value> = rows.iter()
        .filter_map(|r| serde_json::to_value(r).ok()).collect();
    let hdrs: Vec<String> = values.first()
        .and_then(|v| v.as_object())
        .map(|obj| obj.keys().cloned().collect())
        .unwrap_or_default();
    let mut csv = hdrs.join(",");
    csv.push('\n');
    for v in &values {
        let line: Vec<String> = hdrs.iter().map(|h| match &v[h] {
            serde_json::Value::Null => String::new(),
            serde_json::Value::String(s) => s.clone(),
            other => other.to_string(),
        }).collect();
        csv.push_str(&line.join(","));
        csv.push('\n');
    }
    csv
}

pub async fn export_csv(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ExportQuery>,
) -> Result<impl IntoResponse, AppError> {
    require_permission(&claims, permissions::analytics::EXPORT)?;
    let range = DateRangeQuery { from: params.from.clone(), to: params.to.clone() };
    let csv = match params.report.as_str() {
        "dept_revenue" => {
            let d = dept_revenue(State(state.clone()), Extension(claims.clone()), Query(range)).await?;
            rows_to_csv(&d.0)
        }
        "bed_occupancy" => {
            let d = bed_occupancy(State(state.clone()), Extension(claims.clone())).await?;
            rows_to_csv(&d.0)
        }
        other => return Err(AppError::BadRequest(
            format!("Unknown report: {other}. Available: dept_revenue, bed_occupancy"),
        )),
    };
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/csv"));
    headers.insert(header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=analytics_export.csv"));
    Ok((headers, csv))
}
