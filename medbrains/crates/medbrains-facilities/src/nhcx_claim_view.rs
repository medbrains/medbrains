//! Reading a claim's NHCX state back: the lines the final claim sent, the
//! payer's adjudication of them, and every Task asked about the claim; and
//! the desk's recent searches with what the payers answered.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const TASK_COLUMNS: &str = "id, kind, insurance_claim_id, prior_auth_id, recipient_code, request, \
     nhcx_status, nhcx_disposition, nhcx_submitted_at, nhcx_response_at, result, created_at";
const MAX_TASKS: i64 = 50;
const MAX_SEARCHES: i64 = 20;

/// A status, search, cancel or reprocess request and the payer's answer.
#[derive(Debug, Serialize, FromRow)]
pub struct NhcxTask {
    pub id: Uuid,
    pub kind: String,
    pub insurance_claim_id: Option<Uuid>,
    pub prior_auth_id: Option<Uuid>,
    pub recipient_code: String,
    pub request: Value,
    pub nhcx_status: Option<String>,
    pub nhcx_disposition: Option<String>,
    pub nhcx_submitted_at: Option<DateTime<Utc>>,
    pub nhcx_response_at: Option<DateTime<Utc>>,
    /// The payer's answer, parsed by the callback receiver.
    pub result: Option<Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct ClaimNhcxRow {
    patient_id: Uuid,
    nhcx_use: Option<String>,
    nhcx_pre_auth_ref: Option<String>,
    nhcx_claim_items: Option<Value>,
    nhcx_adjudication: Option<Value>,
    nhcx_adjudicated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ClaimNhcxView {
    pub claim_id: Uuid,
    /// `claim` or `preauthorization` — what was last sent.
    pub nhcx_use: Option<String>,
    pub pre_auth_ref: Option<String>,
    /// The lines the final claim sent, by sequence.
    pub claim_items: Value,
    /// The payer's adjudication: submitted, approved and deducted, overall
    /// and per line, with reasons.
    pub adjudication: Option<Value>,
    pub adjudicated_at: Option<DateTime<Utc>>,
    pub tasks: Vec<NhcxTask>,
}

/// `GET /api/billing/insurance-claims/{id}/nhcx`
///
/// # Errors
/// 403 without `insurance.nhcx.view` or access to the patient; 404 for an
/// unknown claim.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_claim_nhcx(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ClaimNhcxView>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ClaimNhcxRow>(
        "SELECT patient_id, nhcx_use, nhcx_pre_auth_ref, nhcx_claim_items, nhcx_adjudication, \
                nhcx_adjudicated_at \
           FROM insurance_claims WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, row.patient_id).await?;
    let tasks = sqlx::query_as::<_, NhcxTask>(&format!(
        "SELECT {TASK_COLUMNS} FROM nhcx_tasks \
          WHERE tenant_id = $1 AND insurance_claim_id = $2 AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(MAX_TASKS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(ClaimNhcxView {
        claim_id: id,
        nhcx_use: row.nhcx_use,
        pre_auth_ref: row.nhcx_pre_auth_ref,
        claim_items: row.nhcx_claim_items.unwrap_or(Value::Array(Vec::new())),
        adjudication: row.nhcx_adjudication,
        adjudicated_at: row.nhcx_adjudicated_at,
        tasks,
    }))
}

/// `GET /api/insurance/nhcx/searches` — the latest searches sent to payers,
/// newest first, with the claims each payer listed.
///
/// # Errors
/// 403 without `insurance.nhcx.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_searches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<NhcxTask>>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, NhcxTask>(&format!(
        "SELECT {TASK_COLUMNS} FROM nhcx_tasks \
          WHERE tenant_id = $1 AND kind = 'search' AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT $2"
    ))
    .bind(claims.tenant_id)
    .bind(MAX_SEARCHES)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
