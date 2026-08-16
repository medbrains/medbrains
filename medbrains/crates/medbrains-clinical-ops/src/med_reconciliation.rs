//! Medication reconciliation (IPSG.6 / NABH MOM). At every care transition — admission, transfer,
//! discharge — a clinician reconciles the patient's existing medications against current orders. The
//! safety rule enforced here: a reconciliation cannot be completed until EVERY listed medication has an
//! explicit decision (continue / modify / stop / hold), because an un-reconciled medication is the
//! classic cause of transition-of-care harm.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// ReBAC pre-check: the caller must hold `view` on the patient whose reconciliations are being read.
/// Patient `view` is granted to the registering clerk (owner), the attending, department/ward members,
/// care-team groups and explicit shares (see `infra/spicedb/schema.zed`); bypass roles short-circuit
/// inside `check`. Mirrors the guard on `patients::get_patient`, so a patient's medication
/// reconciliations are scoped to the care team rather than readable for every holder of
/// `ipd::nursing_assessment::LIST` across the tenant. Fails closed to `NotFound`.
async fn require_patient_access(
    state: &AppState,
    claims: &Claims,
    patient_id: Uuid,
) -> Result<(), AppError> {
    // Delegates to the canonical resolver rather than repeating it. The
    // hand-rolled copy that lived here collapsed a backend outage into
    // `NotFound`, so a SpiceDB failure told the caller the record did not
    // exist; the shared one distinguishes an outage (503) from a refusal.
    medbrains_authz_gate::require_patient_access(state, claims, patient_id).await
}

const TRANSITIONS: [&str; 3] = ["admission", "transfer", "discharge"];
const SOURCES: [&str; 4] = ["home", "opd", "transfer", "other"];
const DECISIONS: [&str; 4] = ["continue", "modify", "stop", "hold"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MedReconciliation {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub transition_type: String,
    pub status: String,
    pub notes: Option<String>,
    pub reconciled_by: Option<Uuid>,
    pub reconciled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MedReconciliationItem {
    pub id: Uuid,
    pub reconciliation_id: Uuid,
    pub drug_name: String,
    pub dose: Option<String>,
    pub frequency: Option<String>,
    pub route: Option<String>,
    pub source: String,
    pub decision: Option<String>,
    pub decision_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MedReconciliationView {
    pub reconciliation: MedReconciliation,
    pub items: Vec<MedReconciliationItem>,
}

const RECON_COLS: &str = "id, patient_id, admission_id, transition_type, status, notes, \
     reconciled_by, reconciled_at, created_at";
const ITEM_COLS: &str = "id, reconciliation_id, drug_name, dose, frequency, route, source, \
     decision, decision_reason";

async fn load_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    reconciliation_id: Uuid,
) -> Result<Vec<MedReconciliationItem>, AppError> {
    let items = sqlx::query_as::<_, MedReconciliationItem>(&format!(
        "SELECT {ITEM_COLS} FROM medication_reconciliation_items \
         WHERE tenant_id = $1 AND reconciliation_id = $2 ORDER BY created_at"
    ))
    .bind(tenant_id)
    .bind(reconciliation_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(items)
}

#[derive(Debug, Deserialize)]
pub struct NewMedItem {
    pub drug_name: String,
    pub dose: Option<String>,
    pub frequency: Option<String>,
    pub route: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMedReconciliationRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub transition_type: String,
    pub notes: Option<String>,
    pub items: Vec<NewMedItem>,
}

/// `POST /api/clinical/med-reconciliation`
pub async fn create_med_reconciliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMedReconciliationRequest>,
) -> Result<Json<MedReconciliationView>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !TRANSITIONS.contains(&body.transition_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "invalid transition_type '{}'",
            body.transition_type
        )));
    }
    if body.items.is_empty() {
        return Err(AppError::BadRequest("at least one medication is required".into()));
    }
    for item in &body.items {
        let source = item.source.as_deref().unwrap_or("home");
        if !SOURCES.contains(&source) {
            return Err(AppError::BadRequest(format!("invalid source '{source}'")));
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let recon = sqlx::query_as::<_, MedReconciliation>(&format!(
        "INSERT INTO medication_reconciliations \
         (tenant_id, patient_id, admission_id, transition_type, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING {RECON_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(&body.transition_type)
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        sqlx::query(
            "INSERT INTO medication_reconciliation_items \
             (tenant_id, reconciliation_id, drug_name, dose, frequency, route, source) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(claims.tenant_id)
        .bind(recon.id)
        .bind(&item.drug_name)
        .bind(item.dose.as_deref())
        .bind(item.frequency.as_deref())
        .bind(item.route.as_deref())
        .bind(item.source.as_deref().unwrap_or("home"))
        .execute(&mut *tx)
        .await?;
    }

    let items = load_items(&mut tx, claims.tenant_id, recon.id).await?;
    tx.commit().await?;
    Ok(Json(MedReconciliationView { reconciliation: recon, items }))
}

#[derive(Debug, Deserialize)]
pub struct DecideItemRequest {
    pub decision: String,
    pub decision_reason: Option<String>,
}

/// `PATCH /api/clinical/med-reconciliation-item/{id}` — record the decision for one medication.
pub async fn decide_med_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecideItemRequest>,
) -> Result<Json<MedReconciliationItem>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if !DECISIONS.contains(&body.decision.as_str()) {
        return Err(AppError::BadRequest(format!("invalid decision '{}'", body.decision)));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let item = sqlx::query_as::<_, MedReconciliationItem>(&format!(
        "UPDATE medication_reconciliation_items \
         SET decision = $3, decision_reason = $4 \
         WHERE tenant_id = $1 AND id = $2 RETURNING {ITEM_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&body.decision)
    .bind(body.decision_reason.as_deref())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(item))
}

/// `POST /api/clinical/med-reconciliation/{id}/complete` — finalise once every med has a decision.
pub async fn complete_med_reconciliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MedReconciliationView>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Safety gate: no medication may be left un-reconciled.
    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medication_reconciliation_items \
         WHERE tenant_id = $1 AND reconciliation_id = $2 AND decision IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    if pending > 0 {
        return Err(AppError::BadRequest(format!(
            "{pending} medication(s) still need a decision before completing"
        )));
    }

    let recon = sqlx::query_as::<_, MedReconciliation>(&format!(
        "UPDATE medication_reconciliations \
         SET status = 'completed', reconciled_by = $3, reconciled_at = now(), updated_at = now() \
         WHERE tenant_id = $1 AND id = $2 AND status = 'in_progress' RETURNING {RECON_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = load_items(&mut tx, claims.tenant_id, recon.id).await?;
    tx.commit().await?;
    Ok(Json(MedReconciliationView { reconciliation: recon, items }))
}

#[derive(Debug, Deserialize)]
pub struct ListMedReconciliationQuery {
    pub patient_id: Uuid,
}

/// `GET /api/clinical/med-reconciliations?patient_id=`
pub async fn list_med_reconciliations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMedReconciliationQuery>,
) -> Result<Json<Vec<MedReconciliationView>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    require_patient_access(&state, &claims, params.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let recons = sqlx::query_as::<_, MedReconciliation>(&format!(
        "SELECT {RECON_COLS} FROM medication_reconciliations \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 50"
    ))
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut views = Vec::with_capacity(recons.len());
    for recon in recons {
        let items = load_items(&mut tx, claims.tenant_id, recon.id).await?;
        views.push(MedReconciliationView { reconciliation: recon, items });
    }
    tx.commit().await?;
    Ok(Json(views))
}
