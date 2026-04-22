#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::Utc;
use medbrains_core::command_center::{
    AlertThresholdRow, AssignTransportRequest, BedTurnaroundRow, BottleneckRow,
    CreateAlertThresholdRequest, CreateTransportRequest, DepartmentAlertRow, DepartmentLoadRow,
    HourlyFlowRow, KpiTile, PatientFlowSnapshot, PendingDischargeRow, TransportRequestRow,
    TurnaroundStatsRow, UpdateAlertThresholdRequest, UpdateTransportRequest,
};
use medbrains_core::permissions;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

#[derive(sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

// ══════════════════════════════════════════════════════════
//  Patient Flow
// ══════════════════════════════════════════════════════════

pub async fn patient_flow_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PatientFlowSnapshot>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PatientFlowSnapshot>(
        "SELECT \
           (SELECT COUNT(*) FROM patients WHERE tenant_id = $1 \
            AND created_at::date = CURRENT_DATE) AS registered_today, \
           (SELECT COUNT(*) FROM opd_queues WHERE tenant_id = $1 \
            AND status::text = 'waiting' AND queue_date = CURRENT_DATE) AS opd_waiting, \
           (SELECT COUNT(*) FROM opd_queues WHERE tenant_id = $1 \
            AND status::text = 'called' AND queue_date = CURRENT_DATE) AS opd_in_consult, \
           (SELECT COUNT(*) FROM er_visits WHERE tenant_id = $1 \
            AND status::text IN ('registered','triaged','in_treatment','observation')) \
            AS er_active, \
           (SELECT COUNT(*) FROM admissions WHERE tenant_id = $1 \
            AND status::text = 'admitted') AS ipd_admitted, \
           (SELECT COUNT(*) FROM admissions WHERE tenant_id = $1 \
            AND status::text = 'admitted' \
            AND expected_discharge_date IS NOT NULL \
            AND expected_discharge_date <= CURRENT_DATE + INTERVAL '48 hours') \
            AS pending_discharge, \
           (SELECT COUNT(*) FROM admissions WHERE tenant_id = $1 \
            AND discharged_at::date = CURRENT_DATE) AS discharged_today",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn hourly_flow(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HourlyFlowRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, HourlyFlowRow>(
        "WITH hours AS (SELECT generate_series(0, 23) AS hour) \
         SELECT h.hour::int4 AS hour, \
           COALESCE((SELECT COUNT(*) FROM admissions \
             WHERE tenant_id = $1 AND admitted_at >= now() - INTERVAL '24 hours' \
             AND EXTRACT(HOUR FROM admitted_at) = h.hour), 0) AS admissions, \
           COALESCE((SELECT COUNT(*) FROM admissions \
             WHERE tenant_id = $1 AND discharged_at >= now() - INTERVAL '24 hours' \
             AND EXTRACT(HOUR FROM discharged_at) = h.hour), 0) AS discharges, \
           COALESCE((SELECT COUNT(*) FROM er_visits \
             WHERE tenant_id = $1 AND arrival_time >= now() - INTERVAL '24 hours' \
             AND EXTRACT(HOUR FROM arrival_time) = h.hour), 0) AS er_arrivals, \
           COALESCE((SELECT COUNT(*) FROM opd_queues \
             WHERE tenant_id = $1 AND queue_date = CURRENT_DATE \
             AND EXTRACT(HOUR FROM created_at) = h.hour), 0) AS opd_visits \
         FROM hours h ORDER BY h.hour",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn detect_bottlenecks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BottleneckRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BottleneckRow>(
        "SELECT area, metric, current_value, threshold, severity FROM ( \
           SELECT 'ER' AS area, 'wait_time_mins' AS metric, \
             COALESCE(EXTRACT(EPOCH FROM (now() - MIN(e.arrival_time)))/60.0, 0)::float8 \
               AS current_value, \
             60.0::float8 AS threshold, \
             CASE WHEN COALESCE(EXTRACT(EPOCH FROM (now() - MIN(e.arrival_time)))/60.0, 0) > 120 \
               THEN 'critical' \
               WHEN COALESCE(EXTRACT(EPOCH FROM (now() - MIN(e.arrival_time)))/60.0, 0) > 60 \
               THEN 'warning' ELSE 'ok' END AS severity \
           FROM er_visits e WHERE e.tenant_id = $1 \
             AND e.status::text IN ('registered','triaged') \
           UNION ALL \
           SELECT 'OPD' AS area, 'queue_depth' AS metric, \
             COUNT(*)::float8 AS current_value, \
             50.0::float8 AS threshold, \
             CASE WHEN COUNT(*) > 100 THEN 'critical' \
               WHEN COUNT(*) > 50 THEN 'warning' ELSE 'ok' END AS severity \
           FROM opd_queues WHERE tenant_id = $1 \
             AND status::text = 'waiting' AND queue_date = CURRENT_DATE \
           UNION ALL \
           SELECT 'IPD' AS area, 'occupancy_pct' AS metric, \
             CASE WHEN COUNT(*) = 0 THEN 0 \
               ELSE (COUNT(*) FILTER (WHERE bs.status::text = 'occupied'))::float8 \
                 * 100.0 / COUNT(*)::float8 END AS current_value, \
             85.0::float8 AS threshold, \
             CASE WHEN CASE WHEN COUNT(*) = 0 THEN 0 \
               ELSE (COUNT(*) FILTER (WHERE bs.status::text = 'occupied'))::float8 \
                 * 100.0 / COUNT(*)::float8 END > 95 THEN 'critical' \
               WHEN CASE WHEN COUNT(*) = 0 THEN 0 \
               ELSE (COUNT(*) FILTER (WHERE bs.status::text = 'occupied'))::float8 \
                 * 100.0 / COUNT(*)::float8 END > 85 THEN 'warning' \
               ELSE 'ok' END AS severity \
           FROM locations bs WHERE bs.tenant_id = $1 AND bs.location_type::text = 'bed' \
         ) sub WHERE severity != 'ok'",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Department Load
// ══════════════════════════════════════════════════════════

pub async fn department_load(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DepartmentLoadRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DepartmentLoadRow>(
        "SELECT d.id AS department_id, d.name AS department_name, \
           COALESCE(bed.total, 0) AS bed_total, \
           COALESCE(bed.occupied, 0) AS bed_occupied, \
           CASE WHEN COALESCE(bed.total, 0) = 0 THEN 0 \
             ELSE (COALESCE(bed.occupied, 0)::float8 * 100.0 / bed.total::float8) \
             END AS occupancy_pct, \
           COALESCE(q.depth, 0) AS queue_depth, \
           COALESCE(q.avg_wait, 0) AS avg_wait_mins \
         FROM departments d \
         LEFT JOIN LATERAL ( \
           SELECT COUNT(*) AS total, \
             COUNT(*) FILTER (WHERE l.status::text = 'occupied') AS occupied \
           FROM locations l WHERE l.tenant_id = $1 \
             AND l.department_id = d.id AND l.location_type::text = 'bed' \
         ) bed ON true \
         LEFT JOIN LATERAL ( \
           SELECT COUNT(*) AS depth, \
             COALESCE(AVG(EXTRACT(EPOCH FROM (now() - oq.created_at))/60.0), 0)::float8 \
               AS avg_wait \
           FROM opd_queues oq WHERE oq.tenant_id = $1 \
             AND oq.department_id = d.id AND oq.status::text = 'waiting' \
             AND oq.queue_date = CURRENT_DATE \
         ) q ON true \
         WHERE d.tenant_id = $1 \
         ORDER BY d.name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Alerts
// ══════════════════════════════════════════════════════════

pub async fn active_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DepartmentAlertRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DepartmentAlertRow>(
        "SELECT a.id, a.department_id, d.name AS department_name, \
           a.alert_level, a.metric_code, a.current_value, a.threshold_value, \
           a.message, a.acknowledged_by, a.acknowledged_at, a.created_at \
         FROM department_alerts a \
         JOIN departments d ON d.id = a.department_id \
         WHERE a.tenant_id = $1 \
           AND a.acknowledged_at IS NULL AND a.resolved_at IS NULL \
         ORDER BY a.created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn acknowledge_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::command_center::alerts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    sqlx::query(
        "UPDATE department_alerts \
         SET acknowledged_by = $1, acknowledged_at = $2 \
         WHERE id = $3 AND tenant_id = $4",
    )
    .bind(claims.sub)
    .bind(now)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "acknowledged" })))
}

pub async fn list_thresholds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AlertThresholdRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AlertThresholdRow>(
        "SELECT t.id, t.department_id, d.name AS department_name, \
           t.metric_code, t.warning_threshold, t.critical_threshold, t.is_active \
         FROM department_alert_thresholds t \
         JOIN departments d ON d.id = t.department_id \
         WHERE t.tenant_id = $1 \
         ORDER BY d.name, t.metric_code",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_threshold(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAlertThresholdRequest>,
) -> Result<Json<AlertThresholdRow>, AppError> {
    require_permission(&claims, permissions::command_center::alerts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AlertThresholdRow>(
        "INSERT INTO department_alert_thresholds \
           (tenant_id, department_id, metric_code, warning_threshold, critical_threshold) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, department_id, \
           (SELECT name FROM departments WHERE id = $2) AS department_name, \
           metric_code, warning_threshold, critical_threshold, is_active",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(&body.metric_code)
    .bind(body.warning_threshold)
    .bind(body.critical_threshold)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_threshold(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAlertThresholdRequest>,
) -> Result<Json<AlertThresholdRow>, AppError> {
    require_permission(&claims, permissions::command_center::alerts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AlertThresholdRow>(
        "UPDATE department_alert_thresholds \
         SET warning_threshold = COALESCE($1, warning_threshold), \
             critical_threshold = COALESCE($2, critical_threshold), \
             is_active = COALESCE($3, is_active) \
         WHERE id = $4 AND tenant_id = $5 \
         RETURNING id, department_id, \
           (SELECT name FROM departments WHERE id = department_id) AS department_name, \
           metric_code, warning_threshold, critical_threshold, is_active",
    )
    .bind(body.warning_threshold)
    .bind(body.critical_threshold)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Discharge Coordinator
// ══════════════════════════════════════════════════════════

pub async fn list_pending_discharges(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingDischargeRow>>, AppError> {
    require_permission(&claims, permissions::command_center::discharge::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PendingDischargeRow>(
        "SELECT a.id AS admission_id, a.patient_id, \
           COALESCE(p.first_name || ' ' || p.last_name, p.first_name, '') AS patient_name, \
           COALESCE(p.uhid, '') AS uhid, \
           COALESCE(w.name, '') AS ward_name, \
           COALESCE(loc.code, '') AS bed_code, \
           COALESCE(u.full_name, '') AS doctor_name, \
           a.admitted_at, \
           a.expected_discharge_date, \
           EXTRACT(DAY FROM now() - a.admitted_at)::int4 AS days_admitted, \
           COALESCE((SELECT COUNT(*) FROM lab_orders lo \
             WHERE lo.tenant_id = $1 AND lo.admission_id = a.id \
             AND lo.status::text NOT IN ('completed','cancelled')), 0) AS pending_labs, \
           COALESCE((SELECT COUNT(*) FROM invoices inv \
             WHERE inv.tenant_id = $1 AND inv.admission_id = a.id \
             AND inv.status::text = 'draft') > 0, false) AS pending_billing, \
           COALESCE(a.discharge_summary IS NOT NULL, false) AS summary_draft, \
           0::int8 AS checklist_pending \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id \
         LEFT JOIN locations loc ON loc.id = a.location_id \
         LEFT JOIN locations w ON w.id = loc.parent_id \
         LEFT JOIN users u ON u.id = a.attending_doctor_id \
         WHERE a.tenant_id = $1 AND a.status::text = 'admitted' \
           AND (a.expected_discharge_date IS NOT NULL \
                AND a.expected_discharge_date <= CURRENT_DATE + INTERVAL '48 hours') \
         ORDER BY a.expected_discharge_date NULLS LAST \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_discharge_blockers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::command_center::discharge::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pending_labs = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count FROM lab_orders \
         WHERE tenant_id = $1 AND admission_id = $2 \
         AND status::text NOT IN ('completed','cancelled')",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    let pending_pharmacy = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count FROM pharmacy_orders \
         WHERE tenant_id = $1 AND admission_id = $2 \
         AND status::text NOT IN ('dispensed','cancelled')",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    let draft_invoices = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count FROM invoices \
         WHERE tenant_id = $1 AND admission_id = $2 \
         AND status::text = 'draft'",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "admission_id": admission_id,
        "pending_labs": pending_labs.count.unwrap_or(0),
        "pending_pharmacy": pending_pharmacy.count.unwrap_or(0),
        "draft_invoices": draft_invoices.count.unwrap_or(0),
    })))
}

// ══════════════════════════════════════════════════════════
//  Bed Turnaround / Environmental Services
// ══════════════════════════════════════════════════════════

pub async fn bed_turnaround_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BedTurnaroundRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BedTurnaroundRow>(
        "SELECT l.id AS location_id, l.code AS location_code, \
           COALESCE(w.name, '') AS ward_name, \
           l.status::text AS status, \
           l.updated_at AS discharge_at, \
           NULL::timestamptz AS cleaning_started_at, \
           NULL::timestamptz AS cleaning_completed_at, \
           NULL::int4 AS turnaround_minutes \
         FROM locations l \
         LEFT JOIN locations w ON w.id = l.parent_id \
         WHERE l.tenant_id = $1 \
           AND l.location_type::text = 'bed' \
           AND l.status::text IN ('vacant', 'under_maintenance', 'blocked') \
         ORDER BY l.updated_at DESC \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn turnaround_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TurnaroundStatsRow>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TurnaroundStatsRow>(
        "SELECT COALESCE(w.name, 'Unknown') AS ward_name, \
           0::float8 AS avg_turnaround_mins, \
           0::int4 AS max_turnaround_mins, \
           COUNT(*) FILTER (WHERE l.status::text = 'vacant') AS beds_awaiting_cleaning, \
           COUNT(*) FILTER (WHERE l.status::text = 'under_maintenance') AS beds_being_cleaned \
         FROM locations l \
         LEFT JOIN locations w ON w.id = l.parent_id \
         WHERE l.tenant_id = $1 AND l.location_type::text = 'bed' \
         GROUP BY w.name \
         ORDER BY w.name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Transport
// ══════════════════════════════════════════════════════════

pub async fn list_transport_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TransportRequestRow>>, AppError> {
    require_permission(&claims, permissions::command_center::transport::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TransportRequestRow>(
        "SELECT tr.id, \
           p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name, \
           fl.name AS from_location, tl.name AS to_location, \
           tr.transport_mode::text AS transport_mode, \
           tr.status::text AS status, tr.priority, \
           COALESCE(ru.full_name, '') AS requested_by_name, \
           au.full_name AS assigned_to_name, \
           tr.requested_at, tr.assigned_at, tr.picked_up_at, \
           tr.completed_at, tr.notes \
         FROM transport_requests tr \
         LEFT JOIN patients p ON p.id = tr.patient_id \
         LEFT JOIN locations fl ON fl.id = tr.from_location_id \
         LEFT JOIN locations tl ON tl.id = tr.to_location_id \
         LEFT JOIN users ru ON ru.id = tr.requested_by \
         LEFT JOIN users au ON au.id = tr.assigned_to \
         WHERE tr.tenant_id = $1 \
         ORDER BY tr.requested_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_transport_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTransportRequest>,
) -> Result<Json<TransportRequestRow>, AppError> {
    require_permission(&claims, permissions::command_center::transport::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let priority = body.priority.as_deref().unwrap_or("routine");

    let row = sqlx::query_as::<_, TransportRequestRow>(
        "WITH ins AS ( \
           INSERT INTO transport_requests \
             (tenant_id, patient_id, admission_id, from_location_id, to_location_id, \
              transport_mode, priority, requested_by, notes) \
           VALUES ($1, $2, $3, $4, $5, $6::transport_mode, $7, $8, $9) \
           RETURNING * \
         ) \
         SELECT ins.id, \
           p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name, \
           fl.name AS from_location, tl.name AS to_location, \
           ins.transport_mode::text AS transport_mode, \
           ins.status::text AS status, ins.priority, \
           COALESCE(ru.full_name, '') AS requested_by_name, \
           au.full_name AS assigned_to_name, \
           ins.requested_at, ins.assigned_at, ins.picked_up_at, \
           ins.completed_at, ins.notes \
         FROM ins \
         LEFT JOIN patients p ON p.id = ins.patient_id \
         LEFT JOIN locations fl ON fl.id = ins.from_location_id \
         LEFT JOIN locations tl ON tl.id = ins.to_location_id \
         LEFT JOIN users ru ON ru.id = ins.requested_by \
         LEFT JOIN users au ON au.id = ins.assigned_to",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.from_location_id)
    .bind(body.to_location_id)
    .bind(&body.transport_mode)
    .bind(priority)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_transport_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTransportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::command_center::transport::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE transport_requests \
         SET transport_mode = COALESCE($1::transport_mode, transport_mode), \
             priority = COALESCE($2, priority), \
             notes = COALESCE($3, notes) \
         WHERE id = $4 AND tenant_id = $5",
    )
    .bind(&body.transport_mode)
    .bind(&body.priority)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "updated" })))
}

pub async fn assign_transport(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignTransportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::command_center::transport::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    sqlx::query(
        "UPDATE transport_requests \
         SET assigned_to = $1, assigned_at = $2, status = 'assigned'::transport_status \
         WHERE id = $3 AND tenant_id = $4",
    )
    .bind(body.assigned_to)
    .bind(now)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "assigned" })))
}

pub async fn complete_transport(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::command_center::transport::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    sqlx::query(
        "UPDATE transport_requests \
         SET completed_at = $1, status = 'completed'::transport_status \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(now)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "completed" })))
}

// ══════════════════════════════════════════════════════════
//  KPIs
// ══════════════════════════════════════════════════════════

#[derive(sqlx::FromRow)]
struct FloatRow {
    value: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct TwoFloatRow {
    numerator: Option<f64>,
    denominator: Option<f64>,
}

pub async fn all_kpis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<KpiTile>>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut kpis = Vec::new();

    // ALOS (Average Length of Stay)
    let alos = sqlx::query_as::<_, FloatRow>(
        "SELECT AVG(EXTRACT(EPOCH FROM (discharged_at - admitted_at)) / 86400.0)::float8 \
           AS value \
         FROM admissions WHERE tenant_id = $1 \
           AND discharged_at IS NOT NULL \
           AND discharged_at >= now() - INTERVAL '30 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    kpis.push(KpiTile {
        code: "alos".into(),
        label: "Avg Length of Stay".into(),
        value: alos.value.unwrap_or(0.0),
        unit: "days".into(),
        trend: None,
        period: "30d".into(),
    });

    // Bed Occupancy %
    let occ = sqlx::query_as::<_, TwoFloatRow>(
        "SELECT \
           COUNT(*) FILTER (WHERE status::text = 'occupied')::float8 AS numerator, \
           NULLIF(COUNT(*), 0)::float8 AS denominator \
         FROM locations WHERE tenant_id = $1 AND location_type::text = 'bed'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let occ_pct = match (occ.numerator, occ.denominator) {
        (Some(n), Some(d)) if d > 0.0 => n * 100.0 / d,
        _ => 0.0,
    };
    kpis.push(KpiTile {
        code: "bed_occupancy".into(),
        label: "Bed Occupancy".into(),
        value: occ_pct,
        unit: "%".into(),
        trend: None,
        period: "now".into(),
    });

    // ER Census
    let er = sqlx::query_as::<_, FloatRow>(
        "SELECT COUNT(*)::float8 AS value FROM er_visits \
         WHERE tenant_id = $1 \
           AND status::text IN ('registered','triaged','in_treatment','observation')",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    kpis.push(KpiTile {
        code: "er_census".into(),
        label: "ER Census".into(),
        value: er.value.unwrap_or(0.0),
        unit: "patients".into(),
        trend: None,
        period: "now".into(),
    });

    // Pending Discharges
    let pd = sqlx::query_as::<_, FloatRow>(
        "SELECT COUNT(*)::float8 AS value FROM admissions \
         WHERE tenant_id = $1 AND status::text = 'admitted' \
           AND expected_discharge_date IS NOT NULL \
           AND expected_discharge_date <= CURRENT_DATE + INTERVAL '48 hours'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    kpis.push(KpiTile {
        code: "pending_discharges".into(),
        label: "Pending Discharges".into(),
        value: pd.value.unwrap_or(0.0),
        unit: "patients".into(),
        trend: None,
        period: "48h".into(),
    });

    // Mortality Rate (last 30 days)
    let mort = sqlx::query_as::<_, TwoFloatRow>(
        "SELECT \
           COUNT(*) FILTER (WHERE discharge_disposition = 'expired')::float8 AS numerator, \
           NULLIF(COUNT(*), 0)::float8 AS denominator \
         FROM admissions WHERE tenant_id = $1 \
           AND discharged_at IS NOT NULL \
           AND discharged_at >= now() - INTERVAL '30 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let mort_pct = match (mort.numerator, mort.denominator) {
        (Some(n), Some(d)) if d > 0.0 => n * 100.0 / d,
        _ => 0.0,
    };
    kpis.push(KpiTile {
        code: "mortality_rate".into(),
        label: "Mortality Rate".into(),
        value: mort_pct,
        unit: "%".into(),
        trend: None,
        period: "30d".into(),
    });

    tx.commit().await?;
    Ok(Json(kpis))
}

pub async fn kpi_detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::command_center::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let detail = match code.as_str() {
        "alos" => {
            let rows = sqlx::query_as::<_, HourlyFlowRow>(
                "WITH days AS ( \
                   SELECT generate_series(0, 29) AS d \
                 ) \
                 SELECT d.d::int4 AS hour, \
                   COALESCE((SELECT COUNT(*) FROM admissions \
                     WHERE tenant_id = $1 \
                     AND admitted_at::date = (CURRENT_DATE - d.d * INTERVAL '1 day')::date), 0) \
                     AS admissions, \
                   COALESCE((SELECT COUNT(*) FROM admissions \
                     WHERE tenant_id = $1 \
                     AND discharged_at::date = (CURRENT_DATE - d.d * INTERVAL '1 day')::date), 0) \
                     AS discharges, \
                   0::int8 AS er_arrivals, 0::int8 AS opd_visits \
                 FROM days d ORDER BY d.d",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?;
            serde_json::json!({ "code": "alos", "daily_breakdown": rows })
        }
        "bed_occupancy" => {
            let rows = sqlx::query_as::<_, DepartmentLoadRow>(
                "SELECT d.id AS department_id, d.name AS department_name, \
                   COALESCE(COUNT(l.id), 0) AS bed_total, \
                   COALESCE(COUNT(l.id) FILTER (WHERE l.status::text = 'occupied'), 0) \
                     AS bed_occupied, \
                   CASE WHEN COUNT(l.id) = 0 THEN 0 \
                     ELSE (COUNT(l.id) FILTER (WHERE l.status::text = 'occupied'))::float8 \
                       * 100.0 / COUNT(l.id)::float8 END AS occupancy_pct, \
                   0::int8 AS queue_depth, 0::float8 AS avg_wait_mins \
                 FROM departments d \
                 LEFT JOIN locations l ON l.department_id = d.id \
                   AND l.location_type::text = 'bed' AND l.tenant_id = $1 \
                 WHERE d.tenant_id = $1 \
                 GROUP BY d.id, d.name ORDER BY d.name",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?;
            serde_json::json!({ "code": "bed_occupancy", "by_department": rows })
        }
        _ => {
            serde_json::json!({ "code": code, "detail": "not_available" })
        }
    };

    tx.commit().await?;
    Ok(Json(detail))
}
