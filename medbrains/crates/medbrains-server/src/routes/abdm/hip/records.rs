//! Staff screens for ABDM sharing: a patient's care contexts, consents and
//! transfers, with why a record is not linked; a retry; and the hospital's
//! monthly DHIS picture.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Datelike, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::linking::{load_patient, request_link};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    routes::abdm::abha::abdm_configured, state::AppState,
};

const NOT_SET_UP: &str = "ABDM is not set up for this hospital";
/// DHIS pays only once a month's eligible transactions pass this many.
const DHIS_THRESHOLD: i64 = 100;
const DHIS_RATE_CATEGORY_1: i64 = 10;
const DHIS_RATE_CATEGORY_2: i64 = 5;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmCareContext {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub source_kind: String,
    pub reference_number: String,
    pub display: String,
    pub hi_types: Vec<String>,
    pub record_date: NaiveDate,
    pub link_status: String,
    pub linked_at: Option<DateTime<Utc>>,
    pub linked_via: Option<String>,
    pub last_error: Option<String>,
    pub dhis_category: i16,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmConsentArtefact {
    pub id: Uuid,
    pub consent_id: String,
    pub hiu_id: Option<String>,
    pub purpose_text: Option<String>,
    pub hi_types: Vec<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub data_erase_at: Option<DateTime<Utc>>,
    pub status: String,
    pub notified_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmHealthTransfer {
    pub id: Uuid,
    pub consent_id: String,
    pub entry_count: i32,
    pub status: String,
    pub error: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub transferred_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct AbdmPatientRecords {
    pub configured: bool,
    pub abha_verified: bool,
    pub hip_id: Option<String>,
    /// Why nothing links, in words for staff; `None` when linking can run.
    pub blocked_reason: Option<String>,
    pub care_contexts: Vec<AbdmCareContext>,
    pub consents: Vec<AbdmConsentArtefact>,
    pub transfers: Vec<AbdmHealthTransfer>,
}

const CONTEXT_COLUMNS: &str = "id, patient_id, source_kind, reference_number, display, hi_types, \
     record_date, link_status, linked_at, linked_via, last_error, dhis_category";

/// `GET /api/abdm/patients/{patient_id}/records`.
///
/// # Errors
/// 403 without `abdm.records.view` or access to the patient; 404 for an unknown patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn patient_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<AbdmPatientRecords>, AppError> {
    require_permission(&claims, permissions::abdm::records::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let configured = abdm_configured(&state, claims.tenant_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient = load_patient(&mut tx, claims.tenant_id, patient_id).await?;
    let care_contexts = sqlx::query_as::<_, AbdmCareContext>(&format!(
        "SELECT {CONTEXT_COLUMNS} FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
          ORDER BY record_date DESC, created_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    let consents = sqlx::query_as::<_, AbdmConsentArtefact>(
        "SELECT id, consent_id, hiu_id, purpose_text, hi_types, date_from, date_to, data_erase_at, \
                status, notified_at FROM abdm_consent_artefacts \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
          ORDER BY notified_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    let transfers = sqlx::query_as::<_, AbdmHealthTransfer>(
        "SELECT t.id, a.consent_id, t.entry_count, t.status, t.error, t.requested_at, t.transferred_at \
           FROM abdm_health_transfers t JOIN abdm_consent_artefacts a ON a.id = t.consent_artefact_id \
          WHERE t.tenant_id = $1 AND t.patient_id = $2 AND t.deleted_at IS NULL \
          ORDER BY t.requested_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let blocked_reason = if configured {
        patient.blocked_reason().map(str::to_owned)
    } else {
        Some(NOT_SET_UP.to_owned())
    };
    Ok(Json(AbdmPatientRecords {
        configured,
        abha_verified: patient.link_id.is_some(),
        hip_id: patient.hip_id,
        blocked_reason,
        care_contexts,
        consents,
        transfers,
    }))
}

/// `POST /api/abdm/care-contexts/{id}/link` — link now, or retry. ABDM's
/// refusal or outage is recorded on the care context and shown, not hidden.
///
/// # Errors
/// 403 without `abdm.records.manage` or access to the patient; 404 for an
/// unknown care context.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn link_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AbdmCareContext>, AppError> {
    require_permission(&claims, permissions::abdm::records::MANAGE)?;
    let patient_id = read_context(&state, &claims, id).await?.patient_id;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    match request_link(
        &state.db,
        state.secret_resolver.as_ref(),
        claims.tenant_id,
        id,
    )
    .await
    {
        Ok(()) | Err(AppError::BadRequest(_) | AppError::ServiceUnavailable(_)) => {}
        Err(other) => return Err(other),
    }
    Ok(Json(read_context(&state, &claims, id).await?))
}

async fn read_context(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
) -> Result<AbdmCareContext, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AbdmCareContext>(&format!(
        "SELECT {CONTEXT_COLUMNS} FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    row.ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct SummaryQuery {
    /// `YYYY-MM`; this month (IST) when absent.
    pub month: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmSharingFailure {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub uhid: String,
    pub patient_name: String,
    pub display: String,
    pub link_status: String,
    pub last_error: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmSharingCounts {
    pub linked_category_1: i64,
    pub linked_category_2: i64,
    pub eligible_category_1: i64,
    pub eligible_category_2: i64,
    pub linking: i64,
    pub failed: i64,
    pub not_linked: i64,
    pub transfers: i64,
}

#[derive(Debug, Serialize)]
pub struct AbdmSharingSummary {
    pub month: NaiveDate,
    pub configured: bool,
    pub counts: AbdmSharingCounts,
    pub dhis_threshold: i64,
    pub threshold_met: bool,
    /// What the eligible links would earn once the threshold is passed.
    pub estimated_incentive_inr: i64,
    pub failures: Vec<AbdmSharingFailure>,
}

/// Counts for the month. "Eligible" applies DHIS's rules: KYC-verified ABHAs
/// only, one link per ABHA per day (a category-1 record wins the day), at
/// most five per ABHA per month.
const COUNTS_SQL: &str = "WITH linked AS ( \
       SELECT cc.dhis_category, regexp_replace(l.abha_number, '\\D', '', 'g') AS abha, \
              timezone('Asia/Kolkata', cc.linked_at)::date AS day, l.kyc_verified \
         FROM abdm_care_contexts cc \
         JOIN patient_abha_links l ON l.tenant_id = cc.tenant_id AND l.patient_id = cc.patient_id \
              AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL \
        WHERE cc.tenant_id = $1 AND cc.link_status = 'linked' AND cc.dhis_month = $2 \
          AND cc.deleted_at IS NULL), \
     per_day AS (SELECT abha, day, min(dhis_category) AS cat FROM linked WHERE kyc_verified \
                  GROUP BY abha, day), \
     ranked AS (SELECT cat, row_number() OVER (PARTITION BY abha ORDER BY cat, day) AS rn FROM per_day) \
     SELECT (SELECT count(*) FROM linked WHERE dhis_category = 1) AS linked_category_1, \
            (SELECT count(*) FROM linked WHERE dhis_category = 2) AS linked_category_2, \
            (SELECT count(*) FROM ranked WHERE rn <= 5 AND cat = 1) AS eligible_category_1, \
            (SELECT count(*) FROM ranked WHERE rn <= 5 AND cat = 2) AS eligible_category_2, \
            (SELECT count(*) FROM abdm_care_contexts WHERE tenant_id = $1 AND link_status = 'linking' \
                AND deleted_at IS NULL) AS linking, \
            (SELECT count(*) FROM abdm_care_contexts WHERE tenant_id = $1 AND link_status = 'failed' \
                AND deleted_at IS NULL) AS failed, \
            (SELECT count(*) FROM abdm_care_contexts WHERE tenant_id = $1 AND link_status = 'not_linked' \
                AND deleted_at IS NULL) AS not_linked, \
            (SELECT count(*) FROM abdm_health_transfers WHERE tenant_id = $1 AND status = 'transferred' \
                AND deleted_at IS NULL \
                AND date_trunc('month', timezone('Asia/Kolkata', transferred_at))::date = $2) AS transfers";

fn month_start(month: Option<&str>) -> Result<NaiveDate, AppError> {
    match month {
        Some(m) => NaiveDate::parse_from_str(&format!("{m}-01"), "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("month must be YYYY-MM".to_owned())),
        None => {
            let today = (Utc::now() + chrono::Duration::minutes(330)).date_naive();
            NaiveDate::from_ymd_opt(today.year(), today.month(), 1)
                .ok_or_else(|| AppError::Internal("no first of the month".to_owned()))
        }
    }
}

/// `GET /api/abdm/sharing/summary` — the month's linking, DHIS and failures.
///
/// # Errors
/// 403 without `abdm.records.view`; 400 for a malformed month.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn sharing_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SummaryQuery>,
) -> Result<Json<AbdmSharingSummary>, AppError> {
    require_permission(&claims, permissions::abdm::records::VIEW)?;
    let month = month_start(q.month.as_deref())?;
    let configured = abdm_configured(&state, claims.tenant_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let counts = sqlx::query_as::<_, AbdmSharingCounts>(COUNTS_SQL)
        .bind(claims.tenant_id)
        .bind(month)
        .fetch_one(&mut *tx)
        .await?;
    let failures = sqlx::query_as::<_, AbdmSharingFailure>(
        "SELECT cc.id, cc.patient_id, p.uhid, btrim(p.first_name || ' ' || p.last_name) AS patient_name, \
                cc.display, cc.link_status, cc.last_error, cc.updated_at \
           FROM abdm_care_contexts cc JOIN patients p ON p.id = cc.patient_id \
          WHERE cc.tenant_id = $1 AND cc.deleted_at IS NULL \
            AND (cc.link_status = 'failed' OR (cc.link_status = 'not_linked' AND cc.last_error IS NOT NULL)) \
          ORDER BY cc.updated_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let eligible = counts.eligible_category_1 + counts.eligible_category_2;
    Ok(Json(AbdmSharingSummary {
        month,
        configured,
        dhis_threshold: DHIS_THRESHOLD,
        threshold_met: eligible > DHIS_THRESHOLD,
        estimated_incentive_inr: counts.eligible_category_1 * DHIS_RATE_CATEGORY_1
            + counts.eligible_category_2 * DHIS_RATE_CATEGORY_2,
        counts,
        failures,
    }))
}
