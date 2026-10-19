//! Staff screens for records received through ABDM: a patient's consent
//! requests and the copies other facilities sent, and one copy in full.
//!
//! Every read first erases what is due (bounded), then shows only copies
//! whose consent still stands and whose erase date has not passed — a
//! revoked or expired consent's records are gone from the screen at once.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use super::purge::erase_due;
use super::requests::{AbdmConsentRequest, REQUEST_COLUMNS};
use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    routes::abdm::{abha::abdm_configured, hip::linking::load_patient},
    state::AppState,
};

/// Requests and records listed per patient.
const LIST_LIMIT: i64 = 100;
/// Where a received copy may be read: a standing consent, not yet erased.
const HELD: &str = "x.deleted_at IS NULL AND x.purged_at IS NULL AND x.erase_at > now() \
     AND EXISTS (SELECT 1 FROM abdm_consent_artefacts a WHERE a.id = x.consent_artefact_id \
                  AND a.status = 'GRANTED' AND a.deleted_at IS NULL)";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmReceivedRecordItem {
    pub id: Uuid,
    pub consent_request_id: Uuid,
    pub hi_type: Option<String>,
    pub care_context_reference: String,
    pub source_hip_id: String,
    pub source_hip_name: Option<String>,
    /// The record's own date (its Composition's), when it gives one.
    pub record_date: Option<String>,
    pub title: Option<String>,
    pub received_at: DateTime<Utc>,
    pub erase_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AbdmHiuPatientView {
    pub configured: bool,
    /// Why records cannot be requested, in words for staff.
    pub blocked_reason: Option<String>,
    pub requests: Vec<AbdmConsentRequest>,
    pub records: Vec<AbdmReceivedRecordItem>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmReceivedRecord {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub hi_type: Option<String>,
    pub care_context_reference: String,
    pub source_hip_id: String,
    pub source_hip_name: Option<String>,
    pub received_at: DateTime<Utc>,
    pub erase_at: DateTime<Utc>,
    pub bundle: Value,
}

/// `GET /api/abdm/patients/{patient_id}/received-records`.
///
/// # Errors
/// 403 without `abdm.consent.view` or access to the patient; 404 for an
/// unknown patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn patient_view(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<AbdmHiuPatientView>, AppError> {
    require_permission(&claims, permissions::abdm::consent::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let configured = abdm_configured(&state, claims.tenant_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    erase_due(&mut tx, claims.tenant_id).await?;
    let patient = load_patient(&mut tx, claims.tenant_id, patient_id).await?;
    let requests = sqlx::query_as::<_, AbdmConsentRequest>(&format!(
        "SELECT {REQUEST_COLUMNS} FROM abdm_consent_requests r \
          WHERE r.tenant_id = $1 AND r.patient_id = $2 AND r.deleted_at IS NULL \
          ORDER BY r.requested_at DESC LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let records = sqlx::query_as::<_, AbdmReceivedRecordItem>(&format!(
        "SELECT x.id, x.consent_request_id, x.hi_type, x.care_context_reference, x.source_hip_id, \
                x.source_hip_name, x.bundle->'entry'->0->'resource'->>'date' AS record_date, \
                x.bundle->'entry'->0->'resource'->>'title' AS title, x.received_at, x.erase_at \
           FROM abdm_received_records x \
          WHERE x.tenant_id = $1 AND x.patient_id = $2 AND {HELD} \
          ORDER BY x.source_hip_id, x.received_at DESC LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let blocked_reason = if !configured {
        Some("ABDM is not set up for this hospital".to_owned())
    } else if patient.abha_address.is_none() && patient.link_id.is_some() {
        Some("The patient's ABHA has no ABHA address".to_owned())
    } else {
        patient.blocked_reason().map(str::to_owned)
    };
    Ok(Json(AbdmHiuPatientView {
        configured,
        blocked_reason,
        requests,
        records,
    }))
}

/// `GET /api/abdm/received-records/{id}` — one copy, while it may be held.
///
/// # Errors
/// 403 without `abdm.consent.view` or access to the patient; 404 for an
/// unknown copy, or one whose consent ended or erase date passed.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn received_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AbdmReceivedRecord>, AppError> {
    require_permission(&claims, permissions::abdm::consent::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    erase_due(&mut tx, claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AbdmReceivedRecord>(&format!(
        "SELECT x.id, x.patient_id, x.hi_type, x.care_context_reference, x.source_hip_id, \
                x.source_hip_name, x.received_at, x.erase_at, x.bundle \
           FROM abdm_received_records x WHERE x.tenant_id = $1 AND x.id = $2 AND {HELD}"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let row = row.ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, row.patient_id).await?;
    Ok(Json(row))
}
