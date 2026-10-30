//! The two consents a substitute needs: the prescribing doctor's, from their
//! sign-off queue — where they may also pick a different match themselves —
//! and the patient's, from the portal. Another doctor's request, or another
//! patient's, is not found.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::substitution::{Candidates, apply, matches, sweep_lapsed};

/// A request as the doctor sees it, with the matches they may choose from.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorRequest {
    pub id: Uuid,
    pub status: String,
    pub method: String,
    pub reason: String,
    pub phone_note: Option<String>,
    pub confirm_due_at: Option<chrono::DateTime<chrono::Utc>>,
    pub original_item_id: Uuid,
    pub original_name: String,
    pub substitute_item_id: Uuid,
    pub substitute_name: String,
    pub patient_consent: Option<String>,
    #[serde(skip)]
    pub store_order_id: Uuid,
    #[sqlx(skip)]
    pub options: Option<Candidates>,
}

/// The request if it is this doctor's to decide (any, for a bypass role).
async fn doctors_request(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    id: Uuid,
    lock: bool,
) -> Result<DoctorRequest, AppError> {
    let sql = format!(
        "SELECT r.id, r.status, r.method, r.reason, r.phone_note, r.confirm_due_at, \
                r.original_item_id, o.name AS original_name, r.substitute_item_id, \
                s.name AS substitute_name, r.patient_consent, r.store_order_id \
           FROM pharmacy_substitution_requests r \
           JOIN pharmacy_catalog o ON o.id = r.original_item_id AND o.tenant_id = r.tenant_id \
           JOIN pharmacy_catalog s ON s.id = r.substitute_item_id AND s.tenant_id = r.tenant_id \
          WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL \
            AND (r.doctor_id = $3 OR $4) {}",
        if lock { "FOR UPDATE OF r" } else { "" }
    );
    sqlx::query_as::<_, DoctorRequest>(&sql)
        .bind(id)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .bind(is_bypass_role(claims))
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// `GET /api/doctor/store-substitutions/{id}` — the request and the matches.
pub async fn get_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DoctorRequest>, AppError> {
    require_permission(&claims, permissions::doctor::store_substitutions::DECIDE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sweep_lapsed(&mut tx, claims.tenant_id).await?;
    let mut request = doctors_request(&mut tx, &claims, id, false).await?;
    request.options = Some(
        matches(
            &mut tx,
            claims.tenant_id,
            request.store_order_id,
            request.original_item_id,
        )
        .await?,
    );
    tx.commit().await?;
    Ok(Json(request))
}

#[derive(Debug, Deserialize)]
pub struct DoctorDecision {
    pub approve: bool,
    /// A different match the doctor prefers.
    pub substitute_item_id: Option<Uuid>,
    pub note: Option<String>,
}

/// `POST /api/doctor/store-substitutions/{id}/decide` — approve (confirming
/// a phone agreement), perhaps with another match, or decline.
pub async fn decide(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DoctorDecision>,
) -> Result<Json<DoctorRequest>, AppError> {
    require_permission(&claims, permissions::doctor::store_substitutions::DECIDE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sweep_lapsed(&mut tx, claims.tenant_id).await?;
    let request = doctors_request(&mut tx, &claims, id, true).await?;
    if !matches!(request.status.as_str(), "with_doctor" | "phone_pending") {
        return Err(AppError::Conflict(format!(
            "This substitute is already {}",
            request.status.replace('_', " ")
        )));
    }
    let substitute = body
        .substitute_item_id
        .unwrap_or(request.substitute_item_id);
    if body.approve && substitute != request.substitute_item_id {
        let options = matches(
            &mut tx,
            claims.tenant_id,
            request.store_order_id,
            request.original_item_id,
        )
        .await?;
        if !options.candidates.iter().any(|c| c.id == substitute) {
            return Err(AppError::Conflict(
                "That isn't the same salt, strength, form and release type".to_owned(),
            ));
        }
    }
    sqlx::query(
        "UPDATE pharmacy_substitution_requests \
            SET status = CASE WHEN $3 THEN 'approved' ELSE 'declined' END, \
                substitute_item_id = $4, doctor_decided_at = now(), doctor_note = $5, \
                patient_consent = CASE WHEN substitute_item_id = $4 THEN patient_consent END \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.approve)
    .bind(substitute)
    .bind(
        body.note
            .as_deref()
            .map(str::trim)
            .filter(|n| !n.is_empty()),
    )
    .execute(&mut *tx)
    .await?;
    apply(&mut tx, claims.tenant_id, &[id]).await?;
    let decided = doctors_request(&mut tx, &claims, id, false).await?;
    tx.commit().await?;
    Ok(Json(decided))
}

/// The patient's answer to a substitute on one of their own orders: they
/// accept or decline it. Declining ends the request.
pub async fn patient_consent(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    request: Uuid,
    accept: bool,
) -> Result<(), AppError> {
    sweep_lapsed(tx, tenant_id).await?;
    let answered = sqlx::query(
        "UPDATE pharmacy_substitution_requests r \
            SET patient_consent = CASE WHEN $4 THEN 'accepted' ELSE 'declined' END, \
                patient_consent_method = 'portal', patient_consent_at = now(), \
                status = CASE WHEN $4 THEN r.status ELSE 'declined' END \
           FROM pharmacy_store_orders o \
          WHERE r.id = $1 AND r.tenant_id = $2 AND o.id = r.store_order_id \
            AND o.patient_id = $3 AND o.status = 'awaiting_verification' \
            AND r.status IN ('with_doctor', 'phone_pending', 'approved') \
            AND r.patient_consent IS NULL AND r.deleted_at IS NULL",
    )
    .bind(request)
    .bind(tenant_id)
    .bind(patient_id)
    .bind(accept)
    .execute(&mut **tx)
    .await?;
    if answered.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    apply(tx, tenant_id, &[request]).await
}
