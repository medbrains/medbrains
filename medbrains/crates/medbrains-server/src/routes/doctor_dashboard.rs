//! Doctor "My Day" composite dashboard.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.5. One endpoint
//! returns everything the doctor needs to see when they log in.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::Serialize;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
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
         ORDER BY start_at",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    // Today counts — best-effort against existing tables
    let today = compute_today_counts(&mut tx, &claims).await.unwrap_or_default();

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

    // discharge_summaries
    if let Ok((c,)) = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM discharge_summaries \
         WHERE tenant_id = $1 AND is_signed = FALSE",
    )
    .bind(claims.tenant_id)
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
        "SELECT 'prescription' AS record_type, id AS record_id, \
                created_at, 'clinical' AS legal_class \
         FROM prescriptions \
         WHERE tenant_id = $1 AND doctor_id = $2 AND is_signed = FALSE \
         ORDER BY created_at \
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
        "SELECT 'lab_report' AS record_type, id AS record_id, \
                created_at, 'clinical' AS legal_class \
         FROM lab_results \
         WHERE tenant_id = $1 AND is_signed = FALSE \
         ORDER BY created_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    {
        entries.extend(rows);
    }

    if let Ok(rows) = sqlx::query_as::<_, PendingSignoffEntry>(
        "SELECT 'discharge_summary' AS record_type, id AS record_id, \
                created_at, 'clinical' AS legal_class \
         FROM discharge_summaries \
         WHERE tenant_id = $1 AND is_signed = FALSE \
         ORDER BY created_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    {
        entries.extend(rows);
    }

    tx.commit().await?;
    entries.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(Json(entries))
}
