//! Doctor "My Day" composite dashboard.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.5. One endpoint
//! returns everything the doctor needs to see when they log in.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::Serialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct MyDayResponse {
    pub doctor_user_id: Uuid,
    pub today: TodayCounts,
    pub pending_signoffs: PendingSignoffs,
    pub on_call: OnCallStatus,
    pub coverage: Vec<CoverageEntry>,
}

#[derive(Debug, Serialize, Default)]
pub struct TodayCounts {
    pub appointments_total: i64,
    pub appointments_remaining: i64,
    pub ot_cases: i64,
    pub ipd_patients_under_care: i64,
    pub critical_alerts: i64,
}

#[derive(Debug, Serialize, Default)]
pub struct PendingSignoffs {
    pub clinical: i64,
    pub medico_legal: i64,
    pub overdue: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, Default)]
pub struct OnCallStatus {
    pub is_on_call_now: bool,
    pub next_on_call_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CoverageEntry {
    pub absent_doctor_id: Uuid,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub reason: Option<String>,
}

pub async fn my_day(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MyDayResponse>, AppError> {
    require_permission(&claims, permissions::doctor::dashboard::VIEW_OWN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Pending sign-offs by legal_class. Best-effort across record types
    // (some tables may not yet have is_signed column — falls back to 0).
    let pending = compute_pending_signoffs(&mut tx, &claims).await?;

    // Coverage assignments where I'm covering for someone else right now
    let coverage: Vec<CoverageEntry> = sqlx::query_as(
        "SELECT absent_doctor_id, start_at, end_at, reason \
         FROM doctor_coverage_assignments \
         WHERE tenant_id = $1 AND covering_doctor_id = $2 \
           AND start_at <= now() AND end_at > now() \
         ORDER BY start_at LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    // Today counts — best-effort against existing tables
    let today = compute_today_counts(&mut tx, &claims)
        .await
        .unwrap_or_default();

    tx.commit().await?;

    Ok(Json(MyDayResponse {
        doctor_user_id: claims.sub,
        today,
        pending_signoffs: pending,
        on_call: OnCallStatus::default(),
        coverage,
    }))
}

async fn compute_pending_signoffs(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
) -> Result<PendingSignoffs, AppError> {
    let mut p = PendingSignoffs::default();

    // prescriptions
    if let Ok((c,)) = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM prescriptions \
         WHERE tenant_id = $1 AND doctor_id = $2 AND is_signed = FALSE",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await
    {
        p.clinical += c;
        p.total += c;
    }

    // lab_results — finalized but not signed
    if let Ok((c,)) = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM lab_results \
         WHERE tenant_id = $1 AND is_signed = FALSE",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut **tx)
    .await
    {
        p.clinical += c;
        p.total += c;
    }

    // IPD discharge summaries
    if let Ok((c,)) = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM ipd_discharge_summaries \
         WHERE tenant_id = $1 AND is_signed = FALSE \
           AND (prepared_by = $2 OR verified_by = $2)",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await
    {
        p.clinical += c;
        p.total += c;
    }

    Ok(p)
}

async fn compute_today_counts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
) -> Result<TodayCounts, AppError> {
    let mut t = TodayCounts::default();

    // OPD appointments today (best-effort, table may have different shape)
    if let Ok((total, remaining)) = sqlx::query_as::<_, (i64, i64)>(
        "SELECT \
            COUNT(*)::bigint, \
            COUNT(*) FILTER (WHERE status IN ('scheduled','confirmed','arrived'))::bigint \
         FROM opd_appointments \
         WHERE tenant_id = $1 AND doctor_id = $2 \
           AND appointment_date = current_date",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await
    {
        t.appointments_total = total;
        t.appointments_remaining = remaining;
    }

    Ok(t)
}

// ══════════════════════════════════════════════════════════
//  Pending sign-offs detail (drill-down list)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingSignoffEntry {
    pub record_type: String,
    pub record_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub legal_class: String,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub summary: Option<String>,
    pub context: Option<String>,
    pub risk_label: Option<String>,
    /// "written" | "verbal" | "telephone" (prescriptions only; null elsewhere).
    pub order_mode: Option<String>,
    /// 24h countersign deadline for a verbal/telephone order (prescriptions only).
    pub countersign_due_at: Option<DateTime<Utc>>,
    /// True when a nurse transcribed the order on the doctor's behalf.
    pub transcribed: Option<bool>,
}

pub async fn list_my_pending_signoffs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingSignoffEntry>>, AppError> {
    require_permission(&claims, permissions::doctor::signoffs::VIEW_OWN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Union across signable types. Each table queried independently and
    // tolerantly — a missing is_signed column won't kill the whole list.
    let mut entries: Vec<PendingSignoffEntry> = Vec::new();

    if let Ok(rows) = sqlx::query_as::<_, PendingSignoffEntry>(
        "SELECT 'prescription' AS record_type, p.id AS record_id, \
                p.created_at, 'clinical' AS legal_class, \
                COALESCE(p.patient_id, e.patient_id) AS patient_id, \
                CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name) AS patient_name, \
                pat.uhid, \
                COALESCE(NULLIF(p.notes, ''), CONCAT(( \
                    SELECT COUNT(*) FROM prescription_items pi \
                    WHERE pi.tenant_id = p.tenant_id AND pi.prescription_id = p.id \
                ), ' medication(s)')) AS summary, \
                CONCAT('Encounter ', p.encounter_id::text) AS context, \
                CASE WHEN pat.is_medico_legal THEN 'MLC patient' ELSE NULL END AS risk_label, \
                p.order_mode AS order_mode, \
                p.countersign_due_at AS countersign_due_at, \
                (p.transcribed_by IS NOT NULL) AS transcribed \
         FROM prescriptions p \
         LEFT JOIN encounters e ON e.tenant_id = p.tenant_id AND e.id = p.encounter_id \
         LEFT JOIN patients pat ON pat.tenant_id = p.tenant_id \
            AND pat.id = COALESCE(p.patient_id, e.patient_id) \
         WHERE p.tenant_id = $1 AND p.doctor_id = $2 AND p.is_signed = FALSE \
         ORDER BY p.created_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await
    {
        entries.extend(rows);
    }

    if let Ok(rows) = sqlx::query_as::<_, PendingSignoffEntry>(
        "SELECT 'lab_report' AS record_type, lr.id AS record_id, \
                lr.created_at, 'clinical' AS legal_class, \
                lo.patient_id, \
                CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name) AS patient_name, \
                pat.uhid, \
                CONCAT(lr.parameter_name, ': ', lr.value, COALESCE(CONCAT(' ', lr.unit), '')) AS summary, \
                CONCAT('Sample ', COALESCE(lo.sample_barcode, 'not collected'), ' • ', lo.priority::text) AS context, \
                CASE \
                    WHEN lr.flag IS NOT NULL AND lr.flag::text <> 'normal' THEN CONCAT('Result flag: ', lr.flag::text) \
                    WHEN lo.is_stat THEN 'STAT order' \
                    WHEN pat.is_medico_legal THEN 'MLC patient' \
                    ELSE NULL \
                END AS risk_label, \
                NULL::text AS order_mode, NULL::timestamptz AS countersign_due_at, NULL::boolean AS transcribed \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.tenant_id = lr.tenant_id AND lo.id = lr.order_id \
         JOIN patients pat ON pat.tenant_id = lo.tenant_id AND pat.id = lo.patient_id \
         WHERE lr.tenant_id = $1 AND lr.is_signed = FALSE \
         ORDER BY lr.created_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    {
        entries.extend(rows);
    }

    if let Ok(rows) = sqlx::query_as::<_, PendingSignoffEntry>(
        "SELECT 'radiology_report' AS record_type, rr.id AS record_id, \
                rr.created_at, 'clinical' AS legal_class, \
                ro.patient_id, \
                CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name) AS patient_name, \
                pat.uhid, \
                COALESCE(NULLIF(rr.impression, ''), NULLIF(rr.findings, ''), 'Radiology report') AS summary, \
                CONCAT(COALESCE(ro.body_part, 'Study'), ' • ', ro.priority::text) AS context, \
                CASE \
                    WHEN rr.is_critical THEN 'Critical report' \
                    WHEN ro.contrast_required THEN 'Contrast study' \
                    WHEN ro.allergy_flagged THEN 'Allergy flag' \
                    WHEN pat.is_medico_legal THEN 'MLC patient' \
                    ELSE NULL \
                END AS risk_label, \
                NULL::text AS order_mode, NULL::timestamptz AS countersign_due_at, NULL::boolean AS transcribed \
         FROM radiology_reports rr \
         JOIN radiology_orders ro ON ro.tenant_id = rr.tenant_id AND ro.id = rr.order_id \
         JOIN patients pat ON pat.tenant_id = ro.tenant_id AND pat.id = ro.patient_id \
         WHERE rr.tenant_id = $1 AND rr.is_signed = FALSE \
         ORDER BY rr.created_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    {
        entries.extend(rows);
    }

    if let Ok(rows) = sqlx::query_as::<_, PendingSignoffEntry>(
        "SELECT 'discharge_summary' AS record_type, ds.id AS record_id, \
                ds.created_at, 'clinical' AS legal_class, \
                a.patient_id, \
                CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name) AS patient_name, \
                pat.uhid, \
                COALESCE(NULLIF(ds.final_diagnosis, ''), ds.status::text) AS summary, \
                CONCAT('IPD ', a.status::text, ' • admitted ', a.admitted_at::date::text) AS context, \
                CASE \
                    WHEN a.is_critical THEN 'Critical admission' \
                    WHEN a.isolation_required THEN 'Isolation required' \
                    WHEN pat.is_medico_legal THEN 'MLC patient' \
                    ELSE NULL \
                END AS risk_label, \
                NULL::text AS order_mode, NULL::timestamptz AS countersign_due_at, NULL::boolean AS transcribed \
         FROM ipd_discharge_summaries ds \
         JOIN admissions a ON a.tenant_id = ds.tenant_id AND a.id = ds.admission_id \
         JOIN patients pat ON pat.tenant_id = a.tenant_id AND pat.id = a.patient_id \
         WHERE ds.tenant_id = $1 AND ds.is_signed = FALSE \
           AND (ds.prepared_by = $2 OR ds.verified_by = $2) \
         ORDER BY ds.created_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await
    {
        entries.extend(rows);
    }

    tx.commit().await?;
    // Verbal/telephone orders carry a 24h countersign deadline — surface them
    // first, soonest (and overdue) deadline at the top; everything else by age.
    let is_countersign = |e: &PendingSignoffEntry| {
        matches!(e.order_mode.as_deref(), Some("verbal" | "telephone"))
    };
    entries.sort_by(|a, b| match (is_countersign(a), is_countersign(b)) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        (true, true) => a.countersign_due_at.cmp(&b.countersign_due_at),
        (false, false) => a.created_at.cmp(&b.created_at),
    });
    Ok(Json(entries))
}
