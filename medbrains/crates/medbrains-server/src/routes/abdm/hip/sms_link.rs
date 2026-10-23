//! The deep-link SMS (M2 test case HIP_INIT_NOTIFY_HIECM): a patient with a
//! mobile and no ABHA here gets a text from ABDM with a link to the ABHA
//! app, so the records this hospital holds can reach them once they have
//! one (`POST /api/hiecm/hip/v3/link/patient/links/sms/notify2`). ABDM's
//! answer arrives at `/api/v3/patients/sms/on-notify`.
//!
//! Sent once per patient when a record of theirs is captured (migration
//! 1205 queues `abdm.patient.sms_link`), and again from the chart on
//! request, no more than every [`RESEND_MINUTES`] minutes. The body follows
//! NHA's catalogue (`notification{phoneNo, hip{id, name}}`); the `91`
//! country prefix follows OHC care-abdm (MIT), which read it off the docs'
//! example.

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::gateway::SMS_NOTIFY_PATH;
use medbrains_core::{permissions, secrets::SecretResolver};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use super::gateway::{Hip, authenticate};
use super::linking::load_patient;
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// The least time between two texts to one patient.
pub const RESEND_MINUTES: i32 = 10;

/// The latest text, as the chart shows it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SmsLink {
    pub status: String,
    pub phone_last4: String,
    pub error: Option<String>,
    /// Sent by the capture of a record rather than by a member of staff.
    pub automatic: bool,
    pub created_at: DateTime<Utc>,
    pub answered_at: Option<DateTime<Utc>>,
}

/// The patient's latest text, if any.
///
/// # Errors
/// Database faults.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn latest(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<SmsLink>, AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    Ok(sqlx::query_as::<_, SmsLink>(
        "SELECT status, phone_last4, error, requested_by IS NULL AS automatic, created_at, answered_at \
           FROM abdm_sms_links WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// ABDM's number format: the country code, then the 10 digits.
fn phone_no(phone: &str) -> Option<String> {
    let d: String = phone.chars().filter(char::is_ascii_digit).collect();
    (d.len() >= 10).then(|| format!("91{}", &d[d.len() - 10..]))
}

/// Ask ABDM to text `patient_id` the ABHA app link, recording the request
/// first so the answer always finds it.
///
/// # Errors
/// 400 when the patient has an ABHA here, no mobile, or the campus no HFR
/// ID; 429 inside [`RESEND_MINUTES`]; ABDM's refusal or outage as from [`Hip`].
#[tracing::instrument(skip_all, fields(tenant_id = %who.0))]
pub async fn send(
    db: &sqlx::PgPool,
    secrets: &dyn SecretResolver,
    who: (Uuid, Uuid),
    requested_by: Option<Uuid>,
) -> Result<(), AppError> {
    let (tenant_id, patient_id) = who;
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let p = load_patient(&mut tx, tenant_id, patient_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let recent: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM abdm_sms_links WHERE tenant_id = $1 AND patient_id = $2 \
            AND status <> 'failed' AND deleted_at IS NULL \
            AND created_at > now() - make_interval(mins => $3))",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(RESEND_MINUTES)
    .fetch_one(&mut *tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let hip_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM facilities WHERE tenant_id = $1 AND deleted_at IS NULL AND parent_id IS NULL \
          AND hfr_facility_id IS NOT NULL ORDER BY (facility_type = 'main_hospital') DESC, created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    if p.link_id.is_some() {
        return Err(AppError::BadRequest(
            "the patient already has an ABHA here — their records link to it".to_owned(),
        ));
    }
    let phone =
        p.phone.as_deref().and_then(phone_no).ok_or_else(|| {
            AppError::BadRequest("add the patient's mobile number first".to_owned())
        })?;
    let (Some(hip_id), Some(hip_name)) = (p.hip_id.clone(), hip_name) else {
        return Err(AppError::BadRequest(
            "this campus has no HFR facility ID — set it in Settings → ABDM".to_owned(),
        ));
    };
    if recent {
        return Err(AppError::TooManyRequests(format!(
            "ABDM texted the link in the last {RESEND_MINUTES} minutes — wait before sending again"
        )));
    }
    let request_id = Uuid::new_v4();
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "INSERT INTO abdm_sms_links (tenant_id, patient_id, phone_last4, request_id, requested_by) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(&phone[phone.len() - 4..])
    .bind(request_id)
    .bind(requested_by)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    let body =
        json!({ "notification": { "phoneNo": phone, "hip": { "id": hip_id, "name": hip_name } } });
    let hip = Hip::connect(db, secrets, tenant_id, &hip_id).await?;
    if let Err(e) = hip.send_with_id(SMS_NOTIFY_PATH, request_id, &body).await {
        record_answer(db, tenant_id, request_id, Some(super::linking::message(&e))).await?;
        return Err(e);
    }
    Ok(())
}

async fn record_answer(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    request_id: Uuid,
    error: Option<String>,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_sms_links SET status = CASE WHEN $3::text IS NULL THEN 'delivered' ELSE 'failed' END, \
                error = $3, answered_at = now() \
          WHERE tenant_id = $1 AND request_id = $2 AND status = 'sent'",
    )
    .bind(tenant_id)
    .bind(request_id)
    .bind(error)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// `POST /api/abdm/patients/{patient_id}/sms-link` — text the patient the
/// ABHA app link now.
///
/// # Errors
/// 403 without `abdm.records.notify` or access to the patient; as [`send`].
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn send_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Option<SmsLink>>, AppError> {
    require_permission(&claims, permissions::abdm::records::NOTIFY)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    send(
        &state.db,
        state.secret_resolver.as_ref(),
        (claims.tenant_id, patient_id),
        Some(claims.sub),
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = latest(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/v3/patients/sms/on-notify` — ABDM's answer. An answer to
/// nothing we sent, or a repeat, changes nothing.
///
/// # Errors
/// 401 without a valid gateway JWT.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_notify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let Some(request_id) = body["response"]["requestId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
    else {
        return Ok(StatusCode::ACCEPTED);
    };
    let ok = body["error"].is_null() && body["acknowledgement"]["status"] == "SUCCESS";
    let error =
        (!ok).then(|| medbrains_abdm::errors::describe_body(&body, "ABDM did not send the text"));
    record_answer(&state.db, caller.tenant_id, request_id, error).await?;
    Ok(StatusCode::ACCEPTED)
}

#[cfg(test)]
mod tests {
    use super::phone_no;

    #[test]
    fn a_mobile_goes_to_abdm_with_the_country_code() {
        assert_eq!(phone_no("98765 43210").as_deref(), Some("919876543210"));
        assert_eq!(phone_no("+91-98765-43210").as_deref(), Some("919876543210"));
        assert_eq!(phone_no("12345"), None);
    }
}
