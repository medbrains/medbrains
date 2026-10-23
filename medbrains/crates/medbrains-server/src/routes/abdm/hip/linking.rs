//! HIP-initiated linking (ABDM v3): when a record is finalised for a
//! patient whose ABHA is verified, ask the gateway for a link token, then
//! link the patient's unlinked care contexts with it.
//!
//! Both gateway calls are asynchronous: the token arrives at
//! `on-generate-token` and the outcome at `on_carecontext`, each matched to
//! its care contexts by the `REQUEST-ID` we sent (`abdm_request_id`) — see
//! `link_callbacks`. The
//! link token is valid for months; it is kept sealed on the patient's ABHA
//! link and reused until it expires.

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use medbrains_abdm::gateway::{GENERATE_LINK_TOKEN_PATH, LINK_CARE_CONTEXT_PATH};
use medbrains_core::secrets::SecretResolver;
use serde_json::{Value, json};
use uuid::Uuid;

use super::gateway::Hip;
use crate::{error::AppError, routes::abdm::abha::secret_key};

pub(super) const TOKEN_CONTEXT: &[u8] = b"abdm-link-token";
/// Care contexts linked in one call; a patient rarely has more pending.
pub(super) const LINK_BATCH: i64 = 50;
/// ABDM issues link tokens for six months; used when the token names no `exp`.
pub(super) const TOKEN_DAYS: i64 = 180;
/// ABDM-1027, in words for staff.
pub(super) const ABDM_BLOCKED: &str =
    "ABDM has blocked this ABHA for 24 hours after repeated refusals — try again tomorrow";
/// ABDM needs time to index a new link before a context notify is accepted:
/// refused at 0.6 s, accepted at 50 s (OHC care-abdm, MIT, docs/findings.md F9).
pub(super) const NOTIFY_DELAY_SECONDS: f64 = 60.0;

/// What linking needs to know about a patient, and why it cannot happen.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PatientAbdm {
    pub patient_id: Uuid,
    pub uhid: String,
    pub name: String,
    pub gender: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: Option<String>,
    pub link_id: Option<Uuid>,
    pub abha_number: Option<String>,
    pub abha_address: Option<String>,
    pub sealed_token: Option<String>,
    pub token_expiry: Option<DateTime<Utc>>,
    /// The HIP ID records are shared as: the main campus's bridge service id
    /// when known, else its HFR facility ID (see migration 1190).
    pub hip_id: Option<String>,
    /// Until when ABDM blocks calls for this ABHA (ABDM-1027).
    pub blocked_until: Option<DateTime<Utc>>,
}

impl PatientAbdm {
    /// Why this patient's records cannot be linked, in words for staff.
    #[must_use]
    pub fn blocked_reason(&self) -> Option<&'static str> {
        if self.link_id.is_none() {
            Some("The patient has no ABHA verified with ABDM")
        } else if self.blocked_until.is_some_and(|t| t > Utc::now()) {
            Some(ABDM_BLOCKED)
        } else if self.hip_id.is_none() {
            Some("This campus has no HFR facility ID")
        } else {
            None
        }
    }

    /// ABDM's gender letters.
    fn gender_code(&self) -> &'static str {
        match self.gender.as_str() {
            "male" => "M",
            "female" => "F",
            "other" => "O",
            _ => "U",
        }
    }
}

/// Load `patient_id` with their verified ABHA (if any) and the HIP ID.
///
/// # Errors
/// 404 for a patient not in this hospital.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn load_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientAbdm, AppError> {
    sqlx::query_as::<_, PatientAbdm>(
        "SELECT p.id AS patient_id, p.uhid, btrim(p.first_name || ' ' || p.last_name) AS name, \
                p.gender::text AS gender, p.date_of_birth, p.phone, \
                l.id AS link_id, l.abha_number, l.abha_address, \
                l.linking_token AS sealed_token, l.token_expiry, mc.hip_id, \
                l.abdm_blocked_until AS blocked_until \
           FROM patients p \
           LEFT JOIN LATERAL (SELECT * FROM patient_abha_links l \
                WHERE l.tenant_id = p.tenant_id AND l.patient_id = p.id \
                  AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL AND l.unlinked_at IS NULL \
                ORDER BY l.verified_at DESC LIMIT 1) l ON true \
           LEFT JOIN LATERAL (SELECT COALESCE(f.abdm_hip_service_id, f.hfr_facility_id) AS hip_id \
                FROM facilities f \
                WHERE f.tenant_id = p.tenant_id AND f.deleted_at IS NULL AND f.parent_id IS NULL \
                  AND f.hfr_facility_id IS NOT NULL \
                ORDER BY (f.facility_type = 'main_hospital') DESC, f.created_at LIMIT 1) mc ON true \
          WHERE p.tenant_id = $1 AND p.id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// ABDM's `patient[]` shape: one entry per HI type, each with its contexts.
#[must_use]
pub fn patient_entries(uhid: &str, name: &str, contexts: &[(String, String, String)]) -> Value {
    let mut by_type: Vec<(&str, Vec<Value>)> = Vec::new();
    for (reference, display, hi_type) in contexts {
        let item = json!({ "referenceNumber": reference, "display": display });
        match by_type.iter_mut().find(|(t, _)| *t == hi_type.as_str()) {
            Some((_, list)) => list.push(item),
            None => by_type.push((hi_type.as_str(), vec![item])),
        }
    }
    Value::Array(
        by_type
            .into_iter()
            .map(|(hi_type, list)| {
                json!({ "referenceNumber": uhid, "display": name, "count": list.len(),
                        "hiType": hi_type, "careContexts": list })
            })
            .collect(),
    )
}

fn abha_number_value(abha: Option<&str>) -> Value {
    abha.map(|a| a.chars().filter(char::is_ascii_digit).collect::<String>())
        .and_then(|d| d.parse::<u64>().ok())
        .map_or(Value::Null, Value::from)
}

pub(super) async fn mark(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    ids: &[Uuid],
    status: &str,
    error: Option<&str>,
    request_id: Option<Uuid>,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_care_contexts SET link_status = $3, last_error = $4, \
                abdm_request_id = COALESCE($5, abdm_request_id) \
          WHERE tenant_id = $1 AND id = ANY($2) AND link_status <> 'linked'",
    )
    .bind(tenant_id)
    .bind(ids)
    .bind(status)
    .bind(error)
    .bind(request_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Link one care context, and with it the patient's other unlinked ones.
///
/// A precondition that fails (no ABHA, no HFR ID) is recorded as the reason
/// and is not an error; a refusal or outage is recorded and returned.
///
/// # Errors
/// 404 for an unknown care context; ABDM refusals and outages as from [`Hip`].
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn request_link(
    db: &sqlx::PgPool,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    care_context_id: Uuid,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let (patient_id, status) = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT patient_id, link_status FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(care_context_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let patient = load_patient(&mut tx, tenant_id, patient_id).await?;
    tx.commit().await?;
    if status == "linked" {
        return Ok(());
    }
    let ids = [care_context_id];
    if let Some(reason) = patient.blocked_reason() {
        return mark(db, tenant_id, &ids, "not_linked", Some(reason), None).await;
    }
    let hip_id = patient.hip_id.clone().unwrap_or_default();
    let hip = match Hip::connect(db, secrets, tenant_id, &hip_id).await {
        Ok(hip) => hip,
        Err(e) => {
            mark(
                db,
                tenant_id,
                &ids,
                "failed",
                Some(message(&e).as_str()),
                None,
            )
            .await?;
            return Err(e);
        }
    };
    if let Some(token) = live_token(secrets, &patient).await {
        return send_links(db, &hip, tenant_id, &patient, &token).await;
    }
    let body = json!({
        "abhaNumber": abha_number_value(patient.abha_number.as_deref()),
        "abhaAddress": patient.abha_address,
        "name": patient.name,
        "gender": patient.gender_code(),
        "yearOfBirth": patient.date_of_birth.map(|d| d.year()),
    });
    match hip.send(GENERATE_LINK_TOKEN_PATH, None, &body).await {
        Ok(request_id) => mark(db, tenant_id, &ids, "linking", None, Some(request_id)).await,
        Err(e) => {
            mark(
                db,
                tenant_id,
                &ids,
                "failed",
                Some(message(&e).as_str()),
                None,
            )
            .await?;
            Err(e)
        }
    }
}

/// Staff-readable words for a failure; never a raw body.
#[must_use]
pub fn message(e: &AppError) -> String {
    match e {
        AppError::BadRequest(m) | AppError::ServiceUnavailable(m) => m.clone(),
        _ => "ABDM could not complete the request".to_owned(),
    }
}

async fn live_token(secrets: &dyn SecretResolver, p: &PatientAbdm) -> Option<String> {
    let sealed = p.sealed_token.as_deref()?;
    if p.token_expiry? <= Utc::now() + Duration::minutes(1) {
        return None;
    }
    // No usable key means no usable token: a new one is asked for, and
    // sealing it then fails loudly (503) if the key is truly missing.
    let key = secret_key(secrets).await.ok()?;
    medbrains_crypto::aead::decrypt_token::<String>(&key, TOKEN_CONTEXT, sealed).ok()
}

/// Link every unlinked care context of the patient with `token`.
pub(super) async fn send_links(
    db: &sqlx::PgPool,
    hip: &Hip,
    tenant_id: Uuid,
    p: &PatientAbdm,
    token: &str,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let pending = sqlx::query_as::<_, (Uuid, String, String, String)>(
        "SELECT id, reference_number, display, hi_types[1] FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND patient_id = $2 AND link_status <> 'linked' \
            AND deleted_at IS NULL ORDER BY record_date DESC LIMIT $3",
    )
    .bind(tenant_id)
    .bind(p.patient_id)
    .bind(LINK_BATCH)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    if pending.is_empty() {
        return Ok(());
    }
    let ids: Vec<Uuid> = pending.iter().map(|r| r.0).collect();
    let contexts: Vec<(String, String, String)> =
        pending.into_iter().map(|(_, r, d, h)| (r, d, h)).collect();
    let body = json!({
        "abhaNumber": abha_number_value(p.abha_number.as_deref()),
        "abhaAddress": p.abha_address,
        "patient": patient_entries(&p.uhid, &p.name, &contexts),
    });
    match hip.send(LINK_CARE_CONTEXT_PATH, Some(token), &body).await {
        Ok(request_id) => mark(db, tenant_id, &ids, "linking", None, Some(request_id)).await,
        Err(e) => {
            mark(
                db,
                tenant_id,
                &ids,
                "failed",
                Some(message(&e).as_str()),
                None,
            )
            .await?;
            Err(e)
        }
    }
}

/// Record care contexts as linked to the patient's ABHA.
///
/// # Errors
/// Database faults.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn mark_linked(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    ids: &[Uuid],
    via: &str,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // Linked now, and the patient's app told about it a minute later.
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "WITH linked AS ( \
           UPDATE abdm_care_contexts SET link_status = 'linked', linked_at = now(), \
                  linked_via = $3, last_error = NULL \
            WHERE tenant_id = $1 AND id = ANY($2) AND link_status <> 'linked' RETURNING id) \
         INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload, \
                idempotency_key, next_retry_at) \
         SELECT $1, 'abdm_care_context', id, 'abdm.care_context.notify', \
                jsonb_build_object('care_context_id', id), 'ccn:' || id::text, \
                now() + make_interval(secs => $4) FROM linked \
         ON CONFLICT (tenant_id, event_type, idempotency_key) \
            WHERE idempotency_key IS NOT NULL DO NOTHING",
    )
    .bind(tenant_id)
    .bind(ids)
    .bind(via)
    .bind(NOTIFY_DELAY_SECONDS)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// ABDM's error code in a callback, without the trailing `": "` it sometimes
/// carries (care-abdm E14).
#[must_use]
pub fn error_code(body: &Value) -> Option<&str> {
    body["error"]["code"]
        .as_str()
        .map(|c| c.trim().trim_end_matches(':').trim())
}

/// When ABDM answered ABDM-1027, block this patient's ABHA for 24 hours:
/// the block follows the ABHA address (care-abdm E14). Returns whether it did.
///
/// # Errors
/// A database fault.
pub(super) async fn note_abdm_block(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    patient_id: Uuid,
    body: &Value,
) -> Result<bool, AppError> {
    if error_code(body) != Some("ABDM-1027") {
        return Ok(false);
    }
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE patient_abha_links SET abdm_blocked_until = now() + interval '24 hours' \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL AND unlinked_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    tracing::warn!("abdm: ABDM-1027, the patient's ABHA is blocked for 24 hours");
    Ok(true)
}
