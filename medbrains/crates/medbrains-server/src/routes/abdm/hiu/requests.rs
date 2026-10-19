//! A doctor asks for a patient's records held by other facilities.
//!
//! The request goes to the patient's consent manager in the doctor's name and
//! HPR ID, as this hospital's HIU ID (the main campus's HFR facility ID, the
//! same one records are shared as). The patient decides in their PHR app; the
//! answer arrives at the HIU callbacks.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use medbrains_abdm::gateway::CONSENT_INIT_PATH;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::scope::{clean_hi_types, purpose_text};
use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    routes::abdm::hip::{
        gateway::Hip,
        linking::{load_patient, message},
    },
    state::AppState,
};

/// The longest a received copy may be kept (DPDP: no longer than needed).
const MAX_KEEP_DAYS: i64 = 365;
const NO_HPR: &str =
    "Record your HPR ID on your doctor profile first — ABDM shows the patient who is asking";

#[derive(Debug, Deserialize)]
pub struct RaiseConsentRequest {
    pub purpose_code: String,
    pub hi_types: Vec<String>,
    pub date_from: DateTime<Utc>,
    pub date_to: DateTime<Utc>,
    /// When the copies must be erased (ABDM's `dataEraseAt`).
    pub data_erase_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmConsentRequest {
    pub id: Uuid,
    pub purpose_code: String,
    pub hi_types: Vec<String>,
    pub date_from: DateTime<Utc>,
    pub date_to: DateTime<Utc>,
    pub data_erase_at: DateTime<Utc>,
    pub status: String,
    pub error: Option<String>,
    pub requester_name: String,
    pub requested_at: DateTime<Utc>,
    pub status_at: DateTime<Utc>,
    /// When ABDM was last asked where the request stands (`on-status`).
    pub status_checked_at: Option<DateTime<Utc>>,
    pub records_received: i64,
    pub records_held: i64,
}

pub(super) const REQUEST_COLUMNS: &str = "r.id, r.purpose_code, r.hi_types, r.date_from, r.date_to, \
     r.data_erase_at, r.status, r.error, r.requester_name, r.requested_at, r.status_at, \
     r.status_checked_at, \
     (SELECT count(*) FROM abdm_received_records x WHERE x.consent_request_id = r.id \
         AND x.deleted_at IS NULL) AS records_received, \
     (SELECT count(*) FROM abdm_received_records x WHERE x.consent_request_id = r.id \
         AND x.deleted_at IS NULL AND x.purged_at IS NULL AND x.erase_at > now()) AS records_held";

fn validate(body: &RaiseConsentRequest) -> Result<(&'static str, Vec<String>), AppError> {
    let bad = |m: &str| Err(AppError::BadRequest(m.to_owned()));
    let Some(purpose) = purpose_text(&body.purpose_code) else {
        return bad("unknown purpose");
    };
    let Some(hi_types) = clean_hi_types(&body.hi_types) else {
        return bad("choose one or more record types");
    };
    let now = Utc::now();
    if body.date_from > body.date_to {
        return bad("the date range ends before it starts");
    }
    if body.data_erase_at <= now || body.data_erase_at > now + Duration::days(MAX_KEEP_DAYS) {
        return bad("the copies must be erased within a year from today");
    }
    Ok((purpose, hi_types))
}

fn stamp(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// The consent request ABDM's consent manager receives.
fn init_body(
    body: &RaiseConsentRequest,
    purpose: &str,
    hi_types: &[String],
    (patient, hiu): (&str, &str),
    (name, hpr_id): (&str, &str),
) -> Value {
    json!({ "consent": {
        "purpose": { "text": purpose, "code": body.purpose_code, "refUri": "www.abdm.gov.in" },
        "patient": { "id": patient },
        "hiu": { "id": hiu },
        // Inferred: ABDM's examples carry a registration number here; the
        // HPR ID is the national one.
        "requester": { "name": name,
                       "identifier": { "type": "REGNO", "value": hpr_id, "system": "https://hpr.abdm.gov.in" } },
        "hiTypes": hi_types,
        "permission": { "accessMode": "VIEW",
            "dateRange": { "from": stamp(body.date_from), "to": stamp(body.date_to) },
            "dataEraseAt": stamp(body.data_erase_at),
            "frequency": { "unit": "HOUR", "value": 1, "repeats": 0 } } } })
}

/// `POST /api/abdm/patients/{patient_id}/consent-requests`.
///
/// ABDM's refusal or outage is recorded on the request and returned, not
/// hidden: the doctor sees it failed and why.
///
/// # Errors
/// 403 without `abdm.consent.request` or access to the patient; 400 for an
/// invalid request, a patient without a verified ABHA address, or a
/// requester without an HPR ID; 404 for an unknown patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn raise(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<RaiseConsentRequest>,
) -> Result<Json<AbdmConsentRequest>, AppError> {
    require_permission(&claims, permissions::abdm::consent::REQUEST)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let (purpose, hi_types) = validate(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient = load_patient(&mut tx, claims.tenant_id, patient_id).await?;
    if let Some(reason) = patient.blocked_reason() {
        return Err(AppError::BadRequest(reason.to_owned()));
    }
    let (Some(address), Some(hiu_id)) = (patient.abha_address.clone(), patient.hip_id.clone())
    else {
        return Err(AppError::BadRequest(
            "The patient's ABHA has no ABHA address".to_owned(),
        ));
    };
    let requester = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT display_name, hpr_id FROM doctor_profiles \
          WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((name, Some(hpr_id))) = requester else {
        return Err(AppError::BadRequest(NO_HPR.to_owned()));
    };
    // The REQUEST-ID is stored with the row before the call goes out: ABDM's
    // on-init can arrive before `send` returns, and must find its request.
    let gateway_request_id = Uuid::new_v4();
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO abdm_consent_requests (tenant_id, patient_id, requested_by, requester_name, \
                requester_hpr_id, abha_address, hiu_id, purpose_code, hi_types, date_from, date_to, \
                data_erase_at, gateway_request_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(claims.sub)
    .bind(&name)
    .bind(&hpr_id)
    .bind(&address)
    .bind(&hiu_id)
    .bind(&body.purpose_code)
    .bind(&hi_types)
    .bind(body.date_from)
    .bind(body.date_to)
    .bind(body.data_erase_at)
    .bind(gateway_request_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    let consent = init_body(
        &body,
        purpose,
        &hi_types,
        (address.as_str(), hiu_id.as_str()),
        (name.as_str(), hpr_id.as_str()),
    );
    let sent = match Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        claims.tenant_id,
        &hiu_id,
    )
    .await
    {
        Ok(hiu) => {
            hiu.send_as_hiu_with_id(CONSENT_INIT_PATH, gateway_request_id, &consent)
                .await
        }
        Err(e) => Err(e),
    };
    let error = match sent {
        Ok(()) => None,
        Err(e @ (AppError::BadRequest(_) | AppError::ServiceUnavailable(_))) => Some(message(&e)),
        Err(other) => return Err(other),
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    if let Some(error) = error {
        // Only while still unanswered: an on-init that raced in stands.
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query(
            "UPDATE abdm_consent_requests SET status = 'failed', error = $3, status_at = now() \
              WHERE tenant_id = $1 AND id = $2 AND status = 'requested'",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(error)
        .execute(&mut *tx)
        .await?;
    }
    let row = sqlx::query_as::<_, AbdmConsentRequest>(&format!(
        "SELECT {REQUEST_COLUMNS} FROM abdm_consent_requests r WHERE r.tenant_id = $1 AND r.id = $2"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
