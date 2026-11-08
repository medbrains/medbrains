//! IPD side of the room eligibility check (revenue integrity RFC, wave 1.4).
//!
//! The desk's pre-check before it allocates a bed, and the record the
//! allocation leaves. The rule itself lives in
//! `medbrains_server_services::room_eligibility`.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_kernel::{Actor, KernelError, require_any_permission, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use medbrains_server_services::room_eligibility::{
    RoomAllocation, RoomCheck, RoomConsentInput, SOURCE_ADMISSION_ROOM, check_room,
    record_allocation,
};

#[derive(Debug, Deserialize)]
pub struct RoomEligibilityQuery {
    pub patient_id: Uuid,
    pub bed_id: Uuid,
    /// The admission being transferred; empty for a new admission.
    pub admission_id: Option<Uuid>,
}

/// `GET /api/ipd/room-eligibility` — the bed's rate against the patient's
/// policy limit, before the desk allocates it.
///
/// Gated on the allocation it precedes: admitting or transferring. A
/// transfer names its admission and needs access to it. A new admission has
/// no care relationship yet, the same as `create_admission`.
///
/// # Errors
/// 403 without either permission or access to the admission; 404 for an
/// admission of another patient; a failed read is an error, never "within".
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_room_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<RoomEligibilityQuery>,
) -> Result<Json<RoomCheck>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::CREATE,
            permissions::ipd::transfers::CREATE,
        ],
    )?;
    if let Some(admission) = q.admission_id {
        medbrains_authz_gate::require_admission_access(&state, &claims, admission).await?;
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let encounter = match q.admission_id {
        Some(admission) => {
            Some(admission_encounter(&mut tx, &claims, admission, q.patient_id).await?)
        }
        None => None,
    };
    let check = check_room(&mut tx, claims.tenant_id, q.patient_id, q.bed_id, encounter).await?;
    tx.commit().await?;
    Ok(Json(check))
}

/// The admission's visit, when it belongs to `patient_id`; else 404.
async fn admission_encounter(
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    admission: Uuid,
    patient_id: Uuid,
) -> Result<Uuid, AppError> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT encounter_id FROM admissions \
          WHERE id = $1 AND tenant_id = $2 AND patient_id = $3 AND deleted_at IS NULL",
    )
    .bind(admission)
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// The ids an allocation is about.
#[derive(Debug)]
pub struct Allocated {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub bed_id: Uuid,
}

/// Record the room check for a bed just allocated.
///
/// It runs in its own savepoint so billing never blocks a bed: a failure leaves an open
/// `room_eligibility_unknown` row for the insurance desk instead, which
/// reads as "could not check", never as "within limit". Consent that fails
/// validation is the caller's 400, not a silent drop. Consent counts only
/// from someone who may record it (`insurance.room_eligibility.resolve`);
/// from anyone else the row stays open for the insurance desk.
pub async fn record_room(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    a: &Allocated,
    consent: Option<&RoomConsentInput>,
) -> Result<(), AppError> {
    let consent = match consent {
        Some(c) => may_record_consent(claims)?.then_some(c),
        None => None,
    };
    let alloc = RoomAllocation {
        tenant_id: claims.tenant_id,
        actor: claims.sub,
        admission_id: a.admission_id,
        patient_id: a.patient_id,
        encounter_id: a.encounter_id,
        bed_id: a.bed_id,
        consent,
    };
    let mut savepoint = sqlx::Acquire::begin(&mut **tx).await?;
    match record_allocation(&mut savepoint, alloc).await {
        Ok(_) => Ok(savepoint.commit().await?),
        Err(error @ AppError::BadRequest(_)) => Err(error),
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, admission_id = %a.admission_id, "room eligibility check failed");
            unknown_row(tx, claims, a).await
        }
    }
}

/// Whether the caller may record a room consent: a refusal is `false`, any
/// other fault is returned, never read as a refusal.
fn may_record_consent(claims: &Claims) -> Result<bool, AppError> {
    match require_permission(claims, permissions::insurance::room_eligibility::RESOLVE) {
        Ok(()) => Ok(true),
        Err(KernelError::Forbidden) => Ok(false),
        Err(other) => Err(other.into()),
    }
}

/// The open "could not check" row, best effort in its own savepoint.
async fn unknown_row(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    a: &Allocated,
) -> Result<(), AppError> {
    let mut savepoint = sqlx::Acquire::begin(&mut **tx).await?;
    let written = sqlx::query(
        "INSERT INTO charge_attention_items \
           (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id, \
            reason, evidence, service_at, created_by) \
         VALUES ($1, 'room_over_limit', $2, $3, $4, $5, 'room_eligibility_unknown', \
                 jsonb_build_object('bed_id', $6::uuid), now(), $7) \
         ON CONFLICT (tenant_id, source_module, source_entity_id) \
           WHERE status = 'open' AND deleted_at IS NULL \
         DO UPDATE SET evidence = COALESCE(charge_attention_items.evidence, '{}'::jsonb) \
                                  || '{\"last_check\": \"room_eligibility_unknown\"}', \
                       updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(SOURCE_ADMISSION_ROOM)
    .bind(a.admission_id)
    .bind(a.patient_id)
    .bind(a.encounter_id)
    .bind(a.bed_id)
    .bind(claims.sub)
    .execute(&mut *savepoint)
    .await;
    match written {
        Ok(_) => Ok(savepoint.commit().await?),
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, "room eligibility unknown row not written");
            Ok(())
        }
    }
}
