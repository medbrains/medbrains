//! NHCX coverage eligibility: ask the payer whether a patient's policy is in
//! force and what it still covers, and read back the answer.
//!
//! A check is an `insurance_verifications` row that waits as `pending` until
//! the payer's `on_check` reply lands (the callback receiver parses it into
//! `nhcx_result`). Waiting is never reported as "not covered".

use axum::Json;
use axum::extract::{Extension, Query, State};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{BENEFIT_CATEGORIES, NhcxOperation, NhcxRecord};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_bundle::{self, Parties};
use crate::nhcx_common::{self, Outbound};

#[derive(Debug, Deserialize)]
pub struct CheckNhcxEligibilityRequest {
    pub patient_id: Uuid,
    /// The policy to check; the patient's first active policy when absent.
    pub patient_insurance_id: Option<Uuid>,
    /// The payer's HCX participant code.
    pub recipient_code: String,
    /// Where the check was run: `front_office`, `claim`, `admission`…
    pub trigger_point: Option<String>,
    pub trigger_entity_id: Option<Uuid>,
    /// HL7 benefit category codes to ask about; plan coverage when absent.
    pub service_categories: Option<Vec<String>>,
}

/// An NHCX eligibility check as the desk sees it.
#[derive(Debug, Serialize, FromRow)]
pub struct NhcxEligibilityCheck {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub trigger_point: String,
    /// `pending` until the payer answers; then `active`, `inactive`,
    /// `unknown` or `error`.
    pub status: String,
    pub payer_name: Option<String>,
    pub nhcx_recipient_code: Option<String>,
    /// Where the message stands: `queued`, `sent`, `send_failed`, `response.*`.
    pub nhcx_status: Option<String>,
    pub nhcx_disposition: Option<String>,
    /// The parsed answer — in force, benefit lines, period, errors.
    pub nhcx_result: Option<Value>,
    pub coverage_start: Option<NaiveDate>,
    pub coverage_end: Option<NaiveDate>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub nhcx_submitted_at: Option<DateTime<Utc>>,
    pub nhcx_response_at: Option<DateTime<Utc>>,
}

const CHECK_COLUMNS: &str = "id, patient_id, trigger_point, status::text AS status, payer_name, \
     nhcx_recipient_code, nhcx_status, nhcx_disposition, nhcx_result, coverage_start, \
     coverage_end, error_message, created_at, nhcx_submitted_at, nhcx_response_at";

/// The categories asked about, `(code, display)`, from the closed list.
fn categories(codes: Option<&[String]>) -> Result<Vec<(&'static str, &'static str)>, AppError> {
    let codes = codes.filter(|c| !c.is_empty());
    let Some(codes) = codes else {
        return Ok(BENEFIT_CATEGORIES
            .iter()
            .filter(|(c, _)| *c == "30")
            .copied()
            .collect());
    };
    codes
        .iter()
        .take(BENEFIT_CATEGORIES.len())
        .map(|code| {
            BENEFIT_CATEGORIES
                .iter()
                .find(|(c, _)| c == code)
                .copied()
                .ok_or_else(|| AppError::BadRequest(format!("unknown service category {code}")))
        })
        .collect()
}

/// `POST /api/insurance/verifications/nhcx` — ask the payer, through NHCX,
/// whether the patient's policy is in force.
///
/// # Errors
/// 503 until the hospital is onboarded to NHCX; 400 for a payer without an
/// encryption certificate, a patient with no policy, or an unknown service
/// category; 403 without `insurance.nhcx.submit` or access to the patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn check_nhcx_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CheckNhcxEligibilityRequest>,
) -> Result<Json<NhcxEligibilityCheck>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let recipient = nhcx_common::required_recipient(&body.recipient_code)?;
    let asked = categories(body.service_categories.as_deref())?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    nhcx_common::require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    // Asking a payer about a named person's policy discloses that person.
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, body.patient_id).await?;
    nhcx_common::require_payer_certificate(&mut tx, claims.tenant_id, recipient).await?;
    let patient = nhcx_common::load_patient(&mut tx, claims.tenant_id, body.patient_id).await?;
    let (policy_id, policy) = nhcx_common::load_policy(
        &mut tx,
        claims.tenant_id,
        body.patient_id,
        body.patient_insurance_id,
    )
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("this patient has no insurance policy on file — add it first".into())
    })?;
    let provider = nhcx_common::load_provider(&mut tx, claims.tenant_id).await?;
    // NRCeS makes `enterer` 1..1: the staff member asking.
    let enterer = nhcx_common::load_doctor(&mut tx, claims.tenant_id, Some(claims.sub)).await?;

    // A request's correlation id is its own api call id.
    let api_call_id = Uuid::new_v4();
    let correlation_id = api_call_id;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO insurance_verifications \
             (tenant_id, patient_id, patient_insurance_id, trigger_point, trigger_entity_id, \
              status, payer_name, payer_id, verified_by, nhcx_correlation_id, nhcx_api_call_id, \
              nhcx_recipient_code, nhcx_status) \
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $7, 'queued') \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(policy_id)
    .bind(body.trigger_point.as_deref().unwrap_or("manual"))
    .bind(body.trigger_entity_id)
    .bind(&policy.insurance_provider)
    .bind(recipient)
    .bind(claims.sub)
    .bind(correlation_id)
    .bind(api_call_id)
    .fetch_one(&mut *tx)
    .await?;

    let parties = Parties {
        patient: &patient,
        policy: &policy,
        provider: &provider,
        doctor: enterer.as_ref(),
        recipient,
    };
    let bundle = nhcx_bundle::eligibility_bundle(&parties, id, &asked);
    let msg = Outbound {
        record: NhcxRecord::Verification,
        record_id: id,
        operation: NhcxOperation::CoverageEligibility,
        recipient,
        correlation_id,
        api_call_id,
        // The Workflow Status Sheet gives eligibility no step code.
        workflow_id: None,
        payload: &bundle,
    };
    nhcx_common::queue(&mut tx, &claims, &msg).await?;
    let sql = format!(
        "SELECT {CHECK_COLUMNS} FROM insurance_verifications WHERE id = $1 AND tenant_id = $2"
    );
    let row = sqlx::query_as::<_, NhcxEligibilityCheck>(&sql)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct EligibilityQuery {
    pub patient_id: Uuid,
}

/// `GET /api/insurance/nhcx/eligibility?patient_id=` — the patient's latest
/// NHCX eligibility checks, newest first.
///
/// # Errors
/// 403 without `insurance.nhcx.view` or access to the patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_nhcx_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<EligibilityQuery>,
) -> Result<Json<Vec<NhcxEligibilityCheck>>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, q.patient_id).await?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let sql = format!(
        "SELECT {CHECK_COLUMNS} FROM insurance_verifications \
         WHERE tenant_id = $1 AND patient_id = $2 AND nhcx_correlation_id IS NOT NULL \
           AND deleted_at IS NULL \
         ORDER BY created_at DESC LIMIT 5"
    );
    let rows = sqlx::query_as::<_, NhcxEligibilityCheck>(&sql)
        .bind(claims.tenant_id)
        .bind(q.patient_id)
        .fetch_all(&mut *conn)
        .await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn categories_default_to_plan_coverage_and_refuse_unknown_codes() {
        assert!(matches!(categories(None).as_deref(), Ok([("30", _)])));
        let asked = categories(Some(&["49".to_owned(), "2".to_owned()]));
        assert!(matches!(asked.as_deref(), Ok([("49", _), ("2", _)])));
        assert!(categories(Some(&["999".to_owned()])).is_err());
    }
}
