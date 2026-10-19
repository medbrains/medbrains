//! The IRDAI turnaround across pre-authorisations: each request's clock,
//! and the breaches by payer for the insurance desk's supervisor.

use std::collections::HashMap;

use axum::Json;
use axum::extract::{Extension, Query, State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{PreauthSla, SlaState, preauth_sla};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SlaQuery {
    /// One patient's requests (any age); otherwise the last 30 days.
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, FromRow)]
struct SlaSource {
    prior_auth_id: Uuid,
    pa_number: String,
    patient_id: Uuid,
    request_stage: String,
    status: String,
    nhcx_status: Option<String>,
    payer_code: Option<String>,
    payer_name: Option<String>,
    received_at: Option<DateTime<Utc>>,
    responded_at: Option<DateTime<Utc>>,
    open_queries: i64,
}

/// One pre-authorisation against its clock.
#[derive(Debug, Serialize)]
pub struct NhcxPreauthSlaRow {
    pub prior_auth_id: Uuid,
    pub pa_number: String,
    pub patient_id: Uuid,
    pub request_stage: String,
    pub status: String,
    pub nhcx_status: Option<String>,
    pub payer_code: Option<String>,
    pub payer_name: Option<String>,
    pub received_at: Option<DateTime<Utc>>,
    pub decided_at: Option<DateTime<Utc>>,
    pub open_queries: i64,
    pub sla: PreauthSla,
}

/// Breaches per payer.
#[derive(Debug, Default, Serialize)]
pub struct NhcxPayerSla {
    pub payer_code: Option<String>,
    pub payer_name: Option<String>,
    pub total: i64,
    pub breached: i64,
    pub running: i64,
}

#[derive(Debug, Serialize)]
pub struct NhcxSlaReport {
    pub rows: Vec<NhcxPreauthSlaRow>,
    pub by_payer: Vec<NhcxPayerSla>,
}

const MAX_SOURCE_ROWS: i64 = 2000;
const MAX_RETURNED_ROWS: usize = 200;

fn by_payer(rows: &[NhcxPreauthSlaRow]) -> Vec<NhcxPayerSla> {
    let mut groups: HashMap<Option<&str>, NhcxPayerSla> = HashMap::new();
    for r in rows.iter().filter(|r| r.sla.state != SlaState::NotStarted) {
        let g = groups
            .entry(r.payer_code.as_deref())
            .or_insert_with(|| NhcxPayerSla {
                payer_code: r.payer_code.clone(),
                payer_name: r.payer_name.clone(),
                ..NhcxPayerSla::default()
            });
        g.total += 1;
        g.breached += i64::from(r.sla.state == SlaState::Breached);
        g.running += i64::from(r.sla.state == SlaState::Running);
    }
    let mut out: Vec<NhcxPayerSla> = groups.into_values().collect();
    out.sort_by(|a, b| b.breached.cmp(&a.breached).then(b.total.cmp(&a.total)));
    out
}

/// `GET /api/insurance/nhcx/sla` — each pre-authorisation's IRDAI clock
/// (breached and waiting first) and the breaches by payer.
///
/// # Errors
/// 403 without `insurance.nhcx.view`, or for a patient the caller may not see.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_nhcx_sla(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SlaQuery>,
) -> Result<Json<NhcxSlaReport>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    // With ?patient_id one patient's requests, without it every patient's:
    // both resolve to the set the caller may see.
    let permitted = medbrains_authz_gate::patient_filter(&state, &claims, q.patient_id).await?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let source = sqlx::query_as::<_, SlaSource>(
        "SELECT p.id AS prior_auth_id, p.pa_number, p.patient_id, p.request_stage, \
                p.status::text AS status, p.nhcx_status, p.nhcx_recipient_code AS payer_code, \
                n.participant_name AS payer_name, \
                COALESCE(p.nhcx_submitted_at, p.submitted_at) AS received_at, p.responded_at, \
                (SELECT count(*) FROM nhcx_payer_queries q WHERE q.prior_auth_id = p.id \
                   AND q.status = 'open' AND q.deleted_at IS NULL) AS open_queries \
         FROM prior_auth_requests p \
         LEFT JOIN nhcx_participants n \
           ON n.tenant_id = p.tenant_id AND n.participant_code = p.nhcx_recipient_code \
         WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.submitted_at IS NOT NULL \
           AND ($2::uuid[] IS NULL OR p.patient_id = ANY($2)) \
           AND ($3::uuid IS NOT NULL OR p.submitted_at > now() - interval '30 days') \
         ORDER BY p.submitted_at DESC LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(permitted.as_deref())
    .bind(q.patient_id)
    .bind(MAX_SOURCE_ROWS)
    .fetch_all(&mut *conn)
    .await?;
    let now = Utc::now();
    let mut rows: Vec<NhcxPreauthSlaRow> = source
        .into_iter()
        .map(|s| {
            let sla = preauth_sla(
                s.request_stage == "discharge",
                s.received_at,
                s.responded_at,
                now,
            );
            NhcxPreauthSlaRow {
                prior_auth_id: s.prior_auth_id,
                pa_number: s.pa_number,
                patient_id: s.patient_id,
                request_stage: s.request_stage,
                status: s.status,
                nhcx_status: s.nhcx_status,
                payer_code: s.payer_code,
                payer_name: s.payer_name,
                received_at: s.received_at,
                decided_at: s.responded_at,
                open_queries: s.open_queries,
                sla,
            }
        })
        .collect();
    let by_payer = by_payer(&rows);
    let rank = |s: SlaState| match s {
        SlaState::Breached => 0,
        SlaState::Running => 1,
        SlaState::Met => 2,
        SlaState::NotStarted => 3,
    };
    rows.sort_by_key(|r| (rank(r.sla.state), std::cmp::Reverse(r.sla.elapsed_minutes)));
    rows.truncate(MAX_RETURNED_ROWS);
    Ok(Json(NhcxSlaReport { rows, by_payer }))
}
