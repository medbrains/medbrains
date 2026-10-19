//! A consent answer — the patient's, by `notify`, or ABDM's, by
//! `on-status` when we asked — applied the same way whichever brought it:
//! the request takes the status; a grant keeps one artefact per HIP and
//! fetches each; a denial, revocation or expiry ends the artefacts and
//! erases what was received under them.

use chrono::{DateTime, Utc};
use medbrains_abdm::gateway::CONSENT_FETCH_PATH;
use serde_json::json;
use uuid::Uuid;

use super::purge::erase_artefacts;
use crate::{
    error::AppError,
    routes::abdm::hip::gateway::{Caller, Hip},
    state::AppState,
};

/// The answers a consent request can have.
pub(super) const ANSWERS: [&str; 4] = ["GRANTED", "DENIED", "REVOKED", "EXPIRED"];
/// Artefacts one grant may carry (one per HIP); more are ignored.
pub(super) const MAX_ARTEFACTS: usize = 50;

/// The request a consent answer is for.
#[derive(sqlx::FromRow)]
pub(super) struct Asked {
    pub id: Uuid,
    pub status: String,
    patient_id: Uuid,
    abha_address: String,
    purpose_code: String,
    hi_types: Vec<String>,
    date_from: DateTime<Utc>,
    date_to: DateTime<Utc>,
    data_erase_at: DateTime<Utc>,
}

pub(super) const ASKED_COLUMNS: &str = "r.id, r.status, r.patient_id, r.abha_address, \
     r.purpose_code, r.hi_types, r.date_from, r.date_to, r.data_erase_at";

/// Apply one answer (`status` in [`ANSWERS`]) to the request. Returns the
/// granted artefacts to fetch once the transaction commits.
///
/// # Errors
/// A database fault.
pub(super) async fn settle(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    caller: &Caller,
    asked: &Asked,
    (status, consent_request_id): (&str, Option<&str>),
    artefact_ids: &[String],
) -> Result<Vec<(Uuid, String)>, AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_requests SET status = $3, status_at = now(), \
                consent_request_id = COALESCE(consent_request_id, $4) \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(caller.tenant_id)
    .bind(asked.id)
    .bind(status.to_lowercase())
    .bind(consent_request_id)
    .execute(&mut **tx)
    .await?;
    if status == "GRANTED" {
        return keep_artefacts(tx, caller, asked, artefact_ids).await;
    }
    end_artefacts(tx, caller.tenant_id, asked.id, artefact_ids, status).await?;
    Ok(Vec::new())
}

/// Fetch each granted artefact; one refused does not stop the others.
///
/// # Errors
/// A database fault.
pub(super) async fn fetch_all(
    state: &AppState,
    hiu: &Hip,
    granted: Vec<(Uuid, String)>,
) -> Result<(), AppError> {
    for (artefact_id, consent_id) in granted {
        fetch(state, hiu, artefact_id, &consent_id).await?;
    }
    Ok(())
}

/// Keep one HIU artefact per granted consent id, provisionally scoped to the
/// request until `on-fetch` brings the artefact itself.
async fn keep_artefacts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    caller: &Caller,
    asked: &Asked,
    artefact_ids: &[String],
) -> Result<Vec<(Uuid, String)>, AppError> {
    let kept = sqlx::query_as::<_, (Uuid, String)>(
        "INSERT INTO abdm_consent_artefacts (tenant_id, consent_id, role, patient_id, abha_address, \
                hiu_id, purpose_code, hi_types, date_from, date_to, data_erase_at, status, \
                consent_request_id, hi_status) \
         SELECT $1, c, 'hiu', $3, $4, $5, $6, $7, $8, $9, $10, 'GRANTED', $11, 'fetching' \
           FROM unnest($2::text[]) AS c \
         ON CONFLICT (tenant_id, role, consent_id) WHERE deleted_at IS NULL \
         DO UPDATE SET status = 'GRANTED', notified_at = now() \
         RETURNING id, consent_id",
    )
    .bind(caller.tenant_id)
    .bind(artefact_ids)
    .bind(asked.patient_id)
    .bind(&asked.abha_address)
    .bind(&caller.hip_id)
    .bind(&asked.purpose_code)
    .bind(&asked.hi_types)
    .bind(asked.date_from)
    .bind(asked.date_to)
    .bind(asked.data_erase_at)
    .bind(asked.id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(kept)
}

/// Revoked, expired or denied: the artefacts end and every copy held under
/// them is erased now. Without artefact ids, the whole request ends.
async fn end_artefacts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    request_id: Uuid,
    artefact_ids: &[String],
    status: &str,
) -> Result<(), AppError> {
    let ended = sqlx::query_scalar::<_, Uuid>(
        "UPDATE abdm_consent_artefacts SET status = $4, notified_at = now() \
          WHERE tenant_id = $1 AND role = 'hiu' AND consent_request_id = $2 AND deleted_at IS NULL \
            AND (cardinality($3::text[]) = 0 OR consent_id = ANY($3)) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(request_id)
    .bind(artefact_ids)
    .bind(status)
    .fetch_all(&mut **tx)
    .await?;
    let reason = if status == "REVOKED" {
        "revoked"
    } else {
        "expired"
    };
    let erased = erase_artefacts(tx, tenant_id, &ended, reason).await?;
    tracing::info!(
        erased,
        status,
        "abdm hiu: consent ended, received copies erased"
    );
    Ok(())
}

/// Ask for one artefact. A refusal or outage is recorded on it, not raised:
/// the other artefacts of the grant still go ahead.
async fn fetch(
    state: &AppState,
    hiu: &Hip,
    artefact_id: Uuid,
    consent_id: &str,
) -> Result<(), AppError> {
    let sent = hiu
        .send_as_hiu(CONSENT_FETCH_PATH, &json!({ "consentId": consent_id }))
        .await;
    let (request_id, hi_status) = match &sent {
        Ok(id) => (Some(*id), "fetching"),
        Err(e) => {
            tracing::warn!(error = %e, "abdm hiu: consent fetch failed");
            (None, "fetch_failed")
        }
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &hiu.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_artefacts SET fetch_request_id = $3, \
                hi_status = CASE WHEN hi_status = 'fetching' THEN $4 ELSE hi_status END \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(hiu.tenant_id)
    .bind(artefact_id)
    .bind(request_id)
    .bind(hi_status)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}
