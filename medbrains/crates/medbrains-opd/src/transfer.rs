//! `POST /api/opd/encounters/{id}/transfer` — move a waiting visit to another
//! department (RFCs/modules/RFC-MODULE-token-queues.md, P2, scenario 33).
//!
//! A patient registered to General Medicine who needs Orthopaedics. Changing
//! the visit's department alone left the queue row and the token in the old
//! department: the patient sat in a queue that would never call them. The
//! visit, its queue row and its token now move together, before any doctor
//! has called them — after that it is a referral.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{authz_context, require_permission};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct TransferVisitRequest {
    pub department_id: Uuid,
    /// The new department's doctor, if the desk knows who will see them.
    pub doctor_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct TransferVisitResponse {
    pub encounter_id: Uuid,
    pub department_id: Uuid,
    /// The number the new department's board will call.
    pub token_number: Option<String>,
}

pub async fn transfer_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<TransferVisitRequest>,
) -> Result<Json<TransferVisitResponse>, AppError> {
    require_permission(&claims, permissions::opd::visit::TRANSFER)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current = sqlx::query!(
        r#"SELECT department_id, status::text AS "status!" FROM encounters
            WHERE id = $1 AND tenant_id = $2 FOR UPDATE"#,
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if current.status != "open" {
        return Err(AppError::Conflict(
            "The consultation has started — the doctor can refer the patient instead".to_owned(),
        ));
    }
    if current.department_id == Some(body.department_id) {
        return Err(AppError::BadRequest(
            "The visit is already in that department".to_owned(),
        ));
    }
    let department_ok = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM departments
                          WHERE id = $1 AND tenant_id = $2 AND is_active) AS "ok!""#,
        body.department_id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    if !department_ok {
        return Err(AppError::BadRequest(
            "Choose an active department".to_owned(),
        ));
    }

    let token_number = medbrains_tokens::transfer::transfer_visit_token_in_tx(
        &mut tx,
        claims.tenant_id,
        id,
        body.department_id,
    )
    .await?
    .map_err(AppError::Conflict)?;
    // The old department's doctor is not the new one's; an unnamed doctor is
    // chosen by the new department, as at registration.
    sqlx::query!(
        "UPDATE encounters SET department_id = $2, doctor_id = $3, updated_at = now() \
          WHERE id = $1",
        id,
        body.department_id,
        body.doctor_id,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE opd_queues SET department_id = $2, doctor_id = $3, updated_at = now() \
          WHERE encounter_id = $1 AND deleted_at IS NULL",
        id,
        body.department_id,
        body.doctor_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    grant_new_care_team(&state, &claims, id, body.department_id, body.doctor_id).await?;
    Ok(Json(TransferVisitResponse {
        encounter_id: id,
        department_id: body.department_id,
        token_number,
    }))
}

/// The same grants a new visit writes: the department sees it, the named
/// doctor attends it. Without them the new department's doctor could not open
/// the visit they are now meant to see.
async fn grant_new_care_team(
    state: &AppState,
    claims: &Claims,
    encounter_id: Uuid,
    department_id: Uuid,
    doctor_id: Option<Uuid>,
) -> Result<(), AppError> {
    let ctx = authz_context(claims);
    state
        .authz
        .grant_raw(
            &ctx,
            "encounter",
            encounter_id,
            "dept_member",
            medbrains_authz::Subject::Department(department_id),
            None,
            Some("encounter_department".to_owned()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("encounter dept authz grant failed: {e}")))?;
    if let Some(doctor) = doctor_id {
        state
            .authz
            .write_tuple(
                &ctx,
                "encounter",
                encounter_id,
                medbrains_authz::Relation::AttendingPhysician,
                medbrains_authz::Subject::User(doctor),
                None,
                Some("encounter_attending".to_owned()),
            )
            .await
            .map_err(|e| {
                AppError::Internal(format!("encounter attending authz grant failed: {e}"))
            })?;
    }
    Ok(())
}
