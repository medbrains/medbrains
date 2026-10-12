//! Which campaign a patient came through (`patient_acquisition`).
//!
//! Written at registration, by a campaign link, by an enquiry's conversion,
//! or corrected later; read by the patient page and the acquisition reports.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// How the campaign was learned.
#[derive(Debug, Clone, Copy)]
pub enum CapturedVia {
    Registration,
    Link,
    Enquiry,
    Correction,
}

impl CapturedVia {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Registration => "registration",
            Self::Link => "link",
            Self::Enquiry => "enquiry",
            Self::Correction => "correction",
        }
    }
}

/// Record that `patient_id` came through `campaign_id`, replacing what was
/// recorded. A campaign that isn't this hospital's is refused.
pub async fn record(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    campaign_id: Option<Uuid>,
    via: CapturedVia,
    by: Option<Uuid>,
) -> Result<(), AppError> {
    if let Some(campaign) = campaign_id {
        let known: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM mkt_campaigns WHERE id = $1 AND tenant_id = $2)",
        )
        .bind(campaign)
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
        if !known {
            return Err(AppError::BadRequest(
                "Pick one of the hospital's campaigns".to_owned(),
            ));
        }
    }
    sqlx::query(
        "INSERT INTO patient_acquisition (patient_id, tenant_id, campaign_id, captured_via, captured_by) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (patient_id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, \
             captured_via = EXCLUDED.captured_via, captured_by = EXCLUDED.captured_by, \
             captured_at = now(), deleted_at = NULL",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .bind(campaign_id)
    .bind(via.as_str())
    .bind(by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The campaign behind a code from an ad or a link (`?c=DIWALI25`), if it
/// is one of this hospital's.
pub async fn campaign_for_code(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code: &str,
) -> Result<Option<Uuid>, AppError> {
    let code = code.trim();
    if code.is_empty() {
        return Ok(None);
    }
    Ok(sqlx::query_scalar(
        "SELECT id FROM mkt_campaigns WHERE tenant_id = $1 AND upper(code) = upper($2)",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Acquisition {
    pub campaign_id: Option<Uuid>,
    pub campaign_name: Option<String>,
    pub channel: Option<String>,
    pub captured_via: String,
    pub captured_by_name: Option<String>,
    pub captured_at: DateTime<Utc>,
}

/// `GET /api/patients/{id}/acquisition` — where the patient came from;
/// null when nothing was recorded.
pub async fn get_acquisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Option<Acquisition>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Acquisition>(
        "SELECT pa.campaign_id, c.name AS campaign_name, c.channel, pa.captured_via, \
                u.full_name AS captured_by_name, pa.captured_at \
           FROM patient_acquisition pa \
           LEFT JOIN mkt_campaigns c ON c.id = pa.campaign_id \
           LEFT JOIN users u ON u.id = pa.captured_by \
          WHERE pa.patient_id = $1 AND pa.tenant_id = $2 AND pa.deleted_at IS NULL",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct CorrectAcquisition {
    /// The campaign, or null for "none".
    pub campaign_id: Option<Uuid>,
}

/// `PUT /api/patients/{id}/acquisition` — correct where a patient came
/// from; audited with the old and new campaign.
pub async fn correct_acquisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CorrectAcquisition>,
) -> Result<Json<Option<Acquisition>>, AppError> {
    require_permission(&claims, permissions::patients::acquisition::UPDATE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let before: Option<Uuid> = sqlx::query_scalar(
        "SELECT campaign_id FROM patient_acquisition \
          WHERE patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    record(
        &mut tx,
        claims.tenant_id,
        patient_id,
        body.campaign_id,
        CapturedVia::Correction,
        Some(claims.sub),
    )
    .await?;
    let old = serde_json::json!({ "campaign_id": before });
    let new = serde_json::json!({ "campaign_id": body.campaign_id });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "patient.acquisition.corrected",
            entity_type: "patient",
            entity_id: Some(patient_id),
            old_values: Some(&old),
            new_values: Some(&new),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    get_acquisition(State(state), Extension(claims), Path(patient_id)).await
}
