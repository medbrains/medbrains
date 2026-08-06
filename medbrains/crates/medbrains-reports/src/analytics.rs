use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, header},
    response::IntoResponse,
};
use medbrains_core::analytics::{
    BedOccupancyRow, CapaAgingRow, ClinicalIndicatorRow, CredentialExpiryRow, DateRangeQuery,
    DeptRevenueRow, DischargeSummaryCompletionRow, DoctorRevenueRow, ErVolumeRow, ExportQuery,
    HaiRateRow, HandHygieneComplianceRow, IpdCensusRow, LabCriticalValueComplianceRow, LabTatRow,
    OpdFootfallRow, OpdQueueWaitRow, OtUtilizationRow, PharmacySalesRow, ReadmissionRow,
};
use medbrains_core::permissions;
use serde::Serialize;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

fn default_range(params: &DateRangeQuery) -> (String, String) {
    let to = params
        .to
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let from = params.from.clone().unwrap_or_else(|| {
        (chrono::Utc::now() - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string()
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
         GROUP BY d.name ORDER BY revenue DESC LIMIT 5000",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
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
         GROUP BY u.full_name, d.name ORDER BY revenue DESC LIMIT 5000",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
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
         GROUP BY dates.date ORDER BY dates.date LIMIT 5000",
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
         GROUP BY tc.name ORDER BY avg_tat_mins DESC LIMIT 5000",
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
         GROUP BY poi.drug_name, pc.category ORDER BY total_revenue DESC LIMIT 5000",
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
         WHERE r.is_active = true GROUP BY r.name ORDER BY total_bookings DESC LIMIT 5000",
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
         GROUP BY arrival_time::date ORDER BY date LIMIT 5000",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
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
         FROM monthly ORDER BY period LIMIT 5000",
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
         GROUP BY e.encounter_date, d.name ORDER BY date, department_name LIMIT 5000",
    )
    .bind(&from).bind(&to).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9b. OPD Queue Wait ─────────────────────────────────────
/// Wait is token-issued to token-called: what the patient experienced sitting in
/// the corridor, not how long the consultation took.
///
/// Only called entries count. A patient still waiting has no wait yet, and a
/// no-show never waited — including either would report a shorter queue than the
/// clinic actually ran, which is the wrong direction for a staffing number.
///
/// One pass with `percentile_cont`, grouped in the database. Pulling every queue
/// row into the server and sorting per bucket gives the same answer for far more
/// memory and round-trips.
pub async fn opd_queue_wait(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<OpdQueueWaitRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, OpdQueueWaitRow>(
        "SELECT q.queue_date, \
                EXTRACT(HOUR FROM q.created_at)::int AS hour_of_day, \
                COALESCE(d.name, 'Unassigned') AS department_name, \
                COUNT(*)::bigint AS patients_seen, \
                COALESCE(percentile_cont(0.5) WITHIN GROUP ( \
                  ORDER BY EXTRACT(EPOCH FROM (q.called_at - q.created_at)) / 60.0), 0) \
                  AS median_wait_minutes, \
                COALESCE(percentile_cont(0.9) WITHIN GROUP ( \
                  ORDER BY EXTRACT(EPOCH FROM (q.called_at - q.created_at)) / 60.0), 0) \
                  AS p90_wait_minutes, \
                COALESCE(MAX(EXTRACT(EPOCH FROM \
                  (q.called_at - q.created_at)) / 60.0), 0)::double precision \
                  AS longest_wait_minutes \
         FROM opd_queues q \
         LEFT JOIN departments d ON d.id = q.department_id \
         WHERE q.tenant_id = $1 \
           AND q.called_at IS NOT NULL \
           AND q.queue_date >= $2::date AND q.queue_date <= $3::date \
         GROUP BY q.queue_date, hour_of_day, d.name \
         ORDER BY q.queue_date, hour_of_day, department_name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9c. Lab Critical Value Compliance ──────────────────────
/// Whether critical results were actually communicated, and how fast.
///
/// The clock runs from when the alert was raised to when a clinician was
/// notified — not to when the result was verified. A verified result nobody was
/// told about is the failure this report exists to catch.
///
/// Unnotified alerts are counted but excluded from the timing percentiles: they
/// have no elapsed time yet, and treating them as zero would make a lab that
/// never picks up the phone look instantaneous.
pub async fn lab_critical_value_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<LabCriticalValueComplianceRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, LabCriticalValueComplianceRow>(
        "SELECT a.created_at::date AS alert_date, \
                COUNT(*)::bigint AS critical_values, \
                COUNT(*) FILTER (WHERE a.notified_at IS NOT NULL)::bigint AS notified, \
                COUNT(*) FILTER (WHERE a.acknowledged_at IS NOT NULL)::bigint AS acknowledged, \
                COUNT(*) FILTER (WHERE a.readback_verified)::bigint AS readback_verified, \
                COUNT(*) FILTER (WHERE a.escalated_at IS NOT NULL)::bigint AS escalated, \
                COUNT(*) FILTER ( \
                  WHERE a.notified_at IS NOT NULL \
                    AND a.notified_at <= a.created_at + INTERVAL '60 minutes' \
                )::bigint AS notified_within_60_min, \
                COALESCE(percentile_cont(0.5) WITHIN GROUP ( \
                  ORDER BY EXTRACT(EPOCH FROM (a.notified_at - a.created_at)) / 60.0), 0) \
                  AS median_minutes_to_notify, \
                COALESCE(percentile_cont(0.9) WITHIN GROUP ( \
                  ORDER BY EXTRACT(EPOCH FROM (a.notified_at - a.created_at)) / 60.0), 0) \
                  AS p90_minutes_to_notify \
         FROM lab_critical_alerts a \
         WHERE a.tenant_id = $1 \
           AND a.deleted_at IS NULL \
           AND a.created_at::date >= $2::date AND a.created_at::date <= $3::date \
         GROUP BY alert_date \
         ORDER BY alert_date LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9d. Credential and Licence Expiry ──────────────────────
/// Who is working on a credential that has lapsed, or is about to.
///
/// Deliberately not filtered by status. A row whose `status` still says
/// `active` while its `expiry_date` is in the past is exactly the case this
/// report has to catch — the status column reflects what somebody last typed,
/// the date reflects what is true. Trusting the status would hide the failure.
///
/// Revoked and suspended credentials are excluded from the expiry buckets:
/// those people are already stood down, and counting them as "expiring" would
/// pad the number a manager is meant to act on.
pub async fn credential_expiry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CredentialExpiryRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, CredentialExpiryRow>(
        "SELECT c.credential_type::text AS credential_type, \
                COUNT(*)::bigint AS total_credentials, \
                COUNT(*) FILTER ( \
                  WHERE c.expiry_date < CURRENT_DATE \
                )::bigint AS expired, \
                COUNT(*) FILTER ( \
                  WHERE c.expiry_date >= CURRENT_DATE \
                    AND c.expiry_date <= CURRENT_DATE + 30 \
                )::bigint AS expiring_within_30_days, \
                COUNT(*) FILTER ( \
                  WHERE c.expiry_date >= CURRENT_DATE \
                    AND c.expiry_date <= CURRENT_DATE + 90 \
                )::bigint AS expiring_within_90_days, \
                COUNT(*) FILTER (WHERE c.verified_at IS NULL)::bigint AS unverified, \
                MIN(c.expiry_date - CURRENT_DATE)::bigint AS days_to_next_expiry \
         FROM employee_credentials c \
         WHERE c.tenant_id = $1 \
           AND c.deleted_at IS NULL \
           AND c.status NOT IN ('revoked'::credential_status, 'suspended'::credential_status) \
         GROUP BY c.credential_type \
         ORDER BY expired DESC, credential_type LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9e. CAPA Aging ─────────────────────────────────────────
/// Corrective actions that are late, and ones closed without being checked.
///
/// Overdue is computed from `due_date` and `completed_at`, not from the status
/// column — the same reason as credential expiry. A CAPA whose status still
/// reads `in_progress` a month after its due date is overdue whatever the
/// column says, and an audit will treat it that way.
///
/// `completed_unverified` is deliberately its own count rather than folded into
/// closed. NABH separates completion from effectiveness verification because an
/// action nobody checked is a promise, not a fix, and reporting them together
/// would let a hospital close its CAPA log without improving anything.
///
/// Days-to-verify is measured only over CAPAs that actually reached
/// verification. Including the unverified ones as zero would make a backlog of
/// unchecked actions look like fast closure.
pub async fn capa_aging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CapaAgingRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, CapaAgingRow>(
        "SELECT COALESCE(c.capa_type, 'unspecified') AS capa_type, \
                COUNT(*)::bigint AS total_capas, \
                COUNT(*) FILTER ( \
                  WHERE c.completed_at IS NULL \
                    AND c.due_date IS NOT NULL \
                    AND c.due_date < CURRENT_DATE \
                )::bigint AS overdue, \
                COUNT(*) FILTER ( \
                  WHERE c.completed_at IS NULL \
                    AND (c.due_date IS NULL OR c.due_date >= CURRENT_DATE) \
                )::bigint AS open_on_time, \
                COUNT(*) FILTER ( \
                  WHERE c.completed_at IS NOT NULL AND c.verified_at IS NULL \
                )::bigint AS completed_unverified, \
                COUNT(*) FILTER (WHERE c.verified_at IS NOT NULL)::bigint AS verified, \
                COALESCE(percentile_cont(0.5) WITHIN GROUP ( \
                  ORDER BY EXTRACT(EPOCH FROM (c.verified_at - c.created_at)) / 86400.0), 0) \
                  AS median_days_to_verify, \
                MAX(CURRENT_DATE - c.due_date) FILTER ( \
                  WHERE c.completed_at IS NULL AND c.due_date < CURRENT_DATE \
                )::bigint AS max_days_overdue \
         FROM quality_capa c \
         WHERE c.tenant_id = $1 \
           AND c.deleted_at IS NULL \
         GROUP BY capa_type \
         ORDER BY overdue DESC, capa_type LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9f. Discharge Summary Completion ───────────────────────
/// Whether patients left with a summary, and how long it took to finalise.
///
/// The query starts from `admissions`, not from `ipd_discharge_summaries`, and
/// that choice is the whole report. A discharge with no summary row has nothing
/// to join to; starting from the summary side would silently drop it and report
/// perfect completion for a ward that writes nothing. Only a LEFT JOIN from the
/// discharges can count an absence.
///
/// Time-to-finalise is measured only over summaries that were finalised.
/// Counting the missing ones as zero hours would reward never writing one.
pub async fn discharge_summary_completion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<DischargeSummaryCompletionRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, DischargeSummaryCompletionRow>(
        "SELECT a.discharged_at::date AS discharge_date, \
                COUNT(*)::bigint AS discharges, \
                COUNT(*) FILTER (WHERE s.finalized_at IS NOT NULL)::bigint AS finalized, \
                COUNT(*) FILTER ( \
                  WHERE s.id IS NOT NULL AND s.finalized_at IS NULL \
                )::bigint AS draft_only, \
                COUNT(*) FILTER (WHERE s.id IS NULL)::bigint AS missing, \
                COUNT(*) FILTER ( \
                  WHERE s.finalized_at IS NOT NULL \
                    AND s.finalized_at <= a.discharged_at + INTERVAL '24 hours' \
                )::bigint AS finalized_within_24h, \
                COALESCE(percentile_cont(0.5) WITHIN GROUP ( \
                  ORDER BY EXTRACT(EPOCH FROM (s.finalized_at - a.discharged_at)) / 3600.0), 0) \
                  AS median_hours_to_finalize \
         FROM admissions a \
         LEFT JOIN ipd_discharge_summaries s \
                ON s.admission_id = a.id AND s.deleted_at IS NULL \
         WHERE a.tenant_id = $1 \
           AND a.discharged_at IS NOT NULL \
           AND a.discharged_at::date >= $2::date AND a.discharged_at::date <= $3::date \
         GROUP BY discharge_date \
         ORDER BY discharge_date LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9g. HAI Rate ───────────────────────────────────────────
/// Device-associated infection rates, per 1,000 device-days.
///
/// Each HAI type is divided by the device-days for *its own* device: CLABSI by
/// central-line days, CAUTI by urinary-catheter days, VAP by ventilator days.
/// Dividing everything by patient-days would be easier and would understate
/// every rate, because most patients have no device at all.
///
/// The rate is `None` rather than zero when no device-days were recorded. Zero
/// asserts "we had catheters and no infections"; `None` says "we cannot tell",
/// and a ward that stopped recording device-days must not appear to have
/// achieved a perfect record by doing so.
pub async fn hai_rate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<HaiRateRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, HaiRateRow>(
        "WITH events AS ( \
             SELECT date_trunc('month', e.infection_date)::date AS month, \
                    e.hai_type::text AS hai_type, \
                    COUNT(*) FILTER ( \
                      WHERE e.infection_status = 'confirmed'::infection_status \
                    )::bigint AS confirmed, \
                    COUNT(*) FILTER ( \
                      WHERE e.infection_status = 'suspected'::infection_status \
                    )::bigint AS suspected \
               FROM infection_surveillance_events e \
              WHERE e.tenant_id = $1 \
                AND e.deleted_at IS NULL \
                AND e.infection_date::date >= $2::date \
                AND e.infection_date::date <= $3::date \
              GROUP BY month, e.hai_type \
         ), device AS ( \
             SELECT date_trunc('month', d.record_date)::date AS month, \
                    COALESCE(SUM(d.central_line_days), 0)::bigint AS clabsi_days, \
                    COALESCE(SUM(d.urinary_catheter_days), 0)::bigint AS cauti_days, \
                    COALESCE(SUM(d.ventilator_days), 0)::bigint AS vap_days \
               FROM infection_device_days d \
              WHERE d.tenant_id = $1 \
                AND d.record_date >= $2::date AND d.record_date <= $3::date \
              GROUP BY month \
         ) \
         SELECT ev.month, ev.hai_type, ev.confirmed, ev.suspected, \
                COALESCE( \
                  CASE ev.hai_type \
                    WHEN 'clabsi' THEN dv.clabsi_days \
                    WHEN 'cauti'  THEN dv.cauti_days \
                    WHEN 'vap'    THEN dv.vap_days \
                  END, 0)::bigint AS device_days, \
                CASE \
                  WHEN COALESCE( \
                    CASE ev.hai_type \
                      WHEN 'clabsi' THEN dv.clabsi_days \
                      WHEN 'cauti'  THEN dv.cauti_days \
                      WHEN 'vap'    THEN dv.vap_days \
                    END, 0) > 0 \
                  THEN (ev.confirmed * 1000.0) / \
                       CASE ev.hai_type \
                         WHEN 'clabsi' THEN dv.clabsi_days \
                         WHEN 'cauti'  THEN dv.cauti_days \
                         WHEN 'vap'    THEN dv.vap_days \
                       END \
                  ELSE NULL \
                END::double precision AS rate_per_1000_device_days \
           FROM events ev \
           LEFT JOIN device dv ON dv.month = ev.month \
          ORDER BY ev.month, ev.hai_type LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9h. Hand Hygiene Compliance ────────────────────────────
/// Hand hygiene compliance, computed from the observations.
///
/// Two deliberate choices, both of which change the number:
///
/// The stored `compliance_rate` column is ignored and the percentage is
/// recomputed from `compliant` and `observations`. A denormalised rate is only
/// as good as the last write that touched it, and this is an audited figure.
///
/// It is a ratio of sums, not a mean of ratios — `SUM(compliant) /
/// SUM(observations)`, never `AVG(compliance_rate)`. Averaging per-audit rates
/// weights a five-observation spot check the same as a five-hundred-observation
/// ward round, which lets one flattering mini-audit outrank a unit that
/// measured honestly.
///
/// Months with no observations return `None`, not 100% and not 0%: nobody
/// watched, so there is nothing to report.
pub async fn hand_hygiene_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<HandHygieneComplianceRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, HandHygieneComplianceRow>(
        "SELECT date_trunc('month', a.audit_date)::date AS month, \
                COALESCE(a.staff_category, 'unspecified') AS staff_category, \
                COUNT(*)::bigint AS audits, \
                COALESCE(SUM(a.observations), 0)::bigint AS observations, \
                COALESCE(SUM(a.compliant), 0)::bigint AS compliant, \
                CASE WHEN COALESCE(SUM(a.observations), 0) > 0 \
                     THEN (SUM(a.compliant) * 100.0) / SUM(a.observations) \
                     ELSE NULL \
                END::double precision AS compliance_percent \
         FROM hand_hygiene_audits a \
         WHERE a.tenant_id = $1 \
           AND a.audit_date::date >= $2::date AND a.audit_date::date <= $3::date \
         GROUP BY month, staff_category \
         ORDER BY month, staff_category LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 9i. Readmission Watch ──────────────────────────────────
/// 7- and 30-day readmission, measured from the index discharge.
///
/// Three choices decide whether this number is honest:
///
/// Deaths are excluded from the denominator. A patient who died cannot be
/// readmitted, so leaving them in makes the rate fall as mortality rises.
/// The count is still reported, so the exclusion is visible rather than a
/// silent thumb on the scale.
///
/// The month is the month of the *index discharge*, not of the readmission.
/// Keying on the return date would attribute a failure to whichever month
/// happened to receive the patient.
///
/// A readmission is any later admission for the same patient inside the window.
/// `EXISTS` rather than a join, so a patient who bounced back three times is
/// one readmitted discharge, not three — otherwise a handful of revolving-door
/// patients could push the rate above 100%.
pub async fn readmission_watch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<ReadmissionRow>>, AppError> {
    require_permission(&claims, permissions::analytics::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (from, to) = default_range(&params);
    let rows = sqlx::query_as::<_, ReadmissionRow>(
        "SELECT date_trunc('month', a.discharged_at)::date AS month, \
                COUNT(*) FILTER (WHERE NOT died)::bigint AS eligible_discharges, \
                COUNT(*) FILTER (WHERE died)::bigint AS deaths_excluded, \
                COUNT(*) FILTER (WHERE NOT died AND back_within_7)::bigint \
                  AS readmitted_within_7_days, \
                COUNT(*) FILTER (WHERE NOT died AND back_within_30)::bigint \
                  AS readmitted_within_30_days, \
                CASE WHEN COUNT(*) FILTER (WHERE NOT died) > 0 \
                     THEN (COUNT(*) FILTER (WHERE NOT died AND back_within_30) * 100.0) \
                          / COUNT(*) FILTER (WHERE NOT died) \
                     ELSE NULL \
                END::double precision AS readmission_rate_30_day_percent \
         FROM ( \
             SELECT a.discharged_at, \
                    a.discharge_type::text IN ('death', 'deceased') AS died, \
                    EXISTS ( \
                      SELECT 1 FROM admissions r \
                       WHERE r.tenant_id = a.tenant_id \
                         AND r.patient_id = a.patient_id \
                         AND r.id <> a.id \
                         AND r.admitted_at > a.discharged_at \
                         AND r.admitted_at <= a.discharged_at + INTERVAL '7 days' \
                    ) AS back_within_7, \
                    EXISTS ( \
                      SELECT 1 FROM admissions r \
                       WHERE r.tenant_id = a.tenant_id \
                         AND r.patient_id = a.patient_id \
                         AND r.id <> a.id \
                         AND r.admitted_at > a.discharged_at \
                         AND r.admitted_at <= a.discharged_at + INTERVAL '30 days' \
                    ) AS back_within_30 \
               FROM admissions a \
              WHERE a.tenant_id = $1 \
                AND a.discharged_at IS NOT NULL \
                AND a.discharged_at::date >= $2::date \
                AND a.discharged_at::date <= $3::date \
         ) a \
         GROUP BY month \
         ORDER BY month LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&mut *tx)
    .await?;
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
         WHERE w.is_active = true GROUP BY w.id, w.name, w.total_beds ORDER BY occupancy_pct DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── 11. Export CSV ─────────────────────────────────────────
fn rows_to_csv<T: Serialize>(rows: &[T]) -> String {
    if rows.is_empty() {
        return String::from("(no data)\n");
    }
    let values: Vec<serde_json::Value> = rows
        .iter()
        .filter_map(|r| serde_json::to_value(r).ok())
        .collect();
    let hdrs: Vec<String> = values
        .first()
        .and_then(|v| v.as_object())
        .map(|obj| obj.keys().cloned().collect())
        .unwrap_or_default();
    let mut csv = hdrs.join(",");
    csv.push('\n');
    for v in &values {
        let line: Vec<String> = hdrs
            .iter()
            .map(|h| match &v[h] {
                serde_json::Value::Null => String::new(),
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            })
            .collect();
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
    let range = DateRangeQuery {
        from: params.from.clone(),
        to: params.to.clone(),
    };
    let csv = match params.report.as_str() {
        "dept_revenue" => {
            let d = dept_revenue(
                State(state.clone()),
                Extension(claims.clone()),
                Query(range),
            )
            .await?;
            rows_to_csv(&d.0)
        }
        "bed_occupancy" => {
            let d = bed_occupancy(State(state.clone()), Extension(claims.clone())).await?;
            rows_to_csv(&d.0)
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "Unknown report: {other}. Available: dept_revenue, bed_occupancy"
            )));
        }
    };
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/csv"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=analytics_export.csv"),
    );
    Ok((headers, csv))
}

/// analytics routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/analytics/revenue/department", get(dept_revenue))
        .route("/api/analytics/revenue/doctor", get(doctor_revenue))
        .route("/api/analytics/ipd/census", get(ipd_census))
        .route("/api/analytics/lab/tat", get(lab_tat))
        .route("/api/analytics/pharmacy/sales", get(pharmacy_sales))
        .route("/api/analytics/ot/utilization", get(ot_utilization))
        .route("/api/analytics/er/volume", get(er_volume))
        .route(
            "/api/analytics/clinical/indicators",
            get(clinical_indicators),
        )
        .route("/api/analytics/opd/footfall", get(opd_footfall))
        .route("/api/analytics/bed/occupancy", get(bed_occupancy))
        .route("/api/analytics/export", get(export_csv))
}
