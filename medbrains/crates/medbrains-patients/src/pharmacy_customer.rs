//! Completing a pharmacy customer's light record into a full registration.
//! The desk's duplicate check finds the light record (it says
//! `pharmacy_customer`); completing it gives it a UHID on the same row, so
//! the person's pharmacy orders and bills stay with them.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct Completed {
    pub id: Uuid,
    pub uhid: String,
}

/// `POST /api/patients/{id}/complete-registration` — registering a person
/// the pharmacy already knows. The customer number is kept in the record's
/// attributes; the rest of the registration is edited as for any patient.
pub async fn complete_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Completed>, AppError> {
    require_permission(&claims, permissions::patients::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let light: Option<bool> = sqlx::query_scalar(
        "SELECT pharmacy_customer FROM patients \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    if light != Some(true) {
        return Err(AppError::NotFound);
    }
    let uhid = crate::generate_uhid(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE patients \
            SET uhid = $3, pharmacy_customer = false, registration_type = 'new', \
                attributes = COALESCE(attributes, '{}'::jsonb) - 'pharmacy_customer' \
                             || jsonb_build_object('pharmacy_customer_number', uhid) \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&uhid)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    // Registration is the act that makes the desk the record's owner, as
    // when a patient is registered from scratch.
    let ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    state
        .authz
        .write_tuple(
            &ctx,
            "patient",
            id,
            medbrains_authz::Relation::Owner,
            medbrains_authz::Subject::User(claims.sub),
            None,
            Some("patient_registered".to_owned()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("patient authz grant failed: {e}")))?;
    Ok(Json(Completed { id, uhid }))
}
