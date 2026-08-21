//! The transfusion as it happens at the bed.
//!
//! Two tables carry the word "transfusion" and they are not the same record.
//! `transfusion_records` is the bank's issue register — which unit left stock
//! for which patient — and every handler in `lib.rs` reads and writes it.
//! `transfusions` is the bedside chart: the admission, the bag hanging on the
//! pole, who checked the patient against it, and whether the patient reacted.
//!
//! Only the second one has ever mattered to `transfusion_observations`, whose
//! foreign key points at it. But nothing in the codebase inserted a row into
//! `transfusions` — not one INSERT — so the observation endpoint could not
//! succeed for any id a client was able to obtain, and the first fifteen
//! minutes of a transfusion, which is when a fatal ABO reaction presents,
//! could not be recorded at all. The print template for the monitoring chart
//! reads this table too, and had nothing to print.
//!
//! # Why these are nursing permissions
//!
//! The observation endpoint next door is gated on
//! `blood_bank.transfusion.create`, held by `blood_bank_tech` and by nobody
//! who stands at a bed. The bank issues a unit; a nurse hangs it and watches
//! the patient. Reusing the bank's code for the bedside act would have meant
//! granting ward nurses the issue register to let them chart a set of vitals.
//!
//! # The checklist is enforced here, not drawn
//!
//! Consent, compatibility, expiry and the two-person identity check are
//! conditions of starting, not boxes on a form. A UI can only decline to send;
//! a rule that lives on the server is one a second client cannot skip.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// A ward runs a handful of units on a bed, not a history. The chart is read
/// at the bedside and the list has to stay one screen.
const MAX_ROWS: i64 = 50;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BedsideTransfusion {
    pub id: Uuid,
    pub admission_id: Option<Uuid>,
    pub transfusion_date: Option<NaiveDate>,
    pub product_type: Option<String>,
    pub bag_number: Option<String>,
    pub blood_group: Option<String>,
    pub rh_factor: Option<String>,
    pub volume_ml: Option<i32>,
    pub expiry_date: Option<NaiveDate>,
    pub crossmatch_compatible: Option<bool>,
    pub patient_verified_by_id: Option<Uuid>,
    pub product_verified_by_id: Option<Uuid>,
    pub consent_on_file: Option<bool>,
    pub transfusion_start_time: Option<DateTime<Utc>>,
    pub transfusion_end_time: Option<DateTime<Utc>>,
    pub total_volume_infused_ml: Option<i32>,
    pub adverse_reaction: bool,
    pub reaction_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StartTransfusionRequest {
    pub product_type: String,
    pub bag_number: String,
    pub blood_group: String,
    pub rh_factor: Option<String>,
    pub volume_ml: Option<i32>,
    pub expiry_date: NaiveDate,
    pub crossmatch_compatible: bool,
    pub consent_on_file: bool,
    /// The second nurse who checked the patient's identity against the bag.
    pub product_verified_by_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CompleteTransfusionRequest {
    pub total_volume_infused_ml: Option<i32>,
}

/// `GET /api/ipd/admissions/{admission_id}/transfusions`
pub async fn list_bedside_transfusions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<BedsideTransfusion>>, AppError> {
    require_permission(&claims, permissions::nurse::transfusion::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, BedsideTransfusion>(
        "SELECT id, admission_id, transfusion_date, product_type, bag_number, blood_group, \
                rh_factor, volume_ml, expiry_date, crossmatch_compatible, \
                patient_verified_by_id, product_verified_by_id, consent_on_file, \
                transfusion_start_time, transfusion_end_time, total_volume_infused_ml, \
                adverse_reaction, reaction_type \
           FROM transfusions \
          WHERE tenant_id = $1 AND admission_id = $2 AND deleted_at IS NULL \
          ORDER BY transfusion_start_time DESC NULLS LAST, created_at DESC \
          LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(MAX_ROWS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/ipd/admissions/{admission_id}/transfusions` — hang a unit.
///
/// Every refusal below is a documented cause of a transfusion death, and each
/// one names what to do rather than what was wrong with the request.
pub async fn start_bedside_transfusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<StartTransfusionRequest>,
) -> Result<Json<BedsideTransfusion>, AppError> {
    require_permission(&claims, permissions::nurse::transfusion::ADMINISTER)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    if !body.consent_on_file {
        return Err(AppError::BadRequest(
            "Consent for transfusion must be on file before the unit is hung.".to_owned(),
        ));
    }
    if !body.crossmatch_compatible {
        return Err(AppError::BadRequest(
            "This unit is not recorded as crossmatch compatible. Return it to the blood bank."
                .to_owned(),
        ));
    }
    // The second nurse is the check. One person reading the bag to themselves
    // is the failure mode the two-person rule exists to catch, so the same
    // constraint the MAR witness carries applies here.
    if body.product_verified_by_id == claims.sub {
        return Err(AppError::BadRequest(
            "The second check must be done by a different nurse from the one hanging the unit."
                .to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Expiry is compared in the database, against the same clock that stamps
    // the row. A date sent by a handset whose clock has drifted is not the
    // question being asked.
    let expired = sqlx::query_scalar::<_, bool>("SELECT $1::date < CURRENT_DATE")
        .bind(body.expiry_date)
        .fetch_one(&mut *tx)
        .await?;
    if expired {
        return Err(AppError::BadRequest(
            "This unit has expired. Do not transfuse it; quarantine it and tell the blood bank."
                .to_owned(),
        ));
    }

    let verifier_active = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true)",
    )
    .bind(body.product_verified_by_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !verifier_active {
        return Err(AppError::BadRequest(
            "The second checker must be an active member of staff for this hospital.".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, BedsideTransfusion>(
        "INSERT INTO transfusions \
         (tenant_id, admission_id, transfusion_date, product_type, bag_number, blood_group, \
          rh_factor, volume_ml, expiry_date, crossmatch_compatible, patient_verified_by_id, \
          product_verified_by_id, consent_on_file, transfusion_start_time, started_by_id) \
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, true, $9, $10, true, now(), $9) \
         RETURNING id, admission_id, transfusion_date, product_type, bag_number, blood_group, \
                   rh_factor, volume_ml, expiry_date, crossmatch_compatible, \
                   patient_verified_by_id, product_verified_by_id, consent_on_file, \
                   transfusion_start_time, transfusion_end_time, total_volume_infused_ml, \
                   adverse_reaction, reaction_type",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&body.product_type)
    .bind(&body.bag_number)
    .bind(&body.blood_group)
    .bind(&body.rh_factor)
    .bind(body.volume_ml)
    .bind(body.expiry_date)
    .bind(claims.sub)
    .bind(body.product_verified_by_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/ipd/transfusions/{id}/complete` — the unit is down.
pub async fn complete_bedside_transfusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteTransfusionRequest>,
) -> Result<Json<BedsideTransfusion>, AppError> {
    require_permission(&claims, permissions::nurse::transfusion::ADMINISTER)?;
    // The path names the transfusion; the patient is one hop away on its
    // admission.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::BEDSIDE_TRANSFUSION,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Completing twice would move the end time later and overwrite who closed
    // it — a chart that says the unit ran an hour longer than it did.
    let row = sqlx::query_as::<_, BedsideTransfusion>(
        "UPDATE transfusions SET \
           transfusion_end_time = now(), \
           total_volume_infused_ml = COALESCE($3, total_volume_infused_ml), \
           completed_by_id = $2 \
         WHERE id = $1 AND tenant_id = $4 AND transfusion_end_time IS NULL \
           AND deleted_at IS NULL \
         RETURNING id, admission_id, transfusion_date, product_type, bag_number, blood_group, \
                   rh_factor, volume_ml, expiry_date, crossmatch_compatible, \
                   patient_verified_by_id, product_verified_by_id, consent_on_file, \
                   transfusion_start_time, transfusion_end_time, total_volume_infused_ml, \
                   adverse_reaction, reaction_type",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(body.total_volume_infused_ml)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}
