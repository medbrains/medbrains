//! Patient portal — the only routes a patient's own device may call.
//!
//! # Why these are not staff routes with a patient role
//!
//! A patient token and a staff token are different populations, and the
//! isolation between them must not depend on every handler remembering to call
//! `require_permission`. It is structural instead, and it works in both
//! directions because the two token shapes are mutually undecodable:
//!
//! * A **patient token carries no `role`**. `Claims` requires `role` with no
//!   serde default, so `decode_and_validate` — the staff door — fails outright
//!   on a patient token. It cannot reach a staff handler at all.
//! * A **staff token carries no `pid`**. [`PatientClaims`] requires it, so a
//!   staff token cannot satisfy the portal extractor either.
//!
//! # The rule every handler here follows
//!
//! The patient is taken from the token, never from the path or query. There is
//! deliberately no `GET /portal/bills/{patient_id}` — an endpoint shaped that
//! way is one missing check away from handing over somebody else's record, and
//! the shape below cannot express that mistake.

use axum::{
    Extension, Json,
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use medbrains_server_core::{error::AppError, state::AppState};

/// How long a portal session lasts. Short: this is a phone that gets handed
/// around a waiting room, and the record behind it is the whole chart.
const PORTAL_SESSION_HOURS: i64 = 12;

/// Long enough to read an SMS and type it, short enough that a code seen over a
/// shoulder is stale by the time it is used.
const OTP_TTL_MINUTES: i32 = 10;

/// A six-digit code has a million values; without a cap it is guessable inside
/// its own lifetime.
const MAX_OTP_ATTEMPTS: i32 = 5;

/// Claims on a patient's token.
///
/// `pid` is the patient this token speaks for and is the only source of patient
/// identity in this module. Note what is absent: no `role`, no `permissions`,
/// no `department_ids`. There is nothing here for a staff route to act on even
/// if one somehow saw it.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatientClaims {
    pub sub: Uuid,
    /// Patient id. Required — this is what makes the shape undecodable as staff.
    pub pid: Uuid,
    pub tenant_id: Uuid,
    pub exp: usize,
}

/// Rejects anything that is not a patient token, then hands the claims to the
/// handler. Portal routes are mounted behind this and nothing else.
pub async fn require_patient(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    let claims = decode_patient_token(token, &state.jwt_decoding_key)?;
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

fn decode_patient_token(token: &str, key: &DecodingKey) -> Result<PatientClaims, AppError> {
    let mut validation = Validation::new(Algorithm::EdDSA);
    // `pid` required here is the mirror of `role` required on the staff side.
    validation.set_required_spec_claims(&["exp", "sub"]);
    decode::<PatientClaims>(token, key, &validation)
        .map(|data| data.claims)
        .map_err(|_| AppError::Unauthorized)
}

fn hash_otp(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[derive(Debug, Deserialize)]
pub struct PortalOtpRequest {
    pub tenant_code: String,
    pub phone: String,
}

/// `POST /api/portal/auth/request-otp`
///
/// Always answers the same way. Whether the phone belongs to a patient, whether
/// the tenant exists, whether SMS is even configured — the caller cannot tell,
/// because a different answer per case turns this into a way to ask "is this
/// person a patient here", which is itself disclosure.
pub async fn request_portal_otp(
    State(state): State<AppState>,
    Json(body): Json<PortalOtpRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ack = Json(serde_json::json!({
        "status": "ok",
        "message": "If that number is registered, a sign-in code has been sent."
    }));

    let phone = body.phone.trim();
    if phone.len() < 8 {
        return Ok(ack);
    }

    let Some(tenant_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE code = $1 AND is_active = true",
    )
    .bind(&body.tenant_code)
    .fetch_optional(&state.db)
    .await?
    else {
        return Ok(ack);
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // No patient, no code — but the caller still gets the same acknowledgement.
    let known: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id = $1 AND phone = $2 LIMIT 1")
            .bind(tenant_id)
            .bind(phone)
            .fetch_optional(&mut *tx)
            .await?;
    if known.is_none() {
        tx.commit().await?;
        return Ok(ack);
    }

    let mut buf = [0u8; 4];
    getrandom::fill(&mut buf)
        .map_err(|e| AppError::Internal(format!("otp generation failed: {e}")))?;
    let otp = format!("{:06}", u32::from_le_bytes(buf) % 1_000_000);

    // Asking for a new code retires the old one, so only the latest works.
    sqlx::query(
        "UPDATE patient_portal_otps SET used_at = now() \
         WHERE tenant_id = $1 AND phone = $2 AND used_at IS NULL",
    )
    .bind(tenant_id)
    .bind(phone)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + make_interval(mins => $4))",
    )
    .bind(tenant_id)
    .bind(phone)
    .bind(hash_otp(&otp))
    .bind(OTP_TTL_MINUTES)
    .execute(&mut *tx)
    .await?;

    medbrains_outbox::queue::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "patient_portal",
            aggregate_id: None,
            event_type: "sms.patient_portal_otp",
            payload: serde_json::json!({
                "to": phone,
                "body": format!(
                    "Your sign-in code is {otp}. It is valid for {OTP_TTL_MINUTES} minutes. \
                     Do not share it with anyone."
                ),
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("failed to queue portal OTP: {e}")))?;

    tx.commit().await?;
    Ok(ack)
}

#[derive(Debug, Deserialize)]
pub struct PortalVerifyRequest {
    pub tenant_code: String,
    pub phone: String,
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct PortalSession {
    pub token: String,
    pub patient_id: Uuid,
    /// Returned so the client does not have to crack open the JWT to learn
    /// which tenant it is talking to.
    pub tenant_id: Uuid,
    pub expires_in_hours: i64,
}

/// `POST /api/portal/auth/verify`
pub async fn verify_portal_otp(
    State(state): State<AppState>,
    Json(body): Json<PortalVerifyRequest>,
) -> Result<Json<PortalSession>, AppError> {
    let phone = body.phone.trim();
    let denied = || AppError::Unauthorized;

    let tenant_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE code = $1 AND is_active = true",
    )
    .bind(&body.tenant_code)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(denied)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let row: Option<(Uuid, String, i32)> = sqlx::query_as(
        "SELECT id, otp_hash, attempts FROM patient_portal_otps \
         WHERE tenant_id = $1 AND phone = $2 AND used_at IS NULL AND expires_at > now() \
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(phone)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((otp_id, otp_hash, attempts)) = row else {
        tx.commit().await?;
        return Err(denied());
    };

    if attempts >= MAX_OTP_ATTEMPTS {
        // Burn it. A code that has been guessed at five times is not a secret.
        sqlx::query("UPDATE patient_portal_otps SET used_at = now() WHERE id = $1")
            .bind(otp_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Err(denied());
    }

    if hash_otp(body.code.trim()) != otp_hash {
        sqlx::query("UPDATE patient_portal_otps SET attempts = attempts + 1 WHERE id = $1")
            .bind(otp_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Err(denied());
    }

    let patient_id: Uuid =
        sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id = $1 AND phone = $2 LIMIT 1")
            .bind(tenant_id)
            .bind(phone)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(denied)?;

    sqlx::query("UPDATE patient_portal_otps SET used_at = now() WHERE id = $1")
        .bind(otp_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let exp = usize::try_from(
        (chrono::Utc::now() + chrono::Duration::hours(PORTAL_SESSION_HOURS)).timestamp(),
    )
    .map_err(|_| AppError::Internal("clock out of range".to_owned()))?;

    let claims = PatientClaims {
        sub: patient_id,
        pid: patient_id,
        tenant_id,
        exp,
    };
    let header = jsonwebtoken::Header::new(Algorithm::EdDSA);
    let token = jsonwebtoken::encode(&header, &claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("token issue failed: {e}")))?;

    Ok(Json(PortalSession {
        token,
        patient_id,
        tenant_id,
        expires_in_hours: PORTAL_SESSION_HOURS,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PortalInvoice {
    pub id: Uuid,
    pub invoice_number: String,
    pub status: String,
    pub total_amount: rust_decimal::Decimal,
    pub paid_amount: rust_decimal::Decimal,
    pub balance_due: rust_decimal::Decimal,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// `GET /api/portal/bills`
///
/// The patient comes from the token. There is no path parameter to tamper with.
pub async fn portal_bills(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PortalInvoice>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PortalInvoice>(
        "SELECT id, invoice_number, status::text AS status, total_amount, paid_amount, \
                (total_amount - paid_amount) AS balance_due, created_at \
         FROM invoices \
         WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PortalLabReport {
    pub order_id: Uuid,
    pub test_name: String,
    pub parameter_name: String,
    pub value: String,
    pub unit: Option<String>,
    pub normal_range: Option<String>,
    pub flag: Option<String>,
    pub reported_at: chrono::DateTime<chrono::Utc>,
}

/// `GET /api/portal/lab-reports`
///
/// Two things are deliberately withheld.
///
/// **Unverified results.** A result is a draft until a pathologist verifies it,
/// and a number that may still be corrected is worse than no number at all —
/// people act on what they read. Only verified orders appear.
///
/// **Results carrying an unacknowledged critical alert.** A critical value is
/// supposed to be spoken to a clinician, who then speaks to the patient. Nobody
/// should learn their potassium is 7.2 from a phone in a car park before that
/// call has happened. Once the alert is acknowledged the result appears
/// normally, so this delays disclosure rather than hiding it.
pub async fn portal_lab_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PortalLabReport>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PortalLabReport>(
        "SELECT lo.id AS order_id, t.name AS test_name, r.parameter_name, r.value, \
                r.unit, r.normal_range, r.flag::text AS flag, r.created_at AS reported_at \
         FROM lab_results r \
         JOIN lab_orders lo ON lo.id = r.order_id AND lo.tenant_id = r.tenant_id \
         JOIN lab_test_catalog t ON t.id = lo.test_id \
         WHERE r.tenant_id = $1 \
           AND lo.patient_id = $2 \
           AND lo.verified_at IS NOT NULL \
           AND NOT EXISTS ( \
             SELECT 1 FROM lab_critical_alerts a \
             WHERE a.tenant_id = r.tenant_id AND a.result_id = r.id \
               AND a.acknowledged_at IS NULL \
           ) \
         ORDER BY r.created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PortalPrescriptionItem {
    pub prescription_id: Uuid,
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub prescribed_at: chrono::DateTime<chrono::Utc>,
}

/// `GET /api/portal/prescriptions`
///
/// Returns the medicines themselves rather than a list of prescription numbers.
/// A patient opening this screen wants to know what to take and how often; a
/// header with a count answers nothing.
///
/// Some prescriptions carry `patient_id` directly and older ones reach the
/// patient only through their encounter, so both paths are covered — otherwise
/// a patient's earlier medicines would silently be missing.
pub async fn portal_prescriptions(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PortalPrescriptionItem>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PortalPrescriptionItem>(
        "SELECT p.id AS prescription_id, i.drug_name, i.dosage, i.frequency, i.duration, \
                p.created_at AS prescribed_at \
         FROM prescriptions p \
         JOIN prescription_items i \
           ON i.prescription_id = p.id AND i.tenant_id = p.tenant_id \
         LEFT JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
         WHERE p.tenant_id = $1 AND COALESCE(p.patient_id, e.patient_id) = $2 \
         ORDER BY p.created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PortalAppointment {
    pub id: Uuid,
    pub appointment_date: chrono::NaiveDate,
    pub status: String,
    pub department_name: Option<String>,
}

/// `GET /api/portal/appointments`
pub async fn portal_appointments(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PortalAppointment>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PortalAppointment>(
        "SELECT a.id, a.appointment_date, a.status::text AS status, d.name AS department_name \
         FROM appointments a \
         LEFT JOIN departments d ON d.id = a.department_id AND d.tenant_id = a.tenant_id \
         WHERE a.tenant_id = $1 AND a.patient_id = $2 \
         ORDER BY a.appointment_date DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// What the patient app is allowed to show, beyond the record itself.
#[derive(Debug, Serialize)]
pub struct PortalEntitlements {
    /// The tenant has licensed the daily companion.
    pub companion: bool,
}

/// `GET /api/portal/entitlements`
///
/// The patient app asks this to decide whether the Health tab exists. It is a
/// portal route rather than a reuse of the staff entitlement middleware
/// because a patient token carries no `role` and no permissions — the two
/// populations are mutually undecodable by design, and a staff-shaped check
/// could not run here even if it were appropriate.
///
/// # Why this fails CLOSED and `require_module_enabled` fails open
///
/// The staff gate treats an absent `module_config` row as *enabled*, so a
/// transient fault can never black out a live clinical module. That is the
/// right trade for a module a hospital already runs.
///
/// It is the wrong trade here. An unknown must not put a Health tab in front
/// of a patient whose hospital never licensed the companion — a feature nobody
/// agreed to sell is harder to withdraw than one that was briefly missing. So
/// a missing row, an unreadable status and a database error all resolve to
/// `false`, and `?` is deliberately not used on the read.
pub async fn portal_entitlements(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<PortalEntitlements>, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let status: Option<String> = sqlx::query_scalar(
        "SELECT status::text FROM module_config WHERE tenant_id = $1 AND code = 'companion'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await
    .unwrap_or(None);

    Ok(Json(PortalEntitlements {
        companion: status.as_deref() == Some("enabled"),
    }))
}
