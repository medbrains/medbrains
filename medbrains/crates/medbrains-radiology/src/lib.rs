#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::clinical_events::{
    ClinicalEventEnvelope, ClinicalEventName, ClinicalEventSourceModule,
};
use medbrains_core::permissions;
use medbrains_core::radiology::{
    RadiationDoseRecord, RadiologyModality, RadiologyOrder, RadiologyReport,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{delete, get, post, put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;

pub mod exams;
pub mod dose;
pub mod dose_capture;
pub mod dose_summary;
pub mod drl;
pub mod effective_dose;
pub mod form_f;
pub mod pacs;
pub mod pacs_config;
pub mod pacs_study;
pub mod pregnancy_check;
pub mod radiation_safety;
pub mod deidentify;
pub mod share;
pub mod share_public;
pub mod unmatched;
pub mod viewer;

// ══════════════════════════════════════════════════════════
//  Pre-contrast safety screening
// ══════════════════════════════════════════════════════════
// Before IV iodinated contrast, screen for contrast-induced nephropathy (CIN) risk from renal
// function, prior contrast-reaction history, and metformin (which must be held when renal function is
// impaired). The eGFR-driven CIN risk is invisible on the order form today — the existing
// allergy_flagged / pregnancy_checked booleans are attested, not computed. This pulls the patient's
// latest eGFR from labs and computes the risk + a clearance recommendation server-side (ACR/AERB).

#[derive(Debug, Deserialize)]
pub struct ContrastScreeningRequest {
    pub patient_id: Uuid,
    /// Attested prior reaction to iodinated contrast: none | mild | moderate | severe.
    pub prior_contrast_reaction: Option<String>,
    #[serde(default)]
    pub on_metformin: bool,
}

#[derive(Debug, Serialize)]
pub struct ContrastScreeningResult {
    /// Latest eGFR (mL/min/1.73m²) from labs, if any is recorded.
    pub egfr: Option<f64>,
    pub cin_risk: &'static str,
    pub reaction_risk: &'static str,
    pub metformin_action: &'static str,
    /// Overall recommendation: proceed | proceed_with_caution | hold_review.
    pub clearance: &'static str,
    pub flags: Vec<String>,
}

async fn latest_egfr(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<f64>, AppError> {
    let egfr = sqlx::query_scalar::<_, Option<f64>>(
        // Verified only -- see the same query in telehealth's renal CDS. This
        // one decides whether a patient is held for review before contrast.
        "SELECT lr.numeric_value::float8 FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lr.tenant_id = $1 AND lo.patient_id = $2 AND lr.numeric_value IS NOT NULL \
           AND lo.status = 'verified'::lab_order_status \
           AND (lower(lr.parameter_name) LIKE '%egfr%' OR lower(lr.parameter_name) LIKE '%gfr%') \
         ORDER BY lr.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    Ok(egfr)
}

async fn has_documented_contrast_allergy(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<bool, AppError> {
    let found: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM patient_allergies \
         WHERE tenant_id = $1 AND patient_id = $2 AND is_active \
           AND (lower(allergen_name) LIKE '%contrast%' OR lower(allergen_name) LIKE '%iodine%' \
             OR lower(allergen_name) LIKE '%iodinated%' OR lower(allergen_name) LIKE '%iohexol%' \
             OR lower(allergen_name) LIKE '%iodixanol%' OR lower(allergen_name) LIKE '%ioversol%' \
             OR lower(allergen_name) LIKE '%iopamidol%'))",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(found)
}

fn compute_contrast_screening(
    egfr: Option<f64>,
    prior_reaction: &str,
    on_metformin: bool,
    contrast_allergy_on_record: bool,
) -> ContrastScreeningResult {
    let mut flags = Vec::new();

    // CIN risk from renal function.
    let cin_risk = match egfr {
        None => {
            flags.push(
                "No recent eGFR on record — check renal function before contrast.".to_owned(),
            );
            "unknown"
        }
        Some(e) if e < 30.0 => {
            flags.push(format!(
                "eGFR {e:.0} — high CIN risk; radiologist review, consider non-contrast or \
                 alternative imaging and peri-procedure hydration."
            ));
            "high"
        }
        Some(e) if e < 45.0 => {
            flags.push(format!(
                "eGFR {e:.0} — moderate CIN risk; hydrate and minimise contrast volume."
            ));
            "moderate"
        }
        Some(e) if e < 60.0 => "low_moderate",
        Some(_) => "low",
    };

    // Reaction risk from attested prior-reaction history.
    let mut reaction_risk = match prior_reaction {
        "severe" => {
            flags.push(
                "Prior SEVERE contrast reaction — radiologist must clear; premedication protocol \
                 and resuscitation readiness required."
                    .to_owned(),
            );
            "severe"
        }
        "moderate" => {
            flags.push(
                "Prior moderate contrast reaction — premedication protocol advised.".to_owned(),
            );
            "moderate"
        }
        "mild" => {
            flags.push("Prior mild contrast reaction — observe post-injection.".to_owned());
            "mild"
        }
        _ => "none",
    };
    // A documented iodinated-contrast / iodine allergy on the patient record is treated as at least a
    // severe reaction risk — server-verified, independent of what was attested on the form.
    if contrast_allergy_on_record {
        flags.push(
            "Documented iodinated-contrast / iodine allergy on record — radiologist clearance and a \
             premedication protocol are required (or use a non-contrast alternative).".to_owned(),
        );
        reaction_risk = "severe";
    }

    // Metformin must be withheld when renal function is impaired or unknown.
    let metformin_action = if on_metformin {
        let impaired = egfr.is_none_or(|e| e < 45.0);
        if impaired {
            flags.push(
                "On metformin with impaired/unknown renal function — hold metformin at contrast and \
                 for 48h, recheck renal function before restarting.".to_owned(),
            );
            "hold_48h"
        } else {
            "continue"
        }
    } else {
        "not_applicable"
    };

    // Overall clearance.
    let clearance = if cin_risk == "high" || reaction_risk == "severe" {
        "hold_review"
    } else if cin_risk == "moderate" || cin_risk == "unknown" || reaction_risk == "moderate" {
        "proceed_with_caution"
    } else {
        "proceed"
    };

    ContrastScreeningResult {
        egfr,
        cin_risk,
        reaction_risk,
        metformin_action,
        clearance,
        flags,
    }
}

/// `POST /api/radiology/contrast-screening` — pre-contrast CIN + reaction risk from the patient's
/// latest eGFR and attested history.
pub async fn contrast_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ContrastScreeningRequest>,
) -> Result<Json<ContrastScreeningResult>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    // Screening reads the patient's renal function and contrast allergy history
    // to decide whether contrast is safe. The body names them.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;
    let prior = body.prior_contrast_reaction.as_deref().unwrap_or("none");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let egfr = latest_egfr(&mut tx, claims.tenant_id, body.patient_id).await?;
    let contrast_allergy =
        has_documented_contrast_allergy(&mut tx, claims.tenant_id, body.patient_id).await?;
    tx.commit().await?;
    Ok(Json(compute_contrast_screening(
        egfr,
        prior,
        body.on_metformin,
        contrast_allergy,
    )))
}

#[cfg(test)]
mod contrast_tests {
    use super::compute_contrast_screening;

    #[test]
    fn good_renal_no_history_proceeds() {
        let r = compute_contrast_screening(Some(90.0), "none", false, false);
        assert_eq!(r.cin_risk, "low");
        assert_eq!(r.clearance, "proceed");
    }

    #[test]
    fn low_egfr_holds_for_review() {
        let r = compute_contrast_screening(Some(25.0), "none", false, false);
        assert_eq!(r.cin_risk, "high");
        assert_eq!(r.clearance, "hold_review");
    }

    #[test]
    fn severe_reaction_holds_even_with_good_renal() {
        let r = compute_contrast_screening(Some(90.0), "severe", false, false);
        assert_eq!(r.clearance, "hold_review");
    }

    #[test]
    fn metformin_held_when_renal_impaired() {
        let r = compute_contrast_screening(Some(40.0), "none", true, false);
        assert_eq!(r.metformin_action, "hold_48h");
    }

    #[test]
    fn unknown_egfr_proceeds_with_caution() {
        let r = compute_contrast_screening(None, "none", false, false);
        assert_eq!(r.cin_risk, "unknown");
        assert_eq!(r.clearance, "proceed_with_caution");
    }

    #[test]
    fn documented_allergy_holds_even_with_good_renal_and_no_attested_history() {
        let r = compute_contrast_screening(Some(90.0), "none", false, true);
        assert_eq!(r.reaction_risk, "severe");
        assert_eq!(r.clearance, "hold_review");
    }
}

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListOrdersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub patient_id: Option<Uuid>,
    pub modality_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct OrderListResponse {
    pub orders: Vec<RadiologyOrder>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub modality_id: Uuid,
    pub body_part: Option<String>,
    pub body_part_code: Option<String>,
    pub body_part_laterality: Option<medbrains_core::body_site::Laterality>,
    pub clinical_indication: Option<String>,
    pub priority: Option<String>,
    pub scheduled_at: Option<String>,
    pub notes: Option<String>,
    pub contrast_required: Option<bool>,
    pub pregnancy_checked: Option<bool>,
    /// She is pregnant: an ultrasound then needs a PC-PNDT Form F.
    pub patient_pregnant: Option<bool>,
    pub allergy_flagged: Option<bool>,
    /// The catalogue exam; must belong to `modality_id`. Body part and
    /// contrast default from it when the request leaves them empty.
    #[serde(default)]
    pub exam_id: Option<Uuid>,
    /// Internal training / simulator flag. See OPD CreateEncounterRequest.
    #[serde(default)]
    pub is_dummy: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct OrderDetailResponse {
    pub order: RadiologyOrder,
    /// The pregnancy question must be answered before the exposure.
    pub pregnancy_check_required: bool,
    pub report: Option<RadiologyReport>,
    pub dose_records: Vec<RadiationDoseRecord>,
}

#[derive(Debug, Deserialize)]
pub struct CancelOrderRequest {
    pub cancellation_reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportRequest {
    pub findings: String,
    pub impression: Option<String>,
    pub recommendations: Option<String>,
    pub is_critical: Option<bool>,
    pub template_name: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateModalityRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    /// An ultrasound on a pregnant woman needs a PC-PNDT Form F.
    pub is_ultrasound: Option<bool>,
    /// Uses ionising radiation: the pregnancy question comes first.
    pub is_ionising: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModalityRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub is_ultrasound: Option<bool>,
    pub is_ionising: Option<bool>,
}


// ══════════════════════════════════════════════════════════
//  GET /api/radiology/orders
// ══════════════════════════════════════════════════════════

/// The radiology orders this caller holds `view` on; `None` for a bypass role
/// (no filter). An authorization outage is a 503, never an empty list.
async fn visible_order_ids(
    state: &AppState,
    claims: &Claims,
) -> Result<Option<Vec<Uuid>>, AppError> {
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(claims);
    if authz_ctx.is_bypass {
        return Ok(None);
    }
    match state
        .authz
        .list_accessible(&authz_ctx, "radiology_order", medbrains_authz::Relation::Viewer)
        .await
    {
        Ok(ids) => Ok(Some(ids)),
        Err(e) => {
            tracing::error!(error = %e, object_type = "radiology_order",
                "rebac: list_accessible failed; refusing rather than showing an empty list");
            Err(AppError::ServiceUnavailable(
                "authorization backend unavailable".to_owned(),
            ))
        }
    }
}

pub async fn list_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOrdersQuery>,
) -> Result<Json<OrderListResponse>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let visible_ids = visible_order_ids(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;
    if visible_ids.as_ref().is_some_and(Vec::is_empty) {
        return Ok(Json(OrderListResponse {
            orders: Vec::new(),
            total: 0,
            page,
            per_page,
        }));
    }

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
        bind_idx += 1;
    }
    if let Some(ref priority) = params.priority {
        conditions.push(format!("priority::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(priority.clone()),
        });
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("patient_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(pid),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(mid) = params.modality_id {
        conditions.push(format!("modality_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(mid),
            string_val: None,
        });
        bind_idx += 1;
    }

    // ReBAC scope clause is appended LAST so its `$bind_idx` placeholder lines up
    // with the bind order below (filters bind before visible_ids). Placing it first
    // misaligned it with `$2` while visible_ids was bound after the filters.
    if visible_ids.is_some() {
        conditions.push(format!("id = ANY(${bind_idx}::uuid[])"));
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM radiology_orders WHERE deleted_at IS NULL AND {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            cq = cq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            cq = cq.bind(s.clone());
        }
    }
    if let Some(ref ids) = visible_ids {
        cq = cq.bind(ids.clone());
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM radiology_orders WHERE deleted_at IS NULL AND {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, RadiologyOrder>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            dq = dq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            dq = dq.bind(s.clone());
        }
    }
    if let Some(ref ids) = visible_ids {
        dq = dq.bind(ids.clone());
    }
    let orders = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(OrderListResponse {
        orders,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/orders
// ══════════════════════════════════════════════════════════

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let order = create_order_in_tx(&mut tx, &claims, &body).await?;
    tx.commit().await?;
    Ok(Json(order))
}

/// Transaction-scoped sibling of `create_order`. Used by order basket so
/// multiple orders across modules commit atomically. Caller owns the tx
/// + tenant context. Does NOT check permissions — caller must.
pub async fn create_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateOrderRequest,
) -> Result<RadiologyOrder, AppError> {
    create_order_in_tx_with_options(tx, claims, body, CreateOrderOptions::default()).await
}

#[derive(Debug, Clone, Copy)]
pub struct CreateOrderOptions {
    pub auto_bill: bool,
}

impl Default for CreateOrderOptions {
    fn default() -> Self {
        Self { auto_bill: true }
    }
}

pub async fn create_order_in_tx_with_options(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateOrderRequest,
    options: CreateOrderOptions,
) -> Result<RadiologyOrder, AppError> {
    let priority = body.priority.as_deref().unwrap_or("routine");
    let exam = exam_defaults(tx, claims.tenant_id, body).await?;
    let contrast = body
        .contrast_required
        .unwrap_or_else(|| exam.as_ref().is_some_and(|e| e.contrast_given));
    let body_part = body
        .body_part
        .clone()
        .or_else(|| exam.as_ref().and_then(|e| e.body_part.clone()));
    let body_part_code = body
        .body_part_code
        .clone()
        .or_else(|| exam.as_ref().and_then(|e| e.body_part_code.clone()));
    let pregnancy = body.pregnancy_checked.unwrap_or(false);
    let allergy = body.allergy_flagged.unwrap_or(false);

    if let Some(encounter_id) = body.encounter_id {
        let encounter_patient_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        )
        .bind(encounter_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;

        if encounter_patient_id != body.patient_id {
            return Err(AppError::BadRequest(
                "encounter does not belong to patient".to_owned(),
            ));
        }
    }

    let is_dummy =
        body.is_dummy.unwrap_or(false) && medbrains_server_core::middleware::authorization::is_bypass_role(claims);

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "INSERT INTO radiology_orders \
         (tenant_id, patient_id, encounter_id, modality_id, ordered_by, \
          body_part, clinical_indication, priority, status, \
          scheduled_at, notes, contrast_required, pregnancy_checked, allergy_flagged, is_dummy, \
          body_part_code, body_part_laterality, exam_id, patient_pregnant) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::radiology_priority, \
                 'ordered'::radiology_order_status, \
                 $9::timestamptz, $10, $11, $12, $13, $14, $15, $16, $17, $18) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.modality_id)
    .bind(claims.sub)
    .bind(&body_part)
    .bind(&body.clinical_indication)
    .bind(priority)
    .bind(&body.scheduled_at)
    .bind(&body.notes)
    .bind(contrast)
    .bind(pregnancy)
    .bind(allergy)
    .bind(is_dummy)
    .bind(&body_part_code)
    .bind(body.body_part_laterality.map(medbrains_core::body_site::Laterality::as_str))
    .bind(body.exam_id)
    .bind(body.patient_pregnant.unwrap_or(false))
    .fetch_one(&mut **tx)
    .await?;

    form_f::open_if_required(tx, claims.tenant_id, order.id, claims.sub).await?;
    // Onto the modality worklist, when the hospital has a PACS.
    pacs::queue_worklist(tx, claims.tenant_id, &order).await?;

    if options.auto_bill {
        best_effort_auto_bill_radiology_order_in_tx(tx, claims, &order).await?;
    }

    Ok(order)
}

/// What an ordered exam fills in when the request leaves it empty.
struct ExamDefaults {
    body_part: Option<String>,
    body_part_code: Option<String>,
    contrast_given: bool,
}

/// Checks the exam is orderable and belongs to the ordered modality.
async fn exam_defaults(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    body: &CreateOrderRequest,
) -> Result<Option<ExamDefaults>, AppError> {
    let Some(exam_id) = body.exam_id else {
        return Ok(None);
    };
    let row: Option<(Uuid, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT modality_id, body_part, body_part_code, contrast FROM radiology_exams \
         WHERE id = $1 AND tenant_id = $2 AND is_active AND deleted_at IS NULL",
    )
    .bind(exam_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((modality_id, body_part, body_part_code, contrast)) = row else {
        return Err(AppError::BadRequest(
            "That exam is retired or not in the catalogue.".to_owned(),
        ));
    };
    if modality_id != body.modality_id {
        return Err(AppError::BadRequest(
            "That exam is not done on the chosen modality.".to_owned(),
        ));
    }
    Ok(Some(ExamDefaults {
        body_part,
        body_part_code,
        contrast_given: matches!(contrast.as_str(), "with" | "with_and_without"),
    }))
}

async fn best_effort_auto_bill_radiology_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    order: &RadiologyOrder,
) -> Result<(), AppError> {
    sqlx::query("SAVEPOINT radiology_order_auto_bill")
        .execute(&mut **tx)
        .await?;

    match auto_bill_radiology_order_in_tx(tx, claims, order).await {
        Ok(()) => {
            sqlx::query("RELEASE SAVEPOINT radiology_order_auto_bill")
                .execute(&mut **tx)
                .await?;
        }
        Err(error) => {
            sqlx::query("ROLLBACK TO SAVEPOINT radiology_order_auto_bill")
                .execute(&mut **tx)
                .await?;
            sqlx::query("RELEASE SAVEPOINT radiology_order_auto_bill")
                .execute(&mut **tx)
                .await?;
            tracing::warn!(
                error = %error,
                order_id = %order.id,
                "radiology order auto-billing failed; continuing with clinical order creation"
            );
        }
    }

    Ok(())
}

async fn auto_bill_radiology_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    order: &RadiologyOrder,
) -> Result<(), AppError> {
    if !medbrains_server_services::billing::is_auto_billing_enabled(tx, &claims.tenant_id, "radiology").await? {
        return Ok(());
    }

    let Some(encounter_id) = order.encounter_id else {
        return Ok(());
    };

    #[derive(sqlx::FromRow)]
    struct ModalityBillingInfo {
        code: String,
        name: String,
    }

    // The exam's own charge code when it has one, else `RAD-<modality>`.
    let modality = sqlx::query_as::<_, ModalityBillingInfo>(
        "SELECT COALESCE(re.charge_code, 'RAD-' || rm.code) AS code, \
                COALESCE(re.name, rm.name) AS name \
         FROM radiology_modalities rm \
         LEFT JOIN radiology_exams re ON re.id = $3 AND re.tenant_id = rm.tenant_id \
         WHERE rm.id = $1 AND rm.tenant_id = $2",
    )
    .bind(order.modality_id)
    .bind(claims.tenant_id)
    .bind(order.exam_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (charge_code, description) = modality.map_or_else(
        || ("RAD-EXAM".to_owned(), None),
        |m| (m.code, Some(format!("Radiology - {}", m.name))),
    );

    medbrains_server_services::billing::auto_charge(
        tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id: order.patient_id,
            encounter_id: Some(encounter_id),
            charge_code,
            source: "radiology".to_owned(),
            source_id: order.id,
            quantity: 1,
            description_override: description,
            unit_price_override: None,
            tax_percent_override: None,
        },
    )
    .await?;

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  GET /api/radiology/orders/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    // ── ReBAC pre-check — must hold `view` on the radiology_order ─
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    medbrains_server_core::middleware::authorization::collapse(
        medbrains_server_core::middleware::authorization::outcome_of(
            state.authz.check(&authz_ctx, medbrains_authz::Relation::Viewer, "radiology_order", id,).await,
            "radiology_order",
        ),
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "SELECT * FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let report = sqlx::query_as::<_, RadiologyReport>(
        "SELECT * FROM radiology_reports WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let dose_records = sqlx::query_as::<_, RadiationDoseRecord>(
        "SELECT * FROM radiation_dose_records \
         WHERE order_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY recorded_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let pregnancy_check_required =
        pregnancy_check::is_required(&mut tx, claims.tenant_id, order.id).await?;
    tx.commit().await?;
    Ok(Json(OrderDetailResponse {
        order,
        pregnancy_check_required,
        report,
        dose_records,
    }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/radiology/orders/{id}/status  — status transitions
// ══════════════════════════════════════════════════════════

pub async fn update_order_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStatusRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;
    // Cancelling has its own endpoint: it decides who may cancel, needs the
    // order still `ordered`, records the reason and reverses the charge. Here
    // it would skip all four.
    if body.status == "cancelled" {
        return Err(AppError::BadRequest(
            "Cancel an imaging order with its cancel action, not a status change".to_owned(),
        ));
    }
    // The path names the order; the patient is one hop away on it.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // An X-ray or CT of a woman who may be pregnant waits for the answer.
    if matches!(body.status.as_str(), "in_progress" | "completed") {
        pregnancy_check::require_answered(&mut tx, claims.tenant_id, id).await?;
    }

    let completed_clause = if body.status == "completed" {
        ", completed_at = now()"
    } else {
        ""
    };

    let sql = format!(
        "UPDATE radiology_orders SET \
         status = $1::radiology_order_status{completed_clause}, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *"
    );

    let order = sqlx::query_as::<_, RadiologyOrder>(&sql)
        .bind(&body.status)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    if body.status == "completed" {
        best_effort_auto_bill_radiology_order_in_tx(&mut tx, &claims, &order).await?;
    }

    let is_completed = body.status == "completed";
    if is_completed {
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::RadiologyOrderCompleted,
            order.id,
            claims.sub,
            serde_json::json!({
                "order_id": order.id,
                "patient_id": order.patient_id,
                "encounter_id": order.encounter_id,
                "modality_id": order.modality_id,
                "body_part": order.body_part.as_deref(),
                "priority": format!("{:?}", order.priority),
            }),
        )
        .with_patient(order.patient_id);
        if let Some(encounter_id) = order.encounter_id {
            event = event.with_encounter(encounter_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;

    if is_completed {
        // Post-commit: the radiology board tracks what is still pending, so a
        // completed study should drop off it immediately.
        medbrains_notifications::publish_surface_board_signal(
            &state,
            claims.tenant_id,
            "radiology",
            ClinicalEventName::RadiologyOrderCompleted.as_str(),
            "radiology_order",
            order.id,
        );

        // Enrich payload with patient name for orchestration
        let patient_name = sqlx::query_scalar::<_, String>(
            "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1",
        )
        .bind(order.patient_id)
        .fetch_optional(&mut *medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "Unknown".to_owned());

        let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            "radiology.completed",
            serde_json::json!({
                "order_id": order.id,
                "patient_id": order.patient_id,
                "patient_name": patient_name,
                "encounter_id": order.encounter_id,
                "modality_id": order.modality_id,
                "body_part": order.body_part,
                "priority": format!("{:?}", order.priority),
            }),
        )
        .await;
    }

    Ok(Json(order))
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

// ══════════════════════════════════════════════════════════
//  PUT /api/radiology/orders/{id}/cancel
// ══════════════════════════════════════════════════════════

pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelOrderRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CANCEL)?;
    // Cancelling somebody's imaging order is a decision about their care.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Seeing the patient is not cancelling somebody else's study.
    let ordered_by: Uuid = sqlx::query_scalar(
        "SELECT ordered_by FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_order_cancel(
        &claims,
        ordered_by,
        permissions::radiology::orders::CANCEL_ANY,
    )?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "UPDATE radiology_orders SET \
         status = 'cancelled'::radiology_order_status, \
         cancellation_reason = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND status = 'ordered'::radiology_order_status \
         RETURNING *",
    )
    .bind(&body.cancellation_reason)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    medbrains_server_services::billing::reverse_auto_charge_for_source(
        &mut tx,
        &claims.tenant_id,
        "radiology",
        id,
        claims.sub,
        &body.cancellation_reason,
    )
    .await?;

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::OrderCancelled,
        order.id,
        claims.sub,
        serde_json::json!({
            "order_id": order.id,
            "order_type": "radiology",
            "reason": body.cancellation_reason,
            "patient_id": order.patient_id,
            "encounter_id": order.encounter_id,
        }),
    )
    .with_source_module(ClinicalEventSourceModule::Radiology)
    .with_patient(order.patient_id);
    if let Some(encounter_id) = order.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/orders/{id}/report
// ══════════════════════════════════════════════════════════

pub async fn create_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<CreateReportRequest>,
) -> Result<Json<RadiologyReport>, AppError> {
    require_permission(&claims, permissions::radiology::reports::CREATE)?;
    // A radiology report is the finding written onto a patient's record.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        order_id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let report_status = body.status.as_deref().unwrap_or("draft");
    let is_critical = body.is_critical.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "SELECT * FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // A cancelled imaging order has no valid study — a report must not be created against it.
    if matches!(
        order.status,
        medbrains_core::radiology::RadiologyOrderStatus::Cancelled
    ) {
        return Err(AppError::Conflict(
            "Cannot create a report — this radiology order is cancelled.".to_owned(),
        ));
    }

    let report = sqlx::query_as::<_, RadiologyReport>(
        "INSERT INTO radiology_reports \
         (tenant_id, order_id, reported_by, status, findings, impression, \
          recommendations, is_critical, template_name) \
         VALUES ($1, $2, $3, $4::radiology_report_status, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .bind(claims.sub)
    .bind(report_status)
    .bind(&body.findings)
    .bind(&body.impression)
    .bind(&body.recommendations)
    .bind(is_critical)
    .bind(&body.template_name)
    .fetch_one(&mut *tx)
    .await?;

    // Update order status to reported
    sqlx::query(
        "UPDATE radiology_orders SET status = 'reported'::radiology_order_status, \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Critical finding → raise an alert + notify the responsible clinician
    // (encounter doctor, else the orderer) so it's actively communicated and
    // acknowledged — NABH critical-results reporting, same as critical labs.
    if is_critical {
        let finding = body
            .impression
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map_or_else(|| body.findings.clone(), ToOwned::to_owned);
        sqlx::query(
            "INSERT INTO radiology_critical_alerts \
             (tenant_id, order_id, report_id, patient_id, modality, finding, \
              notified_to, notified_at) \
             VALUES ($1, $2, $3, $4, \
               (SELECT name FROM radiology_modalities WHERE id = $5 AND tenant_id = $1), \
               $6, \
               COALESCE((SELECT doctor_id FROM encounters WHERE id = $7 AND tenant_id = $1), $8), \
               now())",
        )
        .bind(claims.tenant_id)
        .bind(order.id)
        .bind(report.id)
        .bind(order.patient_id)
        .bind(order.modality_id)
        .bind(&finding)
        .bind(order.encounter_id)
        .bind(order.ordered_by)
        .execute(&mut *tx)
        .await?;

        let recipient: Uuid = sqlx::query_scalar(
            "SELECT COALESCE( \
               (SELECT doctor_id FROM encounters WHERE id = $1 AND tenant_id = $2), $3)",
        )
        .bind(order.encounter_id)
        .bind(claims.tenant_id)
        .bind(order.ordered_by)
        .fetch_one(&mut *tx)
        .await?;
        let snippet: String = finding.chars().take(140).collect();
        medbrains_notifications::create_notification(
            &mut tx,
            claims.tenant_id,
            medbrains_notifications::NewNotification {
                user_id: recipient,
                kind: "danger",
                title: "Critical imaging finding",
                body: Some(&snippet),
                category: Some("Radiology"),
                entity_type: Some("radiology_order"),
                entity_id: Some(order.id),
                action_url: Some("/radiology"),
            },
        )
        .await?;
    }

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::RadiologyReportCreated,
        report.id,
        claims.sub,
        serde_json::json!({
            "report_id": report.id,
            "order_id": order.id,
            "patient_id": order.patient_id,
            "encounter_id": order.encounter_id,
            "modality_id": order.modality_id,
            "body_part": order.body_part.as_deref(),
            "report_status": report.status,
            "is_critical": report.is_critical,
            "reported_at": report.created_at,
        }),
    )
    .with_patient(order.patient_id);
    if let Some(encounter_id) = order.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    Ok(Json(report))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/radiology/reports/{id}/verify
// ══════════════════════════════════════════════════════════

pub async fn verify_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RadiologyReport>, AppError> {
    require_permission(&claims, permissions::radiology::reports::VERIFY)?;
    // Verifying a report finalises a diagnosis on somebody's record. The path
    // names the report; the patient is two hops away — report, order, patient.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_REPORT,
        id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // PC-PNDT: no report of an ultrasound of a pregnant woman without her Form F.
    let order_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT order_id FROM radiology_reports WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(order_id) = order_id {
        form_f::require_complete(&mut tx, claims.tenant_id, order_id).await?;
    }

    let report = sqlx::query_as::<_, RadiologyReport>(
        "UPDATE radiology_reports SET \
         status = 'final'::radiology_report_status, \
         verified_by = $1, verified_at = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Update the associated order to verified
    sqlx::query(
        "UPDATE radiology_orders SET status = 'verified'::radiology_order_status, \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(report.order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "SELECT * FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(report.order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::RadiologyReportVerified,
        report.id,
        claims.sub,
        serde_json::json!({
            "report_id": report.id,
            "order_id": order.id,
            "patient_id": order.patient_id,
            "encounter_id": order.encounter_id,
            "modality_id": order.modality_id,
            "body_part": order.body_part.as_deref(),
            "report_status": report.status,
            "verified_at": report.verified_at,
            "is_critical": report.is_critical,
        }),
    )
    .with_patient(order.patient_id);
    if let Some(encounter_id) = order.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    // Close the loop back to the ordering clinician: signal the verified imaging report
    // is ready to review. Routine reports otherwise gave no signal — only critical
    // findings notified (at report creation). Same recipient rule as the critical alert
    // (encounter doctor, else orderer); skip self-notification when the verifier is that
    // clinician. Parity with lab verify_results.
    let recipient: Uuid = sqlx::query_scalar(
        "SELECT COALESCE( \
           (SELECT doctor_id FROM encounters WHERE id = $1 AND tenant_id = $2), $3)",
    )
    .bind(order.encounter_id)
    .bind(claims.tenant_id)
    .bind(order.ordered_by)
    .fetch_one(&mut *tx)
    .await?;
    if recipient != claims.sub {
        medbrains_notifications::create_notification(
            &mut tx,
            claims.tenant_id,
            medbrains_notifications::NewNotification {
                user_id: recipient,
                kind: "info",
                title: "Imaging report ready",
                body: None,
                category: Some("Radiology"),
                entity_type: Some("radiology_order"),
                entity_id: Some(order.id),
                action_url: Some("/radiology"),
            },
        )
        .await?;
    }

    tx.commit().await?;
    Ok(Json(report))
}

// ══════════════════════════════════════════════════════════
//  Modality master CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_modalities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RadiologyModality>>, AppError> {
    // Ordering an exam means picking its modality: a doctor holds
    // `orders.create` without `orders.list`, and got an empty picker.
    require_any_permission(
        &claims,
        &[
            permissions::radiology::orders::LIST,
            permissions::radiology::orders::CREATE,
            permissions::radiology::modalities::MANAGE,
        ],
    )?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let modalities = sqlx::query_as::<_, RadiologyModality>(
        "SELECT * FROM radiology_modalities WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(modalities))
}

pub async fn create_modality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateModalityRequest>,
) -> Result<Json<RadiologyModality>, AppError> {
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let modality = sqlx::query_as::<_, RadiologyModality>(
        "INSERT INTO radiology_modalities \
           (tenant_id, code, name, description, is_ultrasound, is_ionising) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), \
                 COALESCE($6, upper($2) ~ '^(CT|CR|DX|XA|RF|MG|NM|PT|IO|PX|DXA|BMD|XR|FL|OPG)')) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.is_ultrasound)
    .bind(body.is_ionising)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(modality))
}

pub async fn update_modality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateModalityRequest>,
) -> Result<Json<RadiologyModality>, AppError> {
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let modality = sqlx::query_as::<_, RadiologyModality>(
        "UPDATE radiology_modalities SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         is_active = COALESCE($3, is_active), \
         is_ultrasound = COALESCE($6, is_ultrasound), \
         is_ionising = COALESCE($7, is_ionising), \
         updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.is_ultrasound)
    .bind(body.is_ionising)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(modality))
}

pub async fn delete_modality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let result = sqlx::query("UPDATE radiology_modalities SET deleted_at = now(), deleted_by = NULLIF(current_setting('app.user_id', true), '')::uuid, delete_reason = 'Deleted from the application', is_active = false WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}


// ══════════════════════════════════════════════════════════
//  GET /api/radiology/appointments — list scheduled orders
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAppointmentsQuery {
    pub modality_id: Option<Uuid>,
    /// Only orders scheduled (or, if unscheduled, raised) on this hospital day.
    pub date: Option<chrono::NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct RadiologyAppointment {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub modality: String,
    pub body_part: Option<String>,
    pub priority: String,
    pub status: String,
    pub notes: Option<String>,
    pub scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Open imaging orders, soonest first — the radiographer's day list.
pub async fn list_radiology_appointments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListAppointmentsQuery>,
) -> Result<Json<Vec<RadiologyAppointment>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    // The schedule names patients: the same orders the worklist may show.
    let visible_ids = visible_order_ids(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as!(
        RadiologyAppointment,
        r#"SELECT ro.id, ro.patient_id,
                  p.first_name || ' ' || p.last_name AS "patient_name!",
                  p.uhid, rm.name AS modality, ro.body_part,
                  ro.priority::text AS "priority!", ro.status::text AS "status!",
                  ro.notes, ro.scheduled_at, ro.created_at
           FROM radiology_orders ro
           JOIN patients p ON p.id = ro.patient_id
           JOIN radiology_modalities rm ON rm.id = ro.modality_id
           JOIN tenants t ON t.id = ro.tenant_id
           WHERE ro.tenant_id = $1
             AND ro.deleted_at IS NULL
             AND ro.status NOT IN ('cancelled', 'completed')
             AND ($2::uuid IS NULL OR ro.modality_id = $2)
             AND ($3::date IS NULL
                  OR (COALESCE(ro.scheduled_at, ro.created_at) AT TIME ZONE t.timezone)::date = $3)
             AND ($4::uuid[] IS NULL OR ro.id = ANY($4))
           ORDER BY COALESCE(ro.scheduled_at, ro.created_at)
           LIMIT 100"#,
        claims.tenant_id,
        query.modality_id,
        query.date,
        visible_ids.as_deref(),
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/appointments — schedule order
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRadiologyAppointmentRequest {
    pub patient_id: Uuid,
    pub modality_id: Uuid,
    pub encounter_id: Uuid,
    pub priority: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_radiology_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRadiologyAppointmentRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;
    // The appointment is booked FOR the patient named in the body.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        // `clinical_notes` is not a column. The free-text note column is
        // `notes`; `clinical_indication` also exists but is the justification
        // for the study, a distinct regulatory field, and the request's plain
        // `notes` must not be silently promoted into it.
        "INSERT INTO radiology_orders \
         (tenant_id, patient_id, encounter_id, modality_id, status, \
          priority, notes, ordered_by) \
         VALUES ($1, $2, $3, $4, 'ordered'::radiology_order_status, \
                 COALESCE($5, 'routine')::radiology_priority, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.modality_id)
    .bind(body.priority.as_deref())
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  GET /api/radiology/analytics/tat — TAT per modality
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RadiologyTatRow {
    pub modality_name: String,
    pub total_orders: i64,
    pub avg_tat_hours: Option<f64>,
    pub completed_count: i64,
}

pub async fn get_radiology_tat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RadiologyTatRow>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, RadiologyTatRow>(
        "SELECT rm.name AS modality_name, \
                COUNT(*)::bigint AS total_orders, \
                (AVG(EXTRACT(EPOCH FROM (ro.updated_at - ro.created_at)) / 3600.0) \
                    FILTER (WHERE ro.status = 'completed'))::float8 AS avg_tat_hours, \
                COUNT(*) FILTER (WHERE ro.status = 'completed')::bigint AS completed_count \
         FROM radiology_orders ro \
         JOIN radiology_modalities rm ON rm.id = ro.modality_id \
         WHERE ro.tenant_id = $1 \
           AND ro.created_at >= CURRENT_DATE - INTERVAL '30 days' \
         GROUP BY rm.name ORDER BY total_orders DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 2: PACS/DICOM, Share Links, Dosimetry
// ══════════════════════════════════════════════════════════

/// GET /api/radiology/dicom-studies
pub async fn list_dicom_studies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DicomStudyQuery>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;
    // A study list is a patient's imaging history. A named patient is checked
    // (404 when not theirs to see); no patient means only the patients this
    // caller may see — an unanswerable set is a 503, never an empty list.
    let permitted = medbrains_authz_gate::patient_filter(&state, &claims, params.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            String,
            Option<chrono::NaiveDate>,
            Option<String>,
            i32,
            i32,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<i64>,
        ),
    >(
        "SELECT id, patient_id, study_instance_uid, modality, study_date, study_description, \
         instance_count, series_count, viewer_url, orthanc_id, pacs_url, file_size_bytes \
         FROM radiology_dicom_studies \
         WHERE deleted_at IS NULL AND tenant_id = $2 \
           AND ($1::uuid[] IS NULL OR patient_id = ANY($1)) \
         ORDER BY study_date DESC NULLS LAST LIMIT 100",
    )
    .bind(permitted)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let result: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0, "patient_id": r.1, "study_instance_uid": r.2, "modality": r.3,
                "study_date": r.4, "study_description": r.5, "instance_count": r.6,
                "series_count": r.7, "viewer_url": r.8, "orthanc_id": r.9,
                "pacs_url": r.10, "file_size_bytes": r.11,
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

#[derive(Debug, serde::Deserialize)]
pub struct DicomStudyQuery {
    pub patient_id: Option<Uuid>,
}

/// GET /api/radiology/dicom-studies/{patient_id}/prior
pub async fn get_prior_studies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    // Prior studies are this patient's imaging history — what was looked for
    // and when, which is a diagnosis trail.
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id)
        .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Option<chrono::NaiveDate>,
            Option<String>,
            i32,
            i32,
            Option<String>,
            Option<String>,
            Option<i64>,
        ),
    >(
        "SELECT id, study_instance_uid, modality, study_date, study_description, \
         instance_count, series_count, viewer_url, pacs_url, file_size_bytes \
         FROM radiology_dicom_studies \
         WHERE patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY study_date DESC LIMIT 50",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let result: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0, "study_instance_uid": r.1, "modality": r.2,
                "study_date": r.3, "study_description": r.4, "instance_count": r.5,
                "series_count": r.6, "viewer_url": r.7, "pacs_url": r.8, "file_size_bytes": r.9,
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

/// GET /api/radiology/download-package/{study_id}
pub async fn get_download_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(study_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;
    // The study's patient must be one this caller may see; 404 otherwise.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_DICOM_STUDY,
        study_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let study = sqlx::query_as::<_, (String, String, Option<chrono::NaiveDate>, Option<String>, i32, Option<String>)>(
        "SELECT study_instance_uid, modality, study_date, study_description, instance_count, viewer_url \
         FROM radiology_dicom_studies WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(study_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "study_uid": study.0, "modality": study.1, "study_date": study.2,
        "description": study.3, "instance_count": study.4, "viewer_url": study.5,
        "download_instructions": "Use Orthanc API to download DICOM files, or share viewer link with patient.",
    })))
}

// ══════════════════════════════════════════════════════════
//  Patient radiology reports (EMR view)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientRadiologyReport {
    pub report_id: Uuid,
    pub order_id: Uuid,
    pub modality: Option<String>,
    pub ordered_at: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub findings: String,
    pub impression: Option<String>,
    pub is_critical: bool,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub alert_id: Option<Uuid>,
    pub alert_acknowledged_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// All of a patient's radiology reports (findings + impression + critical
/// flag + verification status) for the EMR imaging view — joined to the
/// order for modality + date.
pub async fn list_patient_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientRadiologyReport>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    // The path names the patient and the answer is every radiology report on
    // them. `radiology.orders.list` said the caller may list orders, not whose.
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id)
        .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PatientRadiologyReport>(
        "SELECT r.id AS report_id, r.order_id, m.name AS modality, o.created_at AS ordered_at, \
                r.status::text AS status, r.findings, r.impression, r.is_critical, r.verified_at, \
                ca.id AS alert_id, ca.acknowledged_at AS alert_acknowledged_at \
         FROM radiology_reports r \
         JOIN radiology_orders o ON o.id = r.order_id AND o.tenant_id = r.tenant_id \
              AND o.deleted_at IS NULL \
         LEFT JOIN radiology_modalities m ON m.id = o.modality_id AND m.tenant_id = o.tenant_id \
         LEFT JOIN radiology_critical_alerts ca ON ca.report_id = r.id AND ca.tenant_id = r.tenant_id \
         WHERE r.deleted_at IS NULL AND o.patient_id = $1 AND r.tenant_id = $2 \
         ORDER BY o.created_at DESC LIMIT 200",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Acknowledge a radiology critical-finding alert — the treating clinician
/// confirms they have seen and actioned the critical result.
pub async fn acknowledge_critical_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(alert_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::reports::VERIFY)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;

    // Acknowledging is a statement in this patient's record.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_CRITICAL_ALERT,
        alert_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let acknowledged_at = sqlx::query_scalar::<_, chrono::DateTime<chrono::Utc>>(
        "UPDATE radiology_critical_alerts SET \
           acknowledged_by = $1, acknowledged_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND acknowledged_at IS NULL \
         RETURNING acknowledged_at",
    )
    .bind(claims.sub)
    .bind(alert_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(
        serde_json::json!({ "id": alert_id, "acknowledged_at": acknowledged_at }),
    ))
}

/// Radiology (orders, studies, reports, PACS, dosimetry) authenticated routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/radiology/orders",
            get(list_orders).post(create_order),
        )
        .route(
            "/api/radiology/contrast-screening",
            post(contrast_screening),
        )
        .route(
            "/api/radiology/cumulative-dose",
            get(dose_summary::cumulative_dose),
        )
        .route(
            "/api/radiology/orders/{id}",
            get(get_order),
        )
        .route(
            "/api/radiology/orders/{id}/status",
            put(update_order_status),
        )
        .route(
            "/api/radiology/orders/{id}/cancel",
            put(cancel_order),
        )
        .route(
            "/api/radiology/patients/{patient_id}/reports",
            get(list_patient_reports),
        )
        .route(
            "/api/radiology/orders/{id}/report",
            post(create_report),
        )
        .route(
            "/api/radiology/orders/{id}/dose",
            post(dose::record_dose),
        )
        .route(
            "/api/radiology/unmatched-studies",
            get(unmatched::list_unmatched_studies),
        )
        .route(
            "/api/radiology/unmatched-studies/{id}/link",
            post(unmatched::link_unmatched_study),
        )
        .route(
            "/api/radiology/unmatched-studies/{id}/dismiss",
            post(unmatched::dismiss_unmatched_study),
        )
        .route(
            "/api/radiology/dose-records/{id}/entered-in-error",
            post(dose::mark_dose_entered_in_error),
        )
        .route(
            "/api/radiology/patients/{patient_id}/dose-records",
            get(dose_summary::list_patient_dose_records),
        )
        .route(
            "/api/radiology/reports/{id}/verify",
            put(verify_report),
        )
        .route(
            "/api/radiology/critical-alerts/{id}/acknowledge",
            put(acknowledge_critical_alert),
        )
        .route("/api/radiology/exams", get(exams::list_exams).post(exams::create_exam))
        .route(
            "/api/radiology/exams/{id}",
            put(exams::update_exam).delete(exams::delete_exam),
        )
        .route(
            "/api/radiology/modalities",
            get(list_modalities).post(create_modality),
        )
        .route(
            "/api/radiology/modalities/{id}",
            put(update_modality).delete(delete_modality),
        )
        .route(
            "/api/radiology/appointments",
            get(list_radiology_appointments)
                .post(create_radiology_appointment),
        )
        .route(
            "/api/radiology/analytics/tat",
            get(get_radiology_tat),
        )
        // Radiology Phase 2: PACS + Dosimetry
        .route("/api/radiology/dicom-studies", get(list_dicom_studies))
        .route("/api/radiology/dicom-studies/{patient_id}/prior", get(get_prior_studies))
        .route("/api/radiology/share-links", post(share::create_share_link))
        .route("/api/radiology/share-links/{id}/revoke", post(share::revoke_share_link))
        .route(
            "/api/radiology/dicom-studies/{id}/share-links",
            get(share::list_share_links),
        )
        .route("/api/radiology/dicom-studies/{id}/view", post(viewer::open_study_viewer))
        .route("/api/radiology/pacs/ohif/", get(viewer::staff_ohif))
        .route("/api/radiology/pacs/ohif/{*rest}", get(viewer::staff_ohif))
        .route("/api/radiology/pacs/dicom-web/{*rest}", get(viewer::staff_dicomweb))
        .route(
            "/api/radiology/pacs-config",
            get(pacs_config::get_pacs_config).put(pacs_config::update_pacs_config),
        )
        .route(
            "/api/radiology/dosimetry",
            get(radiation_safety::list_dosimetry).post(radiation_safety::record_reading),
        )
        .route("/api/radiology/dosimetry/{id}", delete(radiation_safety::remove_reading))
        .route(
            "/api/radiology/radiation-equipment",
            get(radiation_safety::list_equipment).put(radiation_safety::save_equipment),
        )
        .route(
            "/api/radiology/orders/{id}/pregnancy-check",
            post(pregnancy_check::record_pregnancy_check),
        )
        .route("/api/radiology/drls", get(drl::list_levels).put(drl::save_level))
        .route("/api/radiology/drls/{id}", delete(drl::remove_level))
        .route("/api/radiology/drl-audit", get(drl::drl_audit))
        .route("/api/radiology/download-package/{study_id}", get(get_download_package))
}
